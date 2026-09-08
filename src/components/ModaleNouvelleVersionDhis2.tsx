import { useState } from "react";
import type { NouvelleVersionDossier } from "../types/domaine";

function afficherValeur(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "(vide)";
  return String(valeur);
}

interface Props {
  nouvelleVersion: NouvelleVersionDossier;
  enCours: boolean;
  onAccepter: () => void;
  onRefuser: () => void;
  onFermer: () => void;
}

/**
 * Diff DHIS2 en attente sur un dossier deja cree (voir
 * apps.dossiers.models.NouvelleVersionDossier cote backend) : l'agent voit
 * uniquement les champs qui different reellement de la valeur actuelle du
 * dossier, jamais l'integralite du payload DHIS2.
 */
export default function ModaleNouvelleVersionDhis2({ nouvelleVersion, enCours, onAccepter, onRefuser, onFermer }: Props) {
  const [confirmationRefus, setConfirmationRefus] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={onFermer}
    >
      <div
        className="carte"
        style={{ maxWidth: 560, width: "90%", maxHeight: "80vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Modification disponible depuis DHIS2</h2>
        <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 14 }}>
          Une correction a ete faite sur cet evenement dans DHIS2 apres sa reception initiale. Voici les champs
          concernes : acceptez pour les appliquer au dossier, ou refusez pour garder le dossier tel quel.
        </p>

        {nouvelleVersion.champs_modifies.length === 0 ? (
          <p>Aucun champ mappe dans le catalogue n'est concerne par cette modification.</p>
        ) : (
          <table className="tableau-standard" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Champ</th>
                <th>Valeur actuelle</th>
                <th>Valeur proposee</th>
              </tr>
            </thead>
            <tbody>
              {nouvelleVersion.champs_modifies.map((champ) => (
                <tr key={champ.data_element_code}>
                  <td>{champ.label}</td>
                  <td className="texte-mono">{afficherValeur(champ.valeur_actuelle)}</td>
                  <td className="texte-mono">{afficherValeur(champ.valeur_proposee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {confirmationRefus ? (
          <div className="carte carte--avertissement" style={{ marginTop: 16 }}>
            <p style={{ marginTop: 0 }}>
              Le dossier restera inchange et cette proposition sera marquee refusee. Confirmer ?
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="bouton-secondaire" onClick={() => setConfirmationRefus(false)} disabled={enCours}>
                Annuler
              </button>
              <button className="bouton-principal" onClick={onRefuser} disabled={enCours}>
                {enCours ? "..." : "Confirmer le refus"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" }}>
            <button className="bouton-secondaire" onClick={onFermer} disabled={enCours}>
              Fermer
            </button>
            <button className="bouton-secondaire" onClick={() => setConfirmationRefus(true)} disabled={enCours}>
              Refuser
            </button>
            <button className="bouton-principal" onClick={onAccepter} disabled={enCours}>
              {enCours ? "..." : "Accepter"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
