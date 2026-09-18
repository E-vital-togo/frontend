import { appelApi } from "./apiClient";
import { listerActionsEnAttente, viderActionsAppliquees } from "./db";
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

  const idsAppliques = reponse.resultats.filter((r) => r.statut === "applique").map((r) => r.id_client);
  if (idsAppliques.length > 0) {
    await viderActionsAppliquees(idsAppliques);
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
