import { useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { MessageSquareText, QrCode, ShieldCheck } from "lucide-react";
import ChampCode from "../auth/ChampCode";
import { decrireErreur, type MessageErreur } from "../auth/messagesAuth";
import { useEcheance } from "../auth/useEcheance";
import { Alerte, Bouton } from "../ui";
import { appelApiPublic } from "../../lib/apiPublic";

const LONGUEUR_CODE = 6;

interface ProprietesBloc {
  /** Code de retrait (dans l'URL de la page de suivi). */
  code: string;
  reference?: string;
  /** QR signé, vide quand il est verrouillé par un code SMS. */
  qrPayload?: string;
  otpRequis?: boolean;
  telephoneMasque?: string;
}

interface ReponseDemande {
  telephone_masque: string;
  delai_renvoi_secondes: number;
}

/**
 * QR code à présenter au guichet, sur la page de suivi du parent. Par défaut il s'affiche directement ; si
 * l'Administrateur Général l'exige, il ne s'affiche qu'après un code reçu par SMS au numéro du dossier.
 */
export default function BlocQrGuichet({ code, reference, qrPayload, otpRequis, telephoneMasque }: ProprietesBloc) {
  const [qrDeverrouille, setQrDeverrouille] = useState("");
  const [etape, setEtape] = useState<"inviter" | "code">("inviter");
  const [saisie, setSaisie] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const [erreurCode, setErreurCode] = useState<string | undefined>();
  const [numeroEnvoi, setNumeroEnvoi] = useState(telephoneMasque ?? "");
  const [finPause, setFinPause] = useState<number | null>(null);
  const pause = useEcheance(finPause);

  const qr = qrPayload || qrDeverrouille;

  async function demanderCode() {
    setEnvoiEnCours(true);
    setErreur(null);
    setErreurCode(undefined);
    try {
      const reponse = await appelApiPublic<ReponseDemande>(`/completion/statut/${code}/qr/demander-code`, { method: "POST", body: "{}" });
      setNumeroEnvoi(reponse.telephone_masque || numeroEnvoi);
      setFinPause(Date.now() + reponse.delai_renvoi_secondes * 1000);
      setSaisie("");
      setEtape("code");
    } catch (e) {
      setErreur(decrireErreur(e, "Envoi impossible", "Le SMS n'a pas pu être envoyé."));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function verifier(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (saisie.length < LONGUEUR_CODE) {
      setErreurCode(`Saisissez les ${LONGUEUR_CODE} chiffres reçus par SMS.`);
      return;
    }
    setVerificationEnCours(true);
    setErreur(null);
    try {
      const reponse = await appelApiPublic<{ qr_payload: string }>(`/completion/statut/${code}/qr/verifier`, {
        method: "POST",
        body: JSON.stringify({ code: saisie })
      });
      setQrDeverrouille(reponse.qr_payload);
    } catch (e) {
      const description = decrireErreur(e, "Vérification impossible", "Code incorrect ou expiré.");
      if (description.variante === "erreur") setErreurCode(description.message);
      else setErreur(description);
    } finally {
      setVerificationEnCours(false);
    }
  }

  const infos = (
    <dl className="eva-acces-qr__infos">
      <div>
        <dt>Code de retrait</dt>
        <dd className="texte-mono">{code}</dd>
      </div>
      {reference && (
        <div>
          <dt>N° de télédéclaration</dt>
          <dd className="texte-mono">{reference}</dd>
        </div>
      )}
    </dl>
  );

  if (!qr && !otpRequis) {
    return (
      <p className="eva-acces-rappel-code">
        Code de retrait : <strong className="texte-mono">{code}</strong>
      </p>
    );
  }

  return (
    <section className="eva-acces-qr" aria-labelledby="titre-qr-guichet">
      <h2 className="eva-acces-qr__titre" id="titre-qr-guichet">
        À présenter au guichet
      </h2>
      {qr ? (
        <>
          <div className="eva-acces-qr__image">
            <QRCodeSVG value={qr} size={208} level="M" includeMargin={false} role="img" aria-label="QR code de votre dossier" />
          </div>
          <p className="eva-acces-qr__aide">
            Montrez ce QR code à l'agent de la mairie : il retrouve votre dossier en le scannant. Munissez-vous aussi d'une pièce d'identité.
          </p>
        </>
      ) : etape === "inviter" ? (
        <>
          <p className="eva-acces-qr__aide">
            Pour protéger votre dossier, le QR code s'affiche après la saisie d'un code envoyé par SMS
            {numeroEnvoi ? (
              <>
                {" "}
                au <strong>{numeroEnvoi}</strong>
              </>
            ) : null}
            .
          </p>
          <div className="eva-acces-qr__actions">
            <Bouton type="button" chargement={envoiEnCours} iconeGauche={<MessageSquareText size={17} />} onClick={demanderCode}>
              Recevoir le code par SMS
            </Bouton>
          </div>
        </>
      ) : (
        <form onSubmit={verifier} className="eva-acces-qr__formulaire">
          <p className="eva-acces-qr__aide">
            Code envoyé{numeroEnvoi ? ` au ${numeroEnvoi}` : ""}. Il est valable 10 minutes.
          </p>
          <ChampCode
            id="code_qr"
            label="Code reçu par SMS"
            libelleMasque
            valeur={saisie}
            onChange={(v) => {
              setSaisie(v);
              setErreurCode(undefined);
            }}
            longueur={LONGUEUR_CODE}
            autoFocus
            erreur={erreurCode}
          />
          <div className="eva-acces-qr__actions">
            <Bouton type="submit" pleineLargeur chargement={verificationEnCours} iconeGauche={<QrCode size={17} />}>
              Afficher mon QR code
            </Bouton>
            <Bouton type="button" variante="fantome" chargement={envoiEnCours} disabled={pause > 0} iconeGauche={<ShieldCheck size={16} />} onClick={demanderCode}>
              {pause > 0 ? `Renvoyer le code dans ${pause} s` : "Renvoyer le code"}
            </Bouton>
          </div>
        </form>
      )}
      {erreur && (
        <Alerte variante={erreur.variante} titre={erreur.titre} compacte>
          {erreur.message}
        </Alerte>
      )}
      {infos}
    </section>
  );
}
