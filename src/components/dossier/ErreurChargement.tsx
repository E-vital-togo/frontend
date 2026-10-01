import { Alerte, Bouton } from "../ui";

interface ProprietesErreurChargement {
  titre: string;
  message: string;
  horsLigne: boolean;
  onReessayer: () => void;
}

/** Erreur durable d'un panneau chargé à la demande (historique, notifications, demandes). */
export default function ErreurChargement({ titre, message, horsLigne, onReessayer }: ProprietesErreurChargement) {
  return (
    <Alerte
      variante={horsLigne ? "avertissement" : "erreur"}
      titre={horsLigne ? `${titre} : connexion nécessaire` : titre}
      actions={
        <Bouton variante="secondaire" taille="petit" onClick={onReessayer}>
          Réessayer
        </Bouton>
      }
    >
      {horsLigne ? "Cette information n'est pas conservée sur l'appareil : reconnectez-vous pour la consulter." : message}
    </Alerte>
  );
}
