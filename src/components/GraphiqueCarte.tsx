import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as echarts from "echarts/core";
import GraphiqueECharts, { type PoigneeGraphique } from "./ui/GraphiqueECharts";
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
    return <Message texte="Une carte demande une dimension territoriale en premier : region, prefecture ou commune." />;
  }
  if (etat.type === "chargement") return <Message texte="Chargement du fond de carte..." />;
  if (etat.type === "erreur") return <Message texte="Le fond de carte n'a pas pu etre charge. Reessayez." erreur />;
  if (etat.type === "vide") {
    return <Message texte="Aucun contour n'est disponible pour ce niveau. Le referentiel geographique doit etre importe par l'administration generale." />;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: hauteur }}>
      <GraphiqueECharts ref={ref} option={option!} hauteur="100%" legendeMasquable={false} surInstance={surInstance} />
      {p.coordonnees && coordonnees && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: p.source ? 18 : 6,
            transform: "translateX(-50%)",
            padding: "2px 9px",
            fontSize: 10.5,
            borderRadius: 10,
            background: "rgba(18,38,30,0.78)",
            color: "#fff",
            pointerEvents: "none",
            whiteSpace: "nowrap"
          }}
        >
          {coordonnees}
        </div>
      )}
    </div>
  );
});

function Message({ texte, erreur = false }: { texte: string; erreur?: boolean }) {
  return (
    <p style={{ padding: "28px 12px", textAlign: "center", fontSize: 13, color: erreur ? "var(--couleur-erreur, #B3261E)" : "var(--couleur-gris-service-2)" }}>{texte}</p>
  );
}

export default GraphiqueCarte;
