import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type TypeToast = "succes" | "erreur" | "info";

interface Toast {
  id: number;
  type: TypeToast;
  message: string;
}

interface ContexteToastValeur {
  succes: (message: string) => void;
  erreur: (message: string) => void;
  info: (message: string) => void;
}

const ContexteToast = createContext<ContexteToastValeur | null>(null);

const ICONES: Record<TypeToast, ReactNode> = {
  succes: <CheckCircle2 size={18} />,
  erreur: <XCircle size={18} />,
  info: <Info size={18} />
};

const DUREE_MS = 5000;

/** Remplace les alert()/messages inline eparpilles par un flux unique de notifications ephemeres, coherent partout. */
export function FournisseurToast({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const compteur = useRef(0);

  const retirer = useCallback((id: number) => {
    setToasts((precedent) => precedent.filter((t) => t.id !== id));
  }, []);

  const ajouter = useCallback(
    (type: TypeToast, message: string) => {
      const id = ++compteur.current;
      setToasts((precedent) => [...precedent, { id, type, message }]);
      window.setTimeout(() => retirer(id), DUREE_MS);
    },
    [retirer]
  );

  const valeur: ContexteToastValeur = {
    succes: (message) => ajouter("succes", message),
    erreur: (message) => ajouter("erreur", message),
    info: (message) => ajouter("info", message)
  };

  return (
    <ContexteToast.Provider value={valeur}>
      {children}
      <div className="eva-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`eva-toast eva-toast--${toast.type}`} role="status">
            {ICONES[toast.type]}
            <span>{toast.message}</span>
            <button className="eva-toast__fermer" onClick={() => retirer(toast.id)} aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ContexteToast.Provider>
  );
}

export function useToast(): ContexteToastValeur {
  const contexte = useContext(ContexteToast);
  if (!contexte) throw new Error("useToast doit etre utilise a l'interieur de FournisseurToast");
  return contexte;
}
