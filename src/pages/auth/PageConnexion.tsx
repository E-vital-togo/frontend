import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";

export default function PageConnexion() {
  const { demarrerConnexion } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="carte" style={{ width: 360, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="vertical" hauteur={110} />
        </div>
        <h1 style={{ textAlign: "left", fontSize: 20, color: "var(--couleur-emeraude)" }}>Connexion agent</h1>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <form onSubmit={soumettre} style={{ textAlign: "left" }}>
          <div className="champ">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="mot-de-passe">Mot de passe</label>
            <input
              id="mot-de-passe"
              type="password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </div>
          <button type="submit" className="bouton-principal" style={{ width: "100%" }} disabled={enCours}>
            {enCours ? "Envoi en cours..." : "Recevoir mon code de connexion"}
          </button>
        </form>
      </div>
    </div>
  );
}
