import { useState } from 'react';
import { Link } from 'react-router';
import { listerInterventionsAdmin, listerOrganisations, listerSitesAdmin } from '../../lib/admin';
import { useChargement } from '../../lib/useChargement';
import { formaterPeriode } from '../../lib/formats';
import { LIBELLE_INTERVENTION, LIBELLE_STATUT } from '../../lib/libelles';
import { BadgeStatut, Etat } from '../../composants/Communs';
import type { StatutIntervention } from '../../lib/types';

async function charger() {
  const [interventions, sites, organisations] = await Promise.all([
    listerInterventionsAdmin(),
    listerSitesAdmin(),
    listerOrganisations(),
  ]);
  return { interventions, sites: new Map(sites.map((s) => [s.id, s])), organisations };
}

type Filtre = '' | StatutIntervention | 'a_publier';

export function AdminInterventions() {
  const etat = useChargement(charger, []);
  const [statut, setStatut] = useState<Filtre>('');
  const [client, setClient] = useState('');

  return (
    <>
      <div className="titre-page">
        <h1>Interventions</h1>
        <Link to="/admin/interventions/nouvelle" className="bouton">
          Planifier une intervention
        </Link>
      </div>
      <Etat etat={etat}>
        {({ interventions, sites, organisations }) => {
          const nomClient = new Map(organisations.map((o) => [o.id, o.nom]));
          const filtrees = interventions.filter((i) => {
            const site = sites.get(i.site_id);
            if (client && site?.organisation_id !== client) return false;
            if (statut === 'a_publier') return i.statut === 'realisee' && !i.publiee;
            return !statut || i.statut === statut;
          });
          return (
            <>
              <div className="filtres">
                <div>
                  <label htmlFor="filtre-statut">Statut</label>
                  <select id="filtre-statut" value={statut} onChange={(e) => setStatut(e.target.value as Filtre)}>
                    <option value="">Tous les statuts</option>
                    <option value="a_publier">Réalisées, à publier</option>
                    {Object.entries(LIBELLE_STATUT).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>
              <div className="tableau-conteneur">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Site</th>
                      <th>Prestation</th>
                      <th>Statut</th>
                      <th>Client</th>
                      <th>Publication</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="vide">
                          Aucune intervention.
                        </td>
                      </tr>
                    )}
                    {filtrees.map((i) => {
                      const site = sites.get(i.site_id);
                      return (
                        <tr key={i.id}>
                          <td className="nowrap">
                            <Link to={`/admin/interventions/${i.id}`}>
                              {formaterPeriode(i.debut_reel ?? i.debut_prevu, i.fin_reelle ?? i.fin_prevue)}
                            </Link>
                          </td>
                          <td>{site?.nom}</td>
                          <td>{LIBELLE_INTERVENTION[i.type]}</td>
                          <td>
                            <BadgeStatut statut={i.statut} />
                          </td>
                          <td>{site && nomClient.get(site.organisation_id)}</td>
                          <td className="nowrap">
                            {i.publiee ? (
                              <span className="badge badge-publiee">Publiée</span>
                            ) : i.statut === 'realisee' ? (
                              <span className="badge badge-a-publier">À publier</span>
                            ) : (
                              <span className="secondaire">–</span>
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
