import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./utilitaires";

export interface Onglet {
  id: string;
  libelle: string;
  /** Petit compteur affiche apres le libelle. */
  compteur?: number;
  icone?: ReactNode;
  desactive?: boolean;
}

interface ProprietesOnglets {
  onglets: Onglet[];
  actif: string;
  onChanger: (id: string) => void;
  /** "soulignes" (defaut) ou "pilules" (controle segmente). */
  variante?: "soulignes" | "pilules";
  /** Nom accessible de la liste d'onglets. */
  ariaLabel?: string;
  /**
   * Prefixe des identifiants : chaque onglet recoit `id="{prefixe}-{id}"` et
   * `aria-controls="{prefixe}-panneau-{id}"`. Donner le meme prefixe au panneau
   * (`role="tabpanel"`, `id`, `aria-labelledby`) ; en changer si plusieurs jeux d'onglets coexistent.
   */
  prefixeId?: string;
}

/** Onglets accessibles : fleches gauche/droite, Debut/Fin, un seul onglet dans l'ordre de tabulation. */
export default function Onglets({ onglets, actif, onChanger, variante = "soulignes", ariaLabel, prefixeId = "onglet" }: ProprietesOnglets) {
  const refListe = useRef<HTMLDivElement>(null);

  function gererClavier(evenement: KeyboardEvent<HTMLDivElement>) {
    const actifs = onglets.filter((o) => !o.desactive);
    const index = actifs.findIndex((o) => o.id === actif);
    let cible = -1;
    if (evenement.key === "ArrowRight") cible = (index + 1) % actifs.length;
    else if (evenement.key === "ArrowLeft") cible = (index - 1 + actifs.length) % actifs.length;
    else if (evenement.key === "Home") cible = 0;
    else if (evenement.key === "End") cible = actifs.length - 1;
    if (cible < 0 || actifs.length === 0) return;
    evenement.preventDefault();
    const suivant = actifs[cible];
    onChanger(suivant.id);
    refListe.current?.querySelector<HTMLElement>(`[data-onglet="${CSS.escape(suivant.id)}"]`)?.focus();
  }

  return (
    <div ref={refListe} className={cx("eva-onglets", variante === "pilules" && "eva-onglets--pilules")} role="tablist" aria-label={ariaLabel} onKeyDown={gererClavier}>
      {onglets.map((onglet) => {
        const selectionne = onglet.id === actif;
        return (
          <button
            key={onglet.id}
            type="button"
            role="tab"
            id={`${prefixeId}-${onglet.id}`}
            data-onglet={onglet.id}
            aria-selected={selectionne}
            aria-controls={`${prefixeId}-panneau-${onglet.id}`}
            tabIndex={selectionne ? 0 : -1}
            disabled={onglet.desactive}
            className={cx("eva-onglet", selectionne && "eva-onglet--actif")}
            onClick={() => onChanger(onglet.id)}
          >
            {onglet.icone}
            {onglet.libelle}
            {onglet.compteur !== undefined && <span className="eva-onglet__compteur">{onglet.compteur}</span>}
          </button>
        );
      })}
    </div>
  );
}
