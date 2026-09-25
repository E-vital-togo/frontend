import { useRef, type ReactElement } from "react";
import Champ from "./ui/Champ";
import { useToast } from "./ui/ToastProvider";
import type { ChampFormulaireEffectif } from "../types/domaine";

interface ProprietesChampDynamique {
  champ: ChampFormulaireEffectif;
  valeur: unknown;
  onChange: (codeChamp: string, valeur: unknown) => void;
  /**
   * Dossier verrouille par emission d'acte (voir Dossier.verrouille cote
   * backend) - distinct de champ.readonly, qui ne couvre que le cas DHIS2.
   * Volontairement jamais transforme en `disabled` natif : un controle
   * disabled ne declenche pas onChange/onClick de facon fiable, ce qui
   * empecherait d'avertir l'agent au moment ou il tente la modification.
   */
  verrouille?: boolean;
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
export default function ChampDynamique({ champ, valeur, onChange, verrouille = false }: ProprietesChampDynamique) {
  const { data_element_code: code, type_champ, contraintes, options, readonly } = champ;
  const toast = useToast();
  const derniereAlerte = useRef(0);

  function changer(valeurBrute: unknown) {
    if (verrouille && !readonly) {
      // Throttle plutot qu'un toast par frappe clavier sur un champ
      // bloque - sinon taper "Jean" dans un champ verrouille empile 4
      // messages identiques.
      const maintenant = Date.now();
      if (maintenant - derniereAlerte.current > 1500) {
        toast.erreur("Impossible : l'acte est deja emis. Passez par « Demander une modification ».");
        derniereAlerte.current = maintenant;
      }
      return;
    }
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

    case "datalist":
      // Saisie libre : contrairement a "select", `options` n'est qu'une
      // liste de suggestions (voir apps.catalogue.validation._valider_texte
      // applique a ce type - aucune contrainte contre `options`). Le
      // <datalist> propose donc `libelle` comme valeur inseree, pas le code
      // interne `valeur` utilise par select/select_multiple.
      controle = (
        <>
          <input
            id={code}
            type="text"
            list={`${code}-liste`}
            maxLength={contraintes.longueur_max}
            value={versTexte(valeur)}
            disabled={readonly}
            onChange={(e) => changer(e.target.value)}
          />
          <datalist id={`${code}-liste`}>
            {options.map((option) => (
              <option key={option.valeur} value={option.libelle} />
            ))}
          </datalist>
        </>
      );
      break;

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
