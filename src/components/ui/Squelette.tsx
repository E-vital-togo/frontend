import type { CSSProperties } from "react";
import { cx } from "./utilitaires";

export type VarianteSquelette = "texte" | "titre" | "bloc" | "rond" | "bouton" | "carte" | "stats" | "tableau";

interface ProprietesSquelette {
  /**
   * Forme du placeholder :
   * - texte : `lignes` lignes de texte (la derniere est plus courte)
   * - titre, bloc (120px), rond (avatar), bouton : une forme
   * - carte : une carte (pastille + texte)
   * - stats : `lignes` cartes de chiffres cles (defaut 4)
   * - tableau : `lignes` lignes x `colonnes` colonnes dans un cadre
   */
  variante?: VarianteSquelette;
  /** Nombre de lignes (texte, tableau) ou de cartes (stats). */
  lignes?: number;
  /** Nombre de colonnes (tableau, defaut 4). */
  colonnes?: number;
  /** Largeur (nombre = px, ou toute valeur CSS) pour texte, titre, bloc, rond, bouton. */
  largeur?: number | string;
  hauteur?: number | string;
  /** Texte annonce aux lecteurs d'ecran (defaut : "Chargement en cours" pour carte, stats, tableau). */
  libelle?: string;
  className?: string;
}

function dimension(valeur: number | string | undefined): string | undefined {
  return typeof valeur === "number" ? `${valeur}px` : valeur;
}

function Barre({ variante, largeur, hauteur, className }: { variante: VarianteSquelette; largeur?: string; hauteur?: string; className?: string }) {
  const style: CSSProperties = {};
  if (largeur) style.width = largeur;
  if (hauteur) style.height = hauteur;
  return <span className={cx("eva-squelette", `eva-squelette--${variante}`, className)} style={style} />;
}

/**
 * Placeholder anime d'un contenu en cours de chargement. A preferer au texte
 * "Chargement..." des qu'on connait la forme de ce qui va apparaitre (liste,
 * cartes de chiffres, fiche). Purement visuel : la page annonce le chargement
 * via `libelle`.
 */
export default function Squelette({ variante = "texte", lignes, colonnes = 4, largeur, hauteur, libelle, className }: ProprietesSquelette) {
  const w = dimension(largeur);
  const h = dimension(hauteur);
  const annonce = libelle ?? (variante === "carte" || variante === "stats" || variante === "tableau" ? "Chargement en cours" : undefined);

  let contenu;
  if (variante === "texte") {
    const nombre = lignes ?? 3;
    contenu = (
      <div className="eva-squelette-groupe" style={w ? { maxWidth: w } : undefined}>
        {Array.from({ length: nombre }, (_, i) => (
          <Barre key={i} variante="texte" hauteur={h} />
        ))}
      </div>
    );
  } else if (variante === "carte") {
    contenu = (
      <div className={cx("eva-carte", "eva-squelette-carte", className)}>
        <div className="eva-squelette-carte__entete">
          <Barre variante="rond" />
          <div className="eva-squelette-groupe">
            <Barre variante="titre" largeur="55%" hauteur="16px" />
            <Barre variante="texte" hauteur="12px" largeur="35%" />
          </div>
        </div>
        <div className="eva-squelette-groupe">
          {Array.from({ length: lignes ?? 3 }, (_, i) => (
            <Barre key={i} variante="texte" />
          ))}
        </div>
      </div>
    );
  } else if (variante === "stats") {
    contenu = (
      <div className={cx("eva-squelette-stats", className)}>
        {Array.from({ length: lignes ?? 4 }, (_, i) => (
          <div key={i} className="eva-carte eva-squelette-stat">
            <Barre variante="texte" />
            <Barre variante="texte" />
          </div>
        ))}
      </div>
    );
  } else if (variante === "tableau") {
    const modele = { gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` };
    contenu = (
      <div className={cx("eva-tableau-conteneur", "eva-squelette-tableau", className)}>
        {Array.from({ length: (lignes ?? 5) + 1 }, (_, i) => (
          <div key={i} className="eva-squelette-tableau__ligne" style={modele}>
            {Array.from({ length: colonnes }, (_, j) => (
              <Barre key={j} variante="texte" largeur={j === 0 ? "80%" : j % 2 ? "55%" : "70%"} />
            ))}
          </div>
        ))}
      </div>
    );
  } else {
    contenu = <Barre variante={variante} largeur={w} hauteur={h} className={className} />;
  }

  return (
    <div role={annonce ? "status" : undefined} aria-busy={annonce ? true : undefined}>
      {annonce && <span className="eva-sr-only">{annonce}</span>}
      <div aria-hidden="true">{contenu}</div>
    </div>
  );
}
