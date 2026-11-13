import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Vrai si les deux réglages de connexion à Supabase sont renseignés (.env ou Netlify). */
export const configurationPresente = Boolean(url && cle);

/**
 * Client Supabase de l'application.
 * Il n'utilise que la clé publique : toute la sécurité repose sur les règles
 * Row Level Security de la base (voir supabase/migrations).
 * Flux « implicit » : le lien magique fonctionne même s'il est ouvert sur un
 * autre appareil que celui où il a été demandé.
 */
export const supabase = createClient(url ?? 'http://configuration-manquante.invalid', cle ?? 'cle-manquante', {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
