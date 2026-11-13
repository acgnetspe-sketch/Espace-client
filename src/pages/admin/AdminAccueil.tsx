import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  listerDemandesAdmin,
  listerInterventionsAdmin,
  listerOrganisations,
  listerSitesAdmin,
  marquerAnomalieTraitee,
} from '../../lib/admin';
import { LIBELLE_DEMANDE } from '../../lib/libelles';
import { installerFichiersDemo, modeDemo } from '../../lib/demo';
import { chargerAlertes } from '../../lib/requetes';
import { useChargement } from '../../lib/useChargement';
import { aujourdhuiParis, formaterDate, formaterPeriode, pluriel } from '../../lib/formats';
import { LIBELLE_INTERVENTION } from '../../lib/libelles';
import { BadgeStatut, Etat } from '../../composants/Communs';
import { AfficherMessage, useAction } from '../../composants/Formulaire';
import type { InterventionAdmin } from '../../lib/admin';
import type { Site } from '../../lib/types';

async function chargerAccueil() {
  const [interventions, sites, organisations, alertes, demandes] = await Promise.all([
    listerInterventionsAdmin(),
    listerSitesAdmin(),
    listerOrganisations(),
    chargerAlertes(),
    listerDemandesAdmin(),
  ]);
  const jour = aujourdhuiParis();
  const fin = (i: InterventionAdmin) => i.fin_prevue ?? i.debut_prevu ?? '';
  const planifiees = interventions.filter((i) => i.statut === 'proposee' || i.statut === 'confirmee');
  return {
    sites: new Map(sites.map((s) => [s.id, s])),
    organisations: new Map(organisations.map((o) => [o.id, o.nom])),
    aVenir: planifiees
      .filter((i) => fin(i) >= jour)
      .sort((a, b) => (a.debut_prevu ?? '').localeCompare(b.debut_prevu ?? ''))
      .slice(0, 12),
    enRetard: planifiees.filter((i) => fin(i) !== '' && fin(i) < jour),
    aPublier: interventions.filter((i) => i.statut === 'realisee' && !i.publiee),
    anomalies: alertes.filter((a) => a.type_alerte === 'anomalie'),
    echeancesOld: alertes.filter((a) => a.type_alerte === 'old'),
    nombres: { organisations: organisations.length, sites: sites.length },
    demandesNouvelles: demandes.filter((d) => d.statut === 'envoyee'),
  };
}

export function AdminAccueil() {
  const etat = useChargement(chargerAccueil, []);
  const action = useAction();

  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Tableau de bord interne</h1>
          <p>Vue d’ensemble, tous clients confondus.</p>
        </div>
        <Link to="/admin/interventions/nouvelle" className="bouton">
          Planifier une intervention
        </Link>
      </div>
      <AfficherMessage message={action.message} />
      {modeDemo && (
        <div className="alerte alerte-attention" style={{ marginBottom: '1rem' }}>
          <p>
            <strong>Site de démonstration.</strong> Si les rapports ou les photos de démonstration ne s’ouvrent pas,
            installez-les (opération sans risque, à refaire après une réinitialisation).
          </p>
          <button
            type="button"
            className="bouton bouton-secondaire bouton-petit"
            disabled={action.enCours}
            onClick={() => action.executer(installerFichiersDemo, (n) => `${n} fichiers de démonstration installés.`)}
          >
            Installer les fichiers de démonstration
          </button>
        </div>
      )}

      <Etat etat={etat}>
        {(d) => {
          const nomSite = (id: string) => d.sites.get(id)?.nom ?? 'Site';
          const nomClient = (site?: Site) => (site ? d.organisations.get(site.organisation_id) : '') ?? '';
          const ligne = (i: InterventionAdmin, droite: ReactNode) => (
            <li key={i.id} className="ligne">
              <div>
                <Link to={`/admin/interventions/${i.id}`}>
                  {nomSite(i.site_id)} – {LIBELLE_INTERVENTION[i.type]}
                </Link>
                <div className="secondaire">
                  {nomClient(d.sites.get(i.site_id))} · {formaterPeriode(i.debut_reel ?? i.debut_prevu, i.fin_reelle ?? i.fin_prevue)}
                </div>
              </div>
              {droite}
            </li>
          );

          return (
            <div className="pile">
              <div className="grille grille-3">
                <div className="carte chiffre">
                  <div className="chiffre-valeur">{d.aPublier.length}</div>
                  <div className="chiffre-libelle">{d.aPublier.length > 1 ? 'comptes rendus à publier' : 'compte rendu à publier'}</div>
                </div>
                <div className="carte chiffre">
                  <div className="chiffre-valeur">{d.anomalies.length}</div>
                  <div className="chiffre-libelle">{d.anomalies.length > 1 ? 'anomalies ouvertes' : 'anomalie ouverte'}</div>
                </div>
                <Link to="/admin/demandes" className="carte chiffre carte-lien">
                  <div className="chiffre-valeur">{d.demandesNouvelles.length}</div>
                  <div className="chiffre-libelle">
                    {d.demandesNouvelles.length > 1 ? 'nouvelles demandes' : 'nouvelle demande'} de clients
                  </div>
                </Link>
              </div>

              <div className="grille grille-2" style={{ alignItems: 'start' }}>
                <section className="carte" aria-labelledby="titre-a-publier">
                  <div className="carte-titre">
                    <h2 id="titre-a-publier">Réalisées, à publier</h2>
                  </div>
                  {d.aPublier.length === 0 ? (
                    <p className="vide">Tout est publié.</p>
                  ) : (
                    <ul className="liste">{d.aPublier.map((i) => ligne(i, <span className="badge badge-a-publier">À publier</span>))}</ul>
                  )}
                </section>

                <section className="carte" aria-labelledby="titre-anomalies">
                  <h2 id="titre-anomalies">Anomalies ouvertes</h2>
                  {d.anomalies.length === 0 ? (
                    <p className="vide">Aucune anomalie ouverte.</p>
                  ) : (
                    <ul className="liste">
                      {d.anomalies.map((a) => (
                        <li key={a.intervention_id} className="ligne">
                          <div>
                            <Link to={`/admin/interventions/${a.intervention_id}`}>
                              {a.site_nom} – {pluriel(a.panneaux_casses ?? 0, 'panneau cassé', 'panneaux cassés')}
                            </Link>
                            <div className="secondaire">
                              {d.organisations.get(a.organisation_id)} · constaté le {formaterDate(a.date_reference)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="bouton bouton-secondaire bouton-petit"
                            disabled={action.enCours}
                            onClick={async () => {
                              const { ok } = await action.executer(
                                () => marquerAnomalieTraitee(a.intervention_id!),
                                `Anomalie de ${a.site_nom} marquée comme traitée.`,
                              );
                              if (ok) etat.recharger();
                            }}
                          >
                            Marquer traitée
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {d.demandesNouvelles.length > 0 && (
                  <section className="carte" aria-labelledby="titre-demandes">
                    <div className="carte-titre">
                      <h2 id="titre-demandes">Nouvelles demandes</h2>
                      <Link to="/admin/demandes">Répondre</Link>
                    </div>
                    <ul className="liste">
                      {d.demandesNouvelles.slice(0, 5).map((dem) => (
                        <li key={dem.id}>
                          <strong>{LIBELLE_DEMANDE[dem.type]}</strong> – {d.organisations.get(dem.organisation_id)}
                          <div className="secondaire" style={{ overflowWrap: 'anywhere' }}>
                            {dem.message.length > 120 ? `${dem.message.slice(0, 120)}…` : dem.message}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="carte" aria-labelledby="titre-a-venir">
                  <div className="carte-titre">
                    <h2 id="titre-a-venir">Passages à venir</h2>
                    <Link to="/admin/interventions">Toutes les interventions</Link>
                  </div>
                  {d.aVenir.length === 0 ? (
                    <p className="vide">Aucun passage planifié.</p>
                  ) : (
                    <ul className="liste">{d.aVenir.map((i) => ligne(i, <BadgeStatut statut={i.statut} />))}</ul>
                  )}
                </section>

                <div className="pile">
                  {d.enRetard.length > 0 && (
                    <section className="carte" aria-labelledby="titre-retard">
                      <h2 id="titre-retard">Date passée, statut à mettre à jour</h2>
                      <p className="secondaire">Passages proposés ou confirmés dont la date est dépassée : réalisés ? annulés ?</p>
                      <ul className="liste">{d.enRetard.map((i) => ligne(i, <BadgeStatut statut={i.statut} />))}</ul>
                    </section>
                  )}
                  <p className="secondaire">
                    {d.nombres.sites} sites chez {pluriel(d.nombres.organisations, 'client')} ·{' '}
                    <Link to="/admin/emails">Journal des e-mails automatiques</Link>
                  </p>
                  <section className="carte" aria-labelledby="titre-old">
                    <h2 id="titre-old">Échéances OLD à moins de 60 jours</h2>
                    {d.echeancesOld.length === 0 ? (
                      <p className="vide">Aucune échéance proche.</p>
                    ) : (
                      <ul className="liste">
                        {d.echeancesOld.map((a) => (
                          <li key={a.site_id} className="ligne">
                            <div>
                              <Link to={`/admin/sites/${a.site_id}`}>{a.site_nom}</Link>
                              <div className="secondaire">
                                {d.organisations.get(a.organisation_id)} · date limite le {formaterDate(a.date_reference)}
                              </div>
                            </div>
                            <span className="badge badge-a-publier">
                              {a.jours_restants !== null && a.jours_restants < 0 ? 'Dépassée' : `J-${a.jours_restants}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            </div>
          );
        }}
      </Etat>
    </>
  );
}
