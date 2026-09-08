import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface ProprietesEtatVide {
  message: string;
  icone?: LucideIcon;
}

export default function EtatVide({ message, icone: Icone = Inbox }: ProprietesEtatVide) {
  return (
    <div className="etat-vide">
      <Icone size={28} strokeWidth={1.5} />
      <span>{message}</span>
    </div>
  );
}
