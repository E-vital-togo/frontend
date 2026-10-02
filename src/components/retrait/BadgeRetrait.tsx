import { Hourglass, PackageCheck } from "lucide-react";
import { Badge } from "../ui";
import { dateRetrait } from "../../lib/retrait";
import type { EtatRetrait } from "../../types/domaine";

interface ProprietesBadgeRetrait {
  etat: EtatRetrait | undefined;
  retireLe?: string | null;
  /** Nom de l'agent : « Acte retiré le … par … » (en-tête du dossier). */
  retirePar?: string;
  /** « Acte retiré… » plutôt que « Retiré… » (en-tête du dossier). */
  detaille?: boolean;
  /** Ne rien afficher pour un acte non émis (le badge de statut du dossier suffit, ex. colonnes de liste). */
  masquerNonEmis?: boolean;
}

/**
 * Badge d'état de retrait de l'acte au guichet : « À retirer », « Retiré le … »
 * ou « Acte non émis ». Sans information (copie locale ancienne), rien n'est
 * affiché plutôt qu'une valeur supposée.
 */
export default function BadgeRetrait({ etat, retireLe, retirePar, detaille, masquerNonEmis }: ProprietesBadgeRetrait) {
  if (!etat) return null;
  if (etat === "non_emis") {
    return masquerNonEmis ? null : <Badge variante="neutre">Acte non émis</Badge>;
  }
  if (etat === "a_retirer") {
    return (
      <Badge variante="attente" icone={<Hourglass size={13} aria-hidden="true" />}>
        À retirer
      </Badge>
    );
  }
  const date = dateRetrait(retireLe);
  const texte = `${detaille ? "Acte retiré" : "Retiré"}${date ? ` le ${date}` : ""}${detaille && retirePar ? ` par ${retirePar}` : ""}`;
  return (
    <Badge variante="succes" icone={<PackageCheck size={13} aria-hidden="true" />}>
      {texte}
    </Badge>
  );
}
