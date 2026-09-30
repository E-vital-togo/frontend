import type { ECharts, EChartsOption } from "echarts";
import type { PivotResultat } from "../types/domaine";

/**
 * Cartes choropletes / a bulles : construction de l'option ECharts, de la
 * palette, des classes, de la legende et de l'habillage (titre, fleche du
 * nord, echelle, coordonnees). Tout est dessine DANS le canvas ECharts (et
 * non en HTML par-dessus) pour que l'export image - donc les PDF et
 * classeurs Excel - reprenne exactement ce que voit l'utilisateur.
 *
 * Les reglages sont ceux de WidgetGraphique.parametres_carte, valides cote
 * serveur (apps.statistiques.parametres_carte) : garder les deux en phase.
 */

export type PorteeCarte = "zone" | "nationale";
export type ModeCarte = "aplat" | "bulles" | "aplat_bulles";
export type CoinLegende = "bas_gauche" | "bas_droite" | "haut_gauche" | "haut_droite";

export interface ParametresCarte {
  portee: PorteeCarte;
  racine: string;
  mode: ModeCarte;
  palette: string;
  couleurs: string[];
  inverser_palette: boolean;
  classes: number;
  methode_classes: "egal" | "quantiles" | "manuel";
  seuils: number[];
  opacite: number;
  couleur_sans_donnee: string;
  couleur_hors_zone: string;
  contour_couleur: string;
  contour_epaisseur: number;
  survol_couleur: string;
  etiquettes: "aucune" | "noms" | "valeurs" | "noms_valeurs";
  taille_etiquettes: number;
  bulles_couleur: string;
  bulles_opacite: number;
  bulles_taille_min: number;
  bulles_taille_max: number;
  legende: boolean;
  legende_position: CoinLegende;
  legende_titre: string;
  titre: string;
  sous_titre: string;
  source: string;
  echelle: boolean;
  nord: boolean;
  coordonnees: boolean;
  fond: "blanc" | "gris" | "eau";
  zoom_libre: boolean;
}

export const PARAMETRES_CARTE_DEFAUT: ParametresCarte = {
  portee: "zone",
  racine: "",
  mode: "aplat",
  palette: "vert",
  couleurs: [],
  inverser_palette: false,
  classes: 0,
  methode_classes: "egal",
  seuils: [],
  opacite: 1,
  couleur_sans_donnee: "#EEF1EC",
  couleur_hors_zone: "#F4F5F3",
  contour_couleur: "#FFFFFF",
  contour_epaisseur: 0.8,
  survol_couleur: "#C8D92F",
  etiquettes: "aucune",
  taille_etiquettes: 10,
  bulles_couleur: "#0B7A57",
  bulles_opacite: 0.6,
  bulles_taille_min: 6,
  bulles_taille_max: 36,
  legende: true,
  legende_position: "bas_gauche",
  legende_titre: "",
  titre: "",
  sous_titre: "",
  source: "",
  echelle: true,
  nord: true,
  coordonnees: false,
  fond: "blanc",
  zoom_libre: true
};

export const PALETTES: Record<string, { label: string; couleurs: string[] }> = {
  vert: { label: "Vert", couleurs: ["#E6F2EC", "#A8D5BF", "#4FA37F", "#0B7A57", "#064D37"] },
  bleu: { label: "Bleu", couleurs: ["#E8F1F8", "#B3D1E6", "#6BA6CF", "#2E6F9E", "#173F63"] },
  orange: { label: "Orange", couleurs: ["#FDF1E3", "#F7CF9C", "#EFA04E", "#C97A2B", "#7C4512"] },
  rouge: { label: "Rouge", couleurs: ["#FCEBE9", "#F3B8B2", "#E0756C", "#B3261E", "#6F130F"] },
  violet: { label: "Violet", couleurs: ["#F1ECF7", "#CFC0E4", "#A184CB", "#6E4AA5", "#3D2468"] },
  gris: { label: "Gris", couleurs: ["#F1F2F1", "#CFD3D0", "#9BA39E", "#646D68", "#2E3531"] },
  divergente: { label: "Divergente", couleurs: ["#2E6F9E", "#9CC4DD", "#F1F2EC", "#E9B872", "#B3261E"] }
};

export const FONDS: Record<ParametresCarte["fond"], string> = { blanc: "#FFFFFF", gris: "#F2F4F2", eau: "#E6F0F6" };

/** Merge defauts + valeurs enregistrees ({} ou null = widget jamais configure). */
export function parametresCarte(partiel?: Partial<ParametresCarte> | null): ParametresCarte {
  return { ...PARAMETRES_CARTE_DEFAUT, ...(partiel ?? {}) };
}

// Niveau DHIS2 d'un fond de carte selon la dimension territoriale du pivot
// (registre CEC : region/prefecture/commune ; registre INSEED : variantes _fs / _residence).
export const NIVEAU_PAR_DIMENSION: Record<string, number> = {
  region: 2, region_fs: 2, region_residence: 2,
  prefecture: 3, prefecture_fs: 3, prefecture_residence: 3,
  commune: 4, commune_fs: 4, commune_residence: 4
};

export interface FeatureCarte {
  properties: { uid: string; nom: string; parent?: string; centre?: [number, number] | null; dans_zone?: boolean };
  geometry: { type: string; coordinates: unknown };
}
export interface CollectionCarte {
  type: "FeatureCollection";
  features: FeatureCarte[];
  niveau?: number;
  signature?: string;
  zone?: { id: string; nom: string; type: string } | null;
  partielle?: boolean;
}

// ---------------------------------------------------------------- couleurs

function versRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function versHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** Texte lisible sur ce fond : fonce sur fond clair, blanc sur fond sombre (luminance relative). */
export function couleurTexteSur(fond: string): string {
  const [r, g, b] = versRgb(fond).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#12261E" : "#FFFFFF";
}

/** Couleur a la position t (0..1) d'un degrade defini par ses etapes. */
export function couleurDegrade(t: number, etapes: string[]): string {
  if (etapes.length === 1) return etapes[0];
  const x = Math.min(1, Math.max(0, t)) * (etapes.length - 1);
  const i = Math.min(etapes.length - 2, Math.floor(x));
  const a = versRgb(etapes[i]);
  const b = versRgb(etapes[i + 1]);
  const f = x - i;
  return versHex(a.map((v, k) => v + (b[k] - v) * f));
}

export function etapesPalette(p: ParametresCarte): string[] {
  const base = p.palette === "personnalisee" && p.couleurs.length >= 2 ? p.couleurs : (PALETTES[p.palette] ?? PALETTES.vert).couleurs;
  return p.inverser_palette ? [...base].reverse() : base;
}

// ---------------------------------------------------------------- classes

const formatEntier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const formatDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formaterValeur(v: number | null | undefined, unite = ""): string {
  if (v == null || Number.isNaN(v)) return "-";
  const texte = Number.isInteger(v) ? formatEntier.format(v) : formatDecimal.format(v);
  return unite ? `${texte} ${unite}` : texte;
}

function formaterBorne(v: number): string {
  return Number.isInteger(v) ? formatEntier.format(v) : formatDecimal.format(Math.round(v * 10) / 10);
}

interface Classe {
  min: number;
  max: number;
  couleur: string;
  libelle: string;
}

/** Bornes des classes [min, max] (la derniere est fermee), couleur et libelle lisible de chacune. */
export function construireClasses(valeurs: number[], p: ParametresCarte): Classe[] {
  if (valeurs.length === 0) return [];
  const tri = [...valeurs].sort((a, b) => a - b);
  const min = tri[0];
  const max = tri[tri.length - 1];
  let bornes: number[];

  if (p.methode_classes === "manuel" && p.seuils.length > 0) {
    bornes = [min, ...p.seuils.filter((s) => s > min && s < max), max];
  } else {
    const k = Math.max(2, p.classes);
    if (p.methode_classes === "quantiles") {
      bornes = Array.from({ length: k + 1 }, (_, i) => tri[Math.min(tri.length - 1, Math.round((i / k) * (tri.length - 1)))]);
    } else {
      bornes = Array.from({ length: k + 1 }, (_, i) => min + ((max - min) * i) / k);
    }
    bornes = bornes.filter((b, i) => i === 0 || b > bornes[i - 1]);
    if (bornes.length < 2) bornes = [min, max];
  }

  if (bornes.length < 2 || min === max) bornes = [min, max + (min === max ? 1 : 0)];
  const etapes = etapesPalette(p);
  const n = bornes.length - 1;
  const entieres = bornes.every(Number.isInteger);
  return Array.from({ length: n }, (_, i) => {
    const bas = bornes[i];
    const haut = bornes[i + 1];
    // Classes entieres adjacentes : "0 a 9" puis "10 a 20", sans chevauchement apparent.
    const hautAffiche = i < n - 1 && entieres ? haut - 1 : haut;
    return {
      min: bas,
      max: haut,
      couleur: couleurDegrade(n === 1 ? 0.6 : i / (n - 1), etapes),
      libelle: bas === hautAffiche ? formaterBorne(bas) : `${formaterBorne(bas)} à ${formaterBorne(hautAffiche)}`
    };
  });
}

function classePour(v: number, classes: Classe[]): Classe {
  for (let i = 0; i < classes.length; i++) {
    if (v < classes[i].max || i === classes.length - 1) return classes[i];
  }
  return classes[classes.length - 1];
}

// ---------------------------------------------------------------- geographie

interface Boite {
  lngMin: number;
  lngMax: number;
  latMin: number;
  latMax: number;
}

export function boiteCollection(c: CollectionCarte): Boite | null {
  let b: Boite | null = null;
  const parcourir = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number") {
      const [x, y] = coords as number[];
      b = b
        ? { lngMin: Math.min(b.lngMin, x), lngMax: Math.max(b.lngMax, x), latMin: Math.min(b.latMin, y), latMax: Math.max(b.latMax, y) }
        : { lngMin: x, lngMax: x, latMin: y, latMax: y };
      return;
    }
    coords.forEach(parcourir);
  };
  c.features.forEach((f) => parcourir(f.geometry.coordinates));
  return b;
}

function pasGraticule(etendue: number): number {
  const candidats = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
  return candidats.find((c) => etendue / c <= 6) ?? 10;
}

function formaterCoord(v: number, pas: number, positifs: string, negatifs: string): string {
  const decimales = pas >= 1 ? 0 : pas >= 0.1 ? 1 : 2;
  return `${Math.abs(v).toFixed(decimales)}°${v >= 0 ? positifs : negatifs}`;
}

function seriesGraticule(boite: Boite): unknown[] {
  const pas = pasGraticule(Math.max(boite.lngMax - boite.lngMin, boite.latMax - boite.latMin));
  const lngs: number[] = [];
  const lats: number[] = [];
  for (let x = Math.ceil(boite.lngMin / pas) * pas; x <= boite.lngMax + 1e-9; x += pas) lngs.push(Math.round(x * 1e4) / 1e4);
  for (let y = Math.ceil(boite.latMin / pas) * pas; y <= boite.latMax + 1e-9; y += pas) lats.push(Math.round(y * 1e4) / 1e4);
  const marge = pas * 0.04;
  return [
    {
      type: "lines",
      coordinateSystem: "geo",
      polyline: true,
      silent: true,
      z: 3,
      lineStyle: { color: "#7C8A84", width: 0.6, type: "dashed", opacity: 0.6 },
      data: [
        ...lngs.map((x) => ({ coords: [[x, boite.latMin - marge], [x, boite.latMax + marge]] })),
        ...lats.map((y) => ({ coords: [[boite.lngMin - marge, y], [boite.lngMax + marge, y]] }))
      ]
    },
    {
      type: "scatter",
      coordinateSystem: "geo",
      silent: true,
      z: 4,
      symbolSize: 0,
      data: [
        ...lngs.map((x) => ({ value: [x, boite.latMin - marge], label: { position: "bottom", formatter: formaterCoord(x, pas, "E", "O") } })),
        ...lats.map((y) => ({ value: [boite.lngMin - marge, y], label: { position: "left", formatter: formaterCoord(y, pas, "N", "S") } }))
      ],
      label: { show: true, fontSize: 9, color: "#5B6862" }
    }
  ];
}

// ---------------------------------------------------------------- echelle

const PAS_ECHELLE_KM = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

/** Longueur ronde (km) et largeur (px) d'une barre d'echelle d'environ `cibleLargeurPx`. */
export function calculerBarreEchelle(kmParPixel: number, cibleLargeurPx = 90): { km: number; largeur: number } {
  const brut = kmParPixel * cibleLargeurPx;
  const km = [...PAS_ECHELLE_KM].reverse().find((c) => c <= brut) ?? PAS_ECHELLE_KM[0];
  return { km, largeur: Math.max(8, Math.round(km / kmParPixel)) };
}

export function libelleEchelle(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${formaterBorne(km)} km`;
}

const KM_PAR_DEGRE = 111.32;

// Derniere echelle posee, par instance : "finished" est emis apres chaque
// setOption (y compris celui qui met la barre a jour) - sans cette garde,
// la mise a jour relancerait l'evenement a l'infini.
const dernieresEchelles = new WeakMap<ECharts, string>();

function majEchelle(chart: ECharts): void {
  try {
    const centre = chart.convertFromPixel({ geoIndex: 0 }, [chart.getWidth() / 2, chart.getHeight() / 2]) as number[] | undefined;
    if (!centre) return;
    const [lng, lat] = centre;
    const p1 = chart.convertToPixel({ geoIndex: 0 }, [lng, lat]) as number[];
    const p2 = chart.convertToPixel({ geoIndex: 0 }, [lng + 0.1, lat]) as number[];
    const pixelsPourUnDixiemeDeDegre = Math.abs(p2[0] - p1[0]);
    if (!pixelsPourUnDixiemeDeDegre) return;
    const kmParPixel = (0.1 * KM_PAR_DEGRE * Math.cos((lat * Math.PI) / 180)) / pixelsPourUnDixiemeDeDegre;
    const { km, largeur } = calculerBarreEchelle(kmParPixel);
    const cle = `${km}:${largeur}`;
    if (dernieresEchelles.get(chart) === cle) return;
    dernieresEchelles.set(chart, cle);
    chart.setOption({
      graphic: {
        elements: [
          { id: "echelle_fond", shape: { width: largeur } },
          { id: "echelle_moitie", shape: { width: largeur / 2 } },
          { id: "echelle_texte", style: { text: libelleEchelle(km) } }
        ]
      }
    });
  } catch {
    // Geo pas encore pret (premier rendu) : le prochain evenement "finished" reessaie.
  }
}

/** Barre d'echelle qui suit le zoom/deplacement. Retourne la fonction de nettoyage. */
export function installerEchelleDynamique(chart: ECharts): () => void {
  const maj = () => majEchelle(chart);
  chart.on("georoam", maj);
  chart.on("finished", maj);
  return () => {
    chart.off("georoam", maj);
    chart.off("finished", maj);
  };
}

/** A appeler apres un setOption complet (qui remet la barre a vide) ; `recalculer` relance aussitot le calcul. */
export function reinitialiserEchelle(chart: ECharts, recalculer = false): void {
  dernieresEchelles.delete(chart);
  if (recalculer) majEchelle(chart);
}

// ---------------------------------------------------------------- habillage

type Element = Record<string, unknown>;

const OMBRE_TEXTE = { textShadowColor: "#FFFFFF", textShadowBlur: 3 };

function ancrage(coin: CoinLegende, marge = 10): Record<string, number> {
  return {
    [coin.startsWith("bas") ? "bottom" : "top"]: marge,
    [coin.endsWith("gauche") ? "left" : "right"]: marge
  };
}

interface EntreeLegende {
  couleur: string;
  texte: string;
  rond?: boolean;
}

function elementLegende(
  p: ParametresCarte,
  titre: string,
  entrees: EntreeLegende[],
  degrade: { etapes: string[]; min: string; max: string } | null
): Element {
  const hauteurLigne = 18;
  const enTete = titre ? 20 : 4;
  const largeurTexte = Math.max(titre.length * 6.4, ...entrees.map((e) => e.texte.length * 6.2), degrade ? 140 : 0);
  const largeur = Math.ceil(largeurTexte + 40);
  const hauteurDegrade = degrade ? 34 : 0;
  const hauteur = enTete + hauteurDegrade + entrees.length * hauteurLigne + 8;

  const enfants: Element[] = [
    { type: "rect", shape: { width: largeur, height: hauteur, r: 4 }, style: { fill: "rgba(255,255,255,0.92)", stroke: "#C9D2C6", lineWidth: 1 } }
  ];
  if (titre) {
    enfants.push({ type: "text", left: 10, top: 6, style: { text: titre, fontSize: 11, fontWeight: "bold", fill: "#12261E" } });
  }
  let y = enTete + 2;
  if (degrade) {
    enfants.push({
      type: "rect",
      shape: { x: 10, y, width: 140, height: 10 },
      style: {
        fill: {
          type: "linear", x: 0, y: 0, x2: 1, y2: 0,
          colorStops: degrade.etapes.map((c, i) => ({ offset: i / Math.max(1, degrade.etapes.length - 1), color: c }))
        },
        stroke: "#C9D2C6", lineWidth: 0.5
      }
    });
    enfants.push({ type: "text", left: 10, top: y + 13, style: { text: degrade.min, fontSize: 10, fill: "#40534B" } });
    enfants.push({ type: "text", left: 150, top: y + 13, style: { text: degrade.max, fontSize: 10, fill: "#40534B", align: "right" } });
    y += hauteurDegrade;
  }
  entrees.forEach((e) => {
    enfants.push(
      e.rond
        ? { type: "circle", shape: { cx: 17, cy: y + 8, r: 6 }, style: { fill: e.couleur, opacity: 0.85, stroke: "#FFFFFF" } }
        : { type: "rect", shape: { x: 10, y: y + 2, width: 14, height: 12, r: 2 }, style: { fill: e.couleur, stroke: "#B9C3BE", lineWidth: 0.5 } }
    );
    enfants.push({ type: "text", left: 32, top: y + 3, style: { text: e.texte, fontSize: 10.5, fill: "#12261E" } });
    y += hauteurLigne;
  });
  return { id: "legende", type: "group", ...ancrage(p.legende_position), children: enfants, z: 100 };
}

function elementNord(coin: CoinLegende): Element {
  return {
    id: "nord",
    type: "group",
    ...ancrage(coin, 12),
    z: 100,
    children: [
      { type: "polygon", shape: { points: [[11, 0], [22, 30], [11, 23], [0, 30]] }, style: { fill: "#12261E", stroke: "#FFFFFF", lineWidth: 1 } },
      { type: "text", left: 6, top: 32, style: { text: "N", fontSize: 13, fontWeight: "bold", fill: "#12261E", ...OMBRE_TEXTE } }
    ]
  };
}

function elementEchelle(coin: CoinLegende): Element {
  return {
    id: "echelle",
    type: "group",
    ...ancrage(coin, 12),
    z: 100,
    children: [
      { id: "echelle_fond", type: "rect", shape: { x: 0, y: 12, width: 60, height: 5 }, style: { fill: "#12261E", stroke: "#FFFFFF", lineWidth: 1 } },
      { id: "echelle_moitie", type: "rect", shape: { x: 0, y: 12, width: 30, height: 5 }, style: { fill: "#FFFFFF", stroke: "#12261E", lineWidth: 1 } },
      { id: "echelle_texte", type: "text", left: 0, top: -2, style: { text: "", fontSize: 10.5, fontWeight: "bold", fill: "#12261E", ...OMBRE_TEXTE } }
    ]
  };
}

/** Coin libre (ni legende, ni titre) ou poser fleche du nord et echelle. */
function coinsLibres(p: ParametresCarte): { nord: CoinLegende; echelle: CoinLegende } {
  const occupes = new Set<CoinLegende>(p.legende ? [p.legende_position] : []);
  if (p.titre || p.sous_titre) occupes.add("haut_gauche");
  const nord = (["haut_droite", "haut_gauche", "bas_droite", "bas_gauche"] as CoinLegende[]).find((c) => !occupes.has(c)) ?? "haut_droite";
  occupes.add(nord);
  const echelle = (["bas_droite", "bas_gauche", "haut_droite", "haut_gauche"] as CoinLegende[]).find((c) => !occupes.has(c)) ?? "bas_droite";
  return { nord, echelle };
}

// ---------------------------------------------------------------- option

interface EntreesOptionCarte {
  resultat: PivotResultat;
  parametres: ParametresCarte;
  nomCarte: string;
  collection: CollectionCarte;
  libelleMesure: string;
  unite?: string;
}

const NON_RENSEIGNE = ["Non renseigne", "Non renseigné", "Autres"];

export function construireOptionCarte({ resultat, parametres: p, nomCarte, collection, libelleMesure, unite = "" }: EntreesOptionCarte): EChartsOption {
  const [dim] = resultat.dimensions;
  const [mesure] = resultat.mesures;
  const proprietes = new Map(collection.features.map((f) => [f.properties.nom, f.properties]));

  const lignes = resultat.lignes
    .map((l) => ({ nom: String(l[dim] ?? ""), valeur: typeof l[mesure] === "number" ? (l[mesure] as number) : null }))
    .filter((l) => l.nom && !NON_RENSEIGNE.includes(l.nom) && proprietes.has(l.nom));
  const valeurs = lignes.map((l) => l.valeur).filter((v): v is number => v != null);
  const max = valeurs.length ? Math.max(...valeurs) : 1;
  const min = valeurs.length ? Math.min(...valeurs) : 0;

  const etapes = etapesPalette(p);
  const classes = p.classes >= 2 || (p.methode_classes === "manuel" && p.seuils.length > 0) ? construireClasses(valeurs, p) : [];
  const couleurPour = (v: number): string =>
    classes.length ? classePour(v, classes).couleur : couleurDegrade(max === min ? 0.6 : (v - min) / (max - min), etapes);

  const avecAplat = p.mode !== "bulles";
  const avecBulles = p.mode !== "aplat";
  const valeursParNom = new Map(lignes.map((l) => [l.nom, l.valeur]));

  const etiquetteNom = p.etiquettes === "noms";
  const etiquetteSerie = p.etiquettes === "valeurs" || p.etiquettes === "noms_valeurs";

  // Avec `geoIndex`, la couleur d'une zone vient du composant geo (et non de
  // la serie) : le style par territoire passe donc par geo.regions.
  const regionsAplat = avecAplat
    ? lignes.map((l) => {
        const fond = l.valeur == null ? p.couleur_sans_donnee : couleurPour(l.valeur);
        const texte = couleurTexteSur(fond);
        const etiquette = etiquetteSerie || etiquetteNom
          ? {
              show: true,
              color: texte,
              textShadowBlur: texte === "#FFFFFF" ? 0 : 3,
              formatter:
                p.etiquettes === "valeurs" ? formaterValeur(l.valeur)
                : p.etiquettes === "noms" ? l.nom
                : `${l.nom}\n${formaterValeur(l.valeur)}`
            }
          : undefined;
        return { name: l.nom, itemStyle: { areaColor: fond, opacity: p.opacite }, label: etiquette };
      })
    : [];
  const donneesAplat = avecAplat ? lignes.map((l) => ({ name: l.nom, value: l.valeur ?? undefined })) : [];

  const horsZone = collection.features.filter((f) => f.properties.dans_zone === false).map((f) => ({
    name: f.properties.nom,
    silent: true,
    itemStyle: { areaColor: p.couleur_hors_zone },
    label: { show: false }
  }));

  const donneesBulles = avecBulles
    ? lignes
        .map((l) => ({ l, centre: proprietes.get(l.nom)?.centre }))
        .filter((x): x is { l: (typeof lignes)[number]; centre: [number, number] } => !!x.centre && x.l.valeur != null)
        .map(({ l, centre }) => ({
          name: l.nom,
          value: [centre[0], centre[1], l.valeur as number],
          symbolSize: p.bulles_taille_min + (p.bulles_taille_max - p.bulles_taille_min) * Math.sqrt(Math.max(0, l.valeur as number) / (max || 1))
        }))
    : [];

  const boite = boiteCollection(collection);
  const latCentre = boite ? (boite.latMin + boite.latMax) / 2 : 8;

  // --- legende
  const titreLegende = p.legende_titre || libelleMesure;
  const entrees: EntreeLegende[] = [];
  let degrade: { etapes: string[]; min: string; max: string } | null = null;
  if (avecAplat && valeurs.length) {
    if (classes.length) classes.forEach((c) => entrees.push({ couleur: c.couleur, texte: c.libelle }));
    else degrade = { etapes, min: formaterValeur(min), max: formaterValeur(max, unite) };
  }
  if (avecBulles && donneesBulles.length) {
    entrees.push({ couleur: p.bulles_couleur, texte: "Taille proportionnelle à la valeur", rond: true });
  }
  entrees.push({ couleur: p.couleur_sans_donnee, texte: "Aucune donnée" });
  if (horsZone.length) entrees.push({ couleur: p.couleur_hors_zone, texte: "Hors de votre zone" });

  const coins = coinsLibres(p);
  const graphic: Element[] = [];
  if (p.legende) graphic.push(elementLegende(p, titreLegende, entrees, degrade));
  if (p.nord) graphic.push(elementNord(coins.nord));
  if (p.echelle) graphic.push(elementEchelle(coins.echelle));
  if (p.source) {
    graphic.push({ id: "source", type: "text", left: "center", bottom: 2, z: 100, style: { text: p.source, fontSize: 9, fill: "#5B6862", ...OMBRE_TEXTE } });
  }

  const series: unknown[] = [];
  if (avecAplat) {
    series.push({
      type: "map",
      geoIndex: 0,
      data: donneesAplat,
      label: { show: false }
    });
  }
  if (avecBulles) {
    series.push({
      type: "scatter",
      coordinateSystem: "geo",
      z: 5,
      data: donneesBulles,
      itemStyle: { color: p.bulles_couleur, opacity: p.bulles_opacite, borderColor: "#FFFFFF", borderWidth: 1 },
      emphasis: { itemStyle: { opacity: 1 }, scale: 1.1 },
      label: etiquetteSerie && !avecAplat
        ? { show: true, position: "right", fontSize: p.taille_etiquettes, formatter: (x: { name: string; value: number[] }) => `${x.name} ${formaterValeur(x.value[2])}` }
        : { show: false }
    });
  }
  if (p.coordonnees && boite) series.push(...seriesGraticule(boite));

  return {
    backgroundColor: FONDS[p.fond],
    animation: false,
    title: p.titre || p.sous_titre
      ? { text: p.titre, subtext: p.sous_titre, left: 12, top: 8, textStyle: { fontSize: 15, color: "#12261E" }, subtextStyle: { fontSize: 11, color: "#40534B" } }
      : undefined,
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (x: unknown) => {
        const nom = (x as { name: string }).name;
        const info = proprietes.get(nom);
        const v = valeursParNom.get(nom);
        if (!info) return "";
        const parent = info.parent ? `<div style="color:#8A968F;font-size:11px">${echapper(info.parent)}</div>` : "";
        return `<b>${echapper(nom)}</b>${parent}<div>${echapper(libelleMesure)} : <b>${formaterValeur(v, unite)}</b></div>`;
      }
    },
    geo: {
      map: nomCarte,
      nameProperty: "nom",
      roam: p.zoom_libre,
      aspectScale: Math.cos((latCentre * Math.PI) / 180),
      layoutCenter: ["50%", "52%"],
      layoutSize: "88%",
      itemStyle: { areaColor: p.couleur_sans_donnee, borderColor: p.contour_couleur, borderWidth: p.contour_epaisseur },
      emphasis: { itemStyle: { areaColor: p.survol_couleur }, label: { show: etiquetteNom || etiquetteSerie } },
      select: { disabled: true },
      label: { show: etiquetteNom, fontSize: p.taille_etiquettes, color: "#12261E", ...OMBRE_TEXTE },
      // "noms" : toutes les zones ; valeurs : seulement celles qui en ont (voir regionsAplat).
      // Les territoires hors zone passent en dernier : jamais recolores par une donnee.
      regions: [...regionsAplat, ...horsZone]
    },
    graphic,
    series
  } as EChartsOption;
}

function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
