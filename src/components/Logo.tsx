import logoHorizontal from "../assets/brand/recvit-logo-horizontal.svg";
import logoHorizontalInverse from "../assets/brand/recvit-logo-horizontal-inverse.svg";
import logoVertical from "../assets/brand/recvit-logo-vertical.svg";
import symboleEmeraude from "../assets/brand/recvit-symbole-emeraude.svg";
import symboleBlanc from "../assets/brand/recvit-symbole-blanc.svg";

type VarianteLogo = "horizontal" | "horizontal-inverse" | "vertical" | "symbole";
type TonSymbole = "emeraude" | "blanc";

interface ProprietesLogo {
  variante?: VarianteLogo;
  ton?: TonSymbole;
  hauteur?: number;
  alt?: string;
}

const SOURCES: Record<VarianteLogo, string | Record<TonSymbole, string>> = {
  horizontal: logoHorizontal,
  "horizontal-inverse": logoHorizontalInverse,
  vertical: logoVertical,
  symbole: { emeraude: symboleEmeraude, blanc: symboleBlanc }
};

/**
 * Point d'entree UNIQUE pour afficher le logo dans toute l'app : jamais de
 * texte "recvit" recompose a la main, jamais de couleur du symbole
 * choisie au hasard. Respecte les regles du cahier d'identite (04 -
 * Protection : zone de respect ; 07 - A faire/A eviter : pas de
 * deformation, pas d'inversion des segments, pas d'effet).
 */
export default function Logo({ variante = "horizontal", ton = "emeraude", hauteur = 28, alt = "RECVIT" }: ProprietesLogo) {
  const source = SOURCES[variante];
  const src = typeof source === "string" ? source : source[ton];

  return <img src={src} alt={alt} height={hauteur} style={{ display: "block" }} />;
}
