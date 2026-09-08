import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type TypeToast = "succes" | "erreur" | "info";

export interface Toast {
  id: string;
  type: TypeToast;
  message: string;
}

interface ContexteToastValeur {
  toasts: Toast[];
  notifier: (message: string, type?: TypeToast) => void;
  retirer: (id: string) => void;
}

const ContexteToast = createContext<ContexteToastValeur | null>(null);

const DUREE_AFFICHAGE_MS = 5000;

export function FournisseurToast({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const compteur = useRef(0);

  const retirer = useCallback((id: string) => {
    setToasts((precedent) => precedent.filter((t) => t.id !== id));
  }, []);

  const notifier = useCallback(
    (message: string, type: TypeToast = "info") => {
      compteur.current += 1;
      const id = `toast-${compteur.current}`;
      setToasts((precedent) => [...precedent, { id, type, message }]);
      setTimeout(() => retirer(id), DUREE_AFFICHAGE_MS);
    },
    [retirer]
  );

  return <ContexteToast.Provider value={{ toasts, notifier, retirer }}>{children}</ContexteToast.Provider>;
}

export function useToast(): ContexteToastValeur {
  const contexte = useContext(ContexteToast);
  if (!contexte) throw new Error("useToast doit etre utilise a l'interieur de FournisseurToast");
  return contexte;
}
