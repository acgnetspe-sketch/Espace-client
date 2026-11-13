import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  creerIntervention,
  definirPublication,
  enregistrerNotesIntervention,
  listerFichiers,
  listerOrganisations,
  listerSitesAdmin,
  lireInterventionAdmin,
  lireNotesIntervention,
  modifierIntervention,
  supprimerIntervention,
  type DonneesIntervention,
  type InterventionAdmin,
} from '../../lib/admin';
import { useChargement } from '../../lib/useChargement';
import { formaterHorodatage } from '../../lib/formats';
import { LIBELLE_INTERVENTION, LIBELLE_STATUT } from '../../lib/libelles';
import { BadgeStatut, Etat, PageIntrouvable } from '../../composants/Communs';
import { AfficherMessage, Champ, nombreOuNul, nulSiVide, useAction, versChamp } from '../../composants/Formulaire';
import { GestionFichiers } from '../../composants/GestionFichiers';
import type { Organisation, Site, StatutIntervention, TypeIntervention } from '../../lib/types';

async function charger(id: string | null) {
  const [sites, organisations, intervention, notes, fichiers] = await Promise.all([
    listerSitesAdmin(),
    listerOrganisations(),
    id ? lireInterventionAdmin(id) : Promise.resolve(null),
    id ? lireNotesIntervention(id) : Promise.resolve(''),
    id ? listerFichiers({ intervention_id: id }) : Promise.resolve([]),
  ]);
  return { sites, organisations, intervention, notes, nombreRapports: fichiers.filter((f) => f.type === 'rapport').length };
}

export function AdminIntervention() {
  const { id } = useParams();
  const estNouvelle = !id || id === 'nouvelle';
  const etat = useChargement(() => charger(estNouvelle ? null : id), [id]);
  return (
    <Etat etat={etat}>
      {(d) =>
        !estNouvelle && !d.intervention ? (
          <PageIntrouvable texte="Cette intervention n’existe pas." />
        ) : (
          <Formulaire key={d.intervention?.id ?? 'nouvelle'} {...d} recharger={etat.recharger} />
        )
      }
    </Etat>
  );
}

interface Champs {
  site_id: string;
  type: TypeIntervention;
  statut: StatutIntervention;
  periode: boolean;
  debut_prevu: string;
  fin_prevue: string;
  debut_reel: string;
  fin_reelle: string;
  surface_m2: string;
  surface_ha: string;
  encrassement: string;
  panneaux_casses: string;
  anomalies: string;
  anomalie_traitee: boolean;
  bon_commande: string;
}

function versChamps(i: InterventionAdmin | null, siteParDefaut: string): Champs {
  return {
    site_id: i?.site_id ?? siteParDefaut,
    type: i?.type ?? 'nettoyage',
    statut: i?.statut ?? 'proposee',
    periode: Boolean(i?.fin_prevue && i.debut_prevu && i.fin_prevue !== i.debut_prevu),
    debut_prevu: i?.debut_prevu ?? '',
    fin_prevue: i?.fin_prevue ?? '',
    debut_reel: i?.debut_reel ?? '',
    fin_reelle: i?.fin_reelle ?? '',
    surface_m2: versChamp(i?.surface_m2),
    surface_ha: versChamp(i?.surface_ha),
    encrassement: i?.encrassement ? String(i.encrassement) : '',
    panneaux_casses: i ? String(i.panneaux_casses) : '0',
    anomalies: i?.anomalies ?? '',
    anomalie_traitee: i?.anomalie_traitee ?? false,
    bon_commande: i?.bon_commande ?? '',
  };
}

function versDonnees(c: Champs): DonneesIntervention {
  const fin = (debut: string, finSaisie: string, periode: boolean) => nulSiVide(periode ? finSaisie : debut);
  return {
    site_id: c.site_id,
    type: c.type,
    statut: c.statut,
    debut_prevu: nulSiVide(c.debut_prevu),
    fin_prevue: fin(c.debut_prevu, c.fin_prevue, c.periode),
    debut_reel: nulSiVide(c.debut_reel),
    fin_reelle: nulSiVide(c.fin_reelle) ?? nulSiVide(c.debut_reel),
    surface_m2: nombreOuNul(c.surface_m2),
    surface_ha: nombreOuNul(c.surface_ha),
    encrassement: c.encrassement ? Number(c.encrassement) : null,
    panneaux_casses: Math.max(0, Math.trunc(nombreOuNul(c.panneaux_casses) ?? 0)),
    anomalies: nulSiVide(c.anomalies),
    anomalie_traitee: c.anomalie_traitee,
    bon_commande: nulSiVide(c.bon_commande),
  };
}

function Formulaire({
  sites,
  organisations,
  intervention,
  notes,
  nombreRapports,
  recharger,
}: Awaited<ReturnType<typeof charger>> & { sites: Site[]; organisations: Organisation[]; recharger: () => void }) {
  const navigation = useNavigate();
  const [parametres] = useSearchParams();
  const action = useAction();
  const actionPublication = useAction();
  const actionNotes = useAction();
  const initiaux = versChamps(intervention, parametres.get('site') ?? '');
  const [c, setC] = useState<Champs>(initiaux);
  // Après un enregistrement, on repart des valeurs relues en base (ex. « 20 000 » devient « 20000 »).
  const empreinte = JSON.stringify(intervention);
  useEffect(() => {
    setC(versChamps(intervention, parametres.get('site') ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreinte]);
  const [texteNotes, setTexteNotes] = useState(notes);
  const modifie = JSON.stringify(c) !== JSON.stringify(initiaux);
  const maj = (cle: keyof Champs) => (e: { target: { value: string } }) => setC({ ...c, [cle]: e.target.value });

  const site = sites.find((s) => s.id === c.site_id);
  const nomClient = new Map(organisations.map((o) => [o.id, o.nom]));
  const compteRendu = c.statut === 'realisee';

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const donnees = versDonnees(c);
    if (intervention) {
      if (intervention.publiee && c.statut !== 'realisee') {
        action.setMessage({ type: 'erreur', texte: 'Retirez d’abord la publication avant de changer le statut.' });
        return;
      }
      const { ok } = await action.executer(() => modifierIntervention(intervention.id, donnees), 'Intervention enregistrée.');
      if (ok) recharger();
    } else {
      const { resultat: cree } = await action.executer(() => creerIntervention(donnees));
      if (cree) navigation(`/admin/interventions/${cree.id}`, { replace: true });
    }
  }

  return (
    <>
      <div className="fil-ariane">
        <Link to="/admin/interventions">Interventions</Link> › {intervention ? 'Fiche' : 'Nouvelle intervention'}
      </div>
      <div className="titre-page">
        <div>
          <h1>{intervention ? `${LIBELLE_INTERVENTION[intervention.type]}` : 'Planifier une intervention'}</h1>
          {intervention && site && (
            <p>
              <Link to={`/admin/sites/${site.id}`}>{site.nom}</Link> · {nomClient.get(site.organisation_id)}
            </p>
          )}
        </div>
        {intervention && (
          <div className="actions" style={{ marginTop: 0 }}>
            <BadgeStatut statut={intervention.statut} />
            {intervention.publiee ? (
              <span className="badge badge-publiee">Publiée</span>
            ) : (
              intervention.statut === 'realisee' && <span className="badge badge-a-publier">À publier</span>
            )}
          </div>
        )}
      </div>

      <div className="grille grille-2" style={{ alignItems: 'start' }}>
        <form onSubmit={enregistrer} className="pile">
          <section className="carte">
            <h2>Planification</h2>
            <div className="formulaire">
              <div className="pleine-largeur">
                <Champ id="int-site" libelle="Site" obligatoire>
                  <select
                    id="int-site"
                    required
                    value={c.site_id}
                    disabled={Boolean(intervention?.publiee)}
                    onChange={maj('site_id')}
                  >
                    <option value="">Choisir…</option>
                    {organisations.map((o) => (
                      <optgroup key={o.id} label={o.nom}>
                        {sites
                          .filter((s) => s.organisation_id === o.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nom}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </Champ>
              </div>
              <Champ id="int-type" libelle="Prestation" obligatoire>
                <select id="int-type" value={c.type} onChange={maj('type')}>
                  {Object.entries(LIBELLE_INTERVENTION).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ id="int-statut" libelle="Statut" obligatoire aide="« Proposé » et « Confirmé » sont visibles du client dès l’enregistrement.">
                <select id="int-statut" value={c.statut} onChange={maj('statut')}>
                  {Object.entries(LIBELLE_STATUT).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Champ>
              <fieldset className="pleine-largeur">
                <legend>Date prévue</legend>
                <div className="actions" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                  <label className="case" htmlFor="int-date-precise">
                    <input
                      id="int-date-precise"
                      type="radio"
                      name="periode"
                      checked={!c.periode}
                      onChange={() => setC({ ...c, periode: false })}
                    />
                    Date précise
                  </label>
                  <label className="case" htmlFor="int-periode">
                    <input id="int-periode" type="radio" name="periode" checked={c.periode} onChange={() => setC({ ...c, periode: true })} />
                    Période
                  </label>
                </div>
                <div className="formulaire">
                  <Champ id="int-debut-prevu" libelle={c.periode ? 'Du' : 'Le'}>
                    <input id="int-debut-prevu" type="date" value={c.debut_prevu} onChange={maj('debut_prevu')} />
                  </Champ>
                  {c.periode && (
                    <Champ id="int-fin-prevue" libelle="Au">
                      <input id="int-fin-prevue" type="date" value={c.fin_prevue} min={c.debut_prevu} onChange={maj('fin_prevue')} />
                    </Champ>
                  )}
                </div>
              </fieldset>
            </div>
          </section>

          <section className="carte">
            <h2>Compte rendu</h2>
            {!compteRendu && (
              <p className="aide" style={{ marginTop: 0 }}>
                À remplir une fois l’intervention réalisée (passer le statut à « Réalisé »).
              </p>
            )}
            <fieldset disabled={!compteRendu} style={{ border: 0, padding: 0 }}>
              <div className="formulaire">
                <Champ id="int-debut-reel" libelle="Réalisée du">
                  <input id="int-debut-reel" type="date" value={c.debut_reel} onChange={maj('debut_reel')} />
                </Champ>
                <Champ id="int-fin-reelle" libelle="Au" aide="Laisser vide si un seul jour.">
                  <input id="int-fin-reelle" type="date" value={c.fin_reelle} min={c.debut_reel} onChange={maj('fin_reelle')} />
                </Champ>
                <Champ id="int-m2" libelle="Surface nettoyée (m²)">
                  <input id="int-m2" inputMode="decimal" value={c.surface_m2} onChange={maj('surface_m2')} />
                </Champ>
                <Champ id="int-ha" libelle="Surface débroussaillée (ha)">
                  <input id="int-ha" inputMode="decimal" value={c.surface_ha} onChange={maj('surface_ha')} />
                </Champ>
                <Champ id="int-encrassement" libelle="Encrassement (sur 10)">
                  <select id="int-encrassement" value={c.encrassement} onChange={maj('encrassement')}>
                    <option value="">Non évalué</option>
                    {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} / 10
                      </option>
                    ))}
                  </select>
                </Champ>
                <Champ id="int-bc" libelle="N° de bon de commande">
                  <input id="int-bc" value={c.bon_commande} onChange={maj('bon_commande')} />
                </Champ>
                <Champ id="int-casses" libelle="Panneaux cassés">
                  <input id="int-casses" type="number" min={0} inputMode="numeric" value={c.panneaux_casses} onChange={maj('panneaux_casses')} />
                </Champ>
                <div className="champ" style={{ alignSelf: 'end' }}>
                  <label className="case" htmlFor="int-traitee">
                    <input
                      id="int-traitee"
                      type="checkbox"
                      checked={c.anomalie_traitee}
                      onChange={(e) => setC({ ...c, anomalie_traitee: e.target.checked })}
                    />
                    Anomalie traitée
                  </label>
                </div>
                <div className="pleine-largeur">
                  <Champ id="int-anomalies" libelle="Anomalies (emplacement, description)" aide="Visible par le client après publication.">
                    <textarea id="int-anomalies" value={c.anomalies} onChange={maj('anomalies')} />
                  </Champ>
                </div>
              </div>
            </fieldset>
          </section>

          <div className="carte">
            <div className="actions" style={{ marginTop: 0 }}>
              <button type="submit" className="bouton" disabled={action.enCours || (Boolean(intervention) && !modifie)}>
                {intervention ? 'Enregistrer les modifications' : 'Créer l’intervention'}
              </button>
              {intervention && modifie && <span className="secondaire">Modifications non enregistrées</span>}
              {intervention && !intervention.publiee && (
                <button
                  type="button"
                  className="bouton bouton-danger"
                  onClick={async () => {
                    if (!window.confirm('Supprimer définitivement cette intervention et ses fichiers ?')) return;
                    const { ok } = await action.executer(() => supprimerIntervention(intervention.id));
                    if (ok) navigation('/admin/interventions');
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
            <AfficherMessage message={action.message} />
          </div>
        </form>

        {intervention && site && (
          <div className="pile">
            <section className="carte zone-publication" aria-labelledby="titre-publication">
              <h2 id="titre-publication">Publication</h2>
              {intervention.publiee ? (
                <>
                  <p>
                    Publiée le <strong>{formaterHorodatage(intervention.publiee_le)}</strong> : le client voit le compte
                    rendu et les fichiers.
                  </p>
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    disabled={actionPublication.enCours}
                    onClick={async () => {
                      if (!window.confirm('Retirer la publication ? Le client ne verra plus ce compte rendu ni ses fichiers.')) return;
                      const { ok } = await actionPublication.executer(() => definirPublication(intervention.id, false), 'Publication retirée.');
                      if (ok) recharger();
                    }}
                  >
                    Retirer la publication
                  </button>
                </>
              ) : intervention.statut !== 'realisee' ? (
                <p className="secondaire">
                  La publication sera possible une fois l’intervention « Réalisée ». Le client voit déjà le passage prévu
                  (date et statut), mais pas le compte rendu.
                </p>
              ) : (
                <>
                  <p>Tant qu’elle n’est pas publiée, cette intervention est invisible du client.</p>
                  {nombreRapports === 0 && (
                    <div className="alerte alerte-attention" style={{ marginBottom: '0.75rem' }}>
                      <p>Aucun rapport PDF n’est encore déposé.</p>
                    </div>
                  )}
                  {modifie && <p className="secondaire">Enregistrez d’abord vos modifications.</p>}
                  <button
                    type="button"
                    className="bouton bouton-jaune"
                    disabled={actionPublication.enCours || modifie}
                    onClick={async () => {
                      if (!window.confirm('Publier ? Le client verra le compte rendu, les anomalies, les photos et les fichiers déposés, et ses contacts seront prévenus par e-mail.')) return;
                      const { ok } = await actionPublication.executer(() => definirPublication(intervention.id, true), 'Intervention publiée.');
                      if (ok) recharger();
                    }}
                  >
                    Publier
                  </button>
                </>
              )}
              <AfficherMessage message={actionPublication.message} />
            </section>

            <section className="carte">
              <h2>Rapport, photos et documents</h2>
              {intervention.publiee && (
                <p className="aide" style={{ marginTop: 0 }}>
                  Intervention publiée : un fichier ou une photo déposé ici est immédiatement visible par le client.
                </p>
              )}
              <GestionFichiers
                cible={{ intervention_id: intervention.id }}
                organisationId={site.organisation_id}
                siteId={site.id}
                typesProposes={['rapport', 'photo_avant', 'photo_apres', 'document']}
                surChangement={recharger}
              />
            </section>

            <section className="carte">
              <h2>Notes internes</h2>
              <p className="aide" style={{ marginTop: 0 }}>Visibles uniquement par l’équipe ACG, jamais par le client.</p>
              <textarea aria-label="Notes internes" value={texteNotes} onChange={(e) => setTexteNotes(e.target.value)} />
              <div className="actions">
                <button
                  type="button"
                  className="bouton bouton-secondaire"
                  disabled={actionNotes.enCours}
                  onClick={() => actionNotes.executer(() => enregistrerNotesIntervention(intervention.id, texteNotes), 'Notes enregistrées.')}
                >
                  Enregistrer les notes
                </button>
              </div>
              <AfficherMessage message={actionNotes.message} />
            </section>
          </div>
        )}
      </div>
    </>
  );
}
