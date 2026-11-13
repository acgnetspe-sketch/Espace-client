// Import d'une liste de sites au format CSV (export Excel ou LibreOffice).
// Séparateur détecté automatiquement (point-virgule, virgule ou tabulation),
// nombres à la française (« 52 763,5 »), dates JJ/MM/AAAA ou AAAA-MM-JJ.

import type { TypeInstallation } from './types';

export const COLONNES_CSV = [
  'nom',
  'code_interne',
  'commune',
  'departement',
  'type_installation',
  'surface_modules_m2',
  'surface_vegetation_ha',
  'soumis_old',
  'date_limite_old',
  'latitude',
  'longitude',
] as const;

export const MODELE_CSV =
  COLONNES_CSV.join(';') +
  '\n' +
  'Centrale Exemple;EX-001;Arles;13;sol;52763;12,5;oui;30/06/2027;43,68;4,63\n' +
  'Toiture Exemple;EX-002;Nîmes;30;toiture;9850;;non;;;\n';

export interface SiteImporte {
  nom: string;
  code_interne: string | null;
  commune: string | null;
  departement: string | null;
  type_installation: TypeInstallation;
  surface_modules_m2: number | null;
  surface_vegetation_ha: number | null;
  soumis_old: boolean;
  date_limite_old: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LigneImport {
  numero: number; // numéro de ligne dans le fichier (1 = en-tête)
  site: SiteImporte | null;
  erreurs: string[];
}

export interface ResultatImport {
  lignes: LigneImport[];
  erreurGenerale: string | null;
}

/** Découpe un texte CSV en lignes de cellules (gère les guillemets). */
export function decouperCsv(texte: string): string[][] {
  const contenu = texte.replace(/^﻿/, '');
  const premiere = contenu.split(/\r?\n/)[0] ?? '';
  const separateur = [';', '\t', ','].reduce((meilleur, s) =>
    premiere.split(s).length > premiere.split(meilleur).length ? s : meilleur,
  );
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = '';
  let entreGuillemets = false;
  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i];
    if (entreGuillemets) {
      if (c === '"' && contenu[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') {
        entreGuillemets = false;
      } else {
        cellule += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === separateur) {
      ligne.push(cellule);
      cellule = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && contenu[i + 1] === '\n') i++;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = '';
    } else {
      cellule += c;
    }
  }
  if (cellule !== '' || ligne.length > 0) {
    ligne.push(cellule);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((v) => v.trim() !== ''));
}

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cle = (t: string) => sansAccents(t).trim().toLowerCase().replace(/[\s-]+/g, '_');

const TYPES: Record<string, TypeInstallation> = {
  sol: 'sol',
  au_sol: 'sol',
  trackers: 'trackers',
  tracker: 'trackers',
  toiture: 'toiture',
  ombriere: 'ombriere',
  ombrieres: 'ombriere',
};

function nombre(valeur: string, libelle: string, erreurs: string[]): number | null {
  const t = valeur.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) {
    erreurs.push(`${libelle} : « ${valeur} » n’est pas un nombre`);
    return null;
  }
  return n;
}

function date(valeur: string, erreurs: string[]): string | null {
  const t = valeur.trim();
  if (t === '') return null;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  let iso: string | null = null;
  if (m) iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) iso = t;
  const verif = iso ? new Date(`${iso}T00:00:00Z`) : null;
  if (!iso || !verif || Number.isNaN(verif.getTime()) || verif.toISOString().slice(0, 10) !== iso) {
    erreurs.push(`date limite OLD : « ${valeur} » n’est pas une date valide (JJ/MM/AAAA)`);
    return null;
  }
  return iso;
}

/** Analyse le fichier et valide chaque ligne. Rien n'est enregistré ici. */
export function analyserCsvSites(texte: string): ResultatImport {
  const lignes = decouperCsv(texte);
  if (lignes.length < 2) return { lignes: [], erreurGenerale: 'Le fichier est vide ou ne contient que la ligne d’en-tête.' };

  const entete = lignes[0]!.map(cle);
  const index = Object.fromEntries(COLONNES_CSV.map((c) => [c, entete.indexOf(c)])) as Record<
    (typeof COLONNES_CSV)[number],
    number
  >;
  const manquantes = (['nom', 'type_installation'] as const).filter((c) => index[c] < 0);
  if (manquantes.length > 0) {
    return {
      lignes: [],
      erreurGenerale: `Colonne(s) obligatoire(s) absente(s) de la première ligne : ${manquantes.join(', ')}. Utilisez le modèle.`,
    };
  }

  const resultat: LigneImport[] = lignes.slice(1).map((cellules, i) => {
    const valeur = (c: (typeof COLONNES_CSV)[number]) => (index[c] >= 0 ? (cellules[index[c]] ?? '').trim() : '');
    const erreurs: string[] = [];

    const nom = valeur('nom');
    if (!nom) erreurs.push('nom manquant');

    const typeBrut = valeur('type_installation');
    const type = TYPES[cle(typeBrut)];
    if (!type) erreurs.push(`type d’installation « ${typeBrut} » inconnu (sol, trackers, toiture ou ombrière)`);

    let departement: string | null = valeur('departement').toUpperCase() || null;
    if (departement && /^\d$/.test(departement)) departement = `0${departement}`;
    if (departement && !/^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/.test(departement)) {
      erreurs.push(`département « ${departement} » invalide`);
    }

    const oldBrut = cle(valeur('soumis_old'));
    let soumisOld = false;
    if (['oui', 'o', 'true', 'vrai', '1', 'x'].includes(oldBrut)) soumisOld = true;
    else if (!['', 'non', 'n', 'false', 'faux', '0'].includes(oldBrut)) {
      erreurs.push(`soumis_old « ${valeur('soumis_old')} » : indiquez oui ou non`);
    }

    const site: SiteImporte = {
      nom,
      code_interne: valeur('code_interne') || null,
      commune: valeur('commune') || null,
      departement,
      type_installation: type ?? 'sol',
      surface_modules_m2: nombre(valeur('surface_modules_m2'), 'surface modules', erreurs),
      surface_vegetation_ha: nombre(valeur('surface_vegetation_ha'), 'surface végétation', erreurs),
      soumis_old: soumisOld,
      date_limite_old: date(valeur('date_limite_old'), erreurs),
      latitude: nombre(valeur('latitude'), 'latitude', erreurs),
      longitude: nombre(valeur('longitude'), 'longitude', erreurs),
    };
    if (site.latitude !== null && (site.latitude < -90 || site.latitude > 90)) erreurs.push('latitude hors limites');
    if (site.longitude !== null && (site.longitude < -180 || site.longitude > 180)) erreurs.push('longitude hors limites');
    if ((site.surface_modules_m2 ?? 0) < 0 || (site.surface_vegetation_ha ?? 0) < 0) erreurs.push('surface négative');

    return { numero: i + 2, site: erreurs.length === 0 ? site : null, erreurs };
  });

  return { lignes: resultat, erreurGenerale: null };
}
