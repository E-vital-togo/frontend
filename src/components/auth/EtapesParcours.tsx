import { Check } from "lucide-react";
import { cx } from "../ui/utilitaires";
import "../../styles/auth.css";

const ETAPES = ["Mon code", "Mon dossier", "Le suivi"];

interface ProprietesEtapesParcours {
  /** Indice de l'etape en cours (0 : code, 1 : dossier, 2 : suivi). */
  actuelle: 0 | 1 | 2;
  /** Toutes les etapes sont faites (ecran de succes) : la derniere reste a consulter. */
  envoye?: boolean;
  /** Version en ligne, sans traits ni grandes pastilles : au-dessus d'un formulaire qui a son propre fil d'etapes. */
  compact?: boolean;
}

/** Fil des trois etapes du parcours parent : retrouver son code, completer son dossier, suivre l'avancement. */
export default function EtapesParcours({ actuelle, envoye, compact }: ProprietesEtapesParcours) {
  return (
    <ol className={cx("eva-acces-etapes", compact && "eva-acces-etapes--compact")} aria-label="Étapes de la démarche">
      {ETAPES.map((libelle, i) => {
        const fait = i < actuelle || (envoye && i < 2);
        const courant = !fait && i === actuelle;
        return (
          <li key={libelle} className={cx("eva-acces-etapes__item", fait && "est-fait", courant && "est-courant")} aria-current={courant ? "step" : undefined}>
            <span className="eva-acces-etapes__puce" aria-hidden="true">
              {fait ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            <span className="eva-acces-etapes__libelle">
              {libelle}
              <span className="eva-sr-only">{fait ? " (terminée)" : courant ? " (étape en cours)" : " (à venir)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
