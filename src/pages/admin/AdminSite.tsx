import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  creerSite,
  listerInterventionsAdmin,
  listerOrganisations,
  lireSiteAdmin,
  modifierSite,
  supprimerSite,
  type DonneesSite,
} from '../../lib/admin';
import { useChargement } from '../../lib/useChargement';
import { formaterPeriode } from '../../lib/formats';
import { LIBELLE_INSTALLATION, LIBELLE_INTERVENTION } from '../../lib/libelles';
import { BadgeStatut, Etat, PageIntrouvable } from '../../composants/Communs';
import { AfficherMessage, Champ, nombreOuNul, nulSiVide, useAction, versChamp } from '../../composants/Formulaire';
import { GestionFichiers } from '../../composants/GestionFichiers';
import type { Organisation, Site, TypeInstallation } from '../../lib/types';

async function chargerSite(id: string | null) {
  const [organisations, site, interventions] = await Promise.all([
    listerOrganisations(),
    id ? lireSiteAdmin(id) : Promise.resolve(null),
    id ? listerInterventionsAdmin() : Promise.resolve([]),
  ]);
  return { organisations, site, interventions: interventions.filter((i) => i.site_id === id) };
}

export function AdminSite() {
  const { id } = useParams();
  const estNouveau = !id || id === 'nouveau';
  const etat = useChargement(() => chargerSite(estNouveau ? null : id), [id]);
  return (
    <Etat etat={etat}>
      {(d) =>
        !estNouveau && !d.site ? (
          <PageIntrouvable texte="Ce site n’existe pas." />
        ) : (
          <FormulaireSite key={d.site?.id ?? 'nouveau'} {...d} recharger={etat.recharger} />
        )
      }
    </Etat>
  );
}

type Champs = Record<
  | 'organisation_id'
  | 'nom'
  | 'code_interne'
  | 'commune'
  | 'departement'
  | 'surface_modules_m2'
  | 'surface_vegetation_ha'
  | 'date_limite_old'
  | 'latitude'
  | 'longitude',
  string
> & { type_installation: TypeInstallation; soumis_old: boolean };

function versChamps(site: Site | null, organisationParDefaut: string): Champs {
  return {
    organisation_id: site?.organisation_id ?? organisationParDefaut,
    nom: site?.nom ?? '',
    code_interne: site?.code_interne ?? '',
    commune: site?.commune ?? '',
    departement: site?.departement ?? '',
    type_installation: site?.type_installation ?? 'sol',
    surface_modules_m2: versChamp(site?.surface_modules_m2),
    surface_vegetation_ha: versChamp(site?.surface_vegetation_ha),
    soumis_old: site?.soumis_old ?? false,
    date_limite_old: site?.date_limite_old ?? '',
    latitude: versChamp(site?.latitude),
    longitude: versChamp(site?.longitude),
  };
}

function FormulaireSite({
  organisations,
  site,
  interventions,
  recharger,
}: Awaited<ReturnType<typeof chargerSite>> & { organisations: Organisation[]; recharger: () => void }) {
  const navigation = useNavigate();
  const [parametres] = useSearchParams();
  const action = useAction();
  const [c, setC] = useState<Champs>(() => versChamps(site, parametres.get('organisation') ?? ''));
  const maj = (cle: keyof Champs) => (e: { target: { value: string } }) => setC({ ...c, [cle]: e.target.value });

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const donnees: DonneesSite = {
      organisation_id: c.organisation_id,
      nom: c.nom.trim(),
      code_interne: nulSiVide(c.code_interne),
      commune: nulSiVide(c.commune),
      departement: nulSiVide(/^\d$/.test(c.departement.trim()) ? `0${c.departement.trim()}` : c.departement.toUpperCase()),
      type_installation: c.type_installation,
      surface_modules_m2: nombreOuNul(c.surface_modules_m2),
      surface_vegetation_ha: nombreOuNul(c.surface_vegetation_ha),
      soumis_old: c.soumis_old,
      date_limite_old: c.soumis_old ? nulSiVide(c.date_limite_old) : null,
      latitude: nombreOuNul(c.latitude),
      longitude: nombreOuNul(c.longitude),
    };
    if (site) {
      const { organisation_id: _ignore, ...modifiable } = donnees;
      const { ok } = await action.executer(() => modifierSite(site.id, modifiable), 'Site enregistré.');
      if (ok) recharger();
    } else {
      const { resultat: cree } = await action.executer(() => creerSite(donnees));
      if (cree) navigation(`/admin/sites/${cree.id}`, { replace: true });
    }
  }

  const client = organisations.find((o) => o.id === c.organisation_id);

  return (
    <>
      <div className="fil-ariane">
        <Link to="/admin/sites">Sites</Link> › {site ? site.nom : 'Nouveau site'}
      </div>
      <div className="titre-page">
        <div>
          <h1>{site ? site.nom : 'Nouveau site'}</h1>
          {client && site && (
            <p>
              <Link to={`/admin/clients/${client.id}`}>{client.nom}</Link>
            </p>
          )}
        </div>
        {site && (
          <div className="actions" style={{ marginTop: 0 }}>
            <Link to={`/sites/${site.id}`} className="bouton bouton-secondaire">
              Voir comme le client
            </Link>
            <Link to={`/admin/interventions/nouvelle?site=${site.id}`} className="bouton">
              Planifier une intervention
            </Link>
          </div>
        )}
      </div>

      <div className="grille grille-2" style={{ alignItems: 'start' }}>
        <section className="carte">
          <h2>Informations</h2>
          <form onSubmit={enregistrer}>
            <div className="formulaire">
              <div className="pleine-largeur">
                <Champ
                  id="site-client"
                  libelle="Client"
                  obligatoire
                  aide={site ? 'Le client d’un site ne peut pas être changé après sa création.' : undefined}
                >
                  <select id="site-client" required disabled={Boolean(site)} value={c.organisation_id} onChange={maj('organisation_id')}>
                    <option value="">Choisir…</option>
                    {organisations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nom}
                      </option>
                    ))}
                  </select>
                </Champ>
              </div>
              <Champ id="site-nom" libelle="Nom du site" obligatoire>
                <input id="site-nom" required value={c.nom} onChange={maj('nom')} />
              </Champ>
              <Champ id="site-code" libelle="Code interne">
                <input id="site-code" value={c.code_interne} onChange={maj('code_interne')} />
              </Champ>
              <Champ id="site-type" libelle="Type d’installation" obligatoire>
                <select
                  id="site-type"
                  value={c.type_installation}
                  onChange={(e) => setC({ ...c, type_installation: e.target.value as TypeInstallation })}
                >
                  {Object.entries(LIBELLE_INSTALLATION).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ id="site-commune" libelle="Commune">
                <input id="site-commune" value={c.commune} onChange={maj('commune')} />
              </Champ>
              <Champ id="site-departement" libelle="Département" aide="Exemples : 13, 06, 2A, 974">
                <input id="site-departement" value={c.departement} maxLength={3} onChange={maj('departement')} />
              </Champ>
              <Champ id="site-m2" libelle="Surface de modules (m²)">
                <input id="site-m2" inputMode="decimal" value={c.surface_modules_m2} onChange={maj('surface_modules_m2')} />
              </Champ>
              <Champ id="site-ha" libelle="Surface de végétation (ha)">
                <input id="site-ha" inputMode="decimal" value={c.surface_vegetation_ha} onChange={maj('surface_vegetation_ha')} />
              </Champ>
              <Champ id="site-lat" libelle="Latitude" aide="Exemple : 43,64">
                <input id="site-lat" inputMode="decimal" value={c.latitude} onChange={maj('latitude')} />
              </Champ>
              <Champ id="site-lon" libelle="Longitude" aide="Exemple : 4,81">
                <input id="site-lon" inputMode="decimal" value={c.longitude} onChange={maj('longitude')} />
              </Champ>
              <div className="pleine-largeur">
                <label className="case" htmlFor="site-old">
                  <input
                    id="site-old"
                    type="checkbox"
                    checked={c.soumis_old}
                    onChange={(e) => setC({ ...c, soumis_old: e.target.checked })}
                  />
                  Soumis aux obligations légales de débroussaillement (OLD)
                </label>
              </div>
              {c.soumis_old && (
                <Champ id="site-date-old" libelle="Date limite OLD" aide="L’alerte apparaît 60 jours avant.">
                  <input id="site-date-old" type="date" value={c.date_limite_old} onChange={maj('date_limite_old')} />
                </Champ>
              )}
            </div>
            <div className="actions">
              <button type="submit" className="bouton" disabled={action.enCours}>
                {site ? 'Enregistrer' : 'Créer le site'}
              </button>
              {site && interventions.length === 0 && (
                <button
                  type="button"
                  className="bouton bouton-danger"
                  onClick={async () => {
                    if (!window.confirm(`Supprimer définitivement le site « ${site.nom} » ?`)) return;
                    const { ok } = await action.executer(() => supprimerSite(site.id));
                    if (ok) navigation('/admin/sites');
                  }}
                >
                  Supprimer le site
                </button>
              )}
            </div>
            <AfficherMessage message={action.message} />
          </form>
        </section>

        {site && (
          <div className="pile">
            <section className="carte">
              <h2>Interventions</h2>
              {interventions.length === 0 ? (
                <p className="vide">Aucune intervention.</p>
              ) : (
                <ul className="liste">
                  {interventions.map((i) => (
                    <li key={i.id} className="ligne">
                      <div>
                        <Link to={`/admin/interventions/${i.id}`}>{LIBELLE_INTERVENTION[i.type]}</Link>
                        <div className="secondaire">
                          {formaterPeriode(i.debut_reel ?? i.debut_prevu, i.fin_reelle ?? i.fin_prevue)}
                        </div>
                      </div>
                      <BadgeStatut statut={i.statut} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="carte">
              <h2>Documents du site</h2>
              <p className="aide" style={{ marginTop: 0 }}>
                Plans, attestations… Visibles immédiatement par les contacts du client qui ont accès à ce site.
              </p>
              <GestionFichiers
                cible={{ site_id: site.id }}
                organisationId={site.organisation_id}
                siteId={site.id}
                typesProposes={['document']}
              />
            </section>
          </div>
        )}
      </div>
    </>
  );
}
