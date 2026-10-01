import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cx } from "./utilitaires";

const ContexteMenu = createContext<{ fermer: () => void } | null>(null);

interface ProprietesMenuDeroulant {
  /** Contenu du bouton declencheur (icone, libelle...). */
  declencheur: ReactNode;
  /** Nom accessible du declencheur (obligatoire : souvent une icone seule). */
  ariaLabel: string;
  /** Classes du declencheur (defaut : petit bouton fantome carre, pour une icone "..." ). */
  classeDeclencheur?: string;
  /** Cote d'ancrage du panneau (defaut : droite). */
  alignement?: "droite" | "gauche";
  /** Classes ajoutees au panneau. */
  classePanneau?: string;
  /** Contenu du panneau : ItemMenu, SeparateurMenu... ou une fonction recevant `fermer`. */
  children: ReactNode | ((fermer: () => void) => ReactNode);
  /** Attributs du bouton declencheur. */
  declencheurProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className" | "type">;
  /** Appelee a l'ouverture (ex: rafraichir des compteurs). */
  onOuvrir?: () => void;
}

const MARGE = 8;

/**
 * Menu d'actions deroulant accessible (role="menu") : ouverture au clic ou
 * aux fleches, navigation aux fleches, Echap pour fermer (focus rendu au
 * declencheur), fermeture au clic exterieur. Le panneau est rendu dans un
 * portail en position fixe : il n'est jamais rogne par un tableau ou une
 * carte a defilement.
 */
export default function MenuDeroulant({
  declencheur,
  ariaLabel,
  classeDeclencheur = "eva-bouton eva-bouton--fantome eva-bouton--icone eva-bouton--petit",
  alignement = "droite",
  classePanneau,
  children,
  declencheurProps,
  onOuvrir
}: ProprietesMenuDeroulant) {
  const [ouvert, setOuvert] = useState(false);
  const refBouton = useRef<HTMLButtonElement>(null);
  const refPanneau = useRef<HTMLDivElement>(null);
  const idPanneau = useId();
  const ouvertParClavier = useRef(false);

  const fermer = useCallback((rendreFocus = true) => {
    setOuvert(false);
    if (rendreFocus) refBouton.current?.focus();
  }, []);

  const positionner = useCallback(() => {
    const bouton = refBouton.current;
    const panneau = refPanneau.current;
    if (!bouton || !panneau) return;
    const r = bouton.getBoundingClientRect();
    const p = panneau.getBoundingClientRect();
    let haut = r.bottom + 6;
    if (haut + p.height > window.innerHeight - MARGE && r.top - 6 - p.height >= MARGE) haut = r.top - 6 - p.height;
    let gauche = alignement === "droite" ? r.right - p.width : r.left;
    gauche = Math.max(MARGE, Math.min(gauche, window.innerWidth - p.width - MARGE));
    panneau.style.top = `${Math.max(MARGE, haut)}px`;
    panneau.style.left = `${gauche}px`;
  }, [alignement]);

  useLayoutEffect(() => {
    if (!ouvert) return;
    positionner();
    const panneau = refPanneau.current;
    if (!panneau) return;
    const items = panneau.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)');
    // Clavier : premier element du menu ; souris : le panneau lui-meme (pas de halo de focus parasite)
    if (ouvertParClavier.current) (items[0] ?? panneau).focus();
    else panneau.focus();
  }, [ouvert, positionner]);

  useEffect(() => {
    if (!ouvert) return;
    function clicExterieur(e: MouseEvent) {
      const cible = e.target as Node;
      if (refPanneau.current?.contains(cible) || refBouton.current?.contains(cible)) return;
      setOuvert(false);
    }
    const repositionner = () => positionner();
    document.addEventListener("mousedown", clicExterieur);
    window.addEventListener("resize", repositionner);
    window.addEventListener("scroll", repositionner, true);
    return () => {
      document.removeEventListener("mousedown", clicExterieur);
      window.removeEventListener("resize", repositionner);
      window.removeEventListener("scroll", repositionner, true);
    };
  }, [ouvert, positionner]);

  function ouvrir(parClavier: boolean) {
    ouvertParClavier.current = parClavier;
    setOuvert(true);
    onOuvrir?.();
  }

  function clavierDeclencheur(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouvert) ouvrir(true);
    }
  }

  function clavierPanneau(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fermer();
    } else if (e.key === "Tab") {
      fermer();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return (
    <>
      <button
        {...declencheurProps}
        ref={refBouton}
        type="button"
        className={classeDeclencheur}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idPanneau : undefined}
        onClick={() => (ouvert ? fermer(false) : ouvrir(false))}
        onKeyDown={clavierDeclencheur}
      >
        {declencheur}
      </button>
      {ouvert &&
        createPortal(
          <div
            ref={refPanneau}
            id={idPanneau}
            role="menu"
            aria-label={ariaLabel}
            tabIndex={-1}
            className={cx("eva-menu-deroulant", classePanneau)}
            onKeyDown={clavierPanneau}
          >
            <ContexteMenu.Provider value={{ fermer: () => fermer(true) }}>
              {typeof children === "function" ? children(() => fermer(true)) : children}
            </ContexteMenu.Provider>
          </div>,
          document.body
        )}
    </>
  );
}

interface ProprietesItemMenu {
  children: ReactNode;
  icone?: LucideIcon;
  /** Navigation react-router (rend un lien au lieu d'un bouton). */
  vers?: string;
  onClick?: () => void;
  /** Action destructive (texte rouge). */
  danger?: boolean;
  desactive?: boolean;
  /** Laisse le menu ouvert apres le clic (defaut : il se ferme). */
  garderOuvert?: boolean;
}

/** Element cliquable d'un MenuDeroulant : bouton, ou lien si `vers` est fourni. */
export function ItemMenu({ children, icone: Icone, vers, onClick, danger, desactive, garderOuvert }: ProprietesItemMenu) {
  const menu = useContext(ContexteMenu);
  const classes = cx("eva-menu-deroulant__item", danger && "eva-menu-deroulant__item--danger");
  const contenu = (
    <>
      {Icone && <Icone size={16} aria-hidden="true" />}
      <span className="eva-menu-deroulant__item-texte">{children}</span>
    </>
  );
  const apresClic = () => {
    onClick?.();
    if (!garderOuvert) menu?.fermer();
  };

  if (vers && !desactive) {
    return (
      <Link to={vers} role="menuitem" tabIndex={-1} className={classes} onClick={apresClic}>
        {contenu}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" tabIndex={-1} className={classes} disabled={desactive} onClick={apresClic}>
      {contenu}
    </button>
  );
}

export function SeparateurMenu() {
  return <hr className="eva-menu-deroulant__separateur" role="separator" />;
}

/** En-tete non cliquable d'un panneau (nom, adresse email, titre). */
export function EnteteMenu({ children }: { children: ReactNode }) {
  return (
    <div className="eva-menu-deroulant__entete" role="presentation">
      {children}
    </div>
  );
}
