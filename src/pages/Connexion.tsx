import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useConnexion } from '../lib/auth';
import { Logo } from '../composants/Communs';
import { PiedDePage } from '../composants/MiseEnPage';
import { COMPTES_DEMO, modeDemo } from '../lib/demo';

type Etape = { type: 'saisie' } | { type: 'envoye'; email: string };

/** Traduit les réponses de Supabase en messages clairs. */
function messageErreur(erreur: unknown): string {
  if (erreur instanceof AuthApiError) {
    const code = erreur.code ?? '';
    if (['otp_disabled', 'signup_disabled', 'user_not_found'].includes(code) || /signups? not allowed/i.test(erreur.message)) {
      return 'Cette adresse n’a pas été invitée à l’espace client. Vérifiez l’orthographe, ou demandez une invitation à votre interlocuteur ACG NET SPE.';
    }
    if (erreur.status === 429 || code.includes('rate_limit')) {
      return 'Trop de demandes de lien en peu de temps. Patientez une minute, puis réessayez.';
    }
    if (code === 'email_address_invalid' || code === 'validation_failed') {
      return 'Cette adresse e-mail ne semble pas valide.';
    }
  }
  return 'Le lien n’a pas pu être envoyé. Vérifiez votre connexion internet, puis réessayez.';
}

export function Connexion() {
  const { session, chargement, erreurLien } = useConnexion();
  const [email, setEmail] = useState('');
  const [etape, setEtape] = useState<Etape>({ type: 'saisie' });
  const [erreur, setErreur] = useState<string | null>(erreurLien);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  if (!chargement && session) return <Navigate to="/" replace />;

  async function envoyerLien(evenement: FormEvent) {
    evenement.preventDefault();
    const adresse = email.trim().toLowerCase();
    if (!adresse) return;
    setEnvoiEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: adresse,
      options: {
        // Aucun compte n'est créé : seules les adresses invitées par ACG reçoivent un lien.
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });
    setEnvoiEnCours(false);
    if (error) {
      setErreur(messageErreur(error));
      return;
    }
    setEtape({ type: 'envoye', email: adresse });
  }

  return (
    <div className="ecran-connexion">
      <header className="entete">
        <div className="entete-haut">
          <Logo vers="/connexion" />
          <span className="entete-sous-titre">Espace client</span>
        </div>
      </header>

      <main className="boite-connexion">
        <div className="carte">
          {etape.type === 'saisie' ? (
            <>
              <h1>Connexion</h1>
              <p className="secondaire">
                Saisissez votre adresse e-mail : vous recevrez un lien pour vous connecter, sans mot de passe.
              </p>
              {erreur && (
                <div className="alerte alerte-danger" role="alert" style={{ marginBottom: '1rem' }}>
                  <p>{erreur}</p>
                </div>
              )}
              <form onSubmit={envoyerLien} noValidate={false}>
                <label htmlFor="email">Adresse e-mail</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@entreprise.fr"
                />
                <button type="submit" className="bouton" disabled={envoiEnCours} style={{ width: '100%', marginTop: '1rem' }}>
                  {envoiEnCours ? 'Envoi en cours…' : 'Recevoir mon lien de connexion'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1>Vérifiez vos e-mails</h1>
              <div className="alerte alerte-succes" role="status" style={{ marginBottom: '1rem' }}>
                <p>
                  Un lien de connexion vient d’être envoyé à <strong>{etape.email}</strong>.
                </p>
              </div>
              <p>Ouvrez l’e-mail et touchez le lien « Se connecter ». Il est valable une heure et ne sert qu’une fois.</p>
              <p className="secondaire">
                Rien reçu après quelques minutes ? Regardez dans les courriers indésirables, puis réessayez.
              </p>
              <button
                type="button"
                className="bouton bouton-secondaire"
                onClick={() => {
                  setEtape({ type: 'saisie' });
                  setErreur(null);
                }}
              >
                Utiliser une autre adresse ou renvoyer le lien
              </button>
            </>
          )}
        </div>
        {modeDemo && <ConnexionDemo />}
      </main>

      <PiedDePage />
    </div>
  );
}

/**
 * Site de démonstration uniquement : connexion par mot de passe aux comptes
 * fictifs, pour ne pas dépendre de la réception d'un e-mail sur un salon.
 * Les mots de passe sont définis dans Supabase (supabase/demo/preparer_demo.sql),
 * jamais dans le code.
 */
function ConnexionDemo() {
  const [email, setEmail] = useState<string>(COMPTES_DEMO[0].email);
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function connecter(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    setEnCours(false);
    if (error) setErreur('Mot de passe incorrect pour ce compte de démonstration.');
  }

  return (
    <div className="carte" style={{ marginTop: '1rem', borderTop: '4px solid var(--jaune)' }}>
      <h2>Démonstration</h2>
      <p className="secondaire">Toutes les données de ce site sont fictives.</p>
      {erreur && (
        <div className="alerte alerte-danger" role="alert" style={{ marginBottom: '1rem' }}>
          <p>{erreur}</p>
        </div>
      )}
      <form onSubmit={connecter}>
        <label htmlFor="demo-compte">Compte</label>
        <select id="demo-compte" value={email} onChange={(e) => setEmail(e.target.value)}>
          {COMPTES_DEMO.map((c) => (
            <option key={c.email} value={c.email}>
              {c.libelle}
            </option>
          ))}
        </select>
        <label htmlFor="demo-mdp" style={{ marginTop: '0.75rem' }}>
          Mot de passe de démonstration
        </label>
        <input
          id="demo-mdp"
          type="password"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />
        <button type="submit" className="bouton bouton-jaune" disabled={enCours} style={{ width: '100%', marginTop: '1rem' }}>
          {enCours ? 'Connexion…' : 'Entrer dans la démonstration'}
        </button>
      </form>
    </div>
  );
}
