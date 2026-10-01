import type { ReactNode } from "react";
import FilAriane, { type ElementFilAriane } from "./FilAriane";

interface ProprietesEnteteDePage {
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Boutons alignes a droite (une seule action principale idealement). */
  actions?: ReactNode;
  /** Chemin de navigation affiche au-dessus du titre. */
  filAriane?: ElementFilAriane[];
  /** Badges affiches a cote du titre (ex: statut du dossier). */
  badges?: ReactNode;
}

/** En-tete standard de chaque page : titre (h1), sous-titre, actions, fil d'Ariane optionnel. */
export default function EnteteDePage({ titre, sousTitre, actions, filAriane, badges }: ProprietesEnteteDePage) {
  return (
    <>
      {filAriane && filAriane.length > 0 && <FilAriane elements={filAriane} />}
      <div className="eva-entete-page">
        <div className="eva-entete-page__texte">
          <h1 className="eva-titre-page eva-entete-page__titre">
            {titre}
            {badges}
          </h1>
          {sousTitre && <div className="eva-sous-titre">{sousTitre}</div>}
        </div>
        {actions && <div className="eva-entete-page__actions">{actions}</div>}
      </div>
    </>
  );
}
