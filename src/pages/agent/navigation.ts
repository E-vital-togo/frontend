import { AlertTriangle, FilePlus, FolderOpen, LayoutDashboard, QrCode } from "lucide-react";
import type { LienNavigation } from "../../types/domaine";

export const LIENS_AGENT: LienNavigation[] = [
  { chemin: "/agent", libelle: "Tableau de bord", icone: LayoutDashboard },
  { chemin: "/agent/dossiers", libelle: "Dossiers", icone: FolderOpen, cleCompteur: "echeances" },
  { chemin: "/agent/dossiers/nouveau", libelle: "Nouveau dossier", icone: FilePlus },
  { chemin: "/agent/retrait", libelle: "Retrait", icone: QrCode },
  { chemin: "/agent/conflits", libelle: "Conflits", icone: AlertTriangle, cleCompteur: "conflits" }
];
