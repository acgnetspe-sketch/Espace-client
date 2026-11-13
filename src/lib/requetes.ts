// Toutes les lectures de données. Chaque requête passe par la sécurité de la
// base : un client ne reçoit jamais que ce qu'il a le droit de voir.

import { supabase } from './supabase';
import { aujourdhuiParis } from './formats';
import type {
  Alerte,
  ChiffresAnnee,
  Fichier,
  Intervention,
  Organisation,
  ProchainPassage,
  Profil,
  Site,
} from './types';

const COLONNES_SITE =
  'id, organisation_id, nom, code_interne, commune, departement, type_installation, surface_modules_m2, surface_vegetation_ha, soumis_old, date_limite_old, latitude, longitude';
const COLONNES_FICHIER = 'id, intervention_id, site_id, type, chemin, nom, taille_octets, ajoute_le';

/** Erreur lisible pour l'écran (le détail technique reste dans la console). */
export class ErreurChargement extends Error {}

function verifier<T>(resultat: { data: T | null; error: { message: string } | null }): T {
  if (resultat.error) {
    console.error(resultat.error);
    throw new ErreurChargement('Les données n’ont pas pu être chargées. Vérifiez votre connexion internet puis réessayez.');
  }
  return resultat.data as T;
}

/** Filtre « pas encore terminé » : fin prévue (ou début si pas de fin) aujourd'hui ou plus tard. */
function filtreAVenir(): string {
  const jour = aujourdhuiParis();
  return `fin_prevue.gte.${jour},and(fin_prevue.is.null,debut_prevu.gte.${jour})`;
}

export async function chargerSites(): Promise<Site[]> {
  return verifier(await supabase.from('sites').select(COLONNES_SITE).order('nom'));
}

export async function chargerSite(id: string): Promise<Site | null> {
  return verifier(await supabase.from('sites').select(COLONNES_SITE).eq('id', id).maybeSingle());
}

export async function chargerProchainsPassagesParSite(): Promise<ProchainPassage[]> {
  return verifier(await supabase.from('sites_prochain_passage').select('*'));
}

/** Passages à venir (proposés ou confirmés), du plus proche au plus lointain. */
export async function chargerPassagesAVenir(limite?: number): Promise<Intervention[]> {
  let requete = supabase
    .from('interventions_visibles')
    .select('*')
    .in('statut', ['proposee', 'confirmee'])
    .or(filtreAVenir())
    .order('debut_prevu', { ascending: true });
  if (limite) requete = requete.limit(limite);
  return verifier(await requete);
}

/** Interventions réalisées et publiées, de la plus récente à la plus ancienne. */
export async function chargerInterventionsPubliees(limite?: number): Promise<Intervention[]> {
  let requete = supabase
    .from('interventions_visibles')
    .select('*')
    .eq('publiee', true)
    .order('fin_reelle', { ascending: false, nullsFirst: false });
  if (limite) requete = requete.limit(limite);
  return verifier(await requete);
}

export async function chargerInterventionsDuSite(siteId: string): Promise<Intervention[]> {
  return verifier(await supabase.from('interventions_visibles').select('*').eq('site_id', siteId));
}

export async function chargerIntervention(id: string): Promise<Intervention | null> {
  return verifier(await supabase.from('interventions_visibles').select('*').eq('id', id).maybeSingle());
}

/** Fichiers de plusieurs interventions (rapports, photos). */
export async function chargerFichiersDesInterventions(ids: string[]): Promise<Fichier[]> {
  if (ids.length === 0) return [];
  return verifier(
    await supabase.from('fichiers').select(COLONNES_FICHIER).in('intervention_id', ids).order('ajoute_le'),
  );
}

/** Documents rattachés directement au site (plans, attestations…). */
export async function chargerDocumentsDuSite(siteId: string): Promise<Fichier[]> {
  return verifier(
    await supabase.from('fichiers').select(COLONNES_FICHIER).eq('site_id', siteId).order('ajoute_le', { ascending: false }),
  );
}

export async function chargerAlertes(): Promise<Alerte[]> {
  return verifier(await supabase.from('alertes').select('*'));
}

export async function chargerChiffresAnnee(): Promise<ChiffresAnnee[]> {
  return verifier(await supabase.from('chiffres_annee').select('*'));
}

export async function chargerOrganisation(id: string): Promise<Organisation | null> {
  return verifier(await supabase.from('organisations').select('id, nom, adresse').eq('id', id).maybeSingle());
}

export async function chargerMembresOrganisation(organisationId: string): Promise<Profil[]> {
  return verifier(
    await supabase
      .from('profils')
      .select('id, organisation_id, nom, fonction, telephone, email, role')
      .eq('organisation_id', organisationId)
      .order('nom'),
  );
}

/** Sites auxquels un contact est limité (liste vide = accès à tous les sites de son organisation). */
export async function chargerMesLimitations(profilId: string): Promise<string[]> {
  const lignes = verifier(await supabase.from('acces_sites').select('site_id').eq('profil_id', profilId));
  return (lignes as { site_id: string }[]).map((l) => l.site_id);
}
