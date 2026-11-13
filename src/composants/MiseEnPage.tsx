import { NavLink, Link, Outlet } from 'react-router';
import { useConnexion } from '../lib/auth';
import { Logo } from './Communs';

/** Cadre commun à tous les écrans connectés : en-tête, navigation, pied de page. */
export function MiseEnPage() {
  const { profil, session, deconnexion } = useConnexion();

  return (
    <>
      <header className="entete">
        <div className="entete-haut">
          <div>
            <Logo />
            <span className="entete-sous-titre">Espace client</span>
          </div>
          <div className="entete-utilisateur">
            <span>{profil?.nom ?? session?.user.email}</span>
            <button type="button" className="bouton bouton-discret" onClick={deconnexion}>
              Se déconnecter
            </button>
          </div>
        </div>
        <nav className="navigation" aria-label="Navigation principale">
          <NavLink to="/" end>
            Tableau de bord
          </NavLink>
          <NavLink to="/sites">Mes sites</NavLink>
          <NavLink to="/planning">Planning</NavLink>
          <NavLink to="/compte">Mon compte</NavLink>
        </nav>
      </header>

      <main className="contenu" id="contenu">
        {profil?.role === 'admin' && (
          <div className="alerte alerte-info" style={{ marginBottom: '1.25rem' }}>
            <p>
              <strong>Vous êtes connecté en tant qu’administrateur ACG NET SPE.</strong> Vous voyez ces écrans tels qu’un
              client les voit, mais avec les données de tous les clients. Les écrans d’administration arrivent à l’étape
              suivante.
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
