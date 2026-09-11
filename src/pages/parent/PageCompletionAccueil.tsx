import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "../../components/Logo";
import { Bouton, Champ } from "../../components/ui";
import { appelApiPublic, ErreurApiPublique } from "../../lib/apiPublic";

export default function PageCompletionAccueil() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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
      setErreur(e instanceof ErreurApiPublique ? e.message : "Code introuvable. Verifiez la saisie.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="eva-ecran-centre">
      <div className="eva-carte" style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="vertical" hauteur={90} />
        </div>
        <h1 style={{ fontSize: 18, color: "var(--couleur-emeraude)", marginBottom: 4, textAlign: "center" }}>
          Completer ma declaration
        </h1>
        <p className="eva-sous-titre" style={{ marginBottom: 18, textAlign: "center" }}>
          Saisissez le code de retrait recu par SMS pour acceder a votre dossier.
        </p>

        <form onSubmit={verifierEtContinuer}>
          <Champ id="code" label="Code de retrait" requis>
            <input
              id="code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex. A1B2C3D4"
              className="texte-mono"
              autoCapitalize="characters"
            />
          </Champ>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <Bouton type="submit" chargement={enCours} style={{ width: "100%" }} iconeDroite={<ArrowRight size={16} />}>
            Continuer
          </Bouton>
        </form>

        <p style={{ marginTop: 16, textAlign: "center" }}>
          <Link to="/retrouver-mon-code" style={{ fontSize: 13, color: "var(--couleur-emeraude)" }}>
            J'ai perdu mon code
          </Link>
        </p>
      </div>
    </div>
  );
}
