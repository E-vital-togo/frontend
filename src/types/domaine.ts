/**
 * Types repris des serializers DRF du backend (apps.utilisateurs,
 * apps.dossiers, apps.catalogue...). Volontairement plats et proches de la
 * reponse JSON reelle, plutot que des classes riches : ce sont des
 * contrats d'API, pas un modele de domaine cote frontend.
 */

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

export interface Dossier {
  id: string;
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
}

export interface ChampFormulaireEffectif {
  data_element_code: string;
  label: string;
  readonly: boolean;
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
  champs_modifies: Record<string, { ancienne_valeur: unknown; nouvelle_valeur: unknown }>;
  demandeur: string;
  niveau_requis: "regional" | "national";
  statut: "en_attente" | "validee" | "rejetee";
  validateur: string | null;
  commentaire_validateur: string;
  created_at: string;
  decided_at: string | null;
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

export interface LienNavigation {
  chemin: string;
  libelle: string;
}
