import { Link, useParams } from 'react-router';
import { chargerFichiersDesInterventions, chargerIntervention, chargerSite } from '../lib/requetes';
import { useChargement } from '../lib/useChargement';
import { formaterHa, formaterHorodatage, formaterM2, formaterPeriode } from '../lib/formats';
import { LIBELLE_FICHIER } from '../lib/libelles';
import { BadgeStatut, BoutonFichier, Etat, PageIntrouvable, libelleIntervention } from '../composants/Communs';
import type { Fichier, Intervention, Site } from '../lib/types';

async function chargerFiche(id: string) {
  const intervention = await chargerIntervention(id);
  if (!intervention) return { intervention: null, site: null, fichiers: [] as Fichier[] };
  const [site, fichiers] = await Promise.all([
    chargerSite(intervention.site_id),
    intervention.publiee ? chargerFichiersDesInterventions([intervention.id]) : Promise.resolve([] as Fichier[]),
  ]);
  return { intervention, site, fichiers };
}

export function FicheIntervention() {
  const { id = '' } = useParams();
  const etat = useChargement(() => chargerFiche(id), [id]);
  return (
    <Etat etat={etat}>
      {({ intervention, site, fichiers }) =>
        intervention && site ? (
          <Contenu intervention={intervention} site={site} fichiers={fichiers} />
        ) : (
          <PageIntrouvable texte="Cette intervention n’existe pas, ou elle n’est pas (encore) visible depuis votre compte." />
        )
      }
    </Etat>
  );
}

function Contenu({ intervention: i, site, fichiers }: { intervention: Intervention; site: Site; fichiers: Fichier[] }) {
  const rapports = fichiers.filter((f) => f.type === 'rapport' || f.type === 'document');

  return (
    <>
      <div className="fil-ariane">
        <Link to="/sites">Mes sites</Link> › <Link to={`/sites/${site.id}`}>{site.nom}</Link> › Intervention
      </div>
      <div className="titre-page">
        <div>
          <h1>{libelleIntervention(i)}</h1>
          <p>
            <Link to={`/sites/${site.id}`}>{site.nom}</Link>
          </p>
        </div>
        <BadgeStatut statut={i.statut} />
      </div>

      <div className="grille grille-2" style={{ alignItems: 'start' }}>
        <section className="carte" aria-labelledby="titre-detail">
          <h2 id="titre-detail">Détail</h2>
          <dl className="infos">
            <dt>Prestation</dt>
            <dd>{libelleIntervention(i)}</dd>
            <dt>Date prévue</dt>
            <dd>{formaterPeriode(i.debut_prevu, i.fin_prevue)}</dd>
            {i.publiee && (
              <>
                <dt>Date de réalisation</dt>
                <dd>{formaterPeriode(i.debut_reel, i.fin_reelle)}</dd>
                <dt>Surface traitée</dt>
                <dd className="nombre">
                  {[formaterM2(i.surface_m2), formaterHa(i.surface_ha)].filter(Boolean).join(' · ') || '–'}
                </dd>
                <dt>Encrassement</dt>
                <dd>{i.encrassement ? <Jauge valeur={i.encrassement} /> : '–'}</dd>
                <dt>Bon de commande</dt>
                <dd>{i.bon_commande ?? '–'}</dd>
                {i.publiee_le && (
                  <>
                    <dt>Compte rendu publié le</dt>
                    <dd>{formaterHorodatage(i.publiee_le)}</dd>
                  </>
                )}
              </>
            )}
          </dl>
        </section>

        <div className="pile">
          {i.publiee ? (
            <>
              <section className="carte" aria-labelledby="titre-anomalies">
                <h2 id="titre-anomalies">Anomalies</h2>
                {i.panneaux_casses && i.panneaux_casses > 0 ? (
                  <div className={`alerte ${i.anomalie_traitee ? 'alerte-succes' : 'alerte-danger'}`}>
                    <p>
                      <strong>
                        {i.panneaux_casses} {i.panneaux_casses > 1 ? 'panneaux cassés' : 'panneau cassé'}
                      </strong>
                      {i.anomalie_traitee ? ' – anomalie traitée.' : ' – en attente de traitement.'}
                    </p>
                    {i.anomalies && <p>Emplacement : {i.anomalies}</p>}
                  </div>
                ) : i.anomalies ? (
                  <p>{i.anomalies}</p>
                ) : (
                  <p className="vide">Aucune anomalie signalée.</p>
                )}
              </section>

              <section className="carte" aria-labelledby="titre-rapport">
                <h2 id="titre-rapport">Rapport</h2>
                {rapports.length === 0 ? (
                  <p className="vide">Aucun rapport joint à cette intervention.</p>
                ) : (
                  <ul className="liste">
                    {rapports.map((f) => (
                      <li key={f.id} className="ligne">
                        <span>{f.nom}</span>
                        <BoutonFichier fichier={f} libelle={`Ouvrir le ${LIBELLE_FICHIER[f.type].toLowerCase()}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <section className="carte">
              <h2>Compte rendu</h2>
              <p className="vide">
                {i.statut === 'annulee'
                  ? 'Ce passage a été annulé.'
                  : 'Le compte rendu et le rapport seront disponibles ici après le passage, dès leur publication par ACG NET SPE.'}
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

/** Niveau d'encrassement sur 10, sous forme de barre. */
function Jauge({ valeur }: { valeur: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
      <span
        role="img"
        aria-label={`Encrassement ${valeur} sur 10`}
        style={{
          display: 'inline-block',
          width: '120px',
          height: '8px',
          borderRadius: '4px',
          background: `linear-gradient(to right, var(--jaune) ${valeur * 10}%, var(--gris-fond) ${valeur * 10}%)`,
          border: '1px solid var(--bordure)',
        }}
      />
      <span className="nombre">{valeur} / 10</span>
    </span>
  );
}
