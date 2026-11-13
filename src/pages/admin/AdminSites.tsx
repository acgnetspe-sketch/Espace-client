import { useState } from 'react';
import { Link } from 'react-router';
import { listerOrganisations, listerSitesAdmin } from '../../lib/admin';
import { chargerProchainsPassagesParSite } from '../../lib/requetes';
import { useChargement } from '../../lib/useChargement';
import { formaterDate, formaterM2, formaterPeriode } from '../../lib/formats';
import { LIBELLE_INSTALLATION } from '../../lib/libelles';
import { BadgeStatut, Etat } from '../../composants/Communs';

async function chargerSites() {
  const [sites, organisations, passages] = await Promise.all([
    listerSitesAdmin(),
    listerOrganisations(),
    chargerProchainsPassagesParSite(),
  ]);
  return { sites, organisations, passages: new Map(passages.map((p) => [p.site_id, p])) };
}

export function AdminSites() {
  const etat = useChargement(chargerSites, []);
  const [client, setClient] = useState('');
  const [recherche, setRecherche] = useState('');

  return (
    <>
      <div className="titre-page">
        <h1>Sites</h1>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link to="/admin/sites/import" className="bouton bouton-secondaire">
            Importer un CSV
          </Link>
          <Link to="/admin/sites/nouveau" className="bouton">
            Nouveau site
          </Link>
        </div>
      </div>
      <Etat etat={etat}>
        {({ sites, organisations, passages }) => {
          const nomClient = new Map(organisations.map((o) => [o.id, o.nom]));
          const texte = recherche.trim().toLowerCase();
          const filtres = sites.filter(
            (s) =>
              (!client || s.organisation_id === client) &&
              (!texte || [s.nom, s.commune, s.code_interne].some((v) => v?.toLowerCase().includes(texte))),
          );
          return (
            <>
              <div className="filtres">
                <div>
                  <label htmlFor="filtre-client">Client</label>
                  <select id="filtre-client" value={client} onChange={(e) => setClient(e.target.value)}>
                    <option value="">Tous les clients</option>
                    {organisations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="filtre-texte">Rechercher</label>
                  <input
                    id="filtre-texte"
                    type="search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Nom, commune, code"
                  />
                </div>
              </div>
              <div className="tableau-conteneur">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Client</th>
                      <th>Type</th>
                      <th>Modules</th>
                      <th>OLD</th>
                      <th>Prochain passage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.length === 0 && (
                      <tr>
                        <td colSpan={6} className="vide">
                          Aucun site.
                        </td>
                      </tr>
                    )}
                    {filtres.map((s) => {
                      const p = passages.get(s.id);
                      return (
                        <tr key={s.id}>
                          <td>
                            <Link to={`/admin/sites/${s.id}`}>
                              <strong>{s.nom}</strong>
                            </Link>
                            <div className="secondaire">
                              {[s.code_interne, s.commune, s.departement && `(${s.departement})`].filter(Boolean).join(' ')}
                            </div>
                          </td>
                          <td>{nomClient.get(s.organisation_id)}</td>
                          <td className="nowrap">{LIBELLE_INSTALLATION[s.type_installation]}</td>
                          <td className="nowrap nombre">{formaterM2(s.surface_modules_m2)}</td>
                          <td className="nowrap">{s.soumis_old ? `Oui, ${formaterDate(s.date_limite_old)}` : 'Non'}</td>
                          <td>
                            {p?.intervention_id && p.statut ? (
                              <>
                                {formaterPeriode(p.debut_prevu, p.fin_prevue)} <BadgeStatut statut={p.statut} />
                              </>
                            ) : (
                              <span className="badge badge-neutre">À planifier</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </Etat>
    </>
  );
}
