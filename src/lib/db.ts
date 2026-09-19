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

/**
 * Une action qui a ete effectivement tentee par le serveur et rejetee -
 * conflit de version, ou erreur metier (ex: dossier verrouille par
 * emission d'acte). Distincte d'ActionEnAttente : une fois ici, elle ne
 * doit plus jamais etre retentee automatiquement (elle echouerait a
 * l'identique a chaque fois), contrairement a une simple panne reseau qui,
 * elle, laisse l'action dans actionsEnAttente pour un nouvel essai.
 */
export interface ActionEchouee {
  localId?: number;
  idClient: string;
  type: TypeAction;
  dossierId?: string;
  dossierReferenceClient?: string;
  versionConnue?: number | null;
  horodatageClient: string;
  payload: Record<string, unknown>;
  statut: "conflit" | "erreur";
  code?: string;
  message?: string;
  horodatageEchec: string;
}

export type DossierEnCache = Dossier & { horodatageCache?: string };

/**
 * Cle de cache du formulaire d'un dossier. Definie ici, avec le reste du
 * stockage, pour que tous ceux qui y touchent - DetailDossier a la lecture,
 * le prechargement groupe a l'ecriture, la purge - visent exactement la
 * meme entree.
 */
export function cleCacheFormulaire(idDossier: string): string {
  return `dossier_formulaire::${idDossier}`;
}

/**
 * Au-dela de ce delai, une entree de cache est consideree comme trop
 * ancienne pour etre montree a un agent : mieux vaut un ecran qui dit
 * "indisponible hors-ligne" qu'un dossier d'etat civil peri me presente
 * comme s'il etait a jour.
 */
const DUREE_VIE_CACHE_MS = 24 * 60 * 60 * 1000;

/**
 * Instantane brut d'une reponse serveur reussie (ex: la liste paginee de
 * /dossiers/?echeance_proche=true), garde tel quel plutot que recalcule a
 * partir de dossiersEnCache. Certains filtres (echeance_proche notamment)
 * dependent de regles metier qui ne sont PAS de simples calculs de date
 * (voir _proche_echeance cote backend : origine DHIS2 + statut, aucun seuil
 * de jours) - les reimplementer cote client serait fragile et risquerait de
 * diverger silencieusement de la regle serveur. `cle` identifie la requete
 * (chemin + parametres), pas le dossier.
 */
export interface InstantaneRequete {
  cle: string;
  donnees: unknown;
  horodatage: string;
}

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
  instantanesRequetes!: EntityTable<InstantaneRequete, "cle">;
  actionsEchouees!: EntityTable<ActionEchouee, "localId">;

  constructor() {
    super("evital-agent-cec");
    this.version(1).stores({
      actionsEnAttente: "++localId, idClient, type, dossierId, horodatageClient",
      dossiersEnCache: "id, version, statut, eventType"
    });
    this.version(2).stores({
      actionsEnAttente: "++localId, idClient, type, dossierId, horodatageClient",
      dossiersEnCache: "id, version, statut, eventType",
      instantanesRequetes: "cle"
    });
    this.version(3).stores({
      actionsEnAttente: "++localId, idClient, type, dossierId, horodatageClient",
      dossiersEnCache: "id, version, statut, eventType",
      instantanesRequetes: "cle",
      actionsEchouees: "++localId, idClient, type, dossierId, horodatageEchec, statut"
    });
  }
}

export const baseLocale = new BaseLocaleEVital();

export async function mettreEnFileAction(
  action: Omit<ActionEnAttente, "idClient" | "horodatageClient"> & { idClient?: string }
): Promise<number> {
  const { localId: _localId, ...reste } = action as ActionEnAttente;
  const id = await baseLocale.actionsEnAttente.add({
    ...reste,
    idClient: action.idClient || crypto.randomUUID(),
    horodatageClient: new Date().toISOString()
  });
  // Dexie type le retour de .add() sur le type du champ cle primaire tel que
  // declare dans l'interface (localId?: number, donc number|undefined) ;
  // Dexie garantit neanmoins toujours un id numerique reel a l'insertion.
  return id as number;
}

export async function listerActionsEnAttente(): Promise<ActionEnAttente[]> {
  return baseLocale.actionsEnAttente.orderBy("horodatageClient").toArray();
}

export async function viderActionsAppliquees(idsClients: string[]): Promise<void> {
  await baseLocale.actionsEnAttente.where("idClient").anyOf(idsClients).delete();
}

/**
 * Sort une action de la file d'attente et la conserve dans actionsEchouees,
 * en une seule operation atomique : jamais un etat intermediaire ou une
 * action se retrouverait dans les deux tables, ou dans aucune.
 */
export async function archiverActionsEchouees(
  entrees: { action: ActionEnAttente; statut: "conflit" | "erreur"; code?: string; message?: string }[]
): Promise<void> {
  if (entrees.length === 0) return;
  await baseLocale.transaction("rw", baseLocale.actionsEnAttente, baseLocale.actionsEchouees, async () => {
    for (const { action, statut, code, message } of entrees) {
      const { localId: _localId, ...reste } = action;
      await baseLocale.actionsEchouees.add({
        ...reste,
        statut,
        code,
        message,
        horodatageEchec: new Date().toISOString()
      });
    }
    await baseLocale.actionsEnAttente
      .where("idClient")
      .anyOf(entrees.map((e) => e.action.idClient))
      .delete();
  });
}

export async function listerActionsEchouees(): Promise<ActionEchouee[]> {
  return baseLocale.actionsEchouees.orderBy("horodatageEchec").reverse().toArray();
}

export async function supprimerActionEchouee(localId: number): Promise<void> {
  await baseLocale.actionsEchouees.delete(localId);
}

/**
 * Abandonne une action encore en attente, jamais tentee - pas seulement
 * une action deja echouee (voir supprimerActionEchouee ci-dessus) :
 * l'agent peut vouloir annuler une saisie hors-ligne avant meme qu'elle
 * parte au serveur.
 */
export async function supprimerActionEnAttente(localId: number): Promise<void> {
  await baseLocale.actionsEnAttente.delete(localId);
}

export async function mettreEnCacheDossier(dossier: Dossier): Promise<string> {
  return baseLocale.dossiersEnCache.put({ ...dossier, horodatageCache: new Date().toISOString() });
}

export async function dossierEnCache(id: string): Promise<DossierEnCache | undefined> {
  return baseLocale.dossiersEnCache.get(id);
}

export async function listerDossiersEnCache(): Promise<DossierEnCache[]> {
  return baseLocale.dossiersEnCache.toArray();
}

/**
 * `donnees` doit rester exactement ce que le serveur a renvoye pour `cle`
 * (voir commentaire sur InstantaneRequete) : jamais une valeur recalculee
 * ou filtree cote client.
 */
export async function mettreEnCacheInstantane<T>(cle: string, donnees: T): Promise<void> {
  await baseLocale.instantanesRequetes.put({ cle, donnees, horodatage: new Date().toISOString() });
}

export async function instantaneEnCache<T>(cle: string): Promise<{ donnees: T; horodatage: string } | undefined> {
  const entree = await baseLocale.instantanesRequetes.get(cle);
  if (!entree) return undefined;
  return { donnees: entree.donnees as T, horodatage: entree.horodatage };
}

/**
 * Identifiants des dossiers portant au moins une action pas encore
 * synchronisee. Ces dossiers sont intouchables pour tout ce qui ecrase ou
 * supprime du cache : leur copie locale est plus RECENTE que celle du
 * serveur (la modification de l'agent n'est pas encore partie), donc la
 * remplacer par la version serveur ferait disparaitre sa saisie de l'ecran
 * a la prochaine coupure, alors qu'elle est bien en file.
 */
export async function dossiersAvecActionsEnAttente(): Promise<Set<string>> {
  const actions = await baseLocale.actionsEnAttente.toArray();
  return new Set(actions.map((action) => action.dossierId).filter((id): id is string => !!id));
}

/**
 * Supprime les entrees de cache plus vieilles que DUREE_VIE_CACHE_MS, sauf
 * celles des dossiers a synchroniser (voir dossiersAvecActionsEnAttente) :
 * un agent reste plusieurs jours hors couverture doit continuer a voir ce
 * qu'il a lui-meme saisi. La file d'actions, elle, n'est jamais purgee.
 */
export async function purgerCacheExpire(): Promise<void> {
  const limite = new Date(Date.now() - DUREE_VIE_CACHE_MS).toISOString();
  const proteges = await dossiersAvecActionsEnAttente();
  const clesProtegees = new Set([...proteges].map(cleCacheFormulaire));

  const instantanes = await baseLocale.instantanesRequetes.toArray();
  const clesExpirees = instantanes
    .filter((entree) => entree.horodatage < limite && !clesProtegees.has(entree.cle))
    .map((entree) => entree.cle);
  if (clesExpirees.length > 0) {
    await baseLocale.instantanesRequetes.bulkDelete(clesExpirees);
  }

  const dossiers = await baseLocale.dossiersEnCache.toArray();
  const idsExpires = dossiers
    .filter((dossier) => !dossier.horodatageCache || dossier.horodatageCache < limite)
    .filter((dossier) => !proteges.has(dossier.id))
    .map((dossier) => dossier.id);
  if (idsExpires.length > 0) {
    await baseLocale.dossiersEnCache.bulkDelete(idsExpires);
  }
}
