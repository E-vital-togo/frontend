/**
 * Drapeaux SVG embarques pour le selecteur de pays des champs telephone.
 *
 * Les emoji-drapeaux ne s'affichent pas sous Windows (il n'existe pas de
 * police de drapeaux) et l'app CEC est une PWA hors ligne (pas de CDN) :
 * on embarque les vrais SVG du paquet `country-flag-icons` (ratio 3x2, ~1 Ko
 * par drapeau, 180 Ko pour les 265 drapeaux, ~45 Ko compresse).
 *
 * Chargement PARESSEUX : le module des drapeaux est importe dynamiquement a
 * la premiere utilisation d'un champ telephone, il forme donc un chunk a part
 * (absent du bundle principal), precache par le service worker avec les
 * autres assets donc disponible hors ligne. Un seul chunk plutot qu'un
 * fichier par drapeau : 1 requete et 1 entree de precache au lieu de 265.
 */

type TableDrapeaux = Readonly<Record<string, string>>;

let promesse: Promise<TableDrapeaux> | null = null;

/** Charge (une seule fois) la table ISO -> source SVG. */
export function chargerDrapeaux(): Promise<TableDrapeaux> {
  if (!promesse) {
    promesse = import("country-flag-icons/string/3x2").then((module) => module as unknown as TableDrapeaux);
    // Un echec (reseau coupe sans precache) ne doit pas etre memorise : le prochain essai recharge.
    promesse.catch(() => {
      promesse = null;
    });
  }
  return promesse;
}

/** Globe neutre affiche pour un pays sans drapeau (ou pendant le chargement). */
export const DRAPEAU_GENERIQUE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><rect width="30" height="20" fill="#E2E7DF"/>' +
      '<g fill="none" stroke="#6B7A73" stroke-width="1"><circle cx="15" cy="10" r="6"/><ellipse cx="15" cy="10" rx="2.6" ry="6"/>' +
      '<path d="M9 10h12"/></g></svg>'
  );

const cacheUrls = new Map<string, string>();

/**
 * URL `data:` du drapeau d'un pays, utilisable dans un <img>. Une image
 * plutot que du SVG inline : les identifiants internes des SVG ne peuvent pas
 * entrer en collision entre 250 drapeaux, et le DOM reste leger.
 */
export function urlDrapeau(table: TableDrapeaux | null, iso: string): string {
  const source = table?.[iso];
  if (!source) return DRAPEAU_GENERIQUE;
  let url = cacheUrls.get(iso);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    cacheUrls.set(iso, url);
  }
  return url;
}
