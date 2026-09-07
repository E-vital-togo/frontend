import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";
import type { Role } from "../../types/domaine";

const DESTINATION_PAR_ROLE: Partial<Record<Role, string>> = {
  agent_cec: "/agent",
  admin_cec: "/admin-cec"
};

interface EtatConnexion {
  email: string;
}

export default function PageVerifierCode() {
  const { validerCode } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const etat = state as EtatConnexion | null;
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (!etat?.email) {
    navigate("/connexion", { replace: true });
    return null;
  }
  const email = etat.email;

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const utilisateur = await validerCode(email, code);
      navigate(DESTINATION_PAR_ROLE[utilisateur.role] || "/", { replace: true });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Code invalide ou expire.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="carte" style={{ width: 360 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="symbole" hauteur={44} />
        </div>
        <h1 style={{ fontSize: 20, color: "var(--couleur-emeraude)" }}>Code de connexion</h1>
        <p style={{ fontSize: 13, color: "var(--couleur-gris-service-2)" }}>
          Un code a ete envoye a {email}. Il expire dans quelques minutes.
        </p>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <form onSubmit={soumettre}>
          <div className="champ">
            <label htmlFor="code">Code recu par email</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="texte-mono"
            />
          </div>
          <button type="submit" className="bouton-principal" style={{ width: "100%" }} disabled={enCours}>
            {enCours ? "Verification..." : "Valider"}
          </button>
        </form>
      </div>
    </div>
  );
}
