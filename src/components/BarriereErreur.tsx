import { Component, type ErrorInfo, type ReactNode } from "react";
import { classesBouton } from "./ui/Bouton";

const CLE_RECHARGEMENT = "recvit_rechargement_apres_mise_a_jour";

/**
 * Erreur de chargement d'un morceau de l'application : typiquement, une
 * nouvelle version vient d'être déployée et les fichiers de l'ancienne
 * n'existent plus sur le serveur.
 */
function estErreurDeChargement(erreur: unknown): boolean {
  const message = erreur instanceof Error ? `${erreur.name} ${erreur.message}` : String(erreur);
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

interface Etat {
  erreur: unknown;
}

/**
 * Dernier filet de l'application : jamais d'écran blanc. Après un
 * déploiement, un morceau introuvable déclenche un seul rechargement
 * automatique ; toute autre erreur affiche un message et un bouton pour
 * recharger. La file hors ligne (IndexedDB) n'est jamais touchée.
 */
export default class BarriereErreur extends Component<{ children: ReactNode }, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: unknown): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: unknown, info: ErrorInfo): void {
    console.error("Erreur d'affichage", erreur, info.componentStack);
    if (estErreurDeChargement(erreur)) {
      let dejaRecharge = false;
      try {
        dejaRecharge = sessionStorage.getItem(CLE_RECHARGEMENT) === "1";
        sessionStorage.setItem(CLE_RECHARGEMENT, "1");
      } catch {
        dejaRecharge = true;
      }
      if (!dejaRecharge) window.location.reload();
    }
  }

  componentDidMount(): void {
    try {
      sessionStorage.removeItem(CLE_RECHARGEMENT);
    } catch {
      // stockage indisponible : sans conséquence
    }
  }

  render(): ReactNode {
    if (this.state.erreur === null) return this.props.children;
    const miseAJour = estErreurDeChargement(this.state.erreur);
    return (
      <main role="alert" style={{ maxWidth: 560, margin: "15vh auto", padding: "0 16px", fontFamily: "inherit" }}>
        <h1 style={{ fontSize: "1.375rem", marginBottom: 12 }}>
          {miseAJour ? "Une nouvelle version de RECVIT est disponible" : "Un problème d'affichage est survenu"}
        </h1>
        <p style={{ marginBottom: 20, lineHeight: 1.5 }}>
          {miseAJour
            ? "Rechargez la page pour l'utiliser."
            : "Rechargez la page. Vos saisies faites hors ligne sont conservées sur ce poste."}
        </p>
        <button type="button" className={classesBouton("principal", "moyen")} onClick={() => window.location.reload()}>
          Recharger la page
        </button>
      </main>
    );
  }
}
