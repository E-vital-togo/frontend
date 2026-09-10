import type { ReactNode } from "react";

interface ProprietesEtatVide {
  icone?: ReactNode;
  titre: string;
  description?: string;
  action?: ReactNode;
}

export default function EtatVide({ icone, titre, description, action }: ProprietesEtatVide) {
  return (
    <div className="eva-etat-vide">
      {icone && <div className="eva-etat-vide__icone">{icone}</div>}
      <div className="eva-etat-vide__titre">{titre}</div>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
