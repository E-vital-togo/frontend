import type { LienNavigation } from "../../types/domaine";

export const LIENS_AGENT: LienNavigation[] = [
  { chemin: "/agent", libelle: "Tableau de bord" },
  { chemin: "/agent/dossiers", libelle: "Dossiers" },
  { chemin: "/agent/dossiers/nouveau", libelle: "Nouveau dossier" },
  { chemin: "/agent/conflits", libelle: "Conflits" }
];
