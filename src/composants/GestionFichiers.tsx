import { useRef, useState } from 'react';
import { deposerFichier, estPhoto, listerFichiers, supprimerFichier, type CibleFichier } from '../lib/admin';
import { useChargement } from '../lib/useChargement';
import { liensPhotos } from '../lib/photos';
import { formaterHorodatage, formaterTaille } from '../lib/formats';
import { LIBELLE_FICHIER } from '../lib/libelles';
import { BoutonFichier, Etat } from './Communs';
import { AfficherMessage, Champ, useAction } from './Formulaire';
import type { Fichier, TypeFichier } from '../lib/types';

async function charger(cible: CibleFichier) {
  const fichiers = await listerFichiers(cible);
  const vignettes = await liensPhotos(fichiers.filter((f) => estPhoto(f.type)).map((f) => f.chemin));
  return { fichiers, vignettes };
}

/** Liste, dépôt et suppression des fichiers (PDF, photos) d'une intervention ou d'un site. */
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
  const etat = useChargement(() => charger(cible), [cleCible]);
  const action = useAction();
  const [type, setType] = useState<TypeFichier>(typesProposes[0] ?? 'document');
  const [progression, setProgression] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);
  const idChamp = `fichier-${cleCible}`;
  const photo = estPhoto(type);

  async function deposer() {
    const fichiers = Array.from(champFichier.current?.files ?? []);
    if (fichiers.length === 0) {
      action.setMessage({ type: 'erreur', texte: photo ? 'Choisissez d’abord une ou plusieurs photos.' : 'Choisissez d’abord un fichier PDF.' });
      return;
    }
    const { ok } = await action.executer(
      async () => {
        for (const [index, fichier] of fichiers.entries()) {
          if (fichiers.length > 1) setProgression(`Envoi ${index + 1} sur ${fichiers.length}…`);
          await deposerFichier(fichier, type, {
            organisation_id: organisationId,
            site_id: siteId,
            intervention_id: 'intervention_id' in cible ? cible.intervention_id : undefined,
          });
        }
      },
      fichiers.length > 1 ? `${fichiers.length} fichiers déposés.` : `« ${fichiers[0]!.name} » a été déposé.`,
    );
    setProgression(null);
    if (champFichier.current) champFichier.current.value = '';
    etat.recharger(); // même en cas d'échec partiel : on affiche ce qui est arrivé
    if (ok) surChangement?.();
  }

  async function supprimer(f: Fichier) {
    if (!window.confirm(`Supprimer définitivement « ${f.nom} » ?`)) return;
    const { ok } = await action.executer(() => supprimerFichier(f), 'Fichier supprimé.');
    if (ok) {
      etat.recharger();
      surChangement?.();
    }
  }

  return (
    <div>
      <Etat etat={etat}>
        {({ fichiers, vignettes }) =>
          fichiers.length === 0 ? (
            <p className="vide">Aucun fichier déposé.</p>
          ) : (
            <ul className="liste">
              {fichiers.map((f) => (
                <li key={f.id} className="ligne">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0 }}>
                    {estPhoto(f.type) && vignettes.get(f.chemin) && (
                      <img
                        src={vignettes.get(f.chemin)}
                        alt=""
                        width={72}
                        height={54}
                        style={{ objectFit: 'cover', borderRadius: 4, flex: 'none', border: '1px solid var(--bordure)' }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ overflowWrap: 'anywhere' }}>{f.nom}</strong>
                      <div className="secondaire">
                        {LIBELLE_FICHIER[f.type]} · {formaterTaille(f.taille_octets)} · déposé le {formaterHorodatage(f.ajoute_le)}
                      </div>
                    </div>
                  </div>
                  <div className="actions" style={{ marginTop: 0, flexWrap: 'nowrap' }}>
                    <BoutonFichier fichier={f} libelle="Ouvrir" />
                    <button type="button" className="bouton bouton-danger bouton-petit" disabled={action.enCours} onClick={() => supprimer(f)}>
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
        <legend>Déposer</legend>
        <div className="formulaire">
          {typesProposes.length > 1 && (
            <Champ id={`${idChamp}-type`} libelle="Type">
              <select id={`${idChamp}-type`} value={type} onChange={(e) => setType(e.target.value as TypeFichier)}>
                {typesProposes.map((t) => (
                  <option key={t} value={t}>
                    {LIBELLE_FICHIER[t]}
                  </option>
                ))}
              </select>
            </Champ>
          )}
          <Champ
            id={idChamp}
            libelle={photo ? 'Photos (plusieurs possibles)' : 'Fichier PDF (50 Mo au maximum)'}
            aide={photo ? 'Les photos sont réduites automatiquement avant l’envoi.' : undefined}
          >
            <input
              key={photo ? 'photo' : 'pdf'}
              id={idChamp}
              type="file"
              accept={photo ? 'image/*' : 'application/pdf,.pdf'}
              multiple={photo}
              ref={champFichier}
            />
          </Champ>
        </div>
        <div className="actions">
          <button type="button" className="bouton" onClick={deposer} disabled={action.enCours}>
            {action.enCours ? (progression ?? 'Envoi en cours…') : 'Déposer'}
          </button>
        </div>
        <AfficherMessage message={action.message} />
      </fieldset>
    </div>
  );
}
