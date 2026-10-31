import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { Alerte, Badge, Bouton, Modale } from "../ui";
import { useConfirmation } from "../ui/ConfirmationProvider";
import { useToast } from "../ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { formaterDate } from "./utilitaires";
import type { NotificationCandidate, NotificationsDossier } from "../../types/domaine";
import "../../styles/dossier.css";

interface ProprietesRapprochement {
  idDossier: string;
  peutDecider: boolean;
  /** Change à chaque enregistrement du dossier : la recherche se refait en arrière-plan avec les nouvelles valeurs. */
  version: number;
}

function messageErreur(e: unknown): string {
  return e instanceof ErreurApi || e instanceof Error ? e.message : "Erreur inattendue.";
}

/** « Plus tard » : la fenêtre ne se rouvre pas d'elle-même pour ces propositions pendant la session. */
function cleReport(idDossier: string, candidats: NotificationCandidate[]): string {
  return `eva-notif-plus-tard:${idDossier}:${candidats.map((c) => c.id).sort().join(",")}`;
}

function ContenuNotification({ candidat }: { candidat: NotificationCandidate }) {
  const n = candidat.notification;
  return (
    <div className="eva-dd-liaison">
      <div className="eva-dd-liaison__entete">
        <div className="eva-dd-liaison__identite">
          <span className="eva-dd-liaison__nom">
            {n.event_type === "naissance" ? "Naissance" : "Décès"} notifiée par un agent de santé communautaire
          </span>
          <span className="eva-dd-liaison__meta">
            {n.formation_sanitaire || "Formation sanitaire inconnue"}
            {n.commune ? ` (${n.commune})` : ""}
          </span>
          <span className="eva-dd-liaison__meta">
            {n.date_evenement ? `Évènement du ${formaterDate(n.date_evenement)}` : "Date de l'évènement non renseignée"}
            {n.date_notification ? ` - notifié le ${formaterDate(n.date_notification)}` : ""}
          </span>
        </div>
        <div className="eva-dd-liaison__score">
          <span className="eva-dd-liaison__score-valeur">{candidat.score} %</span>
          <span className={`eva-dd-liaison__jauge${candidat.forte ? " eva-dd-liaison__jauge--forte" : ""}`} role="img" aria-label={`Correspondance : ${candidat.score} %`}>
            <span style={{ width: `${candidat.score}%` }} />
          </span>
          <Badge variante={candidat.forte ? "succes" : "attente"}>{candidat.forte ? "Correspondance forte" : "À vérifier"}</Badge>
        </div>
      </div>

      <div className="eva-dd-liaison__detail">
        <table>
          <caption>Tout le contenu de la notification</caption>
          <tbody>
            {n.valeurs.map((v) => (
              <tr key={v.code}>
                <th scope="row">{v.libelle}</th>
                <td>{v.valeur}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Référence DHIS2</th>
              <td className="eva-mono">{n.dhis2_event_uid}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="eva-dd-liaison__detail">
        <table>
          <caption>Comparaison avec ce dossier</caption>
          <thead>
            <tr>
              <th scope="col">Critère</th>
              <th scope="col">Ce dossier</th>
              <th scope="col">Notification</th>
              <th scope="col">Concordance</th>
            </tr>
          </thead>
          <tbody>
            {candidat.detail.map((c) => (
              <tr key={c.code}>
                <th scope="row">{c.libelle}</th>
                <td>{c.valeur_ce_dossier || "-"}</td>
                <td>{c.valeur_autre || "-"}</td>
                <td>{c.score === null ? <span className="eva-dd-liaison__neutre">Non comparé</span> : `${c.score} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Rapprochement d'un dossier avec une notification communautaire (apps.dedoublonnage) : quand une notification en
 * attente de la zone ressemble au dossier, une fenêtre s'ouvre d'elle-même pour demander à l'agent si c'est bien elle,
 * avec tout le contenu de la notification. Volontairement aucun écran listant les notifications.
 */
export default function RapprochementNotification({ idDossier, peutDecider, version }: ProprietesRapprochement) {
  const toast = useToast();
  const confirmer = useConfirmation();
  const [etat, setEtat] = useState<NotificationsDossier | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const [indice, setIndice] = useState(0);
  const [occupe, setOccupe] = useState(false);

  const appliquer = useCallback(
    (reponse: NotificationsDossier) => {
      setEtat(reponse);
      setIndice(0);
      const reporte = reponse.candidats.length > 0 && sessionStorage.getItem(cleReport(idDossier, reponse.candidats)) === "1";
      setOuverte(peutDecider && reponse.candidats.length > 0 && !reponse.liee && !reporte);
    },
    [idDossier, peutDecider]
  );

  useEffect(() => {
    let annule = false;
    appelApi<NotificationsDossier>(`/dossiers/${idDossier}/notifications-candidates`)
      .then((r) => !annule && appliquer(r))
      .catch(() => undefined); // fonction d'aide : une panne ne doit jamais gêner le dossier
    return () => {
      annule = true;
    };
  }, [idDossier, version, appliquer]);

  async function agir(chemin: string, succes?: string) {
    setOccupe(true);
    try {
      const reponse = await appelApi<NotificationsDossier>(`/dossiers/${idDossier}/notifications-candidates/${chemin}`, { methode: "POST" });
      setEtat(reponse);
      setIndice(0);
      if (reponse.liee || reponse.candidats.length === 0) setOuverte(false);
      if (succes) toast.succes(succes);
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  function plusTard() {
    if (etat) sessionStorage.setItem(cleReport(idDossier, etat.candidats), "1");
    setOuverte(false);
  }

  async function annuler(propositionId: string) {
    const ok = await confirmer({
      titre: "Annuler le rapprochement ?",
      description: "La notification redeviendra « en attente » et pourra être rapprochée d'un autre dossier.",
      libelleConfirmer: "Annuler le rapprochement",
      dangereux: true
    });
    if (ok) await agir(`${propositionId}/annuler`, "Rapprochement annulé.");
  }

  if (!etat || !etat.active) return null;

  if (etat.liee) {
    const n = etat.liee;
    const annulable = peutDecider && n.rapprochee_par_la_mairie && n.proposition_id && n.cloture_dhis2_statut !== "envoyee";
    return (
      <Alerte
        variante="succes"
        titre="Notification communautaire rapprochée"
        icone={<BellRing size={18} aria-hidden="true" />}
        actions={
          annulable ? (
            <Bouton variante="secondaire" taille="petit" onClick={() => annuler(n.proposition_id as string)} disabled={occupe} iconeGauche={<RotateCcw size={14} />}>
              Annuler
            </Bouton>
          ) : undefined
        }
      >
        Notifiée par {n.formation_sanitaire || "un agent de santé communautaire"}
        {n.date_evenement ? ` (évènement du ${formaterDate(n.date_evenement)})` : ""}.
        {n.cloture_dhis2 ? ` Clôture dans DHIS2 : ${n.cloture_dhis2.toLowerCase()}.` : ""}
      </Alerte>
    );
  }

  if (etat.candidats.length === 0) return null;
  const candidat = etat.candidats[Math.min(indice, etat.candidats.length - 1)];
  const total = etat.candidats.length;

  return (
    <>
      {!ouverte && (
        <Alerte
          variante="info"
          titre={total > 1 ? `${total} notifications communautaires correspondent peut-être à ce dossier` : "Une notification communautaire correspond peut-être à ce dossier"}
          icone={<BellRing size={18} aria-hidden="true" />}
          actions={
            peutDecider ? (
              <Bouton variante="secondaire" taille="petit" onClick={() => setOuverte(true)}>
                Voir la notification
              </Bouton>
            ) : undefined
          }
        >
          Un agent de santé communautaire a signalé un évènement qui ressemble à ce dossier.
        </Alerte>
      )}
      {ouverte && (
        <Modale
          titre="Est-ce cette notification ?"
          description={`Un agent de santé communautaire a signalé un évènement qui ressemble à ce dossier${total > 1 ? ` (proposition ${indice + 1} sur ${total})` : ""}. Vérifiez avant de confirmer.`}
          taille="large"
          onFermer={plusTard}
          fermerAuClicFond={false}
          actions={
            <>
              {total > 1 && (
                <>
                  <Bouton variante="fantome" onClick={() => setIndice((i) => (i - 1 + total) % total)} disabled={occupe} iconeGauche={<ChevronLeft size={16} />}>
                    Précédente
                  </Bouton>
                  <Bouton variante="fantome" onClick={() => setIndice((i) => (i + 1) % total)} disabled={occupe} iconeGauche={<ChevronRight size={16} />}>
                    Suivante
                  </Bouton>
                </>
              )}
              <Bouton variante="fantome" onClick={plusTard} disabled={occupe}>
                Plus tard
              </Bouton>
              <Bouton variante="secondaire" onClick={() => agir(`${candidat.id}/ecarter`, "Noté : ce n'est pas cette notification.")} disabled={occupe} iconeGauche={<X size={16} />}>
                Ce n'est pas elle
              </Bouton>
              <Bouton onClick={() => agir(`${candidat.id}/confirmer`, "Notification rapprochée de ce dossier.")} chargement={occupe} iconeGauche={<Check size={16} />}>
                Oui, c'est cette notification
              </Bouton>
            </>
          }
        >
          <ContenuNotification candidat={candidat} />
        </Modale>
      )}
    </>
  );
}
