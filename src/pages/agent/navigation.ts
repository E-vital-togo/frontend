import { AlertTriangle, FilePlus, FolderOpen, LayoutDashboard, QrCode, RefreshCw } from "lucide-react";
import type { LienNavigation } from "../../types/domaine";

export const LIENS_AGENT: LienNavigation[] = [
  { chemin: "/agent", libelle: "Tableau de bord", icone: LayoutDashboard },
  {
    chemin: "/agent/dossiers",
    libelle: "Dossiers",
    icone: FolderOpen,
    cleCompteur: "echeances",
    sousLiens: [
      { chemin: "/agent/dossiers?event_type=naissance", libelle: "Naissance", cleCompteur: "echeancesNaissance" },
      { chemin: "/agent/dossiers?event_type=deces", libelle: "Deces", cleCompteur: "echeancesDeces" }
    ]
  },
  { chemin: "/agent/dossiers/nouveau", libelle: "Nouveau dossier", icone: FilePlus },
  { chemin: "/agent/retrait", libelle: "Retrait", icone: QrCode },
  { chemin: "/agent/conflits", libelle: "Conflits", icone: AlertTriangle, cleCompteur: "conflits" },
  { chemin: "/agent/synchronisation", libelle: "Synchronisation", icone: RefreshCw, cleCompteur: "syncEchouees" }
];
