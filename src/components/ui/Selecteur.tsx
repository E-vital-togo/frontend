import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  SEUIL_RECHERCHE_DEFAUT,
  SaisieRapide,
  TEXTES,
  dernierActivable,
  filtrerOptions,
  indexSuivant,
  jetonsRecherche,
  libelleCompteur,
  libelleSelectionnes,
  premierActivable,
  rechercheAffichee,
  toucheImprimable,
  valeursDansLOrdre,
  type ModeRecherche
} from "../../lib/selecteur";
import {
  IconeChevron,
  IconeCroix,
  IconeLoupe,
  ListeOptions,
  idOption,
  optionsDepuisEnfants,
  rendreVisible,
  useMobile,
  usePanneauFlottant,
  type OptionSelecteur
} from "./selecteurInterne";
import { cx } from "./utilitaires";
import "../../styles/selecteur.css";

export type { OptionSelecteur } from "./selecteurInterne";
export { optionsDepuis, optionsDepuisEnfants } from "./selecteurInterne";

interface ProprietesCommunes {
  /** Identifiant du declencheur : celui du `htmlFor` du label (Champ, ChampDynamique...). */
  id?: string;
  /** Options. Alternative : passer des `<option>` / `<optgroup>` en enfants, comme pour un `<select>` natif. */
  options?: readonly OptionSelecteur[];
  children?: ReactNode;
  /** Texte affiche quand rien n'est choisi (defaut : "Choisir..."). */
  placeholder?: string;
  disabled?: boolean;
  /** Valeur affichee mais non modifiable (rendu grise, sans le curseur interdit). */
  lectureSeule?: boolean;
  /** Etat d'erreur (bordure rouge, `aria-invalid`). */
  invalide?: boolean;
  /** Dossier verrouille (voir ChampDynamique) : rendu distinct, la liste reste ouverte et `onChange` est quand meme appele (le parent avertit). */
  verrouille?: boolean;
  /** Champ obligatoire : un `<form>` refuse d'etre soumis sans choix (validation native, message en francais). */
  requis?: boolean;
  /** Nom de champ de formulaire : emet des `<input type="hidden">` pour une soumission native. */
  nom?: string;
  /** Barre de recherche : "auto" (defaut, au-dela de `seuilRecherche` options), `true` ou `false`. */
  recherche?: ModeRecherche;
  /** Nombre d'options a partir duquel la recherche apparait en mode "auto" (defaut 7). */
  seuilRecherche?: number;
  placeholderRecherche?: string;
  /** Affiche un bouton pour effacer la valeur (X). */
  effacable?: boolean;
  /** Largeur automatique (barres d'outils) : au moins 170px, sans occuper toute la ligne. */
  compact?: boolean;
  /** Largeur fixe du declencheur (nombre = px, ou toute valeur CSS) ; implique `compact`. */
  largeur?: number | string;
  /** Hauteur de 32px, police de 13px (tres petits controles). */
  petit?: boolean;
  /** Police de donnees (identifiants, codes). */
  mono?: boolean;
  /** Cote d'ancrage du panneau, utile pour un declencheur etroit a droite d'une ligne. */
  alignement?: "gauche" | "droite";
  className?: string;
  /** id de l'element qui porte le libelle du champ. */
  etiquettePar?: string;
  /** Nom accessible quand il n'y a ni label relie, ni `etiquettePar`. */
  ariaLabel?: string;
  decritPar?: string;
  /** Titre de la feuille basse (mobile). Defaut : texte du label relie, sinon `ariaLabel`, sinon le placeholder. */
  titre?: string;
  /** Message quand la recherche ne donne rien (defaut : "Aucun résultat"). */
  messageVide?: string;
  autoFocus?: boolean;
  onOuvrir?: () => void;
  onFermer?: () => void;
}

export interface ProprietesSelecteurSimple extends ProprietesCommunes {
  multiple?: false;
  /** Valeur choisie ("" ou null : rien). */
  valeur: string | null | undefined;
  /** Emet la valeur choisie, ou "" quand elle est effacee. Meme semantique que `e.target.value` d'un `<select>`. */
  onChange: (valeur: string) => void;
}

export interface ProprietesSelecteurMultiple extends ProprietesCommunes {
  multiple: true;
  /** Valeurs cochees. */
  valeur: readonly string[] | null | undefined;
  /** Emet les valeurs cochees DANS L'ORDRE DES OPTIONS (meme semantique que l'ancien `<select multiple>`). */
  onChange: (valeurs: string[]) => void;
  /** Nombre maximum de choix : les autres options sont bloquees une fois la limite atteinte. */
  max?: number;
  /** Nombre minimum de choix attendus (indication dans le pied de la liste ; la validation reste a la charge du parent). */
  min?: number;
  /** Nombre de puces affichees dans le declencheur avant "+N" (defaut 2). */
  maxPuces?: number;
}

export type ProprietesSelecteur = ProprietesSelecteurSimple | ProprietesSelecteurMultiple;

const VIDE: readonly string[] = [];

/**
 * Liste deroulante maison (remplace `<select>` et `<select multiple>`) : declencheur identique aux champs,
 * panneau en portail et en position fixe (jamais rogne par un conteneur ni par une modale, ouverture vers le
 * haut si besoin, feuille basse sous 560px), recherche integree au-dela de 7 options (insensible aux accents
 * et a la casse, surlignage, compteur), groupes, descriptions, icones, choix multiple (cases, puces et "+N"),
 * clavier complet et roles ARIA (combobox, listbox, option, aria-activedescendant).
 *
 * Usage simple, equivalent d'un `<select>` :
 *   <Selecteur id="statut" valeur={statut} onChange={setStatut} options={[{ valeur: "a", libelle: "A" }]} />
 *   <Selecteur id="statut" valeur={statut} onChange={setStatut}><option value="a">A</option></Selecteur>
 * Voir docs/design-system-react.md (section "Selecteur").
 */
export default function Selecteur(props: ProprietesSelecteurSimple): JSX.Element;
export default function Selecteur(props: ProprietesSelecteurMultiple): JSX.Element;
export default function Selecteur(props: ProprietesSelecteur): JSX.Element {
  const {
    id: idPropose,
    options: optionsPropres,
    children,
    placeholder = TEXTES.placeholder,
    disabled = false,
    lectureSeule = false,
    invalide = false,
    verrouille = false,
    requis = false,
    nom,
    recherche = "auto",
    seuilRecherche = SEUIL_RECHERCHE_DEFAUT,
    placeholderRecherche = TEXTES.rechercher,
    effacable = false,
    compact = false,
    largeur,
    petit = false,
    mono = false,
    alignement,
    className,
    etiquettePar,
    ariaLabel,
    decritPar,
    titre,
    messageVide,
    autoFocus,
    onOuvrir,
    onFermer
  } = props;
  const multiple = props.multiple === true;
  const max = props.multiple === true ? props.max : undefined;
  const min = props.multiple === true ? props.min : undefined;
  const maxPuces = props.multiple === true ? (props.maxPuces ?? 2) : 2;

  const idUnique = useId();
  const id = idPropose ?? `eva-sel-${idUnique.replace(/:/g, "")}`;
  const idBase = `${id}-sel`;
  const idValeur = `${id}-valeur`;

  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState("");
  const [indexActif, setIndexActif] = useState(-1);
  const [idEtiquetteAuto, setIdEtiquetteAuto] = useState<string | undefined>();
  const [titreFeuille, setTitreFeuille] = useState("");
  const mobile = useMobile();

  const refRacine = useRef<HTMLDivElement>(null);
  const refDeclencheur = useRef<HTMLButtonElement>(null);
  const refPanneau = useRef<HTMLDivElement>(null);
  const refRecherche = useRef<HTMLInputElement>(null);
  const refListe = useRef<HTMLDivElement>(null);
  const refValidation = useRef<HTMLInputElement>(null);
  const saisieRapide = useRef(new SaisieRapide());

  const options = useMemo<readonly OptionSelecteur[]>(() => optionsPropres ?? optionsDepuisEnfants(children), [optionsPropres, children]);
  const interactif = !disabled && !lectureSeule;
  const avecRecherche = rechercheAffichee(recherche, options.length, seuilRecherche);

  const valeurs: readonly string[] = props.multiple === true ? (props.valeur ?? VIDE) : props.valeur != null ? [props.valeur] : VIDE;
  const choisies = useMemo(() => new Set(valeurs), [valeurs]);
  const optionsChoisies = useMemo(() => options.filter((o) => choisies.has(o.valeur)), [options, choisies]);
  // Valeur inconnue des options (donnee ancienne) : affichee telle quelle plutot que masquee.
  const valeurSimple = !multiple && valeurs.length > 0 ? valeurs[0] : "";
  const optionSimple = !multiple ? optionsChoisies[0] : undefined;
  const aUneValeur = multiple ? optionsChoisies.length > 0 : optionSimple !== undefined ? optionSimple.valeur !== "" : valeurSimple !== "";
  const peutEffacer = effacable && interactif && aUneValeur;

  const limiteAtteinte = max !== undefined && optionsChoisies.length >= max;
  const bloquees = useMemo(
    () => (limiteAtteinte ? new Set(options.filter((o) => !choisies.has(o.valeur)).map((o) => o.valeur)) : undefined),
    [limiteAtteinte, options, choisies]
  );

  const visibles = useMemo(() => filtrerOptions(options, requete), [options, requete]);
  const jetons = useMemo(() => jetonsRecherche(requete), [requete]);
  const filtreActif = requete.trim() !== "";
  const actif = visibles[indexActif] ? indexActif : premierActivable(visibles);

  // Label relie au declencheur : sert de nom accessible (avec la valeur) et de titre de la feuille basse.
  useEffect(() => {
    if (etiquettePar) return;
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
    if (!label) {
      setIdEtiquetteAuto(undefined);
      return;
    }
    if (!label.id) label.id = `${id}-etiquette`;
    setIdEtiquetteAuto(label.id);
  }, [id, etiquettePar]);
  const idEtiquette = etiquettePar ?? idEtiquetteAuto;

  // Validation HTML5 (required) relayee par un champ natif invisible (pas en readOnly : il serait exclu de la validation).
  useEffect(() => {
    refValidation.current?.setCustomValidity(requis && !aUneValeur ? "Veuillez faire un choix dans la liste." : "");
  }, [requis, aUneValeur]);

  const fermer = useCallback(
    (rendreFocus: boolean) => {
      setOuvert(false);
      setRequete("");
      saisieRapide.current.reinitialiser();
      if (rendreFocus) refDeclencheur.current?.focus({ preventScroll: true });
      onFermer?.();
    },
    [onFermer]
  );

  const ouvrir = useCallback(
    (requeteInitiale = "") => {
      if (!interactif) return;
      const label = idEtiquette ? document.getElementById(idEtiquette) : null;
      setTitreFeuille(titre ?? label?.textContent?.replace(/\s*\*\s*$/, "").trim() ?? ariaLabel ?? placeholder);
      setRequete(requeteInitiale);
      const initiales = filtrerOptions(options, requeteInitiale);
      const dejaChoisie = requeteInitiale ? -1 : initiales.findIndex((o) => choisies.has(o.valeur) && !o.desactivee);
      setIndexActif(dejaChoisie >= 0 ? dejaChoisie : premierActivable(initiales));
      setOuvert(true);
      onOuvrir?.();
    },
    [interactif, idEtiquette, titre, ariaLabel, placeholder, options, choisies, onOuvrir]
  );

  const emettre = useCallback(
    (suivantes: Set<string>) => {
      if (props.multiple === true) props.onChange(valeursDansLOrdre(options, suivantes));
    },
    [options, props]
  );

  function choisir(index: number) {
    const option = visibles[index];
    if (!option || option.desactivee) return;
    if (props.multiple === true) {
      const suivantes = new Set(choisies);
      if (suivantes.has(option.valeur)) suivantes.delete(option.valeur);
      else if (!limiteAtteinte) suivantes.add(option.valeur);
      emettre(suivantes);
      if (avecRecherche && refRecherche.current && !mobile) refRecherche.current.focus({ preventScroll: true });
    } else {
      props.onChange(option.valeur);
      fermer(true);
    }
  }

  function effacerTout() {
    if (props.multiple === true) props.onChange([]);
    else props.onChange("");
  }

  const positionDuPanneau = usePanneauFlottant({
    ouvert,
    mobile,
    declencheur: refDeclencheur,
    racine: refRacine,
    panneau: refPanneau,
    fermer,
    alignement,
    // Centre l'option deja choisie a l'ouverture.
    apresPosition: () => {
      const element = refListe.current?.querySelector<HTMLElement>(".eva-sel__option--actif");
      rendreVisible(refListe.current, element ?? null, true);
    }
  });

  // Focus a l'ouverture : recherche sur ordinateur (sur mobile, le clavier a l'ecran couvrirait la moitie de la liste).
  useEffect(() => {
    if (ouvert && avecRecherche && !mobile) refRecherche.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  // Garde l'option active visible pendant la navigation au clavier.
  useEffect(() => {
    if (!ouvert) return;
    const element = refListe.current?.querySelector<HTMLElement>(`[data-index="${actif}"]`);
    rendreVisible(refListe.current, element ?? null);
  }, [ouvert, actif]);

  function deplacer(sens: 1 | -1, pas = 1) {
    let courant = actif;
    for (let i = 0; i < pas; i++) {
      const suivant = indexSuivant(visibles, courant, sens);
      if (suivant < 0) return;
      // Pas de bouclage pour les sauts de page.
      if (pas > 1 && ((sens === 1 && suivant < courant) || (sens === -1 && suivant > courant))) break;
      courant = suivant;
    }
    setIndexActif(courant);
  }

  function surTouches(evenement: KeyboardEvent<HTMLElement>, depuisRecherche: boolean) {
    const touche = evenement.key;
    if (touche === "ArrowDown" || touche === "ArrowUp") {
      evenement.preventDefault();
      if (!ouvert) ouvrir();
      else deplacer(touche === "ArrowDown" ? 1 : -1);
    } else if (touche === "PageDown" || touche === "PageUp") {
      if (!ouvert) return;
      evenement.preventDefault();
      deplacer(touche === "PageDown" ? 1 : -1, 8);
    } else if (touche === "Home" || touche === "End") {
      if (depuisRecherche && requete !== "") return; // deplace le curseur de saisie
      evenement.preventDefault();
      if (!ouvert) {
        ouvrir();
        return;
      }
      setIndexActif(touche === "Home" ? premierActivable(visibles) : dernierActivable(visibles));
    } else if (touche === "Enter") {
      evenement.preventDefault(); // jamais de soumission du formulaire parent
      if (!ouvert) ouvrir();
      else if (actif >= 0) choisir(actif);
    } else if (touche === " ") {
      if (depuisRecherche) return;
      evenement.preventDefault();
      if (!ouvert) ouvrir();
      else if (avecRecherche && requete !== "") setRequete((r) => r + " ");
      else if (actif >= 0) choisir(actif);
    } else if (!depuisRecherche && toucheImprimable(evenement)) {
      // Saisie depuis le declencheur.
      if (avecRecherche) {
        evenement.preventDefault();
        if (!ouvert) ouvrir(touche);
        else {
          const suivante = requete + touche;
          setRequete(suivante);
          setIndexActif(premierActivable(filtrerOptions(options, suivante)));
          refRecherche.current?.focus({ preventScroll: true });
        }
      } else {
        // Saisie rapide : saute a l'option dont le libelle commence par les lettres tapees.
        evenement.preventDefault();
        const trouve = saisieRapide.current.chercher(touche, visibles, actif);
        if (trouve < 0) return;
        if (ouvert) setIndexActif(trouve);
        else if (!multiple) {
          const option = visibles[trouve];
          if (option.valeur !== valeurSimple) (props as ProprietesSelecteurSimple).onChange(option.valeur);
        } else {
          ouvrir();
          setIndexActif(trouve);
        }
      }
    }
  }

  function surSaisieRecherche(valeur: string) {
    setRequete(valeur);
    setIndexActif(premierActivable(filtrerOptions(options, valeur)));
    if (refListe.current) refListe.current.scrollTop = 0;
  }

  /* ------------------------------------------------------------ rendu */

  const puces = optionsChoisies.slice(0, maxPuces);
  const reste = optionsChoisies.length - puces.length;
  const idsLabel = [idEtiquette, idValeur].filter(Boolean).join(" ");

  let contenu: ReactNode;
  if (multiple) {
    contenu =
      optionsChoisies.length === 0 ? (
        <span className="eva-sel__placeholder" id={idValeur}>
          {placeholder}
        </span>
      ) : (
        <span className="eva-sel__contenu" id={idValeur}>
          {puces.map((o) => (
            <span key={o.valeur} className="eva-sel__puce">
              {o.libelle}
            </span>
          ))}
          {reste > 0 && <span className="eva-sel__plus">+{reste}</span>}
        </span>
      );
  } else if (optionSimple || valeurSimple !== "") {
    contenu = (
      <>
        {optionSimple?.icone && <span className="eva-sel__icone">{optionSimple.icone}</span>}
        <span className={cx("eva-sel__valeur", mono && "eva-sel__valeur--mono")} id={idValeur}>
          {optionSimple ? optionSimple.libelle : valeurSimple}
        </span>
      </>
    );
  } else {
    contenu = (
      <span className="eva-sel__placeholder" id={idValeur}>
        {placeholder}
      </span>
    );
  }

  const classes = cx(
    "eva-sel",
    (compact || largeur !== undefined) && "eva-sel--compact",
    petit && "eva-sel--petit",
    ouvert && "eva-sel--ouvert",
    invalide && "eva-sel--invalide",
    disabled && "eva-sel--desactive",
    lectureSeule && !disabled && "eva-sel--lecture",
    verrouille && !disabled && "eva-sel--verrouille",
    peutEffacer && "eva-sel--effacable",
    className
  );
  const styleRacine: CSSProperties | undefined = largeur !== undefined ? { width: typeof largeur === "number" ? `${largeur}px` : largeur } : undefined;

  const declencheurRecherche = avecRecherche && !mobile;
  const idActif = ouvert && actif >= 0 ? idOption(idBase, actif) : undefined;
  const annonce = ouvert && filtreActif ? libelleCompteur(visibles.length, options.length, true) : "";
  const piedAffiche = avecRecherche || multiple;
  const texteCompteur =
    filtreActif || !multiple ? libelleCompteur(visibles.length, options.length, filtreActif) : libelleSelectionnes(optionsChoisies.length, min, max);

  return (
    <div className={classes} style={styleRacine} ref={refRacine}>
      {requis && (
        <input
          ref={refValidation}
          className="eva-sel__validation"
          tabIndex={-1}
          aria-hidden="true"
          required
          autoComplete="off"
          value={aUneValeur ? "1" : ""}
          onChange={() => undefined}
          onKeyDown={(e) => {
            // Focus recu par la validation du formulaire : la saisie ouvre la liste.
            if (e.key !== "Tab") {
              refDeclencheur.current?.focus({ preventScroll: true });
              surTouches(e, false);
            }
          }}
        />
      )}
      <button
        ref={refDeclencheur}
        id={id}
        type="button"
        className="eva-sel__declencheur"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? `${idBase}-liste` : undefined}
        aria-activedescendant={ouvert && !declencheurRecherche ? idActif : undefined}
        aria-labelledby={ariaLabel ? `${id} ${idValeur}` : idsLabel || undefined}
        aria-label={ariaLabel}
        aria-describedby={decritPar}
        aria-invalid={invalide || undefined}
        aria-required={requis || undefined}
        aria-readonly={lectureSeule || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={() => (ouvert ? fermer(false) : ouvrir())}
        onKeyDown={(e) => surTouches(e, false)}
        onKeyUp={(e) => {
          if (e.key === " ") e.preventDefault(); // Firefox : sans cela, Espace relache declenche un clic
        }}
      >
        <span className="eva-sel__contenu">{contenu}</span>
        <IconeChevron />
      </button>

      {peutEffacer && (
        <button
          type="button"
          className="eva-sel__effacer"
          aria-label={TEXTES.effacer}
          title={TEXTES.effacer}
          onClick={() => {
            effacerTout();
            refDeclencheur.current?.focus({ preventScroll: true });
          }}
        >
          <IconeCroix />
        </button>
      )}

      {nom && !multiple && <input type="hidden" name={nom} value={valeurSimple} />}
      {nom && multiple && valeurs.map((v) => <input key={v} type="hidden" name={nom} value={v} />)}

      {ouvert &&
        createPortal(
          <>
            {mobile && <div className="eva-sel__voile" aria-hidden="true" />}
            <div
              ref={refPanneau}
              className={cx("eva-sel__panneau", mobile && "eva-sel__panneau--feuille", !mobile && positionDuPanneau === "haut" && "eva-sel__panneau--haut")}
              onMouseDown={(e) => {
                // Garde le focus (recherche ou declencheur) : un clic sur une option ne le deplace pas.
                if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {mobile && (
                <div className="eva-sel__entete">
                  <span className="eva-sel__titre">{titreFeuille}</span>
                  <button type="button" className="eva-sel__fermer" aria-label={TEXTES.fermer} onClick={() => fermer(true)}>
                    <IconeCroix taille={14} />
                  </button>
                </div>
              )}

              {avecRecherche && (
                <div className="eva-sel__recherche">
                  <IconeLoupe />
                  <input
                    ref={refRecherche}
                    className="eva-sel__recherche-champ"
                    type="text"
                    role="combobox"
                    enterKeyHint="search"
                    aria-expanded="true"
                    aria-controls={`${idBase}-liste`}
                    aria-activedescendant={idActif}
                    aria-autocomplete="list"
                    aria-label={TEXTES.rechercherEtiquette}
                    placeholder={placeholderRecherche}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={requete}
                    onChange={(e) => surSaisieRecherche(e.target.value)}
                    onKeyDown={(e) => surTouches(e, true)}
                  />
                  {requete && (
                    <button
                      type="button"
                      className="eva-sel__recherche-effacer"
                      aria-label={TEXTES.effacerRecherche}
                      onClick={() => {
                        surSaisieRecherche("");
                        refRecherche.current?.focus({ preventScroll: true });
                      }}
                    >
                      <IconeCroix />
                    </button>
                  )}
                </div>
              )}

              <ListeOptions
                idBase={idBase}
                visibles={visibles}
                indexActif={actif}
                choisies={choisies}
                multiple={multiple}
                bloquees={bloquees}
                jetons={jetons}
                message={messageVide ?? (options.length === 0 ? TEXTES.aucuneOption : TEXTES.aucunResultat)}
                etiquettePar={idEtiquette}
                ariaLabel={ariaLabel ?? placeholder}
                refListe={refListe}
                surChoix={choisir}
                surSurvol={setIndexActif}
              />

              {piedAffiche && (
                <div className="eva-sel__pied">
                  <span className="eva-sel__compteur">{texteCompteur}</span>
                  <span className="eva-sel__pied-actions">
                    {multiple && (
                      <button type="button" className="eva-sel__lien" disabled={optionsChoisies.length === 0} onClick={effacerTout}>
                        {TEXTES.toutEffacer}
                      </button>
                    )}
                    {multiple && mobile && (
                      <button type="button" className="eva-sel__terminer" onClick={() => fermer(true)}>
                        {TEXTES.terminer}
                      </button>
                    )}
                  </span>
                </div>
              )}

              <div className="eva-sel__sr" role="status" aria-live="polite">
                {annonce}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
