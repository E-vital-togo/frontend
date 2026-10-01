import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, WifiOff } from "lucide-react";
import { decrireErreur, type MessageErreur } from "../../components/auth/messagesAuth";
import EtapesParcours from "../../components/auth/EtapesParcours";
import { Alerte, Bouton, Champ, LienBouton, PageAuth } from "../../components/ui";
import { useConnectivite } from "../../lib/connectivite";
import { appelApiPublic } from "../../lib/apiPublic";
import "../../styles/auth.css";

export default function PageCompletionAccueil() {
  const navigate = useNavigate();
  const enLigne = useConnectivite();
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<MessageErreur | null>(null);

  async function verifierEtContinuer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const codeSaisi = code.trim();
    if (!codeSaisi) return;
    setEnCours(true);
    setErreur(null);
    try {
      // Meme endpoint que PageStatutCompletion : on ne fait que verifier que
      // le code existe avant de rediriger, la validation complete du
      // formulaire est deja geree par PageCompletionParent (/completion/:code).
      await appelApiPublic(`/completion/statut/${encodeURIComponent(codeSaisi)}`);
      navigate(`/completion/${encodeURIComponent(codeSaisi)}`);
    } catch (e) {
      setErreur(decrireErreur(e, "Code non reconnu", "Code introuvable. Vérifiez la saisie."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <PageAuth
      titre="Compléter ma déclaration"
      description="Saisissez le code de retrait reçu par SMS pour accéder à votre dossier."
      message={
        <>
          {!enLigne && (
            <Alerte variante="avertissement" titre="Vous êtes hors ligne" icone={<WifiOff size={18} aria-hidden="true" />}>
              Rétablissez votre connexion internet pour accéder à votre dossier.
            </Alerte>
          )}
          {erreur && (
            <Alerte variante={erreur.variante} titre={erreur.titre}>
              {erreur.message}
            </Alerte>
          )}
        </>
      }
      pied={
        <p className="eva-acces-pied__lien">
          Vous êtes agent de la mairie ? <Link to="/connexion">Se connecter</Link>
        </p>
      }
    >
      <EtapesParcours actuelle={0} />
      <form onSubmit={verifierEtContinuer}>
        <Champ id="code" label="Code de retrait" requis aide="8 caractères : des lettres et des chiffres, par exemple A1B2C3D4.">
          <input
            id="code"
            className="eva-acces-entree-code"
            type="text"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="A1B2C3D4"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
        </Champ>
        <div className="eva-auth__actions">
          <Bouton type="submit" pleineLargeur chargement={enCours} iconeDroite={<ArrowRight size={17} />}>
            Continuer
          </Bouton>
        </div>
      </form>
      <div className="eva-acces-secours">
        <p>Vous n'avez plus votre code ?</p>
        <LienBouton to="/retrouver-mon-code" variante="secondaire" pleineLargeur iconeGauche={<KeyRound size={17} />}>
          J'ai perdu mon code
        </LienBouton>
      </div>
    </PageAuth>
  );
}
