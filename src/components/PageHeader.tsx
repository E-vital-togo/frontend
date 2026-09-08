import type { ReactNode } from "react";

interface ProprietesPageHeader {
  titre: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * En-tete standard de page : remplace le pattern <h1 style={{color:
 * "var(--couleur-emeraude)"}}> recopie dans chaque ecran.
 */
export default function PageHeader({ titre, description, actions }: ProprietesPageHeader) {
  return (
    <div className="entete-page">
      <div>
        <h1>{titre}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="entete-page__actions">{actions}</div>}
    </div>
  );
}
