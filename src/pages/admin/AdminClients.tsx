import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { creerOrganisation, listerEtatComptes, listerOrganisations, listerProfils, listerSitesAdmin } from '../../lib/admin';
import { useChargement } from '../../lib/useChargement';
import { Etat } from '../../composants/Communs';
import { AfficherMessage, Champ, nulSiVide, useAction } from '../../composants/Formulaire';
import { FormulaireInvitation, LigneEtatCompte } from './Contacts';

async function chargerClients() {
  const [organisations, sites, profils, etats] = await Promise.all([
    listerOrganisations(),
    listerSitesAdmin(),
    listerProfils(),
    listerEtatComptes(),
  ]);
  return {
    organisations: organisations.map((o) => ({
      ...o,
      nombreSites: sites.filter((s) => s.organisation_id === o.id).length,
      nombreContacts: profils.filter((p) => p.organisation_id === o.id).length,
    })),
    administrateurs: profils.filter((p) => p.role === 'admin'),
    etats,
  };
}

export function AdminClients() {
  const etat = useChargement(chargerClients, []);
  const navigation = useNavigate();
  const action = useAction();
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');

  async function creer(e: FormEvent) {
    e.preventDefault();
    const { resultat: organisation } = await action.executer(() => creerOrganisation(nom.trim(), nulSiVide(adresse)));
    if (organisation) navigation(`/admin/clients/${organisation.id}`);
  }

  return (
    <>
      <div className="titre-page">
        <h1>Clients</h1>
      </div>
      <Etat etat={etat}>
        {({ organisations, administrateurs, etats }) => (
          <div className="pile">
            <div className="tableau-conteneur">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Sites</th>
                    <th>Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {organisations.length === 0 && (
                    <tr>
                      <td colSpan={3} className="vide">
                        Aucun client pour le moment.
                      </td>
                    </tr>
                  )}
                  {organisations.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/admin/clients/${o.id}`}>
                          <strong>{o.nom}</strong>
                        </Link>
                        {o.adresse && <div className="secondaire">{o.adresse}</div>}
                      </td>
                      <td className="nombre">{o.nombreSites}</td>
                      <td className="nombre">{o.nombreContacts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grille grille-2" style={{ alignItems: 'start' }}>
              <section className="carte" aria-labelledby="titre-nouveau">
                <h2 id="titre-nouveau">Nouveau client</h2>
                <form onSubmit={creer}>
                  <div className="formulaire">
                    <Champ id="org-nom" libelle="Nom de l’organisation" obligatoire>
                      <input id="org-nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
                    </Champ>
                    <Champ id="org-adresse" libelle="Adresse">
                      <input id="org-adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
                    </Champ>
                  </div>
                  <div className="actions">
                    <button type="submit" className="bouton" disabled={action.enCours}>
                      Créer le client
                    </button>
                  </div>
                  <AfficherMessage message={action.message} />
                </form>
              </section>

              <section className="carte" aria-labelledby="titre-equipe">
                <h2 id="titre-equipe">Équipe ACG NET SPE (administrateurs)</h2>
                <ul className="liste">
                  {administrateurs.map((p) => (
                    <li key={p.id}>
                      <strong>{p.nom}</strong>
                      <div className="secondaire">{p.email}</div>
                      <LigneEtatCompte etat={etats.get(p.id)} />
                    </li>
                  ))}
                </ul>
                <details style={{ marginTop: '1rem' }}>
                  <summary className="bouton bouton-secondaire bouton-petit">Inviter un administrateur</summary>
                  <div style={{ marginTop: '1rem' }}>
                    <p className="secondaire">
                      Un administrateur voit et modifie les données de tous les clients. N’inviter que des membres de
                      l’équipe ACG NET SPE.
                    </p>
                    <FormulaireInvitation role="admin" organisationId={null} sites={[]} surInvitation={etat.recharger} />
                  </div>
                </details>
              </section>
            </div>
          </div>
        )}
      </Etat>
    </>
  );
}
