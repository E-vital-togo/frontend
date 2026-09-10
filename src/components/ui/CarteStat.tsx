import type { ReactNode } from "react";

interface ProprietesCarteStat {
  icone?: ReactNode;
  valeur: ReactNode;
  libelle: string;
  alerte?: boolean;
}

export default function CarteStat({ icone, valeur, libelle, alerte }: ProprietesCarteStat) {
  return (
    <div className={`eva-carte eva-carte-stat${alerte ? " eva-carte-stat--alerte" : ""}`}>
      {icone && <div className="eva-carte-stat__icone">{icone}</div>}
      <div className="eva-carte-stat__valeur">{valeur}</div>
      <div className="eva-carte-stat__libelle">{libelle}</div>
    </div>
  );
}
