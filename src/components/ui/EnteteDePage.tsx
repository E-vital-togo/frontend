import type { ReactNode } from "react";

interface ProprietesEnteteDePage {
  titre: string;
  sousTitre?: ReactNode;
  actions?: ReactNode;
}

export default function EnteteDePage({ titre, sousTitre, actions }: ProprietesEnteteDePage) {
  return (
    <div className="eva-entete-page">
      <div>
        <h1 className="eva-titre-page">{titre}</h1>
        {sousTitre && <div className="eva-sous-titre">{sousTitre}</div>}
      </div>
      {actions && <div className="eva-entete-page__actions">{actions}</div>}
    </div>
  );
}
