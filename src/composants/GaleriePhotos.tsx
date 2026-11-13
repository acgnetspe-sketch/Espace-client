import { liensPhotos } from '../lib/photos';
import { useChargement } from '../lib/useChargement';
import type { Fichier } from '../lib/types';

/** Photos avant / après côte à côte. Un clic ouvre la photo en grand. */
export function GaleriePhotos({ photos }: { photos: Fichier[] }) {
  const cle = photos.map((p) => p.chemin).join('|');
  const etat = useChargement(() => liensPhotos(photos.map((p) => p.chemin)), [cle]);
  const liens = etat.donnees ?? new Map<string, string>();
  const avant = photos.filter((p) => p.type === 'photo_avant');
  const apres = photos.filter((p) => p.type === 'photo_apres');

  const colonne = (titre: string, liste: Fichier[]) => (
    <div>
      <h3>{titre}</h3>
      {liste.length === 0 ? (
        <p className="vide">Aucune photo.</p>
      ) : (
        <div className="galerie">
          {liste.map((p) => {
            const lien = liens.get(p.chemin);
            return lien ? (
              <a key={p.id} href={lien} target="_blank" rel="noreferrer" title="Voir en grand">
                <img src={lien} alt={`${titre} – ${p.nom}`} loading="lazy" />
              </a>
            ) : (
              <div key={p.id} className="galerie-attente" aria-label="Chargement de la photo" />
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="grille grille-2">
      {colonne('Avant', avant)}
      {colonne('Après', apres)}
    </div>
  );
}
