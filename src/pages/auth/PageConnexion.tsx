import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import Logo from "../../components/Logo";
import { Bouton, Champ } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { appelApi } from "../../lib/apiClient";
import { listerActionsEnAttente } from "../../lib/db";

export default function PageConnexion() {
  const { demarrerConnexion } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
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
      navigate("/connexion/code", { state: { email } });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Identifiants invalides.");
    } finally {
      setEnCours(false);
    }
  }

  if (ecranMotDePasseOublie) {
    return <FormulaireMotDePasseOublie onRetour={() => setEcranMotDePasseOublie(false)} />;
  }

  return (
    <div className="eva-ecran-centre">
      <div className="eva-carte eva-ecran-centre__carte">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Logo variante="vertical" hauteur={100} />
        </div>
        <h1 style={{ fontSize: 19, color: "var(--couleur-emeraude)", marginBottom: 4 }}>Connexion</h1>
        <p className="eva-sous-titre" style={{ marginBottom: 18 }}>Espace agent et administrateur de l'etat civil</p>
        {erreur && <div className="message-erreur">{erreur}</div>}
        {actionsEnAttente > 0 && (
          <div
            style={{
              fontSize: 12.5,
              background: "rgba(11,122,87,0.08)",
              color: "var(--couleur-emeraude)",
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 14
            }}
          >
            {actionsEnAttente} action{actionsEnAttente > 1 ? "s" : ""} enregistree{actionsEnAttente > 1 ? "s" : ""} hors
            connexion {actionsEnAttente > 1 ? "sont conservees" : "est conservee"} sur cet appareil et
            {actionsEnAttente > 1 ? " seront synchronisees" : " sera synchronisee"} des votre reconnexion.
          </div>
        )}
        <form onSubmit={soumettre}>
          <Champ id="email" label="Email" requis>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Champ>
          <Champ id="mot-de-passe" label="Mot de passe" requis>
            <input
              id="mot-de-passe"
              type="password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </Champ>
          <Bouton type="submit" chargement={enCours} style={{ width: "100%" }} iconeGauche={!enCours && <LogIn size={16} />}>
            {enCours ? "Envoi en cours..." : "Recevoir mon code de connexion"}
          </Bouton>
        </form>
        <button
          type="button"
          onClick={() => setEcranMotDePasseOublie(true)}
          style={{ background: "none", border: "none", color: "var(--couleur-gris-service-2)", fontSize: 12.5, marginTop: 16, cursor: "pointer", width: "100%", textAlign: "center" }}
        >
          Mot de passe oublie ?
        </button>
      </div>
    </div>
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

  return (
    <div className="eva-ecran-centre">
      <div className="eva-carte eva-ecran-centre__carte">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Logo variante="symbole" hauteur={44} />
        </div>
        <h1 style={{ fontSize: 18, color: "var(--couleur-emeraude)", marginBottom: 10 }}>Mot de passe oublie</h1>
        {envoye ? (
          <p style={{ fontSize: 14 }}>
            Si un compte existe avec cet email, un lien de reinitialisation vient de lui etre envoye. Verifiez votre
            messagerie.
          </p>
        ) : (
          <form onSubmit={soumettre}>
            <p className="eva-sous-titre" style={{ marginBottom: 14 }}>
              Indiquez votre email professionnel : un lien de reinitialisation vous sera envoye.
            </p>
            <Champ id="email-oublie" label="Email" requis>
              <input id="email-oublie" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Champ>
            <Bouton type="submit" chargement={enCours} style={{ width: "100%" }}>
              Envoyer le lien
            </Bouton>
          </form>
        )}
        <Link to="#" onClick={onRetour} style={{ display: "block", textAlign: "center", fontSize: 12.5, color: "var(--couleur-gris-service-2)", marginTop: 16 }}>
          Retour a la connexion
        </Link>
      </div>
    </div>
  );
}
