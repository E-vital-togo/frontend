import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  TEXTES,
  filtrerOptions,
  indexSuivant,
  jetonsRecherche,
  premierActivable,
  dernierActivable
} from "../../lib/selecteur";
import { IconeChevron, ListeOptions, idOption, optionsDepuisEnfants, rendreVisible, usePanneauFlottant, type OptionSelecteur } from "./selecteurInterne";
import { cx } from "./utilitaires";
import "../../styles/selecteur.css";

export interface ProprietesChampSuggestions {
  id?: string;
  /** Texte saisi (libre : n'a pas besoin de figurer parmi les suggestions). */
  valeur: string | null | undefined;
  /** Emet le texte saisi, ou le libelle de la suggestion choisie. */
  onChange: (valeur: string) => void;
  /**
   * Suggestions. Le texte insere est le `libelle` (comme la `value` d'une `<option>` de `<datalist>`).
   * Alternative : des `<option value="...">` en enfants, comme dans un `<datalist>`.
   */
  options?: readonly OptionSelecteur[];
  children?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  lectureSeule?: boolean;
  invalide?: boolean;
  /** Dossier verrouille : meme rendu que les autres controles verrouilles (la modification est signalee via `onChange`). */
  verrouille?: boolean;
  requis?: boolean;
  /** Nom de champ de formulaire (porte par le champ de saisie lui-meme). */
  nom?: string;
  maxLength?: number;
  compact?: boolean;
  largeur?: number | string;
  petit?: boolean;
  mono?: boolean;
  className?: string;
  etiquettePar?: string;
  ariaLabel?: string;
  decritPar?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

/**
 * Saisie libre avec suggestions : remplace `<input list="..."> + <datalist>`. Le champ est un vrai `<input>`
 * (la valeur emise est le texte saisi, valide meme s'il ne correspond a aucune suggestion) ; le panneau de
 * suggestions a le meme aspect que `Selecteur` (portail, position fixe, ouverture vers le haut si besoin),
 * est filtre pendant la frappe (insensible aux accents et a la casse, surlignage), et se pilote au clavier :
 * fleches pour parcourir, Entree pour choisir la suggestion en surbrillance (sans surbrillance, Entree garde
 * la saisie), Echap pour fermer. Roles ARIA : combobox + listbox + option, `aria-activedescendant`.
 */
export default function ChampSuggestions({
  id: idPropose,
  valeur,
  onChange,
  options: optionsPropres,
  children,
  placeholder,
  disabled = false,
  lectureSeule = false,
  invalide = false,
  verrouille = false,
  requis = false,
  nom,
  maxLength,
  compact = false,
  largeur,
  petit = false,
  mono = false,
  className,
  etiquettePar,
  ariaLabel,
  decritPar,
  autoFocus,
  onBlur
}: ProprietesChampSuggestions) {
  const idUnique = useId();
  const id = idPropose ?? `eva-sug-${idUnique.replace(/:/g, "")}`;
  const idBase = `${id}-sug`;
  const texte = valeur ?? "";

  const [ouvert, setOuvert] = useState(false);
  // Le filtre ne s'applique qu'une fois que l'utilisateur a tape : ouvrir sur une valeur deja saisie montre toutes les suggestions.
  const [filtreActif, setFiltreActif] = useState(false);
  const [indexActif, setIndexActif] = useState(-1);

  const refRacine = useRef<HTMLDivElement>(null);
  const refChamp = useRef<HTMLInputElement>(null);
  const refPanneau = useRef<HTMLDivElement>(null);
  const refListe = useRef<HTMLDivElement>(null);

  const options = useMemo<readonly OptionSelecteur[]>(() => optionsPropres ?? optionsDepuisEnfants(children), [optionsPropres, children]);
  const interactif = !disabled && !lectureSeule;
  const visibles = useMemo(() => (filtreActif ? filtrerOptions(options, texte) : options.slice()), [options, texte, filtreActif]);
  const jetons = useMemo(() => (filtreActif ? jetonsRecherche(texte) : []), [texte, filtreActif]);
  const panneauOuvert = ouvert && interactif && visibles.length > 0;
  const actif = visibles[indexActif] ? indexActif : -1;
  const choisies = useMemo(() => new Set(options.filter((o) => o.libelle === texte).map((o) => o.valeur)), [options, texte]);

  const fermer = useCallback((rendreFocus: boolean) => {
    setOuvert(false);
    setIndexActif(-1);
    if (rendreFocus) refChamp.current?.focus({ preventScroll: true });
  }, []);

  function ouvrir(depuisSaisie: boolean) {
    if (!interactif || options.length === 0) return;
    setFiltreActif(depuisSaisie);
    // A l'ouverture sans saisie, la suggestion identique a la valeur courante est mise en avant.
    const initiales = depuisSaisie ? filtrerOptions(options, texte) : options;
    setIndexActif(depuisSaisie ? -1 : initiales.findIndex((o) => o.libelle === texte));
    setOuvert(true);
  }

  const positionDuPanneau = usePanneauFlottant({
    ouvert: panneauOuvert,
    mobile: false,
    declencheur: refChamp,
    racine: refRacine,
    panneau: refPanneau,
    fermer,
    fermerAuRedimensionnement: "largeur",
    apresPosition: () => {
      const element = refListe.current?.querySelector<HTMLElement>(".eva-sel__option--actif");
      rendreVisible(refListe.current, element ?? null, true);
    }
  });

  useEffect(() => {
    if (!panneauOuvert) return;
    const element = refListe.current?.querySelector<HTMLElement>(`[data-index="${actif}"]`);
    rendreVisible(refListe.current, element ?? null);
  }, [panneauOuvert, actif]);

  function choisir(index: number) {
    const option = visibles[index];
    if (!option || option.desactivee) return;
    onChange(option.libelle);
    setFiltreActif(false);
    fermer(true);
    // Curseur en fin de texte : on peut poursuivre la saisie.
    requestAnimationFrame(() => {
      const champ = refChamp.current;
      if (champ) champ.setSelectionRange(champ.value.length, champ.value.length);
    });
  }

  function surTouches(evenement: KeyboardEvent<HTMLInputElement>) {
    switch (evenement.key) {
      case "ArrowDown":
      case "ArrowUp": {
        evenement.preventDefault();
        if (!panneauOuvert) {
          ouvrir(false);
          return;
        }
        const sens = evenement.key === "ArrowDown" ? 1 : -1;
        setIndexActif(actif < 0 ? (sens === 1 ? premierActivable(visibles) : dernierActivable(visibles)) : indexSuivant(visibles, actif, sens));
        break;
      }
      case "Enter":
        if (panneauOuvert) {
          evenement.preventDefault(); // pas de soumission : on valide d'abord la suggestion ou on ferme la liste
          if (actif >= 0) choisir(actif);
          else fermer(false);
        }
        break;
      case "Tab":
        // Le texte saisi reste tel quel ; la fermeture est geree par usePanneauFlottant.
        break;
    }
  }

  const classes = cx(
    "eva-sel eva-sel--saisie",
    (compact || largeur !== undefined) && "eva-sel--compact",
    petit && "eva-sel--petit",
    panneauOuvert && "eva-sel--ouvert",
    invalide && "eva-sel--invalide",
    disabled && "eva-sel--desactive",
    lectureSeule && !disabled && "eva-sel--lecture",
    verrouille && !disabled && "eva-sel--verrouille",
    options.length === 0 && "eva-sel--sans-chevron",
    className
  );
  const styleRacine: CSSProperties | undefined = largeur !== undefined ? { width: typeof largeur === "number" ? `${largeur}px` : largeur } : undefined;
  const idActif = panneauOuvert && actif >= 0 ? idOption(idBase, actif) : undefined;
  const annonce = panneauOuvert && filtreActif ? `${visibles.length} suggestion${visibles.length > 1 ? "s" : ""}` : "";

  return (
    <div className={classes} style={styleRacine} ref={refRacine}>
      <input
        ref={refChamp}
        id={id}
        name={nom}
        type="text"
        className={cx("eva-sel__saisie", mono && "eva-sel__saisie--mono")}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={panneauOuvert}
        aria-controls={panneauOuvert ? `${idBase}-liste` : undefined}
        aria-activedescendant={idActif}
        aria-labelledby={etiquettePar && !ariaLabel ? etiquettePar : undefined}
        aria-label={ariaLabel}
        aria-describedby={decritPar}
        aria-invalid={invalide || undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        spellCheck={false}
        placeholder={placeholder}
        maxLength={maxLength}
        required={requis}
        disabled={disabled}
        readOnly={lectureSeule}
        value={texte}
        onChange={(e) => {
          onChange(e.target.value);
          setFiltreActif(true);
          setIndexActif(-1);
          if (!ouvert) setOuvert(true);
        }}
        onClick={() => {
          // Comme un datalist natif : un clic dans le champ propose les suggestions.
          if (!ouvert) ouvrir(false);
        }}
        onBlur={onBlur}
        onKeyDown={surTouches}
      />
      {options.length > 0 && interactif && (
        <button
          type="button"
          className="eva-sel__bascule"
          tabIndex={-1}
          aria-label={panneauOuvert ? "Masquer les suggestions" : "Afficher les suggestions"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (panneauOuvert) fermer(true);
            else {
              refChamp.current?.focus({ preventScroll: true });
              ouvrir(false);
            }
          }}
        >
          <IconeChevron />
        </button>
      )}

      {panneauOuvert &&
        createPortal(
          <div
            ref={refPanneau}
            className={cx("eva-sel__panneau", "eva-sel__panneau--suggestions", positionDuPanneau === "haut" && "eva-sel__panneau--haut")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <ListeOptions
              idBase={idBase}
              visibles={visibles}
              indexActif={actif}
              choisies={choisies}
              multiple={false}
              jetons={jetons}
              message={TEXTES.aucunResultat}
              etiquettePar={etiquettePar}
              ariaLabel={ariaLabel ?? placeholder ?? "Suggestions"}
              refListe={refListe}
              surChoix={choisir}
              surSurvol={setIndexActif}
            />
            <div className="eva-sel__sr" role="status" aria-live="polite">
              {annonce}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
