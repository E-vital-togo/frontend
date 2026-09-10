import type { ReactNode } from "react";

interface ProprietesChamp {
  id: string;
  label: string;
  aide?: string;
  erreur?: string;
  requis?: boolean;
  children: ReactNode;
}

/**
 * Enveloppe uniforme label + controle + aide/erreur pour tout champ de
 * formulaire de l'app. Le controle (input/select/textarea) reste natif et
 * passe par l'enfant, pour ne jamais limiter ce qu'un ecran peut en faire.
 */
export default function Champ({ id, label, aide, erreur, requis, children }: ProprietesChamp) {
  return (
    <div className={`eva-champ${erreur ? " eva-champ--erreur" : ""}`}>
      <label htmlFor={id}>
        {label}
        {requis && <span style={{ color: "var(--couleur-erreur)" }}> *</span>}
      </label>
      {children}
      {erreur ? <div className="eva-champ__erreur">{erreur}</div> : aide ? <div className="eva-champ__aide">{aide}</div> : null}
    </div>
  );
}
