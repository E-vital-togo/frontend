import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CloudUpload, KeyRound, LogIn, Mail, MailCheck, ShieldCheck, WifiOff } from "lucide-react";
import ChampMotDePasse from "../../components/auth/ChampMotDePasse";
import EcranResultat from "../../components/auth/EcranResultat";
import { decrireErreur, type MessageErreur } from "../../components/auth/messagesAuth";
import { Alerte, Bouton, Champ, PageAuth } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { appelApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import { listerActionsEnAttente } from "../../lib/db";
import "../../styles/auth.css";

export default function PageConnexion() {
  const { demarrerConnexion } = useAuth();
  const navigate = useNavigate();
  const enLigne = useConnectivite();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [ecranMotDePasseOublie, setEcranMotDePasseOublie] = useState(false);
  const [actionsEnAttente, setActionsEnAttente] = useState(0);

  // Une session peut expirer alors que l'agent avait des saisies faites
  // hors connexion : elles restent dans la file locale (jamais videe par une
  // deconnexion, voir lib/db.ts) et repartiront a la reconnexion. On le dit
  // explicitement plutot que de laisser croire que le travail est perdu.
  useEffect(() => {
    listerActionsEnAttente()
      .then((actions) => setActionsEnAttente(actions.length))
      .catch(() => setActionsEnAttente(0));
  }, []);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await demarrerConnexion(email, motDePasse);
      // `envoyeLe` : instant d'envoi du code, pour le compte a rebours de validite de l'ecran suivant.
      navigate("/connexion/code", { state: { email, envoyeLe: Date.now() } });
    } catch (e) {
      setErreur(decrireErreur(e, "Connexion refusée", "Identifiants invalides."));
    } finally {
      setEnCours(false);
    }
  }

  if (ecranMotDePasseOublie) {
    return <FormulaireMotDePasseOublie onRetour={() => setEcranMotDePasseOublie(false)} />;
  }

  const message = (
    <>
      {erreur && (
        <Alerte variante={erreur.variante} titre={erreur.titre}>
          {erreur.message}
        </Alerte>
      )}
      {!enLigne && (
        <Alerte variante="avertissement" titre="Vous êtes hors ligne" icone={<WifiOff size={18} aria-hidden="true" />}>
          La connexion à votre compte nécessite internet. Rétablissez le réseau pour continuer.
        </Alerte>
      )}
      {actionsEnAttente > 0 && (
        <Alerte variante="info" icone={<CloudUpload size={18} aria-hidden="true" />}>
          {actionsEnAttente} action{actionsEnAttente > 1 ? "s enregistrées" : " enregistrée"} hors connexion{" "}
          {actionsEnAttente > 1 ? "sont conservées" : "est conservée"} sur cet appareil et {actionsEnAttente > 1 ? "seront synchronisées" : "sera synchronisée"} dès
          votre reconnexion.
        </Alerte>
      )}
    </>
  );

  return (
    <PageAuth
      titre="Connexion"
      description="Espace agent et administrateur de l'état civil"
      message={erreur || !enLigne || actionsEnAttente > 0 ? message : undefined}
      pied={
        <>
          <p className="eva-acces-pied__note">
            <ShieldCheck size={15} aria-hidden="true" />
            Double authentification : un code à 6 chiffres vous sera envoyé par email.
          </p>
          <p className="eva-acces-pied__lien">
            Vous êtes parent ou déclarant ? <Link to="/completion">Compléter ma déclaration</Link>
          </p>
        </>
      }
    >
      <form onSubmit={soumettre}>
        <Champ id="email" label="Adresse email" requis>
          <div className="eva-acces-groupe">
            <span className="eva-acces-groupe__icone" aria-hidden="true">
              <Mail size={17} />
            </span>
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              placeholder="nom@exemple.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </Champ>
        <ChampMotDePasse id="mot-de-passe" label="Mot de passe" requis autoComplete="current-password" placeholder="Votre mot de passe" valeur={motDePasse} onChange={setMotDePasse} />
        <div className="eva-acces-rangee-lien">
          <button type="button" className="eva-auth__lien" onClick={() => setEcranMotDePasseOublie(true)}>
            Mot de passe oublié ?
          </button>
        </div>
        <div className="eva-auth__actions">
          <Bouton type="submit" pleineLargeur chargement={enCours} iconeGauche={<LogIn size={17} />}>
            {enCours ? "Envoi du code..." : "Recevoir mon code de connexion"}
          </Bouton>
        </div>
      </form>
    </PageAuth>
  );
}

function FormulaireMotDePasseOublie({ onRetour }: { onRetour: () => void }) {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    try {
      await appelApi("/auth/mot-de-passe-oublie/demander", { methode: "POST", corps: { email } });
    } catch {
      // Message identique que la demande aboutisse ou non : evite de reveler si un email existe en base.
    } finally {
      setEnvoye(true);
      setEnCours(false);
    }
  }

  if (envoye) {
    return (
      <PageAuth>
        <EcranResultat
          ton="succes"
          icone={<MailCheck size={34} />}
          titre="Vérifiez votre messagerie"
          actions={
            <Bouton type="button" variante="secondaire" pleineLargeur onClick={onRetour}>
              Retour à la connexion
            </Bouton>
          }
        >
          <p>Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.</p>
          <p>Pensez à regarder dans vos courriers indésirables si vous ne voyez rien arriver.</p>
        </EcranResultat>
      </PageAuth>
    );
  }

  return (
    <PageAuth
      titre="Mot de passe oublié"
      description="Indiquez votre email professionnel : un lien de réinitialisation vous sera envoyé."
      icone={<KeyRound size={26} />}
      retour={{ libelle: "Retour à la connexion", onClick: onRetour }}
    >
      <form onSubmit={soumettre}>
        <Champ id="email-oublie" label="Adresse email" requis>
          <div className="eva-acces-groupe">
            <span className="eva-acces-groupe__icone" aria-hidden="true">
              <Mail size={17} />
            </span>
            <input
              id="email-oublie"
              type="email"
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              placeholder="nom@exemple.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </Champ>
        <div className="eva-auth__actions">
          <Bouton type="submit" pleineLargeur chargement={enCours}>
            Envoyer le lien
          </Bouton>
        </div>
      </form>
    </PageAuth>
  );
}
