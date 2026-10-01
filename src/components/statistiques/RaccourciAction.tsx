import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { CarteLien } from "../ui";
import "../../styles/statistiques.css";

interface ProprietesRaccourciAction {
  vers: string;
  icone: ReactNode;
  titre: string;
  description: string;
}

/** Raccourci vers une action frequente : pastille d'icone, titre, consigne et fleche. */
export default function RaccourciAction({ vers, icone, titre, description }: ProprietesRaccourciAction) {
  return (
    <CarteLien to={vers} className="eva-st-raccourci">
      <span className="eva-st-raccourci__icone" aria-hidden="true">
        {icone}
      </span>
      <span className="eva-st-raccourci__texte">
        <span className="eva-st-raccourci__titre">{titre}</span>
        <span className="eva-st-raccourci__description">{description}</span>
      </span>
      <ArrowRight size={16} className="eva-st-raccourci__fleche" aria-hidden="true" />
    </CarteLien>
  );
}
