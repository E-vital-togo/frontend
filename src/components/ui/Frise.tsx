import type { ReactNode } from "react";
import { cx } from "./utilitaires";

export interface ElementFrise {
  id: string;
  date: string;
  contenu: ReactNode;
  /** Intitule en gras au-dessus du contenu. */
  titre?: ReactNode;
  /** Couleur du point : defaut (emeraude), attention, erreur, neutre. */
  variante?: "defaut" | "attention" | "erreur" | "neutre";
  /** Icone (15px max) affichee dans le point. */
  icone?: ReactNode;
}

/** Historique vertical (journal d'un dossier, etapes d'un parcours). */
export default function Frise({ elements }: { elements: ElementFrise[] }) {
  return (
    <div className="eva-frise" role="list">
      {elements.map((el) => (
        <div className={cx("eva-frise__item", el.variante && el.variante !== "defaut" && `eva-frise__item--${el.variante}`)} key={el.id} role="listitem">
          <span className="eva-frise__point" aria-hidden="true">
            {el.icone}
          </span>
          <div className="eva-frise__date texte-mono">{el.date}</div>
          {el.titre && <div className="eva-frise__titre">{el.titre}</div>}
          <div className="eva-frise__contenu">{el.contenu}</div>
        </div>
      ))}
    </div>
  );
}
