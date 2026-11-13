import { Link } from 'react-router';
import { Logo } from '../composants/Communs';
import { PiedDePage } from '../composants/MiseEnPage';

/**
 * PROJET de page « Mentions légales et confidentialité ».
 * Les passages entre crochets sont à compléter, et le texte entier est à faire
 * valider (cahier des charges §10, question 8) avant la mise en service.
 */
export function MentionsLegales() {
  return (
    <>
      <header className="entete">
        <div className="entete-haut">
          <Logo />
          <span className="entete-sous-titre">Espace client</span>
        </div>
      </header>
      <main className="contenu" style={{ maxWidth: '760px' }}>
        <div className="fil-ariane">
          <Link to="/">Retour à l’espace client</Link>
        </div>
        <h1>Mentions légales et confidentialité</h1>

        <div className="alerte alerte-attention" style={{ margin: '1rem 0 1.5rem' }}>
          <p>
            <strong>Projet de texte.</strong> Les éléments entre crochets sont à compléter, et l’ensemble est à valider
            avant l’ouverture aux clients.
          </p>
        </div>

        <div className="carte pile">
          <section>
            <h2>Éditeur du site</h2>
            <p>
              ACG NET SPE – [forme juridique, capital], [adresse du siège], SIRET [numéro]. Directeur de la publication :
              [nom]. Contact : [adresse e-mail de contact].
            </p>
          </section>

          <section>
            <h2>Hébergement</h2>
            <p>
              Les données de l’espace client (comptes, sites, interventions, rapports) sont hébergées par Supabase, dans
              un centre de données situé à Paris (France, Union européenne). L’interface du site est servie par Netlify,
              Inc. [adresse à compléter].
            </p>
          </section>

          <section>
            <h2>Données personnelles</h2>
            <p>
              L’espace client conserve uniquement, pour chaque contact : le nom, la fonction, l’adresse e-mail et le
              numéro de téléphone professionnels. Ces données servent exclusivement à donner accès à l’espace client et
              à informer les contacts des interventions réalisées sur leurs sites. Elles ne sont ni vendues ni cédées.
            </p>
            <p>
              Chaque contact peut demander l’accès à ses données, leur correction ou la suppression de son compte en
              écrivant à [adresse e-mail de contact]. Il peut aussi adresser une réclamation à la CNIL (cnil.fr).
            </p>
            <p>Durée de conservation : [à définir, par exemple durée du contrat puis 3 ans].</p>
          </section>

          <section>
            <h2>Cookies et stockage local</h2>
            <p>
              Le site n’utilise ni cookie publicitaire ni outil de mesure d’audience. Il conserve seulement, dans le
              navigateur, les informations techniques nécessaires pour rester connecté. Aucun consentement n’est donc
              requis.
            </p>
          </section>

          <section>
            <h2>Confidentialité des documents</h2>
            <p>
              Chaque client n’a accès qu’aux sites, interventions et documents de son organisation. Les fichiers sont
              stockés de façon privée et ne sont accessibles que par des liens personnels valables une heure.
            </p>
          </section>
        </div>
      </main>
      <PiedDePage />
    </>
  );
}
