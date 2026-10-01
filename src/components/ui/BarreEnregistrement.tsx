import { useEffect } from "react";
import { Save } from "lucide-react";
import Bouton from "./Bouton";
import { cx } from "./utilitaires";

interface ProprietesBarreEnregistrement {
  /** Des modifications non enregistrees existent. */
  modifie: boolean;
  /** Enregistrement en cours : bouton en chargement, actions bloquees. */
  enregistrement?: boolean;
  /** Message d'erreur du dernier enregistrement (remplace l'etat). */
  erreur?: string | null;
  /** Clic sur "Enregistrer". Inutile si `typeEnregistrer="submit"` (le formulaire gere l'envoi). */
  onEnregistrer?: () => void;
  /** Clic sur "Annuler" : le bouton n'apparait que si cette fonction est fournie. */
  onAnnuler?: () => void;
  /** "submit" quand la barre est placee dans un <form>. Defaut "button". */
  typeEnregistrer?: "button" | "submit";
  libelleEnregistrer?: string;
  libelleAnnuler?: string;
  messageModifie?: string;
  messageInchange?: string;
  /** Desactive "Enregistrer" (ex: formulaire invalide). */
  desactiverEnregistrer?: boolean;
  /** N'affiche rien tant qu'il n'y a pas de modification. */
  masquerSiInchange?: boolean;
  /** Demande confirmation au navigateur avant de quitter la page avec des modifications non enregistrees. */
  avertirAvantDepart?: boolean;
  className?: string;
}

/**
 * Barre collante en bas de page pour les ecrans de parametrage :
 * "Modifications non enregistrees" + Annuler / Enregistrer.
 */
export default function BarreEnregistrement({
  modifie,
  enregistrement,
  erreur,
  onEnregistrer,
  onAnnuler,
  typeEnregistrer = "button",
  libelleEnregistrer = "Enregistrer",
  libelleAnnuler = "Annuler",
  messageModifie = "Modifications non enregistrées",
  messageInchange = "Aucune modification",
  desactiverEnregistrer,
  masquerSiInchange,
  avertirAvantDepart,
  className
}: ProprietesBarreEnregistrement) {
  useEffect(() => {
    if (!avertirAvantDepart || !modifie) return;
    const avertir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [avertirAvantDepart, modifie]);

  if (masquerSiInchange && !modifie && !erreur) return null;

  return (
    <div
      className={cx("eva-barre-enregistrement", modifie && "est-modifiee", erreur && "est-en-erreur", className)}
      role="region"
      aria-label="Enregistrement"
    >
      <div className="eva-barre-enregistrement__etat" role="status" aria-live="polite">
        {erreur ?? (modifie ? messageModifie : messageInchange)}
      </div>
      <div className="eva-barre-enregistrement__actions">
        {onAnnuler && (
          <Bouton type="button" variante="fantome" onClick={onAnnuler} disabled={!modifie || enregistrement}>
            {libelleAnnuler}
          </Bouton>
        )}
        <Bouton
          type={typeEnregistrer}
          onClick={typeEnregistrer === "button" ? onEnregistrer : undefined}
          chargement={enregistrement}
          disabled={!modifie || desactiverEnregistrer}
          iconeGauche={<Save size={16} aria-hidden="true" />}
        >
          {libelleEnregistrer}
        </Bouton>
      </div>
    </div>
  );
}
