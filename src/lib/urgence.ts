/**
 * Memes seuils que settings.SEUILS_RELANCE_JOURS cote backend (J-10/J-3) :
 * une seule definition de "urgent" pour tout le frontend (tableaux de bord
 * agent et admin CEC), plutot qu'une logique dupliquee par ecran.
 */
export function joursRestants(dateLimite: string): number {
  const debutAujourdhui = new Date();
  debutAujourdhui.setHours(0, 0, 0, 0);
  const diff = new Date(dateLimite).getTime() - debutAujourdhui.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Vert -> orange -> rouge a mesure qu'on approche de l'echeance. Le rouge
 * signifie ici "presque expire", jamais "deja clos" : un dossier sans_suite
 * n'a plus d'echeance active et se code en gris neutre ailleurs (voir
 * COULEUR_PAR_STATUT dans TableauDeBordAdminCec), pas en rouge.
 */
export function couleurUrgence(jours: number): string {
  if (jours <= 3) return "var(--couleur-erreur)";
  if (jours <= 10) return "var(--couleur-citron-profond)";
  return "var(--couleur-emeraude)";
}

/**
 * Classe CSS (voir theme.css) pour teinter le fond de toute une ligne de
 * tableau selon l'urgence, plutot qu'une seule valeur de couleur : une
 * classe garde le survol (:hover) fonctionnel, un style inline l'aurait
 * ecrase.
 */
export function classeUrgence(jours: number): string {
  if (jours <= 3) return "eva-ligne-urgence--rouge";
  if (jours <= 10) return "eva-ligne-urgence--orange";
  return "eva-ligne-urgence--verte";
}

// Seuls ces statuts ont une echeance encore "active" (voir _proche_echeance
// cote backend, apps.dossiers.views) : une fois complete/acte_emis/sans_suite,
// le dossier n'est plus en course contre le delai, actif ou expire.
const STATUTS_AVEC_ECHEANCE_ACTIVE = ["recu", "notifie", "en_attente_complement"];

export function echeanceActive(statut: string): boolean {
  return STATUTS_AVEC_ECHEANCE_ACTIVE.includes(statut);
}
