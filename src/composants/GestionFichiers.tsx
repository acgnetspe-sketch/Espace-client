import { useRef, useState } from 'react';
import { deposerFichier, listerFichiers, supprimerFichier, type CibleFichier } from '../lib/admin';
import { useChargement } from '../lib/useChargement';
import { formaterHorodatage, formaterTaille } from '../lib/formats';
import { LIBELLE_FICHIER } from '../lib/libelles';
import { BoutonFichier, Etat } from './Communs';
import { AfficherMessage, Champ, useAction } from './Formulaire';
import type { TypeFichier } from '../lib/types';

/** Liste, dépôt et suppression des PDF d'une intervention ou d'un site. */
export function GestionFichiers({
  cible,
  organisationId,
  siteId,
  typesProposes,
  surChangement,
}: {
  cible: CibleFichier;
  organisationId: string;
  siteId: string;
  typesProposes: TypeFichier[];
  surChangement?: () => void;
}) {
  const cleCible = 'intervention_id' in cible ? cible.intervention_id : cible.site_id;
  const etat = useChargement(() => listerFichiers(cible), [cleCible]);
  const action = useAction();
  const [type, setType] = useState<TypeFichier>(typesProposes[0] ?? 'document');
  const champFichier = useRef<HTMLInputElement>(null);
  const idChamp = `fichier-${cleCible}`;

  async function deposer() {
    const fichier = champFichier.current?.files?.[0];
    if (!fichier) {
      action.setMessage({ type: 'erreur', texte: 'Choisissez d’abord un fichier PDF.' });
      return;
    }
    const { ok } = await action.executer(
      () =>
        deposerFichier(fichier, type, {
          organisation_id: organisationId,
          site_id: siteId,
          intervention_id: 'intervention_id' in cible ? cible.intervention_id : undefined,
        }),
      `« ${fichier.name} » a été déposé.`,
    );
    if (ok) {
      if (champFichier.current) champFichier.current.value = '';
      etat.recharger();
      surChangement?.();
    }
  }

  return (
    <div>
      <Etat etat={etat}>
        {(fichiers) =>
          fichiers.length === 0 ? (
            <p className="vide">Aucun fichier déposé.</p>
          ) : (
            <ul className="liste">
              {fichiers.map((f) => (
                <li key={f.id} className="ligne">
                  <div>
                    <strong>{f.nom}</strong>
                    <div className="secondaire">
                      {LIBELLE_FICHIER[f.type]} · {formaterTaille(f.taille_octets)} · déposé le {formaterHorodatage(f.ajoute_le)}
                    </div>
                  </div>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <BoutonFichier fichier={f} libelle="Ouvrir" />
                    <button
                      type="button"
                      className="bouton bouton-danger bouton-petit"
                      disabled={action.enCours}
                      onClick={async () => {
                        if (!window.confirm(`Supprimer définitivement « ${f.nom} » ?`)) return;
                        const { ok } = await action.executer(() => supprimerFichier(f), 'Fichier supprimé.');
                        if (ok) {
                          etat.recharger();
                          surChangement?.();
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Etat>

      <fieldset style={{ marginTop: '1rem' }}>
        <legend>Déposer un PDF</legend>
        <div className="formulaire">
          <Champ id={idChamp} libelle="Fichier PDF (50 Mo au maximum)">
            <input id={idChamp} type="file" accept="application/pdf,.pdf" ref={champFichier} />
          </Champ>
          {typesProposes.length > 1 && (
            <Champ id={`${idChamp}-type`} libelle="Type de document">
              <select id={`${idChamp}-type`} value={type} onChange={(e) => setType(e.target.value as TypeFichier)}>
                {typesProposes.map((t) => (
                  <option key={t} value={t}>
                    {LIBELLE_FICHIER[t]}
                  </option>
                ))}
              </select>
            </Champ>
          )}
        </div>
        <div className="actions">
          <button type="button" className="bouton" onClick={deposer} disabled={action.enCours}>
            {action.enCours ? 'Envoi en cours…' : 'Déposer'}
          </button>
        </div>
        <AfficherMessage message={action.message} />
      </fieldset>
    </div>
  );
}
