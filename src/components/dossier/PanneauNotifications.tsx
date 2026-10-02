import { BellRing, BellOff, MessageSquareOff } from "lucide-react";
import { Alerte, Badge, Bouton, Carte, ListeResponsive } from "../ui";
import { useEtatCompletion } from "../../lib/etatCompletion";
import type { ColonneListe } from "../ui";
import ErreurChargement from "./ErreurChargement";
import { formaterDateHeure } from "./utilitaires";
import type { NotificationDossier } from "../../types/domaine";
import "../../styles/dossier.css";
import "../../styles/completion-desactivee.css";

const LIBELLES_TYPE: Record<string, string> = {
  initiale: "Notification initiale",
  relance: "Relance",
  confirmation: "Confirmation"
};

const STATUTS: Record<string, { libelle: string; variante: "succes" | "danger" | "attente" | "neutre"; detail?: string }> = {
  envoye: { libelle: "Envoyée", variante: "succes" },
  echec: { libelle: "Échec", variante: "danger" },
  en_attente: { libelle: "En attente", variante: "attente" },
  // Neutre, jamais rouge : un SMS volontairement coupe par l'administration n'est pas un echec.
  desactivee: { libelle: "Désactivée", variante: "neutre", detail: "Aucun SMS envoyé" }
};

const COLONNES: ColonneListe<NotificationDossier>[] = [
  {
    id: "date",
    libelle: "Date",
    principale: true,
    nowrap: true,
    rendu: (n) => <span className="texte-mono">{formaterDateHeure(n.created_at)}</span>
  },
  { id: "type", libelle: "Type", rendu: (n) => LIBELLES_TYPE[n.type] || n.type },
  { id: "canal", libelle: "Canal", rendu: (n) => (n.canal === "sms" ? "SMS" : "WhatsApp") },
  { id: "fournisseur", libelle: "Fournisseur", masquerMobile: true, rendu: (n) => n.fournisseur_utilise || "-" },
  {
    id: "statut",
    libelle: "Statut",
    rendu: (n) => {
      const statut = STATUTS[n.statut];
      return statut ? (
        <span className="eva-ci-statut" title={n.statut === "desactivee" ? n.contenu : undefined}>
          <Badge variante={statut.variante} point>
            {statut.libelle}
          </Badge>
          {statut.detail && <span className="eva-ci-statut__detail">{statut.detail}</span>}
        </span>
      ) : (
        n.statut
      );
    }
  }
];

interface ProprietesPanneauNotifications {
  notifications: NotificationDossier[] | null;
  erreur: string | null;
  horsLigne: boolean;
  onReessayer: () => void;
  peutRelancer: boolean;
  relanceEnCours: boolean;
  onRelancer: () => void;
}

export default function PanneauNotifications({
  notifications,
  erreur,
  horsLigne,
  onReessayer,
  peutRelancer,
  relanceEnCours,
  onRelancer
}: ProprietesPanneauNotifications) {
  const { active: completionActive } = useEtatCompletion();
  const nbEchecs = notifications?.filter((n) => n.statut === "echec").length ?? 0;
  const nbDesactivees = notifications?.filter((n) => n.statut === "desactivee").length ?? 0;
  // Completion parent coupee par l'administration : aucune relance possible (le serveur la refuse aussi).
  const boutonRelance = peutRelancer && (
    <Bouton
      variante="secondaire"
      taille="petit"
      onClick={onRelancer}
      chargement={relanceEnCours}
      disabled={!completionActive}
      aria-describedby={!completionActive ? "explication-relance-desactivee" : undefined}
      title={!completionActive ? "Relance indisponible : notifications désactivées par l'administration" : undefined}
      iconeGauche={!relanceEnCours && (completionActive ? <BellRing size={14} /> : <BellOff size={14} />)}
    >
      Relancer le déclarant
    </Bouton>
  );

  return (
    <Carte
      sansMarge
      titre="Notifications envoyées au déclarant"
      description="SMS et WhatsApp envoyés pour ce dossier, y compris les relances automatiques."
      actions={boutonRelance || undefined}
    >
      {erreur ? (
        <div className="eva-dd-panneau-corps">
          <ErreurChargement titre="Notifications indisponibles" message={erreur} horsLigne={horsLigne} onReessayer={onReessayer} />
        </div>
      ) : (
        <>
          {!completionActive && (
            <div className="eva-dd-panneau-corps">
              <Alerte variante="info" compacte>
                <span id="explication-relance-desactivee">
                  Les notifications et rappels sont désactivés par l'administration : aucun SMS n'est envoyé au déclarant et la relance manuelle est
                  indisponible. Le code de retrait reste valable au guichet.
                </span>
              </Alerte>
            </div>
          )}
          {nbDesactivees > 0 && completionActive && (
            <div className="eva-dd-panneau-corps">
              <Alerte variante="info" compacte>
                {nbDesactivees > 1
                  ? `${nbDesactivees} envois ont été désactivés par l'administration.`
                  : "Un envoi a été désactivé par l'administration."}{" "}
                Ce n'est pas un échec : aucun SMS n'est parti à ce moment-là.
              </Alerte>
            </div>
          )}
          {nbEchecs > 0 && (
            <div className="eva-dd-panneau-corps">
              <Alerte variante="avertissement" compacte>
                {nbEchecs > 1 ? `${nbEchecs} notifications n'ont pas pu être envoyées.` : "1 notification n'a pas pu être envoyée."}
              </Alerte>
            </div>
          )}
          <ListeResponsive<NotificationDossier>
            legende="Notifications du dossier"
            sansCadre
            sansSurvol
            hauteurMax="none"
            lignes={notifications ?? []}
            cle={(n) => n.id}
            chargement={notifications === null}
            vide={{
              titre: "Aucune notification envoyée",
              description: "Les notifications apparaîtront ici dès qu'un message sera envoyé au déclarant.",
              icone: <MessageSquareOff size={26} />
            }}
            colonnes={COLONNES}
          />
        </>
      )}
    </Carte>
  );
}
