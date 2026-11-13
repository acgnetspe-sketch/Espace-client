import { Link, useParams } from 'react-router';
import {
  chargerDocumentsDuSite,
  chargerFichiersDesInterventions,
  chargerInterventionsDuSite,
  chargerSite,
} from '../lib/requetes';
import { useChargement } from '../lib/useChargement';
import { aujourdhuiParis, formaterDate, formaterHa, formaterM2, pluriel } from '../lib/formats';
import { LIBELLE_INSTALLATION } from '../lib/libelles';
import {
  BadgeStatut,
  BoutonFichier,
  Etat,
  PageIntrouvable,
  dateIntervention,
  dateTri,
  libelleIntervention,
} from '../composants/Communs';
import type { Fichier, Intervention, Site } from '../lib/types';

async function chargerFiche(id: string) {
  const [site, interventions, documents] = await Promise.all([
    chargerSite(id),
    chargerInterventionsDuSite(id),
    chargerDocumentsDuSite(id),
  ]);
  const fichiers = await chargerFichiersDesInterventions(interventions.filter((i) => i.publiee).map((i) => i.id));
  // Frise : la plus récente en haut (passages à venir compris).
  interventions.sort((a, b) => dateTri(b).localeCompare(dateTri(a)));
  return { site, interventions, documents, fichiers };
}

export function FicheSite() {
  const { id = '' } = useParams();
  const etat = useChargement(() => chargerFiche(id), [id]);

  return (
    <Etat etat={etat}>
      {({ site, interventions, documents, fichiers }) =>
        site ? (
          <ContenuFiche site={site} interventions={interventions} documents={documents} fichiers={fichiers} />
        ) : (
          <PageIntrouvable texte="Ce site n’existe pas, ou il n’est pas rattaché à votre compte." />
        )
      }
    </Etat>
  );
}

function ContenuFiche({
  site,
  interventions,
  documents,
  fichiers,
}: {
  site: Site;
  interventions: Intervention[];
  documents: Fichier[];
  fichiers: Fichier[];
}) {
  const aujourdhui = aujourdhuiParis();
  const visibles = interventions.filter((i) => i.statut !== 'annulee');

  return (
    <>
      <div className="fil-ariane">
        <Link to="/sites">Mes sites</Link> › {site.nom}
      </div>
      <div className="titre-page">
        <div>
          <h1>{site.nom}</h1>
          <p>
            {LIBELLE_INSTALLATION[site.type_installation]}
            {site.commune && <> · {site.commune}</>}
            {site.departement && <> ({site.departement})</>}
          </p>
        </div>
      </div>

      <div className="grille grille-2" style={{ alignItems: 'start' }}>
        <div className="pile">
          <section className="carte" aria-labelledby="titre-infos">
            <h2 id="titre-infos">Informations</h2>
            <dl className="infos">
              {site.code_interne && (
                <>
                  <dt>Code interne</dt>
                  <dd>{site.code_interne}</dd>
                </>
              )}
              <dt>Type d’installation</dt>
              <dd>{LIBELLE_INSTALLATION[site.type_installation]}</dd>
              <dt>Commune</dt>
              <dd>
                {site.commune ?? '–'}
                {site.departement && ` (${site.departement})`}
              </dd>
              <dt>Surface de modules</dt>
              <dd className="nombre">{formaterM2(site.surface_modules_m2) || '–'}</dd>
              <dt>Surface de végétation</dt>
              <dd className="nombre">{formaterHa(site.surface_vegetation_ha) || '–'}</dd>
              <dt>Soumis aux OLD</dt>
              <dd>
                {site.soumis_old ? 'Oui' : 'Non'}
                {site.soumis_old && site.date_limite_old && ` – date limite le ${formaterDate(site.date_limite_old)}`}
              </dd>
            </dl>
          </section>

          <section className="carte" aria-labelledby="titre-documents">
            <h2 id="titre-documents">Documents du site</h2>
            {documents.length === 0 ? (
              <p className="vide">Aucun document pour ce site.</p>
            ) : (
              <ul className="liste">
                {documents.map((d) => (
                  <li key={d.id} className="ligne">
                    <span>{d.nom}</span>
                    <BoutonFichier fichier={d} libelle="Ouvrir" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="carte" aria-labelledby="titre-historique">
          <h2 id="titre-historique">Historique des interventions</h2>
          {visibles.length === 0 ? (
            <p className="vide">Aucune intervention pour ce site.</p>
          ) : (
            <ol className="frise">
              {visibles.map((i) => {
                const rapport = fichiers.find((f) => f.intervention_id === i.id && f.type === 'rapport');
                const aVenir = i.statut !== 'realisee' && dateTri(i) >= aujourdhui;
                return (
                  <li key={i.id} className={i.statut === 'realisee' ? 'frise-realisee' : aVenir ? 'frise-a-venir' : ''}>
                    <div className="ligne">
                      <div>
                        <Link to={`/interventions/${i.id}`}>
                          <strong>{libelleIntervention(i)}</strong>
                        </Link>
                        <div className="secondaire">{dateIntervention(i)}</div>
                        {i.publiee && (
                          <div className="secondaire nombre">
                            {[formaterM2(i.surface_m2), formaterHa(i.surface_ha)].filter(Boolean).join(' · ')}
                            {i.panneaux_casses ? ` · ${pluriel(i.panneaux_casses, 'panneau cassé', 'panneaux cassés')}` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'end' }}>
                        <BadgeStatut statut={i.statut} />
                        {rapport && <BoutonFichier fichier={rapport} libelle="Rapport" />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
