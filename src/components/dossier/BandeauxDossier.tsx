import { Link } from "react-router-dom";
import { Lock, WifiOff } from "lucide-react";
import DemandeCorrectionActe from "../DemandeCorrectionActe";
import { Alerte, Bouton } from "../ui";
import type { ChampFormulaireEffectif } from "../../types/domaine";
import "../../styles/dossier.css";

interface ProprietesBandeauHorsLigne {
  /** Lien vers l'écran de synchronisation (agent) ; absent pour un administrateur. */
  lienSynchronisation?: string;
}

/** Affiché quand le dossier vient de la copie locale de l'appareil. */
export function BandeauHorsLigne({ lienSynchronisation }: ProprietesBandeauHorsLigne) {
  return (
    <Alerte
      variante="avertissement"
      titre="Vous consultez la copie enregistrée sur cet appareil"
      icone={<WifiOff size={18} aria-hidden="true" />}
      className="eva-dd-bandeau"
    >
      Vos modifications seront placées en file d'attente, puis envoyées automatiquement au retour du réseau.
      {lienSynchronisation && (
        <>
          {" "}
          <Link to={lienSynchronisation} className="eva-lien">
            Voir les actions en attente
          </Link>
        </>
      )}
    </Alerte>
  );
}

interface ProprietesBandeauVerrou {
  idDossier: string;
  /** Seul l'agent peut déposer une demande de modification. */
  peutDemander: boolean;
  champs: ChampFormulaireEffectif[];
  demandesEnAttente: number;
  onDemandeEnvoyee: () => void;
  onVoirDemandes: () => void;
}

/** Dossier verrouillé par l'émission de l'acte : explique pourquoi et indique le chemin de correction. */
export function BandeauVerrou({ idDossier, peutDemander, champs, demandesEnAttente, onDemandeEnvoyee, onVoirDemandes }: ProprietesBandeauVerrou) {
  return (
    <Alerte
      variante="info"
      titre="Acte émis : ce dossier est verrouillé"
      icone={<Lock size={18} aria-hidden="true" />}
      className="eva-dd-bandeau"
      actions={
        <>
          {peutDemander && (
            <DemandeCorrectionActe idDossier={idDossier} champsPreCharges={champs} taille="moyen" onEnvoyee={onDemandeEnvoyee} />
          )}
          <Bouton variante="fantome" onClick={onVoirDemandes}>
            {demandesEnAttente > 0 ? `Suivre les demandes (${demandesEnAttente} en attente)` : "Suivre les demandes"}
          </Bouton>
        </>
      }
    >
      Les valeurs ne peuvent plus être modifiées directement.{" "}
      {peutDemander
        ? "Pour corriger une erreur, utilisez « Demander une modification » : la demande sera examinée par un administrateur."
        : "Une correction passe par une demande de modification déposée par l'agent d'état civil, puis validée par un administrateur."}
    </Alerte>
  );
}
