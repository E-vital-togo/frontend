/**
 * Widget telephone pour les gabarits Django (admin), sans framework : meme
 * logique (lib/telephone.ts, lib/drapeauxTelephone.ts) et memes classes CSS
 * (styles/telephone.css) que le composant React ui/ChampTelephone.tsx.
 *
 * Compile en bundle IIFE par `npm run build:telephone-django` :
 *   backend/static/js/evital_telephone.js
 *   backend/static/css/evital-telephone.css
 *
 * Usage : tout <input data-evital-telephone> est transforme au chargement
 * de la page (voir apps.core.champs_telephone.WidgetTelephone, qui emet
 * aussi les balises <link>/<script>). L'input d'origine devient un champ
 * cache portant la valeur E.164 envoyee au serveur (meme `name`), et un
 * champ visible (sans `name`, repris `id`/`required`) sert a la saisie.
 * Attributs lus : data-pays-defaut (code ISO, "TG" par defaut).
 *
 * Expose `window.EvitalTelephone.initialiser(racine)` pour les formulaires
 * injectes dynamiquement apres le chargement.
 */
import { chargerDrapeaux, urlDrapeau } from "./drapeauxTelephone";
import {
  PAYS_DEFAUT,
  exempleNational,
  filtrerPays,
  formaterSaisie,
  interpreterSaisie,
  lireValeur,
  listerPays,
  paysParIso,
  positionCurseur,
  validerEtat,
  versE164,
  type CodeIso,
  type EtatTelephone,
  type Pays
} from "./telephone";

const SVG_NS = "http://www.w3.org/2000/svg";

let compteur = 0;

function noeud<K extends keyof HTMLElementTagNameMap>(
  balise: K,
  classe?: string,
  attributs: Record<string, string> = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  for (const [nom, valeur] of Object.entries(attributs)) element.setAttribute(nom, valeur);
  return element;
}

function icone(largeur: number, chemins: string, classe?: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(largeur));
  svg.setAttribute("height", String(largeur));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (classe) svg.setAttribute("class", classe);
  svg.innerHTML = chemins;
  return svg;
}

const TRAIT = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const iconeChevron = () => icone(12, `<path d="M3 6l5 5 5-5" ${TRAIT} stroke-width="1.8"/>`, "eva-tel__chevron");
const iconeCoche = () => icone(14, `<path d="M3 8.5l3.2 3.2L13 4.5" ${TRAIT} stroke-width="2"/>`);
const iconeLoupe = () =>
  icone(
    15,
    `<circle cx="7" cy="7" r="4.6" ${TRAIT} stroke-width="1.6"/><path d="m10.6 10.6 3.2 3.2" ${TRAIT} stroke-width="1.6"/>`,
    "eva-tel__loupe"
  );
const iconeAlerte = () =>
  icone(13, `<circle cx="8" cy="8" r="6.5" ${TRAIT} stroke-width="1.5"/><path d="M8 4.6v4M8 10.9v.1" ${TRAIT} stroke-width="1.8"/>`);

function nombreChiffresAvant(texte: string, position: number): number {
  return (texte.slice(0, position).match(/\d/g) ?? []).length;
}

class ChampTelephoneDom {
  private etat: EtatTelephone;
  private touche = false;
  private ouvert = false;
  private requete = "";
  private indexActif = 0;
  private resultats: Pays[] = [];
  private drapeaux: Readonly<Record<string, string>> | null = null;
  private readonly pays = listerPays();
  private readonly requis: boolean;
  private readonly paysDefaut: CodeIso;
  private readonly idListe: string;

  private readonly racine = noeud("div", "eva-tel");
  private readonly controle = noeud("div", "eva-tel__controle");
  private readonly boutonPays = noeud("button", "eva-tel__pays", { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" });
  private readonly imageDrapeau = noeud("img", "eva-tel__drapeau", { alt: "", width: "22", height: "15", draggable: "false" });
  private readonly libelleIndicatif = noeud("span", "eva-tel__indicatif");
  private readonly saisie = noeud("input", "eva-tel__saisie", { type: "tel", inputmode: "tel", autocomplete: "tel", maxlength: "32" });
  private readonly coche = noeud("span", "eva-tel__etat", { title: "Numéro valide" });
  private readonly zoneErreur = noeud("div", "eva-tel__erreur", { role: "alert" });
  private panneau: HTMLElement | null = null;
  private champRecherche: HTMLInputElement | null = null;
  private liste: HTMLElement | null = null;

  constructor(private readonly cache: HTMLInputElement) {
    compteur += 1;
    this.idListe = `eva-tel-liste-${compteur}`;
    this.paysDefaut = (paysParIso((cache.dataset.paysDefaut ?? "").toUpperCase())?.iso as CodeIso | undefined) ?? PAYS_DEFAUT;
    this.requis = cache.required;
    this.etat = lireValeur(cache.value, this.paysDefaut);

    // L'input d'origine garde son `name` (valeur E.164 postee) ; le champ visible reprend id, label et attributs utiles.
    const identifiant = cache.id;
    cache.removeAttribute("id");
    cache.type = "hidden";
    cache.required = false;
    this.saisie.id = identifiant;
    this.saisie.required = this.requis;
    this.saisie.disabled = cache.disabled;
    this.saisie.readOnly = cache.readOnly;
    this.saisie.setAttribute("aria-describedby", `${identifiant || this.idListe}-erreur`);
    this.zoneErreur.id = `${identifiant || this.idListe}-erreur`;
    this.zoneErreur.hidden = true;
    this.coche.hidden = true;
    this.coche.appendChild(iconeCoche());
    this.boutonPays.disabled = cache.disabled;
    this.boutonPays.append(this.imageDrapeau, this.libelleIndicatif);
    if (!cache.disabled && !cache.readOnly) this.boutonPays.appendChild(iconeChevron());
    if (cache.disabled) this.racine.classList.add("eva-tel--desactive");
    if (cache.readOnly) this.racine.classList.add("eva-tel--lecture");

    const zone = noeud("div", "eva-tel__zone");
    this.controle.append(this.boutonPays, this.saisie, this.coche);
    zone.appendChild(this.controle);
    this.racine.append(zone, this.zoneErreur);
    cache.insertAdjacentElement("afterend", this.racine);

    this.brancher();
    this.synchroniser();
    chargerDrapeaux()
      .then((table) => {
        this.drapeaux = table;
        this.rafraichirDrapeaux();
      })
      .catch(() => {
        // Sans drapeaux : globe generique, le champ reste utilisable.
      });
  }

  private get interactif(): boolean {
    return !this.cache.disabled && !this.cache.readOnly;
  }

  private brancher(): void {
    this.saisie.addEventListener("input", (evenement) => this.surSaisie(evenement as InputEvent));
    this.saisie.addEventListener("blur", (evenement) => {
      if (!this.racine.contains(evenement.relatedTarget as Node | null)) {
        this.touche = true;
        this.afficherValidation();
      }
    });
    this.boutonPays.addEventListener("click", () => (this.ouvert ? this.fermer(false) : this.ouvrir()));
    this.boutonPays.addEventListener("keydown", (evenement) => {
      if (evenement.key === "ArrowDown" || evenement.key === "ArrowUp") {
        evenement.preventDefault();
        this.ouvrir();
      }
    });
    document.addEventListener("mousedown", (evenement) => {
      if (this.ouvert && !this.racine.contains(evenement.target as Node)) this.fermer(false);
    });
    document.addEventListener("touchstart", (evenement) => {
      if (this.ouvert && !this.racine.contains(evenement.target as Node)) this.fermer(false);
    });
  }

  /** Reporte l'etat dans l'affichage, le champ cache et la validation. */
  private synchroniser(curseur: number | null = null): void {
    const pays = paysParIso(this.etat.iso);
    const affichage = formaterSaisie(this.etat);
    if (this.saisie.value !== affichage) this.saisie.value = affichage;
    if (curseur !== null && document.activeElement === this.saisie) this.saisie.setSelectionRange(curseur, curseur);
    this.saisie.placeholder = exempleNational(this.etat.iso);
    this.libelleIndicatif.textContent = pays?.indicatif ?? "";
    this.boutonPays.setAttribute("aria-label", `Pays : ${pays?.nom ?? this.etat.iso}, indicatif ${pays?.indicatif ?? ""}. Changer de pays`);
    this.rafraichirDrapeaux();
    this.cache.value = versE164(this.etat);
    this.afficherValidation();
  }

  private rafraichirDrapeaux(): void {
    this.imageDrapeau.src = urlDrapeau(this.drapeaux, this.etat.iso);
    this.panneau?.querySelectorAll<HTMLImageElement>("img[data-iso]").forEach((image) => {
      image.src = urlDrapeau(this.drapeaux, image.dataset.iso ?? "");
    });
  }

  private afficherValidation(): void {
    const validation = validerEtat(this.etat);
    const vide = validation.code === "vide";
    const message = vide ? (this.requis ? validation.message : undefined) : validation.message;
    this.saisie.setCustomValidity(message ?? "");
    const affiche = message && (this.touche || validation.code === "trop_long") ? message : undefined;
    this.racine.classList.toggle("eva-tel--erreur", Boolean(affiche));
    this.zoneErreur.hidden = !affiche;
    this.zoneErreur.replaceChildren();
    if (affiche) {
      const texte = noeud("span");
      texte.textContent = affiche;
      this.zoneErreur.append(iconeAlerte(), texte);
      this.saisie.setAttribute("aria-invalid", "true");
    } else {
      this.saisie.removeAttribute("aria-invalid");
    }
    this.coche.hidden = !validation.valide || Boolean(affiche);
  }

  private surSaisie(evenement: InputEvent): void {
    const type = evenement.inputType ?? "";
    const brut = this.saisie.value;
    const position = this.saisie.selectionStart ?? brut.length;
    const affichageAvant = formaterSaisie(this.etat);
    const collage =
      /^insert(FromPaste|FromDrop|ReplacementText)/.test(type) || brut.length - affichageAvant.length > 1 || (!type && brut.length > 1);

    let texte = brut;
    let chiffresAvant = nombreChiffresAvant(brut, position);
    if (
      type.startsWith("delete") &&
      this.etat.partiel === undefined &&
      brut.replace(/\D/g, "") === this.etat.chiffres &&
      this.etat.chiffres
    ) {
      const indice = type === "deleteContentForward" ? chiffresAvant : chiffresAvant - 1;
      if (indice >= 0 && indice < this.etat.chiffres.length) {
        texte = this.etat.chiffres.slice(0, indice) + this.etat.chiffres.slice(indice + 1);
        chiffresAvant = indice;
      }
    }

    this.etat = interpreterSaisie(texte, this.etat, collage);
    const affichage = formaterSaisie(this.etat);
    this.synchroniser(collage || this.etat.partiel !== undefined ? affichage.length : positionCurseur(affichage, chiffresAvant));
  }

  // ------------------------------------------------ selecteur de pays

  private idOption(index: number): string {
    return `${this.idListe}-${index}`;
  }

  private ouvrir(): void {
    if (!this.interactif || this.ouvert) return;
    this.ouvert = true;
    this.requete = "";
    this.indexActif = Math.max(
      0,
      this.pays.findIndex((p) => p.iso === this.etat.iso)
    );
    this.boutonPays.setAttribute("aria-expanded", "true");
    this.boutonPays.setAttribute("aria-controls", this.idListe);

    const panneau = noeud("div", "eva-tel__panneau");
    const recherche = noeud("div", "eva-tel__recherche");
    const champ = noeud("input", "eva-tel__recherche-champ", {
      type: "search",
      role: "combobox",
      "aria-expanded": "true",
      "aria-controls": this.idListe,
      "aria-autocomplete": "list",
      "aria-label": "Rechercher un pays ou un indicatif",
      placeholder: "Rechercher un pays ou un indicatif",
      autocomplete: "off",
      autocorrect: "off",
      spellcheck: "false"
    });
    recherche.append(iconeLoupe(), champ);
    const liste = noeud("ul", "eva-tel__liste", { id: this.idListe, role: "listbox", "aria-label": "Pays" });
    panneau.append(recherche, liste);
    this.racine.querySelector(".eva-tel__zone")?.appendChild(panneau);
    this.panneau = panneau;
    this.champRecherche = champ;
    this.liste = liste;

    champ.addEventListener("input", () => {
      this.requete = champ.value;
      this.indexActif = 0;
      this.dessinerListe();
    });
    champ.addEventListener("keydown", (evenement) => this.surTouchesRecherche(evenement));
    this.dessinerListe();
    champ.focus();
    this.racine.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  private fermer(rendreFocus: boolean): void {
    if (!this.ouvert) return;
    this.ouvert = false;
    this.panneau?.remove();
    this.panneau = null;
    this.champRecherche = null;
    this.liste = null;
    this.boutonPays.setAttribute("aria-expanded", "false");
    this.boutonPays.removeAttribute("aria-controls");
    if (rendreFocus) this.boutonPays.focus();
  }

  private dessinerListe(): void {
    if (!this.liste || !this.champRecherche) return;
    this.resultats = filtrerPays(this.pays, this.requete);
    const sansRecherche = this.requete.trim() === "";
    this.liste.replaceChildren();
    if (this.resultats.length === 0) {
      const vide = noeud("li", "eva-tel__vide", { role: "presentation" });
      vide.textContent = "Aucun pays trouvé";
      this.liste.appendChild(vide);
    }
    this.resultats.forEach((p, index) => {
      const element = noeud("li", "eva-tel__element", { role: "presentation" });
      const precedent = this.resultats[index - 1];
      if (sansRecherche && (!precedent || precedent.groupe !== p.groupe)) {
        const entete = noeud("div", "eva-tel__groupe");
        entete.textContent = p.groupe === "afrique_ouest" ? "Afrique de l'Ouest" : "Autres pays";
        element.appendChild(entete);
      }
      const option = noeud("div", "eva-tel__option", {
        id: this.idOption(index),
        role: "option",
        "aria-selected": String(p.iso === this.etat.iso),
        "data-index": String(index)
      });
      const drapeau = noeud("img", "eva-tel__drapeau", { alt: "", width: "22", height: "15", draggable: "false", "data-iso": p.iso });
      drapeau.src = urlDrapeau(this.drapeaux, p.iso);
      const nom = noeud("span", "eva-tel__option-nom");
      nom.textContent = p.nom;
      const indicatif = noeud("span", "eva-tel__option-indicatif");
      indicatif.textContent = p.indicatif;
      option.append(drapeau, nom, indicatif);
      if (p.iso === this.etat.iso) {
        const marque = noeud("span", "eva-tel__option-coche");
        marque.appendChild(iconeCoche());
        option.appendChild(marque);
      }
      option.addEventListener("mouseenter", () => this.activer(index, false));
      option.addEventListener("mousedown", (evenement) => evenement.preventDefault());
      option.addEventListener("click", () => this.choisirPays(p.iso));
      element.appendChild(option);
      this.liste?.appendChild(element);
    });
    this.activer(Math.min(this.indexActif, Math.max(0, this.resultats.length - 1)), true);
  }

  private activer(index: number, defiler: boolean): void {
    this.indexActif = index;
    this.liste?.querySelectorAll(".eva-tel__option--actif").forEach((o) => o.classList.remove("eva-tel__option--actif"));
    const option = this.liste?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!option) {
      this.champRecherche?.removeAttribute("aria-activedescendant");
      return;
    }
    option.classList.add("eva-tel__option--actif");
    this.champRecherche?.setAttribute("aria-activedescendant", option.id);
    if (defiler) option.scrollIntoView({ block: "nearest" });
  }

  private surTouchesRecherche(evenement: KeyboardEvent): void {
    const dernier = this.resultats.length - 1;
    switch (evenement.key) {
      case "ArrowDown":
        evenement.preventDefault();
        this.activer(this.indexActif >= dernier ? 0 : this.indexActif + 1, true);
        break;
      case "ArrowUp":
        evenement.preventDefault();
        this.activer(this.indexActif <= 0 ? Math.max(0, dernier) : this.indexActif - 1, true);
        break;
      case "Home":
        evenement.preventDefault();
        this.activer(0, true);
        break;
      case "End":
        evenement.preventDefault();
        this.activer(Math.max(0, dernier), true);
        break;
      case "Enter":
        // Ne jamais soumettre le formulaire Django en validant un pays.
        evenement.preventDefault();
        if (this.resultats[this.indexActif]) this.choisirPays(this.resultats[this.indexActif].iso);
        break;
      case "Escape":
        evenement.preventDefault();
        evenement.stopPropagation();
        this.fermer(true);
        break;
      case "Tab":
        this.fermer(false);
        break;
    }
  }

  private choisirPays(iso: CodeIso): void {
    this.fermer(false);
    this.etat = interpreterSaisie(this.etat.partiel !== undefined ? "" : this.etat.chiffres, { iso, chiffres: "" }, false);
    this.synchroniser();
    this.saisie.focus();
  }
}

const ATTRIBUT_INITIALISE = "data-evital-telephone-pret";

/** Transforme tout <input data-evital-telephone> de `racine` (idempotent). */
export function initialiser(racine: ParentNode = document): void {
  racine.querySelectorAll<HTMLInputElement>("input[data-evital-telephone]").forEach((input) => {
    if (input.hasAttribute(ATTRIBUT_INITIALISE)) return;
    input.setAttribute(ATTRIBUT_INITIALISE, "");
    new ChampTelephoneDom(input);
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initialiser());
  } else {
    initialiser();
  }
}
