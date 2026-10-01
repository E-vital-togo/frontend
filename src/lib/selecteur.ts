/**
 * Logique pure (sans framework ni DOM) du selecteur maison E-Vital, partagee par :
 *  - le composant React `components/ui/Selecteur.tsx`,
 *  - le widget vanilla des gabarits Django `lib/selecteurDjango.ts`
 *    (bundle `backend/static/js/evital_selecteur.js`).
 * Recherche insensible aux accents et a la casse, surlignage, navigation,
 * saisie rapide (type-ahead) et calcul de position du panneau.
 */

export interface OptionBrute {
  valeur: string;
  libelle: string;
  /** Texte secondaire affiche sous le libelle (et inclus dans la recherche). */
  description?: string;
  /** Entete de groupe : les options consecutives d'un meme groupe sont regroupees. */
  groupe?: string;
  desactivee?: boolean;
  /** Mots-cles supplementaires pour la recherche (non affiches). */
  recherche?: string;
}

/** Nombre d'options a partir duquel la barre de recherche apparait (mode "auto"). */
export const SEUIL_RECHERCHE_DEFAUT = 7;

/** Largeur d'ecran sous laquelle le panneau devient une feuille basse. */
export const REQUETE_MOBILE = "(max-width: 559.98px)";

export const TEXTES = {
  placeholder: "Choisir...",
  rechercher: "Rechercher...",
  rechercherEtiquette: "Rechercher dans la liste",
  aucunResultat: "Aucun résultat",
  aucuneOption: "Aucune option disponible",
  effacer: "Effacer la sélection",
  toutEffacer: "Tout effacer",
  terminer: "Terminer",
  fermer: "Fermer la liste",
  effacerRecherche: "Effacer la recherche"
} as const;

const MARQUES = /[̀-ͯ]/g;

export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(MARQUES, "").toLowerCase();
}

/** Texte normalise + correspondance indice normalise -> indice du texte d'origine (pour le surlignage). */
export function normaliserAvecIndex(texte: string): { norme: string; index: number[] } {
  let norme = "";
  const index: number[] = [];
  let position = 0;
  for (const caractere of Array.from(texte)) {
    const n = caractere.normalize("NFD").replace(MARQUES, "").toLowerCase();
    for (let i = 0; i < n.length; i++) index.push(position);
    norme += n;
    position += caractere.length;
  }
  return { norme, index };
}

export function jetonsRecherche(requete: string): string[] {
  return normaliser(requete)
    .split(/\s+/)
    .filter(Boolean);
}

function textePourRecherche(option: OptionBrute): string {
  return normaliser([option.libelle, option.description ?? "", option.recherche ?? ""].join(" "));
}

/** Filtre les options : tous les mots de la requete doivent se retrouver (libelle, description, mots-cles). */
export function filtrerOptions<T extends OptionBrute>(options: readonly T[], requete: string): T[] {
  const jetons = jetonsRecherche(requete);
  if (jetons.length === 0) return options.slice();
  return options.filter((option) => {
    const texte = textePourRecherche(option);
    return jetons.every((jeton) => texte.includes(jeton));
  });
}

/** Plages [debut, fin[ du texte d'origine a surligner (fusionnees, triees). */
export function plagesSurlignage(texte: string, jetons: readonly string[]): Array<[number, number]> {
  if (jetons.length === 0 || !texte) return [];
  const { norme, index } = normaliserAvecIndex(texte);
  const brutes: Array<[number, number]> = [];
  for (const jeton of jetons) {
    let depuis = 0;
    for (;;) {
      const trouve = norme.indexOf(jeton, depuis);
      if (trouve < 0) break;
      const debut = index[trouve];
      const dernier = index[trouve + jeton.length - 1];
      // La fin couvre le caractere d'origine complet (paire de substitution comprise).
      const fin = dernier + ((texte.codePointAt(dernier) ?? 0) > 0xffff ? 2 : 1);
      brutes.push([debut, fin]);
      depuis = trouve + Math.max(1, jeton.length);
    }
  }
  brutes.sort((a, b) => a[0] - b[0]);
  const fusionnees: Array<[number, number]> = [];
  for (const plage of brutes) {
    const derniere = fusionnees[fusionnees.length - 1];
    if (derniere && plage[0] <= derniere[1]) derniere[1] = Math.max(derniere[1], plage[1]);
    else fusionnees.push([plage[0], plage[1]]);
  }
  return fusionnees;
}

/** Decoupe un texte en morceaux { texte, surligne } selon les jetons de recherche. */
export function morceauxSurlignes(texte: string, jetons: readonly string[]): Array<{ texte: string; surligne: boolean }> {
  const plages = plagesSurlignage(texte, jetons);
  if (plages.length === 0) return [{ texte, surligne: false }];
  const morceaux: Array<{ texte: string; surligne: boolean }> = [];
  let curseur = 0;
  for (const [debut, fin] of plages) {
    if (debut > curseur) morceaux.push({ texte: texte.slice(curseur, debut), surligne: false });
    morceaux.push({ texte: texte.slice(debut, fin), surligne: true });
    curseur = fin;
  }
  if (curseur < texte.length) morceaux.push({ texte: texte.slice(curseur), surligne: false });
  return morceaux;
}

export type ModeRecherche = "auto" | boolean;

export function rechercheAffichee(mode: ModeRecherche, nombreOptions: number, seuil: number): boolean {
  if (mode === "auto") return nombreOptions > seuil;
  return mode;
}

/** Indice de la prochaine option activable dans `visibles` (saute les options desactivees), avec bouclage. */
export function indexSuivant(visibles: ReadonlyArray<{ desactivee?: boolean }>, courant: number, sens: 1 | -1): number {
  const n = visibles.length;
  if (n === 0) return -1;
  let i = courant;
  for (let essai = 0; essai < n; essai++) {
    i = (i + sens + n) % n;
    if (!visibles[i].desactivee) return i;
  }
  return -1;
}

export function premierActivable(visibles: ReadonlyArray<{ desactivee?: boolean }>): number {
  return visibles.findIndex((o) => !o.desactivee);
}

export function dernierActivable(visibles: ReadonlyArray<{ desactivee?: boolean }>): number {
  for (let i = visibles.length - 1; i >= 0; i--) if (!visibles[i].desactivee) return i;
  return -1;
}

/** Touche imprimable utilisable pour la saisie rapide ou la recherche (sans Ctrl, Alt, Meta). */
export function toucheImprimable(evenement: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return evenement.key.length === 1 && !evenement.ctrlKey && !evenement.metaKey && !evenement.altKey;
}

/**
 * Saisie rapide (type-ahead) : cumule les caracteres tapes dans un delai court et renvoie l'indice
 * de la premiere option activable dont le libelle commence par la saisie (a partir de la position courante).
 */
export class SaisieRapide {
  private tampon = "";
  private minuteur: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly delai = 700) {}

  chercher(caractere: string, visibles: ReadonlyArray<OptionBrute>, courant: number): number {
    this.tampon += normaliser(caractere);
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => {
      this.tampon = "";
    }, this.delai);
    const n = visibles.length;
    if (n === 0) return -1;
    // Meme lettre repetee : on passe a l'option suivante qui commence par cette lettre.
    const repetee = this.tampon.length > 1 && this.tampon.split("").every((c) => c === this.tampon[0]);
    const motif = repetee ? this.tampon[0] : this.tampon;
    const depart = repetee || courant < 0 ? courant + 1 : courant;
    for (let k = 0; k < n; k++) {
      const i = (((depart + k) % n) + n) % n;
      const option = visibles[i];
      if (!option.desactivee && normaliser(option.libelle).startsWith(motif)) return i;
    }
    return -1;
  }

  reinitialiser(): void {
    this.tampon = "";
    if (this.minuteur) clearTimeout(this.minuteur);
  }
}

export interface EntreePosition {
  declencheur: { top: number; bottom: number; left: number; right: number; width: number };
  /** Hauteur naturelle du panneau avec toutes les options (avant limitation). */
  hauteurPanneau: number;
  largeurPanneau: number;
  fenetre: { largeur: number; hauteur: number };
  /** Hauteur maximale souhaitee du panneau (defaut 380). */
  hauteurMax?: number;
  alignement?: "gauche" | "droite";
}

export interface SortiePosition {
  cote: "bas" | "haut";
  left: number;
  /** Ancrage vertical : `top` quand le panneau s'ouvre vers le bas, `bottom` quand il s'ouvre vers le haut. */
  top?: number;
  bottom?: number;
  hauteurMax: number;
}

const MARGE = 8;
const ECART = 6;

/**
 * Choisit le cote d'ouverture (bas par defaut, haut s'il manque de la place en bas et qu'il y en a plus en haut)
 * et ancre le panneau au declencheur : le panneau reste colle au champ quand sa hauteur varie (filtrage).
 */
export function calculerPosition(e: EntreePosition): SortiePosition {
  const plafond = e.hauteurMax ?? 380;
  const libreBas = e.fenetre.hauteur - e.declencheur.bottom - ECART - MARGE;
  const libreHaut = e.declencheur.top - ECART - MARGE;
  const voulu = Math.min(plafond, e.hauteurPanneau);
  const cote: "bas" | "haut" = libreBas >= voulu || libreBas >= libreHaut ? "bas" : "haut";
  const libre = cote === "bas" ? libreBas : libreHaut;
  const hauteurMax = Math.max(160, Math.min(plafond, libre));
  let left = e.alignement === "droite" ? e.declencheur.right - e.largeurPanneau : e.declencheur.left;
  left = Math.max(MARGE, Math.min(left, e.fenetre.largeur - e.largeurPanneau - MARGE));
  return cote === "bas"
    ? { cote, left, top: e.declencheur.bottom + ECART, hauteurMax }
    : { cote, left, bottom: e.fenetre.hauteur - e.declencheur.top + ECART, hauteurMax };
}

/** Libelle du compteur affiche dans le pied du panneau et annonce aux lecteurs d'ecran. */
export function libelleCompteur(visibles: number, total: number, filtre: boolean): string {
  if (visibles === 0) return TEXTES.aucunResultat;
  if (filtre) return `${visibles} résultat${visibles > 1 ? "s" : ""} sur ${total}`;
  return `${total} option${total > 1 ? "s" : ""}`;
}

export function libelleSelectionnes(nombre: number, min?: number, max?: number): string {
  let texte = `${nombre} sélectionné${nombre > 1 ? "s" : ""}`;
  if (min !== undefined && max !== undefined) texte += ` (${min === max ? min : `${min} à ${max}`} attendu${max > 1 ? "s" : ""})`;
  else if (max !== undefined) texte += ` sur ${max} maximum`;
  else if (min !== undefined && min > 0) texte += ` (${min} minimum)`;
  return texte;
}

/** Emet les valeurs cochees DANS L'ORDRE DES OPTIONS (meme semantique que l'ancien <select multiple>). */
export function valeursDansLOrdre(options: readonly OptionBrute[], choisies: ReadonlySet<string>): string[] {
  return options.filter((o) => choisies.has(o.valeur)).map((o) => o.valeur);
}
