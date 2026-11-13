// Types des données lues dans Supabase (noms identiques aux colonnes SQL).

export type RoleUtilisateur = 'admin' | 'client';
export type TypeInstallation = 'sol' | 'trackers' | 'toiture' | 'ombriere';
export type TypeIntervention = 'nettoyage' | 'debroussaillage_interieur' | 'old' | 'elagage' | 'autre';
export type StatutIntervention = 'proposee' | 'confirmee' | 'realisee' | 'annulee';
export type TypeFichier = 'rapport' | 'photo_avant' | 'photo_apres' | 'document';
export type TypeDemande = 'nouvelle_intervention' | 'devis' | 'probleme' | 'changement_date';
export type StatutDemande = 'envoyee' | 'prise_en_compte' | 'traitee';

/** Date sans heure, au format AAAA-MM-JJ (ex. « 2026-11-13 »). */
export type DateISO = string;

export interface Profil {
  id: string;
  organisation_id: string | null;
  nom: string;
  fonction: string | null;
  telephone: string | null;
  email: string;
  role: RoleUtilisateur;
  recoit_emails: boolean;
}

export interface Organisation {
  id: string;
  nom: string;
  adresse: string | null;
}

export interface Site {
  id: string;
  organisation_id: string;
  nom: string;
  code_interne: string | null;
  commune: string | null;
  departement: string | null;
  type_installation: TypeInstallation;
  surface_modules_m2: number | null;
  surface_vegetation_ha: number | null;
  soumis_old: boolean;
  date_limite_old: DateISO | null;
  latitude: number | null;
  longitude: number | null;
}

/** Ligne de la vue « interventions_visibles » : compte rendu vide tant que non publiée. */
export interface Intervention {
  id: string;
  site_id: string;
  type: TypeIntervention;
  statut: StatutIntervention;
  debut_prevu: DateISO | null;
  fin_prevue: DateISO | null;
  debut_reel: DateISO | null;
  fin_reelle: DateISO | null;
  surface_m2: number | null;
  surface_ha: number | null;
  encrassement: number | null;
  panneaux_casses: number | null;
  anomalies: string | null;
  anomalie_traitee: boolean | null;
  bon_commande: string | null;
  publiee: boolean;
  publiee_le: string | null;
}

export interface Fichier {
  id: string;
  intervention_id: string | null;
  site_id: string | null;
  type: TypeFichier;
  chemin: string;
  nom: string;
  taille_octets: number | null;
  ajoute_le: string;
}

export interface ProchainPassage {
  site_id: string;
  organisation_id: string;
  intervention_id: string | null;
  type: TypeIntervention | null;
  statut: StatutIntervention | null;
  debut_prevu: DateISO | null;
  fin_prevue: DateISO | null;
}

export interface Alerte {
  type_alerte: 'anomalie' | 'old';
  organisation_id: string;
  site_id: string;
  site_nom: string;
  intervention_id: string | null;
  date_reference: DateISO | null;
  jours_restants: number | null;
  panneaux_casses: number | null;
  anomalies: string | null;
}

export interface ChiffresAnnee {
  organisation_id: string;
  annee: number;
  surface_nettoyee_m2: number;
  surface_debroussaillee_ha: number;
  nombre_interventions: number;
}

export interface Demande {
  id: string;
  organisation_id: string;
  site_id: string | null;
  intervention_id: string | null;
  auteur_id: string | null;
  type: TypeDemande;
  message: string;
  date_souhaitee: DateISO | null;
  statut: StatutDemande;
  reponse: string | null;
  creee_le: string;
  modifie_le: string;
}
