import { useRef, type ReactElement } from "react";
import { AlertCircle } from "lucide-react";
import ChampTelephone from "./ui/ChampTelephone";
import Selecteur from "./ui/Selecteur";
import ChampSuggestions from "./ui/ChampSuggestions";
import { useToast } from "./ui/ToastProvider";
import { colonnesChamp, estCoche, versTexte } from "../lib/formulaire";
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
  /**
   * Message d'erreur affiche sous le champ (champ obligatoire vide, refus du
   * serveur...). Decide par le parent : ce composant ne valide rien lui-meme.
   */
  erreur?: string;
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
 *
 * Rendu : le champ occupe `colonnesChamp(champ)` colonnes de la grille a 12
 * colonnes du conteneur `.eva-form-grille` (voir styles/formulaire.css) ;
 * `placeholder` et `aide` viennent du catalogue (DataElement).
 */
export default function ChampDynamique({ champ, valeur, onChange, verrouille = false, erreur }: ProprietesChampDynamique) {
  const { data_element_code: code, type_champ, contraintes, options, readonly } = champ;
  const toast = useToast();
  const idEtiquette = `${code}-etiquette`;
  const idMessage = `${code}-message`;
  const placeholder = champ.placeholder || undefined;
  // Etat commun des controles simples : erreur (aria-invalid) et description (aide/erreur).
  const accessibilite = {
    "aria-invalid": erreur ? (true as const) : undefined,
    "aria-describedby": erreur || champ.aide || readonly ? idMessage : undefined
  };
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
          className="eva-ctl eva-ctl--nombre"
          inputMode={type_champ === "nombre_entier" ? "numeric" : "decimal"}
          placeholder={placeholder}
          step={type_champ === "nombre_entier" ? 1 : "any"}
          min={contraintes.min}
          max={contraintes.max}
          value={versTexte(valeur)}
          disabled={readonly}
          {...accessibilite}
          onChange={(e) => changer(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
      break;

    case "date":
      controle = (
        <input
          id={code}
          type="date"
          className="eva-ctl eva-ctl--date"
          max={contraintes.autorise_futur ? undefined : new Date().toISOString().slice(0, 10)}
          value={versTexte(valeur)}
          disabled={readonly}
          {...accessibilite}
          onChange={(e) => changer(e.target.value || null)}
        />
      );
      break;

    case "booleen":
      controle = (
        // Interrupteur : case a cocher native (clavier, lecteurs d'ecran),
        // habillee en piste/pouce par formulaire.css. Emet toujours un booleen.
        <label className={`eva-interrupteur${readonly ? " eva-interrupteur--desactive" : ""}`}>
          <input
            id={code}
            type="checkbox"
            role="switch"
            checked={estCoche(valeur)}
            disabled={readonly}
            {...accessibilite}
            onChange={(e) => changer(e.target.checked)}
          />
          <span className="eva-interrupteur__piste" aria-hidden="true" />
          <span className="eva-interrupteur__texte">{estCoche(valeur) ? "Oui" : "Non"}</span>
        </label>
      );
      break;

    case "select":
      // Liste deroulante maison (recherche integree au-dela de 7 choix). Emet le code du choix, ou null une fois effacee
      // (comme l'ancienne option vide "Choisir...").
      controle = (
        <Selecteur
          id={code}
          valeur={versTexte(valeur)}
          options={options}
          placeholder={placeholder ?? "Choisir..."}
          disabled={readonly}
          verrouille={verrouille && !readonly}
          invalide={!!erreur}
          effacable
          etiquettePar={idEtiquette}
          decritPar={accessibilite["aria-describedby"]}
          onChange={(choix) => changer(choix || null)}
        />
      );
      break;

    case "select_multiple": {
      const valeursChoisies = Array.isArray(valeur) ? valeur.map(String) : [];
      // Meme valeur emise que l'ancien <select multiple> : tableau de codes, dans l'ordre des options.
      controle = (
        <Selecteur
          id={code}
          multiple
          options={options}
          valeur={valeursChoisies}
          placeholder={placeholder ?? "Choisir..."}
          disabled={readonly}
          verrouille={verrouille && !readonly}
          invalide={!!erreur}
          etiquettePar={idEtiquette}
          decritPar={accessibilite["aria-describedby"]}
          max={contraintes.max_selections}
          min={contraintes.min_selections}
          onChange={changer}
        />
      );
      break;
    }

    case "datalist":
      // Saisie libre : contrairement a "select", `options` n'est qu'une liste de suggestions (voir
      // apps.catalogue.validation._valider_texte applique a ce type - aucune contrainte contre `options`).
      // Le champ propose donc `libelle` comme texte insere, pas le code interne `valeur` utilise par
      // select/select_multiple ; la valeur emise est toujours le texte saisi.
      controle = (
        <ChampSuggestions
          id={code}
          valeur={versTexte(valeur)}
          options={options}
          maxLength={contraintes.longueur_max}
          placeholder={placeholder}
          disabled={readonly}
          verrouille={verrouille && !readonly}
          invalide={!!erreur}
          etiquettePar={idEtiquette}
          decritPar={accessibilite["aria-describedby"]}
          onChange={changer}
        />
      );
      break;

    case "telephone":
      // Emet du E.164 ("+22890123456") ; meme normalisation cote backend
      // (apps.core.telephone) qui reste l'autorite de validation.
      controle = (
        <ChampTelephone
          id={code}
          valeur={versTexte(valeur)}
          disabled={readonly}
          verrouille={verrouille && !readonly}
          requis={champ.obligatoire}
          placeholder={placeholder}
          validationNative={false}
          onChange={(numero) => changer(numero === "" ? null : numero)}
        />
      );
      break;

    case "texte_long":
      controle = (
        <textarea
          id={code}
          className="eva-ctl eva-ctl--zone"
          rows={4}
          maxLength={contraintes.longueur_max}
          placeholder={placeholder}
          value={versTexte(valeur)}
          disabled={readonly}
          {...accessibilite}
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
          className="eva-ctl"
          maxLength={contraintes.longueur_max}
          placeholder={placeholder}
          value={versTexte(valeur)}
          disabled={readonly}
          {...accessibilite}
          onChange={(e) => changer(e.target.value)}
        />
      );
  }

  const noteLectureSeule = readonly
    ? `Valeur issue de ${champ.source_valeur_actuelle === "dhis2" ? "DHIS2" : "une saisie précédente"}, lecture seule.`
    : undefined;

  const classes = [
    "eva-fchamp",
    `eva-fchamp--c${colonnesChamp(champ)}`,
    erreur ? "eva-fchamp--erreur" : "",
    readonly ? "eva-fchamp--lecture" : "",
    verrouille && !readonly ? "eva-fchamp--verrouille" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-champ={code}>
      <label id={idEtiquette} htmlFor={code} className="eva-fchamp__label">
        <span>
          {champ.label}
          {champ.obligatoire && !readonly && (
            <span className="eva-fchamp__requis" title="Champ obligatoire" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </span>
        {champ.obligatoire && !readonly && <span className="eva-sr-seulement"> (obligatoire)</span>}
        {readonly && <span className="eva-fchamp__etiquette">Lecture seule</span>}
      </label>
      {controle}
      {(erreur || champ.aide || noteLectureSeule) && (
        <div id={idMessage} className={erreur ? "eva-fchamp__erreur" : "eva-fchamp__aide"}>
          {erreur ? (
            <>
              <AlertCircle size={14} aria-hidden="true" />
              <span>{erreur}</span>
            </>
          ) : (
            <span>{[champ.aide, noteLectureSeule].filter(Boolean).join(" ")}</span>
          )}
        </div>
      )}
    </div>
  );
}
