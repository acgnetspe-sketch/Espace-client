// Lectures et écritures réservées aux administrateurs ACG.
// La base refuse toutes ces écritures à un client (règles RLS, migration 2) :
// ce fichier n'est qu'une commodité d'interface, pas une barrière de sécurité.

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ErreurChargement } from './requetes';
import type { SiteImporte } from './csv';
import { reduireImage } from './photos';
import type {
  Demande,
  Fichier,
  StatutDemande,
  Organisation,
  Profil,
  Site,
  StatutIntervention,
  TypeFichier,
  TypeIntervention,
} from './types';

const COLONNES_SITE =
  'id, organisation_id, nom, code_interne, commune, departement, type_installation, surface_modules_m2, surface_vegetation_ha, soumis_old, date_limite_old, latitude, longitude';
const COLONNES_PROFIL = 'id, organisation_id, nom, fonction, telephone, email, role, recoit_emails';

/** Intervention complète (table, et non la vue client). */
export interface InterventionAdmin {
  id: string;
  site_id: string;
  type: TypeIntervention;
  statut: StatutIntervention;
  debut_prevu: string | null;
  fin_prevue: string | null;
  debut_reel: string | null;
  fin_reelle: string | null;
  surface_m2: number | null;
  surface_ha: number | null;
  encrassement: number | null;
  panneaux_casses: number;
  anomalies: string | null;
  anomalie_traitee: boolean;
  bon_commande: string | null;
  publiee: boolean;
  publiee_le: string | null;
}

export type DonneesIntervention = Omit<InterventionAdmin, 'id' | 'publiee' | 'publiee_le'>;
export type DonneesSite = Omit<Site, 'id'>;

export interface EtatCompte {
  profil_id: string;
  invite_le: string | null;
  active_le: string | null;
  derniere_connexion: string | null;
}

/** Messages lisibles pour les erreurs connues de la base. */
function traduire(erreur: { message: string; code?: string; details?: string }): string {
  const m = erreur.message ?? '';
  if (erreur.code === '23503') return 'Suppression impossible : des éléments y sont encore rattachés (sites, interventions ou contacts).';
  if (erreur.code === '23505') return 'Cette valeur existe déjà (doublon).';
  if (m.includes('interventions_publiee_si_realisee')) return 'Seule une intervention « Réalisée » peut être publiée.';
  if (m.includes('interventions_periode')) return 'La date de fin doit être postérieure ou égale à la date de début.';
  if (m.includes('encrassement')) return 'L’encrassement doit être compris entre 1 et 10.';
  if (m.includes('departement')) return 'Département invalide (exemples : 13, 06, 2A, 974).';
  if (erreur.code === '42501') return 'Action non autorisée.';
  return 'L’enregistrement a échoué. Vérifiez les champs puis réessayez.';
}

function verifier<T>(resultat: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (resultat.error) {
    console.error(resultat.error);
    throw new ErreurChargement(traduire(resultat.error));
  }
  return resultat.data as T;
}

// ---------------------------------------------------------------------------
// Organisations et contacts
// ---------------------------------------------------------------------------
export async function listerOrganisations(): Promise<Organisation[]> {
  return verifier(await supabase.from('organisations').select('id, nom, adresse').order('nom'));
}

export async function creerOrganisation(nom: string, adresse: string | null): Promise<Organisation> {
  return verifier(await supabase.from('organisations').insert({ nom, adresse }).select('id, nom, adresse').single());
}

export async function modifierOrganisation(id: string, nom: string, adresse: string | null): Promise<void> {
  verifier(await supabase.from('organisations').update({ nom, adresse }).eq('id', id));
}

export async function supprimerOrganisation(id: string): Promise<void> {
  verifier(await supabase.from('organisations').delete().eq('id', id));
}

export async function lireNotesOrganisation(id: string): Promise<string> {
  const ligne = verifier(
    await supabase.from('organisations_internes').select('notes').eq('organisation_id', id).maybeSingle(),
  ) as { notes: string | null } | null;
  return ligne?.notes ?? '';
}

export async function enregistrerNotesOrganisation(id: string, notes: string): Promise<void> {
  verifier(await supabase.from('organisations_internes').upsert({ organisation_id: id, notes }));
}

export async function listerProfils(): Promise<Profil[]> {
  return verifier(await supabase.from('profils').select(COLONNES_PROFIL).order('nom'));
}

export async function modifierProfil(
  id: string,
  champs: Pick<Profil, 'nom' | 'fonction' | 'telephone' | 'recoit_emails'>,
): Promise<void> {
  verifier(await supabase.from('profils').update(champs).eq('id', id));
}

export async function listerEtatComptes(): Promise<Map<string, EtatCompte>> {
  const lignes = verifier(await supabase.rpc('etat_comptes')) as EtatCompte[];
  return new Map(lignes.map((l) => [l.profil_id, l]));
}

export async function listerAccesSites(): Promise<{ profil_id: string; site_id: string }[]> {
  return verifier(await supabase.from('acces_sites').select('profil_id, site_id'));
}

/** Remplace la liste des sites autorisés d'un contact (liste vide = tous les sites). */
export async function definirAccesSites(profilId: string, sites: string[]): Promise<void> {
  verifier(await supabase.from('acces_sites').delete().eq('profil_id', profilId));
  if (sites.length > 0) {
    verifier(await supabase.from('acces_sites').insert(sites.map((site_id) => ({ profil_id: profilId, site_id }))));
  }
}

/** Appel de l'Edge Function « admin-contacts » (création et suppression de comptes). */
async function appelerFonctionContacts(corps: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('admin-contacts', { body: corps });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      throw new ErreurChargement(detail?.erreur ?? 'L’opération a échoué.');
    }
    console.error(error);
    throw new ErreurChargement(
      'Le service d’invitation ne répond pas. Vérifiez que la fonction « admin-contacts » est bien déployée dans Supabase.',
    );
  }
  return (data as { message?: string })?.message ?? 'Opération effectuée.';
}

export function inviterContact(invitation: {
  email: string;
  nom: string;
  fonction: string | null;
  telephone: string | null;
  role: 'client' | 'admin';
  organisation_id: string | null;
  sites: string[];
}): Promise<string> {
  return appelerFonctionContacts({ action: 'inviter', ...invitation, redirect_to: window.location.origin });
}

export function renvoyerInvitation(profilId: string): Promise<string> {
  return appelerFonctionContacts({ action: 'renvoyer', profil_id: profilId, redirect_to: window.location.origin });
}

export function supprimerContact(profilId: string): Promise<string> {
  return appelerFonctionContacts({ action: 'supprimer', profil_id: profilId });
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------
export async function listerSitesAdmin(): Promise<Site[]> {
  return verifier(await supabase.from('sites').select(COLONNES_SITE).order('nom'));
}

export async function lireSiteAdmin(id: string): Promise<Site | null> {
  return verifier(await supabase.from('sites').select(COLONNES_SITE).eq('id', id).maybeSingle());
}

export async function creerSite(site: DonneesSite): Promise<Site> {
  return verifier(await supabase.from('sites').insert(site).select(COLONNES_SITE).single());
}

export async function modifierSite(id: string, site: Omit<DonneesSite, 'organisation_id'>): Promise<void> {
  verifier(await supabase.from('sites').update(site).eq('id', id));
}

export async function supprimerSite(id: string): Promise<void> {
  verifier(await supabase.from('sites').delete().eq('id', id));
}

export async function importerSites(organisationId: string, sites: SiteImporte[]): Promise<number> {
  const lignes = sites.map((s) => ({ ...s, organisation_id: organisationId }));
  const resultat = verifier(await supabase.from('sites').insert(lignes).select('id')) as { id: string }[];
  return resultat.length;
}

// ---------------------------------------------------------------------------
// Interventions
// ---------------------------------------------------------------------------
const COLONNES_INTERVENTION =
  'id, site_id, type, statut, debut_prevu, fin_prevue, debut_reel, fin_reelle, surface_m2, surface_ha, encrassement, panneaux_casses, anomalies, anomalie_traitee, bon_commande, publiee, publiee_le';

export async function listerInterventionsAdmin(): Promise<InterventionAdmin[]> {
  return verifier(
    await supabase.from('interventions').select(COLONNES_INTERVENTION).order('debut_prevu', { ascending: false, nullsFirst: false }),
  );
}

export async function lireInterventionAdmin(id: string): Promise<InterventionAdmin | null> {
  return verifier(await supabase.from('interventions').select(COLONNES_INTERVENTION).eq('id', id).maybeSingle());
}

export async function creerIntervention(donnees: DonneesIntervention): Promise<InterventionAdmin> {
  return verifier(await supabase.from('interventions').insert(donnees).select(COLONNES_INTERVENTION).single());
}

export async function modifierIntervention(id: string, donnees: Partial<DonneesIntervention>): Promise<void> {
  verifier(await supabase.from('interventions').update(donnees).eq('id', id));
}

export async function definirPublication(id: string, publiee: boolean): Promise<void> {
  verifier(await supabase.from('interventions').update({ publiee }).eq('id', id));
}

export async function marquerAnomalieTraitee(id: string): Promise<void> {
  verifier(await supabase.from('interventions').update({ anomalie_traitee: true }).eq('id', id));
}

export async function supprimerIntervention(id: string): Promise<void> {
  const fichiers = await listerFichiers({ intervention_id: id });
  verifier(await supabase.from('interventions').delete().eq('id', id));
  if (fichiers.length > 0) await supabase.storage.from('documents').remove(fichiers.map((f) => f.chemin));
}

export async function lireNotesIntervention(id: string): Promise<string> {
  const ligne = verifier(
    await supabase.from('interventions_internes').select('notes_internes').eq('intervention_id', id).maybeSingle(),
  ) as { notes_internes: string | null } | null;
  return ligne?.notes_internes ?? '';
}

export async function enregistrerNotesIntervention(id: string, notes: string): Promise<void> {
  verifier(await supabase.from('interventions_internes').upsert({ intervention_id: id, notes_internes: notes }));
}

// ---------------------------------------------------------------------------
// Fichiers (stockage privé « documents »)
// ---------------------------------------------------------------------------
export type CibleFichier = { intervention_id: string } | { site_id: string };

export async function listerFichiers(cible: CibleFichier): Promise<Fichier[]> {
  const [colonne, valeur] = 'intervention_id' in cible ? ['intervention_id', cible.intervention_id] : ['site_id', cible.site_id];
  return verifier(
    await supabase
      .from('fichiers')
      .select('id, intervention_id, site_id, type, chemin, nom, taille_octets, ajoute_le')
      .eq(colonne, valeur)
      .order('ajoute_le'),
  );
}

/** Nom de fichier sûr pour le stockage : minuscules, sans accents ni espaces. */
export function nomStockage(nom: string): string {
  const point = nom.lastIndexOf('.');
  const base = point > 0 ? nom.slice(0, point) : nom;
  const extension = point > 0 ? nom.slice(point + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'pdf';
  const propre = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${propre || 'fichier'}.${extension || 'pdf'}`;
}

export const TAILLE_MAX_OCTETS = 50 * 1024 * 1024;

/**
 * Dépose un fichier dans le stockage privé puis l'enregistre dans la table
 * « fichiers ». Chemin : organisation/site/intervention (ou « documents »)/fichier.
 */
export const estPhoto = (type: TypeFichier) => type === 'photo_avant' || type === 'photo_apres';

/**
 * Dépose un fichier dans le stockage privé puis l'enregistre dans la table
 * « fichiers ». Chemin : organisation/site/intervention (ou « documents »)/fichier.
 * Les photos sont réduites (2000 px, JPEG) avant l'envoi.
 */
export async function deposerFichier(
  fichier: File,
  type: TypeFichier,
  emplacement: { organisation_id: string; site_id: string; intervention_id?: string },
): Promise<void> {
  let contenu: Blob = fichier;
  let typeMime = 'application/pdf';
  let nom = fichier.name;
  if (estPhoto(type)) {
    if (!fichier.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(fichier.name)) {
      throw new ErreurChargement(`« ${fichier.name} » n’est pas une photo.`);
    }
    try {
      contenu = await reduireImage(fichier);
    } catch {
      throw new ErreurChargement(`La photo « ${fichier.name} » n’a pas pu être lue (format non pris en charge par ce navigateur).`);
    }
    typeMime = 'image/jpeg';
    nom = fichier.name.replace(/\.[^.]+$/, '') + '.jpg';
  } else if (fichier.type !== 'application/pdf' && !fichier.name.toLowerCase().endsWith('.pdf')) {
    throw new ErreurChargement('Seuls les fichiers PDF sont acceptés pour un rapport ou un document.');
  }
  if (contenu.size > TAILLE_MAX_OCTETS) throw new ErreurChargement('Fichier trop volumineux (50 Mo au maximum).');

  const dossier = emplacement.intervention_id ?? 'documents';
  const horodatage = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 17);
  const chemin = `${emplacement.organisation_id}/${emplacement.site_id}/${dossier}/${horodatage}-${nomStockage(nom)}`;

  const { error: erreurDepot } = await supabase.storage
    .from('documents')
    .upload(chemin, contenu, { contentType: typeMime, upsert: false });
  if (erreurDepot) {
    console.error(erreurDepot);
    throw new ErreurChargement(`« ${fichier.name} » n’a pas pu être déposé. Vérifiez votre connexion puis réessayez.`);
  }

  const rattachement = emplacement.intervention_id
    ? { intervention_id: emplacement.intervention_id }
    : { site_id: emplacement.site_id };
  const { error } = await supabase
    .from('fichiers')
    .insert({ ...rattachement, type, chemin, nom, taille_octets: contenu.size });
  if (error) {
    await supabase.storage.from('documents').remove([chemin]); // pas de fichier orphelin
    console.error(error);
    throw new ErreurChargement(`« ${fichier.name} » n’a pas pu être enregistré.`);
  }
}

export async function supprimerFichier(fichier: Fichier): Promise<void> {
  verifier(await supabase.from('fichiers').delete().eq('id', fichier.id));
  const { error } = await supabase.storage.from('documents').remove([fichier.chemin]);
  if (error) console.error('Fichier retiré de la liste mais pas du stockage', error);
}

// ---------------------------------------------------------------------------
// Demandes (V2)
// ---------------------------------------------------------------------------
export async function listerDemandesAdmin(): Promise<Demande[]> {
  return verifier(
    await supabase
      .from('demandes')
      .select('id, organisation_id, site_id, intervention_id, auteur_id, type, message, date_souhaitee, statut, reponse, creee_le, modifie_le')
      .order('creee_le', { ascending: false }),
  );
}

/** Change le statut et la réponse. Une réponse nouvelle ou modifiée part par e-mail à l'auteur. */
export async function repondreDemande(id: string, statut: StatutDemande, reponse: string | null): Promise<void> {
  verifier(await supabase.from('demandes').update({ statut, reponse }).eq('id', id));
}

// ---------------------------------------------------------------------------
// Journal des e-mails automatiques
// ---------------------------------------------------------------------------
export interface EmailJournal {
  id: string;
  type: 'rapport_publie' | 'rappel_passage' | 'reponse_demande' | 'nouvelle_demande';
  destinataire: string;
  nom_destinataire: string | null;
  donnees: Record<string, unknown>;
  cree_le: string;
  envoye_le: string | null;
  tentatives: number;
  derniere_erreur: string | null;
}

export async function listerEmails(): Promise<EmailJournal[]> {
  return verifier(
    await supabase
      .from('emails')
      .select('id, type, destinataire, nom_destinataire, donnees, cree_le, envoye_le, tentatives, derniere_erreur')
      .order('cree_le', { ascending: false })
      .limit(200),
  );
}
