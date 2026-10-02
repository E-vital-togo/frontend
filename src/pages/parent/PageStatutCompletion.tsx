import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, BadgeCheck, Check, CircleHelp, ClipboardCheck, FileText, Hourglass, Inbox, Landmark, RefreshCw, WifiOff } from "lucide-react";
import EcranCompletionIndisponible from "../../components/auth/EcranCompletionIndisponible";
import EcranResultat from "../../components/auth/EcranResultat";
import { decrireErreur, estErreurReseau, type MessageErreur } from "../../components/auth/messagesAuth";
import { Bouton, LienBouton, PageAuth, Squelette } from "../../components/ui";
import { cx } from "../../components/ui/utilitaires";
import { appelApiPublic, ErreurApiPublique } from "../../lib/apiPublic";
import { signalerCompletionDesactivee, useEtatCompletion } from "../../lib/etatCompletion";
import type { StatutDossier } from "../../types/domaine";
import "../../styles/auth.css";

interface ReponseStatutCompletion {
  statut: StatutDossier;
  mairie: string;
}

const ETAPES: Array<{ statuts: StatutDossier[]; libelle: string }> = [
  { statuts: ["recu", "notifie"], libelle: "Reçu" },
  { statuts: ["en_attente_complement"], libelle: "Complément" },
  { statuts: ["complete"], libelle: "Complet" },
  { statuts: ["acte_emis"], libelle: "Acte émis" }
];

interface DescriptionStatut {
  ton: "info" | "attention" | "succes" | "erreur";
  icone: ReactNode;
  titre: string;
  message: string;
  /** Vrai : le parent peut (ou doit) encore completer son dossier. */
  aCompleter?: boolean;
  conseil?: string;
}

const STATUTS: Record<StatutDossier, DescriptionStatut> = {
  recu: {
    ton: "info",
    icone: <Inbox size={20} />,
    titre: "Déclaration reçue",
    message: "Votre déclaration a été reçue.",
    aCompleter: true,
    conseil: "Complétez votre dossier pour que la mairie puisse le traiter."
  },
  notifie: {
    ton: "info",
    icone: <Inbox size={20} />,
    titre: "Déclaration reçue",
    message: "Votre déclaration a été reçue et vous a été notifiée.",
    aCompleter: true,
    conseil: "Complétez votre dossier pour que la mairie puisse le traiter."
  },
  en_attente_complement: {
    ton: "attention",
    icone: <Hourglass size={20} />,
    titre: "Complément attendu",
    message: "Un complément d'information est attendu.",
    aCompleter: true,
    conseil: "Ouvrez votre dossier et renseignez les informations demandées."
  },
  complete: {
    ton: "info",
    icone: <ClipboardCheck size={20} />,
    titre: "Dossier complet",
    message: "Votre dossier est complet, en attente de vérification par la mairie.",
    conseil: "Aucune démarche n'est nécessaire de votre part pour le moment."
  },
  acte_emis: {
    ton: "succes",
    icone: <BadgeCheck size={20} />,
    titre: "Acte établi",
    message: "Votre acte a été établi, vous pouvez le retirer à la mairie.",
    conseil: "Munissez-vous d'une pièce d'identité."
  },
  sans_suite: {
    ton: "erreur",
    icone: <AlertTriangle size={20} />,
    titre: "Délai légal dépassé",
    message: "Le délai légal est dépassé. Rapprochez-vous de la mairie pour la procédure de rattrapage."
  }
};

function indexEtape(statut: StatutDossier): number {
  return ETAPES.findIndex((etape) => etape.statuts.includes(statut));
}

export default function PageStatutCompletion() {
  const { code } = useParams<{ code: string }>();
  const [statut, setStatut] = useState<ReponseStatutCompletion | null>(null);
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const [actualisation, setActualisation] = useState(false);
  const etatCompletion = useEtatCompletion();

  const charger = useCallback(() => {
    if (!code) return;
    setActualisation(true);
    appelApiPublic<ReponseStatutCompletion>(`/completion/statut/${code}`)
      .then((donnees) => {
        setStatut(donnees);
        setErreur(null);
      })
      .catch((e: unknown) => {
        // Completion coupee par l'administration : ecran dedie (voir plus bas).
        if (e instanceof ErreurApiPublique && e.code === "completion_desactivee") {
          signalerCompletionDesactivee();
          return;
        }
        setErreur(
          estErreurReseau(e)
            ? decrireErreur(e, "Connexion impossible")
            : { variante: "erreur", titre: "Code introuvable", message: "Ce code ne correspond à aucun dossier." }
        );
      })
      .finally(() => setActualisation(false));
  }, [code]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Completion parent coupee par l'administration (le suivi en ligne l'est aussi)
  if (!etatCompletion.active) {
    return (
      <EcranCompletionIndisponible
        message={etatCompletion.message_personnalise ? etatCompletion.message : undefined}
        code={code}
        reessaiEnCours={actualisation}
        onReessayer={() => {
          void etatCompletion.rafraichir().then(charger);
        }}
      />
    );
  }

  // Echec sans donnees a afficher (un echec d'actualisation garde l'ancien statut a l'ecran)
  if (erreur && !statut) {
    const reseau = erreur.variante === "avertissement";
    return (
      <PageAuth>
        <EcranResultat
          ton={reseau ? "attention" : "erreur"}
          icone={reseau ? <WifiOff size={34} /> : <CircleHelp size={34} />}
          titre={erreur.titre}
          actions={
            reseau ? (
              <Bouton type="button" pleineLargeur iconeGauche={<RefreshCw size={16} />} chargement={actualisation} onClick={charger}>
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
          <p>{erreur.message}</p>
          {!reseau && <p>Vérifiez le code reçu par SMS. Si vous l'avez égaré, vous pouvez le retrouver avec votre numéro de téléphone.</p>}
        </EcranResultat>
      </PageAuth>
    );
  }

  // Chargement : squelettes a la forme de la page
  if (!statut) {
    return (
      <PageAuth titre="Suivi de mon dossier" description="Nous recherchons votre dossier...">
        <div className="eva-acces-squelette" role="status" aria-busy="true">
          <span className="eva-sr-only">Chargement du suivi de votre dossier</span>
          <Squelette variante="bloc" hauteur={64} libelle="" />
          <Squelette variante="bloc" hauteur={84} libelle="" />
        </div>
      </PageAuth>
    );
  }

  const description = STATUTS[statut.statut];
  const etapeActuelle = indexEtape(statut.statut);

  return (
    <PageAuth
      titre="Suivi de mon dossier"
      icone={<Landmark size={26} />}
      description={
        <>
          Mairie de <strong>{statut.mairie}</strong>
        </>
      }
    >
      {statut.statut !== "sans_suite" && (
        <ol className="eva-acces-progression" aria-label="Avancement du dossier">
          {ETAPES.map((etape, index) => {
            const courante = index === etapeActuelle;
            // L'etape en cours n'est "faite" que si c'est la derniere (acte emis) ; sinon elle reste a accomplir.
            const faite = index < etapeActuelle || (courante && index === ETAPES.length - 1);
            return (
              <li key={etape.libelle} className={cx("eva-acces-progression__item", faite && "est-atteint", courante && "est-courant")} aria-current={courante ? "step" : undefined}>
                <span className="eva-acces-progression__puce" aria-hidden="true">
                  {faite ? <Check size={15} strokeWidth={3} /> : index + 1}
                </span>
                <span className="eva-acces-progression__libelle">
                  {etape.libelle}
                  <span className="eva-sr-only">{courante && !faite ? " (étape en cours)" : faite ? " (terminée)" : " (à venir)"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className={cx("eva-acces-statut", `eva-acces-statut--${description.ton}`)} role="status">
        <span className="eva-acces-statut__icone" aria-hidden="true">
          {description.icone}
        </span>
        <div>
          <p className="eva-acces-statut__titre">{description.titre}</p>
          <p className="eva-acces-statut__texte">{description.message}</p>
          {description.conseil && <p className="eva-acces-statut__conseil">{description.conseil}</p>}
        </div>
      </div>

      {erreur && (
        <p className="eva-acces-statut__echec" role="alert">
          {erreur.message}
        </p>
      )}

      <div className="eva-acces-actions-statut">
        {description.aCompleter && code && (
          <LienBouton to={`/completion/${code}`} pleineLargeur iconeGauche={<FileText size={17} />}>
            {statut.statut === "en_attente_complement" ? "Compléter mon dossier" : "Compléter ma déclaration"}
          </LienBouton>
        )}
        <Bouton type="button" variante="secondaire" pleineLargeur chargement={actualisation} iconeGauche={<RefreshCw size={16} />} onClick={charger}>
          Actualiser le statut
        </Bouton>
      </div>
      {code && (
        <p className="eva-acces-rappel-code">
          Code de retrait : <strong className="texte-mono">{code}</strong>
        </p>
      )}
    </PageAuth>
  );
}
