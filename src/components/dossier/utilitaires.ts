import { joursRestants, echeanceActive } from "../../lib/urgence";
import { formaterValeurChamp } from "../../lib/formulaire";
import type { VarianteBadge } from "../ui/Badge";
import type { ChampFormulaireEffectif, Dossier } from "../../types/domaine";

export function champEstVide(valeur: unknown): boolean {
  return valeur === null || valeur === undefined || valeur === "" || (Array.isArray(valeur) && valeur.length === 0);
}

/** Texte brut d'une valeur quelconque (champ inconnu de la configuration actuelle). */
export function formaterValeur(valeur: unknown): string {
  if (champEstVide(valeur)) return "(vide)";
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

/** Valeur lisible d'un champ connu (libellé d'une option, date en jj/mm/aaaa, Oui/Non), sinon texte brut. */
export function formaterValeurPourChamp(champ: ChampFormulaireEffectif | undefined, valeur: unknown): string {
  if (!champ) return formaterValeur(valeur);
  return formaterValeurChamp(champ, valeur) ?? "(vide)";
}

const MOTIF_DATE_SIMPLE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date "2026-09-18" ou horodatage ISO en jj/mm/aaaa ; "-" si absente. */
export function formaterDate(valeur: string | null | undefined): string {
  if (!valeur) return "-";
  const simple = MOTIF_DATE_SIMPLE.exec(valeur);
  if (simple) return `${simple[3]}/${simple[2]}/${simple[1]}`;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
}

export function formaterDateHeure(valeur: string | null | undefined): string {
  if (!valeur) return "-";
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return valeur;
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const LIBELLES_SOURCE: Record<string, string> = {
  dhis2: "DHIS2",
  parent: "Le parent ou déclarant",
  agent_sante: "L'agent de santé",
  agent_cec: "L'agent d'état civil"
};

export function libelleSource(source: string): string {
  return LIBELLES_SOURCE[source] ?? LIBELLES_SOURCE.agent_cec;
}

export type EtatEcheance = "a_temps" | "proche" | "depassee" | "inactive";

export interface ResumeEcheance {
  etat: EtatEcheance;
  libelle: string;
  variante: VarianteBadge;
}

function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

/**
 * État de l'échéance d'un dossier : seuls les statuts encore "en course"
 * (reçu, notifié, en attente de complément) ont une échéance active. Mêmes
 * seuils que le reste de l'application (J-10 proche, J-3 urgent : voir
 * lib/urgence.ts).
 */
export function resumeEcheance(dossier: Pick<Dossier, "statut" | "date_limite" | "est_expire">): ResumeEcheance {
  if (!echeanceActive(dossier.statut)) return { etat: "inactive", libelle: "", variante: "neutre" };
  const jours = joursRestants(dossier.date_limite);
  if (dossier.est_expire || jours < 0) {
    return {
      etat: "depassee",
      libelle: jours < 0 ? `Dépassée de ${pluriel(-jours, "jour")}` : "Délai dépassé",
      variante: "danger"
    };
  }
  if (jours <= 10) {
    const texte = jours === 0 ? "Dernier jour" : `${pluriel(jours, "jour")} restant${jours > 1 ? "s" : ""}`;
    return { etat: "proche", libelle: `Proche : ${texte}`, variante: jours <= 3 ? "danger" : "attente" };
  }
  return { etat: "a_temps", libelle: `À temps : ${pluriel(jours, "jour")} restants`, variante: "succes" };
}
