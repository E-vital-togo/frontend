interface Colonne {
  cle: string;
  libelle: string;
}

interface ProprietesTableDonnees {
  colonnes: Colonne[];
  lignes: Array<Record<string, string | number>>;
}

/**
 * Vue tabulaire de secours : quelques teintes de la palette categorielle
 * (magenta, jaune, aqua) passent sous le seuil de contraste texte sur fond
 * clair (voir skill dataviz, palette.md) - cette table est le canal de
 * secours qui rend la donnee lisible independamment de la couleur.
 */
export default function TableDonnees({ colonnes, lignes }: ProprietesTableDonnees) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tableau-standard">
        <thead>
          <tr>
            {colonnes.map((c) => (
              <th key={c.cle}>{c.libelle}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, i) => (
            <tr key={i}>
              {colonnes.map((c) => (
                <td key={c.cle} className={c.cle === "libelle" || c.cle === "periode" ? "" : "texte-mono"}>
                  {ligne[c.cle] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
