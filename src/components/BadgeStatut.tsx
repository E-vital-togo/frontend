import type { StatutDossier } from "../types/domaine";

const LIBELLES: Record<StatutDossier, string> = {
  recu: "Recu",
  notifie: "Notifie",
  en_attente_complement: "En attente de complement",
  complete: "Complete",
  acte_emis: "Acte emis",
  sans_suite: "Sans suite"
};

const CLASSES: Record<StatutDossier, string> = {
  recu: "badge",
  notifie: "badge",
  en_attente_complement: "badge badge--attente",
  complete: "badge badge--attente",
  acte_emis: "badge badge--actif",
  sans_suite: "badge badge--alerte"
};

export default function BadgeStatut({ statut }: { statut: StatutDossier }) {
  return <span className={CLASSES[statut] ?? "badge"}>{LIBELLES[statut] ?? statut}</span>;
}
