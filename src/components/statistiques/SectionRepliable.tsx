import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import "../../styles/statistiques.css";

interface ProprietesSectionRepliable {
  /** Numero d'etape affiche dans la pastille (1, 2, 3...). */
  numero: number;
  titre: string;
  /** Resume du choix courant, visible repliee ("Barres", "2 sélectionnées"...). */
  resume?: ReactNode;
  /** Etape renseignee : la pastille devient pleine avec une coche. */
  complete?: boolean;
  ouverteParDefaut?: boolean;
  children: ReactNode;
}

/**
 * Etape repliable d'un formulaire en plusieurs blocs numerotes (constructeur
 * de graphique). Le contenu reste monte quand la section est repliee : les
 * champs gardent leur etat et la page ne recalcule rien.
 */
export default function SectionRepliable({ numero, titre, resume, complete, ouverteParDefaut = false, children }: ProprietesSectionRepliable) {
  const [ouverte, setOuverte] = useState(ouverteParDefaut);
  const identifiant = useId();
  const idBouton = `${identifiant}-bouton`;
  const idPanneau = `${identifiant}-panneau`;

  return (
    <section className={`eva-st-etape${ouverte ? " est-ouverte" : ""}`}>
      <h3 className="eva-st-etape__titre">
        <button type="button" id={idBouton} className="eva-st-etape__bouton" aria-expanded={ouverte} aria-controls={idPanneau} onClick={() => setOuverte((o) => !o)}>
          <span className={`eva-st-etape__numero${complete ? " est-complete" : ""}`} aria-hidden="true">
            {complete ? <Check size={14} strokeWidth={3} /> : numero}
          </span>
          <span className="eva-st-etape__texte">
            <span className="eva-st-etape__nom">{titre}</span>
            {resume && <span className="eva-st-etape__resume">{resume}</span>}
          </span>
          <ChevronDown size={18} className="eva-st-etape__chevron" aria-hidden="true" />
        </button>
      </h3>
      <div id={idPanneau} role="region" aria-labelledby={idBouton} hidden={!ouverte} className="eva-st-etape__corps">
        {children}
      </div>
    </section>
  );
}
