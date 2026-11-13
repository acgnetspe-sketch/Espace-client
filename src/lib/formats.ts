// Formats d'affichage du cahier des charges (§7.5) :
// dates JJ/MM/AAAA à l'heure de Paris, surfaces « 52 763 m² » et « 12,5 ha ».

import type { DateISO } from './types';

const FUSEAU = 'Europe/Paris';

/** « 2026-11-13 » → « 13/11/2026 ». Les dates sans heure ne subissent aucun décalage horaire. */
export function formaterDate(date: DateISO | null | undefined): string {
  if (!date) return '';
  const [annee, mois, jour] = date.slice(0, 10).split('-');
  if (!annee || !mois || !jour) return '';
  return `${jour}/${mois}/${annee}`;
}

/** Horodatage (ex. date de publication) → « 13/11/2026 » à l'heure de Paris. */
export function formaterHorodatage(horodatage: string | null | undefined): string {
  if (!horodatage) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: FUSEAU,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(horodatage));
}

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function aujourdhuiParis(maintenant: Date = new Date()): DateISO {
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(maintenant);
  const valeur = (type: string) => parties.find((p) => p.type === type)?.value ?? '';
  return `${valeur('year')}-${valeur('month')}-${valeur('day')}`;
}

/** Date précise ou période : « le 25/11/2026 » ou « du 13/12/2026 au 17/12/2026 ». */
export function formaterPeriode(debut: DateISO | null, fin: DateISO | null): string {
  if (!debut && !fin) return 'Date à définir';
  if (!debut || !fin || debut === fin) return `le ${formaterDate(debut ?? fin)}`;
  return `du ${formaterDate(debut)} au ${formaterDate(fin)}`;
}

// Espace insécable fine pour les milliers, comme en typographie française.
const nombreEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nombreDecimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** 52763 → « 52 763 m² » */
export function formaterM2(valeur: number | string | null | undefined): string {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  return `${nombreEntier.format(Number(valeur))} m²`;
}

/** 12.5 → « 12,5 ha » */
export function formaterHa(valeur: number | string | null | undefined): string {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  return `${nombreDecimal.format(Number(valeur))} ha`;
}

/** Taille d'un fichier : « 2,1 Mo », « 850 Ko ». */
export function formaterTaille(octets: number | null | undefined): string {
  if (!octets) return '';
  if (octets < 1024 * 1024) return `${nombreEntier.format(Math.max(1, Math.round(octets / 1024)))} Ko`;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(octets / (1024 * 1024))} Mo`;
}

/** Pluriel simple : (3, 'intervention') → « 3 interventions ». */
export function pluriel(nombre: number, mot: string, motPluriel = `${mot}s`): string {
  return `${nombreEntier.format(nombre)} ${nombre > 1 ? motPluriel : mot}`;
}
