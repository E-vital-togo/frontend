import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type TypeToast = "succes" | "erreur" | "info" | "avertissement";

interface OptionsToast {
  /** Titre en gras au-dessus du message. */
  titre?: string;
  /** Duree d'affichage en millisecondes (defaut : 5 s, 7 s pour un avertissement, 8 s pour une erreur). */
  duree?: number;
}

interface Toast {
  id: number;
  type: TypeToast;
  message: string;
  titre?: string;
  duree: number;
}

interface ContexteToastValeur {
  succes: (message: string, options?: OptionsToast) => void;
  erreur: (message: string, options?: OptionsToast) => void;
  info: (message: string, options?: OptionsToast) => void;
  avertissement: (message: string, options?: OptionsToast) => void;
}

const ContexteToast = createContext<ContexteToastValeur | null>(null);

const ICONES: Record<TypeToast, ReactNode> = {
  succes: <CheckCircle2 size={18} aria-hidden="true" />,
  erreur: <XCircle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
  avertissement: <AlertTriangle size={18} aria-hidden="true" />
};

const DUREES_MS: Record<TypeToast, number> = { succes: 5000, info: 5000, avertissement: 7000, erreur: 8000 };
const NOMBRE_MAX = 4;

function ElementToast({ toast, onFermer }: { toast: Toast; onFermer: (id: number) => void }) {
  const [enPause, setEnPause] = useState(false);
  const reste = useRef(toast.duree);
  const debut = useRef(0);

  // Le minuteur s'arrete au survol / focus et reprend avec le temps restant
  useEffect(() => {
    if (enPause) return;
    debut.current = Date.now();
    const minuteur = window.setTimeout(() => onFermer(toast.id), reste.current);
    return () => {
      window.clearTimeout(minuteur);
      reste.current -= Date.now() - debut.current;
    };
  }, [enPause, onFermer, toast.id]);

  return (
    <div
      className={`eva-toast eva-toast--${toast.type}`}
      role={toast.type === "erreur" ? "alert" : "status"}
      style={{ "--toast-duree": `${toast.duree}ms` } as CSSProperties}
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
      onFocus={() => setEnPause(true)}
      onBlur={() => setEnPause(false)}
    >
      {ICONES[toast.type]}
      <div className="eva-toast__corps">
        {toast.titre && <span className="eva-toast__titre">{toast.titre}</span>}
        <span className="eva-toast__message">{toast.message}</span>
      </div>
      <button type="button" className="eva-toast__fermer" onClick={() => onFermer(toast.id)} aria-label="Fermer la notification">
        <X size={15} aria-hidden="true" />
      </button>
      <span className="eva-toast__progression" aria-hidden="true" />
    </div>
  );
}

/** Remplace les alert()/messages inline eparpilles par un flux unique de notifications ephemeres, coherent partout. */
export function FournisseurToast({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const compteur = useRef(0);

  const retirer = useCallback((id: number) => {
    setToasts((precedent) => precedent.filter((t) => t.id !== id));
  }, []);

  const ajouter = useCallback((type: TypeToast, message: string, options?: OptionsToast) => {
    const id = ++compteur.current;
    const toast: Toast = { id, type, message, titre: options?.titre, duree: options?.duree ?? DUREES_MS[type] };
    setToasts((precedent) => [...precedent, toast].slice(-NOMBRE_MAX));
  }, []);

  // Identite stable : les ecrans peuvent mettre useToast() en dependance d'un effet sans boucle
  const valeur = useMemo<ContexteToastValeur>(
    () => ({
      succes: (message, options) => ajouter("succes", message, options),
      erreur: (message, options) => ajouter("erreur", message, options),
      info: (message, options) => ajouter("info", message, options),
      avertissement: (message, options) => ajouter("avertissement", message, options)
    }),
    [ajouter]
  );

  return (
    <ContexteToast.Provider value={valeur}>
      {children}
      <div className="eva-toasts" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <ElementToast key={toast.id} toast={toast} onFermer={retirer} />
        ))}
      </div>
    </ContexteToast.Provider>
  );
}

export function useToast(): ContexteToastValeur {
  const contexte = useContext(ContexteToast);
  if (!contexte) throw new Error("useToast doit être utilisé à l'intérieur de FournisseurToast");
  return contexte;
}
