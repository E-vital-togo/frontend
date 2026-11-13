/**
 * Conditions d'affichage des champs de formulaire, configurées par l'Admin
 * Général (voir docs/plan-conditions-correspondances.md). Même format et même
 * logique que backend/apps/catalogue/conditions.py : le serveur applique les
 * mêmes règles avant toute vérification d'obligation.
 */
import type { ChampFormulaireEffectif } from "../types/domaine";

export type OperateurCondition = "renseigne" | "vide" | "parmi" | "hors";

export interface RegleCondition {
  champ: string;
  operateur: OperateurCondition;
  valeurs?: string[];
}

export interface Condition {
  mode: "toutes" | "une";
  regles: RegleCondition[];
}

export function estVideCondition(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined) return true;
  if (typeof valeur === "string") return valeur.trim() === "";
  if (Array.isArray(valeur)) return valeur.every(estVideCondition);
  return false;
}

function enTextes(valeur: unknown): string[] {
  if (estVideCondition(valeur)) return [];
  if (Array.isArray(valeur)) return valeur.flatMap(enTextes);
  if (typeof valeur === "boolean") return [valeur ? "true" : "false"];
  return [String(valeur).trim()];
}

function evaluerRegle(regle: RegleCondition, valeurs: Record<string, unknown>): boolean {
  const valeur = valeurs[regle.champ];
  if (regle.operateur === "renseigne") return !estVideCondition(valeur);
  if (regle.operateur === "vide") return estVideCondition(valeur);
  const attendues = new Set((regle.valeurs ?? []).map(String));
  const correspond = enTextes(valeur).some((texte) => attendues.has(texte));
  if (regle.operateur === "parmi") return correspond;
  if (regle.operateur === "hors") return !correspond;
  return true;
}

export function evaluerCondition(condition: Condition | null | undefined, valeurs: Record<string, unknown>): boolean {
  const regles = condition?.regles ?? [];
  if (regles.length === 0) return true;
  return condition?.mode === "une"
    ? regles.some((r) => evaluerRegle(r, valeurs))
    : regles.every((r) => evaluerRegle(r, valeurs));
}

/**
 * Codes des champs à afficher. Un champ masqué compte comme vide pour les
 * conditions des autres (si B dépend de A et que A est masqué, B l'est
 * aussi) : point fixe borné, identique au calcul du serveur.
 */
export function codesAffiches(
  champs: ChampFormulaireEffectif[],
  valeurDe: (champ: ChampFormulaireEffectif) => unknown
): Set<string> {
  const valeurs: Record<string, unknown> = {};
  for (const champ of champs) valeurs[champ.data_element_code] = valeurDe(champ);
  let affiches = new Set(champs.map((c) => c.data_element_code));
  for (let tour = 0; tour <= champs.length; tour++) {
    const lisibles: Record<string, unknown> = {};
    for (const code of affiches) lisibles[code] = valeurs[code];
    const suivants = new Set(
      champs.filter((c) => evaluerCondition(c.condition_affichage, lisibles)).map((c) => c.data_element_code)
    );
    if (suivants.size === affiches.size && [...suivants].every((code) => affiches.has(code))) break;
    affiches = suivants;
  }
  return affiches;
}

/** Les champs à afficher, dans leur ordre d'origine. */
export function champsAffiches(
  champs: ChampFormulaireEffectif[],
  valeurDe: (champ: ChampFormulaireEffectif) => unknown
): ChampFormulaireEffectif[] {
  if (!champs.some((c) => c.condition_affichage)) return champs;
  const affiches = codesAffiches(champs, valeurDe);
  return champs.filter((c) => affiches.has(c.data_element_code));
}

/**
 * Valeurs modifiées à envoyer : celles d'un champ masqué par sa condition ne
 * partent pas (l'utilisateur ne les voit plus). Un code inconnu du formulaire
 * est conservé tel quel : ce n'est pas à ce filtre d'en juger.
 */
export function valeursAEnvoyer(
  champs: ChampFormulaireEffectif[],
  modifiees: Record<string, unknown>,
  valeurDe: (champ: ChampFormulaireEffectif) => unknown
): Record<string, unknown> {
  if (!champs.some((c) => c.condition_affichage)) return modifiees;
  const affiches = codesAffiches(champs, valeurDe);
  const connus = new Set(champs.map((c) => c.data_element_code));
  return Object.fromEntries(Object.entries(modifiees).filter(([code]) => !connus.has(code) || affiches.has(code)));
}
