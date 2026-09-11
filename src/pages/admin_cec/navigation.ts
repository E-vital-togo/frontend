import { AlertTriangle, BarChart3, BellOff, FileEdit, FolderOpen, Image, LayoutDashboard, Megaphone, ScrollText, Users } from "lucide-react";
import type { LienNavigation } from "../../types/domaine";

export const LIENS_ADMIN_CEC: LienNavigation[] = [
  { chemin: "/admin-cec", libelle: "Tableau de bord", icone: LayoutDashboard },
  { chemin: "/admin-cec/dossiers", libelle: "Dossiers de la zone", icone: FolderOpen },
  { chemin: "/admin-cec/statistiques", libelle: "Statistiques avancees", icone: BarChart3 },
  { chemin: "/admin-cec/utilisateurs", libelle: "Agents et administrateurs", icone: Users },
  { chemin: "/admin-cec/demandes-modification", libelle: "Demandes de modification", icone: FileEdit, cleCompteur: "demandes" },
  { chemin: "/admin-cec/notifications-echouees", libelle: "Notifications en echec", icone: BellOff, cleCompteur: "notificationsEchouees" },
  { chemin: "/admin-cec/campagnes-relance", libelle: "Campagnes de relance", icone: Megaphone },
  { chemin: "/admin-cec/conflits", libelle: "Conflits de synchronisation", icone: AlertTriangle, cleCompteur: "conflits" },
  { chemin: "/admin-cec/journal", libelle: "Journal de la zone", icone: ScrollText },
  { chemin: "/admin-cec/personnalisation", libelle: "Personnalisation", icone: Image }
];
