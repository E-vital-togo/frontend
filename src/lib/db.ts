import Dexie, { type EntityTable } from "dexie";
import type { Dossier } from "../types/domaine";

export type TypeAction = "creation_dossier" | "ajout_valeur" | "validation_dossier";

export interface ActionEnAttente {
  localId?: number;
  idClient: string;
  type: TypeAction;
  dossierId?: string;
  dossierReferenceClient?: string;
  versionConnue?: number | null;
  horodatageClient: string;
  payload: Record<string, unknown>;
}

export type DossierEnCache = Dossier;

/**
 * Une seule table `actionsEnAttente` : chaque ligne correspond a une action
 * de l'agent (creation manuelle, ajout de valeur, validation) faite hors
 * connexion, avec le format attendu par POST /sync/batch cote backend
 * (voir apps.sync.services.traiter_batch). `versionConnue` est la version
 * du dossier telle que l'agent la connaissait au moment de l'action : le
 * backend s'en sert pour detecter un conflit si un autre agent de la meme
 * mairie a modifie le dossier entre-temps en ligne.
 */
class BaseLocaleEVital extends Dexie {
  actionsEnAttente!: EntityTable<ActionEnAttente, "localId">;
  dossiersEnCache!: EntityTable<DossierEnCache, "id">;

  constructor() {
    super("evital-agent-cec");
    this.version(1).stores({
      actionsEnAttente: "++localId, idClient, type, dossierId, horodatageClient",
      dossiersEnCache: "id, version, statut, eventType"
    });
  }
}

export const baseLocale = new BaseLocaleEVital();

export async function mettreEnFileAction(
  action: Omit<ActionEnAttente, "idClient" | "horodatageClient"> & { idClient?: string }
): Promise<number> {
  return baseLocale.actionsEnAttente.add({
    ...action,
    idClient: action.idClient || crypto.randomUUID(),
    horodatageClient: new Date().toISOString()
  });
}

export async function listerActionsEnAttente(): Promise<ActionEnAttente[]> {
  return baseLocale.actionsEnAttente.orderBy("horodatageClient").toArray();
}

export async function viderActionsAppliquees(idsClients: string[]): Promise<void> {
  await baseLocale.actionsEnAttente.where("idClient").anyOf(idsClients).delete();
}

export async function mettreEnCacheDossier(dossier: Dossier): Promise<string> {
  return baseLocale.dossiersEnCache.put(dossier as DossierEnCache);
}

export async function dossierEnCache(id: string): Promise<DossierEnCache | undefined> {
  return baseLocale.dossiersEnCache.get(id);
}

export async function listerDossiersEnCache(): Promise<DossierEnCache[]> {
  return baseLocale.dossiersEnCache.toArray();
}
