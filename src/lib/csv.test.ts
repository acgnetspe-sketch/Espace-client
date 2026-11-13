import { describe, expect, it } from 'vitest';
import { analyserCsvSites, decouperCsv, MODELE_CSV } from './csv';

describe('import CSV des sites', () => {
  it('lit le modèle fourni sans erreur', () => {
    const r = analyserCsvSites(MODELE_CSV);
    expect(r.erreurGenerale).toBeNull();
    expect(r.lignes).toHaveLength(2);
    expect(r.lignes.every((l) => l.erreurs.length === 0)).toBe(true);
    expect(r.lignes[0]!.site).toMatchObject({
      nom: 'Centrale Exemple',
      departement: '13',
      type_installation: 'sol',
      surface_modules_m2: 52763,
      surface_vegetation_ha: 12.5,
      soumis_old: true,
      date_limite_old: '2027-06-30',
      latitude: 43.68,
    });
  });

  it('accepte un export Excel français (BOM, point-virgule, accents, espaces dans les nombres)', () => {
    const texte = '﻿Nom;Type installation;Département;Surface modules m2;Soumis OLD\r\n"Centrale ""Le Pin""";Ombrière;6;52 763,5;Oui\r\n';
    const r = analyserCsvSites(texte);
    expect(r.erreurGenerale).toBeNull();
    expect(r.lignes[0]!.site).toMatchObject({
      nom: 'Centrale "Le Pin"',
      type_installation: 'ombriere',
      departement: '06',
      surface_modules_m2: 52763.5,
      soumis_old: true,
    });
  });

  it('signale les erreurs ligne par ligne', () => {
    const texte = 'nom,type_installation,departement,date_limite_old,surface_modules_m2\n,piscine,99,31/02/2027,abc\n';
    const [ligne] = analyserCsvSites(texte).lignes;
    expect(ligne!.numero).toBe(2);
    expect(ligne!.site).toBeNull();
    expect(ligne!.erreurs.join(' | ')).toMatch(/nom manquant/);
    expect(ligne!.erreurs.join(' | ')).toMatch(/piscine/);
    expect(ligne!.erreurs.join(' | ')).toMatch(/département « 99 »/);
    expect(ligne!.erreurs.join(' | ')).toMatch(/31\/02\/2027/);
    expect(ligne!.erreurs.join(' | ')).toMatch(/abc/);
  });

  it('refuse un fichier sans les colonnes obligatoires', () => {
    expect(analyserCsvSites('commune;departement\nArles;13\n').erreurGenerale).toMatch(/nom, type_installation/);
    expect(analyserCsvSites('').erreurGenerale).toMatch(/vide/);
  });

  it('découpe les cellules entre guillemets contenant le séparateur et des retours à la ligne', () => {
    expect(decouperCsv('a;b\n"x;y";"ligne 1\nligne 2"\n')).toEqual([
      ['a', 'b'],
      ['x;y', 'ligne 1\nligne 2'],
    ]);
  });
});
