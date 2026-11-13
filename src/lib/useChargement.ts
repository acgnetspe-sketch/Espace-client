import { useCallback, useEffect, useState, type DependencyList } from 'react';

export interface EtatChargement<T> {
  donnees: T | null;
  erreur: string | null;
  chargement: boolean;
  recharger: () => void;
}

/** Charge des données au montage de l'écran (et quand les dépendances changent). */
export function useChargement<T>(charger: () => Promise<T>, dependances: DependencyList): EtatChargement<T> {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [essai, setEssai] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chargerMemo = useCallback(charger, dependances);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    chargerMemo()
      .then((resultat) => {
        if (!annule) setDonnees(resultat);
      })
      .catch((e: unknown) => {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Une erreur est survenue.');
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [chargerMemo, essai]);

  return { donnees, erreur, chargement, recharger: () => setEssai((n) => n + 1) };
}
