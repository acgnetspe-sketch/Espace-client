import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { chargerProchainsPassagesParSite, chargerSites } from '../lib/requetes';
import { useChargement } from '../lib/useChargement';
import { formaterHa, formaterM2, formaterPeriode, pluriel } from '../lib/formats';
import { LIBELLE_INSTALLATION, LIBELLE_INTERVENTION } from '../lib/libelles';
import { BadgeStatut, Etat } from '../composants/Communs';
import type { ProchainPassage, Site, TypeInstallation } from '../lib/types';

async function chargerListe() {
  const [sites, passages] = await Promise.all([chargerSites(), chargerProchainsPassagesParSite()]);
  return { sites, passages: new Map(passages.map((p) => [p.site_id, p])) };
}

export function Sites() {
  const etat = useChargement(chargerListe, []);
  return (
    <>
      <div className="titre-page">
        <h1>Mes sites</h1>
      </div>
      <Etat etat={etat}>{({ sites, passages }) => <ListeSites sites={sites} passages={passages} />}</Etat>
    </>
  );
}

function ListeSites({ sites, passages }: { sites: Site[]; passages: Map<string, ProchainPassage> }) {
  const [type, setType] = useState<TypeInstallation | ''>('');
  const [departement, setDepartement] = useState('');
  const [recherche, setRecherche] = useState('');

  const types = useMemo(() => [...new Set(sites.map((s) => s.type_installation))], [sites]);
  const departements = useMemo(
    () => [...new Set(sites.map((s) => s.departement).filter((d): d is string => Boolean(d)))].sort(),
    [sites],
  );

  const texte = recherche.trim().toLowerCase();
  const filtres = sites.filter(
    (s) =>
      (!type || s.type_installation === type) &&
      (!departement || s.departement === departement) &&
      (!texte || [s.nom, s.commune, s.code_interne].some((v) => v?.toLowerCase().includes(texte))),
  );

  if (sites.length === 0) {
    return <p className="vide">Aucun site n’est encore rattaché à votre compte.</p>;
  }

  return (
    <>
      <div className="filtres">
        <div>
          <label htmlFor="filtre-recherche">Rechercher</label>
          <input
            id="filtre-recherche"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, commune, code"
          />
        </div>
        <div>
          <label htmlFor="filtre-type">Type d’installation</label>
          <select id="filtre-type" value={type} onChange={(e) => setType(e.target.value as TypeInstallation | '')}>
            <option value="">Tous les types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_INSTALLATION[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtre-departement">Département</label>
          <select id="filtre-departement" value={departement} onChange={(e) => setDepartement(e.target.value)}>
            <option value="">Tous les départements</option>
            {departements.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="secondaire" aria-live="polite">
        {pluriel(filtres.length, 'site affiché', 'sites affichés')} sur {sites.length}
      </p>

      {filtres.length === 0 ? (
        <p className="vide">Aucun site ne correspond à ces filtres.</p>
      ) : (
        <div className="grille grille-cartes">
          {filtres.map((site) => (
            <CarteSite key={site.id} site={site} passage={passages.get(site.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function CarteSite({ site, passage }: { site: Site; passage?: ProchainPassage }) {
  return (
    <Link to={`/sites/${site.id}`} className="carte carte-lien">
      <h3>{site.nom}</h3>
      <p className="secondaire">
        {LIBELLE_INSTALLATION[site.type_installation]}
        {site.commune && <> · {site.commune}</>}
        {site.departement && <> ({site.departement})</>}
      </p>
      <p className="secondaire nombre">
        {[formaterM2(site.surface_modules_m2), formaterHa(site.surface_vegetation_ha)].filter(Boolean).join(' · ')}
      </p>
      <div style={{ borderTop: '1px solid var(--bordure)', paddingTop: '0.65rem', marginTop: '0.65rem' }}>
        <div className="secondaire">Prochain passage</div>
        {passage?.intervention_id && passage.type && passage.statut ? (
          <div className="ligne">
            <span>
              {LIBELLE_INTERVENTION[passage.type]}, {formaterPeriode(passage.debut_prevu, passage.fin_prevue)}
            </span>
            <BadgeStatut statut={passage.statut} />
          </div>
        ) : (
          <span className="badge badge-neutre">À planifier</span>
        )}
      </div>
    </Link>
  );
}
