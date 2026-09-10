import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Phone, Search } from "lucide-react";
import Logo from "../../components/Logo";
import { Bouton, Champ } from "../../components/ui";
import { appelApiPublic, ErreurApiPublique } from "../../lib/apiPublic";
import type { CodeRetraitTrouve } from "../../types/domaine";

export default function PageRetrouverCode() {
  const [telephone, setTelephone] = useState("");
  const [resultats, setResultats] = useState<CodeRetraitTrouve[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function rechercher(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);
    setResultats(null);
    try {
      const donnees = await appelApiPublic<CodeRetraitTrouve[]>(`/codes-retrait/retrouver?telephone=${encodeURIComponent(telephone)}`);
      setResultats(donnees);
    } catch (e) {
      setErreur(e instanceof ErreurApiPublique ? e.message : "Erreur de recherche.");
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
        <p className="eva-sous-titre" style={{ marginBottom: 18, textAlign: "center" }}>
          Indiquez le numero de telephone utilise lors de la declaration.
        </p>

        <form onSubmit={rechercher}>
          <Champ id="telephone" label="Numero de telephone" requis>
            <input id="telephone" type="tel" required value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex. 90112233" />
          </Champ>
          {erreur && <div className="message-erreur">{erreur}</div>}
          <Bouton type="submit" chargement={enCours} style={{ width: "100%" }} iconeGauche={<Phone size={16} />}>
            Rechercher
          </Bouton>
        </form>

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
