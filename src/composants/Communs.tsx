import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formaterPeriode, formaterTaille } from '../lib/formats';
import { LIBELLE_FICHIER, LIBELLE_INTERVENTION, LIBELLE_STATUT } from '../lib/libelles';
import { ouvrirFichier } from '../lib/fichiers';
import type { Fichier, Intervention, StatutIntervention } from '../lib/types';

/** Mot-symbole « ACG NET SPE » précédé du carré jaune. */
export function Logo({ vers = '/' }: { vers?: string }) {
  return (
    <Link to={vers} className="logo" aria-label="ACG NET SPE – accueil">
      <span className="logo-carre" aria-hidden="true" />
      ACG NET SPE
    </Link>
  );
}

export function BadgeStatut({ statut }: { statut: StatutIntervention }) {
  return <span className={`badge badge-${statut}`}>{LIBELLE_STATUT[statut]}</span>;
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <p className="chargement" role="status">
      {texte}
    </p>
  );
}

export function MessageErreur({ message, recharger }: { message: string; recharger?: () => void }) {
  return (
    <div className="alerte alerte-danger" role="alert">
      <p>{message}</p>
      {recharger && (
        <button type="button" className="bouton bouton-secondaire bouton-petit" onClick={recharger}>
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Contenu d'un écran une fois les données chargées, avec gestion de l'attente et des erreurs. */
export function Etat<T>({
  etat,
  children,
}: {
  etat: { donnees: T | null; erreur: string | null; chargement: boolean; recharger: () => void };
  children: (donnees: T) => ReactNode;
}) {
  if (etat.erreur) return <MessageErreur message={etat.erreur} recharger={etat.recharger} />;
  if (etat.chargement || etat.donnees === null) return <Chargement />;
  return <>{children(etat.donnees)}</>;
}

/** Date affichée pour une intervention : réelle si réalisée, sinon prévue. */
export function dateIntervention(i: Intervention): string {
  if (i.statut === 'realisee' && (i.debut_reel || i.fin_reelle)) {
    return formaterPeriode(i.debut_reel, i.fin_reelle);
  }
  return formaterPeriode(i.debut_prevu, i.fin_prevue);
}

/** Date de tri d'une intervention (AAAA-MM-JJ). */
export function dateTri(i: Intervention): string {
  return i.fin_reelle ?? i.debut_reel ?? i.fin_prevue ?? i.debut_prevu ?? '';
}

export function libelleIntervention(i: Intervention): string {
  return LIBELLE_INTERVENTION[i.type];
}

/** Bouton d'ouverture d'un fichier privé (lien signé valable 1 heure). */
export function BoutonFichier({ fichier, libelle }: { fichier: Fichier; libelle?: string }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ouvrir() {
    setEnCours(true);
    setErreur(null);
    try {
      await ouvrirFichier(fichier.chemin);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Le fichier n’a pas pu être ouvert.');
    } finally {
      setEnCours(false);
    }
  }

  const taille = formaterTaille(fichier.taille_octets);
  return (
    <span>
      <button
        type="button"
        className="bouton bouton-secondaire bouton-petit"
        onClick={ouvrir}
        disabled={enCours}
        title={fichier.nom}
      >
        {enCours ? 'Ouverture…' : (libelle ?? `${LIBELLE_FICHIER[fichier.type]} PDF`)}
        {taille && !enCours && <span className="secondaire">({taille})</span>}
      </button>
      {erreur && (
        <span className="secondaire" role="alert" style={{ display: 'block', color: 'var(--rouge)' }}>
          {erreur}
        </span>
      )}
    </span>
  );
}

export function PageIntrouvable({ texte }: { texte?: string }) {
  return (
    <div className="carte">
      <h1>Page introuvable</h1>
      <p>{texte ?? 'Cette page n’existe pas, ou vous n’y avez pas accès.'}</p>
      <Link to="/">Revenir au tableau de bord</Link>
    </div>
  );
}
