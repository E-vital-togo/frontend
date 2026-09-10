import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { Bouton, Champ } from "../../components/ui";
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
    <div className="eva-ecran-centre">
      <div className="eva-carte eva-ecran-centre__carte">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="symbole" hauteur={44} />
        </div>
        <h1 style={{ fontSize: 19, color: "var(--couleur-emeraude)", marginBottom: 4 }}>Code de connexion</h1>
        <p className="eva-sous-titre" style={{ marginBottom: 18 }}>
          Un code a ete envoye a <strong style={{ color: "var(--couleur-encre)" }}>{email}</strong>. Il expire dans
          quelques minutes.
        </p>
        {erreur && <div className="message-erreur">{erreur}</div>}
        <form onSubmit={soumettre}>
          <Champ id="code" label="Code recu par email" requis>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="texte-mono"
              style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: 20 }}
            />
          </Champ>
          <Bouton type="submit" chargement={enCours} style={{ width: "100%" }}>
            Valider
          </Bouton>
        </form>
      </div>
    </div>
  );
}
