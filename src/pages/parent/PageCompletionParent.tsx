import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Logo from "../../components/Logo";
import { Bouton, Champ } from "../../components/ui";
import { appelApiPublic, ErreurApiPublique } from "../../lib/apiPublic";
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
    } catch (e) {
      setErreur(e instanceof ErreurApiPublique ? e.message : "Une erreur est survenue lors de l'envoi. Reessayez, ou rendez-vous a la mairie avec votre code.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="eva-ecran-centre">
      <div className="eva-carte" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="vertical" hauteur={90} />
        </div>

        {envoye ? (
          <div style={{ textAlign: "center" }}>
            <CheckCircle2 size={36} color="var(--couleur-emeraude)" style={{ marginBottom: 10 }} />
            <p>
              Merci, vos informations ont bien ete transmises a la mairie. Vous serez recontacte si un complement est
              necessaire.
            </p>
            {code && (
              <Link to={`/completion/statut/${code}`} style={{ fontSize: 13, color: "var(--couleur-emeraude)" }}>
                Suivre l'avancement de mon dossier
              </Link>
            )}
          </div>
        ) : erreur && !champs ? (
          <div style={{ textAlign: "center" }}>
            <p className="message-erreur">{erreur}</p>
            <Link to="/retrouver-mon-code" style={{ fontSize: 13, color: "var(--couleur-emeraude)" }}>
              J'ai perdu mon code
            </Link>
          </div>
        ) : !champs ? (
          <p style={{ textAlign: "center" }}>Chargement du formulaire...</p>
        ) : (
          <form onSubmit={soumettre}>
            <h1 style={{ fontSize: 18, color: "var(--couleur-emeraude)", marginBottom: 4 }}>Complement de declaration</h1>
            <p className="eva-sous-titre" style={{ marginBottom: 16 }}>
              Remplissez uniquement les informations demandees ci-dessous, puis validez.
            </p>
            {erreur && <div className="message-erreur">{erreur}</div>}
            {champs.map((champ) => (
              <Champ key={champ.data_element_code} id={champ.data_element_code} label={champ.label}>
                <input
                  id={champ.data_element_code}
                  type="text"
                  disabled={champ.readonly}
                  defaultValue={typeof champ.valeur_actuelle === "string" ? champ.valeur_actuelle : ""}
                  onChange={(e) => setValeurs((v) => ({ ...v, [champ.data_element_code]: e.target.value }))}
                />
              </Champ>
            ))}
            <Bouton type="submit" chargement={enCours} style={{ width: "100%" }}>
              Envoyer
            </Bouton>
          </form>
        )}
      </div>
    </div>
  );
}
