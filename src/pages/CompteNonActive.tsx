import { useConnexion } from '../lib/auth';
import { Logo } from '../composants/Communs';
import { PiedDePage } from '../composants/MiseEnPage';

/** Connecté, mais le compte n'est rattaché à aucun profil (invitation incomplète). */
export function CompteNonActive() {
  const { session, deconnexion } = useConnexion();
  return (
    <div className="ecran-connexion">
      <header className="entete">
        <div className="entete-haut">
          <Logo vers="/connexion" />
        </div>
      </header>
      <main className="boite-connexion">
        <div className="carte">
          <h1>Compte en cours d’activation</h1>
          <p>
            Vous êtes bien connecté avec l’adresse <strong>{session?.user.email}</strong>, mais votre accès n’est pas
            encore rattaché à une organisation.
          </p>
          <p>Contactez votre interlocuteur ACG NET SPE pour finaliser l’activation.</p>
          <button type="button" className="bouton bouton-secondaire" onClick={deconnexion}>
            Se déconnecter
          </button>
        </div>
      </main>
      <PiedDePage />
    </div>
  );
}
