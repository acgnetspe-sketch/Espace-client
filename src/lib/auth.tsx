import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profil } from './types';

interface EtatConnexion {
  /** Vrai tant que l'on ne sait pas encore si la personne est connectée. */
  chargement: boolean;
  session: Session | null;
  /** Profil de la personne connectée ; null si son compte n'a pas (encore) de profil. */
  profil: Profil | null;
  /** Message à afficher si un lien de connexion a échoué (expiré, déjà utilisé…). */
  erreurLien: string | null;
  deconnexion: () => Promise<void>;
}

const ContexteConnexion = createContext<EtatConnexion | null>(null);

/**
 * Lit une éventuelle erreur renvoyée par Supabase dans l'adresse après un clic
 * sur un lien magique (ex. lien expiré), puis nettoie l'adresse.
 */
function lireErreurLien(): string | null {
  const parametres = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search);
  const code = parametres.get('error_code');
  if (!code && !parametres.get('error')) return null;
  window.history.replaceState(null, '', window.location.pathname);
  if (code === 'otp_expired') {
    return 'Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau ci-dessous.';
  }
  return 'La connexion n’a pas abouti. Demandez un nouveau lien ci-dessous.';
}

export function FournisseurConnexion({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [sessionLue, setSessionLue] = useState(false);
  const [profilLu, setProfilLu] = useState(false);
  const [erreurLien] = useState(lireErreurLien);

  // Suivi de la session (connexion, déconnexion, renouvellement automatique).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLue(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evenement, nouvelleSession) => {
      setSession(nouvelleSession);
      setSessionLue(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Chargement du profil quand la personne connectée change.
  const idUtilisateur = session?.user.id ?? null;
  useEffect(() => {
    let annule = false;
    if (!idUtilisateur) {
      setProfil(null);
      setProfilLu(true);
      return;
    }
    setProfilLu(false);
    supabase
      .from('profils')
      .select('id, organisation_id, nom, fonction, telephone, email, role')
      .eq('id', idUtilisateur)
      .maybeSingle()
      .then(({ data }) => {
        if (annule) return;
        setProfil((data as Profil | null) ?? null);
        setProfilLu(true);
      });
    return () => {
      annule = true;
    };
  }, [idUtilisateur]);

  const valeur: EtatConnexion = {
    chargement: !sessionLue || !profilLu,
    session,
    profil,
    erreurLien,
    deconnexion: async () => {
      await supabase.auth.signOut();
    },
  };

  return <ContexteConnexion.Provider value={valeur}>{children}</ContexteConnexion.Provider>;
}

export function useConnexion(): EtatConnexion {
  const contexte = useContext(ContexteConnexion);
  if (!contexte) throw new Error('useConnexion doit être utilisé dans FournisseurConnexion');
  return contexte;
}
