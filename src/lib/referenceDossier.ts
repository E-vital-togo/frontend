import type { Dossier } from "../types/domaine";

/** Numéro lisible du dossier (« 2026-000123 »), ou début de l'identifiant pour une copie locale ancienne. */
export function referenceDossier(dossier: Pick<Dossier, "id" | "reference">): string {
  return dossier.reference || dossier.id.slice(0, 8);
}
