import { NavLink, Link, Outlet, useLocation } from 'react-router';
import { useConnexion } from '../lib/auth';
import { Logo } from './Communs';

/** Cadre commun à tous les écrans connectés : en-tête, navigation, pied de page. */
export function MiseEnPage() {
  const { profil, session, deconnexion } = useConnexion();
  const emplacement = useLocation();
  const estAdmin = profil?.role === 'admin';
  const dansAdministration = emplacement.pathname.startsWith('/admin');

  return (
    <>
      <header className={`entete${estAdmin ? ' entete-admin' : ''}`}>
        <div className="entete-haut">
          <div>
            <Logo vers={estAdmin ? '/admin' : '/'} />
            <span className="entete-sous-titre">{estAdmin ? 'Administration' : 'Espace client'}</span>
          </div>
          <div className="entete-utilisateur">
            <span>{profil?.nom ?? session?.user.email}</span>
            <button type="button" className="bouton bouton-discret" onClick={deconnexion}>
              Se déconnecter
            </button>
          </div>
        </div>
        <nav className="navigation" aria-label="Navigation principale">
          {estAdmin ? (
            <>
              <NavLink to="/admin" end>
                Tableau de bord
              </NavLink>
              <NavLink to="/admin/clients">Clients</NavLink>
              <NavLink to="/admin/sites">Sites</NavLink>
              <NavLink to="/admin/interventions">Interventions</NavLink>
              <NavLink to="/admin/demandes">Demandes</NavLink>
              <NavLink to="/vue-client">Vue client</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end>
                Tableau de bord
              </NavLink>
              <NavLink to="/sites">Mes sites</NavLink>
              <NavLink to="/planning">Planning</NavLink>
              <NavLink to="/demandes">Demandes</NavLink>
              <NavLink to="/compte">Mon compte</NavLink>
            </>
          )}
        </nav>
      </header>

      <main className="contenu" id="contenu">
        {estAdmin && !dansAdministration && (
          <div className="alerte alerte-info" style={{ marginBottom: '1.25rem' }}>
            <p>
              <strong>Vue client.</strong> Ces écrans sont ceux des clients, mais vous y voyez les données de tous les
              clients. <Link to="/admin">Revenir à l’administration</Link>
            </p>
          </div>
        )}
        <Outlet />
      </main>

      <PiedDePage />
    </>
  );
}

export function PiedDePage() {
  return (
    <footer className="pied">
      <span>© {new Date().getFullYear()} ACG NET SPE – Nettoyage et débroussaillage de centrales photovoltaïques</span>
      <Link to="/mentions-legales">Mentions légales et confidentialité</Link>
    </footer>
  );
}
