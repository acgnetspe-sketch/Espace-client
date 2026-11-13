import { supabase } from './supabase';

/** Durée de validité des liens de téléchargement : 1 heure (cahier des charges §3). */
export const DUREE_LIEN_SECONDES = 3600;

/**
 * Ouvre un fichier privé dans un nouvel onglet.
 * Supabase ne fournit le lien signé que si la personne a le droit de lire ce
 * fichier ; le lien cesse de fonctionner au bout d'une heure.
 *
 * L'onglet est ouvert AVANT d'attendre le lien : sinon Safari (iPad, iPhone)
 * bloque l'ouverture, qu'il considère comme une fenêtre surgissante.
 */
export async function ouvrirFichier(chemin: string): Promise<void> {
  const onglet = window.open('', '_blank');
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(chemin, DUREE_LIEN_SECONDES);
  if (error || !data?.signedUrl) {
    onglet?.close();
    console.error(error);
    throw new Error('Le fichier n’a pas pu être ouvert. Réessayez ; si le problème continue, contactez ACG NET SPE.');
  }
  if (onglet) {
    onglet.location.replace(data.signedUrl);
  } else {
    window.location.assign(data.signedUrl);
  }
}
