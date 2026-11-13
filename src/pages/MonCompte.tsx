import { useConnexion } from '../lib/auth';
import { chargerMembresOrganisation, chargerMesLimitations, chargerOrganisation, chargerSites } from '../lib/requetes';
import { useChargement } from '../lib/useChargement';
import { Etat } from '../composants/Communs';
import type { Profil } from '../lib/types';

async function chargerCompte(profil: Profil) {
  if (!profil.organisation_id) return { organisation: null, membres: [] as Profil[], sitesLimites: [] as string[] };
  const [organisation, membres, limitations, sites] = await Promise.all([
    chargerOrganisation(profil.organisation_id),
    chargerMembresOrganisation(profil.organisation_id),
    chargerMesLimitations(profil.id),
    chargerSites(),
  ]);
  const nomsSites = new Map(sites.map((s) => [s.id, s.nom]));
  return { organisation, membres, sitesLimites: limitations.map((id) => nomsSites.get(id) ?? id) };
}

export function MonCompte() {
  const { profil, session } = useConnexion();
  const etat = useChargement(() => chargerCompte(profil!), [profil?.id]);
  if (!profil) return null;

  return (
    <>
      <div className="titre-page">
        <h1>Mon compte</h1>
      </div>
      <Etat etat={etat}>
        {({ organisation, membres, sitesLimites }) => (
          <div className="grille grille-2" style={{ alignItems: 'start' }}>
            <section className="carte" aria-labelledby="titre-moi">
              <h2 id="titre-moi">Mes informations</h2>
              <dl className="infos">
                <dt>Nom</dt>
                <dd>{profil.nom}</dd>
                {profil.fonction && (
                  <>
                    <dt>Fonction</dt>
                    <dd>{profil.fonction}</dd>
                  </>
                )}
                <dt>E-mail</dt>
                <dd>{session?.user.email ?? profil.email}</dd>
                {profil.telephone && (
                  <>
                    <dt>Téléphone</dt>
                    <dd>{profil.telephone}</dd>
                  </>
                )}
                <dt>Organisation</dt>
                <dd>{organisation?.nom ?? (profil.role === 'admin' ? 'ACG NET SPE (administrateur)' : '–')}</dd>
                {profil.role === 'client' && (
                  <>
                    <dt>Sites accessibles</dt>
                    <dd>{sitesLimites.length === 0 ? 'Tous les sites de l’organisation' : sitesLimites.join(', ')}</dd>
                  </>
                )}
              </dl>
              <p className="secondaire" style={{ marginTop: '1rem', marginBottom: 0 }}>
                Pour corriger ces informations ou supprimer votre compte, contactez votre interlocuteur ACG NET SPE.
              </p>
            </section>

            {profil.role === 'client' && (
              <section className="carte" aria-labelledby="titre-membres">
                <h2 id="titre-membres">Utilisateurs de mon organisation</h2>
                <ul className="liste">
                  {membres.map((m) => (
                    <li key={m.id}>
                      <strong>{m.nom}</strong>
                      {m.id === profil.id && <span className="secondaire"> (vous)</span>}
                      <div className="secondaire">{[m.fonction, m.email].filter(Boolean).join(' · ')}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Etat>
    </>
  );
}
