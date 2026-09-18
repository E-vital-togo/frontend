import { appelApi } from "./apiClient";
import { cleCacheFormulaire, dossiersAvecActionsEnAttente, mettreEnCacheInstantane } from "./db";
import type { ChampFormulaireEffectif, TypeEvenement } from "../types/domaine";

/**
 * Partie du formulaire qui ne depend QUE de (contexte, event_type) : le
 * backend la renvoie une seule fois par type d'evenement au lieu de la
 * repeter pour chacun des dossiers de la page (voir
 * construire_formulaires_effectifs cote Django).
 */
type SchemaChamp = Omit<ChampFormulaireEffectif, "readonly" | "valeur_actuelle" | "source_valeur_actuelle">;

interface ValeurDossier {
  valeur: unknown;
  source: string | null;
  readonly: boolean;
}

interface ReponseFormulairesGroupes {
  contexte: string;
  schemas: Record<string, SchemaChamp[]>;
  dossiers: Record<string, { event_type: TypeEvenement; version: number; valeurs: Record<string, ValeurDossier> }>;
}

/**
 * Precharge en une requete les formulaires des dossiers d'une page de liste,
 * pour que l'agent puisse les ouvrir hors-ligne sans les avoir consultes un
 * par un avant. Le resultat est ecrit dans les MEMES entrees de cache que
 * celles lues par DetailDossier : pas de second stockage "tout en un" a
 * maintenir en parallele, donc rien qui puisse diverger.
 *
 * Volontairement silencieux en cas d'echec : c'est un confort hors-ligne,
 * jamais un prerequis a l'affichage de la liste.
 */
export async function precacherFormulaires(idsDossiers: string[], forcer = false): Promise<void> {
  if (idsDossiers.length === 0) return;

  const reponse = await appelApi<ReponseFormulairesGroupes>(
    `/dossiers/formulaires/?ids=${idsDossiers.join(",")}`
  );
  // `forcer` est reserve a l'apres-synchronisation : le serveur vient de
  // trancher sur ces dossiers precis (action appliquee, ou refusee pour
  // conflit), sa version fait donc autorite meme s'il reste des actions en
  // file. Une action refusee n'est pas une saisie a proteger, c'est une
  // saisie que le serveur a explicitement ecartee.
  const proteges = forcer ? new Set<string>() : await dossiersAvecActionsEnAttente();

  await Promise.all(
    Object.entries(reponse.dossiers).map(async ([idDossier, donnees]) => {
      // Ne jamais ecraser le cache d'un dossier modifie hors-ligne et pas
      // encore synchronise : sa valeur locale est plus recente que celle
      // que le serveur vient de renvoyer.
      if (proteges.has(idDossier)) return;

      const schema = reponse.schemas[donnees.event_type] || [];
      // Assemblage volontairement bete : tout ce qui releve d'une regle
      // (ordre, readonly, obligatoire, options) a deja ete tranche cote
      // serveur, rien n'est recalcule ici.
      const champs: ChampFormulaireEffectif[] = schema.map((champ) => {
        const valeur = donnees.valeurs[champ.data_element_code];
        return {
          ...champ,
          readonly: valeur?.readonly ?? false,
          valeur_actuelle: valeur?.valeur ?? null,
          source_valeur_actuelle: valeur?.source ?? null
        };
      });

      await mettreEnCacheInstantane(cleCacheFormulaire(idDossier), champs);
    })
  );
}
