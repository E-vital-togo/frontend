import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, GitCompare, ShieldCheck } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Alerte, Badge, Bouton, EnteteDePage, LienBouton, ListeResponsive, Modale, type ColonneListe } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";
import { listeDepuis, type ConflitSync, type ListeOuPaginee } from "../../types/domaine";
import "../../styles/agent.css";

const LIBELLES_TYPE: Record<string, string> = {
  creation_dossier: "Création de dossier",
  ajout_valeur: "Modification de champ",
  validation_dossier: "Validation de dossier"
};

/** Forme de l'action hors ligne journalisée par le serveur (apps.sync.services) ; tous les champs restent optionnels par prudence. */
interface ActionRejetee {
  type?: string;
  horodatage_client?: string;
  version_connue?: number | null;
  payload?: { data_element_code?: string; valeur?: unknown } & Record<string, unknown>;
}

function actionRejetee(conflit: ConflitSync): ActionRejetee {
  const brut = conflit.payload_rejete;
  return brut && typeof brut === "object" ? (brut as ActionRejetee) : {};
}

function libelleType(conflit: ConflitSync): string {
  const type = actionRejetee(conflit).type;
  return type ? LIBELLES_TYPE[type] || type : "Action hors ligne";
}

function formaterDateHeure(valeur: string | undefined): string {
  if (!valeur) return "Non précisée";
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

function afficherValeur(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "Valeur vide";
  if (typeof valeur === "object") return JSON.stringify(valeur);
  if (typeof valeur === "boolean") return valeur ? "Oui" : "Non";
  return String(valeur);
}

function ComparaisonConflit({ conflit }: { conflit: ConflitSync }) {
  const action = actionRejetee(conflit);
  const champ = action.payload?.data_element_code;
  const aUneValeur = action.payload !== undefined && "valeur" in action.payload;
  return (
    <div className="eva-ag-comparaison">
      <Alerte variante="succes" icone={<ShieldCheck size={18} aria-hidden="true" />} titre="Aucune donnée n'a été perdue">
        La version en ligne du dossier a été conservée telle quelle. Votre saisie hors ligne n'a pas été appliquée : vous pouvez la reprendre à la main si elle reste pertinente.
      </Alerte>

      <div className="eva-ag-comparaison__versions">
        <section className="eva-ag-version eva-ag-version--hors-ligne" aria-labelledby={`conflit-${conflit.id}-hl`}>
          <header className="eva-ag-version__entete">
            <h3 id={`conflit-${conflit.id}-hl`}>Votre saisie hors ligne</h3>
            <Badge variante="attente" point>Non appliquée</Badge>
          </header>
          <dl className="eva-definitions">
            <dt>Action</dt>
            <dd>{libelleType(conflit)}</dd>
            {champ && (
              <>
                <dt>Champ</dt>
                <dd className="texte-mono">{champ}</dd>
              </>
            )}
            {aUneValeur && (
              <>
                <dt>Valeur saisie</dt>
                <dd>{afficherValeur(action.payload?.valeur)}</dd>
              </>
            )}
            <dt>Saisie le</dt>
            <dd>{formaterDateHeure(action.horodatage_client)}</dd>
            {action.version_connue !== undefined && action.version_connue !== null && (
              <>
                <dt>Version connue</dt>
                <dd className="texte-mono">{action.version_connue}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="eva-ag-version eva-ag-version--en-ligne" aria-labelledby={`conflit-${conflit.id}-el`}>
          <header className="eva-ag-version__entete">
            <h3 id={`conflit-${conflit.id}-el`}>Version en ligne</h3>
            <Badge variante="succes" point>Conservée</Badge>
          </header>
          <p>
            Un collègue a modifié ce dossier en ligne pendant que vous étiez hors connexion. Cette version fait foi : c'est celle que vous retrouverez en ouvrant le dossier.
          </p>
          <p className="eva-texte-discret eva-texte-petit">Enregistré par le serveur le {formaterDateHeure(conflit.created_at)}.</p>
        </section>
      </div>

      <section className="eva-ag-raison-bloc" aria-label="Raison du conflit">
        <h3>Raison indiquée par le serveur</h3>
        <p>{conflit.raison}</p>
      </section>
    </div>
  );
}

export default function ConflitsSynchronisation() {
  const { utilisateur } = useAuth();
  const estAgent = utilisateur?.role === "agent_cec";
  const liens = estAgent ? LIENS_AGENT : LIENS_ADMIN_CEC;
  const basePath = estAgent ? "/agent" : "/admin-cec";

  const [conflits, setConflits] = useState<ConflitSync[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConflitSync | null>(null);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(null);
    appelApi<ListeOuPaginee<ConflitSync>>("/sync/conflits/")
      .then((donnees) => setConflits(listeDepuis(donnees)))
      .catch((e: unknown) => setErreur(e instanceof ErreurApi ? e.message : "Le serveur n'a pas répondu. Vérifiez votre connexion."))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const colonnes: ColonneListe<ConflitSync>[] = [
    { id: "action", libelle: "Action", principale: true, rendu: (c) => libelleType(c) },
    { id: "dossier", libelle: "Dossier", rendu: (c) => <span className="texte-mono">{c.dossier.slice(0, 8)}</span> },
    { id: "date", libelle: "Date", numerique: true, rendu: (c) => new Date(c.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) },
    { id: "raison", libelle: "Raison", rendu: (c) => <span className="eva-ag-raison">{c.raison}</span> },
    {
      id: "actions",
      libelle: "Actions",
      masquerLibelle: true,
      actions: true,
      rendu: (c) => (
        <div className="eva-groupe-boutons">
          <Bouton variante="secondaire" taille="petit" onClick={() => setDetail(c)} iconeGauche={<GitCompare size={14} />}>
            Comparer
          </Bouton>
          <LienBouton to={`${basePath}/dossiers/${c.dossier}`} variante="fantome" taille="petit">
            Reprendre le dossier
          </LienBouton>
        </div>
      )
    }
  ];

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage
        titre="Conflits de synchronisation"
        sousTitre="Actions faites hors ligne qui n'ont pas pu s'appliquer parce que le dossier avait été modifié en ligne entre-temps."
      />

      <Alerte className="eva-ag-alerte-liste" variante="info" icone={<ShieldCheck size={18} aria-hidden="true" />} titre="Rien n'est perdu en silence">
        La version en ligne est toujours conservée. La correction faite hors ligne doit être reprise à la main si elle reste pertinente : ouvrez la comparaison pour retrouver ce que vous aviez saisi.
      </Alerte>

      <ListeResponsive<ConflitSync>
        legende="Conflits de synchronisation"
        lignes={conflits}
        cle={(c) => c.id}
        colonnes={colonnes}
        chargement={chargement}
        erreur={erreur}
        onReessayer={charger}
        onLigneClic={setDetail}
        hauteurMax="none"
        vide={{
          icone: <CheckCircle2 size={26} />,
          titre: "Aucun conflit en attente",
          description: "Toutes les actions hors ligne ont été synchronisées sans problème."
        }}
      />

      {detail && (
        <Modale
          titre="Comparer les versions"
          description={`Dossier ${detail.dossier.slice(0, 8)} - ${libelleType(detail)}`}
          taille="large"
          onFermer={() => setDetail(null)}
          actions={
            <>
              <Bouton variante="secondaire" onClick={() => setDetail(null)}>
                Fermer
              </Bouton>
              <LienBouton to={`${basePath}/dossiers/${detail.dossier}`}>Reprendre le dossier</LienBouton>
            </>
          }
        >
          <ComparaisonConflit conflit={detail} />
        </Modale>
      )}
    </MiseEnPage>
  );
}
