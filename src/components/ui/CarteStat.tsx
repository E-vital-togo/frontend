import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "./utilitaires";

export type VarianteCarteStat = "defaut" | "alerte" | "attention" | "muet";

interface ProprietesCarteStat {
  icone?: ReactNode;
  valeur: ReactNode;
  libelle: string;
  /** Raccourci historique de `variante="alerte"` (valeur en rouge). */
  alerte?: boolean;
  /** defaut (emeraude), alerte (rouge), attention (jaune fonce), muet (gris). */
  variante?: VarianteCarteStat;
  /** Petite unite apres la valeur (ex: "jours", "%"). */
  unite?: string;
  /** Ligne de contexte sous le libelle (ex: "+4,2 % ce mois"). */
  detail?: ReactNode;
  /** Rend toute la carte cliquable (navigation react-router). */
  vers?: string;
}

export default function CarteStat({ icone, valeur, libelle, alerte, variante, unite, detail, vers }: ProprietesCarteStat) {
  const teinte = variante ?? (alerte ? "alerte" : "defaut");
  const classes = cx("eva-carte", "eva-carte-stat", teinte !== "defaut" && `eva-carte-stat--${teinte}`, vers && "eva-carte--interactive");
  const contenu = (
    <>
      {icone && (
        <div className="eva-carte-stat__icone" aria-hidden="true">
          {icone}
        </div>
      )}
      <div className="eva-carte-stat__valeur">
        {valeur}
        {unite && <span className="eva-carte-stat__unite">{unite}</span>}
      </div>
      <div className="eva-carte-stat__libelle">{libelle}</div>
      {detail && <div className="eva-carte-stat__detail">{detail}</div>}
    </>
  );

  return vers ? (
    <Link to={vers} className={classes}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}
