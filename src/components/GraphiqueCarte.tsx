import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type * as echarts from "echarts/core";
import { AlertCircle, MapPinOff, Map as IconeCarte } from "lucide-react";
import GraphiqueECharts, { type PoigneeGraphique } from "./ui/GraphiqueECharts";
import EtatVide from "./ui/EtatVide";
import Squelette from "./ui/Squelette";
import {
  NIVEAU_PAR_DIMENSION,
  construireOptionCarte,
  installerEchelleDynamique,
  parametresCarte,
  reinitialiserEchelle,
  type ParametresCarte
} from "../lib/carte";
import { chargerFondCarte, type FondCarte } from "../lib/fondsCarte";
import type { PivotResultat } from "../types/domaine";

import "../styles/statistiques.css";

interface ProprietesGraphiqueCarte {
  resultat: PivotResultat;
  /** Reglages enregistres (partiels ou vides : les defauts s'appliquent). */
  parametres?: Partial<ParametresCarte> | null;
  libellesMesures?: Record<string, string>;
  unites?: Record<string, string>;
  hauteur?: number | string;
}

type Etat = { type: "chargement" } | { type: "vide" } | { type: "erreur" } | { type: "pret"; fond: FondCarte };

/**
 * Carte habillee (choroplethe, bulles ou les deux) d'un resultat de pivot
 * dont la premiere dimension est territoriale. Le fond est partiel (zone de
 * l'utilisateur) ou entier selon les reglages. Echelle dynamique et
 * coordonnees du curseur en direct ; tout le reste (legende, nord, titre,
 * graticule) est dessine dans le canvas donc present dans les exports.
 */
const GraphiqueCarte = forwardRef<PoigneeGraphique, ProprietesGraphiqueCarte>(function GraphiqueCarte(
  { resultat, parametres, libellesMesures = {}, unites = {}, hauteur = 420 },
  ref
) {
  const p = useMemo(() => parametresCarte(parametres), [parametres]);
  const dimension = resultat.dimensions[0];
  const niveau = NIVEAU_PAR_DIMENSION[dimension];
  const [etat, setEtat] = useState<Etat>({ type: "chargement" });
  const [coordonnees, setCoordonnees] = useState<string>("");
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!niveau) return;
    let annule = false;
    setEtat({ type: "chargement" });
    chargerFondCarte(niveau, p.portee, p.racine)
      .then((fond) => !annule && setEtat(fond ? { type: "pret", fond } : { type: "vide" }))
      .catch(() => !annule && setEtat({ type: "erreur" }));
    return () => {
      annule = true;
    };
  }, [niveau, p.portee, p.racine]);

  const option = useMemo(() => {
    if (etat.type !== "pret") return null;
    const mesure = resultat.mesures[0];
    return construireOptionCarte({
      resultat,
      parametres: p,
      nomCarte: etat.fond.nom,
      collection: etat.fond.collection,
      libelleMesure: libellesMesures[mesure] ?? resultat.libelles?.mesures?.[mesure] ?? mesure,
      unite: unites[mesure]
    });
  }, [etat, resultat, p, libellesMesures, unites]);

  // Une nouvelle option remet la barre d'echelle a vide : la recalculer.
  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart || !option) return;
    reinitialiserEchelle(chart);
    const image = window.requestAnimationFrame(() => reinitialiserEchelle(chart, true));
    return () => window.cancelAnimationFrame(image);
  }, [option]);

  const surInstance = useCallback((chart: echarts.ECharts) => {
    instanceRef.current = chart;
    const retirerEchelle = installerEchelleDynamique(chart);
    const zr = chart.getZr();
    const surMouvement = (e: { offsetX: number; offsetY: number }) => {
      const c = chart.convertFromPixel({ geoIndex: 0 }, [e.offsetX, e.offsetY]) as number[] | null;
      setCoordonnees(c ? `${Math.abs(c[1]).toFixed(4)}° ${c[1] >= 0 ? "N" : "S"}, ${Math.abs(c[0]).toFixed(4)}° ${c[0] >= 0 ? "E" : "O"}` : "");
    };
    zr.on("mousemove", surMouvement);
    zr.on("globalout", () => setCoordonnees(""));
    return () => {
      retirerEchelle();
      zr.off("mousemove", surMouvement);
      instanceRef.current = null;
    };
  }, []);

  if (!niveau) {
    return (
      <Etat hauteur={hauteur}>
        <EtatVide
          compact
          variante="attention"
          icone={<IconeCarte size={22} />}
          titre="Une dimension territoriale est requise"
          description="Choisissez d'abord une région, une préfecture ou une commune comme première dimension."
        />
      </Etat>
    );
  }
  if (etat.type === "chargement") {
    return (
      <Etat hauteur={hauteur}>
        <Squelette variante="bloc" hauteur="100%" libelle="Chargement du fond de carte" />
      </Etat>
    );
  }
  if (etat.type === "erreur") {
    return (
      <Etat hauteur={hauteur}>
        <EtatVide compact variante="erreur" icone={<AlertCircle size={22} />} titre="Le fond de carte n'a pas pu être chargé" description="Vérifiez votre connexion, puis modifiez un réglage pour réessayer." />
      </Etat>
    );
  }
  if (etat.type === "vide") {
    return (
      <Etat hauteur={hauteur}>
        <EtatVide
          compact
          variante="neutre"
          icone={<MapPinOff size={22} />}
          titre="Aucun contour disponible pour ce niveau"
          description="Le référentiel géographique doit être importé par l'administration générale."
        />
      </Etat>
    );
  }

  return (
    <div className="eva-st-carte" style={{ height: hauteur }}>
      <GraphiqueECharts ref={ref} option={option!} hauteur="100%" legendeMasquable={false} surInstance={surInstance} />
      {p.coordonnees && coordonnees && <div className={`eva-st-carte__coordonnees${p.source ? " avec-source" : ""}`}>{coordonnees}</div>}
    </div>
  );
});

/** Cadre d'un etat de la carte (chargement, erreur, vide) : meme hauteur que la carte pour ne pas faire sauter la page. */
function Etat({ hauteur, children }: { hauteur: number | string; children: ReactNode }) {
  return (
    <div className="eva-st-carte-etat" style={{ height: hauteur }}>
      {children}
    </div>
  );
}

export default GraphiqueCarte;
