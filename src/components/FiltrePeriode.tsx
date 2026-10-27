import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { Bouton, Champ } from "./ui";
import "../styles/filtre-periode.css";

interface ProprietesFiltrePeriode {
  dateDebut: string;
  dateFin: string;
  onChanger: (debut: string, fin: string) => void;
}

/**
 * Deux dates (AAAA-MM-JJ, format natif de <input type="date">) qui bornent
 * une liste ; les bornes se contraignent mutuellement. Vide = pas de limite.
 */
export default function FiltrePeriode({ dateDebut, dateFin, onChanger }: ProprietesFiltrePeriode) {
  const id = useId();
  return (
    <div className="eva-filtre-periode" role="group" aria-label="Période">
      <Champ id={`${id}-debut`} label="Depuis le">
        <input id={`${id}-debut`} type="date" value={dateDebut} max={dateFin || undefined} onChange={(e) => onChanger(e.target.value, dateFin)} />
      </Champ>
      <Champ id={`${id}-fin`} label="Jusqu'au">
        <input id={`${id}-fin`} type="date" value={dateFin} min={dateDebut || undefined} onChange={(e) => onChanger(dateDebut, e.target.value)} />
      </Champ>
      {(dateDebut || dateFin) && (
        <Bouton variante="fantome" taille="petit" iconeGauche={<RotateCcw size={14} />} onClick={() => onChanger("", "")}>
          Effacer les dates
        </Bouton>
      )}
    </div>
  );
}
