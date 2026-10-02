import logoHorizontal from "../assets/brand/recvit-logo-horizontal.svg";
import logoHorizontalInverse from "../assets/brand/recvit-logo-horizontal-inverse.svg";
import logoBaseline from "../assets/brand/recvit-logo-baseline.svg";
import logoVertical from "../assets/brand/recvit-logo-vertical.svg";
import symboleEmeraude from "../assets/brand/recvit-symbole-emeraude.svg";
import symboleBlanc from "../assets/brand/recvit-symbole-blanc.svg";

type VarianteLogo = "horizontal" | "horizontal-inverse" | "baseline" | "vertical" | "symbole";
type TonSymbole = "emeraude" | "blanc";

interface ProprietesLogo {
  variante?: VarianteLogo;
  ton?: TonSymbole;
  /** Hauteur affichee en px. La largeur en decoule (ratio reel du SVG). */
  hauteur?: number;
  alt?: string;
}

const SOURCES: Record<VarianteLogo, string | Record<TonSymbole, string>> = {
  horizontal: logoHorizontal,
  "horizontal-inverse": logoHorizontalInverse,
  baseline: logoBaseline,
  vertical: logoVertical,
  symbole: { emeraude: symboleEmeraude, blanc: symboleBlanc }
};

/** Rapport largeur / hauteur du viewBox de chaque SVG (docs/logos). */
const RATIOS: Record<VarianteLogo, number> = {
  horizontal: 195 / 80,
  "horizontal-inverse": 195 / 80,
  baseline: 195 / 100,
  vertical: 240 / 200,
  symbole: 1
};

/** Cahier d'identite RECVIT : un logo complet ne s'affiche jamais sous 96 px de large ; en dessous, symbole seul. */
export const LARGEUR_MIN_LOGO = 96;

/**
 * Point d'entree UNIQUE pour afficher le logo dans toute l'app : jamais de
 * texte "RECVIT" recompose a la main, jamais de couleur du symbole choisie
 * au hasard. Respecte les regles du cahier d'identite (zone de respect,
 * pas de deformation, pas d'inversion des segments, pas d'effet) et
 * bascule automatiquement sur le symbole seul quand un logo complet serait
 * affiche sous 96 px de large (blanc pour les versions inversees).
 */
export default function Logo({ variante = "horizontal", ton = "emeraude", hauteur = 28, alt = "RECVIT" }: ProprietesLogo) {
  let varianteEffective = variante;
  let tonEffectif = ton;
  if (variante !== "symbole" && hauteur * RATIOS[variante] < LARGEUR_MIN_LOGO) {
    if (import.meta.env.DEV) {
      console.warn(`Logo "${variante}" affiche a ${Math.round(hauteur * RATIOS[variante])} px de large (< ${LARGEUR_MIN_LOGO} px) : symbole seul utilise a la place.`);
    }
    varianteEffective = "symbole";
    tonEffectif = variante === "horizontal-inverse" ? "blanc" : ton;
  }

  const source = SOURCES[varianteEffective];
  const src = typeof source === "string" ? source : source[tonEffectif];
  const largeur = Math.round(hauteur * RATIOS[varianteEffective]);

  return <img src={src} alt={alt} width={largeur} height={hauteur} style={{ display: "block" }} />;
}
