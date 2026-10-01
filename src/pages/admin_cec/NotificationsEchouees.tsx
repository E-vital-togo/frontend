import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BellRing, CheckCircle2, FileText, RefreshCw, TriangleAlert } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import {
  BarreOutils,
  Bouton,
  EnteteDePage,
  ItemMenu,
  ListeResponsive,
  PilulesFiltre,
  useConfirmation,
  useToast,
  type ColonneListe,
  type PiluleFiltre
} from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import MenuActionsLigne from "./MenuActionsLigne";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDateHeure, libelleEvenement, messageErreur } from "./outils";
import { listeDepuis, type ListeOuPaginee, type NotificationEchouee } from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";

type FiltreType = "" | NotificationEchouee["type"];
type FiltreEvenement = "" | "naissance" | "deces";

const LIBELLES_TYPE: Record<string, string> = {
  initiale: "Notification initiale",
  relance: "Relance",
  confirmation: "Confirmation"
};

const LIBELLES_CANAL: Record<string, string> = { sms: "SMS", whatsapp: "WhatsApp" };

export default function NotificationsEchouees() {
  const toast = useToast();
  const confirmer = useConfirmation();
  const navigate = useNavigate();
  const [parametresUrl, setParametresUrl] = useSearchParams();
  const evenementFiltre = (parametresUrl.get("event_type") || "") as FiltreEvenement;
  const [notifications, setNotifications] = useState<NotificationEchouee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreType, setFiltreType] = useState<FiltreType>("");
  const [enCoursId, setEnCoursId] = useState<string | null>(null);
  const [reessaiGroupeEnCours, setReessaiGroupeEnCours] = useState(false);

  function charger() {
    setChargement(true);
    setErreur(null);
    const parametres = new URLSearchParams();
    if (evenementFiltre) parametres.set("dossier__event_type", evenementFiltre);
    appelApi<ListeOuPaginee<NotificationEchouee>>(`/notifications-echouees/?${parametres.toString()}`)
      .then((donnees) => setNotifications(listeDepuis(donnees)))
      .catch((e) => setErreur(messageErreur(e, "Impossible de charger les notifications en échec.")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenementFiltre]);

  function changerEvenement(valeur: FiltreEvenement) {
    const suivants = new URLSearchParams(parametresUrl);
    if (valeur) suivants.set("event_type", valeur);
    else suivants.delete("event_type");
    setParametresUrl(suivants);
  }

  const decompte = useMemo(
    () => ({
      tous: notifications.length,
      initiale: notifications.filter((n) => n.type === "initiale").length,
      relance: notifications.filter((n) => n.type === "relance").length,
      confirmation: notifications.filter((n) => n.type === "confirmation").length
    }),
    [notifications]
  );

  const pilulesType: PiluleFiltre<FiltreType>[] = [
    { valeur: "", libelle: "Toutes", compteur: decompte.tous },
    { valeur: "initiale", libelle: "Initiales", compteur: decompte.initiale },
    { valeur: "relance", libelle: "Relances", compteur: decompte.relance },
    { valeur: "confirmation", libelle: "Confirmations", compteur: decompte.confirmation }
  ];

  const pilulesEvenement: PiluleFiltre<FiltreEvenement>[] = [
    { valeur: "", libelle: "Tous événements" },
    { valeur: "naissance", libelle: "Naissances" },
    { valeur: "deces", libelle: "Décès" }
  ];

  const notificationsAffichees = filtreType ? notifications.filter((n) => n.type === filtreType) : notifications;

  async function reessayerUne(notification: NotificationEchouee) {
    setEnCoursId(notification.id);
    try {
      await appelApi(`/notifications-echouees/${notification.id}/reessayer/`, { methode: "POST" });
      toast.succes("Nouvel envoi mis en file d'attente.");
      charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setEnCoursId(null);
    }
  }

  async function reessayerToutes() {
    const ok = await confirmer({
      titre: "Réessayer toutes les notifications en échec ?",
      description: `${compterAvecUnite(notifications.length, "notification")} seront de nouveau envoyées. Sans danger : un envoi déjà réussi entre-temps ne sera jamais dupliqué.`,
      libelleConfirmer: "Tout réessayer"
    });
    if (!ok) return;
    setReessaiGroupeEnCours(true);
    try {
      const resultat = await appelApi<{ tentees: number; erreurs: { message: string }[] }>(
        "/notifications-echouees/reessayer-en-masse/",
        { methode: "POST" }
      );
      if (resultat.erreurs.length > 0) {
        toast.erreur(`${resultat.tentees} relance(s) mise(s) en file, ${resultat.erreurs.length} erreur(s).`);
      } else {
        toast.succes(`${resultat.tentees} relance(s) mise(s) en file d'attente.`);
      }
      charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setReessaiGroupeEnCours(false);
    }
  }

  const colonnes: ColonneListe<NotificationEchouee>[] = [
    {
      id: "date",
      libelle: "Date",
      principale: true,
      nowrap: true,
      triable: true,
      valeurTri: (n) => new Date(n.created_at),
      rendu: (n) => <span className="texte-mono">{formaterDateHeure(n.created_at)}</span>
    },
    {
      id: "type",
      libelle: "Type",
      rendu: (n) => (
        <span className="eva-ac-identite__texte">
          <span>{LIBELLES_TYPE[n.type] || n.type}</span>
          <span className="eva-ac-identite__detail">{LIBELLES_CANAL[n.canal] || n.canal}</span>
        </span>
      )
    },
    { id: "evenement", libelle: "Événement", nowrap: true, rendu: (n) => libelleEvenement(n.dossier_event_type) },
    { id: "mairie", libelle: "Mairie", nowrap: true, rendu: (n) => n.dossier_mairie_nom || "-" },
    { id: "statut", libelle: "Statut du dossier", nowrap: true, rendu: (n) => <BadgeStatut statut={n.dossier_statut} /> },
    {
      id: "detail",
      libelle: "Détail de l'échec",
      largeur: "28%",
      rendu: (n) => (
        <span className="eva-ac-echec" title={n.contenu}>
          <TriangleAlert size={14} aria-hidden="true" />
          <span className="eva-ac-echec__texte">{n.contenu}</span>
        </span>
      )
    },
    {
      id: "actions",
      libelle: "Actions",
      actions: true,
      masquerLibelle: true,
      rendu: (n) => (
        <div className="eva-groupe-boutons">
          <Bouton
            variante="secondaire"
            taille="petit"
            onClick={() => reessayerUne(n)}
            chargement={enCoursId === n.id}
            disabled={enCoursId !== null || reessaiGroupeEnCours}
            iconeGauche={<RefreshCw size={14} />}
          >
            Réessayer
          </Bouton>
          <MenuActionsLigne ariaLabel={`Autres actions pour la notification du ${formaterDateHeure(n.created_at)}`}>
            <ItemMenu icone={FileText} vers={`/admin-cec/dossiers/${n.dossier}`}>
              Voir le dossier
            </ItemMenu>
          </MenuActionsLigne>
        </div>
      )
    }
  ];

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Notifications en échec"
        sousTitre="SMS ou WhatsApp qui n'ont pas pu être envoyés : ces déclarants n'ont pas reçu leur code et ne peuvent pas compléter leur dossier en ligne tant que ce n'est pas corrigé."
        actions={
          notifications.length > 0 && (
            <Bouton onClick={reessayerToutes} chargement={reessaiGroupeEnCours} disabled={enCoursId !== null} iconeGauche={<RefreshCw size={16} />}>
              Tout réessayer ({notifications.length})
            </Bouton>
          )
        }
      />

      <BarreOutils
        carte
        filtres={
          <>
            <PilulesFiltre ariaLabel="Filtrer par type de notification" valeur={filtreType} onChanger={setFiltreType} pilules={pilulesType} defilement />
            <PilulesFiltre ariaLabel="Filtrer par événement" valeur={evenementFiltre} onChanger={changerEvenement} pilules={pilulesEvenement} defilement />
          </>
        }
        compteur={!chargement && !erreur ? compterAvecUnite(notificationsAffichees.length, "notification") : undefined}
      />

      <ListeResponsive<NotificationEchouee>
        legende="Notifications en échec"
        lignes={notificationsAffichees}
        cle={(n) => n.id}
        colonnes={colonnes}
        chargement={chargement}
        erreur={erreur}
        onReessayer={charger}
        onLigneClic={(n) => navigate(`/admin-cec/dossiers/${n.dossier}`)}
        hauteurMax="none"
        vide={
          notifications.length === 0
            ? { icone: <CheckCircle2 size={26} />, titre: "Aucune notification en échec", description: "Tous les envois récents ont abouti." }
            : { icone: <BellRing size={26} />, titre: "Aucune notification de ce type", description: "Choisissez un autre type pour voir les autres échecs." }
        }
      />
    </MiseEnPage>
  );
}
