import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

export type VarianteBouton = "principal" | "secondaire" | "accent" | "danger" | "fantome";
export type TailleBouton = "petit" | "moyen" | "grand";

export function classesBouton(variante: VarianteBouton = "principal", taille: TailleBouton = "moyen"): string {
  return `eva-bouton eva-bouton--${variante} eva-bouton--${taille}`;
}

interface ProprietesCommunes {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  iconeGauche?: ReactNode;
  iconeDroite?: ReactNode;
  chargement?: boolean;
  children: ReactNode;
}

type ProprietesBouton = ProprietesCommunes & ButtonHTMLAttributes<HTMLButtonElement>;

/** Bouton standard de l'app : seul point d'entree pour un <button>, garantit des variantes coherentes partout. */
export default function Bouton({
  variante = "principal",
  taille = "moyen",
  iconeGauche,
  iconeDroite,
  chargement = false,
  disabled,
  className,
  children,
  ...reste
}: ProprietesBouton) {
  return (
    <button
      className={[classesBouton(variante, taille), className].filter(Boolean).join(" ")}
      disabled={disabled || chargement}
      {...reste}
    >
      {chargement ? <span className="eva-spinner" style={{ color: "currentColor" }} /> : iconeGauche}
      {children}
      {!chargement && iconeDroite}
    </button>
  );
}

type ProprietesLienBouton = ProprietesCommunes & LinkProps;

/** Meme rendu visuel qu'un Bouton, mais navigue via react-router (ex: "Ouvrir le dossier"). */
export function LienBouton({
  variante = "principal",
  taille = "moyen",
  iconeGauche,
  iconeDroite,
  className,
  children,
  ...reste
}: ProprietesLienBouton) {
  return (
    <Link className={[classesBouton(variante, taille), className].filter(Boolean).join(" ")} {...reste}>
      {iconeGauche}
      {children}
      {iconeDroite}
    </Link>
  );
}

type ProprietesAncreBouton = ProprietesCommunes & AnchorHTMLAttributes<HTMLAnchorElement>;

/** Meme rendu, pour un <a> classique (ex: telecharger un PDF). */
export function AncreBouton({
  variante = "principal",
  taille = "moyen",
  iconeGauche,
  iconeDroite,
  className,
  children,
  ...reste
}: ProprietesAncreBouton) {
  return (
    <a className={[classesBouton(variante, taille), className].filter(Boolean).join(" ")} {...reste}>
      {iconeGauche}
      {children}
      {iconeDroite}
    </a>
  );
}
