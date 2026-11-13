import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { listerDemandesAdmin, listerOrganisations, listerProfils, listerSitesAdmin, repondreDemande } from '../../lib/admin';
import { useChargement } from '../../lib/useChargement';
import { formaterDate, formaterHorodatage } from '../../lib/formats';
import { LIBELLE_DEMANDE, LIBELLE_STATUT_DEMANDE } from '../../lib/libelles';
import { Etat } from '../../composants/Communs';
import { AfficherMessage, Champ, nulSiVide, useAction } from '../../composants/Formulaire';
import { BadgeDemande } from '../Demandes';
import type { Demande, StatutDemande } from '../../lib/types';

async function charger() {
  const [demandes, organisations, sites, profils] = await Promise.all([
    listerDemandesAdmin(),
    listerOrganisations(),
    listerSitesAdmin(),
    listerProfils(),
  ]);
  return {
    demandes,
    organisations: new Map(organisations.map((o) => [o.id, o.nom])),
    sites: new Map(sites.map((s) => [s.id, s.nom])),
    profils: new Map(profils.map((p) => [p.id, p])),
  };
}

export function AdminDemandes() {
  const etat = useChargement(charger, []);
  const [filtre, setFiltre] = useState<'a_traiter' | 'toutes'>('a_traiter');
  // Une demande que l'on vient de traiter reste affichée (avec sa confirmation) jusqu'au départ de la page.
  const [modifiees, setModifiees] = useState<Set<string>>(new Set());

  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Demandes des clients</h1>
          <p>Chaque réponse enregistrée est envoyée par e-mail à l’auteur de la demande.</p>
        </div>
      </div>
      <Etat etat={etat}>
        {({ demandes, organisations, sites, profils }) => {
          const affichees = demandes.filter((d) => filtre === 'toutes' || d.statut !== 'traitee' || modifiees.has(d.id));
          return (
            <>
              <div className="filtres">
                <div>
                  <label htmlFor="filtre-demandes">Afficher</label>
                  <select id="filtre-demandes" value={filtre} onChange={(e) => setFiltre(e.target.value as 'a_traiter' | 'toutes')}>
                    <option value="a_traiter">À traiter (envoyées et prises en compte)</option>
                    <option value="toutes">Toutes les demandes</option>
                  </select>
                </div>
              </div>
              {affichees.length === 0 ? (
                <div className="carte">
                  <p className="vide">Aucune demande à traiter.</p>
                </div>
              ) : (
                <div className="grille grille-2" style={{ alignItems: 'start' }}>
                  {affichees.map((d) => (
                    <CarteDemande
                      key={d.id}
                      demande={d}
                      client={organisations.get(d.organisation_id) ?? ''}
                      site={d.site_id ? sites.get(d.site_id) : undefined}
                      auteur={d.auteur_id ? profils.get(d.auteur_id) : undefined}
                      surChangement={() => {
                        setModifiees((m) => new Set(m).add(d.id));
                        etat.recharger();
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          );
        }}
      </Etat>
    </>
  );
}

function CarteDemande({
  demande: d,
  client,
  site,
  auteur,
  surChangement,
}: {
  demande: Demande;
  client: string;
  site?: string;
  auteur?: { nom: string; email: string; telephone: string | null };
  surChangement: () => void;
}) {
  const action = useAction();
  const [statut, setStatut] = useState<StatutDemande>(d.statut === 'envoyee' ? 'prise_en_compte' : d.statut);
  const [reponse, setReponse] = useState(d.reponse ?? '');

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const nouvelleReponse = nulSiVide(reponse);
    const { ok } = await action.executer(
      () => repondreDemande(d.id, statut, nouvelleReponse),
      nouvelleReponse && nouvelleReponse !== d.reponse ? 'Enregistré. La réponse part par e-mail dans les prochaines minutes.' : 'Enregistré.',
    );
    if (ok) surChangement();
  }

  return (
    <section className="carte">
      <div className="ligne">
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>{LIBELLE_DEMANDE[d.type]}</h2>
          <div className="secondaire">
            {client}
            {site && ` · ${site}`} · le {formaterHorodatage(d.creee_le)}
          </div>
        </div>
        <BadgeDemande statut={d.statut} />
      </div>
      <p className="secondaire" style={{ marginTop: '0.5rem' }}>
        De : {auteur ? `${auteur.nom} (${auteur.email}${auteur.telephone ? `, ${auteur.telephone}` : ''})` : 'contact supprimé'}
        {d.date_souhaitee && (
          <>
            {' '}
            · date souhaitée : <strong>{formaterDate(d.date_souhaitee)}</strong>
          </>
        )}
        {d.intervention_id && (
          <>
            {' '}
            · <Link to={`/admin/interventions/${d.intervention_id}`}>passage concerné</Link>
          </>
        )}
      </p>
      <div className="alerte alerte-info texte-saisi">{d.message}</div>

      <form onSubmit={enregistrer} style={{ marginTop: '1rem' }}>
        <div className="formulaire">
          <Champ id={`statut-${d.id}`} libelle="Statut">
            <select id={`statut-${d.id}`} value={statut} onChange={(e) => setStatut(e.target.value as StatutDemande)}>
              {(Object.keys(LIBELLE_STATUT_DEMANDE) as StatutDemande[]).map((s) => (
                <option key={s} value={s}>
                  {LIBELLE_STATUT_DEMANDE[s]}
                </option>
              ))}
            </select>
          </Champ>
          <div className="pleine-largeur">
            <Champ id={`reponse-${d.id}`} libelle="Réponse au client" aide="Visible par le client et envoyée par e-mail à l’auteur.">
              <textarea id={`reponse-${d.id}`} value={reponse} maxLength={4000} onChange={(e) => setReponse(e.target.value)} />
            </Champ>
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="bouton" disabled={action.enCours}>
            Enregistrer
          </button>
        </div>
        <AfficherMessage message={action.message} />
      </form>
    </section>
  );
}
