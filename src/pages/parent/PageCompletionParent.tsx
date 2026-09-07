import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import Logo from "../../components/Logo";
import type { ChampFormulaireEffectif } from "../../types/domaine";

interface ReponseFormulaireEffectif {
  champs: ChampFormulaireEffectif[];
}

export default function PageCompletionParent() {
  const { code } = useParams<{ code: string }>();
  const [champs, setChamps] = useState<ChampFormulaireEffectif[] | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!code) return;
    appelApiPublic<ReponseFormulaireEffectif>(`/completion/${code}`)
      .then((donnees) => setChamps(donnees.champs))
      .catch(() => setErreur("Ce lien n'est plus valide, ou le code est incorrect."));
  }, [code]);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!code) return;
    setEnCours(true);
    setErreur(null);
    try {
      const corps = {
        valeurs: Object.entries(valeurs).map(([data_element_code, valeur]) => ({ data_element_code, valeur }))
      };
      await appelApiPublic(`/completion/${code}`, { method: "POST", body: JSON.stringify(corps) });
      setEnvoye(true);
    } catch {
      setErreur("Une erreur est survenue lors de l'envoi. Reessayez, ou rendez-vous a la mairie avec votre code.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="carte" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="vertical" hauteur={100} />
        </div>

        {envoye ? (
          <p style={{ textAlign: "center" }}>
            Merci, vos informations ont bien ete transmises a la mairie. Vous serez recontacte si un complement est
            necessaire.
          </p>
        ) : erreur && !champs ? (
          <p className="message-erreur" style={{ textAlign: "center" }}>
            {erreur}
          </p>
        ) : !champs ? (
          <p style={{ textAlign: "center" }}>Chargement du formulaire...</p>
        ) : (
          <form onSubmit={soumettre}>
            <h1 style={{ fontSize: 18, color: "var(--couleur-emeraude)" }}>Complement de declaration</h1>
            {erreur && <div className="message-erreur">{erreur}</div>}
            {champs.map((champ) => (
              <div className="champ" key={champ.data_element_code}>
                <label htmlFor={champ.data_element_code}>{champ.label}</label>
                <input
                  id={champ.data_element_code}
                  type="text"
                  disabled={champ.readonly}
                  defaultValue={typeof champ.valeur_actuelle === "string" ? champ.valeur_actuelle : ""}
                  onChange={(e) => setValeurs((v) => ({ ...v, [champ.data_element_code]: e.target.value }))}
                />
              </div>
            ))}
            <button type="submit" className="bouton-principal" style={{ width: "100%" }} disabled={enCours}>
              {enCours ? "Envoi..." : "Envoyer"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Le formulaire de completion est accessible SANS authentification (code
// seul, voir apps.dossiers.views.CompletionParentView cote backend) : pas
// de jeton JWT a joindre, contrairement a appelApi() utilise partout
// ailleurs dans l'app.
async function appelApiPublic<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
  const reponse = await fetch(`${base}${chemin}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!reponse.ok) throw new Error("Erreur");
  return reponse.json() as Promise<T>;
}
