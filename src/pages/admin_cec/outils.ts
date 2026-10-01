import { ErreurApi } from "../../lib/apiClient";
import type { TypeEvenement } from "../../types/domaine";

/** Message lisible pour une erreur d'appel API (message du serveur si disponible). */
export function messageErreur(e: unknown, repli = "Une erreur inattendue est survenue. Réessayez."): string {
  return e instanceof ErreurApi ? e.message : repli;
}

/** "1 dossier" / "12 dossiers" (séparateur de milliers français). */
export function compterAvecUnite(nombre: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${nombre.toLocaleString("fr-FR")} ${nombre > 1 ? pluriel : singulier}`;
}

export function libelleEvenement(type: TypeEvenement | string | null | undefined): string {
  if (type === "naissance") return "Naissance";
  if (type === "deces") return "Décès";
  return "-";
}

export function formaterDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("fr-FR");
}

export function formaterDateHeure(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/** "nom_enfant" devient "Nom enfant" : lisible quand seul le code technique du champ est connu. */
export function libelleDepuisCode(code: string): string {
  const texte = code.replace(/[_-]+/g, " ").trim();
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : code;
}
