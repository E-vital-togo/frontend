import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { chargerDrapeaux, urlDrapeau } from "../../lib/drapeauxTelephone";
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
} from "../../lib/telephone";
import "../../styles/telephone.css";

export interface ProprietesChampTelephone {
  /** Identifiant du champ de saisie (celui du `htmlFor` du label). */
  id: string;
  /** Valeur recue : E.164 ("+22890123456") ou ancien format libre ("90123456", "228-90-12-34-56"...). */
  valeur: string | null | undefined;
  /** Valeur emise : E.164 ("+22890123456"), ou "" si rien n'est saisi. */
  onChange: (valeur: string) => void;
  nom?: string;
  disabled?: boolean;
  lectureSeule?: boolean;
  requis?: boolean;
  /**
   * Relaie la validation au navigateur (attribut `required` + setCustomValidity) pour qu'un <form>
   * refuse d'etre soumis avec un numero invalide. A desactiver quand le champ peut etre masque dans un
   * formulaire plus large (un controle invalide masque bloque la soumission sans message).
   */
  validationNative?: boolean;
  /**
   * Dossier verrouille (voir ChampDynamique) : meme rendu que les autres controles verrouilles ;
   * une modification n'est pas appliquee, elle est seulement signalee via `onChange` (le parent avertit l'agent).
   */
  verrouille?: boolean;
  /** Pays propose quand la valeur n'a pas d'indicatif. Togo par defaut. */
  paysDefaut?: CodeIso;
  /** Erreur venue de l'exterieur (ex: refus du serveur), affichee en priorite. */
  erreur?: string;
  /** Appele a chaque changement avec la validite courante (un champ vide non requis est valide). */
  onValidite?: (valide: boolean) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

let compteur = 0;

/** Identifiant unique stable (React 18 a useId, mais ce fichier est aussi recopie tel quel cote app DHIS2 en React 16). */
function useIdentifiantUnique(prefixe: string): string {
  const ref = useRef<string>();
  if (!ref.current) {
    compteur += 1;
    ref.current = `${prefixe}-${compteur}`;
  }
  return ref.current;
}

function nombreChiffresAvant(texte: string, position: number): number {
  return (texte.slice(0, position).match(/\d/g) ?? []).length;
}

function IconeChevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      className={`eva-tel__chevron${ouvert ? " eva-tel__chevron--ouvert" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeCoche() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="m2.8 7.4 2.7 2.7 5.7-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeLoupe() {
  return (
    <svg className="eva-tel__loupe" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.6 10.6 3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconeAlerte() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v3.4M7 9.6v.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * ATTENTION : ce fichier est recopie dans l'app DHIS2 (components/ControleTelephone.tsx, via
 * `npm run sync:telephone`). Il ne doit donc dependre que de react, de lib/telephone,
 * lib/drapeauxTelephone et styles/telephone.css, et rester compatible React 16 (pas de useId).
 *
 * Champ telephone : selecteur de pays (drapeau SVG embarque, recherche par
 * nom francais / indicatif / code ISO, navigation clavier) + saisie nationale
 * formatee par pays, avec validation en direct (libphonenumber-js). Voir
 * lib/telephone.ts pour toute la logique ; ce composant ne fait que la
 * presenter.
 *
 * Emet toujours du E.164 ("+22890123456") ou "" : meme format que celui que
 * le backend normalise et stocke (apps.core.telephone). Accepte en entree
 * aussi les anciens formats libres deja en base.
 *
 * Colle un numero complet ("+228 90 12 34 56", "0022890123456") : le pays est
 * detecte et le selecteur suit.
 */
export default function ChampTelephoneCorps({
  id,
  valeur,
  onChange,
  nom,
  disabled = false,
  lectureSeule = false,
  requis = false,
  validationNative = true,
  verrouille = false,
  paysDefaut = PAYS_DEFAUT,
  erreur,
  onValidite,
  placeholder,
  autoFocus = false
}: ProprietesChampTelephone) {
  const [etat, setEtat] = useState<EtatTelephone>(() => lireValeur(valeur, paysDefaut));
  const [touche, setTouche] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState("");
  const [indexActif, setIndexActif] = useState(0);
  const [drapeaux, setDrapeaux] = useState<Readonly<Record<string, string>> | null>(null);

  const racine = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const boutonPays = useRef<HTMLButtonElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const derniereValeurEmise = useRef<string | null | undefined>(valeur);
  const curseur = useRef<number | null>(null);

  const idListe = useIdentifiantUnique("eva-tel-liste");
  const idErreur = `${id}-erreur`;
  const interactif = !disabled && !lectureSeule;

  // Drapeaux : chunk charge a la demande, une seule fois pour toute l'app.
  useEffect(() => {
    let actif = true;
    chargerDrapeaux()
      .then((table) => {
        if (actif) setDrapeaux(table);
      })
      .catch(() => {
        // Sans drapeaux (chunk indisponible) : globe generique, le champ reste utilisable.
      });
    return () => {
      actif = false;
    };
  }, []);

  // Valeur modifiee de l'exterieur (reinitialisation, chargement d'un dossier) : on relit.
  useEffect(() => {
    // null/undefined/"" designent tous le vide : le parent peut convertir "" en null
    // sans que cela ne remette le pays choisi a zero.
    if ((valeur ?? "") === (derniereValeurEmise.current ?? "")) return;
    derniereValeurEmise.current = valeur;
    setEtat(lireValeur(valeur, paysDefaut));
  }, [valeur, paysDefaut]);

  const validation = useMemo(() => validerEtat(etat), [etat]);
  const vide = validation.code === "vide";
  const valide = validation.valide || (vide && !requis);

  useEffect(() => {
    onValidite?.(valide);
  }, [valide, onValidite]);

  // Validation native : fait echouer la soumission d'un <form> avec un message precis.
  const messageValidation = vide ? (requis ? validation.message : undefined) : validation.message;
  useEffect(() => {
    champ.current?.setCustomValidity(validationNative ? (messageValidation ?? "") : "");
  }, [messageValidation, validationNative]);

  // Un nombre de chiffres excessif est signale tout de suite ; le reste (trop court, invalide) apres sortie du champ.
  const erreurAffichee = erreur ?? (messageValidation && (touche || validation.code === "trop_long") ? messageValidation : undefined);
  const succes = !erreurAffichee && validation.valide;

  const pays = useMemo(() => listerPays(), []);
  const paysCourant: Pays | undefined = paysParIso(etat.iso);
  const resultats = useMemo(() => filtrerPays(pays, requete), [pays, requete]);
  const exemple = useMemo(() => exempleNational(etat.iso), [etat.iso]);

  const appliquer = useCallback(
    (suivant: EtatTelephone) => {
      const emise = versE164(suivant);
      if (verrouille) {
        // Verrouille : la tentative est signalee au parent (qui avertit l'agent) mais l'affichage ne change pas.
        onChange(emise);
        return;
      }
      setEtat(suivant);
      derniereValeurEmise.current = emise;
      onChange(emise);
    },
    [onChange, verrouille]
  );

  // Replace le curseur apres reformatage (sinon il saute en fin de champ a chaque espace insere).
  useLayoutEffect(() => {
    const position = curseur.current;
    curseur.current = null;
    const element = champ.current;
    if (position === null || !element || document.activeElement !== element) return;
    element.setSelectionRange(position, position);
  });

  function surSaisie(evenement: ChangeEvent<HTMLInputElement>) {
    const element = evenement.target;
    const natif = evenement.nativeEvent as InputEvent;
    const type = natif.inputType ?? "";
    const brut = element.value;
    const position = element.selectionStart ?? brut.length;
    const affichageAvant = formaterSaisie(etat);

    const collage =
      /^insert(FromPaste|FromDrop|ReplacementText)/.test(type) || brut.length - affichageAvant.length > 1 || (!type && brut.length > 1);

    let texte = brut;
    let chiffresAvantCurseur = nombreChiffresAvant(brut, position);

    // Suppression d'un simple separateur ("90 |12" puis Retour arriere) : sans
    // cela le reformatage retablirait l'espace et l'utilisateur ne pourrait plus reculer.
    if (type.startsWith("delete") && etat.partiel === undefined && brut.replace(/\D/g, "") === etat.chiffres && etat.chiffres) {
      const indice = type === "deleteContentForward" ? chiffresAvantCurseur : chiffresAvantCurseur - 1;
      if (indice >= 0 && indice < etat.chiffres.length) {
        texte = etat.chiffres.slice(0, indice) + etat.chiffres.slice(indice + 1);
        chiffresAvantCurseur = indice;
      }
    }

    const suivant = interpreterSaisie(texte, etat, collage);
    const affichage = formaterSaisie(suivant);
    curseur.current = collage || suivant.partiel !== undefined ? affichage.length : positionCurseur(affichage, chiffresAvantCurseur);
    appliquer(suivant);
  }

  const choisirPays = useCallback(
    (iso: CodeIso) => {
      setOuvert(false);
      setRequete("");
      // Les chiffres deja saisis sont conserves : seul l'indicatif change.
      appliquer(interpreterSaisie(etat.partiel !== undefined ? "" : etat.chiffres, { iso, chiffres: "" }, false));
      champ.current?.focus();
    },
    [appliquer, etat.chiffres, etat.partiel]
  );

  const ouvrir = useCallback(() => {
    if (!interactif) return;
    setRequete("");
    const index = pays.findIndex((p) => p.iso === etat.iso);
    setIndexActif(Math.max(0, index));
    setOuvert(true);
  }, [interactif, pays, etat.iso]);

  const fermer = useCallback((rendreFocus: boolean) => {
    setOuvert(false);
    setRequete("");
    if (rendreFocus) boutonPays.current?.focus();
  }, []);

  // A l'ouverture : focus sur la recherche et option courante visible.
  useEffect(() => {
    if (!ouvert) return;
    champRecherche.current?.focus();
    racine.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ouvert]);

  // Fermeture au clic / toucher en dehors du composant.
  useEffect(() => {
    if (!ouvert) return;
    function dehors(evenement: MouseEvent | TouchEvent) {
      if (racine.current && !racine.current.contains(evenement.target as Node)) fermer(false);
    }
    document.addEventListener("mousedown", dehors);
    document.addEventListener("touchstart", dehors);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("touchstart", dehors);
    };
  }, [ouvert, fermer]);

  // Garde l'option active visible dans la liste defilante.
  useEffect(() => {
    if (!ouvert) return;
    liste.current?.querySelector<HTMLElement>(`[data-index="${indexActif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ouvert, indexActif]);

  function surTouchesRecherche(evenement: KeyboardEvent<HTMLInputElement>) {
    const dernier = resultats.length - 1;
    switch (evenement.key) {
      case "ArrowDown":
        evenement.preventDefault();
        setIndexActif((i) => (i >= dernier ? 0 : i + 1));
        break;
      case "ArrowUp":
        evenement.preventDefault();
        setIndexActif((i) => (i <= 0 ? dernier : i - 1));
        break;
      case "Home":
        evenement.preventDefault();
        setIndexActif(0);
        break;
      case "End":
        evenement.preventDefault();
        setIndexActif(Math.max(0, dernier));
        break;
      case "Enter":
        evenement.preventDefault();
        if (resultats[indexActif]) choisirPays(resultats[indexActif].iso);
        break;
      case "Escape":
        evenement.preventDefault();
        evenement.stopPropagation();
        fermer(true);
        break;
      case "Tab":
        fermer(false);
        break;
    }
  }

  function surTouchesBouton(evenement: KeyboardEvent<HTMLButtonElement>) {
    if (evenement.key === "ArrowDown" || evenement.key === "ArrowUp") {
      evenement.preventDefault();
      ouvrir();
    }
  }

  const idOption = (index: number) => `${idListe}-${index}`;
  const sansRecherche = requete.trim() === "";
  const classes = [
    "eva-tel",
    erreurAffichee ? "eva-tel--erreur" : "",
    disabled ? "eva-tel--desactive" : "",
    lectureSeule ? "eva-tel--lecture" : "",
    verrouille ? "eva-tel--verrouille" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} ref={racine}>
      <div className="eva-tel__zone">
        <div className="eva-tel__controle">
          <button
            type="button"
            ref={boutonPays}
            className="eva-tel__pays"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={ouvert}
            aria-controls={ouvert ? idListe : undefined}
            aria-label={`Pays : ${paysCourant?.nom ?? etat.iso}, indicatif ${paysCourant?.indicatif ?? ""}. Changer de pays`}
            onClick={() => (ouvert ? fermer(false) : ouvrir())}
            onKeyDown={surTouchesBouton}
          >
            <img className="eva-tel__drapeau" src={urlDrapeau(drapeaux, etat.iso)} alt="" width={22} height={15} draggable={false} />
            <span className="eva-tel__indicatif">{paysCourant?.indicatif}</span>
            {interactif && <IconeChevron ouvert={ouvert} />}
          </button>

          <input
            ref={champ}
            id={id}
            name={nom}
            className="eva-tel__saisie"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus={autoFocus}
            value={formaterSaisie(etat)}
            placeholder={placeholder ?? exemple}
            disabled={disabled}
            readOnly={lectureSeule}
            required={requis && validationNative}
            maxLength={32}
            aria-invalid={erreurAffichee ? true : undefined}
            aria-describedby={erreurAffichee ? idErreur : undefined}
            onChange={surSaisie}
            onBlur={(evenement) => {
              // Ouvrir le selecteur de pays fait perdre le focus au champ sans que l'utilisateur ait fini : pas d'erreur prematuree.
              if (!racine.current?.contains(evenement.relatedTarget as Node | null)) setTouche(true);
            }}
          />

          {succes && (
            <span className="eva-tel__etat" title="Numéro valide">
              <IconeCoche />
            </span>
          )}
        </div>

        {ouvert && (
          <div className="eva-tel__panneau">
            <div className="eva-tel__recherche">
              <IconeLoupe />
              <input
                ref={champRecherche}
                className="eva-tel__recherche-champ"
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls={idListe}
                aria-activedescendant={resultats.length ? idOption(indexActif) : undefined}
                aria-autocomplete="list"
                aria-label="Rechercher un pays ou un indicatif"
                placeholder="Rechercher un pays ou un indicatif"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={requete}
                onChange={(e) => {
                  setRequete(e.target.value);
                  setIndexActif(0);
                }}
                onKeyDown={surTouchesRecherche}
              />
            </div>
            <ul className="eva-tel__liste" id={idListe} role="listbox" aria-label="Pays" ref={liste}>
              {resultats.length === 0 && (
                <li className="eva-tel__vide" role="presentation">
                  Aucun pays trouvé
                </li>
              )}
              {resultats.map((p, index) => {
                const precedent = resultats[index - 1];
                const entete =
                  sansRecherche && (!precedent || precedent.groupe !== p.groupe)
                    ? p.groupe === "afrique_ouest"
                      ? "Afrique de l'Ouest"
                      : "Autres pays"
                    : null;
                return (
                  <li key={p.iso} role="presentation" className="eva-tel__element">
                    {entete && <div className="eva-tel__groupe">{entete}</div>}
                    <div
                      id={idOption(index)}
                      data-index={index}
                      role="option"
                      aria-selected={p.iso === etat.iso}
                      className={`eva-tel__option${index === indexActif ? " eva-tel__option--actif" : ""}`}
                      onMouseEnter={() => setIndexActif(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choisirPays(p.iso)}
                    >
                      <img className="eva-tel__drapeau" src={urlDrapeau(drapeaux, p.iso)} alt="" width={22} height={15} draggable={false} />
                      <span className="eva-tel__option-nom">{p.nom}</span>
                      <span className="eva-tel__option-indicatif">{p.indicatif}</span>
                      {p.iso === etat.iso && (
                        <span className="eva-tel__option-coche">
                          <IconeCoche />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {erreurAffichee && (
        <div className="eva-tel__erreur" id={idErreur} role="alert">
          <IconeAlerte />
          <span>{erreurAffichee}</span>
        </div>
      )}
    </div>
  );
}
