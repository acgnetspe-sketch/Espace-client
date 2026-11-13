import { Link } from 'react-router';
import { listerEmails, type EmailJournal } from '../../lib/admin';
import { useChargement } from '../../lib/useChargement';
import { formaterHorodatage } from '../../lib/formats';
import { Etat } from '../../composants/Communs';

const TYPES: Record<EmailJournal['type'], string> = {
  rapport_publie: 'Rapport publié',
  rappel_passage: 'Rappel J-7',
  reponse_demande: 'Réponse à une demande',
  nouvelle_demande: 'Nouvelle demande (ACG)',
};

const heure = (horodatage: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(horodatage));

function Etat_({ email }: { email: EmailJournal }) {
  if (email.envoye_le) return <span className="badge badge-publiee">Envoyé {formaterHorodatage(email.envoye_le)} {heure(email.envoye_le)}</span>;
  if (email.tentatives >= 5) return <span className="badge badge-annulee" style={{ textDecoration: 'none', color: 'var(--rouge)' }}>Abandonné</span>;
  if (email.derniere_erreur) return <span className="badge badge-a-publier">Nouvel essai prévu</span>;
  return <span className="badge badge-proposee">En attente</span>;
}

/** Journal des e-mails automatiques (200 derniers). */
export function AdminEmails() {
  const etat = useChargement(listerEmails, []);
  return (
    <>
      <div className="fil-ariane">
        <Link to="/admin">Tableau de bord</Link> › E-mails automatiques
      </div>
      <div className="titre-page">
        <div>
          <h1>E-mails automatiques</h1>
          <p>Les e-mails partent toutes les 5 minutes. Un envoi raté est retenté jusqu’à 5 fois.</p>
        </div>
        <button type="button" className="bouton bouton-secondaire" onClick={etat.recharger}>
          Actualiser
        </button>
      </div>
      <Etat etat={etat}>
        {(emails) => (
          <div className="tableau-conteneur">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Créé le</th>
                  <th>Type</th>
                  <th>Destinataire</th>
                  <th>Concerne</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {emails.length === 0 && (
                  <tr>
                    <td colSpan={5} className="vide">
                      Aucun e-mail pour le moment.
                    </td>
                  </tr>
                )}
                {emails.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">
                      {formaterHorodatage(e.cree_le)} {heure(e.cree_le)}
                    </td>
                    <td className="nowrap">{TYPES[e.type]}</td>
                    <td>
                      {e.nom_destinataire && <div>{e.nom_destinataire}</div>}
                      <div className="secondaire">{e.destinataire}</div>
                    </td>
                    <td>{String(e.donnees.site_nom ?? e.donnees.organisation_nom ?? '')}</td>
                    <td>
                      <Etat_ email={e} />
                      {e.derniere_erreur && !e.envoye_le && (
                        <div className="secondaire" style={{ maxWidth: 280, overflowWrap: 'anywhere' }}>
                          {e.derniere_erreur}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Etat>
    </>
  );
}
