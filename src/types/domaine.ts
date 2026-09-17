/**
 * Types repris des serializers DRF du backend (apps.utilisateurs,
 * apps.dossiers, apps.catalogue...). Volontairement plats et proches de la
 * reponse JSON reelle, plutot que des classes riches : ce sont des
 * contrats d'API, pas un modele de domaine cote frontend.
 */
import type { LucideIcon } from "lucide-react";

export type Role = "agent_cec" | "admin_cec" | "admin_inseed" | "admin_general";

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  prenoms: string;
  role: Role;
  mairie: string | null;
  territoire_scope: string | null;
  is_active: boolean;
  date_joined: string;
}

export type StatutDossier =
  | "recu"
  | "notifie"
  | "en_attente_complement"
  | "complete"
  | "acte_emis"
  | "sans_suite";

export type TypeEvenement = "naissance" | "deces";
export type OrigineDossier = "dhis2" | "manuel";
export type TypeDossier = "declaration" | "jugement";

export interface ChampModifieDiff {
  data_element_code?: string;
  label?: string;
  ancienne_valeur: unknown;
  nouvelle_valeur: unknown;
  valeur_actuelle : unknown;
  valeur_proposee : unknown;
}

export interface NouvelleVersionDossier {
  id: string;
  dossier: string;
  statut: "en_attente" | "acceptee" | "refusee";
  champs_modifies: ChampModifieDiff[];
  decidee_par: string | null;
  decidee_le: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dossier {
  id: string;
  nom?: string | null;
  origine: OrigineDossier;
  type_dossier: TypeDossier;
  event_type: TypeEvenement;
  statut: StatutDossier;
  date_declaration: string;
  date_limite: string;
  est_expire: boolean;
  mairie: string;
  mairie_nom?: string;
  verrouille: boolean;
  version: number;
  created_at: string;
  raw_data?: unknown;
  dossier_lie?: string | null;
  a_une_nouvelle_version?: boolean;
  nouvelle_version?: NouvelleVersionDossier | null;
  valeurs?: ValeurChamp[];
}

// Miroir d'apps.catalogue.contraintes.TypeChamp (backend) : determine le
// widget rendu par ChampDynamique et le format accepte a l'enregistrement
// (voir apps.catalogue.validation.valider_valeur, source de verite finale -
// ce switch cote frontend n'est qu'un confort de saisie).
export type TypeChamp =
  | "texte_court"
  | "texte_long"
  | "nombre_entier"
  | "nombre_decimal"
  | "date"
  | "booleen"
  | "select"
  | "select_multiple"
  | "telephone";

// Sous-ensemble pertinent selon `type_champ` - voir apps.catalogue.contraintes.SCHEMAS.
export interface ContraintesChamp {
  longueur_max?: number;
  regex?: string;
  min?: number;
  max?: number;
  autorise_futur?: boolean;
  autorise_passe?: boolean;
  min_selections?: number;
  max_selections?: number;
}

export interface OptionChampEffective {
  valeur: string;
  libelle: string;
}

export interface ChampFormulaireEffectif {
  data_element_code: string;
  label: string;
  readonly: boolean;
  obligatoire: boolean;
  type_champ: TypeChamp;
  contraintes: ContraintesChamp;
  options: OptionChampEffective[];
  valeur_actuelle: unknown;
  source_valeur_actuelle: string | null;
}

export interface ValeurChamp {
  id: string;
  data_element: string;
  data_element_code: string;
  valeur: unknown;
  source: string;
  created_at: string;
}

export interface NumerosActeProposes {
  numero_registre: number;
  numero_feuillet: number;
  numero_acte: number;
  annee_registre: number;
}

export interface Acte {
  id: string;
  dossier: string;
  mairie: string;
  numero_registre: number;
  numero_feuillet: number;
  numero_acte: number;
  annee_registre: number;
  signataire: string | null;
  nom_signataire: string;
  qualite_signataire: string;
  date_etablissement: string;
  statut: "actif" | "annule";
  acte_remplace: string | null;
  motif_annulation: string;
  cree_par: string;
  created_at: string;
}

export interface DemandeModificationActe {
  id: string;
  dossier: string;
  dossier_event_type: TypeEvenement;
  champs_modifies: Record<string, { ancienne_valeur: unknown; nouvelle_valeur: unknown }>;
  demandeur: string;
  demandeur_nom?: string;
  niveau_requis: "regional" | "national";
  statut: "en_attente" | "validee" | "rejetee";
  validateur: string | null;
  validateur_nom?: string;
  commentaire_validateur: string;
  created_at: string;
  decided_at: string | null;
}

export interface NotificationDossier {
  id: string;
  dossier: string;
  type: "initiale" | "relance" | "confirmation";
  canal: "sms" | "whatsapp";
  fournisseur_utilise: string;
  statut: "envoye" | "echec" | "en_attente";
  contenu: string;
  created_at: string;
}

export interface NotificationEchouee extends NotificationDossier {
  dossier_event_type: TypeEvenement;
  dossier_statut: StatutDossier;
  dossier_mairie_nom: string;
}

export interface CodeRetraitTrouve {
  code: string;
  dossier_id: string;
  created_at: string;
}

export interface StatistiqueRepartitionItem {
  cle: string;
  libelle: string;
  valeur: number;
}

export interface StatistiqueEvolutionPoint {
  periode: string;
  [serie: string]: string | number;
}

export interface StatistiqueEvolutionReponse {
  donnees: StatistiqueEvolutionPoint[];
  series: string[];
}

export interface DimensionStat {
  code: string;
  label: string;
  temporelle: boolean;
}

export interface MesureStat {
  code: string;
  label: string;
  type: "compte" | "moyenne" | "ratio";
  unite: string;
}

export interface PivotFiltres {
  event_type?: string;
  statut?: string;
  origine?: string;
  type_dossier?: string;
  date_declaration_min?: string;
  date_declaration_max?: string;
}

export type TriPivot = "valeur_desc" | "valeur_asc" | "libelle_asc";

export interface PivotRequete {
  dimensions: string[];
  mesures: string[];
  filtres?: PivotFiltres;
  tri?: TriPivot;
  limite?: number | null;
  regrouper_autres?: boolean;
  /** Ecarte les faits sans valeur pour une des dimensions (inclus par defaut). */
  exclure_non_renseigne?: boolean;
  /** Masque les comptages < seuil (protection contre la re-identification) ; null = desactive. */
  seuil_petites_cellules?: number | null;
}

export interface PivotLigne {
  [cle: string]: string | number | null;
}

export interface PivotResultat {
  dimensions: string[];
  mesures: string[];
  lignes: PivotLigne[];
  total_lignes: number;
  libelles?: { dimensions: Record<string, string>; mesures: Record<string, string> };
  traitements?: { exclure_non_renseigne: boolean; seuil_petites_cellules: number | null; cellules_masquees: number };
}

export type TypeGraphiqueStat =
  | "barres"
  | "barres_empilees"
  | "barres_horizontales"
  | "courbes"
  | "aires_empilees"
  | "camembert"
  | "anneau"
  | "combo"
  | "nuage_points"
  | "carte_chaleur";

export interface WidgetGraphique extends PivotRequete {
  id: string;
  tableau_de_bord: string;
  nom: string;
  type_graphique: TypeGraphiqueStat;
  tri: TriPivot;
  limite: number | null;
  regrouper_autres: boolean;
  exclure_non_renseigne: boolean;
  seuil_petites_cellules: number | null;
  position_x: number;
  position_y: number;
  largeur: number;
  hauteur: number;
  created_at: string;
  updated_at: string;
}

export type PartageTableauDeBord = "prive" | "partage_role";

export interface TableauDeBord {
  id: string;
  nom: string;
  proprietaire: string;
  proprietaire_nom: string;
  partage: PartageTableauDeBord;
  widgets: WidgetGraphique[];
  created_at: string;
  updated_at: string;
}

export interface ConflitSync {
  id: string;
  dossier: string;
  agent: string | null;
  payload_rejete: unknown;
  raison: string;
  created_at: string;
}

export interface Mairie {
  id: string;
  territoire: string;
  territoire_nom: string;
  nom: string;
  adresse: string;
  telephone: string;
  logo: string | null;
}

export type TypeTerritoire = "pays" | "region" | "prefecture" | "commune";

export interface Territoire {
  id: string;
  nom: string;
  type: TypeTerritoire;
  parent: string | null;
  dhis2_org_unit_uid: string;
}

// Ordre de la hierarchie, du plus large au plus fin (voir
// apps.utilisateurs.services.ORDRE_NIVEAUX_TERRITOIRE cote backend, qui
// applique la meme regle : un admin_cec peut creer un admin_cec a
// n'importe quel niveau strictement inferieur au sien, pas seulement le
// niveau immediatement en-dessous).
export const ORDRE_NIVEAUX_TERRITOIRE: TypeTerritoire[] = ["pays", "region", "prefecture", "commune"];

export function niveauxInferieurs(type: TypeTerritoire): TypeTerritoire[] {
  return ORDRE_NIVEAUX_TERRITOIRE.slice(ORDRE_NIVEAUX_TERRITOIRE.indexOf(type) + 1);
}

export interface CampagneRelance {
  id: string;
  territoire: string;
  territoire_nom: string;
  event_type: TypeEvenement | null;
  seuils_jours: number[];
  message_modele: string;
  actif: boolean;
  modifie_par: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntreeJournalZone {
  created_at: string;
  auteur: string;
  methode: string;
  chemin: string;
  statut: number;
  succes: boolean;
  libelle: string;
}

export interface ReponseJournalZone {
  count: number;
  page: number;
  page_size: number;
  results: EntreeJournalZone[];
}

export interface ReponsePaginee<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Certaines vues renvoient une liste brute plutot que le format pagine standard. */
export type ListeOuPaginee<T> = T[] | ReponsePaginee<T>;

export function listeDepuis<T>(donnees: ListeOuPaginee<T>): T[] {
  return Array.isArray(donnees) ? donnees : donnees.results;
}

export interface SousLienNavigation {
  chemin: string;
  libelle: string;
  cleCompteur?: "echeances" | "conflits" | "demandes" | "notificationsEchouees";
}

export interface LienNavigation {
  chemin: string;
  libelle: string;
  icone: LucideIcon;
  cleCompteur?: "echeances" | "conflits" | "demandes" | "notificationsEchouees";
  sousLiens?: SousLienNavigation[];
}

export interface SignataireMairie {
  id: string;
  nom: string;
  prenom: string;
  fonction: string;
  actif: boolean;
  a_signe_un_acte: boolean;
  mairie: string;
  mairie_nom: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActeSigneParSignataire {
  id: string;
  dossier: string;
  type_acte: TypeEvenement;
  numero_registre: number;
  numero_feuillet: number;
  numero_acte: number;
  annee_registre: number;
  date_etablissement: string;
  statut: "actif" | "annule";
}
