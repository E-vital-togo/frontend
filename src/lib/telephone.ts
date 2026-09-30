/**
 * Logique pure (sans React, sans DOM) de saisie d'un numero de telephone :
 * liste des pays, tri, recherche, interpretation d'une saisie ou d'un
 * collage, formatage par pays, validation. Partagee a l'identique par :
 *  - l'app CEC (frontend/, composant ui/ChampTelephone.tsx) ;
 *  - l'app DHIS2 (dhis2-app/src/lib/telephone.ts, COPIE generee de ce fichier) ;
 *  - les gabarits Django (bundle IIFE backend/static/js/evital_telephone.js,
 *    voir frontend/src/lib/telephoneDjango.ts).
 * Toute correction se fait ici puis se recopie vers dhis2-app avec
 * `npm run sync:telephone` (frontend/scripts/sync-telephone.mjs).
 *
 * Bibliotheque : libphonenumber-js, variante `max`. Les variantes `min` et
 * `mobile` sont plus legeres (84 Ko / 99 Ko de metadonnees contre 157 Ko),
 * mais `min` ne distingue pas les types de numeros (donc accepte des plages
 * que le backend, base sur `phonenumbers` complet, refuse) et `mobile`
 * refuserait les lignes fixes (declarants, mairies). `max` garantit que
 * "valide ici" == "valide cote serveur" ; le surcout (~73 Ko) est
 * negligeable face a l'erreur serveur evitee.
 *
 * Convention : la valeur echangee avec l'exterieur est une chaine E.164
 * ("+22890123456") ou "" si rien n'est saisi.
 */
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
  type PhoneNumber
} from "libphonenumber-js/max";
import exemples from "libphonenumber-js/mobile/examples";

export type CodeIso = CountryCode;

export const PAYS_DEFAUT: CodeIso = "TG";

/** Longueur maximale d'un numero E.164, indicatif compris (UIT E.164). */
const LONGUEUR_MAX_E164 = 15;

/** Afrique de l'Ouest (geoschema ONU), affichee en tete de liste apres le Togo. */
const AFRIQUE_OUEST: readonly CodeIso[] = ["BJ", "BF", "CV", "CI", "GM", "GH", "GN", "GW", "LR", "ML", "MR", "NE", "NG", "SN", "SL", "TG"];

/**
 * Pays "principal" d'un indicatif partage (+1, +44...) : celui qu'on
 * presente quand seul l'indicatif est connu. Pour les autres indicatifs,
 * un seul pays existe.
 */
const PAYS_PRINCIPAL: Readonly<Record<string, CodeIso>> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
  "44": "GB",
  "47": "NO",
  "61": "AU",
  "212": "MA",
  "262": "RE",
  "290": "SH",
  "358": "FI",
  "590": "GP",
  "599": "CW"
};

export interface Pays {
  iso: CodeIso;
  /** Nom francais (Intl.DisplayNames). */
  nom: string;
  /** Avec le plus : "+228". */
  indicatif: string;
  groupe: "afrique_ouest" | "monde";
  /** Nom normalise (minuscules, sans accents) pour la recherche. */
  recherche: string;
}

/** Etat d'un champ telephone (ce que le composant garde en memoire). */
export interface EtatTelephone {
  iso: CodeIso;
  /** Chiffres saisis en format national, zero de trunk eventuel inclus. */
  chiffres: string;
  /**
   * Saisie internationale dont l'indicatif n'est pas encore identifiable
   * ("+", "+2") : affichee telle quelle tant qu'elle n'est pas resolue.
   */
  partiel?: string;
}

export type CodeValidation = "vide" | "partiel" | "trop_court" | "trop_long" | "invalide" | "valide";

export interface ResultatValidation {
  code: CodeValidation;
  valide: boolean;
  /** Message d'erreur en francais, absent si `valide`. */
  message?: string;
}

// ----------------------------------------------------------------- pays

export function normaliserPourRecherche(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'").toLowerCase().trim();
}

let cachePays: Pays[] | null = null;

function nomFrancais(iso: CodeIso, noms: Intl.DisplayNames | null): string {
  try {
    return noms?.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/**
 * Tous les pays connus de libphonenumber : Togo en premier, puis le reste de
 * l'Afrique de l'Ouest, puis le monde, chaque groupe par ordre alphabetique
 * francais. Memoise (le calcul des noms est couteux).
 */
export function listerPays(): Pays[] {
  if (cachePays) return cachePays;
  let noms: Intl.DisplayNames | null = null;
  try {
    noms = new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    noms = null;
  }
  const collateur = new Intl.Collator("fr", { sensitivity: "base" });
  const pays: Pays[] = getCountries().map((iso) => {
    const nom = nomFrancais(iso, noms);
    return {
      iso,
      nom,
      indicatif: `+${getCountryCallingCode(iso)}`,
      groupe: AFRIQUE_OUEST.includes(iso) ? "afrique_ouest" : "monde",
      recherche: normaliserPourRecherche(nom)
    };
  });
  pays.sort((a, b) => {
    if (a.iso === PAYS_DEFAUT) return -1;
    if (b.iso === PAYS_DEFAUT) return 1;
    if (a.groupe !== b.groupe) return a.groupe === "afrique_ouest" ? -1 : 1;
    return collateur.compare(a.nom, b.nom);
  });
  cachePays = pays;
  return pays;
}

export function paysParIso(iso: string): Pays | undefined {
  return listerPays().find((p) => p.iso === iso);
}

/**
 * Filtre la liste par nom francais (sans accents ni casse), indicatif
 * ("228", "+228") ou code ISO ("TG"). Les meilleures correspondances
 * (code ISO exact, nom commencant par la requete) passent devant ; a score
 * egal l'ordre de la liste (Afrique de l'Ouest d'abord) est conserve.
 */
export function filtrerPays(liste: readonly Pays[], requete: string): Pays[] {
  const q = normaliserPourRecherche(requete);
  if (!q) return [...liste];
  const chiffres = q.replace(/^\+/, "");
  const numerique = /^\d+$/.test(chiffres);
  const scores: Array<{ pays: Pays; score: number; rang: number }> = [];
  liste.forEach((pays, rang) => {
    let score = 0;
    if (numerique) {
      const indicatif = pays.indicatif.slice(1);
      if (indicatif === chiffres) score = 100;
      else if (indicatif.startsWith(chiffres)) score = 50;
    } else {
      const iso = pays.iso.toLowerCase();
      if (iso === q) score = 100;
      else if (pays.recherche.startsWith(q)) score = 80;
      else if (pays.recherche.split(/[\s'-]+/).some((mot) => mot.startsWith(q))) score = 60;
      else if (pays.recherche.includes(q)) score = 30;
    }
    if (score > 0) scores.push({ pays, score, rang });
  });
  scores.sort((a, b) => b.score - a.score || a.rang - b.rang);
  return scores.map((s) => s.pays);
}

// ------------------------------------------------------ indicatifs

let cacheIndicatifs: Set<string> | null = null;

function indicatifsConnus(): Set<string> {
  if (!cacheIndicatifs) {
    cacheIndicatifs = new Set(getCountries().map((iso) => getCountryCallingCode(iso)));
  }
  return cacheIndicatifs;
}

/** Indicatif (sans "+") en tete de `chiffres` ("22890123456" -> "228"), ou null. Les indicatifs n'ont jamais un prefixe commun. */
export function trouverIndicatif(chiffres: string): string | null {
  const connus = indicatifsConnus();
  for (let longueur = 1; longueur <= 3; longueur += 1) {
    const candidat = chiffres.slice(0, longueur);
    if (candidat.length === longueur && connus.has(candidat)) return candidat;
  }
  return null;
}

/** Pays a presenter pour un indicatif, en privilegiant `prefere` s'il porte cet indicatif. */
export function paysPourIndicatif(indicatif: string, prefere?: CodeIso): CodeIso {
  if (prefere && getCountryCallingCode(prefere) === indicatif) return prefere;
  const principal = PAYS_PRINCIPAL[indicatif];
  if (principal) return principal;
  const trouve = getCountries().find((iso) => getCountryCallingCode(iso) === indicatif);
  return trouve ?? PAYS_DEFAUT;
}

// -------------------------------------------------- interpretation

function chiffresDe(texte: string): string {
  return texte.replace(/\D/g, "");
}

/** Nombre maximal de chiffres nationaux pour ce pays (E.164 : 15 chiffres au total). */
function longueurNationaleMax(iso: CodeIso): number {
  return LONGUEUR_MAX_E164 - getCountryCallingCode(iso).length;
}

/** Chiffres de la forme nationale d'un numero valide, zero de trunk inclus quand le pays l'ecrit ("0612345678" en France). */
function chiffresNationaux(numero: PhoneNumber): string {
  return chiffresDe(numero.formatNational());
}

function limiter(iso: CodeIso, chiffres: string): string {
  return chiffres.slice(0, longueurNationaleMax(iso));
}

export function etatVide(iso: CodeIso = PAYS_DEFAUT): EtatTelephone {
  return { iso, chiffres: "" };
}

/**
 * Interprete un texte saisi ou colle dans le champ, etant donne l'etat
 * courant (pays selectionne). Gere :
 *  - "+228 90 12 34 56" et "0022890123456" (indicatif international : le
 *    pays est detecte et remplace la selection) ;
 *  - "228-90-12-34-56" colle sans "+" (indicatif reconnu si le numero ainsi
 *    lu est valide, y compris dans un autre pays que celui selectionne) ;
 *  - "90 12 34 56" et "06 12 34 56 78" (national ; le zero de trunk est
 *    retire a l'emission, voir `nationalDe`).
 * `collage` : vrai pour un collage/autoremplissage (plusieurs caracteres
 * d'un coup) ; active la detection d'un indicatif colle sans "+", qui serait
 * sinon ambigue pendant la frappe caractere par caractere.
 */
export function interpreterSaisie(texte: string, etat: EtatTelephone, collage = false): EtatTelephone {
  let t = texte.trim();
  // "+" colle au milieu d'une saisie existante : seule la partie internationale compte.
  if (collage && t.indexOf("+") > 0) t = t.slice(t.indexOf("+"));

  if (/^(\+|00)/.test(t)) {
    const chiffres = chiffresDe(t.replace(/^(\+|00)/, ""));
    const indicatif = trouverIndicatif(chiffres);
    if (!indicatif) return { iso: etat.iso, chiffres: "", partiel: `+${chiffres}` };
    const complet = parsePhoneNumberFromString(`+${chiffres}`);
    const valide = complet?.isValid() ? complet : undefined;
    const iso = valide?.country ?? paysPourIndicatif(indicatif, etat.iso);
    // Un numero valide fournit sa forme nationale exacte, zero de trunk compris
    // ("+33 (0)6 12..." -> "0612..."), comme on l'ecrit et l'affiche dans le pays.
    const national = valide ? chiffresNationaux(valide) : chiffres.slice(indicatif.length);
    return { iso, chiffres: limiter(iso, national) };
  }

  let chiffres = chiffresDe(t);
  if (collage && chiffres) {
    const propre = parsePhoneNumberFromString(chiffres, etat.iso);
    if (propre?.isValid()) {
      // libphonenumber retire l'indicatif du pays courant quand le numero
      // complet est ainsi valide ("22890123456" avec TG).
      if (propre.nationalNumber !== chiffres && chiffres.startsWith(getCountryCallingCode(etat.iso))) {
        chiffres = chiffresNationaux(propre);
      }
    } else if (trouverIndicatif(chiffres)) {
      // Invalide dans le pays courant mais valide avec l'indicatif colle sans
      // "+" ("228-90-12-34-56" colle dans un champ reste sur France).
      const international = parsePhoneNumberFromString(`+${chiffres}`);
      if (international?.isValid() && international.country) {
        return { iso: international.country, chiffres: limiter(international.country, chiffresNationaux(international)) };
      }
    }
  }
  return { iso: etat.iso, chiffres: limiter(etat.iso, chiffres) };
}

/**
 * Convertit une valeur recue de l'exterieur (E.164 ou ancien format libre :
 * "90123456", "+228 90 12 34 56", "228-90-12-34-56") en etat. Sans
 * indicatif, `paysDefaut` s'applique.
 */
export function lireValeur(valeur: unknown, paysDefaut: CodeIso = PAYS_DEFAUT): EtatTelephone {
  if (typeof valeur !== "string" || !valeur.trim()) return etatVide(paysDefaut);
  return interpreterSaisie(valeur, etatVide(paysDefaut), true);
}

// ----------------------------------------------------------- formatage

/** Affichage national du numero en cours de saisie ("90 12 34 56"). */
export function formaterSaisie(etat: EtatTelephone): string {
  if (etat.partiel !== undefined) return etat.partiel;
  return new AsYouType(etat.iso).input(etat.chiffres);
}

/** Numero national sans zero de trunk ("0612345678" en FR -> "612345678"). */
export function nationalDe(etat: EtatTelephone): string {
  if (!etat.chiffres) return "";
  const formateur = new AsYouType(etat.iso);
  formateur.input(etat.chiffres);
  return formateur.getNumber()?.nationalNumber ?? etat.chiffres;
}

/**
 * Valeur a emettre : "+22890123456", "" si rien n'est saisi. Emise meme
 * incomplete ("+228901") pour que le parent ne perde jamais la saisie et que
 * la validation (cote serveur ou ici) puisse la refuser explicitement.
 */
export function versE164(etat: EtatTelephone): string {
  if (etat.partiel !== undefined) {
    const chiffres = chiffresDe(etat.partiel);
    return chiffres ? `+${chiffres}` : "";
  }
  if (!etat.chiffres) return "";
  return `+${getCountryCallingCode(etat.iso)}${nationalDe(etat)}`;
}

/**
 * Position du curseur dans `affichage` apres reformatage, pour qu'il reste
 * apres le meme nombre de chiffres que celui qui le precedait avant la frappe
 * (le formatage ajoute/retire des espaces et ferait sinon sauter le curseur en fin).
 */
export function positionCurseur(affichage: string, chiffresAvant: number): number {
  if (chiffresAvant <= 0) return 0;
  let vus = 0;
  for (let i = 0; i < affichage.length; i += 1) {
    if (/\d/.test(affichage[i])) {
      vus += 1;
      if (vus === chiffresAvant) return i + 1;
    }
  }
  return affichage.length;
}

/** Exemple de numero mobile national du pays ("90 11 23 45"), pour le placeholder. */
export function exempleNational(iso: CodeIso): string {
  try {
    return getExampleNumber(iso, exemples)?.formatNational() ?? "";
  } catch {
    return "";
  }
}

// ----------------------------------------------------------- validation

/**
 * Validite d'un etat avec un message d'erreur precis en francais. `valide`
 * est faux pour un champ vide : c'est a l'appelant de tolerer le vide quand
 * le champ n'est pas obligatoire (voir le composant ChampTelephone).
 */
export function validerEtat(etat: EtatTelephone): ResultatValidation {
  if (etat.partiel !== undefined) {
    return etat.partiel.replace(/\D/g, "")
      ? { code: "partiel", valide: false, message: "Indicatif du pays incomplet ou inconnu." }
      : { code: "vide", valide: false, message: "Saisissez un numéro de téléphone." };
  }
  if (!etat.chiffres) return { code: "vide", valide: false, message: "Saisissez un numéro de téléphone." };

  const e164 = versE164(etat);
  const pays = paysParIso(etat.iso);
  const nomPays = pays ? pays.nom : etat.iso;
  const exemple = exempleNational(etat.iso);
  const aide = exemple ? ` (exemple : ${exemple})` : "";

  const numero = parsePhoneNumberFromString(e164);
  if (numero?.isValid()) return { code: "valide", valide: true };

  switch (validatePhoneNumberLength(e164)) {
    case "TOO_SHORT":
      return { code: "trop_court", valide: false, message: `Numéro trop court pour ${nomPays}${aide}.` };
    case "TOO_LONG":
      return { code: "trop_long", valide: false, message: `Numéro trop long pour ${nomPays}${aide}.` };
    default:
      return {
        code: "invalide",
        valide: false,
        message: `Ce numéro n'est pas valide pour ${nomPays}. Vérifiez l'indicatif et les chiffres${aide}.`
      };
  }
}

/** Numero E.164 d'une valeur quelconque (memes regles que le backend : apps.core.telephone.normaliser_e164), ou null si invalide. */
export function normaliserE164(valeur: unknown, paysDefaut: CodeIso = PAYS_DEFAUT): string | null {
  const etat = lireValeur(valeur, paysDefaut);
  if (!validerEtat(etat).valide) return null;
  const numero = parsePhoneNumberFromString(versE164(etat));
  return numero?.isValid() ? numero.number : null;
}

/** "+228 90 12 34 56" pour l'affichage en lecture seule ; la valeur brute si le numero est invalide. */
export function formaterInternational(valeur: unknown, paysDefaut: CodeIso = PAYS_DEFAUT): string {
  const e164 = normaliserE164(valeur, paysDefaut);
  if (!e164) return typeof valeur === "string" ? valeur : "";
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
