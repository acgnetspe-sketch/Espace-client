// Photos avant/après : réduction avant envoi et liens d'affichage temporaires.

import { supabase } from './supabase';
import { DUREE_LIEN_SECONDES } from './fichiers';

/** Plus grand côté d'une photo après réduction (en pixels). */
export const COTE_MAX = 2000;

/** Dimensions réduites en gardant les proportions (jamais agrandies). */
export function dimensionsReduites(largeur: number, hauteur: number, coteMax = COTE_MAX): { largeur: number; hauteur: number } {
  const plusGrand = Math.max(largeur, hauteur);
  if (plusGrand <= coteMax) return { largeur, hauteur };
  const facteur = coteMax / plusGrand;
  return { largeur: Math.round(largeur * facteur), hauteur: Math.round(hauteur * facteur) };
}

/**
 * Réduit une photo (2000 px, JPEG qualité 85 %) avant de l'envoyer : une photo
 * d'iPad de 4 Mo passe à environ 400 Ko, sans perte visible à l'écran.
 * L'orientation de l'appareil photo est respectée.
 */
export async function reduireImage(fichier: File): Promise<Blob> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const { largeur, hauteur } = dimensionsReduites(image.width, image.height);
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const contexte = toile.getContext('2d');
  if (!contexte) throw new Error('Votre navigateur ne permet pas de préparer la photo.');
  contexte.drawImage(image, 0, 0, largeur, hauteur);
  image.close();
  return new Promise((resoudre, rejeter) =>
    toile.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error('Photo illisible.'))), 'image/jpeg', 0.85),
  );
}

/** Liens temporaires (1 heure) pour afficher plusieurs photos privées. */
export async function liensPhotos(chemins: string[]): Promise<Map<string, string>> {
  if (chemins.length === 0) return new Map();
  const { data, error } = await supabase.storage.from('documents').createSignedUrls(chemins, DUREE_LIEN_SECONDES);
  if (error) {
    console.error(error);
    return new Map();
  }
  return new Map(
    (data ?? []).filter((l) => l.signedUrl && l.path).map((l) => [l.path as string, l.signedUrl as string]),
  );
}
