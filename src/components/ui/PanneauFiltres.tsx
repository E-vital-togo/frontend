import type { ReactNode } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { cx } from "./utilitaires";
import "../../styles/panneau-filtres.css";

/** Un filtre actif, résumé en puce et retirable d'un clic. */
export interface PuceFiltre {
  cle: string;
  libelle: ReactNode;
  onRetirer: () => void;
}

interface ProprietesBouton {
  ouvert: boolean;
  onBasculer: () => void;
  nombreActifs: number;
  /** id du panneau piloté (aria-controls). */
  controle: string;
}

/** Bouton « Filtres » de la barre d'outils : ouvre / referme le panneau, affiche le nombre de filtres actifs. */
export function BoutonFiltres({ ouvert, onBasculer, nombreActifs, controle }: ProprietesBouton) {
  return (
    <button
      type="button"
      className={cx("eva-bouton-filtres", ouvert && "eva-bouton-filtres--ouvert", nombreActifs > 0 && "eva-bouton-filtres--actif")}
      aria-expanded={ouvert}
      aria-controls={controle}
      onClick={onBasculer}
    >
      <SlidersHorizontal size={16} aria-hidden="true" />
      <span>Filtres</span>
      {nombreActifs > 0 && (
        <span className="eva-bouton-filtres__compteur" aria-label={`${nombreActifs} filtre${nombreActifs > 1 ? "s" : ""} actif${nombreActifs > 1 ? "s" : ""}`}>
          {nombreActifs}
        </span>
      )}
      <ChevronDown size={15} aria-hidden="true" className="eva-bouton-filtres__chevron" />
    </button>
  );
}

interface ProprietesPanneau {
  id: string;
  ouvert: boolean;
  puces: PuceFiltre[];
  onToutEffacer: () => void;
  /** Rubriques du panneau (RubriqueFiltre). */
  children: ReactNode;
}

/**
 * Filtres secondaires d'une liste, repliés par défaut. Fermé, il ne prend
 * qu'une ligne - et seulement si des filtres sont actifs : leurs puces,
 * pour que rien ne soit filtré sans que cela se voie.
 */
export default function PanneauFiltres({ id, ouvert, puces, onToutEffacer, children }: ProprietesPanneau) {
  return (
    <>
      {ouvert && (
        <div id={id} className="eva-panneau-filtres" role="region" aria-label="Filtres de la liste">
          <div className="eva-panneau-filtres__grille">{children}</div>
          {puces.length > 0 && (
            <div className="eva-panneau-filtres__pied">
              <button type="button" className="eva-lien-filtres" onClick={onToutEffacer}>
                <RotateCcw size={14} aria-hidden="true" />
                Effacer ces filtres
              </button>
            </div>
          )}
        </div>
      )}
      {!ouvert && puces.length > 0 && (
        <div id={id} className="eva-puces-filtres" role="group" aria-label="Filtres actifs">
          {puces.map((p) => (
            <span key={p.cle} className="eva-puce-filtre">
              <span className="eva-puce-filtre__texte">{p.libelle}</span>
              <button type="button" className="eva-puce-filtre__retirer" onClick={p.onRetirer} aria-label="Retirer ce filtre">
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          {puces.length > 1 && (
            <button type="button" className="eva-lien-filtres" onClick={onToutEffacer}>
              Tout effacer
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Une rubrique du panneau : libellé au-dessus, contrôle(s) dessous.
 * `large` occupe toute la largeur ; `ajuste` garde la largeur de son contenu
 * (boutons-pilules qui ne doivent pas passer à la ligne).
 */
export function RubriqueFiltre({ libelle, large, ajuste, children }: { libelle: string; large?: boolean; ajuste?: boolean; children: ReactNode }) {
  return (
    <div className={cx("eva-rubrique-filtre", large && "eva-rubrique-filtre--large", ajuste && "eva-rubrique-filtre--ajuste")} role="group" aria-label={libelle}>
      <span className="eva-rubrique-filtre__libelle">{libelle}</span>
      {children}
    </div>
  );
}
