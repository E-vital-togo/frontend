import { ArrowRight } from "lucide-react";
import "../../styles/dossier.css";

export interface LigneComparaison {
  cle: string;
  libelle: string;
  avant: string;
  apres: string;
}

interface ProprietesComparaisonValeurs {
  lignes: LigneComparaison[];
  libelleAvant?: string;
  libelleApres?: string;
  /** Nom accessible de la liste. */
  ariaLabel: string;
  /** Version sans cadre, pour l'insérer dans une frise. */
  compacte?: boolean;
}

/**
 * Différences champ par champ : valeur actuelle, flèche, valeur proposée.
 * Sur grand écran, trois colonnes ; sur mobile, chaque champ devient un bloc
 * avec deux lignes étiquetées (l'étiquette remplace la flèche).
 */
export default function ComparaisonValeurs({
  lignes,
  libelleAvant = "Valeur actuelle",
  libelleApres = "Valeur proposée",
  ariaLabel,
  compacte
}: ProprietesComparaisonValeurs) {
  return (
    <div className={compacte ? "eva-dd-diff eva-dd-diff--compacte" : "eva-dd-diff"} role="list" aria-label={ariaLabel}>
      <div className="eva-dd-diff__entete" aria-hidden="true">
        <span>Champ</span>
        <span>{libelleAvant}</span>
        <span />
        <span>{libelleApres}</span>
      </div>
      {lignes.map((ligne) => (
        <div className="eva-dd-diff__ligne" role="listitem" key={ligne.cle}>
          <div className="eva-dd-diff__champ">{ligne.libelle}</div>
          <div className="eva-dd-diff__valeur eva-dd-diff__valeur--avant">
            <span className="eva-dd-diff__etiquette">{libelleAvant}</span>
            <span className="eva-dd-diff__texte">{ligne.avant}</span>
          </div>
          <ArrowRight className="eva-dd-diff__fleche" size={16} aria-hidden="true" />
          <div className="eva-dd-diff__valeur eva-dd-diff__valeur--apres">
            <span className="eva-dd-diff__etiquette">{libelleApres}</span>
            <span className="eva-dd-diff__texte">{ligne.apres}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
