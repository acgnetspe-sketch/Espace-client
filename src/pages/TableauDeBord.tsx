import { Link } from 'react-router';
import {
  chargerAlertes,
  chargerChiffresAnnee,
  chargerFichiersDesInterventions,
  chargerInterventionsPubliees,
  chargerPassagesAVenir,
  chargerSites,
} from '../lib/requetes';
import { useChargement } from '../lib/useChargement';
import { useConnexion } from '../lib/auth';
import { aujourdhuiParis, formaterDate, formaterHa, formaterM2, pluriel } from '../lib/formats';
import { BadgeStatut, BoutonFichier, Etat, dateIntervention, libelleIntervention } from '../composants/Communs';
import type { Alerte, Fichier, Intervention, Site } from '../lib/types';

async function chargerTableauDeBord() {
  const [passages, publiees, alertes, chiffres, sites] = await Promise.all([
    chargerPassagesAVenir(3),
    chargerInterventionsPubliees(20),
    chargerAlertes(),
    chargerChiffresAnnee(),
    chargerSites(),
  ]);
  const fichiers = await chargerFichiersDesInterventions(publiees.map((i) => i.id));
  // Les 3 derniers rapports publiés, dans l'ordre des interventions (plus récente d'abord).
  const rapports: { intervention: Intervention; fichier: Fichier }[] = [];
  for (const intervention of publiees) {
    const fichier = fichiers.find((f) => f.intervention_id === intervention.id && f.type === 'rapport');
    if (fichier) rapports.push({ intervention, fichier });
    if (rapports.length === 3) break;
  }
  const totaux = chiffres.reduce(
    (t, c) => ({
      m2: t.m2 + Number(c.surface_nettoyee_m2),
      ha: t.ha + Number(c.surface_debroussaillee_ha),
      nombre: t.nombre + c.nombre_interventions,
    }),
    { m2: 0, ha: 0, nombre: 0 },
  );
  const nomsSites = new Map(sites.map((s) => [s.id, s]));
  return { passages, rapports, alertes, totaux, nomsSites };
}

export function TableauDeBord() {
  const { profil } = useConnexion();
  const etat = useChargement(chargerTableauDeBord, []);
  const annee = aujourdhuiParis().slice(0, 4);

  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Tableau de bord</h1>
          <p>Bonjour {profil?.nom}.</p>
        </div>
      </div>

      <Etat etat={etat}>
        {({ passages, rapports, alertes, totaux, nomsSites }) => (
          <div className="pile">
            {alertes.length > 0 && <BlocAlertes alertes={alertes} />}

            <section aria-labelledby="titre-chiffres">
              <h2 id="titre-chiffres">Chiffres {annee}</h2>
              <div className="grille grille-3">
                <div className="carte chiffre">
                  <div className="chiffre-valeur">{formaterM2(totaux.m2)}</div>
                  <div className="chiffre-libelle">de modules nettoyés</div>
                </div>
                <div className="carte chiffre">
                  <div className="chiffre-valeur">{formaterHa(totaux.ha)}</div>
                  <div className="chiffre-libelle">débroussaillés</div>
                </div>
                <div className="carte chiffre">
                  <div className="chiffre-valeur nombre">{totaux.nombre}</div>
                  <div className="chiffre-libelle">{totaux.nombre > 1 ? 'interventions réalisées' : 'intervention réalisée'}</div>
                </div>
              </div>
            </section>

            <div className="grille grille-2">
              <section className="carte" aria-labelledby="titre-passages">
                <div className="carte-titre">
                  <h2 id="titre-passages">Prochains passages</h2>
                  <Link to="/planning">Tout le planning</Link>
                </div>
                {passages.length === 0 ? (
                  <p className="vide">Aucun passage planifié pour le moment.</p>
                ) : (
                  <ul className="liste">
                    {passages.map((i) => (
                      <LignePassage key={i.id} intervention={i} site={nomsSites.get(i.site_id)} />
                    ))}
                  </ul>
                )}
              </section>

              <section className="carte" aria-labelledby="titre-rapports">
                <div className="carte-titre">
                  <h2 id="titre-rapports">Derniers rapports</h2>
                  <Link to="/sites">Tous mes sites</Link>
                </div>
                {rapports.length === 0 ? (
                  <p className="vide">Aucun rapport publié pour le moment.</p>
                ) : (
                  <ul className="liste">
                    {rapports.map(({ intervention, fichier }) => (
                      <li key={fichier.id} className="ligne">
                        <div>
                          <Link to={`/interventions/${intervention.id}`}>{libelleIntervention(intervention)}</Link>
                          <div className="secondaire">
                            {nomsSites.get(intervention.site_id)?.nom} · {dateIntervention(intervention)}
                          </div>
                        </div>
                        <BoutonFichier fichier={fichier} libelle="PDF" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </Etat>
    </>
  );
}

function LignePassage({ intervention, site }: { intervention: Intervention; site?: Site }) {
  return (
    <li className="ligne">
      <div>
        <Link to={`/sites/${intervention.site_id}`}>{site?.nom ?? 'Site'}</Link>
        <div className="secondaire">
          {libelleIntervention(intervention)} · {dateIntervention(intervention)}
        </div>
      </div>
      <BadgeStatut statut={intervention.statut} />
    </li>
  );
}

function BlocAlertes({ alertes }: { alertes: Alerte[] }) {
  const tri = [...alertes].sort((a, b) => (a.type_alerte === b.type_alerte ? 0 : a.type_alerte === 'old' ? -1 : 1));
  return (
    <section aria-labelledby="titre-alertes">
      <h2 id="titre-alertes">Alertes</h2>
      {tri.map((a) =>
        a.type_alerte === 'old' ? (
          <div key={`old-${a.site_id}`} className="alerte alerte-attention">
            <p>
              <strong>Échéance OLD {a.jours_restants !== null && a.jours_restants < 0 ? 'dépassée' : 'proche'}</strong> –{' '}
              <Link to={`/sites/${a.site_id}`}>{a.site_nom}</Link> : date limite le {formaterDate(a.date_reference)}
              {a.jours_restants !== null && a.jours_restants >= 0 && <> (dans {pluriel(a.jours_restants, 'jour')})</>}.
            </p>
          </div>
        ) : (
          <div key={`anomalie-${a.intervention_id}`} className="alerte alerte-danger">
            <p>
              <strong>{pluriel(a.panneaux_casses ?? 0, 'panneau cassé', 'panneaux cassés')}</strong> –{' '}
              <Link to={`/sites/${a.site_id}`}>{a.site_nom}</Link>, constaté le {formaterDate(a.date_reference)}.
              {a.anomalies && <> {a.anomalies}</>}{' '}
              {a.intervention_id && <Link to={`/interventions/${a.intervention_id}`}>Voir l’intervention</Link>}
            </p>
          </div>
        ),
      )}
    </section>
  );
}
