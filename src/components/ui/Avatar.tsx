import { cx } from "./utilitaires";

/** Initiales (prenom puis nom) en majuscules : "Awa Koné" -> "AK". */
export function initiales(nom: string, prenoms?: string): string {
  const premiere = (texte?: string) => Array.from((texte ?? "").trim())[0] ?? "";
  return `${premiere(prenoms)}${premiere(nom)}`.toUpperCase();
}

interface ProprietesAvatar {
  nom: string;
  prenoms?: string;
  taille?: "petit" | "moyen" | "grand";
  /** citron (defaut, marque), emeraude (plein), doux (fond emeraude clair), neutre. */
  ton?: "citron" | "emeraude" | "doux" | "neutre";
  className?: string;
}

/** Pastille ronde d'initiales pour representer une personne (utilisateur, agent, declarant). */
export default function Avatar({ nom, prenoms, taille = "moyen", ton = "citron", className }: ProprietesAvatar) {
  return (
    <span
      className={cx("eva-avatar", taille !== "moyen" && `eva-avatar--${taille}`, ton !== "citron" && `eva-avatar--${ton}`, className)}
      aria-hidden="true"
    >
      {initiales(nom, prenoms)}
    </span>
  );
}
