export interface Onglet {
  id: string;
  libelle: string;
}

interface ProprietesOnglets {
  onglets: Onglet[];
  actif: string;
  onChanger: (id: string) => void;
}

export default function Onglets({ onglets, actif, onChanger }: ProprietesOnglets) {
  return (
    <div className="eva-onglets" role="tablist">
      {onglets.map((onglet) => (
        <button
          key={onglet.id}
          role="tab"
          aria-selected={onglet.id === actif}
          className={`eva-onglet${onglet.id === actif ? " eva-onglet--actif" : ""}`}
          onClick={() => onChanger(onglet.id)}
        >
          {onglet.libelle}
        </button>
      ))}
    </div>
  );
}
