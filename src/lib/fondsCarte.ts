import * as echarts from "echarts/core";
import { appelApi } from "./apiClient";
import type { CollectionCarte, PorteeCarte } from "./carte";

export interface FondCarte {
  nom: string;
  collection: CollectionCarte;
}

export interface InfosCartes {
  zone: { id: string; nom: string; type: string } | null;
  niveaux: Record<string, number>;
}

const fonds = new Map<string, Promise<FondCarte | null>>();

/**
 * Fond de carte d'un niveau (2 regions, 3 prefectures, 4 communes), charge
 * une seule fois par session et par portee puis enregistre dans ECharts.
 * `null` = aucun contour importe pour ce niveau / zone (message dedie a
 * l'ecran plutot qu'une carte vide). Un echec reseau n'est PAS memorise :
 * le prochain affichage reessaie.
 */
export function chargerFondCarte(niveau: number, portee: PorteeCarte, racine = ""): Promise<FondCarte | null> {
  const cle = `${niveau}:${portee}:${racine}`;
  const existant = fonds.get(cle);
  if (existant) return existant;

  const requete = appelApi<CollectionCarte>(`/statistiques/cartes/${niveau}?portee=${portee}${racine ? `&racine=${encodeURIComponent(racine)}` : ""}`)
    .then((collection) => {
      if (!collection.features?.length) return null;
      const nom = `evital_${niveau}_${portee}_${collection.zone?.id ?? "pays"}_${collection.signature ?? collection.features.length}`;
      if (!echarts.getMap(nom)) echarts.registerMap(nom, collection as unknown as Parameters<typeof echarts.registerMap>[1]);
      return { nom, collection };
    })
    .catch((erreur) => {
      fonds.delete(cle);
      throw erreur;
    });
  fonds.set(cle, requete);
  return requete;
}

export function chargerInfosCartes(): Promise<InfosCartes> {
  return appelApi<InfosCartes>("/statistiques/cartes");
}
