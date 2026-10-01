import { useMemo } from "react";
import { Check, GitCompareArrows, X } from "lucide-react";
import { Bouton, Carte } from "../ui";
import ComparaisonValeurs, { type LigneComparaison } from "./ComparaisonValeurs";
import { formaterDateHeure, formaterValeurPourChamp } from "./utilitaires";
import type { ChampFormulaireEffectif, NouvelleVersionDossier } from "../../types/domaine";
import "../../styles/dossier.css";

interface ProprietesPropositionDhis2 {
  proposition: NouvelleVersionDossier;
  champs: ChampFormulaireEffectif[];
  decisionEnCours: boolean;
  horsLigne: boolean;
  onAccepter: () => void;
  onRefuser: () => void;
}

/**
 * Mise à jour reçue de DHIS2 pendant que le dossier existe déjà : rien n'est
 * appliqué tant que l'agent n'a pas décidé. Présente les différences champ par
 * champ (avant / après) puis les deux décisions.
 */
export default function PropositionDhis2({ proposition, champs, decisionEnCours, horsLigne, onAccepter, onRefuser }: ProprietesPropositionDhis2) {
  const lignes = useMemo<LigneComparaison[]>(() => {
    const parCode = new Map(champs.map((c) => [c.data_element_code, c]));
    return proposition.champs_modifies.map((diff, index) => {
      const champ = diff.data_element_code ? parCode.get(diff.data_element_code) : undefined;
      return {
        cle: `${diff.data_element_code ?? "champ"}-${index}`,
        libelle: diff.label || champ?.label || diff.data_element_code || "-",
        avant: formaterValeurPourChamp(champ, diff.valeur_actuelle),
        apres: formaterValeurPourChamp(champ, diff.valeur_proposee)
      };
    });
  }, [proposition, champs]);

  const nombre = lignes.length;

  return (
    <Carte
      variante="attention"
      className="eva-dd-proposition"
      titre={
        <span className="eva-dd-titre-icone">
          <GitCompareArrows size={18} aria-hidden="true" />
          Mise à jour reçue depuis DHIS2
        </span>
      }
      description={`L'hôpital a transmis ${nombre > 1 ? `${nombre} valeurs différentes` : "une valeur différente"} de celles déjà connues${
        proposition.created_at ? ` (reçue le ${formaterDateHeure(proposition.created_at)})` : ""
      }. Rien n'a été appliqué : comparez, puis décidez.`}
      pied={
        <>
          {horsLigne && <p className="eva-dd-pied-note">Cette décision nécessite une connexion au serveur.</p>}
          <div className="eva-dd-pied-actions">
            <Bouton variante="secondaire" onClick={onRefuser} disabled={decisionEnCours} iconeGauche={<X size={16} />}>
              Refuser la mise à jour
            </Bouton>
            <Bouton onClick={onAccepter} chargement={decisionEnCours} iconeGauche={!decisionEnCours && <Check size={16} />}>
              Accepter la mise à jour
            </Bouton>
          </div>
        </>
      }
    >
      <ComparaisonValeurs lignes={lignes} ariaLabel="Différences entre les valeurs actuelles et proposées" />
    </Carte>
  );
}
