import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  enregistrerNotesOrganisation,
  listerAccesSites,
  listerEtatComptes,
  listerOrganisations,
  listerProfils,
  listerSitesAdmin,
  lireNotesOrganisation,
  modifierOrganisation,
  supprimerOrganisation,
} from '../../lib/admin';
import { useChargement } from '../../lib/useChargement';
import { LIBELLE_INSTALLATION } from '../../lib/libelles';
import { Etat, PageIntrouvable } from '../../composants/Communs';
import { AfficherMessage, Champ, nulSiVide, useAction } from '../../composants/Formulaire';
import { CarteContact, FormulaireInvitation } from './Contacts';
import type { Organisation } from '../../lib/types';

async function chargerClient(id: string) {
  const [organisations, sites, profils, acces, etats, notes] = await Promise.all([
    listerOrganisations(),
    listerSitesAdmin(),
    listerProfils(),
    listerAccesSites(),
    listerEtatComptes(),
    lireNotesOrganisation(id),
  ]);
  return {
    organisation: organisations.find((o) => o.id === id) ?? null,
    sites: sites.filter((s) => s.organisation_id === id),
    contacts: profils.filter((p) => p.organisation_id === id),
    acces,
    etats,
    notes,
  };
}

export function AdminClient() {
  const { id = '' } = useParams();
  const etat = useChargement(() => chargerClient(id), [id]);
  return (
    <Etat etat={etat}>
      {(d) =>
        d.organisation ? (
          <Contenu {...d} organisation={d.organisation} recharger={etat.recharger} />
        ) : (
          <PageIntrouvable texte="Ce client n’existe pas." />
        )
      }
    </Etat>
  );
}

function Contenu({
  organisation,
  sites,
  contacts,
  acces,
  etats,
  notes,
  recharger,
}: Awaited<ReturnType<typeof chargerClient>> & { organisation: Organisation; recharger: () => void }) {
  const navigation = useNavigate();
  const action = useAction();
  const actionNotes = useAction();
  const [nom, setNom] = useState(organisation.nom);
  const [adresse, setAdresse] = useState(organisation.adresse ?? '');
  const [texteNotes, setTexteNotes] = useState(notes);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const { ok } = await action.executer(() => modifierOrganisation(organisation.id, nom.trim(), nulSiVide(adresse)), 'Client enregistré.');
    if (ok) recharger();
  }

  return (
    <>
      <div className="fil-ariane">
        <Link to="/admin/clients">Clients</Link> › {organisation.nom}
      </div>
      <div className="titre-page">
        <h1>{organisation.nom}</h1>
      </div>

      <div className="grille grille-2" style={{ alignItems: 'start' }}>
        <div className="pile">
          <section className="carte" aria-labelledby="titre-contacts">
            <h2 id="titre-contacts">Contacts</h2>
            {contacts.length === 0 ? (
              <p className="vide">Aucun contact. Invitez le premier ci-dessous.</p>
            ) : (
              <ul className="liste">
                {contacts.map((c) => (
                  <CarteContact
                    key={c.id}
                    contact={c}
                    etat={etats.get(c.id)}
                    sites={sites}
                    accesActuels={acces.filter((a) => a.profil_id === c.id).map((a) => a.site_id)}
                    surChangement={recharger}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="carte" aria-labelledby="titre-inviter">
            <h2 id="titre-inviter">Inviter un contact</h2>
            <FormulaireInvitation role="client" organisationId={organisation.id} sites={sites} surInvitation={recharger} />
          </section>
        </div>

        <div className="pile">
          <section className="carte" aria-labelledby="titre-sites">
            <div className="carte-titre">
              <h2 id="titre-sites">Sites ({sites.length})</h2>
              <Link to={`/admin/sites/nouveau?organisation=${organisation.id}`}>Ajouter un site</Link>
            </div>
            {sites.length === 0 ? (
              <p className="vide">
                Aucun site. <Link to={`/admin/sites/import?organisation=${organisation.id}`}>Importer une liste (CSV)</Link>
              </p>
            ) : (
              <ul className="liste">
                {sites.map((s) => (
                  <li key={s.id} className="ligne">
                    <Link to={`/admin/sites/${s.id}`}>{s.nom}</Link>
                    <span className="secondaire">
                      {LIBELLE_INSTALLATION[s.type_installation]}
                      {s.departement && ` · ${s.departement}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="carte" aria-labelledby="titre-infos">
            <h2 id="titre-infos">Informations</h2>
            <form onSubmit={enregistrer}>
              <div className="formulaire">
                <Champ id="client-nom" libelle="Nom" obligatoire>
                  <input id="client-nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
                </Champ>
                <Champ id="client-adresse" libelle="Adresse">
                  <input id="client-adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
                </Champ>
              </div>
              <div className="actions">
                <button type="submit" className="bouton" disabled={action.enCours}>
                  Enregistrer
                </button>
                {sites.length === 0 && contacts.length === 0 && (
                  <button
                    type="button"
                    className="bouton bouton-danger"
                    onClick={async () => {
                      if (!window.confirm(`Supprimer définitivement le client « ${organisation.nom} » ?`)) return;
                      const { ok } = await action.executer(() => supprimerOrganisation(organisation.id));
                      if (ok) navigation('/admin/clients');
                    }}
                  >
                    Supprimer ce client
                  </button>
                )}
              </div>
              <AfficherMessage message={action.message} />
            </form>
          </section>

          <section className="carte" aria-labelledby="titre-notes">
            <h2 id="titre-notes">Notes internes</h2>
            <p className="aide" style={{ marginTop: 0 }}>Visibles uniquement par l’équipe ACG, jamais par le client.</p>
            <textarea
              id="client-notes"
              aria-labelledby="titre-notes"
              value={texteNotes}
              onChange={(e) => setTexteNotes(e.target.value)}
            />
            <div className="actions">
              <button
                type="button"
                className="bouton bouton-secondaire"
                disabled={actionNotes.enCours}
                onClick={() => actionNotes.executer(() => enregistrerNotesOrganisation(organisation.id, texteNotes), 'Notes enregistrées.')}
              >
                Enregistrer les notes
              </button>
            </div>
            <AfficherMessage message={actionNotes.message} />
          </section>
        </div>
      </div>
    </>
  );
}
