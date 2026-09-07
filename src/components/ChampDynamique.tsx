import type { ChampFormulaireEffectif } from "../types/domaine";

interface ProprietesChampDynamique {
  champ: ChampFormulaireEffectif;
  valeur: unknown;
  onChange: (codeChamp: string, valeur: string) => void;
}

/**
 * Affiche un champ tel que renvoye par GET /dossiers/{id}/formulaire (voir
 * apps.dossiers.services.construire_formulaire_effectif cote backend).
 * Le composant ne decide jamais lui-meme si un champ est visible ou en
 * lecture seule : ces regles viennent entierement du backend
 * (ChampFormulaire), pour ne jamais dupliquer la logique de gouvernance
 * cote frontend.
 */
export default function ChampDynamique({ champ, valeur, onChange }: ProprietesChampDynamique) {
  return (
    <div className="champ">
      <label htmlFor={champ.data_element_code}>{champ.label}</label>
      <input
        id={champ.data_element_code}
        type="text"
        value={typeof valeur === "string" || typeof valeur === "number" ? valeur : ""}
        disabled={champ.readonly}
        onChange={(evenement) => onChange(champ.data_element_code, evenement.target.value)}
      />
      {champ.readonly && (
        <span className="texte-mono" style={{ fontSize: 11, color: "var(--couleur-gris-service-2)" }}>
          Valeur issue de {champ.source_valeur_actuelle === "dhis2" ? "DHIS2" : "une saisie precedente"}, lecture
          seule
        </span>
      )}
    </div>
  );
}
