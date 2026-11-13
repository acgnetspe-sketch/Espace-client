// Libellés affichés à l'écran (avec accents) pour les valeurs stockées sans accents.

import type { StatutDemande, StatutIntervention, TypeDemande, TypeFichier, TypeInstallation, TypeIntervention } from './types';

export const LIBELLE_INSTALLATION: Record<TypeInstallation, string> = {
  sol: 'Au sol',
  trackers: 'Trackers',
  toiture: 'Toiture',
  ombriere: 'Ombrière',
};

export const LIBELLE_INTERVENTION: Record<TypeIntervention, string> = {
  nettoyage: 'Nettoyage des modules',
  debroussaillage_interieur: 'Débroussaillage intérieur',
  old: 'Débroussaillement OLD',
  elagage: 'Élagage',
  autre: 'Autre prestation',
};

export const LIBELLE_STATUT: Record<StatutIntervention, string> = {
  proposee: 'Proposé',
  confirmee: 'Confirmé',
  realisee: 'Réalisé',
  annulee: 'Annulé',
};

export const LIBELLE_FICHIER: Record<TypeFichier, string> = {
  rapport: 'Rapport',
  photo_avant: 'Photo avant',
  photo_apres: 'Photo après',
  document: 'Document',
};

export const LIBELLE_DEMANDE: Record<TypeDemande, string> = {
  nouvelle_intervention: 'Demande d’intervention',
  devis: 'Demande de devis',
  probleme: 'Signaler un problème',
  changement_date: 'Changement de date',
};

export const LIBELLE_STATUT_DEMANDE: Record<StatutDemande, string> = {
  envoyee: 'Envoyée',
  prise_en_compte: 'Prise en compte',
  traitee: 'Traitée',
};
