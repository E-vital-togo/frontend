import type { ReactElement } from "react";
import Champ from "./ui/Champ";
import type { ChampFormulaireEffectif } from "../types/domaine";

interface ProprietesChampDynamique {
  champ: ChampFormulaireEffectif;
  valeur: unknown;
  onChange: (codeChamp: string, valeur: unknown) => void;
}

function versTexte(valeur: unknown): string {
  return typeof valeur === "string" || typeof valeur === "number" ? String(valeur) : "";
}

function estCoche(valeur: unknown): boolean {
  return valeur === true || valeur === "true" || valeur === 1 || valeur === "1" || valeur === "oui";
}

/**
 * Affiche un champ tel que renvoye par GET /dossiers/{id}/formulaire (voir
 * apps.dossiers.services.construire_formulaire_effectif cote backend), avec
 * le widget correspondant a `champ.type_champ` - un seul aiguillage, plutot
 * qu'un <input type="text"> unique pour tout (source du desordre de saisie
 * avant ce composant : rien ne distinguait une date d'une liste).
 *
 * Ce composant ne decide jamais lui-meme si un champ est visible, en
 * lecture seule ou obligatoire : ces regles viennent entierement du backend
 * (ChampFormulaire), pour ne jamais dupliquer la logique de gouvernance
 * cote frontend. Les contraintes affichees ici (longueur, min/max, options)
 * sont un confort de saisie immediat - la validation qui fait foi reste
 * apps.catalogue.validation.valider_valeur, executee a l'enregistrement.
 */
export default function ChampDynamique({ champ, valeur, onChange }: ProprietesChampDynamique) {
  const { data_element_code: code, type_champ, contraintes, options, readonly } = champ;

  function changer(valeurBrute: unknown) {
    onChange(code, valeurBrute);
  }

  let controle: ReactElement;
  switch (type_champ) {
    case "nombre_entier":
    case "nombre_decimal":
      controle = (
        <input
          id={code}
          type="number"
          step={type_champ === "nombre_entier" ? 1 : "any"}
          min={contraintes.min}
          max={contraintes.max}
          value={versTexte(valeur)}
          disabled={readonly}
          onChange={(e) => changer(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
      break;

    case "date":
      controle = (
        <input
          id={code}
          type="date"
          max={contraintes.autorise_futur ? undefined : new Date().toISOString().slice(0, 10)}
          value={versTexte(valeur)}
          disabled={readonly}
          onChange={(e) => changer(e.target.value || null)}
        />
      );
      break;

    case "booleen":
      controle = (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
          <input
            id={code}
            type="checkbox"
            style={{ width: "auto" }}
            checked={estCoche(valeur)}
            disabled={readonly}
            onChange={(e) => changer(e.target.checked)}
          />
          <span style={{ fontSize: 13, color: "var(--couleur-gris-service-1)" }}>{estCoche(valeur) ? "Oui" : "Non"}</span>
        </div>
      );
      break;

    case "select":
      controle = (
        <select id={code} value={versTexte(valeur)} disabled={readonly} onChange={(e) => changer(e.target.value || null)}>
          <option value="">-- Choisir --</option>
          {options.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </select>
      );
      break;

    case "select_multiple": {
      const valeursChoisies = Array.isArray(valeur) ? valeur.map(String) : [];
      controle = (
        <select
          id={code}
          multiple
          disabled={readonly}
          value={valeursChoisies}
          style={{ height: Math.min(160, 34 + options.length * 24), width: "100%" }}
          onChange={(e) => changer(Array.from(e.target.selectedOptions).map((option) => option.value))}
        >
          {options.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </select>
      );
      break;
    }

    case "telephone":
      controle = (
        <input id={code} type="tel" value={versTexte(valeur)} disabled={readonly} onChange={(e) => changer(e.target.value)} />
      );
      break;

    case "texte_long":
      controle = (
        <textarea
          id={code}
          rows={3}
          maxLength={contraintes.longueur_max}
          value={versTexte(valeur)}
          disabled={readonly}
          onChange={(e) => changer(e.target.value)}
        />
      );
      break;

    case "texte_court":
    default:
      controle = (
        <input
          id={code}
          type="text"
          maxLength={contraintes.longueur_max}
          value={versTexte(valeur)}
          disabled={readonly}
          onChange={(e) => changer(e.target.value)}
        />
      );
  }

  return (
    <Champ
      id={code}
      label={champ.label}
      requis={champ.obligatoire}
      aide={
        readonly
          ? `Valeur issue de ${champ.source_valeur_actuelle === "dhis2" ? "DHIS2" : "une saisie précédente"}, lecture seule.`
          : undefined
      }
    >
      {controle}
    </Champ>
  );
}
