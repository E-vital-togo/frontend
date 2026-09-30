import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import FormulaireDossier from "../../components/FormulaireDossier";
import Logo from "../../components/Logo";
import { Bouton } from "../../components/ui";
import { appelApiPublic, ErreurApiPublique } from "../../lib/apiPublic";
import { champsManquants, planFormulaire, valeurEffective } from "../../lib/formulaire";
import type { ChampFormulaireEffectif, MiseEnPage, ReponseFormulaireEffectif } from "../../types/domaine";

export default function PageCompletionParent() {
  const { code } = useParams<{ code: string }>();
  const [champs, setChamps] = useState<ChampFormulaireEffectif[] | null>(null);
  const [miseEnPage, setMiseEnPage] = useState<MiseEnPage | null>(null);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({});
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!code) return;
    appelApiPublic<ReponseFormulaireEffectif>(`/completion/${code}`)
      .then((donnees) => {
        setChamps(donnees.champs);
        setMiseEnPage(donnees.mise_en_page ?? null);
      })
      .catch(() => setErreur("Ce lien n'est plus valide, ou le code est incorrect."));
  }, [code]);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!code || !champs) return;
    const manquants = champsManquants(champs, (c) => valeurEffective(c, valeurs));
    if (manquants.length > 0) {
      setErreursChamps(Object.fromEntries(manquants.map((c) => [c.data_element_code, "Ce champ est obligatoire."])));
      setErreur(`Champs obligatoires manquants : ${manquants.map((c) => c.label).join(", ")}.`);
      return;
    }
    setEnCours(true);
    setErreur(null);
    setErreursChamps({});
    try {
      const corps = {
        valeurs: Object.entries(valeurs).map(([data_element_code, valeur]) => ({ data_element_code, valeur }))
      };
      await appelApiPublic(`/completion/${code}`, { method: "POST", body: JSON.stringify(corps) });

      setEnvoye(true);
    } catch (e) {
      console.error(e);
      setErreur(e instanceof ErreurApiPublique ? e.message : "Une erreur est survenue lors de l'envoi. Reessayez, ou rendez-vous a la mairie avec votre code.");
    } finally {
      setEnCours(false);
    }
  }

  function modifierValeur(codeChamp: string, valeur: unknown) {
    setValeurs((v) => ({ ...v, [codeChamp]: valeur }));
    // L'erreur d'un champ disparait des qu'on le modifie.
    setErreursChamps((precedentes) => {
      if (!(codeChamp in precedentes)) return precedentes;
      const { [codeChamp]: _retire, ...reste } = precedentes;
      return reste;
    });
  }

  const enEtapes = !!champs && planFormulaire(champs, miseEnPage).mode === "etapes";
  const boutonEnvoyer = (
    <Bouton type="submit" chargement={enCours} style={enEtapes ? undefined : { width: "100%" }}>
      Envoyer
    </Bouton>
  );

  return (
    <div className="eva-ecran-centre eva-ecran-centre--form">
      <div className="eva-carte eva-carte--form" style={{ width: "100%", maxWidth: 640 }}>
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
          // noValidate : les etapes non affichees restent montees, un controle natif
          // invalide mais masque bloquerait l'envoi sans message. Le controle des
          // champs obligatoires est fait dans soumettre(), le serveur fait foi.
          <form onSubmit={soumettre} noValidate>
            <h1 style={{ fontSize: 18, color: "var(--couleur-emeraude)", marginBottom: 4 }}>Complement de declaration</h1>
            <p className="eva-sous-titre" style={{ marginBottom: 16 }}>
              Remplissez uniquement les informations demandees ci-dessous, puis validez.
            </p>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <FormulaireDossier
              champs={champs}
              miseEnPage={miseEnPage}
              valeurs={valeurs}
              onChange={modifierValeur}
              erreurs={erreursChamps}
              cleMemorisation={code ? `completion:${code}` : undefined}
              actionFinale={boutonEnvoyer}
            />
            {!enEtapes && <div style={{ marginTop: 24 }}>{boutonEnvoyer}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
