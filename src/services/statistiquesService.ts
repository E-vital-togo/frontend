import { appelApi } from "../lib/apiClient";

export type DimensionStatistique = "statut" | "event_type" | "origine" | "type_dossier" | "mairie";
export type IntervalleEvolution = "jour" | "semaine" | "mois";

export interface EntreeRepartition {
  cle: string;
  libelle: string;
  valeur: number;
}

export interface ReponseEvolution {
  donnees: Array<Record<string, string | number>>;
  series: string[];
}

export interface FiltrePeriode {
  dateDebut?: string;
  dateFin?: string;
}

function parametresPeriode(filtre: FiltrePeriode): string {
  const parametres = new URLSearchParams();
  if (filtre.dateDebut) parametres.set("date_debut", filtre.dateDebut);
  if (filtre.dateFin) parametres.set("date_fin", filtre.dateFin);
  return parametres.toString();
}

export function obtenirRepartition(dimension: DimensionStatistique, filtre: FiltrePeriode): Promise<EntreeRepartition[]> {
  const p = new URLSearchParams(parametresPeriode(filtre));
  p.set("dimension", dimension);
  return appelApi<EntreeRepartition[]>(`/dossiers/statistiques/repartition/?${p.toString()}`);
}

export function obtenirEvolution(
  intervalle: IntervalleEvolution,
  serie: DimensionStatistique | null,
  filtre: FiltrePeriode
): Promise<ReponseEvolution> {
  const p = new URLSearchParams(parametresPeriode(filtre));
  p.set("intervalle", intervalle);
  if (serie) p.set("serie", serie);
  return appelApi<ReponseEvolution>(`/dossiers/statistiques/evolution/?${p.toString()}`);
}
