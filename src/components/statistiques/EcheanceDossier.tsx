import { Badge } from "../ui";
import { joursRestants } from "../../lib/urgence";
import "../../styles/statistiques.css";

/** Libelle et gravite de l'echeance : le rouge commence a J-3, l'orange a J-10 (memes seuils que lib/urgence.ts). */
export function decrireEcheance(jours: number): { libelle: string; variante: "danger" | "attente" | "succes" } {
  if (jours < 0) return { libelle: `En retard de ${-jours} j`, variante: "danger" };
  if (jours === 0) return { libelle: "Dernier jour", variante: "danger" };
  const libelle = `${jours} jour${jours > 1 ? "s" : ""}`;
  if (jours <= 3) return { libelle, variante: "danger" };
  if (jours <= 10) return { libelle, variante: "attente" };
  return { libelle, variante: "succes" };
}

function formaterDate(date: string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("fr-FR");
}

/** Echeance d'un dossier : pastille de gravite et date limite en police de donnees. */
export default function EcheanceDossier({ dateLimite }: { dateLimite: string }) {
  const { libelle, variante } = decrireEcheance(joursRestants(dateLimite));
  return (
    <span className="eva-st-echeance">
      <Badge variante={variante} point>
        {libelle}
      </Badge>
      <span className="eva-st-echeance__date texte-mono">{formaterDate(dateLimite)}</span>
    </span>
  );
}
