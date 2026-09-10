import { useEffect, type ReactNode } from "react";

interface ProprietesModale {
  titre: string;
  onFermer: () => void;
  large?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}

export default function Modale({ titre, onFermer, large, children, actions }: ProprietesModale) {
  useEffect(() => {
    const gererEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", gererEchap);
    return () => window.removeEventListener("keydown", gererEchap);
  }, [onFermer]);

  return (
    <div className="eva-modale-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={`eva-modale${large ? " eva-modale--large" : ""}`} role="dialog" aria-modal="true" aria-label={titre}>
        <div className="eva-modale__titre">{titre}</div>
        {children}
        {actions && <div className="eva-modale__actions">{actions}</div>}
      </div>
    </div>
  );
}
