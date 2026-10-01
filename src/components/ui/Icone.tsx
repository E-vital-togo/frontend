import type { LucideIcon } from "lucide-react";
import { cx } from "./utilitaires";

export type TailleIcone = "petit" | "normal" | "grand" | "xl" | number;

const TAILLES: Record<Exclude<TailleIcone, number>, number> = { petit: 15, normal: 18, grand: 24, xl: 40 };

interface ProprietesIcone {
  /** Icone lucide-react (ex: `Search`). */
  icone: LucideIcon;
  /** petit 15px, normal 18px (defaut), grand 24px, xl 40px, ou une taille en pixels. */
  taille?: TailleIcone;
  /** Texte alternatif. Sans `titre`, l'icone est decorative (masquee aux lecteurs d'ecran). */
  titre?: string;
  className?: string;
}

/**
 * Icone uniforme : taille et epaisseur de trait coherentes, decorative par
 * defaut (aria-hidden). A preferer a `<Search size={17} />` dans les pages.
 */
export default function Icone({ icone: Composant, taille = "normal", titre, className }: ProprietesIcone) {
  const pixels = typeof taille === "number" ? taille : TAILLES[taille];
  return (
    <Composant
      size={pixels}
      strokeWidth={taille === "xl" ? 1.6 : 2}
      className={cx("eva-icone", className)}
      aria-hidden={titre ? undefined : true}
      aria-label={titre}
      role={titre ? "img" : undefined}
      focusable="false"
    />
  );
}
