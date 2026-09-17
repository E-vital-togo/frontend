import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { Bouton, ChargementPage, EnteteDePage, EtatVide, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import { useToast } from "../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { listeDepuis, type ListeOuPaginee, type NotificationEchouee } from "../../types/domaine";

const LIBELLES_TYPE: Record<string, string> = {
  initiale: "Notification initiale",
  relance: "Relance",
  confirmation: "Confirmation"
};

export default function NotificationsEchouees() {
  const toast = useToast();
  const confirmer = useConfirmation();
  const [parametresUrl] = useSearchParams();
  const evenementFiltre = parametresUrl.get("event_type") || "";
  const [notifications, setNotifications] = useState<NotificationEchouee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCoursId, setEnCoursId] = useState<string | null>(null);
  const [reessaiGroupeEnCours, setReessaiGroupeEnCours] = useState(false);

  function charger() {
    setChargement(true);
    const parametres = new URLSearchParams();
    if (evenementFiltre) parametres.set("dossier__event_type", evenementFiltre);
    appelApi<ListeOuPaginee<NotificationEchouee>>(`/notifications-echouees/?${parametres.toString()}`)
      .then((donnees) => setNotifications(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenementFiltre]);

  async function reessayerUne(notification: NotificationEchouee) {
    setEnCoursId(notification.id);
    try {
      await appelApi(`/notifications-echouees/${notification.id}/reessayer/`, { methode: "POST" });
      toast.succes("Nouvel envoi mis en file d'attente.");
      charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnCoursId(null);
    }
  }

  async function reessayerToutes() {
    const ok = await confirmer({
      titre: "Reessayer toutes les notifications en echec ?",
      description: `${notifications.length} notification(s) seront de nouveau envoyees. Sans danger : un envoi deja reussi entre-temps ne sera jamais duplique.`
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
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setReessaiGroupeEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Notifications en echec"
        sousTitre="SMS/WhatsApp qui n'ont pas pu etre envoyes : ces declarants n'ont pas recu leur code et ne peuvent pas completer leur dossier en ligne tant que ce n'est pas corrige."
        actions={
          notifications.length > 0 && (
            <Bouton onClick={reessayerToutes} chargement={reessaiGroupeEnCours} iconeGauche={<RefreshCw size={16} />}>
              Tout reessayer ({notifications.length})
            </Bouton>
          )
        }
      />

      {chargement ? (
        <ChargementPage />
      ) : notifications.length === 0 ? (
        <EtatVide
          icone={<CheckCircle2 size={28} />}
          titre="Aucune notification en echec"
          description="Tous les envois recents ont abouti."
        />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Evenement</th>
              <th>Mairie</th>
              <th>Statut du dossier</th>
              <th>Detail de l'echec</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id}>
                <td className="texte-mono">{new Date(n.created_at).toLocaleString("fr-FR")}</td>
                <td>{LIBELLES_TYPE[n.type] || n.type}</td>
                <td>{n.dossier_event_type === "naissance" ? "Naissance" : "Deces"}</td>
                <td>{n.dossier_mairie_nom}</td>
                <td>
                  <BadgeStatut statut={n.dossier_statut} />
                </td>
                <td className="eva-tableau__cellule-large" style={{ color: "var(--couleur-erreur)" }}>
                  <TriangleAlert size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  {n.contenu.length > 100 ? `${n.contenu.slice(0, 100)}...` : n.contenu}
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <Bouton
                    variante="fantome"
                    taille="petit"
                    onClick={() => reessayerUne(n)}
                    chargement={enCoursId === n.id}
                    iconeGauche={<RefreshCw size={13} />}
                  >
                    Reessayer
                  </Bouton>
                  <LienBouton to={`/admin-cec/dossiers/${n.dossier}`} variante="fantome" taille="petit">
                    Voir le dossier
                  </LienBouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </MiseEnPage>
  );
}
