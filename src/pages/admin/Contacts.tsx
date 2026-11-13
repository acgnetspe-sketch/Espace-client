import { useState, type FormEvent } from 'react';
import {
  definirAccesSites,
  inviterContact,
  modifierProfil,
  renvoyerInvitation,
  supprimerContact,
  type EtatCompte,
} from '../../lib/admin';
import { formaterHorodatage } from '../../lib/formats';
import { AfficherMessage, Champ, nulSiVide, useAction } from '../../composants/Formulaire';
import type { Profil, Site } from '../../lib/types';

/** « Invitation envoyée le… », « Dernière connexion le… ». */
export function LigneEtatCompte({ etat }: { etat?: EtatCompte }) {
  if (!etat) return null;
  if (etat.derniere_connexion) {
    return <div className="secondaire">Dernière connexion le {formaterHorodatage(etat.derniere_connexion)}</div>;
  }
  if (etat.invite_le && !etat.active_le) {
    return (
      <div className="secondaire">
        <span className="badge badge-a-publier">Invitation en attente</span> envoyée le {formaterHorodatage(etat.invite_le)}
      </div>
    );
  }
  return <div className="secondaire">Jamais connecté</div>;
}

/** Cases à cocher des sites ; aucune case cochée = accès à tous les sites. */
function ChoixSites({
  id,
  sites,
  choisis,
  surChangement,
}: {
  id: string;
  sites: Site[];
  choisis: string[];
  surChangement: (ids: string[]) => void;
}) {
  if (sites.length === 0) return <p className="aide">Ce client n’a pas encore de site.</p>;
  return (
    <fieldset>
      <legend>Accès aux sites</legend>
      <p className="aide" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
        Aucune case cochée : accès à <strong>tous</strong> les sites du client, y compris ceux ajoutés plus tard.
      </p>
      <div className="cases">
        {sites.map((s) => (
          <label key={s.id} className="case" htmlFor={`${id}-${s.id}`}>
            <input
              id={`${id}-${s.id}`}
              type="checkbox"
              checked={choisis.includes(s.id)}
              onChange={(e) => surChangement(e.target.checked ? [...choisis, s.id] : choisis.filter((x) => x !== s.id))}
            />
            {s.nom}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FormulaireInvitation({
  role,
  organisationId,
  sites,
  surInvitation,
}: {
  role: 'client' | 'admin';
  organisationId: string | null;
  sites: Site[];
  surInvitation: () => void;
}) {
  const action = useAction();
  const vide = { email: '', nom: '', fonction: '', telephone: '' };
  const [champs, setChamps] = useState(vide);
  const [sitesChoisis, setSitesChoisis] = useState<string[]>([]);
  const prefixe = `invitation-${role}`;

  async function inviter(e: FormEvent) {
    e.preventDefault();
    const { ok } = await action.executer(
      () =>
        inviterContact({
          email: champs.email.trim().toLowerCase(),
          nom: champs.nom.trim(),
          fonction: nulSiVide(champs.fonction),
          telephone: nulSiVide(champs.telephone),
          role,
          organisation_id: organisationId,
          sites: sitesChoisis,
        }),
      (message) => message,
    );
    if (ok) {
      setChamps(vide);
      setSitesChoisis([]);
      surInvitation();
    }
  }

  const champ = (cle: keyof typeof vide) => ({
    id: `${prefixe}-${cle}`,
    value: champs[cle],
    onChange: (e: { target: { value: string } }) => setChamps({ ...champs, [cle]: e.target.value }),
  });

  return (
    <form onSubmit={inviter}>
      <div className="formulaire">
        <Champ id={`${prefixe}-email`} libelle="Adresse e-mail" obligatoire>
          <input {...champ('email')} type="email" required autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Champ>
        <Champ id={`${prefixe}-nom`} libelle="Prénom et nom" obligatoire>
          <input {...champ('nom')} required />
        </Champ>
        <Champ id={`${prefixe}-fonction`} libelle="Fonction">
          <input {...champ('fonction')} />
        </Champ>
        <Champ id={`${prefixe}-telephone`} libelle="Téléphone">
          <input {...champ('telephone')} type="tel" />
        </Champ>
        {role === 'client' && (
          <div className="pleine-largeur">
            <ChoixSites id={prefixe} sites={sites} choisis={sitesChoisis} surChangement={setSitesChoisis} />
          </div>
        )}
      </div>
      <div className="actions">
        <button type="submit" className="bouton" disabled={action.enCours}>
          {action.enCours ? 'Envoi…' : 'Envoyer l’invitation'}
        </button>
      </div>
      <p className="aide">
        La personne reçoit un e-mail avec un lien pour se connecter. Ensuite, elle se connecte en saisissant simplement son
        adresse.
      </p>
      <AfficherMessage message={action.message} />
    </form>
  );
}

/** Une ligne de contact avec ses actions : modifier, accès aux sites, renvoyer, supprimer. */
export function CarteContact({
  contact,
  etat,
  sites,
  accesActuels,
  surChangement,
}: {
  contact: Profil;
  etat?: EtatCompte;
  sites: Site[];
  accesActuels: string[];
  surChangement: () => void;
}) {
  const action = useAction();
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState({
    nom: contact.nom,
    fonction: contact.fonction ?? '',
    telephone: contact.telephone ?? '',
    recoit_emails: contact.recoit_emails,
  });
  const [acces, setAcces] = useState(accesActuels);
  const prefixe = `contact-${contact.id}`;

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const { ok } = await action.executer(async () => {
      await modifierProfil(contact.id, {
        nom: champs.nom.trim(),
        fonction: nulSiVide(champs.fonction),
        telephone: nulSiVide(champs.telephone),
        recoit_emails: champs.recoit_emails,
      });
      await definirAccesSites(contact.id, acces);
    }, 'Contact enregistré.');
    if (ok) {
      setEdition(false);
      surChangement();
    }
  }

  const nomsAcces = sites.filter((s) => accesActuels.includes(s.id)).map((s) => s.nom);

  return (
    <li>
      <div className="ligne">
        <div>
          <strong>{contact.nom}</strong>
          <div className="secondaire">{[contact.fonction, contact.email, contact.telephone].filter(Boolean).join(' · ')}</div>
          <div className="secondaire">
            Accès : {nomsAcces.length === 0 ? 'tous les sites' : `limité à ${nomsAcces.join(', ')}`}
            {!contact.recoit_emails && ' · ne reçoit pas les e-mails automatiques'}
          </div>
          <LigneEtatCompte etat={etat} />
        </div>
        <button type="button" className="bouton bouton-secondaire bouton-petit" onClick={() => setEdition(!edition)}>
          {edition ? 'Fermer' : 'Gérer'}
        </button>
      </div>

      {edition && (
        <form onSubmit={enregistrer} style={{ marginTop: '0.75rem' }}>
          <div className="formulaire">
            <Champ id={`${prefixe}-nom`} libelle="Prénom et nom" obligatoire>
              <input
                id={`${prefixe}-nom`}
                required
                value={champs.nom}
                onChange={(e) => setChamps({ ...champs, nom: e.target.value })}
              />
            </Champ>
            <Champ id={`${prefixe}-fonction`} libelle="Fonction">
              <input
                id={`${prefixe}-fonction`}
                value={champs.fonction}
                onChange={(e) => setChamps({ ...champs, fonction: e.target.value })}
              />
            </Champ>
            <Champ id={`${prefixe}-telephone`} libelle="Téléphone">
              <input
                id={`${prefixe}-telephone`}
                type="tel"
                value={champs.telephone}
                onChange={(e) => setChamps({ ...champs, telephone: e.target.value })}
              />
            </Champ>
            <div className="pleine-largeur">
              <label className="case" htmlFor={`${prefixe}-emails`}>
                <input
                  id={`${prefixe}-emails`}
                  type="checkbox"
                  checked={champs.recoit_emails}
                  onChange={(e) => setChamps({ ...champs, recoit_emails: e.target.checked })}
                />
                Reçoit les e-mails automatiques (rapports publiés, rappels, réponses)
              </label>
            </div>
            {contact.role === 'client' && (
              <div className="pleine-largeur">
                <ChoixSites id={prefixe} sites={sites} choisis={acces} surChangement={setAcces} />
              </div>
            )}
          </div>
          <p className="aide">L’adresse e-mail ne se modifie pas : pour changer d’adresse, supprimer le contact et l’inviter à nouveau.</p>
          <div className="actions">
            <button type="submit" className="bouton" disabled={action.enCours}>
              Enregistrer
            </button>
            {etat && !etat.active_le && (
              <button
                type="button"
                className="bouton bouton-secondaire"
                disabled={action.enCours}
                onClick={() => action.executer(() => renvoyerInvitation(contact.id), (m) => m)}
              >
                Renvoyer l’invitation
              </button>
            )}
            <button
              type="button"
              className="bouton bouton-danger"
              disabled={action.enCours}
              onClick={async () => {
                if (!window.confirm(`Supprimer ${contact.nom} et son accès à l’espace client ? Cette action est définitive.`)) return;
                const { ok } = await action.executer(() => supprimerContact(contact.id));
                if (ok) surChangement();
              }}
            >
              Supprimer le contact
            </button>
          </div>
        </form>
      )}
      <AfficherMessage message={action.message} />
    </li>
  );
}
