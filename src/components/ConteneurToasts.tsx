import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToast, type Toast, type TypeToast } from "../context/ToastContext";

const ICONES: Record<TypeToast, typeof CheckCircle2> = {
  succes: CheckCircle2,
  erreur: XCircle,
  info: Info
};

const CLASSES: Record<TypeToast, string> = {
  succes: "toast toast--succes",
  erreur: "toast toast--erreur",
  info: "toast toast--info"
};

function CarteToast({ toast, onFermer }: { toast: Toast; onFermer: () => void }) {
  const Icone = ICONES[toast.type];
  return (
    <div className={CLASSES[toast.type]} role="status">
      <Icone size={18} />
      <span>{toast.message}</span>
      <button type="button" onClick={onFermer} aria-label="Fermer la notification">
        <X size={14} />
      </button>
    </div>
  );
}

export default function ConteneurToasts() {
  const { toasts, retirer } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="conteneur-toasts">
      {toasts.map((toast) => (
        <CarteToast key={toast.id} toast={toast} onFermer={() => retirer(toast.id)} />
      ))}
    </div>
  );
}
