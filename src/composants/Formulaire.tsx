import { useState, type ReactNode } from 'react';

/** Libellé + champ + aide éventuelle. */
export function Champ({
  id,
  libelle,
  aide,
  obligatoire,
  children,
}: {
  id: string;
  libelle: string;
  aide?: string;
  obligatoire?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="champ">
      <label htmlFor={id}>
        {libelle}
        {obligatoire && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {aide && <p className="aide">{aide}</p>}
    </div>
  );
}

export type Message = { type: 'succes' | 'erreur'; texte: string } | null;

export function AfficherMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div
      className={`alerte ${message.type === 'succes' ? 'alerte-succes' : 'alerte-danger'}`}
      role={message.type === 'erreur' ? 'alert' : 'status'}
      style={{ margin: '0.75rem 0' }}
    >
      <p>{message.texte}</p>
    </div>
  );
}

/** Exécute une action (enregistrement, suppression…) avec état « en cours » et message. */
export function useAction() {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  /** Renvoie ok = true si l'action a réussi (même si elle ne renvoie rien), et son résultat éventuel. */
  async function executer<T>(
    action: () => Promise<T>,
    succes?: string | ((r: T) => string),
  ): Promise<{ ok: boolean; resultat?: T }> {
    setEnCours(true);
    setMessage(null);
    try {
      const resultat = await action();
      if (succes) setMessage({ type: 'succes', texte: typeof succes === 'function' ? succes(resultat) : succes });
      return { ok: true, resultat };
    } catch (e) {
      setMessage({ type: 'erreur', texte: e instanceof Error ? e.message : 'Une erreur est survenue.' });
      return { ok: false };
    } finally {
      setEnCours(false);
    }
  }

  return { enCours, message, setMessage, executer };
}

/** Champ texte → valeur nulle si vide. */
export const nulSiVide = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/** Champ nombre (virgule acceptée) → nombre ou null. */
export function nombreOuNul(v: string): number | null {
  const t = v.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const versChamp = (v: number | string | null | undefined): string =>
  v === null || v === undefined ? '' : String(v).replace('.', ',');
