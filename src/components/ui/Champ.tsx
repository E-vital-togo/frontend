import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import Selecteur from "./Selecteur";
import ChampSuggestions from "./ChampSuggestions";
import { cx } from "./utilitaires";

interface ProprietesChamp {
  id: string;
  label: string;
  aide?: string;
  erreur?: string;
  requis?: boolean;
  verrouille?: boolean;
  className?: string;
  children: ReactNode;
}

const CONTROLES_NATIFS = new Set(["input", "select", "textarea"]);

/**
 * Enveloppe uniforme label + controle + aide/erreur pour tout champ de
 * formulaire de l'app. Le controle (input/select/textarea) reste natif et
 * passe par l'enfant, pour ne jamais limiter ce qu'un ecran peut en faire.
 * Quand l'enfant est un unique controle natif, l'aide et l'erreur lui sont
 * reliees (aria-describedby, aria-invalid) pour les lecteurs d'ecran.
 */
export default function Champ({ id, label, aide, erreur, requis, verrouille, className, children }: ProprietesChamp) {
  const idMessage = erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined;

  let controle = children;
  if (idMessage && isValidElement(children) && typeof children.type === "string" && CONTROLES_NATIFS.has(children.type)) {
    const element = children as ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>;
    controle = cloneElement(element, {
      "aria-describedby": element.props["aria-describedby"] ?? idMessage,
      "aria-invalid": erreur ? true : element.props["aria-invalid"]
    });
  }

  // Selecteur et ChampSuggestions : meme liaison (aide/erreur decrites, etat invalide) que pour un controle natif.
  if (isValidElement(children) && (children.type === Selecteur || children.type === ChampSuggestions)) {
    const element = children as ReactElement<{ decritPar?: string; invalide?: boolean }>;
    controle = cloneElement(element, {
      decritPar: element.props.decritPar ?? idMessage,
      invalide: element.props.invalide ?? !!erreur
    });
  }

  return (
    <div className={cx("eva-champ", erreur && "eva-champ--erreur", verrouille && "eva-champ--verrouille", className)}>
      <label htmlFor={id}>
        {label}
        {requis && <span className="eva-champ__requis" aria-hidden="true">*</span>}
      </label>
      {controle}
      {erreur ? (
        <div className="eva-champ__erreur" id={`${id}-erreur`} role="alert">
          {erreur}
        </div>
      ) : aide ? (
        <div className="eva-champ__aide" id={`${id}-aide`}>
          {aide}
        </div>
      ) : null}
    </div>
  );
}
