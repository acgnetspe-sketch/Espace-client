import { Link } from 'react-router';
import { chargerInterventionsPubliees, chargerPassagesAVenir, chargerSites } from '../lib/requetes';
import { useChargement } from '../lib/useChargement';
import { BadgeStatut, Etat, dateIntervention, libelleIntervention } from '../composants/Communs';
import type { Intervention, Site } from '../lib/types';

async function chargerPlanning() {
  const [aVenir, realisees, sites] = await Promise.all([
    chargerPassagesAVenir(),
    chargerInterventionsPubliees(5),
    chargerSites(),
  ]);
  // Regroupement par site, dans l'ordre du prochain passage.
  const parSite = new Map<string, Intervention[]>();
  for (const i of aVenir) parSite.set(i.site_id, [...(parSite.get(i.site_id) ?? []), i]);
  const sitesAPlanifier = sites.filter((s) => !parSite.has(s.id));
  return { parSite, realisees, sitesParId: new Map(sites.map((s) => [s.id, s])), sitesAPlanifier };
}

export function Planning() {
  const etat = useChargement(chargerPlanning, []);
  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Planning</h1>
          <p>Les passages à venir sur vos sites.</p>
        </div>
      </div>
      <Etat etat={etat}>
        {({ parSite, realisees, sitesParId, sitesAPlanifier }) => (
          <div className="pile">
            {parSite.size === 0 ? (
              <div className="carte">
                <p className="vide">Aucun passage planifié pour le moment.</p>
              </div>
            ) : (
              <div className="grille grille-2" style={{ alignItems: 'start' }}>
                {[...parSite.entries()].map(([siteId, passages]) => (
                  <BlocSite key={siteId} site={sitesParId.get(siteId)} siteId={siteId} passages={passages} />
                ))}
              </div>
            )}

            {sitesAPlanifier.length > 0 && (
              <section className="carte" aria-labelledby="titre-a-planifier">
                <h2 id="titre-a-planifier">Sites sans passage prévu</h2>
                <ul className="liste">
                  {sitesAPlanifier.map((s) => (
                    <li key={s.id} className="ligne">
                      <Link to={`/sites/${s.id}`}>{s.nom}</Link>
                      <span className="badge badge-neutre">À planifier</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {realisees.length > 0 && (
              <section className="carte" aria-labelledby="titre-realises">
                <h2 id="titre-realises">Derniers passages réalisés</h2>
                <ul className="liste">
                  {realisees.map((i) => (
                    <li key={i.id} className="ligne">
                      <div>
                        <Link to={`/interventions/${i.id}`}>{libelleIntervention(i)}</Link>
                        <div className="secondaire">
                          {sitesParId.get(i.site_id)?.nom} · {dateIntervention(i)}
                        </div>
                      </div>
                      <BadgeStatut statut={i.statut} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="secondaire">
              Un passage « Proposé » attend votre accord ; « Confirmé » signifie que la date est arrêtée. Pour demander
              un changement de date, contactez votre interlocuteur ACG NET SPE.
            </p>
          </div>
        )}
      </Etat>
    </>
  );
}

function BlocSite({ site, siteId, passages }: { site?: Site; siteId: string; passages: Intervention[] }) {
  return (
    <section className="carte">
      <h2>
        <Link to={`/sites/${siteId}`}>{site?.nom ?? 'Site'}</Link>
      </h2>
      <ul className="liste">
        {passages.map((i) => (
          <li key={i.id} className="ligne">
            <div>
              <Link to={`/interventions/${i.id}`}>{libelleIntervention(i)}</Link>
              <div className="secondaire">{dateIntervention(i)}</div>
            </div>
            <BadgeStatut statut={i.statut} />
          </li>
        ))}
      </ul>
    </section>
  );
}
