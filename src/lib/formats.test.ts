import { describe, expect, it } from 'vitest';
import {
  aujourdhuiParis,
  formaterDate,
  formaterHa,
  formaterHorodatage,
  formaterM2,
  formaterPeriode,
  formaterTaille,
  pluriel,
} from './formats';

// Intl utilise des espaces insécables : on les remplace par des espaces simples pour comparer.
const simple = (texte: string) => texte.replace(/[  ]/g, ' ');

describe('formats du cahier des charges (§7.5)', () => {
  it('affiche les dates au format JJ/MM/AAAA', () => {
    expect(formaterDate('2026-11-13')).toBe('13/11/2026');
    expect(formaterDate(null)).toBe('');
  });

  it('affiche les surfaces au format « 52 763 m² » et « 12,5 ha »', () => {
    expect(simple(formaterM2(52763))).toBe('52 763 m²');
    expect(simple(formaterM2('52763.00'))).toBe('52 763 m²');
    expect(simple(formaterHa(12.5))).toBe('12,5 ha');
    expect(simple(formaterHa('8.20'))).toBe('8,2 ha');
    expect(formaterM2(null)).toBe('');
  });

  it('distingue une date précise et une période', () => {
    expect(formaterPeriode('2026-11-25', '2026-11-25')).toBe('le 25/11/2026');
    expect(formaterPeriode('2026-12-13', '2026-12-17')).toBe('du 13/12/2026 au 17/12/2026');
    expect(formaterPeriode('2026-12-13', null)).toBe('le 13/12/2026');
    expect(formaterPeriode(null, null)).toBe('Date à définir');
  });

  it('calcule la date du jour à l’heure de Paris', () => {
    // 23 h 30 en heure universelle le 31/12 = déjà le 1er janvier à Paris.
    expect(aujourdhuiParis(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    // En été (UTC+2) : 22 h 30 UTC le 14/07 = 0 h 30 le 15/07 à Paris.
    expect(aujourdhuiParis(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });

  it('affiche un horodatage à la date de Paris', () => {
    expect(formaterHorodatage('2026-12-31T23:30:00Z')).toBe('01/01/2027');
  });

  it('affiche tailles et pluriels', () => {
    expect(simple(formaterTaille(2_200_000))).toBe('2,1 Mo');
    expect(simple(formaterTaille(850 * 1024))).toBe('850 Ko');
    expect(pluriel(1, 'intervention')).toBe('1 intervention');
    expect(pluriel(3, 'intervention')).toBe('3 interventions');
  });
});
