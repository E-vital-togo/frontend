/**
 * Casse imposée à un champ texte (contrainte « casse » du catalogue). Même
 * règle que backend/apps/catalogue/contraintes.appliquer_casse, qui
 * l'applique de toute façon à l'enregistrement.
 */
export type Casse = "majuscules" | "initiales";

function initiale(mot: string): string {
  return mot ? mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase() : mot;
}

export function appliquerCasse(texte: string, casse: Casse | undefined | null): string {
  if (!casse || typeof texte !== "string") return texte;
  if (casse === "majuscules") return texte.toUpperCase();
  return texte
    .split(" ")
    .map((mot) => mot.split("-").map(initiale).join("-"))
    .join(" ");
}
