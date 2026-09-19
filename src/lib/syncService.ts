import { appelApi } from "./apiClient";
import { archiverActionsEchouees, listerActionsEnAttente, viderActionsAppliquees } from "./db";
import { surChangementConnectivite } from "./connectivite";

interface ActionEnvoyee {
  id_client: string;
  type: string;
  horodatage_client: string;
  dossier_id: string | null;
  dossier_reference_client?: string;
  version_connue: number | null;
  payload: Record<string, unknown>;
}

export interface ResultatAction {
  id_client: string;
  statut: "applique" | "conflit" | "erreur";
  dossier_id?: string;
  version?: number;
  message?: string;
  code?: string;
}

interface ReponseSyncBatch {
  resultats: ResultatAction[];
}

/**
 * Envoie la file d'actions en attente au backend. Renvoie le detail par
 * action (applique / conflit / erreur) pour que l'ecran de l'agent puisse
 * afficher precisement ce qui n'a pas pu passer, plutot qu'un simple
 * succes/echec global (voir apps.sync.services.traiter_batch cote Django,
 * qui traite les actions dans l'ordre chronologique et journalise chaque
 * conflit dans ConflitSync sans jamais ecraser la version en ligne).
 */
export async function synchroniser(): Promise<ReponseSyncBatch> {
  const actions = await listerActionsEnAttente();
  if (actions.length === 0) {
    return { resultats: [] };
  }

  const payload: ActionEnvoyee[] = actions.map((a) => ({
    id_client: a.idClient,
    type: a.type,
    horodatage_client: a.horodatageClient,
    dossier_id: a.dossierId || null,
    dossier_reference_client: a.dossierReferenceClient,
    version_connue: a.versionConnue ?? null,
    payload: a.payload
  }));

  const reponse = await appelApi<ReponseSyncBatch>("/sync/batch", {
    methode: "POST",
    corps: { actions: payload }
  });

  const parIdClient = new Map(actions.map((a) => [a.idClient, a]));
  const idsAppliques: string[] = [];
  const aArchiver: Parameters<typeof archiverActionsEchouees>[0] = [];

  for (const resultat of reponse.resultats) {
    if (resultat.statut === "applique") {
      idsAppliques.push(resultat.id_client);
      continue;
    }
    // "conflit"/"erreur" : le serveur a explicitement tranche, jamais un
    // simple pepin reseau. On sort l'action de la file plutot que la
    // retenter indefiniment (un conflit de version ou un dossier verrouille
    // echoueraient exactement pareil a chaque prochain cycle, recreant au
    // passage un nouveau ConflitSync cote serveur a chaque tentative).
    const action = parIdClient.get(resultat.id_client);
    if (action) aArchiver.push({ action, statut: resultat.statut, code: resultat.code, message: resultat.message });
  }

  if (idsAppliques.length > 0) {
    await viderActionsAppliquees(idsAppliques);
  }
  if (aArchiver.length > 0) {
    await archiverActionsEchouees(aArchiver);
  }

  return reponse;
}

/**
 * Declenche gestionnaire() sur un retour de connexion CONFIRME (voir
 * lib/connectivite.ts : la transition n'est annoncee qu'apres un ping reel
 * au serveur, pas sur le simple evenement "online" du navigateur qui peut
 * preceder une connexion reellement utilisable). Edge-triggered par
 * construction : un flap online/offline/online rapide ne redeclenche pas
 * plusieurs synchronisations en rafale, seule une vraie transition
 * hors-ligne -> en-ligne le fait.
 */
export function surRetourConnexion(gestionnaire: () => void): () => void {
  return surChangementConnectivite((enLigne) => {
    if (enLigne) gestionnaire();
  });
}
