/**
 * Selecteur maison pour les gabarits Django (admin general, INSEED, profil), sans framework : meme logique
 * (lib/selecteur.ts) et memes classes CSS (styles/selecteur.css) que le composant React
 * components/ui/Selecteur.tsx et ChampSuggestions.tsx.
 *
 * Compile en bundle IIFE par `npm run build:selecteur-django` :
 *   backend/static/js/evital_selecteur.js
 *   backend/static/css/evital-selecteur.css
 *
 * Enrichissement progressif : sans JavaScript, les <select> restent natifs. Avec le script (charge `defer`
 * par base_interne.html), chaque <select> et chaque <input list> du systeme de design est habille :
 *
 *  - <select> (simple ou `multiple`) : le <select> natif RESTE la source de verite (valeur, name, required,
 *    disabled, form, soumission, `form.reset()`, label `for`). Il est masque (classe eva-sel-natif, hors flux,
 *    aria-hidden) et un declencheur + un panneau (portail dans <body>, position fixe, feuille basse sous 560px)
 *    prennent sa place visuelle. Un choix met a jour le <select> puis emet `input` et `change` (donc les
 *    `onchange="this.form.submit()"` et les ecouteurs existants fonctionnent). Les changements faits par
 *    d'autres scripts (value, selectedIndex, options ajoutees/retirees, selected, disabled) sont suivis
 *    (accesseurs + MutationObserver).
 *  - <input list="..."> + <datalist> : saisie libre avec suggestions. L'<input> reste le champ reel (valeur
 *    libre) ; son `list` est retire pour supprimer la liste native, le <datalist> est observe.
 *
 * Selection : `select.ev-select`, `.ev-champ select`, `.ev-form select`, `.formulaire-simple select`,
 * `.ev-champ input[list]`... (voir SELECTEURS). Exclusions : attribut `data-natif` sur l'element ou un
 * ancetre, et les ilots React (`[id^="ilot-"]`), dont le DOM appartient a React.
 *
 * Attributs lus : data-recherche="auto|true|false", data-seuil-recherche="7", data-placeholder (sur une
 * <option>), data-description / data-recherche (sur une <option>), data-titre (titre de la feuille basse).
 *
 * API : `window.EvitalSelecteur.initialiser(racine?)`, `.detruire(element)`, `.rafraichir(select)`.
 */
import {
  REQUETE_MOBILE,
  SEUIL_RECHERCHE_DEFAUT,
  SaisieRapide,
  TEXTES,
  calculerPosition,
  dernierActivable,
  filtrerOptions,
  indexSuivant,
  jetonsRecherche,
  libelleCompteur,
  libelleSelectionnes,
  morceauxSurlignes,
  premierActivable,
  rechercheAffichee,
  toucheImprimable,
  type ModeRecherche,
  type OptionBrute
} from "./selecteur";

const SELECTEURS_SELECT = ["select.ev-select", ".ev-champ select", ".ev-form select", ".formulaire-simple select"].join(", ");
const SELECTEURS_SAISIE = ".ev-champ input[list], .ev-form input[list], .formulaire-simple input[list], input.ev-input[list]";
const ILOTS = '[data-natif], [id^="ilot-"]';
const SVG_NS = "http://www.w3.org/2000/svg";

let compteur = 0;
const instances = new WeakMap<Element, Instance>();

interface Instance {
  racine: HTMLElement;
  detruire(): void;
  rafraichir(): void;
}

interface OptionNative extends OptionBrute {
  element: HTMLOptionElement;
}

/* ------------------------------------------------------------------ DOM */

function noeud<K extends keyof HTMLElementTagNameMap>(
  balise: K,
  classe?: string,
  attributs: Record<string, string> = {},
  texte?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  for (const [nom, valeur] of Object.entries(attributs)) element.setAttribute(nom, valeur);
  if (texte !== undefined) element.textContent = texte;
  return element;
}

function svg(largeur: number, vue: string, chemins: string, classe?: string): SVGSVGElement {
  const element = document.createElementNS(SVG_NS, "svg");
  element.setAttribute("width", String(largeur));
  element.setAttribute("height", String(largeur));
  element.setAttribute("viewBox", vue);
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("focusable", "false");
  if (classe) element.setAttribute("class", classe);
  element.innerHTML = chemins;
  return element;
}

const iconeChevron = () =>
  svg(14, "0 0 14 14", '<path d="M3 5.25 7 9.25l4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>', "eva-sel__chevron");
const iconeCoche = (t = 14) =>
  svg(t, "0 0 14 14", '<path d="m2.8 7.4 2.7 2.7 5.7-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>');
const iconeLoupe = () =>
  svg(15, "0 0 16 16", '<circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.6 10.6 3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>', "eva-sel__loupe");
const iconeCroix = (t = 12) =>
  svg(t, "0 0 12 12", '<path d="m2.5 2.5 7 7m0-7-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>');

function surligner(parent: HTMLElement, texte: string, jetons: readonly string[]) {
  parent.textContent = "";
  for (const morceau of morceauxSurlignes(texte, jetons)) {
    if (morceau.surligne) parent.appendChild(noeud("mark", "eva-sel__surlignage", {}, morceau.texte));
    else parent.appendChild(document.createTextNode(morceau.texte));
  }
}

function exclu(element: Element): boolean {
  return element.closest(ILOTS) !== null;
}

function idEtiquette(element: HTMLElement): string | undefined {
  if (!element.id) return undefined;
  const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(element.id)}"]`);
  if (!label) return undefined;
  if (!label.id) label.id = `${element.id}-etiquette`;
  return label.id;
}

function titreDe(element: HTMLElement, secours: string): string {
  const explicite = element.getAttribute("data-titre");
  if (explicite) return explicite;
  const label = element.id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(element.id)}"]`) : null;
  const texte = label?.textContent?.replace(/\s*\*\s*$/, "").trim();
  return texte || element.getAttribute("aria-label") || secours;
}

function modeRecherche(element: HTMLElement): { mode: ModeRecherche; seuil: number } {
  const brut = element.getAttribute("data-recherche");
  const mode: ModeRecherche = brut === "true" ? true : brut === "false" ? false : "auto";
  const seuil = Number(element.getAttribute("data-seuil-recherche"));
  return { mode, seuil: Number.isFinite(seuil) && seuil > 0 ? seuil : SEUIL_RECHERCHE_DEFAUT };
}

/** Repere/copie les styles de mise en page de l'element d'origine sur le conteneur qui le remplace visuellement. */
function copierMiseEnPage(source: HTMLElement, cible: HTMLElement) {
  const c = getComputedStyle(source);
  const parent = source.parentElement;
  const pc = parent ? getComputedStyle(parent) : null;
  const flex = pc !== null && (pc.display.includes("flex") || pc.display.includes("grid"));
  if (flex) {
    cible.style.flex = `${c.flexGrow} ${c.flexShrink} ${c.flexBasis}`;
    cible.style.alignSelf = c.alignSelf;
    cible.style.order = c.order;
    cible.style.gridColumn = c.gridColumnStart === "auto" ? "" : `${c.gridColumnStart} / ${c.gridColumnEnd}`;
  } else if (c.order !== "0") {
    cible.style.order = c.order;
  }
  cible.style.minWidth = c.minWidth === "auto" || c.minWidth === "0px" ? "" : c.minWidth;
  cible.style.maxWidth = c.maxWidth === "none" ? "" : c.maxWidth;
  cible.style.margin = c.margin;
  if (parent && pc) {
    const disponible = parent.clientWidth - parseFloat(pc.paddingLeft) - parseFloat(pc.paddingRight);
    const plein = Math.abs(source.offsetWidth - disponible) <= 2;
    if (!plein && !cible.style.flex && source.offsetWidth > 0 && c.display !== "none") cible.style.width = `${source.offsetWidth}px`;
  }
}

/* ------------------------------------------------------------ panneau */

interface ParametresPanneau {
  declencheur: HTMLElement;
  racine: HTMLElement;
  multiple: boolean;
  avecRecherche: boolean;
  titre: string;
  placeholderRecherche: string;
  /** Options courantes (relues a chaque ouverture et a chaque changement observe). */
  options: () => OptionNative[];
  choisies: () => ReadonlySet<string>;
  max?: number;
  surChoix: (option: OptionNative) => void;
  surToutEffacer?: () => void;
  surFermeture: (rendreFocus: boolean) => void;
  /** Ou rendre le focus quand le panneau se ferme au clavier. */
  focus: HTMLElement;
  aucuneOption: string;
  /** Met en surbrillance une option des l'ouverture et apres chaque saisie (defaut : oui). Non pour une saisie libre. */
  activationAuto?: boolean;
  /** Feuille basse sous 560px (defaut : oui). Non pour une saisie libre : le panneau reste sous le champ. */
  feuille?: boolean;
}

/** Panneau flottant (portail dans <body>) : construction, filtrage, navigation, positionnement et fermeture. */
class Panneau {
  private element: HTMLDivElement | null = null;
  private voile: HTMLDivElement | null = null;
  private champRecherche: HTMLInputElement | null = null;
  private liste: HTMLDivElement | null = null;
  private pied: HTMLDivElement | null = null;
  private annonce: HTMLDivElement | null = null;
  private visibles: OptionNative[] = [];
  private requete = "";
  private indexActif = -1;
  private mobile = false;
  private ouvertA = 0;
  private ancienOverflow: string | null = null;
  private readonly id = `eva-sel-p${++compteur}`;
  private ecouteurs: Array<() => void> = [];
  private readonly saisieRapide = new SaisieRapide();

  constructor(private readonly p: ParametresPanneau) {}

  get estOuvert(): boolean {
    return this.element !== null;
  }

  get idListe(): string {
    return `${this.id}-liste`;
  }

  get idActif(): string | undefined {
    return this.estOuvert && this.indexActif >= 0 ? `${this.id}-o-${this.indexActif}` : undefined;
  }

  ouvrir(requeteInitiale = "") {
    if (this.element) return;
    this.mobile = this.p.feuille !== false && window.matchMedia(REQUETE_MOBILE).matches;
    this.requete = requeteInitiale;
    this.ouvertA = Date.now();
    this.construire();
    this.recalculer(true);
    this.positionner();
    this.ecouter();
    this.notifier();
    if (this.p.avecRecherche && !this.mobile) this.champRecherche?.focus({ preventScroll: true });
    // Centre l'option deja choisie.
    this.rendreVisible(this.liste?.querySelector<HTMLElement>(".eva-sel__option--actif") ?? null, true);
  }

  fermer(rendreFocus: boolean) {
    if (!this.element) return;
    this.element.remove();
    this.voile?.remove();
    this.element = this.voile = this.champRecherche = this.liste = this.pied = this.annonce = null;
    for (const retirer of this.ecouteurs) retirer();
    this.ecouteurs = [];
    if (this.ancienOverflow !== null) document.body.style.overflow = this.ancienOverflow;
    this.ancienOverflow = null;
    this.requete = "";
    this.indexActif = -1;
    this.saisieRapide.reinitialiser();
    this.notifier();
    if (rendreFocus) this.p.focus.focus({ preventScroll: true });
    this.p.surFermeture(rendreFocus);
  }

  /** Rafraichit le contenu ouvert (options ou valeur modifiees par un autre script). */
  rafraichir(depuisSaisie = false) {
    if (!this.element) return;
    this.recalculer(false, depuisSaisie);
  }

  private notifier() {
    const d = this.p.declencheur;
    d.setAttribute("aria-expanded", String(this.estOuvert));
    if (this.estOuvert) {
      d.setAttribute("aria-controls", this.idListe);
      if (!this.p.avecRecherche || this.mobile) this.majActiveDescendant();
    } else {
      d.removeAttribute("aria-controls");
      d.removeAttribute("aria-activedescendant");
    }
    this.p.racine.classList.toggle("eva-sel--ouvert", this.estOuvert);
  }

  private majActiveDescendant() {
    const id = this.idActif;
    const cibles = [this.champRecherche, !this.p.avecRecherche || this.mobile ? this.p.declencheur : null];
    for (const cible of cibles) {
      if (!cible) continue;
      if (id) cible.setAttribute("aria-activedescendant", id);
      else cible.removeAttribute("aria-activedescendant");
    }
  }

  /* ---- construction ---- */

  private construire() {
    const p = this.p;
    if (this.mobile) {
      this.voile = noeud("div", "eva-sel__voile", { "aria-hidden": "true" });
      document.body.appendChild(this.voile);
      this.ancienOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const panneau = noeud("div", `eva-sel__panneau${this.mobile ? " eva-sel__panneau--feuille" : ""}`);
    panneau.addEventListener("mousedown", (e) => {
      if (!(e.target as HTMLElement).closest("input")) e.preventDefault(); // garde le focus
    });

    if (this.mobile) {
      const entete = noeud("div", "eva-sel__entete");
      entete.appendChild(noeud("span", "eva-sel__titre", {}, p.titre));
      const fermer = noeud("button", "eva-sel__fermer", { type: "button", "aria-label": TEXTES.fermer });
      fermer.appendChild(iconeCroix(14));
      fermer.addEventListener("click", () => this.fermer(true));
      entete.appendChild(fermer);
      panneau.appendChild(entete);
    }

    if (p.avecRecherche) {
      const zone = noeud("div", "eva-sel__recherche");
      zone.appendChild(iconeLoupe());
      const champ = noeud("input", "eva-sel__recherche-champ", {
        type: "text",
        role: "combobox",
        enterkeyhint: "search",
        "aria-expanded": "true",
        "aria-controls": this.idListe,
        "aria-autocomplete": "list",
        "aria-label": TEXTES.rechercherEtiquette,
        placeholder: p.placeholderRecherche,
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        spellcheck: "false"
      });
      champ.value = this.requete;
      champ.addEventListener("input", () => {
        this.requete = champ.value;
        this.recalculer(false, true);
        this.majBoutonEffacerRecherche();
      });
      champ.addEventListener("keydown", (e) => this.surTouches(e, true));
      zone.appendChild(champ);
      const effacer = noeud("button", "eva-sel__recherche-effacer", { type: "button", "aria-label": TEXTES.effacerRecherche });
      effacer.hidden = this.requete === "";
      effacer.appendChild(iconeCroix());
      effacer.addEventListener("click", () => {
        champ.value = "";
        this.requete = "";
        this.recalculer(false, true);
        this.majBoutonEffacerRecherche();
        champ.focus({ preventScroll: true });
      });
      zone.appendChild(effacer);
      panneau.appendChild(zone);
      this.champRecherche = champ;
    }

    const liste = noeud("div", "eva-sel__liste", { id: this.idListe, role: "listbox" });
    if (p.multiple) liste.setAttribute("aria-multiselectable", "true");
    const etiquette = idEtiquette(p.declencheur);
    if (etiquette) liste.setAttribute("aria-labelledby", etiquette);
    else liste.setAttribute("aria-label", p.titre);
    panneau.appendChild(liste);
    this.liste = liste;

    if (p.avecRecherche || p.multiple) {
      const pied = noeud("div", "eva-sel__pied");
      pied.appendChild(noeud("span", "eva-sel__compteur"));
      const actions = noeud("span", "eva-sel__pied-actions");
      if (p.multiple) {
        const tout = noeud("button", "eva-sel__lien", { type: "button" }, TEXTES.toutEffacer);
        tout.addEventListener("click", () => {
          p.surToutEffacer?.();
        });
        actions.appendChild(tout);
        if (this.mobile) {
          const fin = noeud("button", "eva-sel__terminer", { type: "button" }, TEXTES.terminer);
          fin.addEventListener("click", () => this.fermer(true));
          actions.appendChild(fin);
        }
      }
      pied.appendChild(actions);
      panneau.appendChild(pied);
      this.pied = pied;
    }

    this.annonce = noeud("div", "eva-sel__sr", { role: "status", "aria-live": "polite" });
    panneau.appendChild(this.annonce);
    document.body.appendChild(panneau);
    this.element = panneau;
  }

  private majBoutonEffacerRecherche() {
    const bouton = this.element?.querySelector<HTMLButtonElement>(".eva-sel__recherche-effacer");
    if (bouton) bouton.hidden = this.requete === "";
  }

  /* ---- contenu ---- */

  private recalculer(initial: boolean, depuisSaisie = false) {
    const tous = this.p.options();
    this.visibles = filtrerOptions(tous, this.requete);
    const auto = this.p.activationAuto !== false;
    if (initial && !this.requete) {
      const choisies = this.p.choisies();
      const deja = this.visibles.findIndex((o) => choisies.has(o.valeur) && !o.desactivee);
      this.indexActif = deja >= 0 ? deja : auto ? premierActivable(this.visibles) : -1;
    } else if (depuisSaisie || !this.visibles[this.indexActif]) {
      this.indexActif = auto ? premierActivable(this.visibles) : -1;
    }
    this.dessiner(tous.length);
  }

  private dessiner(total: number) {
    const liste = this.liste;
    if (!liste) return;
    const choisies = this.p.choisies();
    const jetons = jetonsRecherche(this.requete);
    const limite = this.p.max !== undefined && choisies.size >= this.p.max;
    liste.textContent = "";

    if (this.visibles.length === 0) {
      liste.appendChild(noeud("div", "eva-sel__vide", { role: "presentation" }, total === 0 ? this.p.aucuneOption : TEXTES.aucunResultat));
    }
    let conteneur: HTMLElement = liste;
    let groupeCourant: string | undefined;
    let numeroGroupe = 0;
    this.visibles.forEach((option, index) => {
      if (option.groupe !== groupeCourant || (option.groupe !== undefined && conteneur === liste)) {
        groupeCourant = option.groupe;
        if (option.groupe === undefined) conteneur = liste;
        else {
          const idGroupe = `${this.id}-g-${numeroGroupe++}`;
          const groupe = noeud("div", "eva-sel__groupe", { role: "group", "aria-labelledby": idGroupe });
          groupe.appendChild(noeud("div", "eva-sel__groupe-entete", { id: idGroupe, role: "presentation" }, option.groupe));
          liste.appendChild(groupe);
          conteneur = groupe;
        }
      }
      const coche = choisies.has(option.valeur);
      const desactivee = option.desactivee || (!coche && limite);
      const element = noeud("div", `eva-sel__option${index === this.indexActif ? " eva-sel__option--actif" : ""}`, {
        id: `${this.id}-o-${index}`,
        "data-index": String(index),
        role: "option",
        "aria-selected": String(coche)
      });
      if (desactivee) element.setAttribute("aria-disabled", "true");
      if (this.p.multiple) {
        const caseEl = noeud("span", "eva-sel__case", { "aria-hidden": "true" });
        caseEl.appendChild(iconeCoche(13));
        element.appendChild(caseEl);
      }
      const texte = noeud("span", "eva-sel__texte");
      const libelle = noeud("span", "eva-sel__libelle");
      surligner(libelle, option.libelle, jetons);
      texte.appendChild(libelle);
      if (option.description) {
        const description = noeud("span", "eva-sel__description");
        surligner(description, option.description, jetons);
        texte.appendChild(description);
      }
      element.appendChild(texte);
      if (!this.p.multiple && coche) {
        const marque = noeud("span", "eva-sel__coche", { "aria-hidden": "true" });
        marque.appendChild(iconeCoche());
        element.appendChild(marque);
      }
      element.addEventListener("mousemove", () => {
        if (index !== this.indexActif && !desactivee) this.activer(index, false);
      });
      element.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!desactivee) this.choisir(index);
      });
      conteneur.appendChild(element);
    });

    const filtre = this.requete.trim() !== "";
    const compteur = this.pied?.querySelector<HTMLElement>(".eva-sel__compteur");
    if (compteur) {
      const max = this.p.max;
      compteur.textContent =
        filtre || !this.p.multiple ? libelleCompteur(this.visibles.length, total, filtre) : libelleSelectionnes(choisies.size, undefined, max);
    }
    const toutEffacer = this.pied?.querySelector<HTMLButtonElement>(".eva-sel__lien");
    if (toutEffacer) toutEffacer.disabled = choisies.size === 0;
    if (this.annonce) this.annonce.textContent = filtre ? libelleCompteur(this.visibles.length, total, true) : "";
    this.majActiveDescendant();
  }

  private activer(index: number, defiler = true) {
    if (index < 0 || index === this.indexActif) return;
    const liste = this.liste;
    liste?.querySelector(".eva-sel__option--actif")?.classList.remove("eva-sel__option--actif");
    this.indexActif = index;
    const element = liste?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null;
    element?.classList.add("eva-sel__option--actif");
    this.majActiveDescendant();
    if (defiler) this.rendreVisible(element, false);
  }

  private rendreVisible(element: HTMLElement | null, centrer: boolean) {
    const liste = this.liste;
    if (!liste || !element) return;
    const l = liste.getBoundingClientRect();
    const e = element.getBoundingClientRect();
    if (centrer) liste.scrollTop += e.top - l.top - (l.height - e.height) / 2;
    else if (e.top < l.top) liste.scrollTop -= l.top - e.top + 4;
    else if (e.bottom > l.bottom) liste.scrollTop += e.bottom - l.bottom + 4;
  }

  private choisir(index: number) {
    const option = this.visibles[index];
    if (!option || option.desactivee) return;
    this.p.surChoix(option);
    if (this.p.multiple) {
      this.dessiner(this.p.options().length);
      if (this.p.avecRecherche && !this.mobile) this.champRecherche?.focus({ preventScroll: true });
    } else {
      this.fermer(true);
    }
  }

  /* ---- positionnement ---- */

  private positionner() {
    const el = this.element;
    if (!el || this.mobile) return;
    const r = this.p.declencheur.getBoundingClientRect();
    el.style.top = "0px";
    el.style.left = "0px";
    el.style.bottom = "auto";
    el.style.maxHeight = "none";
    el.style.minWidth = `${Math.max(r.width, 200)}px`;
    el.style.maxWidth = `${Math.min(520, window.innerWidth - 16)}px`;
    const mesure = el.getBoundingClientRect();
    const largeur = Math.ceil(mesure.width);
    const position = calculerPosition({
      declencheur: r,
      hauteurPanneau: mesure.height,
      largeurPanneau: largeur,
      fenetre: { largeur: window.innerWidth, hauteur: window.innerHeight }
    });
    el.style.width = `${largeur}px`;
    el.style.left = `${position.left}px`;
    el.style.maxHeight = `${position.hauteurMax}px`;
    if (position.cote === "bas") {
      el.style.top = `${position.top}px`;
    } else {
      el.style.top = "auto";
      el.style.bottom = `${position.bottom}px`;
      el.classList.add("eva-sel__panneau--haut");
    }
  }

  /* ---- ecouteurs globaux (tant que le panneau est ouvert) ---- */

  private dedans(cible: EventTarget | null): boolean {
    const n = cible as Node | null;
    return !!n && !!(this.element?.contains(n) || this.p.racine.contains(n));
  }

  private ecouter() {
    const ajouter = (cible: EventTarget, type: string, fn: EventListener, options?: boolean | AddEventListenerOptions) => {
      cible.addEventListener(type, fn, options);
      this.ecouteurs.push(() => cible.removeEventListener(type, fn, options));
    };
    ajouter(document, "mousedown", (e) => {
      if (!this.dedans(e.target)) this.fermer(false);
    });
    ajouter(document, "touchstart", (e) => {
      if (!this.dedans(e.target)) this.fermer(false);
    }, { passive: true });
    // Echap / Tab captures au niveau de window : ils passent avant les ecouteurs de la page (modales...).
    ajouter(window, "keydown", ((e: KeyboardEvent) => {
      if (!this.dedans(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.fermer(true);
      } else if (e.key === "Tab") {
        e.stopPropagation();
        this.p.focus.focus({ preventScroll: true });
        this.fermer(false);
      }
    }) as EventListener, true);
    ajouter(window, "scroll", (e) => {
      if (this.mobile || Date.now() - this.ouvertA < 350) return;
      if (this.element?.contains(e.target as Node)) return;
      this.fermer(false);
    }, true);
    const largeurInitiale = window.innerWidth;
    ajouter(window, "resize", () => {
      if (this.mobile) return;
      // Saisie libre : l'apparition du clavier a l'ecran (hauteur seule) ne doit pas fermer les suggestions.
      if (this.p.feuille === false && window.innerWidth === largeurInitiale) return;
      this.fermer(false);
    });
  }

  /* ---- clavier ---- */

  /** Touches communes au declencheur, au <select> natif masque et au champ de recherche. */
  surTouches(e: KeyboardEvent, depuisRecherche: boolean) {
    const touche = e.key;
    const ouvert = this.estOuvert;
    const deplacer = (sens: 1 | -1, pas = 1) => {
      if (this.indexActif < 0) {
        this.activer(sens === 1 ? premierActivable(this.visibles) : dernierActivable(this.visibles));
        return;
      }
      let courant = this.indexActif;
      for (let i = 0; i < pas; i++) {
        const suivant = indexSuivant(this.visibles, courant, sens);
        if (suivant < 0) return;
        if (pas > 1 && ((sens === 1 && suivant < courant) || (sens === -1 && suivant > courant))) break;
        courant = suivant;
      }
      this.activer(courant);
    };
    if (touche === "ArrowDown" || touche === "ArrowUp") {
      e.preventDefault();
      if (!ouvert) this.ouvrir();
      else deplacer(touche === "ArrowDown" ? 1 : -1);
    } else if (touche === "PageDown" || touche === "PageUp") {
      if (!ouvert) return;
      e.preventDefault();
      deplacer(touche === "PageDown" ? 1 : -1, 8);
    } else if (touche === "Home" || touche === "End") {
      if (depuisRecherche && this.requete !== "") return;
      e.preventDefault();
      if (!ouvert) this.ouvrir();
      else this.activer(touche === "Home" ? premierActivable(this.visibles) : dernierActivable(this.visibles));
    } else if (touche === "Enter") {
      e.preventDefault(); // jamais de soumission du formulaire parent
      if (!ouvert) this.ouvrir();
      else if (this.indexActif >= 0) this.choisir(this.indexActif);
    } else if (touche === " ") {
      if (depuisRecherche) return;
      e.preventDefault();
      if (!ouvert) this.ouvrir();
      else if (this.p.avecRecherche && this.requete !== "") this.definirRequete(this.requete + " ");
      else if (this.indexActif >= 0) this.choisir(this.indexActif);
    } else if (!depuisRecherche && toucheImprimable(e)) {
      e.preventDefault();
      if (this.p.avecRecherche) {
        if (!ouvert) this.ouvrir(touche);
        else this.definirRequete(this.requete + touche);
      } else {
        const trouve = this.saisieRapide.chercher(touche, ouvert ? this.visibles : this.p.options(), ouvert ? this.indexActif : -1);
        if (trouve < 0) return;
        if (ouvert) this.activer(trouve);
        else {
          const option = this.p.options()[trouve];
          if (this.p.multiple) {
            this.ouvrir();
            this.activer(filtrerOptions(this.p.options(), "").indexOf(option));
          } else if (option && !option.desactivee) this.p.surChoix(option);
        }
      }
    }
  }

  private definirRequete(valeur: string) {
    this.requete = valeur;
    if (this.champRecherche) {
      this.champRecherche.value = valeur;
      this.champRecherche.focus({ preventScroll: true });
    }
    this.recalculer(false, true);
    this.majBoutonEffacerRecherche();
  }
}

/* ------------------------------------------------------------ <select> */

function lireOptions(select: HTMLSelectElement): OptionNative[] {
  const resultat: OptionNative[] = [];
  const ajouter = (option: HTMLOptionElement, groupe?: HTMLOptGroupElement) => {
    if (option.hidden) return;
    resultat.push({
      element: option,
      valeur: option.value,
      libelle: (option.label || option.textContent || "").trim(),
      description: option.getAttribute("data-description") ?? undefined,
      recherche: option.getAttribute("data-recherche") ?? undefined,
      groupe: groupe ? groupe.label : undefined,
      desactivee: option.disabled || !!groupe?.disabled
    });
  };
  for (const enfant of Array.from(select.children)) {
    if (enfant instanceof HTMLOptionElement) ajouter(enfant);
    else if (enfant instanceof HTMLOptGroupElement) for (const o of Array.from(enfant.children)) if (o instanceof HTMLOptionElement) ajouter(o, enfant);
  }
  return resultat;
}

function surChangement(element: HTMLElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function habillerSelect(select: HTMLSelectElement): Instance {
  const multiple = select.multiple;
  const id = ++compteur;
  const racine = noeud("div", "eva-sel");
  if (select.classList.contains("ev-select--auto")) racine.classList.add("eva-sel--auto");
  if (select.classList.contains("ev-select--petit")) racine.classList.add("eva-sel--petit");
  if (select.classList.contains("ev-champ--mono") || select.closest(".ev-champ--mono")) racine.classList.add("eva-sel--mono");
  copierMiseEnPage(select, racine);

  const idValeur = `eva-sel-v${id}`;
  const declencheur = noeud("button", "eva-sel__declencheur", {
    type: "button",
    role: "combobox",
    "aria-haspopup": "listbox",
    "aria-expanded": "false"
  });
  const contenu = noeud("span", "eva-sel__contenu");
  declencheur.appendChild(contenu);
  declencheur.appendChild(iconeChevron());
  racine.appendChild(declencheur);

  const { mode, seuil } = modeRecherche(select);
  const options = () => lireOptions(select);
  const choisies = (): ReadonlySet<string> => new Set(Array.from(select.options).filter((o) => o.selected).map((o) => o.value));

  const panneau = new Panneau({
    declencheur,
    racine,
    multiple,
    get avecRecherche() {
      return rechercheAffichee(mode, select.options.length, seuil);
    },
    get titre() {
      return titreDe(select, TEXTES.placeholder);
    },
    placeholderRecherche: TEXTES.rechercher,
    options,
    choisies,
    surChoix: (option) => {
      if (multiple) option.element.selected = !option.element.selected;
      else select.value = option.valeur;
      surChangement(select);
      rafraichir();
    },
    surToutEffacer: () => {
      for (const o of Array.from(select.options)) o.selected = false;
      surChangement(select);
      rafraichir();
    },
    surFermeture: () => undefined,
    focus: declencheur,
    aucuneOption: TEXTES.aucuneOption
  } as ParametresPanneau);

  function interactif(): boolean {
    return !select.matches(":disabled");
  }

  function rafraichir() {
    const toutes = Array.from(select.options);
    const choisiesNatives = toutes.filter((o) => o.selected);
    contenu.textContent = "";
    if (multiple) {
      if (choisiesNatives.length === 0) {
        contenu.appendChild(noeud("span", "eva-sel__placeholder", { id: idValeur }, select.getAttribute("data-placeholder") ?? TEXTES.placeholder));
      } else {
        const zone = noeud("span", "eva-sel__contenu", { id: idValeur });
        for (const o of choisiesNatives.slice(0, 2)) zone.appendChild(noeud("span", "eva-sel__puce", {}, (o.label || o.textContent || "").trim()));
        if (choisiesNatives.length > 2) zone.appendChild(noeud("span", "eva-sel__plus", {}, `+${choisiesNatives.length - 2}`));
        contenu.appendChild(zone);
      }
    } else {
      const option = select.selectedOptions[0];
      const libelle = (option?.label || option?.textContent || "").trim();
      const placeholder = !option || libelle === "" || (option.value === "" && (select.required || option.hasAttribute("data-placeholder")));
      contenu.appendChild(
        noeud("span", placeholder ? "eva-sel__placeholder" : "eva-sel__valeur", { id: idValeur }, placeholder ? libelle || (select.getAttribute("data-placeholder") ?? TEXTES.placeholder) : libelle)
      );
    }
    // Nom accessible : label relie (ou aria-label du select) + valeur courante.
    const etiquette = idEtiquette(select);
    const ariaLabel = select.getAttribute("aria-label");
    if (ariaLabel) {
      declencheur.setAttribute("aria-label", ariaLabel);
      declencheur.id = declencheur.id || `eva-sel-d${id}`;
      declencheur.setAttribute("aria-labelledby", `${declencheur.id} ${idValeur}`);
    } else if (etiquette) {
      declencheur.setAttribute("aria-labelledby", `${etiquette} ${idValeur}`);
    }
    const desactive = !interactif();
    declencheur.disabled = desactive;
    racine.classList.toggle("eva-sel--desactive", desactive);
    racine.classList.toggle("eva-sel--invalide", select.getAttribute("aria-invalid") === "true");
    declencheur.setAttribute("aria-required", String(select.required));
    racine.hidden = select.hidden || select.style.display === "none";
    panneau.rafraichir();
  }

  // Ouverture : clic, fleches, Entree, Espace, saisie.
  declencheur.addEventListener("click", () => {
    if (!interactif()) return;
    if (panneau.estOuvert) panneau.fermer(false);
    else panneau.ouvrir();
  });
  declencheur.addEventListener("keydown", (e) => {
    if (interactif()) panneau.surTouches(e, false);
  });
  declencheur.addEventListener("keyup", (e) => {
    if (e.key === " ") e.preventDefault();
  });

  // Le <select> natif masque : focus (label, validation HTML5 qui echoue) et saisie transmis au declencheur.
  select.addEventListener("focus", () => racine.classList.add("eva-sel--focus-natif"));
  select.addEventListener("blur", () => racine.classList.remove("eva-sel--focus-natif"));
  select.addEventListener("keydown", (e) => {
    if (!interactif() || e.key === "Tab" || e.key === "Escape" || e.ctrlKey || e.metaKey || e.altKey) return;
    declencheur.focus({ preventScroll: true });
    panneau.surTouches(e, false);
  });
  select.addEventListener("invalid", () => racine.classList.add("eva-sel--invalide"));
  select.addEventListener("change", () => {
    racine.classList.remove("eva-sel--invalide");
    rafraichir();
  });

  // Valeur modifiee par un autre script : accesseurs de l'instance (value, selectedIndex) + observateur.
  const planifier = (() => {
    let enAttente = false;
    return () => {
      if (enAttente) return;
      enAttente = true;
      queueMicrotask(() => {
        enAttente = false;
        if (select.isConnected) rafraichir();
      });
    };
  })();
  for (const propriete of ["value", "selectedIndex"] as const) {
    const descripteur = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, propriete);
    if (!descripteur?.get || !descripteur.set) continue;
    const { get, set } = descripteur;
    Object.defineProperty(select, propriete, {
      configurable: true,
      get() {
        return get.call(this);
      },
      set(valeur: unknown) {
        set.call(this, valeur);
        planifier();
      }
    });
  }
  const observateur = new MutationObserver(planifier);
  observateur.observe(select, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["disabled", "selected", "label", "hidden", "style", "required", "aria-invalid", "aria-label", "data-description"]
  });

  const formulaire = select.form;
  const surReinitialisation = () => setTimeout(rafraichir, 0);
  formulaire?.addEventListener("reset", surReinitialisation);

  select.classList.add("eva-sel-natif");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.setAttribute("data-selecteur", "");
  select.after(racine);
  rafraichir();

  return {
    racine,
    rafraichir,
    detruire() {
      panneau.fermer(false);
      observateur.disconnect();
      formulaire?.removeEventListener("reset", surReinitialisation);
      delete (select as unknown as Record<string, unknown>).value;
      delete (select as unknown as Record<string, unknown>).selectedIndex;
      select.classList.remove("eva-sel-natif");
      select.removeAttribute("aria-hidden");
      select.removeAttribute("data-selecteur");
      select.removeAttribute("tabindex");
      racine.remove();
      instances.delete(select);
    }
  };
}

/* ------------------------------------------------- <input list> + <datalist> */

function lireSuggestions(liste: HTMLDataListElement | null): OptionNative[] {
  if (!liste) return [];
  const resultat: OptionNative[] = [];
  for (const option of Array.from(liste.options)) {
    const secondaire = (option.label || option.textContent || "").trim();
    resultat.push({
      element: option,
      valeur: option.value,
      // Comme un datalist natif, la valeur est le texte insere ; le libelle est un complement.
      libelle: option.value,
      description: secondaire && secondaire !== option.value ? secondaire : undefined,
      desactivee: option.disabled
    });
  }
  return resultat;
}

function habillerSaisie(champ: HTMLInputElement): Instance | null {
  const idListe = champ.getAttribute("list");
  const datalist = idListe ? (document.getElementById(idListe) as HTMLDataListElement | null) : null;
  if (!datalist) return null;
  const racine = noeud("div", "eva-sel eva-sel--saisie");
  copierMiseEnPage(champ, racine);
  champ.before(racine);
  racine.appendChild(champ);
  champ.classList.add("eva-sel__saisie");
  champ.setAttribute("data-liste", idListe as string);
  champ.removeAttribute("list"); // supprime la liste native
  champ.setAttribute("role", "combobox");
  champ.setAttribute("aria-autocomplete", "list");
  champ.setAttribute("aria-expanded", "false");
  champ.autocomplete = "off";

  const bascule = noeud("button", "eva-sel__bascule", { type: "button", tabindex: "-1", "aria-label": "Afficher les suggestions" });
  bascule.appendChild(iconeChevron());
  racine.appendChild(bascule);

  let filtreActif = false;
  const suggestions = () => lireSuggestions(datalist);
  const choisies = (): ReadonlySet<string> => new Set(champ.value ? [champ.value] : []);

  const panneau = new Panneau({
    declencheur: champ,
    racine,
    multiple: false,
    avecRecherche: false,
    titre: titreDe(champ, "Suggestions"),
    placeholderRecherche: "",
    options: () => {
      const toutes = suggestions();
      return filtreActif ? filtrerOptions(toutes, champ.value) : toutes;
    },
    choisies,
    surChoix: (option) => {
      champ.value = option.valeur;
      filtreActif = false;
      surChangement(champ);
      requestAnimationFrame(() => champ.setSelectionRange(champ.value.length, champ.value.length));
    },
    surFermeture: () => undefined,
    focus: champ,
    aucuneOption: TEXTES.aucunResultat,
    activationAuto: false,
    feuille: false
  } as ParametresPanneau);

  function majEtat() {
    const interactif = !champ.disabled && !champ.readOnly;
    racine.classList.toggle("eva-sel--desactive", champ.disabled);
    racine.classList.toggle("eva-sel--lecture", champ.readOnly && !champ.disabled);
    bascule.hidden = !interactif || suggestions().length === 0;
    racine.classList.toggle("eva-sel--sans-chevron", bascule.hidden);
    racine.hidden = champ.hidden;
  }

  function ouvrir(depuisSaisie: boolean) {
    if (champ.disabled || champ.readOnly) return;
    filtreActif = depuisSaisie;
    if (suggestions().length === 0) return;
    if (!panneau.estOuvert) panneau.ouvrir();
    else panneau.rafraichir();
  }

  champ.addEventListener("input", () => {
    if (!champ.matches(":focus")) return;
    filtreActif = true;
    // Aucune suggestion : la valeur libre reste valide, le panneau se referme.
    if (filtrerOptions(suggestions(), champ.value).length === 0) panneau.fermer(false);
    else if (panneau.estOuvert) panneau.rafraichir(true);
    else ouvrir(true);
  });
  champ.addEventListener("click", () => {
    if (!panneau.estOuvert) ouvrir(false);
  });
  champ.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!panneau.estOuvert) ouvrir(false);
      else panneau.surTouches(e, true);
    } else if (e.key === "Enter" && panneau.estOuvert) {
      e.preventDefault();
      panneau.surTouches(e, true);
    }
  });
  bascule.addEventListener("mousedown", (e) => e.preventDefault());
  bascule.addEventListener("click", () => {
    if (panneau.estOuvert) panneau.fermer(true);
    else {
      champ.focus({ preventScroll: true });
      ouvrir(false);
    }
  });

  const observateur = new MutationObserver(() => {
    majEtat();
    panneau.rafraichir();
  });
  observateur.observe(datalist, { childList: true, subtree: true, characterData: true, attributes: true });
  observateur.observe(champ, { attributes: true, attributeFilter: ["disabled", "readonly", "hidden"] });
  majEtat();

  return {
    racine,
    rafraichir: () => {
      majEtat();
      panneau.rafraichir();
    },
    detruire() {
      panneau.fermer(false);
      observateur.disconnect();
      champ.setAttribute("list", idListe as string);
      champ.classList.remove("eva-sel__saisie");
      champ.removeAttribute("data-liste");
      champ.removeAttribute("role");
      champ.removeAttribute("aria-autocomplete");
      champ.removeAttribute("aria-expanded");
      racine.before(champ);
      racine.remove();
      instances.delete(champ);
    }
  };
}

/* ------------------------------------------------------------ API */

function habiller(element: Element) {
  if (instances.has(element) || exclu(element) || (element as HTMLElement).hasAttribute("data-natif")) return;
  if (element instanceof HTMLSelectElement) {
    // Liste a plusieurs lignes visibles (size > 1) sans `multiple` : on la laisse native.
    if (element.size > 1 && !element.multiple) return;
    instances.set(element, habillerSelect(element));
  } else if (element instanceof HTMLInputElement) {
    const instance = habillerSaisie(element);
    if (instance) instances.set(element, instance);
  }
}

/** Habille les selects et champs a suggestions de `racine` (document par defaut), sans effet sur ceux deja habilles. */
export function initialiser(racine: ParentNode = document): void {
  if (racine instanceof Element && racine.matches(`${SELECTEURS_SELECT}, ${SELECTEURS_SAISIE}`)) habiller(racine);
  racine.querySelectorAll(`${SELECTEURS_SELECT}, ${SELECTEURS_SAISIE}`).forEach(habiller);
}

/** Retire l'habillage d'un select ou d'un champ (le natif reprend sa place). */
export function detruire(element: Element): void {
  instances.get(element)?.detruire();
}

/** Force la relecture du <select> (apres une modification que ni les accesseurs ni l'observateur ne voient). */
export function rafraichir(element: Element): void {
  instances.get(element)?.rafraichir();
}

function surveillerDocument() {
  const observateur = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        // Un select retire seul du DOM : son habillage (frere) ne doit pas rester.
        const cibles = n.matches("select, input") ? [n] : Array.from(n.querySelectorAll("select, input"));
        for (const cible of cibles) {
          const instance = instances.get(cible);
          if (instance && !instance.racine.isConnected) instances.get(cible)?.detruire();
          else if (instance && !cible.isConnected) instance.detruire();
        }
      });
      mutation.addedNodes.forEach((n) => {
        if (n instanceof Element) initialiser(n);
      });
    }
  });
  observateur.observe(document.body, { childList: true, subtree: true });
}

function demarrer() {
  initialiser(document);
  surveillerDocument();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer, { once: true });
  else demarrer();
}
