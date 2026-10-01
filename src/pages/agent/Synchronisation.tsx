import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CloudOff, Clock, RefreshCw, Trash2 } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  CarteStat,
  EnteteDePage,
  LienBouton,
  ListeResponsive,
  Squelette,
  useConfirmation,
  useToast,
  type ColonneListe
} from "../../components/ui";
import { useConnectivite } from "../../lib/connectivite";
import {
  listerActionsEchouees,
  listerActionsEnAttente,
  supprimerActionEchouee,
  supprimerActionEnAttente,
  type ActionEchouee,
  type ActionEnAttente
} from "../../lib/db";
import { restaurerValeurPrecedente } from "../../lib/formulairesHorsLigne";
import { LIENS_AGENT } from "./navigation";
import "../../styles/agent.css";

const LIBELLES_TYPE: Record<string, string> = {
  creation_dossier: "Création de dossier",
  ajout_valeur: "Modification de champ",
  validation_dossier: "Validation de dossier"
};

/** Rafraîchissement discret de la vue : la synchronisation tourne en arrière-plan et vide la file sans prévenir cette page. */
const INTERVALLE_ACTUALISATION_MS = 5_000;

function libelleAction(action: ActionEnAttente | ActionEchouee): string {
  if (action.type !== "ajout_valeur") return LIBELLES_TYPE[action.type] || action.type;
  const code = (action.payload as { data_element_code?: string }).data_element_code;
  return `${LIBELLES_TYPE.ajout_valeur}${code ? ` (${code})` : ""}`;
}

function formaterDateHeure(valeur: string): string {
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function CelluleDossier({ dossierId }: { dossierId?: string }) {
  if (!dossierId) return <span className="eva-texte-discret">Nouveau dossier</span>;
  return <span className="texte-mono">{dossierId.slice(0, 8)}</span>;
}

/**
 * État de la file locale (Dexie) de CET appareil, distinct de l'écran
 * "Conflits" (voir ConflitsSynchronisation.tsx) qui lit ConflitSync côté
 * serveur - un journal partagé par tout le centre. Ici, rien n'est envoyé
 * au serveur pour le cas "erreur" : la visibilité et la possibilité
 * d'annuler restent entièrement locales à cet agent, sur cet appareil.
 */
export default function Synchronisation() {
  const confirmer = useConfirmation();
  const toast = useToast();
  const enLigne = useConnectivite();
  const [enAttente, setEnAttente] = useState<ActionEnAttente[] | null>(null);
  const [echouees, setEchouees] = useState<ActionEchouee[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState(false);
  const [actualisation, setActualisation] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [a, e] = await Promise.all([listerActionsEnAttente(), listerActionsEchouees()]);
      setEnAttente(a);
      setEchouees(e);
      setErreurLecture(false);
    } catch {
      setErreurLecture(true);
    }
  }, []);

  useEffect(() => {
    charger();
    const minuteur = window.setInterval(() => {
      if (!document.hidden) charger();
    }, INTERVALLE_ACTUALISATION_MS);
    return () => window.clearInterval(minuteur);
  }, [charger]);

  async function actualiser() {
    setActualisation(true);
    await charger();
    setActualisation(false);
  }

  /**
   * Sans ça, abandonner une modification de champ laissait l'écran de
   * détail continuer à afficher la valeur saisie (écrite de façon
   * optimiste dans le cache au moment de l'enregistrement, voir
   * DetailDossier.enregistrer) comme si elle était toujours en cours -
   * alors que l'agent vient justement de dire de l'oublier.
   */
  async function restaurerSiAjoutValeur(action: ActionEnAttente | ActionEchouee) {
    if (action.type !== "ajout_valeur" || !action.dossierId) return;
    const { data_element_code: code, valeur_precedente: valeurPrecedente } = action.payload as {
      data_element_code?: string;
      valeur_precedente?: unknown;
    };
    if (!code) return;
    await restaurerValeurPrecedente(action.dossierId, code, valeurPrecedente ?? null);
  }

  async function annulerEnAttente(action: ActionEnAttente) {
    const ok = await confirmer({
      titre: "Abandonner cette modification ?",
      description:
        "Cette saisie faite hors ligne n'a pas encore été envoyée et ne le sera jamais si vous l'abandonnez. Cette action est irréversible.",
      libelleConfirmer: "Abandonner",
      dangereux: true
    });
    if (!ok || action.localId === undefined) return;
    await restaurerSiAjoutValeur(action);
    await supprimerActionEnAttente(action.localId);
    await charger();
    toast.succes("La modification a été abandonnée.");
  }

  async function annulerEchouee(action: ActionEchouee) {
    const ok = await confirmer({
      titre: "Abandonner cette modification ?",
      description:
        "Le serveur a rejeté cette saisie hors ligne. L'abandonner la retire définitivement de cet appareil. Cette action est irréversible.",
      libelleConfirmer: "Abandonner",
      dangereux: true
    });
    if (!ok || action.localId === undefined) return;
    await restaurerSiAjoutValeur(action);
    await supprimerActionEchouee(action.localId);
    await charger();
    toast.succes("La modification a été abandonnée.");
  }

  const chargement = enAttente === null || echouees === null;
  const nombreAttente = enAttente?.length ?? 0;
  const nombreEchouees = echouees?.length ?? 0;

  const colonnesAttente: ColonneListe<ActionEnAttente>[] = [
    { id: "action", libelle: "Action", principale: true, rendu: (a) => libelleAction(a) },
    { id: "dossier", libelle: "Dossier", rendu: (a) => <CelluleDossier dossierId={a.dossierId} /> },
    { id: "date", libelle: "Saisie le", libelleMobile: "Saisie le", nowrap: true, rendu: (a) => <span className="texte-mono">{formaterDateHeure(a.horodatageClient)}</span> },
    {
      id: "actions",
      libelle: "Actions",
      masquerLibelle: true,
      actions: true,
      rendu: (a) => (
        <div className="eva-groupe-boutons">
          {a.dossierId && (
            <LienBouton to={`/agent/dossiers/${a.dossierId}`} variante="secondaire" taille="petit">
              Reprendre le dossier
            </LienBouton>
          )}
          <Bouton variante="danger" taille="petit" onClick={() => annulerEnAttente(a)} iconeGauche={<Trash2 size={14} />}>
            Abandonner
          </Bouton>
        </div>
      )
    }
  ];

  const colonnesEchouees: ColonneListe<ActionEchouee>[] = [
    { id: "action", libelle: "Action", principale: true, rendu: (a) => libelleAction(a) },
    {
      id: "nature",
      libelle: "Nature",
      rendu: (a) => <Badge variante={a.statut === "conflit" ? "attente" : "danger"} point>{a.statut === "conflit" ? "Conflit de version" : "Rejetée"}</Badge>
    },
    { id: "dossier", libelle: "Dossier", rendu: (a) => <CelluleDossier dossierId={a.dossierId} /> },
    { id: "date", libelle: "Échec le", nowrap: true, rendu: (a) => <span className="texte-mono">{formaterDateHeure(a.horodatageEchec)}</span> },
    {
      id: "raison",
      libelle: "Raison",
      rendu: (a) => <span className="eva-ag-raison">{a.message || a.code || "Aucune précision du serveur."}</span>
    },
    {
      id: "actions",
      libelle: "Actions",
      masquerLibelle: true,
      actions: true,
      rendu: (a) => (
        <div className="eva-groupe-boutons">
          {a.dossierId && (
            <LienBouton to={`/agent/dossiers/${a.dossierId}`} variante="secondaire" taille="petit">
              Reprendre le dossier
            </LienBouton>
          )}
          <Bouton variante="danger" taille="petit" onClick={() => annulerEchouee(a)} iconeGauche={<Trash2 size={14} />}>
            Abandonner
          </Bouton>
        </div>
      )
    }
  ];

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Synchronisation"
        sousTitre="État de la file de cet appareil : actions pas encore envoyées, et actions que le serveur a explicitement rejetées."
        actions={
          <Bouton variante="secondaire" onClick={actualiser} chargement={actualisation} iconeGauche={<RefreshCw size={16} />}>
            Actualiser
          </Bouton>
        }
      />

      {erreurLecture && (
        <Alerte
          className="eva-ag-alerte-liste"
          variante="erreur"
          titre="Lecture impossible"
          actions={
            <Bouton variante="secondaire" taille="petit" onClick={actualiser}>
              Réessayer
            </Bouton>
          }
        >
          La file de synchronisation de cet appareil n'a pas pu être lue. Vos saisies ne sont pas perdues.
        </Alerte>
      )}

      {!enLigne && (
        <Alerte className="eva-ag-alerte-liste" variante="avertissement" icone={<CloudOff size={18} aria-hidden="true" />} titre="Vous êtes hors ligne">
          L'envoi des actions en attente reprendra automatiquement dès le retour du réseau.
        </Alerte>
      )}

      {chargement && !erreurLecture ? (
        <Squelette variante="stats" lignes={2} />
      ) : (
        !erreurLecture && (
          <div className="eva-grille-stats eva-ag-synthese">
            <CarteStat
              icone={<Clock size={20} />}
              valeur={nombreAttente}
              libelle="En attente d'envoi"
              detail={nombreAttente === 0 ? "Rien à envoyer." : "Enregistrées sur cet appareil."}
              variante={nombreAttente > 0 ? "attention" : "defaut"}
            />
            <CarteStat
              icone={<AlertTriangle size={20} />}
              valeur={nombreEchouees}
              libelle="Rejetées par le serveur"
              detail={nombreEchouees === 0 ? "Aucune action rejetée." : "À reprendre ou à abandonner."}
              variante={nombreEchouees > 0 ? "alerte" : "defaut"}
            />
          </div>
        )
      )}

      {!erreurLecture && (
        <div className="eva-pile eva-ag-blocs">
          <Carte
            sansMarge
            titre="En attente d'envoi"
            description="Saisies faites sur cet appareil, pas encore reçues par le serveur. Elles partent d'elles-mêmes dès que la connexion le permet."
          >
            <ListeResponsive<ActionEnAttente>
              legende="Actions en attente d'envoi"
              lignes={enAttente ?? []}
              cle={(a) => String(a.localId ?? a.idClient)}
              colonnes={colonnesAttente}
              chargement={chargement}
              lignesSqueleteNombre={3}
              sansCadre
              sansSurvol
              hauteurMax="none"
              vide={{
                icone: <CheckCircle2 size={26} />,
                titre: "Aucune action en attente",
                description: "Tout ce qui a été saisi sur cet appareil a déjà été envoyé."
              }}
            />
          </Carte>

          <Carte
            sansMarge
            titre="Rejetées par le serveur"
            description="Le serveur a examiné ces actions et les a refusées. Elles ne seront pas renvoyées : reprenez le dossier si la correction reste utile, puis abandonnez la ligne."
          >
            <ListeResponsive<ActionEchouee>
              legende="Actions rejetées par le serveur"
              lignes={echouees ?? []}
              cle={(a) => String(a.localId ?? a.idClient)}
              colonnes={colonnesEchouees}
              chargement={chargement}
              lignesSqueleteNombre={3}
              sansCadre
              sansSurvol
              hauteurMax="none"
              vide={{
                icone: <CheckCircle2 size={26} />,
                titre: "Aucune action rejetée",
                description: "Aucune synchronisation n'a été refusée par le serveur."
              }}
            />
          </Carte>

          <Alerte variante="info" titre="Un conflit avec un collègue ?">
            Quand une modification hors ligne arrive après une modification en ligne d'un collègue, elle apparaît aussi dans le journal partagé du centre.{" "}
            <Link className="eva-lien" to="/agent/conflits">
              Consulter les conflits de synchronisation
            </Link>
            .
          </Alerte>
        </div>
      )}
    </MiseEnPage>
  );
}
