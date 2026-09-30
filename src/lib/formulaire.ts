/**
 * Logique PURE des formulaires de dossier (aucun import React : testable
 * sous node, voir scripts/test-formulaire.mjs) - groupement des champs par
 * etape, largeur de grille, validation d'etape, formatage de recapitulatif.
 *
 * Contrat serveur : docs/formulaires-etapes.md. Rappel des points qui
 * structurent ce module :
 *  - `champs` est DEJA dans l'ordre de rendu, on ne retrie jamais ;
 *  - `mise_en_page.etapes` est dans l'ordre de rendu (l'ordre du tableau fait foi) ;
 *  - `mise_en_page` peut manquer (ancien serveur, ancien cache hors-ligne) :
 *    retour a la liste plate, qui est de toute facon dans le bon ordre ;
 *  - le serveur reste l'arbitre final de la validation : tout ce qui est
 *    calcule ici n'est qu'un confort de saisie.
 */
import type { ChampFormulaireEffectif, LargeurChamp, MiseEnPage } from "../types/domaine";

export type ColonnesGrille = 3 | 4 | 6 | 8 | 12;

const COLONNES_PAR_LARGEUR: Record<Exclude<LargeurChamp, "auto">, ColonnesGrille> = {
  quart: 3,
  tiers: 4,
  moitie: 6,
  deux_tiers: 8,
  complet: 12
};

/**
 * Nombre de colonnes (sur 12) occupees par un champ. `auto` (ou une valeur
 * inconnue d'un futur serveur) : le rendu choisit selon le type - texte long
 * et choix multiples en pleine largeur, champs courts (date, nombre,
 * interrupteur) au tiers, le reste a la moitie.
 */
export function colonnesChamp(champ: Pick<ChampFormulaireEffectif, "largeur" | "type_champ">): ColonnesGrille {
  const largeur = champ.largeur;
  if (largeur && largeur !== "auto" && largeur in COLONNES_PAR_LARGEUR) {
    return COLONNES_PAR_LARGEUR[largeur];
  }
  switch (champ.type_champ) {
    case "texte_long":
    case "select_multiple":
      return 12;
    case "booleen":
    case "date":
    case "nombre_entier":
    case "nombre_decimal":
      return 4;
    default:
      return 6;
  }
}

export function versTexte(valeur: unknown): string {
  return typeof valeur === "string" || typeof valeur === "number" ? String(valeur) : "";
}

export function estCoche(valeur: unknown): boolean {
  return valeur === true || valeur === "true" || valeur === 1 || valeur === "1" || valeur === "oui";
}

/** Un booleen `false` ou un 0 sont des reponses : seuls null/undefined/""/[] sont "vides". */
export function estVide(valeur: unknown): boolean {
  return valeur === null || valeur === undefined || valeur === "" || (Array.isArray(valeur) && valeur.length === 0);
}

/**
 * Valeur a afficher : la saisie de l'utilisateur si le champ a ete modifie
 * (meme vidé : `null` est une vraie modification, pas un retour a la valeur
 * d'origine), sinon la valeur enregistree.
 */
export function valeurEffective(champ: ChampFormulaireEffectif, modifiees: Record<string, unknown>): unknown {
  return champ.data_element_code in modifiees ? modifiees[champ.data_element_code] : champ.valeur_actuelle;
}

// ------------------------------------------------------------------ plan

export interface EtapeRendue {
  /** Cle stable pour React / memorisation (l'etape virtuelle n'a pas d'id). */
  cle: string;
  id: string | null;
  titre: string;
  description: string;
  champs: ChampFormulaireEffectif[];
}

export interface PlanFormulaire {
  /** "etapes" seulement s'il y a au moins DEUX etapes a parcourir. */
  mode: "lineaire" | "etapes";
  /** Toujours vide en lineaire, sauf une etape unique dont on affiche le titre en en-tete de section. */
  etapes: EtapeRendue[];
  champs: ChampFormulaireEffectif[];
}

const TITRE_ETAPE_VIRTUELLE = "Autres informations";

/**
 * Transforme la reponse serveur (champs + mise_en_page) en plan de rendu.
 * Defensif : une entree de cache desynchronisee (champ dont l'etape n'est
 * pas dans la mise en page, etape sans champ) ne doit jamais faire
 * disparaitre un champ ni afficher une page blanche.
 */
export function planFormulaire(champs: ChampFormulaireEffectif[], miseEnPage?: MiseEnPage | null): PlanFormulaire {
  const lineaire: PlanFormulaire = { mode: "lineaire", etapes: [], champs };
  if (!miseEnPage || miseEnPage.mode !== "etapes" || !Array.isArray(miseEnPage.etapes) || miseEnPage.etapes.length === 0) {
    return lineaire;
  }

  const etapes: EtapeRendue[] = [];
  const parId = new Map<string | null, EtapeRendue>();
  miseEnPage.etapes.forEach((etape, index) => {
    const id = etape.id ?? null;
    if (parId.has(id)) return; // doublon : on garde la premiere occurrence
    const rendue: EtapeRendue = {
      cle: id ? `etape-${id}` : `etape-virtuelle-${index}`,
      id,
      titre: etape.titre,
      description: etape.description || "",
      champs: []
    };
    parId.set(id, rendue);
    etapes.push(rendue);
  });

  const orphelins: ChampFormulaireEffectif[] = [];
  for (const champ of champs) {
    const etape = parId.get(champ.etape_id ?? null);
    if (etape) etape.champs.push(champ);
    else orphelins.push(champ);
  }
  if (orphelins.length > 0) {
    let virtuelle = parId.get(null);
    if (!virtuelle) {
      virtuelle = { cle: "etape-virtuelle-orphelins", id: null, titre: TITRE_ETAPE_VIRTUELLE, description: "", champs: [] };
      etapes.push(virtuelle);
    }
    virtuelle.champs.push(...orphelins);
  }

  const nonVides = etapes.filter((etape) => etape.champs.length > 0);
  if (nonVides.length >= 2) return { mode: "etapes", etapes: nonVides, champs };
  // Zero ou une etape : un stepper n'a aucun sens, liste plate (avec le titre de l'etape unique).
  return { mode: "lineaire", etapes: nonVides, champs };
}

// ------------------------------------------------------------ validation

export type LecteurValeur = (champ: ChampFormulaireEffectif) => unknown;

/**
 * Champs obligatoires a renseigner : visibles (le serveur ne renvoie que
 * ceux-la) et NON readonly - un champ en lecture seule (valeur DHIS2) ne peut
 * pas etre complete par l'utilisateur, le bloquer serait une impasse.
 */
export function champsManquants(champs: ChampFormulaireEffectif[], valeurDe: LecteurValeur): ChampFormulaireEffectif[] {
  return champs.filter((champ) => champ.obligatoire && !champ.readonly && estVide(valeurDe(champ)));
}

/** Indice de la premiere etape (dans [de, a] inclus) qui a un champ obligatoire manquant, sinon -1. */
export function premiereEtapeIncomplete(etapes: EtapeRendue[], valeurDe: LecteurValeur, de: number, a: number): number {
  for (let i = Math.max(0, de); i <= Math.min(a, etapes.length - 1); i++) {
    if (champsManquants(etapes[i].champs, valeurDe).length > 0) return i;
  }
  return -1;
}

// ---------------------------------------------------------- recapitulatif

/** Valeur lisible pour le recapitulatif ; null si le champ est vide. */
export function formaterValeurChamp(champ: ChampFormulaireEffectif, valeur: unknown): string | null {
  if (estVide(valeur)) return null;
  const libelle = (code: unknown) => champ.options.find((option) => option.valeur === String(code))?.libelle ?? String(code);
  switch (champ.type_champ) {
    case "booleen":
      return estCoche(valeur) ? "Oui" : "Non";
    case "select":
      return libelle(valeur);
    case "select_multiple":
      return Array.isArray(valeur) ? valeur.map(libelle).join(", ") : libelle(valeur);
    case "date": {
      const texte = versTexte(valeur);
      const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
      return morceaux ? `${morceaux[3]}/${morceaux[2]}/${morceaux[1]}` : texte;
    }
    default:
      return typeof valeur === "object" ? JSON.stringify(valeur) : String(valeur);
  }
}

// ------------------------------------------- memorisation de l'etape (session)

const PREFIXE_ETAPE = "evital:etape-formulaire:";

/** Etape courante memorisee pour `cle` (par dossier) pendant la session, bornee a [0, max]. */
export function lireEtapeMemorisee(cle: string | undefined, max: number): number {
  if (!cle) return 0;
  try {
    const brut = sessionStorage.getItem(PREFIXE_ETAPE + cle);
    const indice = brut === null ? NaN : Number.parseInt(brut, 10);
    if (Number.isFinite(indice) && indice >= 0) return Math.min(indice, max);
  } catch {
    // sessionStorage indisponible (navigation privee, politique du navigateur) : on repart de la premiere etape
  }
  return 0;
}

export function memoriserEtape(cle: string | undefined, indice: number): void {
  if (!cle) return;
  try {
    sessionStorage.setItem(PREFIXE_ETAPE + cle, String(indice));
  } catch {
    // idem : la memorisation n'est qu'un confort
  }
}
