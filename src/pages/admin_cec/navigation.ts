import type { LienNavigation } from "../../types/domaine";

export const LIENS_ADMIN_CEC: LienNavigation[] = [
  { chemin: "/admin-cec", libelle: "Tableau de bord" },
  { chemin: "/admin-cec/utilisateurs", libelle: "Agents et administrateurs" },
  { chemin: "/admin-cec/demandes-modification", libelle: "Demandes de modification" }
];
