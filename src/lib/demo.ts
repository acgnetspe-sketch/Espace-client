// Mode démonstration (salon, rendez-vous commerciaux).
// Activé UNIQUEMENT sur le site de démonstration, par la variable Netlify
// VITE_MODE_DEMO=true. Ce site est relié à un projet Supabase séparé qui ne
// contient que des données fictives. En production, rien de ceci n'apparaît.

import { supabase } from './supabase';

export const modeDemo = import.meta.env.VITE_MODE_DEMO === 'true';

/** Comptes de démonstration créés par supabase/seed.sql (adresses fictives). */
export const COMPTES_DEMO = [
  { email: 'client.demo.a@example.com', libelle: 'Client – Exploitant Démo A (4 sites)' },
  { email: 'client.demo.b@example.com', libelle: 'Client – Exploitant Démo B (1 site)' },
  { email: 'admin.demo@example.com', libelle: 'Équipe ACG NET SPE (administration)' },
] as const;

/** Fichiers de démonstration servis par le site (public/demo) et leur chemin dans le stockage. */
const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000001';
const FICHIERS_DEMO: { source: string; chemin: string; type: string }[] = [
  { source: 'rapport-demo-garrigues.pdf', type: 'application/pdf', chemin: `${A}/a2000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/rapport-demo-garrigues.pdf` },
  { source: 'rapport-demo-mistral.pdf', type: 'application/pdf', chemin: `${A}/a2000000-0000-4000-8000-000000000002/a3000000-0000-4000-8000-000000000002/rapport-demo-mistral.pdf` },
  { source: 'rapport-demo-atelier-b.pdf', type: 'application/pdf', chemin: `${B}/b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/rapport-demo-atelier-b.pdf` },
  { source: 'garrigues-avant.jpg', type: 'image/jpeg', chemin: `${A}/a2000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/garrigues-avant.jpg` },
  { source: 'garrigues-apres.jpg', type: 'image/jpeg', chemin: `${A}/a2000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/garrigues-apres.jpg` },
  { source: 'mistral-avant.jpg', type: 'image/jpeg', chemin: `${A}/a2000000-0000-4000-8000-000000000002/a3000000-0000-4000-8000-000000000002/mistral-avant.jpg` },
  { source: 'mistral-apres.jpg', type: 'image/jpeg', chemin: `${A}/a2000000-0000-4000-8000-000000000002/a3000000-0000-4000-8000-000000000002/mistral-apres.jpg` },
];

/**
 * Dépose (ou remplace) les rapports et photos factices aux chemins prévus par
 * seed.sql. Réservé à un administrateur (règles du stockage). Sans effet en production.
 */
export async function installerFichiersDemo(): Promise<number> {
  if (!modeDemo) throw new Error('Disponible uniquement sur le site de démonstration.');
  let nombre = 0;
  for (const f of FICHIERS_DEMO) {
    const reponse = await fetch(`/demo/${f.source}`);
    if (!reponse.ok) throw new Error(`Fichier de démonstration introuvable : ${f.source}`);
    const { error } = await supabase.storage
      .from('documents')
      .upload(f.chemin, await reponse.blob(), { contentType: f.type, upsert: true });
    if (error) {
      console.error(error);
      throw new Error(`« ${f.source} » n’a pas pu être déposé.`);
    }
    nombre++;
  }
  return nombre;
}
