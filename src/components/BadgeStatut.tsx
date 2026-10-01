import type { StatutDossier } from "../types/domaine";
import Badge, { type VarianteBadge } from "./ui/Badge";

const LIBELLES: Record<StatutDossier, string> = {
  recu: "Reçu",
  notifie: "Notifié",
  en_attente_complement: "En attente de complément",
  complete: "Complet",
  acte_emis: "Acte émis",
  sans_suite: "Sans suite"
};

const VARIANTES: Record<StatutDossier, VarianteBadge> = {
  recu: "neutre",
  notifie: "info",
  en_attente_complement: "attente",
  complete: "attente",
  acte_emis: "succes",
  sans_suite: "danger"
};

export default function BadgeStatut({ statut }: { statut: StatutDossier }) {
  return (
    <Badge variante={VARIANTES[statut] ?? "neutre"} point>
      {LIBELLES[statut] ?? statut}
    </Badge>
  );
}
