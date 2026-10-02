import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, LinkIcon, RefreshCw, WifiOff } from "lucide-react";
import EcranCompletionIndisponible from "../../components/auth/EcranCompletionIndisponible";
import EcranResultat from "../../components/auth/EcranResultat";
import EtapesParcours from "../../components/auth/EtapesParcours";
import { decrireErreur, estErreurReseau, type MessageErreur } from "../../components/auth/messagesAuth";
import FormulaireDossier from "../../components/FormulaireDossier";
import { Alerte, Bouton, LienBouton, PageAuth, Squelette } from "../../components/ui";
import { appelApiPublic, ErreurApiPublique } from "../../lib/apiPublic";
import { useConnectivite } from "../../lib/connectivite";
import { signalerCompletionDesactivee, useEtatCompletion } from "../../lib/etatCompletion";
import { champsManquants, planFormulaire, valeurEffective } from "../../lib/formulaire";
import type { ChampFormulaireEffectif, MiseEnPage, ReponseFormulaireEffectif } from "../../types/domaine";
import "../../styles/auth.css";

export default function PageCompletionParent() {
  const { code } = useParams<{ code: string }>();
  const enLigne = useConnectivite();
  const etatCompletion = useEtatCompletion();
  const [champs, setChamps] = useState<ChampFormulaireEffectif[] | null>(null);
  const [miseEnPage, setMiseEnPage] = useState<MiseEnPage | null>(null);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({});
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({});
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const [erreurChargement, setErreurChargement] = useState<MessageErreur | null>(null);
  const [tentative, setTentative] = useState(0);
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const alerteErreur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!code) return;
    setErreurChargement(null);
    appelApiPublic<ReponseFormulaireEffectif>(`/completion/${code}`)
      .then((donnees) => {
        setChamps(donnees.champs);
        setMiseEnPage(donnees.mise_en_page ?? null);
      })
      .catch((e: unknown) => {
        // Completion coupee par l'administration : ecran dedie, pas une erreur de lien.
        if (e instanceof ErreurApiPublique && e.code === "completion_desactivee") {
          signalerCompletionDesactivee();
          return;
        }
        setErreurChargement(
          estErreurReseau(e)
            ? decrireErreur(e, "Connexion impossible")
            : { variante: "erreur", titre: "Lien ou code invalide", message: "Ce lien n'est plus valide, ou le code est incorrect." }
        );
      });
  }, [code, tentative]);

  // Une erreur d'envoi apparait en haut du formulaire : on y ramene l'ecran, sinon elle passe inapercue sur telephone.
  useEffect(() => {
    if (erreur) alerteErreur.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erreur]);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!code || !champs) return;
    const manquants = champsManquants(champs, (c) => valeurEffective(c, valeurs));
    if (manquants.length > 0) {
      setErreursChamps(Object.fromEntries(manquants.map((c) => [c.data_element_code, "Ce champ est obligatoire."])));
      setErreur({
        variante: "erreur",
        titre: "Il manque des informations",
        message: `Champs obligatoires manquants : ${manquants.map((c) => c.label).join(", ")}.`
      });
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
      // Coupee pendant la saisie : ecran dedie ; les valeurs saisies restent en memoire si le service revient (bouton Reessayer).
      if (e instanceof ErreurApiPublique && e.code === "completion_desactivee") {
        signalerCompletionDesactivee();
        return;
      }
      console.error(e);
      setErreur(
        e instanceof ErreurApiPublique
          ? decrireErreur(e, "Envoi impossible")
          : {
              variante: "erreur",
              titre: "Envoi impossible",
              message: "Une erreur est survenue lors de l'envoi. Réessayez, ou rendez-vous à la mairie avec votre code."
            }
      );
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

  // Ecran de fin : dossier transmis
  if (envoye) {
    return (
      <PageAuth>
        <EtapesParcours actuelle={2} envoye />
        <EcranResultat
          ton="succes"
          icone={<CheckCircle2 size={38} />}
          titre="Merci, votre dossier est transmis"
          actions={
            code ? (
              <LienBouton to={`/completion/statut/${code}`} pleineLargeur>
                Suivre l'avancement de mon dossier
              </LienBouton>
            ) : undefined
          }
        >
          <p>Vos informations ont bien été transmises à la mairie. Vous serez recontacté si un complément est nécessaire.</p>
          {code && (
            <p className="eva-acces-rappel-code">
              Conservez votre code : <strong className="texte-mono">{code}</strong>
            </p>
          )}
        </EcranResultat>
      </PageAuth>
    );
  }

  // Completion parent coupee par l'administration
  if (!etatCompletion.active) {
    return (
      <EcranCompletionIndisponible
        message={etatCompletion.message_personnalise ? etatCompletion.message : undefined}
        code={code}
        onReessayer={() => {
          void etatCompletion.rafraichir().then(() => setTentative((n) => n + 1));
        }}
      />
    );
  }

  // Ecran d'erreur : lien ou code invalide, ou reseau absent au chargement
  if (erreurChargement && !champs) {
    const reseau = erreurChargement.variante === "avertissement";
    return (
      <PageAuth>
        <EcranResultat
          ton={reseau ? "attention" : "erreur"}
          icone={reseau ? <WifiOff size={34} /> : <LinkIcon size={34} />}
          titre={erreurChargement.titre}
          actions={
            reseau ? (
              <Bouton type="button" pleineLargeur iconeGauche={<RefreshCw size={16} />} onClick={() => setTentative((n) => n + 1)}>
                Réessayer
              </Bouton>
            ) : (
              <>
                <LienBouton to="/retrouver-mon-code" pleineLargeur>
                  J'ai perdu mon code
                </LienBouton>
                <LienBouton to="/completion" variante="secondaire" pleineLargeur>
                  Saisir un autre code
                </LienBouton>
              </>
            )
          }
        >
          <p>{erreurChargement.message}</p>
          {!reseau && <p>Vérifiez le code reçu par SMS. Si vous l'avez égaré, vous pouvez le retrouver avec votre numéro de téléphone.</p>}
        </EcranResultat>
      </PageAuth>
    );
  }

  // Chargement : squelettes a la forme du formulaire
  if (!champs) {
    return (
      <PageAuth large alignementHaut titre="Complément de déclaration" description="Nous préparons votre formulaire...">
        <EtapesParcours actuelle={1} compact />
        <div className="eva-acces-squelette" role="status" aria-busy="true">
          <span className="eva-sr-only">Chargement du formulaire</span>
          <Squelette variante="titre" largeur="45%" libelle="" />
          <Squelette variante="bloc" hauteur={48} libelle="" />
          <Squelette variante="bloc" hauteur={48} libelle="" />
          <Squelette variante="bloc" hauteur={48} libelle="" />
          <Squelette variante="bouton" largeur="100%" libelle="" />
        </div>
      </PageAuth>
    );
  }

  const enEtapes = planFormulaire(champs, miseEnPage).mode === "etapes";
  const boutonEnvoyer = (
    <Bouton type="submit" chargement={enCours} pleineLargeur={!enEtapes}>
      Envoyer
    </Bouton>
  );

  return (
    <PageAuth
      large
      alignementHaut
      titre="Complément de déclaration"
      description="Remplissez uniquement les informations demandées ci-dessous, puis validez."
      message={
        !enLigne ? (
          <Alerte variante="avertissement" titre="Vous êtes hors ligne" icone={<WifiOff size={18} aria-hidden="true" />}>
            Vous pouvez continuer à remplir le formulaire, mais il ne pourra être envoyé qu'une fois la connexion rétablie.
          </Alerte>
        ) : undefined
      }
    >
      <EtapesParcours actuelle={1} compact />
      {/* noValidate : les etapes non affichees restent montees, un controle natif
          invalide mais masque bloquerait l'envoi sans message. Le controle des
          champs obligatoires est fait dans soumettre(), le serveur fait foi. */}
      <form onSubmit={soumettre} noValidate>
        {erreur && (
          <div ref={alerteErreur} className="eva-acces-alerte-formulaire">
            <Alerte variante={erreur.variante} titre={erreur.titre}>
              {erreur.message}
            </Alerte>
          </div>
        )}
        <FormulaireDossier
          champs={champs}
          miseEnPage={miseEnPage}
          valeurs={valeurs}
          onChange={modifierValeur}
          erreurs={erreursChamps}
          cleMemorisation={code ? `completion:${code}` : undefined}
          actionFinale={boutonEnvoyer}
        />
        {!enEtapes && <div className="eva-acces-envoi">{boutonEnvoyer}</div>}
      </form>
    </PageAuth>
  );
}
