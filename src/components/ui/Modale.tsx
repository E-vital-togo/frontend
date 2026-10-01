import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "./utilitaires";

interface ProprietesModale {
  titre: string;
  onFermer: () => void;
  /** Raccourci de `taille="large"`. */
  large?: boolean;
  /** petit (420px), moyen (480px, defaut) ou large (760px). */
  taille?: "petit" | "moyen" | "large";
  children: ReactNode;
  /** Boutons de pied de modale (alignes a droite, sur fond papier). */
  actions?: ReactNode;
  /** Texte d'introduction sous le titre. */
  description?: string;
  /** Fermer en cliquant sur le fond (defaut : oui). A desactiver pour un formulaire long. */
  fermerAuClicFond?: boolean;
  /** Masque la croix de fermeture (la fermeture reste possible par Echap, sauf si `onFermer` l'ignore). */
  masquerCroix?: boolean;
  /** Element a focaliser a l'ouverture (defaut : premier champ ou bouton du contenu). */
  refFocusInitial?: RefObject<HTMLElement>;
}

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pile des modales ouvertes : seule la plus haute reagit a Echap / au Tab
// (une confirmation ouverte au-dessus d'une modale ne doit pas fermer les deux).
const pile: symbol[] = [];
let verrousDefilement = 0;

function verrouillerDefilement() {
  if (verrousDefilement++ === 0) document.body.style.overflow = "hidden";
}
function deverrouillerDefilement() {
  if (--verrousDefilement <= 0) {
    verrousDefilement = 0;
    document.body.style.overflow = "";
  }
}

function elementsFocalisables(conteneur: HTMLElement): HTMLElement[] {
  return Array.from(conteneur.querySelectorAll<HTMLElement>(FOCALISABLES)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Boite de dialogue modale accessible : role="dialog", titre relie, focus
 * deplace dans la modale puis rendu a l'element declencheur, Tab pris au
 * piege, Echap et clic sur le fond pour fermer, defilement de la page fige.
 * Rendue dans un portail (document.body).
 */
export default function Modale({
  titre,
  onFermer,
  large,
  taille,
  children,
  actions,
  description,
  fermerAuClicFond = true,
  masquerCroix,
  refFocusInitial
}: ProprietesModale) {
  const identifiant = useId();
  const idTitre = `${identifiant}-titre`;
  const idDescription = `${identifiant}-description`;
  const refDialogue = useRef<HTMLDivElement>(null);
  const refCorps = useRef<HTMLDivElement>(null);
  const refFermer = useRef(onFermer);
  refFermer.current = onFermer;
  const tailleEffective = taille ?? (large ? "large" : "moyen");

  useEffect(() => {
    const dialogue = refDialogue.current;
    if (!dialogue) return;
    const jeton = Symbol("modale");
    pile.push(jeton);
    const declencheur = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    verrouillerDefilement();

    // Focus initial : sauf si un champ a deja pris le focus (autoFocus), premier controle du contenu
    if (!dialogue.contains(document.activeElement)) {
      const cible =
        refFocusInitial?.current ??
        (refCorps.current ? elementsFocalisables(refCorps.current)[0] : undefined) ??
        elementsFocalisables(dialogue).find((el) => !el.classList.contains("eva-modale__fermer")) ??
        dialogue;
      cible.focus();
    }

    function gererClavier(e: KeyboardEvent) {
      if (pile[pile.length - 1] !== jeton) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        refFermer.current();
        return;
      }
      if (e.key !== "Tab" || !dialogue) return;
      const liste = elementsFocalisables(dialogue);
      if (liste.length === 0) {
        e.preventDefault();
        dialogue.focus();
        return;
      }
      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      if (e.shiftKey && (document.activeElement === premier || document.activeElement === dialogue)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      } else if (!dialogue.contains(document.activeElement)) {
        e.preventDefault();
        premier.focus();
      }
    }
    document.addEventListener("keydown", gererClavier, true);

    return () => {
      document.removeEventListener("keydown", gererClavier, true);
      const index = pile.indexOf(jeton);
      if (index >= 0) pile.splice(index, 1);
      deverrouillerDefilement();
      // Rend le focus a l'element qui a ouvert la modale (s'il existe encore)
      if (declencheur && document.contains(declencheur)) declencheur.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="eva-modale-fond"
      onMouseDown={(e) => {
        if (fermerAuClicFond && e.target === e.currentTarget) onFermer();
      }}
    >
      <div
        ref={refDialogue}
        className={cx("eva-modale", tailleEffective !== "moyen" && `eva-modale--${tailleEffective}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        aria-describedby={description ? idDescription : undefined}
        tabIndex={-1}
      >
        <div className="eva-modale__entete">
          <div>
            <h2 className="eva-modale__titre" id={idTitre}>
              {titre}
            </h2>
            {description && (
              <p className="eva-modale__description" id={idDescription}>
                {description}
              </p>
            )}
          </div>
          {!masquerCroix && (
            <button type="button" className="eva-modale__fermer" onClick={onFermer} aria-label="Fermer la fenêtre">
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="eva-modale__corps" ref={refCorps}>
          {children}
        </div>
        {actions && <div className="eva-modale__actions">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}
