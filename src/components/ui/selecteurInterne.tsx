import { Children, Fragment, isValidElement, useEffect, useLayoutEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import {
  REQUETE_MOBILE,
  calculerPosition,
  morceauxSurlignes,
  type OptionBrute
} from "../../lib/selecteur";

/** Option du selecteur : les champs de recherche/affichage de `OptionBrute` + une icone optionnelle. */
export interface OptionSelecteur extends OptionBrute {
  /** Icone (ou pastille) affichee a gauche du libelle, dans la liste et dans le declencheur. */
  icone?: ReactNode;
}

/* ------------------------------------------------------------------ icones */

export function IconeChevron() {
  return (
    <svg className="eva-sel__chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M3 5.25 7 9.25l4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeCoche({ taille = 14 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="m2.8 7.4 2.7 2.7 5.7-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeLoupe() {
  return (
    <svg className="eva-sel__loupe" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.6 10.6 3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconeCroix({ taille = 12 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="m2.5 2.5 7 7m0-7-7 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------------------------------------- <option> -> options */

function texteDe(noeud: ReactNode): string {
  if (noeud === null || noeud === undefined || typeof noeud === "boolean") return "";
  if (typeof noeud === "string" || typeof noeud === "number") return String(noeud);
  if (Array.isArray(noeud)) return noeud.map(texteDe).join("");
  if (isValidElement(noeud)) return texteDe((noeud.props as { children?: ReactNode }).children);
  return "";
}

/**
 * Convertit des enfants `<option>` / `<optgroup>` (comme ceux d'un `<select>` natif) en options du selecteur.
 * Permet de migrer un `<select>` en gardant ses `<option>`.
 */
export function optionsDepuisEnfants(enfants: ReactNode): OptionSelecteur[] {
  const resultat: OptionSelecteur[] = [];
  const visiter = (noeud: ReactNode, groupe: string | undefined) => {
    Children.forEach(noeud, (enfant) => {
      if (!isValidElement(enfant)) return;
      const props = enfant.props as { value?: string | number; disabled?: boolean; label?: string; children?: ReactNode };
      if (enfant.type === Fragment) {
        visiter(props.children, groupe);
      } else if (enfant.type === "optgroup") {
        visiter(props.children, props.label);
      } else if (enfant.type === "option") {
        const texte = texteDe(props.children);
        // Comme un <datalist>, une <option value="x" /> sans texte s'affiche avec sa valeur.
        const libelle = texte || (props.value !== undefined ? String(props.value) : "");
        resultat.push({
          valeur: props.value !== undefined ? String(props.value) : libelle,
          libelle,
          desactivee: props.disabled,
          groupe
        });
      }
    });
  };
  visiter(enfants, undefined);
  return resultat;
}

/**
 * Helper de migration : construit les options d'un selecteur a partir d'une liste quelconque.
 *   optionsDepuis(mairies, (m) => m.id, (m) => m.nom)
 *   optionsDepuis(mairies, (m) => ({ valeur: m.id, libelle: m.nom, description: m.commune }))
 */
export function optionsDepuis<T>(
  elements: readonly T[],
  valeur: ((element: T) => string) | ((element: T) => OptionSelecteur),
  libelle?: (element: T) => string
): OptionSelecteur[] {
  return elements.map((element) => {
    const sortie = valeur(element);
    if (typeof sortie === "object") return sortie;
    return { valeur: sortie, libelle: libelle ? libelle(element) : sortie };
  });
}

/* --------------------------------------------------------------- surlignage */

export function Surligne({ texte, jetons }: { texte: string; jetons: readonly string[] }) {
  if (jetons.length === 0) return <>{texte}</>;
  return (
    <>
      {morceauxSurlignes(texte, jetons).map((morceau, i) =>
        morceau.surligne ? (
          <mark key={i} className="eva-sel__surlignage">
            {morceau.texte}
          </mark>
        ) : (
          <Fragment key={i}>{morceau.texte}</Fragment>
        )
      )}
    </>
  );
}

/* ------------------------------------------------------------------- liste */

interface ProprietesListeOptions {
  idBase: string;
  visibles: readonly OptionSelecteur[];
  indexActif: number;
  choisies: ReadonlySet<string>;
  multiple: boolean;
  /** Options non cochables (limite `max` atteinte). */
  bloquees?: ReadonlySet<string>;
  jetons: readonly string[];
  message: string;
  etiquettePar?: string;
  ariaLabel?: string;
  refListe: RefObject<HTMLDivElement>;
  surChoix: (index: number) => void;
  surSurvol: (index: number) => void;
}

export function idOption(idBase: string, index: number): string {
  return `${idBase}-o-${index}`;
}

/** Liste `role="listbox"` : options, en-tetes de groupe, case ou coche de selection, message "Aucun resultat". */
export function ListeOptions({
  idBase,
  visibles,
  indexActif,
  choisies,
  multiple,
  bloquees,
  jetons,
  message,
  etiquettePar,
  ariaLabel,
  refListe,
  surChoix,
  surSurvol
}: ProprietesListeOptions) {
  const blocs = useMemo(() => {
    const resultat: Array<{ groupe?: string; elements: Array<{ option: OptionSelecteur; index: number }> }> = [];
    visibles.forEach((option, index) => {
      const dernier = resultat[resultat.length - 1];
      if (!dernier || dernier.groupe !== option.groupe) resultat.push({ groupe: option.groupe, elements: [{ option, index }] });
      else dernier.elements.push({ option, index });
    });
    return resultat;
  }, [visibles]);

  return (
    <div
      className="eva-sel__liste"
      id={`${idBase}-liste`}
      role="listbox"
      ref={refListe}
      aria-multiselectable={multiple || undefined}
      aria-labelledby={etiquettePar}
      aria-label={etiquettePar ? undefined : ariaLabel}
    >
      {visibles.length === 0 && (
        <div className="eva-sel__vide" role="presentation">
          {message}
        </div>
      )}
      {blocs.map((bloc, k) => {
        const idGroupe = `${idBase}-g-${k}`;
        const options = bloc.elements.map(({ option, index }) => {
          const coche = choisies.has(option.valeur);
          const desactivee = option.desactivee || (!coche && bloquees?.has(option.valeur));
          return (
            <div
              key={`${option.valeur}-${index}`}
              id={idOption(idBase, index)}
              data-index={index}
              role="option"
              aria-selected={coche}
              aria-disabled={desactivee || undefined}
              className={`eva-sel__option${index === indexActif ? " eva-sel__option--actif" : ""}`}
              onMouseMove={() => {
                if (index !== indexActif && !desactivee) surSurvol(index);
              }}
              onClick={() => {
                if (!desactivee) surChoix(index);
              }}
            >
              {multiple && (
                <span className="eva-sel__case" aria-hidden="true">
                  <IconeCoche taille={13} />
                </span>
              )}
              {option.icone && <span className="eva-sel__option-icone">{option.icone}</span>}
              <span className="eva-sel__texte">
                <span className="eva-sel__libelle">
                  <Surligne texte={option.libelle} jetons={jetons} />
                </span>
                {option.description && (
                  <span className="eva-sel__description">
                    <Surligne texte={option.description} jetons={jetons} />
                  </span>
                )}
              </span>
              {!multiple && coche && (
                <span className="eva-sel__coche" aria-hidden="true">
                  <IconeCoche />
                </span>
              )}
            </div>
          );
        });
        if (bloc.groupe === undefined) return <Fragment key={k}>{options}</Fragment>;
        return (
          <div key={k} className="eva-sel__groupe" role="group" aria-labelledby={idGroupe}>
            <div className="eva-sel__groupe-entete" id={idGroupe} role="presentation">
              {bloc.groupe}
            </div>
            {options}
          </div>
        );
      })}
    </div>
  );
}

/** Fait defiler la liste pour que l'element soit visible (sans toucher au defilement de la page). */
export function rendreVisible(liste: HTMLElement | null, element: HTMLElement | null, centrer = false) {
  if (!liste || !element) return;
  const l = liste.getBoundingClientRect();
  const e = element.getBoundingClientRect();
  if (centrer) {
    liste.scrollTop += e.top - l.top - (l.height - e.height) / 2;
  } else if (e.top < l.top) {
    liste.scrollTop -= l.top - e.top + 4;
  } else if (e.bottom > l.bottom) {
    liste.scrollTop += e.bottom - l.bottom + 4;
  }
}

/* ------------------------------------------------------ panneau flottant */

/** Vrai sous 560px : le panneau devient une feuille basse. */
export function useMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(REQUETE_MOBILE).matches);
  useEffect(() => {
    const liste = window.matchMedia(REQUETE_MOBILE);
    const maj = () => setMobile(liste.matches);
    maj();
    liste.addEventListener("change", maj);
    return () => liste.removeEventListener("change", maj);
  }, []);
  return mobile;
}

interface OptionsPanneauFlottant {
  ouvert: boolean;
  mobile: boolean;
  /** Element ancre du panneau (declencheur). */
  declencheur: RefObject<HTMLElement>;
  /** Conteneur du declencheur (un clic dedans n'est pas un clic exterieur). */
  racine: RefObject<HTMLElement>;
  panneau: RefObject<HTMLElement>;
  fermer: (rendreFocus: boolean) => void;
  alignement?: "gauche" | "droite";
  hauteurMax?: number;
  /** Appele apres le positionnement (ex: centrer l'option choisie). */
  apresPosition?: () => void;
  /**
   * Redimensionnement qui ferme le panneau : "tout" (defaut) ou "largeur" (seul un changement de largeur ferme ;
   * pour une saisie, l'apparition du clavier a l'ecran ne doit pas fermer les suggestions).
   */
  fermerAuRedimensionnement?: "tout" | "largeur";
}

/**
 * Comportement commun des panneaux (Selecteur, ChampSuggestions) : positionnement en `position: fixed`
 * (ouverture vers le haut s'il manque de la place), fermeture au clic exterieur, a Echap, au defilement
 * exterieur et au redimensionnement ; feuille basse sur mobile (defilement de la page fige).
 *
 * Echap et Tab sont captures au niveau de `window` : une modale ouverte dessous (qui ecoute `document` en
 * capture) ne les voit pas, donc Echap ferme la liste sans fermer la modale et Tab n'est pas detourne.
 */
export function usePanneauFlottant({
  ouvert,
  mobile,
  declencheur,
  racine,
  panneau,
  fermer,
  alignement,
  hauteurMax,
  apresPosition,
  fermerAuRedimensionnement = "tout"
}: OptionsPanneauFlottant): "bas" | "haut" {
  const [cote, setCote] = useState<"bas" | "haut">("bas");

  useLayoutEffect(() => {
    if (!ouvert) return;
    const element = panneau.current;
    const ancre = declencheur.current;
    if (!element || !ancre) return;
    if (mobile) {
      for (const propriete of ["top", "left", "bottom", "width", "min-width", "max-width", "max-height"]) element.style.removeProperty(propriete);
      apresPosition?.();
      return;
    }
    const r = ancre.getBoundingClientRect();
    // Mesure de la taille naturelle (toutes options) avant de choisir le cote.
    element.style.top = "0px";
    element.style.left = "0px";
    element.style.bottom = "auto";
    element.style.width = "";
    element.style.maxHeight = "none";
    element.style.minWidth = `${Math.max(r.width, 200)}px`;
    element.style.maxWidth = `${Math.min(520, window.innerWidth - 16)}px`;
    const p = element.getBoundingClientRect();
    const largeur = Math.ceil(p.width);
    const position = calculerPosition({
      declencheur: r,
      hauteurPanneau: p.height,
      largeurPanneau: largeur,
      fenetre: { largeur: window.innerWidth, hauteur: window.innerHeight },
      hauteurMax,
      alignement
    });
    element.style.width = `${largeur}px`;
    element.style.left = `${position.left}px`;
    element.style.maxHeight = `${position.hauteurMax}px`;
    if (position.cote === "bas") {
      element.style.top = `${position.top}px`;
      element.style.bottom = "auto";
    } else {
      element.style.top = "auto";
      element.style.bottom = `${position.bottom}px`;
    }
    setCote(position.cote);
    apresPosition?.();
    // apresPosition volontairement hors dependances : il ne s'execute qu'a l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, mobile]);

  useEffect(() => {
    if (!ouvert) return;
    const ouvertA = Date.now();
    const largeurInitiale = window.innerWidth;

    function dedans(cible: EventTarget | null): boolean {
      const noeud = cible as Node | null;
      return !!noeud && !!(panneau.current?.contains(noeud) || racine.current?.contains(noeud));
    }
    function clicExterieur(evenement: MouseEvent | TouchEvent) {
      if (!dedans(evenement.target)) fermer(false);
    }
    function clavier(evenement: KeyboardEvent) {
      if (!dedans(evenement.target)) return;
      if (evenement.key === "Escape") {
        evenement.preventDefault();
        evenement.stopPropagation();
        fermer(true);
      } else if (evenement.key === "Tab") {
        // Le focus revient au declencheur, puis le navigateur applique la tabulation depuis la.
        evenement.stopPropagation();
        declencheur.current?.focus({ preventScroll: true });
        fermer(false);
      }
    }
    function defilement(evenement: Event) {
      // Defilements de recadrage juste apres l'ouverture (focus d'un champ, clavier a l'ecran) : ignores.
      if (mobile || Date.now() - ouvertA < 350) return;
      const cible = evenement.target as Node | null;
      if (cible && panneau.current?.contains(cible)) return;
      fermer(false);
    }
    function redimensionnement() {
      // Sur mobile, l'apparition du clavier redimensionne la fenetre : la feuille reste ouverte.
      if (mobile) return;
      if (fermerAuRedimensionnement === "largeur" && window.innerWidth === largeurInitiale) return;
      fermer(false);
    }

    document.addEventListener("mousedown", clicExterieur);
    document.addEventListener("touchstart", clicExterieur, { passive: true });
    window.addEventListener("keydown", clavier, true);
    window.addEventListener("scroll", defilement, true);
    window.addEventListener("resize", redimensionnement);

    let ancienOverflow: string | null = null;
    if (mobile) {
      ancienOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("mousedown", clicExterieur);
      document.removeEventListener("touchstart", clicExterieur);
      window.removeEventListener("keydown", clavier, true);
      window.removeEventListener("scroll", defilement, true);
      window.removeEventListener("resize", redimensionnement);
      if (ancienOverflow !== null) document.body.style.overflow = ancienOverflow;
    };
  }, [ouvert, mobile, fermer, declencheur, racine, panneau, fermerAuRedimensionnement]);

  return cote;
}
