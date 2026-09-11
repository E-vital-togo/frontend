import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Phone, Search, ShieldCheck } from "lucide-react";
import Logo from "../../components/Logo";
import { Bouton, Champ } from "../../components/ui";
import { appelApiPublic, ErreurApiPublique } from "../../lib/apiPublic";
import type { CodeRetraitTrouve } from "../../types/domaine";

export default function PageRetrouverCode() {
  const [etape, setEtape] = useState<"telephone" | "code">("telephone");
  const [telephone, setTelephone] = useState("");
  const [codeVerification, setCodeVerification] = useState("");
  const [resultats, setResultats] = useState<CodeRetraitTrouve[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [messageEnvoi, setMessageEnvoi] = useState<string | null>(null);

  async function demanderCode(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      const donnees = await appelApiPublic<{ message: string }>("/codes-retrait/retrouver/demander-code", {
        method: "POST",
        body: JSON.stringify({ telephone })
      });
      setMessageEnvoi(donnees.message);
      setEtape("code");
    } catch (e) {
      setErreur(e instanceof ErreurApiPublique ? e.message : "Erreur d'envoi du code.");
    } finally {
      setEnCours(false);
    }
  }

  async function verifierCode(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);
    setResultats(null);
    try {
      const donnees = await appelApiPublic<CodeRetraitTrouve[]>("/codes-retrait/retrouver", {
        method: "POST",
        body: JSON.stringify({ telephone, code_verification: codeVerification })
      });
      setResultats(donnees);
    } catch (e) {
      setErreur(e instanceof ErreurApiPublique ? e.message : "Erreur de verification.");
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
        <h1 style={{ fontSize: 18, color: "var(--couleur-emeraude)", marginBottom: 4, textAlign: "center" }}>J'ai perdu mon code</h1>

        {etape === "telephone" && (
          <>
            <p className="eva-sous-titre" style={{ marginBottom: 18, textAlign: "center" }}>
              Indiquez le numero de telephone utilise lors de la declaration. Un code de verification vous sera envoye par SMS.
            </p>
            <form onSubmit={demanderCode}>
              <Champ id="telephone" label="Numero de telephone" requis>
                <input id="telephone" type="tel" required value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex. 90112233" />
              </Champ>
              {erreur && <div className="message-erreur">{erreur}</div>}
              <Bouton type="submit" chargement={enCours} style={{ width: "100%" }} iconeGauche={<Phone size={16} />}>
                Recevoir le code par SMS
              </Bouton>
            </form>
          </>
        )}

        {etape === "code" && (
          <>
            <p className="eva-sous-titre" style={{ marginBottom: 18, textAlign: "center" }}>
              {messageEnvoi || "Un code de verification vient de vous etre envoye par SMS."}
            </p>
            <form onSubmit={verifierCode}>
              <Champ id="code_verification" label="Code de verification (SMS)" requis>
                <input
                  id="code_verification"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={codeVerification}
                  onChange={(e) => setCodeVerification(e.target.value)}
                  placeholder="Ex. 123456"
                />
              </Champ>
              {erreur && <div className="message-erreur">{erreur}</div>}
              <Bouton type="submit" chargement={enCours} style={{ width: "100%" }} iconeGauche={<ShieldCheck size={16} />}>
                Verifier et afficher mes codes
              </Bouton>
              <button
                type="button"
                onClick={() => { setEtape("telephone"); setCodeVerification(""); setErreur(null); }}
                className="eva-bouton eva-bouton--fantome eva-bouton--petit"
                style={{ width: "100%", marginTop: 8 }}
              >
                Changer de numero / renvoyer le code
              </button>
            </form>
          </>
        )}

        {resultats && resultats.length === 0 && (
          <p style={{ marginTop: 18, fontSize: 13.5, textAlign: "center", color: "var(--couleur-gris-service-2)" }}>
            <Search size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Aucun code trouve pour ce numero. Rendez-vous a la mairie avec une piece d'identite.
          </p>
        )}
        {resultats && resultats.length > 0 && (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {resultats.map((r) => (
              <div key={r.code} className="eva-carte" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="texte-mono" style={{ fontWeight: 600 }}>{r.code}</div>
                  <div style={{ fontSize: 11.5, color: "var(--couleur-gris-service-2)" }}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link to={`/completion/statut/${r.code}`} className="eva-bouton eva-bouton--fantome eva-bouton--petit">
                    Statut
                  </Link>
                  <Link to={`/completion/${r.code}`} className="eva-bouton eva-bouton--secondaire eva-bouton--petit">
                    Completer
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
