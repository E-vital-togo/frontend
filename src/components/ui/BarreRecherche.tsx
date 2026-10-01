import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { cx } from "./utilitaires";

interface ProprietesBarreRecherche {
  /** Valeur courante (controlee par le parent). */
  valeur: string;
  /** Appelee avec le texte saisi, immediatement ou apres `delai`. */
  onChanger: (valeur: string) => void;
  placeholder?: string;
  /** Delai d'anti-rebond en millisecondes (defaut 0 : pas de delai). 300 est adapte a une recherche serveur. */
  delai?: number;
  /** Nom accessible du champ (defaut : le placeholder). */
  ariaLabel?: string;
  /** Appelee a la validation (Entree), apres emission immediate de la valeur. */
  onSoumettre?: (valeur: string) => void;
  /** Affiche un spinner (recherche en cours cote serveur). */
  chargement?: boolean;
  autoFocus?: boolean;
  /** Occupe toute la largeur disponible au lieu de 460px maximum. */
  pleineLargeur?: boolean;
  id?: string;
  className?: string;
}

/**
 * Champ de recherche avec icone, bouton d'effacement (et Echap), anti-rebond
 * optionnel. Reste synchronise si le parent reinitialise `valeur`.
 */
export default function BarreRecherche({
  valeur,
  onChanger,
  placeholder = "Rechercher...",
  delai = 0,
  ariaLabel,
  onSoumettre,
  chargement,
  autoFocus,
  pleineLargeur,
  id,
  className
}: ProprietesBarreRecherche) {
  const [texte, setTexte] = useState(valeur);
  const dernierEmis = useRef(valeur);
  const minuteur = useRef<number | undefined>(undefined);
  const refChamp = useRef<HTMLInputElement>(null);

  // Reinitialisation par le parent (ex: bouton "Effacer les filtres")
  useEffect(() => {
    if (valeur !== dernierEmis.current) {
      dernierEmis.current = valeur;
      setTexte(valeur);
    }
  }, [valeur]);

  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  function emettre(suivant: string) {
    window.clearTimeout(minuteur.current);
    dernierEmis.current = suivant;
    onChanger(suivant);
  }

  function saisir(suivant: string) {
    setTexte(suivant);
    window.clearTimeout(minuteur.current);
    if (delai > 0) minuteur.current = window.setTimeout(() => emettre(suivant), delai);
    else emettre(suivant);
  }

  function effacer() {
    setTexte("");
    emettre("");
    refChamp.current?.focus();
  }

  function surClavier(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && texte) {
      e.preventDefault();
      e.stopPropagation();
      effacer();
    } else if (e.key === "Enter") {
      // Pas de <form> : la barre peut se trouver dans un formulaire existant
      e.preventDefault();
      emettre(texte);
      onSoumettre?.(texte);
    }
  }

  return (
    <div className={cx("eva-recherche", pleineLargeur && "eva-recherche--pleine", className)} role="search">
      <span className="eva-recherche__icone" aria-hidden="true">
        <Search size={17} />
      </span>
      <input
        ref={refChamp}
        id={id}
        type="search"
        className="eva-recherche__champ"
        value={texte}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder.replace(/\.\.\.$/, "")}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => saisir(e.target.value)}
        onKeyDown={surClavier}
      />
      {chargement ? (
        <span className="eva-recherche__attente" role="status" aria-label="Recherche en cours">
          <span className="eva-spinner" aria-hidden="true" />
        </span>
      ) : (
        texte && (
          <button type="button" className="eva-recherche__effacer" onClick={effacer} aria-label="Effacer la recherche">
            <X size={16} aria-hidden="true" />
          </button>
        )
      )}
    </div>
  );
}
