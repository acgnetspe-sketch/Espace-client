import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { importerSites, listerOrganisations } from '../../lib/admin';
import { analyserCsvSites, MODELE_CSV, type ResultatImport } from '../../lib/csv';
import { useChargement } from '../../lib/useChargement';
import { formaterDate, formaterHa, formaterM2 } from '../../lib/formats';
import { LIBELLE_INSTALLATION } from '../../lib/libelles';
import { Etat } from '../../composants/Communs';
import { AfficherMessage, Champ, useAction } from '../../composants/Formulaire';

function telechargerModele() {
  // BOM UTF-8 : Excel affiche correctement les accents.
  const blob = new Blob(['﻿' + MODELE_CSV], { type: 'text/csv;charset=utf-8' });
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = 'modele-import-sites.csv';
  lien.click();
  URL.revokeObjectURL(lien.href);
}

export function AdminImportSites() {
  const etat = useChargement(listerOrganisations, []);
  const [parametres] = useSearchParams();
  const navigation = useNavigate();
  const action = useAction();
  const [organisation, setOrganisation] = useState(parametres.get('organisation') ?? '');
  const [analyse, setAnalyse] = useState<ResultatImport | null>(null);

  async function lireFichier(fichier: File | undefined) {
    setAnalyse(null);
    action.setMessage(null);
    if (!fichier) return;
    const texte = await fichier.text();
    setAnalyse(analyserCsvSites(texte));
  }

  const valides = analyse?.lignes.filter((l) => l.site) ?? [];
  const enErreur = analyse?.lignes.filter((l) => !l.site) ?? [];

  async function importer() {
    const { ok } = await action.executer(() => importerSites(organisation, valides.map((l) => l.site!)));
    if (ok) navigation(`/admin/clients/${organisation}`);
  }

  return (
    <>
      <div className="fil-ariane">
        <Link to="/admin/sites">Sites</Link> › Import CSV
      </div>
      <div className="titre-page">
        <h1>Importer une liste de sites</h1>
      </div>
      <Etat etat={etat}>
        {(organisations) => (
          <div className="pile">
            <section className="carte">
              <h2>1. Préparer le fichier</h2>
              <p>
                Partir du modèle, le remplir dans Excel ou Numbers (une ligne par site), puis l’enregistrer au format{' '}
                <strong>CSV</strong>. Seules les colonnes <code>nom</code> et <code>type_installation</code> sont
                obligatoires.
              </p>
              <button type="button" className="bouton bouton-secondaire" onClick={telechargerModele}>
                Télécharger le modèle CSV
              </button>
            </section>

            <section className="carte">
              <h2>2. Choisir le client et le fichier</h2>
              <div className="formulaire">
                <Champ id="import-client" libelle="Client" obligatoire>
                  <select id="import-client" value={organisation} onChange={(e) => setOrganisation(e.target.value)}>
                    <option value="">Choisir…</option>
                    {organisations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nom}
                      </option>
                    ))}
                  </select>
                </Champ>
                <Champ id="import-fichier" libelle="Fichier CSV">
                  <input
                    id="import-fichier"
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={(e) => lireFichier(e.target.files?.[0])}
                  />
                </Champ>
              </div>
            </section>

            {analyse && (
              <section className="carte">
                <h2>3. Vérifier et importer</h2>
                {analyse.erreurGenerale ? (
                  <div className="alerte alerte-danger" role="alert">
                    <p>{analyse.erreurGenerale}</p>
                  </div>
                ) : (
                  <>
                    <p>
                      <strong>{valides.length}</strong> site(s) prêt(s) à importer
                      {enErreur.length > 0 && (
                        <>
                          , <strong style={{ color: 'var(--rouge)' }}>{enErreur.length} ligne(s) en erreur</strong> : corrigez le
                          fichier puis choisissez-le à nouveau
                        </>
                      )}
                      .
                    </p>
                    <div className="tableau-conteneur">
                      <table className="tableau">
                        <thead>
                          <tr>
                            <th>Ligne</th>
                            <th>Nom</th>
                            <th>Type</th>
                            <th>Commune</th>
                            <th>Surfaces</th>
                            <th>OLD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyse.lignes.map((l) =>
                            l.site ? (
                              <tr key={l.numero}>
                                <td className="nombre">{l.numero}</td>
                                <td>{l.site.nom}</td>
                                <td>{LIBELLE_INSTALLATION[l.site.type_installation]}</td>
                                <td>
                                  {l.site.commune} {l.site.departement && `(${l.site.departement})`}
                                </td>
                                <td className="nowrap nombre">
                                  {[formaterM2(l.site.surface_modules_m2), formaterHa(l.site.surface_vegetation_ha)]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </td>
                                <td className="nowrap">{l.site.soumis_old ? `Oui ${formaterDate(l.site.date_limite_old)}` : 'Non'}</td>
                              </tr>
                            ) : (
                              <tr key={l.numero} className="erreur-ligne">
                                <td className="nombre">{l.numero}</td>
                                <td colSpan={5}>{l.erreurs.join(' ; ')}</td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="bouton"
                        disabled={action.enCours || !organisation || valides.length === 0 || enErreur.length > 0}
                        onClick={importer}
                      >
                        Importer {valides.length} site(s)
                      </button>
                      {!organisation && <span className="secondaire">Choisissez d’abord le client.</span>}
                    </div>
                    <AfficherMessage message={action.message} />
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </Etat>
    </>
  );
}
