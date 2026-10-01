import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cx } from "./utilitaires";

export type VarianteBouton = "principal" | "secondaire" | "accent" | "danger" | "danger-plein" | "fantome";
export type TailleBouton = "petit" | "moyen" | "grand";

interface OptionsClasses {
  pleineLargeur?: boolean;
  iconeSeule?: boolean;
  chargement?: boolean;
}

export function classesBouton(variante: VarianteBouton = "principal", taille: TailleBouton = "moyen", options: OptionsClasses = {}): string {
  return cx(
    "eva-bouton",
    `eva-bouton--${variante}`,
    `eva-bouton--${taille}`,
    options.pleineLargeur && "eva-bouton--bloc",
    options.iconeSeule && "eva-bouton--icone",
    options.chargement && "eva-bouton--charge"
  );
}

interface ProprietesCommunes {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  iconeGauche?: ReactNode;
  iconeDroite?: ReactNode;
  chargement?: boolean;
  /** Occupe toute la largeur disponible (remplace `style={{ width: "100%" }}`). */
  pleineLargeur?: boolean;
  /** Bouton carre ne contenant qu'une icone (passer l'icone en `iconeGauche` et un `aria-label`). */
  iconeSeule?: boolean;
  children?: ReactNode;
}

type ProprietesBouton = ProprietesCommunes & ButtonHTMLAttributes<HTMLButtonElement>;

function Contenu({ chargement, iconeGauche, iconeDroite, children }: Pick<ProprietesCommunes, "chargement" | "iconeGauche" | "iconeDroite" | "children">) {
  return (
    <>
      {chargement ? <span className="eva-spinner" aria-hidden="true" /> : iconeGauche}
      {children}
      {!chargement && iconeDroite}
    </>
  );
}

/** Bouton standard de l'app : seul point d'entree pour un <button>, garantit des variantes coherentes partout. */
const Bouton = forwardRef<HTMLButtonElement, ProprietesBouton>(function Bouton(
  {
    variante = "principal",
    taille = "moyen",
    iconeGauche,
    iconeDroite,
    chargement = false,
    pleineLargeur,
    iconeSeule,
    disabled,
    className,
    children,
    ...reste
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={cx(classesBouton(variante, taille, { pleineLargeur, iconeSeule, chargement }), className)}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      {...reste}
    >
      <Contenu chargement={chargement} iconeGauche={iconeGauche} iconeDroite={iconeDroite}>
        {children}
      </Contenu>
    </button>
  );
});

export default Bouton;

type ProprietesLienBouton = ProprietesCommunes & LinkProps & { desactive?: boolean };

function bloquerSiDesactive(desactive: boolean | undefined, surClic: ((e: MouseEvent<HTMLAnchorElement>) => void) | undefined) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (desactive) {
      e.preventDefault();
      return;
    }
    surClic?.(e);
  };
}

/** Meme rendu visuel qu'un Bouton, mais navigue via react-router (ex: "Ouvrir le dossier"). */
export function LienBouton({
  variante = "principal",
  taille = "moyen",
  iconeGauche,
  iconeDroite,
  chargement: _chargement,
  pleineLargeur,
  iconeSeule,
  desactive,
  className,
  children,
  onClick,
  ...reste
}: ProprietesLienBouton) {
  return (
    <Link
      className={cx(classesBouton(variante, taille, { pleineLargeur, iconeSeule }), className)}
      aria-disabled={desactive || undefined}
      tabIndex={desactive ? -1 : undefined}
      onClick={bloquerSiDesactive(desactive, onClick)}
      {...reste}
    >
      {iconeGauche}
      {children}
      {iconeDroite}
    </Link>
  );
}

type ProprietesAncreBouton = ProprietesCommunes & AnchorHTMLAttributes<HTMLAnchorElement> & { desactive?: boolean };

/** Meme rendu, pour un <a> classique (ex: telecharger un PDF). */
export function AncreBouton({
  variante = "principal",
  taille = "moyen",
  iconeGauche,
  iconeDroite,
  chargement: _chargement,
  pleineLargeur,
  iconeSeule,
  desactive,
  className,
  children,
  onClick,
  ...reste
}: ProprietesAncreBouton) {
  return (
    <a
      className={cx(classesBouton(variante, taille, { pleineLargeur, iconeSeule }), className)}
      aria-disabled={desactive || undefined}
      tabIndex={desactive ? -1 : undefined}
      onClick={bloquerSiDesactive(desactive, onClick)}
      {...reste}
    >
      {iconeGauche}
      {children}
      {iconeDroite}
    </a>
  );
}
