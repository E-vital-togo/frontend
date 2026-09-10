import type { ReactNode } from "react";

/** Enveloppe un <table> natif pour garantir le defilement horizontal sur petit ecran plutot qu'un debordement de page. */
export default function Tableau({ children }: { children: ReactNode }) {
  return (
    <div className="eva-tableau-conteneur">
      <table className="eva-tableau">{children}</table>
    </div>
  );
}
