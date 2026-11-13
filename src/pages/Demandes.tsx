import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useConnexion } from '../lib/auth';
import { chargerDemandes, chargerIntervention, chargerSites, envoyerDemande } from '../lib/requetes';
import { useChargement } from '../lib/useChargement';
import { aujourdhuiParis, formaterDate, formaterHorodatage } from '../lib/formats';
import { LIBELLE_DEMANDE, LIBELLE_STATUT_DEMANDE } from '../lib/libelles';
import { Etat, dateIntervention, libelleIntervention } from '../composants/Communs';
import { AfficherMessage, Champ, nulSiVide, useAction } from '../composants/Formulaire';
import type { Demande, Intervention, Profil, Site, StatutDemande, TypeDemande } from '../lib/types';

async function charger(interventionId: string | null) {
  const [demandes, sites, intervention] = await Promise.all([
    chargerDemandes(),
    chargerSites(),
    interventionId ? chargerIntervention(interventionId) : Promise.resolve(null),
  ]);
  return { demandes, sites, intervention };
}

export function Demandes() {
  const { profil } = useConnexion();
  const [parametres] = useSearchParams();
  const interventionId = parametres.get('intervention');
  const etat = useChargement(() => charger(interventionId), [interventionId]);

  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Mes demandes</h1>
          <p>Une intervention, un devis, un problème constaté, un changement de date : écrivez-nous ici.</p>
        </div>
      </div>
      <Etat etat={etat}>
        {({ demandes, sites, intervention }) => (
          <div className="grille grille-2" style={{ alignItems: 'start' }}>
            {profil?.role === 'client' && profil.organisation_id ? (
              <FormulaireDemande
                key={intervention?.id ?? 'libre'}
                profil={profil}
                sites={sites}
                intervention={intervention}
                surEnvoi={etat.recharger}
              />
            ) : (
              <div className="carte">
                <p className="vide">Les demandes sont envoyées par les contacts des clients.</p>
              </div>
            )}
            <ListeDemandes demandes={demandes} sites={sites} />
          </div>
        )}
      </Etat>
    </>
  );
}

function FormulaireDemande({
  profil,
  sites,
  intervention,
  surEnvoi,
}: {
  profil: Profil;
  sites: Site[];
  intervention: Intervention | null;
  surEnvoi: () => void;
}) {
  const action = useAction();
  const [type, setType] = useState<TypeDemande>(intervention ? 'changement_date' : 'nouvelle_intervention');
  const [siteId, setSiteId] = useState(intervention?.site_id ?? (sites.length === 1 ? sites[0]!.id : ''));
  const [message, setMessage] = useState('');
  const [dateSouhaitee, setDateSouhaitee] = useState('');
  const [envoyee, setEnvoyee] = useState(false);
  const site = sites.find((s) => s.id === siteId);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    const { ok } = await action.executer(() =>
      envoyerDemande({
        organisation_id: profil.organisation_id!,
        auteur_id: profil.id,
        type,
        message: message.trim(),
        site_id: nulSiVide(siteId),
        intervention_id: type === 'changement_date' && intervention ? intervention.id : null,
        date_souhaitee: nulSiVide(dateSouhaitee),
      }),
    );
    if (ok) {
      setEnvoyee(true);
      setMessage('');
      setDateSouhaitee('');
      surEnvoi();
    }
  }

  if (envoyee) {
    return (
      <section className="carte">
        <h2>Demande envoyée</h2>
        <div className="alerte alerte-succes" role="status">
          <p>Merci, votre demande a bien été transmise à ACG NET SPE. Vous recevrez la réponse par e-mail et ici même.</p>
        </div>
        <div className="actions">
          <Link to="/demandes" className="bouton bouton-secondaire" onClick={() => setEnvoyee(false)}>
            Faire une autre demande
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="carte" aria-labelledby="titre-nouvelle-demande">
      <h2 id="titre-nouvelle-demande">Nouvelle demande</h2>
      {intervention && type === 'changement_date' && (
        <div className="alerte alerte-info" style={{ marginBottom: '1rem' }}>
          <p>
            Passage concerné : <strong>{libelleIntervention(intervention)}</strong>,{' '}
            {sites.find((s) => s.id === intervention.site_id)?.nom}, {dateIntervention(intervention)}.
          </p>
        </div>
      )}
      <form onSubmit={envoyer}>
        <div className="formulaire">
          <Champ id="demande-type" libelle="Objet" obligatoire>
            <select id="demande-type" value={type} onChange={(e) => setType(e.target.value as TypeDemande)}>
              {(Object.keys(LIBELLE_DEMANDE) as TypeDemande[])
                .filter((t) => t !== 'changement_date' || intervention)
                .map((t) => (
                  <option key={t} value={t}>
                    {LIBELLE_DEMANDE[t]}
                  </option>
                ))}
            </select>
          </Champ>
          <Champ id="demande-site" libelle="Site concerné">
            <select
              id="demande-site"
              value={siteId}
              disabled={Boolean(intervention && type === 'changement_date')}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">Aucun site en particulier</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </Champ>
          {(type === 'changement_date' || type === 'nouvelle_intervention') && (
            <Champ id="demande-date" libelle="Date souhaitée">
              <input
                id="demande-date"
                type="date"
                min={aujourdhuiParis()}
                value={dateSouhaitee}
                onChange={(e) => setDateSouhaitee(e.target.value)}
              />
            </Champ>
          )}
          <div className="pleine-largeur">
            <Champ
              id="demande-message"
              libelle="Message"
              obligatoire
              aide={type === 'probleme' ? 'Décrivez le problème et son emplacement sur le site.' : undefined}
            >
              <textarea
                id="demande-message"
                required
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={site ? `À propos de ${site.nom}…` : ''}
              />
            </Champ>
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="bouton" disabled={action.enCours || message.trim() === ''}>
            {action.enCours ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
        <AfficherMessage message={action.message} />
      </form>
    </section>
  );
}

export function BadgeDemande({ statut }: { statut: StatutDemande }) {
  const classe = statut === 'traitee' ? 'badge-realisee' : statut === 'prise_en_compte' ? 'badge-confirmee' : 'badge-proposee';
  return <span className={`badge ${classe}`}>{LIBELLE_STATUT_DEMANDE[statut]}</span>;
}

function ListeDemandes({ demandes, sites }: { demandes: Demande[]; sites: Site[] }) {
  const nomSite = new Map(sites.map((s) => [s.id, s.nom]));
  return (
    <section className="carte" aria-labelledby="titre-suivi">
      <h2 id="titre-suivi">Suivi de mes demandes</h2>
      {demandes.length === 0 ? (
        <p className="vide">Aucune demande pour le moment.</p>
      ) : (
        <ul className="liste">
          {demandes.map((d) => (
            <li key={d.id}>
              <div className="ligne">
                <div>
                  <strong>{LIBELLE_DEMANDE[d.type]}</strong>
                  <div className="secondaire">
                    Envoyée le {formaterHorodatage(d.creee_le)}
                    {d.site_id && nomSite.get(d.site_id) && ` · ${nomSite.get(d.site_id)}`}
                    {d.date_souhaitee && ` · date souhaitée : ${formaterDate(d.date_souhaitee)}`}
                  </div>
                </div>
                <BadgeDemande statut={d.statut} />
              </div>
              <p className="texte-saisi">{d.message}</p>
              {d.reponse && (
                <div className="alerte alerte-info">
                  <p>
                    <strong>Réponse d’ACG NET SPE :</strong>
                  </p>
                  <p className="texte-saisi">{d.reponse}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
