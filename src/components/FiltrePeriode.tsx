import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { Bouton, Champ, Selecteur } from "./ui";
import "../styles/filtre-periode.css";

/**
 * Date sur laquelle porte la période d'une liste de dossiers :
 * - "evenement"   : date réelle de la naissance / du décès (Dossier.date_evenement) ;
 * - "declaration" : date de déclaration, qui est la date de l'événement dans
 *   DHIS2 pour un dossier reçu de DHIS2 - celle que filtre dhis2-app.
 */
export type ChampDateDossier = "evenement" | "declaration";

/** Paramètres de l'API /dossiers/ pour une période sur le champ choisi. */
export function parametresPeriode(champ: ChampDateDossier, debut: string, fin: string): Array<[string, string]> {
  const prefixe = champ === "declaration" ? "date_declaration" : "date_evenement";
  const parametres: Array<[string, string]> = [];
  if (debut) parametres.push([`${prefixe}_min`, debut]);
  if (fin) parametres.push([`${prefixe}_max`, fin]);
  return parametres;
}

function jourLisible(iso: string): string {
  const [a, m, j] = iso.split("-");
  return a && m && j ? `${j}/${m}/${a}` : iso;
}

/** Texte de la puce « filtre actif » d'une période (ex. « Déclaration : du 01/09/2026 au 30/09/2026 »), null si aucune borne. */
export function libellePeriode(champ: ChampDateDossier, debut: string, fin: string): string | null {
  if (!debut && !fin) return null;
  const quoi = champ === "declaration" ? "Déclaration" : "Naissance / décès";
  const quand = debut && fin ? `du ${jourLisible(debut)} au ${jourLisible(fin)}` : debut ? `depuis le ${jourLisible(debut)}` : `jusqu'au ${jourLisible(fin)}`;
  return `${quoi} : ${quand}`;
}

interface ProprietesFiltrePeriode {
  dateDebut: string;
  dateFin: string;
  onChanger: (debut: string, fin: string) => void;
  /** Avec ces deux propriétés, un sélecteur propose la date filtrée (événement réel ou déclaration). */
  champDate?: ChampDateDossier;
  onChangerChampDate?: (champ: ChampDateDossier) => void;
}

/**
 * Deux dates (AAAA-MM-JJ, format natif de <input type="date">) qui bornent
 * une liste ; les bornes se contraignent mutuellement. Vide = pas de limite.
 */
export default function FiltrePeriode({ dateDebut, dateFin, onChanger, champDate, onChangerChampDate }: ProprietesFiltrePeriode) {
  const id = useId();
  return (
    <div className="eva-filtre-periode" role="group" aria-label="Période">
      {champDate && onChangerChampDate && (
        <Champ id={`${id}-champ`} label="Filtrer sur">
          <Selecteur id={`${id}-champ`} valeur={champDate} onChange={(v) => onChangerChampDate(v as ChampDateDossier)}>
            <option value="evenement">Date de naissance / du décès</option>
            <option value="declaration">Date de déclaration (date DHIS2)</option>
          </Selecteur>
        </Champ>
      )}
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
