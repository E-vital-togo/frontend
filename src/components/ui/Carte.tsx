import type { HTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cx } from "./utilitaires";

export type VarianteCarte = "defaut" | "plate" | "accent" | "attention" | "danger";

interface ProprietesStyleCarte {
  variante?: VarianteCarte;
  /** Retire le padding (pour y loger un tableau ou une liste) ; l'en-tete et le pied gardent le leur. */
  sansMarge?: boolean;
}

const CLASSES_VARIANTE: Record<VarianteCarte, string | false> = {
  defaut: false,
  plate: "eva-carte--plate",
  accent: "eva-carte--accent",
  attention: "eva-carte--attention",
  danger: "eva-carte--danger"
};

interface ProprietesCarte extends ProprietesStyleCarte, Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  children?: ReactNode;
  /** Titre de la carte : ajoute un en-tete (et enveloppe le contenu dans un corps). */
  titre?: ReactNode;
  description?: ReactNode;
  /** Boutons alignes a droite du titre. */
  actions?: ReactNode;
  /** Barre d'actions en bas de carte (sur fond papier). */
  pied?: ReactNode;
  /** Niveau du titre (defaut 2). */
  niveauTitre?: 2 | 3 | 4;
}

function classesCarte({ variante = "defaut", sansMarge }: ProprietesStyleCarte, supplement?: string): string {
  return cx("eva-carte", CLASSES_VARIANTE[variante], sansMarge && "eva-carte--sans-marge", supplement);
}

/**
 * Conteneur blanc standard. Sans `titre`, `actions` ni `pied`, c'est un simple
 * conteneur (comportement historique) ; avec, il compose en-tete/corps/pied.
 */
export default function Carte({
  children,
  className,
  variante,
  sansMarge,
  titre,
  description,
  actions,
  pied,
  niveauTitre = 2,
  ...reste
}: ProprietesCarte) {
  const Titre = `h${niveauTitre}` as "h2" | "h3" | "h4";
  const aEntete = titre !== undefined || actions !== undefined;
  const structure = aEntete || pied !== undefined;

  return (
    <div className={classesCarte({ variante, sansMarge }, className)} {...reste}>
      {aEntete && (
        <div className="eva-carte__entete">
          <div>
            {titre !== undefined && <Titre className="eva-carte__titre">{titre}</Titre>}
            {description && <p className="eva-carte__description">{description}</p>}
          </div>
          {actions && <div className="eva-groupe-boutons">{actions}</div>}
        </div>
      )}
      {structure ? <div className="eva-carte__corps">{children}</div> : children}
      {pied !== undefined && <div className="eva-carte__pied">{pied}</div>}
    </div>
  );
}

type ProprietesCarteLien = ProprietesStyleCarte & LinkProps;

/** Carte entiere cliquable (navigation react-router) : raccourcis, cartes de choix. */
export function CarteLien({ variante, sansMarge, className, children, ...reste }: ProprietesCarteLien) {
  return (
    <Link className={classesCarte({ variante, sansMarge }, cx("eva-carte--interactive", className))} {...reste}>
      {children}
    </Link>
  );
}
