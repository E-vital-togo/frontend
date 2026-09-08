/**
 * Palette de graphiques (methode dataviz) : 8 teintes categorielles
 * validees (separation CVD + contraste, voir skill "dataviz"), ordre FIXE.
 * Distincte de la palette de marque (emeraude/citron), qui n'a que 2 teintes
 * reelles - insuffisant pour distinguer jusqu'a 6-8 categories. La marque
 * reste presente via le texte/axes/grille (tokens neutres de theme.css) ;
 * seules les marques de donnees (barres, lignes, secteurs) empruntent cette
 * palette, jamais un degrade.
 */
export const SERIES_CATEGORIELLES = [
  "#2a78d6", // 1 bleu
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 jaune
  "#e87ba4", // 5 magenta
  "#008300", // 6 vert
  "#4a3aa7", // 7 violet
  "#e34948" // 8 rouge
] as const;

/** Rampe sequentielle (une seule teinte, clair -> fonce) pour une serie unique. */
export const RAMPE_SEQUENTIELLE = ["#cde2fb", "#86b6ef", "#3987e5", "#256abf", "#104281"] as const;

export const COULEUR_AUTRES = "#898781"; // gris neutre : la categorie fourre-tout n'est pas une identite

/**
 * Ordre canonique des libelles (tels que renvoyes par le backend, voir
 * apps.dossiers.services_statistiques) par dimension : garantit qu'une
 * categorie garde TOUJOURS la meme couleur, qu'elle soit ou non presente
 * dans la vue filtree courante (jamais de teinte recalculee/cyclee).
 */
const ORDRES_FIXES: Record<string, string[]> = {
  statut: ["Recu", "Notifie", "En attente de complement", "Complete", "Acte emis", "Sans suite"],
  event_type: ["Naissance", "Deces"],
  origine: ["DHIS2", "Manuel"],
  type_dossier: ["Declaration", "Jugement"]
};

/**
 * Couleur d'une categorie. Pour une dimension a ordre fixe (statut, type
 * d'evenement...), la position dans `ORDRES_FIXES` determine le slot. Pour
 * une dimension ouverte (ex: mairie), on retombe sur l'ordre d'apparition
 * dans les donnees (parametre `indexApparition`), le backend repliant deja
 * le surplus au-dela de 8 dans une categorie "Autres".
 */
export function couleurCategorie(dimension: string, libelle: string, indexApparition: number): string {
  if (libelle === "Autres" || libelle === "Non renseigne") return COULEUR_AUTRES;

  const ordre = ORDRES_FIXES[dimension];
  const position = ordre ? ordre.indexOf(libelle) : -1;
  const slot = position >= 0 ? position : indexApparition;
  return SERIES_CATEGORIELLES[slot % SERIES_CATEGORIELLES.length];
}
