import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, ClipboardCheck, Pencil } from "lucide-react";
import ChampDynamique from "./ChampDynamique";
import { Bouton } from "./ui";
import {
  champsManquants,
  estVide,
  formaterValeurChamp,
  lireEtapeMemorisee,
  memoriserEtape,
  planFormulaire,
  premiereEtapeIncomplete,
  valeurEffective,
  type EtapeRendue
} from "../lib/formulaire";
import type { ChampFormulaireEffectif, MiseEnPage } from "../types/domaine";

interface ProprietesFormulaireDossier {
  champs: ChampFormulaireEffectif[];
  /** Absente (ancien serveur, ancien cache hors-ligne) : liste plate. */
  miseEnPage?: MiseEnPage | null;
  /** Valeurs MODIFIEES par l'utilisateur, par code de champ (les autres affichent `valeur_actuelle`). */
  valeurs: Record<string, unknown>;
  onChange: (codeChamp: string, valeur: unknown) => void;
  /** Dossier verrouille par emission d'acte (voir ChampDynamique). */
  verrouille?: boolean;
  /**
   * Erreurs par code de champ (refus du serveur, controle du parent). En mode
   * etapes, l'apparition d'erreurs ramene a la premiere etape concernee et
   * place le focus sur le premier champ en erreur.
   */
  erreurs?: Record<string, string>;
  /** Affiche partout l'erreur "obligatoire" des champs obligatoires vides (ex: apres une tentative d'envoi). */
  afficherObligatoires?: boolean;
  /** Cle de memorisation de l'etape courante pendant la session (ex: id du dossier, code de completion). */
  cleMemorisation?: string;
  /**
   * Contenu du dernier pas (recapitulatif) : le bouton d'enregistrement ou
   * d'envoi de la page. Ignore en mode lineaire, ou la page garde son bouton.
   */
  actionFinale?: ReactNode;
  /**
   * Autorise le saut direct vers une etape ulterieure depuis l'en-tete sans
   * valider les etapes intermediaires (ecran d'un agent sur un dossier
   * existant). Le bouton "Suivant" valide toujours l'etape courante.
   */
  sautLibre?: boolean;
}

const MESSAGE_OBLIGATOIRE = "Ce champ est obligatoire.";

/** Premier controle saisissable d'un champ (le champ telephone, les chips... ne portent pas tous l'id sur un input). */
function focaliserChamp(racine: HTMLElement | null, code: string): boolean {
  if (!racine) return false;
  const conteneur = Array.from(racine.querySelectorAll<HTMLElement>("[data-champ]")).find(
    (element) => element.dataset.champ === code
  );
  const cible = conteneur?.querySelector<HTMLElement>(
    "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)"
  );
  if (!cible) return false;
  cible.focus({ preventScroll: true });
  cible.scrollIntoView({ block: "center", behavior: "auto" });
  return true;
}

function prefereMoinsDeMouvement(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Formulaire d'un dossier, tel que configure cote serveur (voir
 * docs/formulaires-etapes.md) :
 *  - mode lineaire (defaut) : la grille de champs, sans rien d'autre ;
 *  - mode etapes : un stepper (en-tete cliquable, description, Precedent /
 *    Suivant, progression, validation de l'etape avant de continuer,
 *    recapitulatif final qui porte `actionFinale`).
 *
 * Toutes les etapes restent MONTEES (masquees par `hidden`) et les valeurs
 * vivent chez le parent : changer d'etape ne fait jamais perdre une saisie.
 * La validation faite ici (champs obligatoires visibles, non readonly) n'est
 * qu'un confort : le serveur reste l'arbitre final.
 */
export default function FormulaireDossier({
  champs,
  miseEnPage,
  valeurs,
  onChange,
  verrouille = false,
  erreurs,
  afficherObligatoires = false,
  cleMemorisation,
  actionFinale,
  sautLibre = false
}: ProprietesFormulaireDossier) {
  const plan = useMemo(() => planFormulaire(champs, miseEnPage), [champs, miseEnPage]);
  const identifiant = useId().replace(/:/g, "");
  const racineRef = useRef<HTMLDivElement>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);

  const valeurDe = useCallback((champ: ChampFormulaireEffectif) => valeurEffective(champ, valeurs), [valeurs]);

  const nbEtapes = plan.etapes.length;
  const enEtapes = plan.mode === "etapes";
  const indiceRecap = nbEtapes; // dernier pas : recapitulatif
  const total = nbEtapes + 1;

  // Lecture brute (non bornee) : le plan peut changer apres le montage
  // (cache puis reponse serveur) ; la borne s'applique a l'usage.
  const [courante, setCourante] = useState(() => lireEtapeMemorisee(cleMemorisation, Number.MAX_SAFE_INTEGER));
  const indice = enEtapes ? Math.min(courante, total - 1) : 0;
  const [visitees, setVisitees] = useState<Set<number>>(() => new Set());
  const [tentees, setTentees] = useState<Set<number>>(() => new Set());
  const [focusChamp, setFocusChamp] = useState<string | null>(null);
  const [focusTitre, setFocusTitre] = useState(false);
  const [annonce, setAnnonce] = useState("");

  const erreurDe = useCallback(
    (champ: ChampFormulaireEffectif, tentee: boolean): string | undefined => {
      const externe = erreurs?.[champ.data_element_code];
      if (externe) return externe;
      if ((tentee || afficherObligatoires) && champ.obligatoire && !champ.readonly && estVide(valeurDe(champ))) {
        return MESSAGE_OBLIGATOIRE;
      }
      return undefined;
    },
    [erreurs, afficherObligatoires, valeurDe]
  );

  // ---- Navigation -----------------------------------------------------

  const aller = useCallback(
    (cible: number, focus: string | null = null) => {
      const borne = Math.max(0, Math.min(cible, total - 1));
      setCourante(borne);
      memoriserEtape(cleMemorisation, borne);
      setVisitees((precedent) => new Set(precedent).add(borne));
      if (focus) setFocusChamp(focus);
      else setFocusTitre(true);
      const racine = racineRef.current;
      if (racine && racine.getBoundingClientRect().top < 0) {
        racine.scrollIntoView({ block: "start", behavior: prefereMoinsDeMouvement() ? "auto" : "smooth" });
      }
    },
    [cleMemorisation, total]
  );

  const marquerTentees = useCallback((de: number, a: number) => {
    setTentees((precedent) => {
      const suivant = new Set(precedent);
      for (let i = de; i <= a; i++) suivant.add(i);
      return suivant;
    });
  }, []);

  function suivant() {
    if (!enEtapes || indice >= total - 1) return;
    const etape = plan.etapes[indice];
    const manquants = etape ? champsManquants(etape.champs, valeurDe) : [];
    if (manquants.length > 0) {
      marquerTentees(indice, indice);
      setFocusChamp(manquants[0].data_element_code);
      setAnnonce(`${manquants.length} champ${manquants.length > 1 ? "s" : ""} obligatoire${manquants.length > 1 ? "s" : ""} à renseigner.`);
      return;
    }
    aller(indice + 1);
  }

  function precedent() {
    if (indice > 0) aller(indice - 1);
  }

  function allerVers(cible: number) {
    if (cible === indice) return;
    if (cible < indice || sautLibre) return aller(cible);
    // Saut en avant : on ne saute pas par-dessus une etape incomplete.
    const bloquante = premiereEtapeIncomplete(plan.etapes, valeurDe, indice, cible - 1);
    if (bloquante === -1) return aller(cible);
    marquerTentees(indice, bloquante);
    const premier = champsManquants(plan.etapes[bloquante].champs, valeurDe)[0];
    aller(bloquante, premier?.data_element_code ?? null);
  }

  // Focus differe : il faut que l'etape cible soit affichee (attribut `hidden` retire) avant de focaliser.
  useEffect(() => {
    if (focusChamp) {
      focaliserChamp(racineRef.current, focusChamp);
      setFocusChamp(null);
    } else if (focusTitre) {
      titreRef.current?.focus({ preventScroll: true });
      setFocusTitre(false);
    }
  }, [focusChamp, focusTitre, indice]);

  useEffect(() => {
    if (enEtapes) setVisitees((precedent) => (precedent.has(indice) ? precedent : new Set(precedent).add(indice)));
  }, [enEtapes, indice]);

  // Erreurs venues du parent : aller au premier champ concerne. Seule une
  // NOUVELLE erreur declenche le deplacement (corriger un champ retire son
  // erreur : on ne doit pas sauter ailleurs pendant la saisie).
  const erreursVues = useRef<Set<string>>(new Set());
  useEffect(() => {
    const codes = Object.keys(erreurs ?? {}).filter((code) => erreurs?.[code]);
    const nouvelles = codes.filter((code) => !erreursVues.current.has(code));
    erreursVues.current = new Set(codes);
    if (!erreurs || nouvelles.length === 0) return;
    const parCode = new Map(champs.map((c) => [c.data_element_code, c]));
    if (enEtapes) {
      const enNouvelleErreur = (c: ChampFormulaireEffectif) => nouvelles.includes(c.data_element_code);
      const i = plan.etapes.findIndex((etape) => etape.champs.some(enNouvelleErreur));
      if (i >= 0) {
        const premier = plan.etapes[i].champs.find(enNouvelleErreur);
        aller(i, premier?.data_element_code ?? null);
        return;
      }
    }
    const premier = champs.find((c) => nouvelles.includes(c.data_element_code)) ?? parCode.get(nouvelles[0]);
    if (premier) setFocusChamp(premier.data_element_code);
    // Volontairement limite a `erreurs` : re-declencher a chaque frappe volerait le focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erreurs]);

  useEffect(() => {
    if (!enEtapes) return;
    const titre = indice === indiceRecap ? "Récapitulatif" : plan.etapes[indice]?.titre;
    setAnnonce(`Étape ${indice + 1} sur ${total} : ${titre ?? ""}`);
  }, [enEtapes, indice, indiceRecap, plan.etapes, total]);

  // ---- Clavier --------------------------------------------------------

  function surTouche(e: KeyboardEvent<HTMLDivElement>) {
    // Entree dans un champ = "Suivant", jamais un envoi premature du <form> de la page.
    if (!enEtapes || e.key !== "Enter" || e.defaultPrevented) return;
    const cible = e.target as HTMLElement;
    if (cible.tagName !== "INPUT" || cible.closest(".eva-tel__panneau")) return;
    const type = (cible as HTMLInputElement).type;
    if (type === "button" || type === "submit" || type === "reset") return;
    e.preventDefault();
    if (indice < indiceRecap) suivant();
  }

  function surToucheEntete(e: KeyboardEvent<HTMLElement>) {
    const touches = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!touches.includes(e.key)) return;
    const boutons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-etape]"));
    const position = boutons.findIndex((bouton) => bouton === document.activeElement);
    if (position < 0) return;
    e.preventDefault();
    let cible = position;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") cible = Math.max(0, position - 1);
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") cible = Math.min(boutons.length - 1, position + 1);
    else if (e.key === "Home") cible = 0;
    else cible = boutons.length - 1;
    boutons[cible].focus();
  }

  // ---- Rendu ----------------------------------------------------------

  function grille(etapeChamps: ChampFormulaireEffectif[], tentee: boolean) {
    return (
      <div className="eva-form-grille">
        {etapeChamps.map((champ) => (
          <ChampDynamique
            key={champ.data_element_code}
            champ={champ}
            valeur={valeurDe(champ)}
            onChange={onChange}
            verrouille={verrouille}
            erreur={erreurDe(champ, tentee)}
          />
        ))}
      </div>
    );
  }

  if (!enEtapes) {
    const seule = plan.etapes[0];
    return (
      <div className="eva-form" ref={racineRef}>
        {seule && (seule.titre || seule.description) && (
          <div className="eva-form__section">
            {seule.titre && <h2 className="eva-form__section-titre">{seule.titre}</h2>}
            {seule.description && <p className="eva-form__section-description">{seule.description}</p>}
          </div>
        )}
        {grille(plan.champs, false)}
      </div>
    );
  }

  const manquantsParEtape = plan.etapes.map((etape) => champsManquants(etape.champs, valeurDe));
  // Sur le recapitulatif, toutes les etapes sont passees en revue : celles qui
  // ont un obligatoire manquant passent en erreur, les autres sont terminees.
  const surRecap = indice === indiceRecap;
  const enErreur = plan.etapes.map(
    (etape, i) =>
      (surRecap && manquantsParEtape[i].length > 0) ||
      etape.champs.some((champ) => erreurDe(champ, tentees.has(i)) !== undefined)
  );
  const totalManquants = manquantsParEtape.reduce((somme, liste) => somme + liste.length, 0);
  const etapeCourante: EtapeRendue | undefined = plan.etapes[indice];
  const pourcentage = Math.round(((indice + 1) / total) * 100);
  const titreCourant = surRecap ? "Récapitulatif" : etapeCourante?.titre ?? "";
  const descriptionCourante = surRecap
    ? "Vérifiez les informations saisies avant de valider."
    : etapeCourante?.description ?? "";

  // Champs en erreur de l'etape courante (apres une tentative) : resume cliquable en haut de l'etape.
  const erreursEtape = !surRecap && etapeCourante
    ? etapeCourante.champs.filter((champ) => erreurDe(champ, tentees.has(indice)) !== undefined)
    : [];

  const idPanneau = (i: number) => `${identifiant}-panneau-${i}`;
  const idTitre = (i: number) => `${identifiant}-titre-${i}`;

  return (
    <div className="eva-form eva-etapes" ref={racineRef} onKeyDown={surTouche}>
      <nav className="eva-etapes__entete" aria-label="Étapes du formulaire" onKeyDown={surToucheEntete}>
        <ol>
          {Array.from({ length: total }, (_, i) => {
            const recap = i === indiceRecap;
            const titre = recap ? "Récapitulatif" : plan.etapes[i].titre;
            const courant = i === indice;
            const erreur = !courant && !recap && enErreur[i];
            const termine =
              !courant && !recap && !erreur && (visitees.has(i) || surRecap) && manquantsParEtape[i].length === 0;
            const etat = courant ? "courant" : erreur ? "erreur" : termine ? "termine" : "avenir";
            const libelleEtat =
              etat === "courant" ? "étape en cours" : etat === "erreur" ? "à corriger" : etat === "termine" ? "terminée" : "à venir";
            return (
              <li key={recap ? "recap" : plan.etapes[i].cle} className={`eva-etapes__item eva-etapes__item--${etat}`}>
                <button
                  type="button"
                  className="eva-etapes__bouton"
                  data-etape={i}
                  aria-current={courant ? "step" : undefined}
                  aria-controls={idPanneau(i)}
                  aria-label={`Étape ${i + 1} sur ${total} : ${titre}, ${libelleEtat}`}
                  title={titre}
                  onClick={() => allerVers(i)}
                >
                  <span className="eva-etapes__puce" aria-hidden="true">
                    {etat === "termine" ? (
                      <Check size={16} strokeWidth={3} />
                    ) : etat === "erreur" ? (
                      <AlertCircle size={17} strokeWidth={2.4} />
                    ) : recap ? (
                      <ClipboardCheck size={16} strokeWidth={2.4} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="eva-etapes__libelle">{titre}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="eva-etapes__progression">
        <span className="eva-etapes__compteur">
          Étape {indice + 1} sur {total}
        </span>
        <div
          className="eva-etapes__barre"
          role="progressbar"
          aria-label="Progression du formulaire"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pourcentage}
        >
          <span style={{ width: `${pourcentage}%` }} />
        </div>
      </div>

      <p className="eva-sr-seulement" aria-live="polite">
        {annonce}
      </p>

      <header className="eva-etapes__titre">
        <h2 id={idTitre(indice)} ref={titreRef} tabIndex={-1}>
          {titreCourant}
        </h2>
        {descriptionCourante && <p>{descriptionCourante}</p>}
      </header>

      {erreursEtape.length > 0 && (
        <div className="eva-etapes__alerte" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>
              {erreursEtape.length > 1
                ? `${erreursEtape.length} champs sont à compléter ou à corriger`
                : "1 champ est à compléter ou à corriger"}
            </strong>
            <ul>
              {erreursEtape.map((champ) => (
                <li key={champ.data_element_code}>
                  <button type="button" onClick={() => focaliserChamp(racineRef.current, champ.data_element_code)}>
                    {champ.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {plan.etapes.map((etape, i) => (
        <section
          key={etape.cle}
          id={idPanneau(i)}
          className="eva-etapes__panneau"
          hidden={i !== indice}
          aria-labelledby={i === indice ? idTitre(i) : undefined}
        >
          {grille(etape.champs, tentees.has(i))}
        </section>
      ))}

      <section
        id={idPanneau(indiceRecap)}
        className="eva-etapes__panneau"
        hidden={!surRecap}
        aria-labelledby={surRecap ? idTitre(indiceRecap) : undefined}
      >
        <Recapitulatif
          etapes={plan.etapes}
          valeurDe={valeurDe}
          manquantsParEtape={manquantsParEtape}
          totalManquants={totalManquants}
          onModifier={(i, code) => aller(i, code)}
        />
      </section>

      <div className={`eva-etapes__pied${surRecap ? " eva-etapes__pied--final" : ""}`}>
        {indice > 0 ? (
          <Bouton type="button" variante="secondaire" onClick={precedent} iconeGauche={<ChevronLeft size={16} />}>
            Précédent
          </Bouton>
        ) : (
          <span />
        )}
        {surRecap ? (
          actionFinale
        ) : (
          <Bouton type="button" onClick={suivant} iconeDroite={<ChevronRight size={16} />}>
            {indice === nbEtapes - 1 ? "Récapitulatif" : "Suivant"}
          </Bouton>
        )}
      </div>
    </div>
  );
}

interface ProprietesRecapitulatif {
  etapes: EtapeRendue[];
  valeurDe: (champ: ChampFormulaireEffectif) => unknown;
  manquantsParEtape: ChampFormulaireEffectif[][];
  totalManquants: number;
  onModifier: (indiceEtape: number, codeChamp: string | null) => void;
}

function Recapitulatif({ etapes, valeurDe, manquantsParEtape, totalManquants, onModifier }: ProprietesRecapitulatif) {
  return (
    <div className="eva-recap">
      {totalManquants > 0 ? (
        <div className="eva-etapes__bandeau eva-etapes__bandeau--alerte" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>
              {totalManquants > 1
                ? `${totalManquants} champs obligatoires ne sont pas renseignés`
                : "1 champ obligatoire n'est pas renseigné"}
            </strong>
            <ul>
              {etapes.flatMap((etape, i) =>
                manquantsParEtape[i].map((champ) => (
                  <li key={champ.data_element_code}>
                    <button type="button" onClick={() => onModifier(i, champ.data_element_code)}>
                      {champ.label}
                    </button>
                    <span className="eva-etapes__bandeau-etape"> ({etape.titre})</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="eva-etapes__bandeau eva-etapes__bandeau--ok" role="status">
          <Check size={18} strokeWidth={2.6} aria-hidden="true" />
          <div>
            <strong>Tous les champs obligatoires sont renseignés</strong>
          </div>
        </div>
      )}

      {etapes.map((etape, i) => (
        <section key={etape.cle} className="eva-recap__groupe">
          <div className="eva-recap__entete">
            <h3>
              <span className="eva-recap__numero">{i + 1}</span>
              {etape.titre}
            </h3>
            <button type="button" className="eva-recap__modifier" onClick={() => onModifier(i, null)}>
              <Pencil size={13} aria-hidden="true" /> Modifier
            </button>
          </div>
          <dl className="eva-recap__liste">
            {etape.champs.map((champ) => {
              const texte = formaterValeurChamp(champ, valeurDe(champ));
              const manquant = texte === null && champ.obligatoire && !champ.readonly;
              return (
                <div key={champ.data_element_code} className="eva-recap__ligne">
                  <dt>{champ.label}</dt>
                  <dd className={texte === null ? (manquant ? "eva-recap__manquant" : "eva-recap__vide") : undefined}>
                    {texte ?? (manquant ? "À renseigner" : "Non renseigné")}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
