import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, MessageSquareText, Phone, Search, ShieldCheck, WifiOff } from "lucide-react";
import ChampCode from "../../components/auth/ChampCode";
import EcranResultat from "../../components/auth/EcranResultat";
import EtapesParcours from "../../components/auth/EtapesParcours";
import { accentuer, decrireErreur, type MessageErreur } from "../../components/auth/messagesAuth";
import { useEcheance } from "../../components/auth/useEcheance";
import { Alerte, Bouton, Champ, ChampTelephone, LienBouton, PageAuth } from "../../components/ui";
import { appelApiPublic } from "../../lib/apiPublic";
import { useConnectivite } from "../../lib/connectivite";
import type { CodeRetraitTrouve } from "../../types/domaine";
import "../../styles/auth.css";

const LONGUEUR_CODE = 6;
/** Pause avant de pouvoir demander un nouveau SMS (evite les envois en rafale). */
const PAUSE_RENVOI_MS = 30_000;

export default function PageRetrouverCode() {
  const enLigne = useConnectivite();
  const [etape, setEtape] = useState<"telephone" | "code">("telephone");
  const [telephone, setTelephone] = useState("");
  const [codeVerification, setCodeVerification] = useState("");
  const [resultats, setResultats] = useState<CodeRetraitTrouve[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const [erreurCode, setErreurCode] = useState<string | undefined>();
  const [messageEnvoi, setMessageEnvoi] = useState<string | null>(null);
  const [renvoye, setRenvoye] = useState(false);
  const [finPause, setFinPause] = useState<number | null>(null);
  const pause = useEcheance(finPause);

  async function envoyerCode(): Promise<boolean> {
    setErreur(null);
    try {
      const donnees = await appelApiPublic<{ message: string }>("/codes-retrait/retrouver/demander-code", {
        method: "POST",
        body: JSON.stringify({ telephone })
      });
      setMessageEnvoi(donnees.message);
      setFinPause(Date.now() + PAUSE_RENVOI_MS);
      return true;
    } catch (e) {
      setErreur(decrireErreur(e, "Envoi impossible", "Erreur d'envoi du code."));
      return false;
    }
  }

  async function demanderCode(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    setRenvoye(false);
    if (await envoyerCode()) setEtape("code");
    setEnCours(false);
  }

  async function renvoyerCode() {
    setEnvoiEnCours(true);
    setRenvoye(false);
    setErreurCode(undefined);
    if (await envoyerCode()) {
      setCodeVerification("");
      setRenvoye(true);
    }
    setEnvoiEnCours(false);
  }

  async function verifierCode(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setResultats(null);
    if (codeVerification.length < LONGUEUR_CODE) {
      setErreurCode(`Saisissez les ${LONGUEUR_CODE} chiffres reçus par SMS.`);
      return;
    }
    setEnCours(true);
    try {
      const donnees = await appelApiPublic<CodeRetraitTrouve[]>("/codes-retrait/retrouver", {
        method: "POST",
        body: JSON.stringify({ telephone, code_verification: codeVerification })
      });
      setResultats(donnees);
    } catch (e) {
      const description = decrireErreur(e, "Vérification impossible", "Erreur de vérification.");
      if (description.variante === "erreur") setErreurCode(description.message);
      else setErreur(description);
    } finally {
      setEnCours(false);
    }
  }

  function changerDeNumero() {
    setEtape("telephone");
    setCodeVerification("");
    setErreur(null);
    setErreurCode(undefined);
    setRenvoye(false);
    setFinPause(null);
  }

  function recommencer() {
    setResultats(null);
    changerDeNumero();
  }

  const alertes = (
    <>
      {!enLigne && (
        <Alerte variante="avertissement" titre="Vous êtes hors ligne" icone={<WifiOff size={18} aria-hidden="true" />}>
          Rétablissez votre connexion internet pour continuer.
        </Alerte>
      )}
      {erreur && (
        <Alerte variante={erreur.variante} titre={erreur.titre}>
          {erreur.message}
        </Alerte>
      )}
    </>
  );

  // Etape 3 : aucun code pour ce numero
  if (resultats && resultats.length === 0) {
    return (
      <PageAuth>
        <EcranResultat
          ton="attention"
          icone={<Search size={34} />}
          titre="Aucun code trouvé"
          actions={
            <>
              <Bouton type="button" pleineLargeur onClick={recommencer}>
                Essayer un autre numéro
              </Bouton>
              <LienBouton to="/completion" variante="secondaire" pleineLargeur>
                Saisir un code
              </LienBouton>
            </>
          }
        >
          <p>Aucun code de retrait n'est associé à ce numéro de téléphone.</p>
          <p>Vérifiez que c'est bien le numéro indiqué lors de la déclaration, ou rendez-vous à la mairie avec une pièce d'identité.</p>
        </EcranResultat>
      </PageAuth>
    );
  }

  // Etape 3 : codes retrouves
  if (resultats) {
    return (
      <PageAuth
        titre={resultats.length > 1 ? "Voici vos codes de retrait" : "Voici votre code de retrait"}
        description="Utilisez-le pour compléter votre déclaration ou suivre son avancement."
        icone={<CheckCircle2 size={26} />}
        alignementHaut
      >
        <EtapesParcours actuelle={0} />
        <ul className="eva-acces-codes">
          {resultats.map((r) => (
            <li key={r.code} className="eva-acces-codes__item">
              <div className="eva-acces-codes__info">
                <span className="eva-acces-codes__etiquette">Code de retrait</span>
                <span className="eva-acces-codes__code texte-mono">{r.code}</span>
                <span className="eva-acces-codes__date">Déclaration du {new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="eva-acces-codes__actions">
                <LienBouton to={`/completion/${r.code}`} iconeGauche={<FileText size={16} />}>
                  Compléter
                </LienBouton>
                <LienBouton to={`/completion/statut/${r.code}`} variante="secondaire">
                  Voir le statut
                </LienBouton>
              </div>
            </li>
          ))}
        </ul>
        <div className="eva-auth__pied">
          <button type="button" className="eva-auth__lien" onClick={recommencer}>
            Rechercher avec un autre numéro
          </button>
        </div>
      </PageAuth>
    );
  }

  // Etape 2 : code recu par SMS
  if (etape === "code") {
    return (
      <PageAuth
        titre="Code reçu par SMS"
        icone={<MessageSquareText size={26} />}
        description={
          <>
            {accentuer(messageEnvoi || "Un code de vérification vient de vous être envoyé par SMS.")}
            <strong className="texte-mono eva-acces-bloc">{telephone}</strong>
          </>
        }
        retour={{ libelle: "Changer de numéro", onClick: changerDeNumero }}
        message={alertes}
      >
        <EtapesParcours actuelle={0} />
        {renvoye && (
          <Alerte variante="succes" compacte>
            Un nouveau code vient de vous être envoyé.
          </Alerte>
        )}
        <form onSubmit={verifierCode}>
          <ChampCode id="code_verification" label="Code de vérification (SMS)" libelleMasque valeur={codeVerification} onChange={(v) => { setCodeVerification(v); setErreurCode(undefined); }} longueur={LONGUEUR_CODE} autoFocus erreur={erreurCode} />
          <div className="eva-auth__actions">
            <Bouton type="submit" pleineLargeur chargement={enCours} iconeGauche={<ShieldCheck size={17} />}>
              Afficher mes codes
            </Bouton>
          </div>
        </form>
        <div className="eva-acces-renvoi">
          <Bouton type="button" variante="fantome" chargement={envoiEnCours} disabled={pause > 0} onClick={renvoyerCode}>
            {pause > 0 ? `Renvoyer le code dans ${pause} s` : "Renvoyer le code par SMS"}
          </Bouton>
        </div>
      </PageAuth>
    );
  }

  // Etape 1 : numero de telephone
  return (
    <PageAuth
      titre="J'ai perdu mon code"
      icone={<Phone size={26} />}
      description="Indiquez le numéro de téléphone utilisé lors de la déclaration. Un code de vérification vous sera envoyé par SMS."
      retour={{ libelle: "Saisir mon code", vers: "/completion" }}
      message={alertes}
      pied={
        <p className="eva-acces-pied__lien">
          Toujours bloqué ? Rendez-vous à la mairie avec une pièce d'identité, ou <Link to="/connexion">connectez-vous</Link> si vous êtes agent.
        </p>
      }
    >
      <EtapesParcours actuelle={0} />
      <form onSubmit={demanderCode}>
        <Champ id="telephone" label="Numéro de téléphone" requis>
          <ChampTelephone id="telephone" nom="telephone" requis valeur={telephone} onChange={setTelephone} />
        </Champ>
        <div className="eva-auth__actions">
          <Bouton type="submit" pleineLargeur chargement={enCours} iconeGauche={<Phone size={17} />}>
            Recevoir le code par SMS
          </Bouton>
        </div>
      </form>
    </PageAuth>
  );
}
