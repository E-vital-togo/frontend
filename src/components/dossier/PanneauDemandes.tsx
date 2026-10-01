import { FileClock } from "lucide-react";
import { Badge, Carte, EtatVide, Frise, Squelette } from "../ui";
import ComparaisonValeurs from "./ComparaisonValeurs";
import ErreurChargement from "./ErreurChargement";
import { formaterDateHeure, formaterValeurPourChamp } from "./utilitaires";
import type { ChampFormulaireEffectif, DemandeModificationActe } from "../../types/domaine";
import "../../styles/dossier.css";

const ETATS: Record<DemandeModificationActe["statut"], { texte: string; variante: "attente" | "succes" | "danger"; frise: "attention" | "defaut" | "erreur" }> = {
  en_attente: { texte: "En attente de validation", variante: "attente", frise: "attention" },
  validee: { texte: "Validée : acte réémis", variante: "succes", frise: "defaut" },
  rejetee: { texte: "Rejetée", variante: "danger", frise: "erreur" }
};

interface ProprietesPanneauDemandes {
  demandes: DemandeModificationActe[] | null;
  erreur: string | null;
  champs: ChampFormulaireEffectif[];
  horsLigne: boolean;
  onReessayer: () => void;
}

export default function PanneauDemandes({ demandes, erreur, champs, horsLigne, onReessayer }: ProprietesPanneauDemandes) {
  const parCode = new Map(champs.map((c) => [c.data_element_code, c]));

  return (
    <Carte
      titre="Demandes de modification de l'acte"
      description="Une fois l'acte émis, toute correction est soumise à la validation d'un administrateur."
    >
      {erreur ? (
        <ErreurChargement titre="Demandes indisponibles" message={erreur} horsLigne={horsLigne} onReessayer={onReessayer} />
      ) : demandes === null ? (
        <Squelette variante="texte" lignes={4} libelle="Chargement des demandes" />
      ) : demandes.length === 0 ? (
        <EtatVide
          compact
          variante="neutre"
          icone={<FileClock size={24} />}
          titre="Aucune demande de modification"
          description="Une demande se dépose depuis ce dossier, une fois l'acte émis."
        />
      ) : (
        <Frise
          elements={demandes.map((d) => {
            const etat = ETATS[d.statut];
            const lignes = Object.entries(d.champs_modifies).map(([code, valeurs]) => {
              const champ = parCode.get(code);
              return {
                cle: code,
                libelle: champ?.label ?? code,
                avant: formaterValeurPourChamp(champ, valeurs.ancienne_valeur),
                apres: formaterValeurPourChamp(champ, valeurs.nouvelle_valeur)
              };
            });
            return {
              id: d.id,
              date: formaterDateHeure(d.created_at),
              variante: etat.frise,
              titre: (
                <span className="eva-dd-frise-titre">
                  <Badge variante={etat.variante} point>
                    {etat.texte}
                  </Badge>
                  <span className="eva-dd-source">
                    Validation {d.niveau_requis === "national" ? "nationale" : "régionale"} requise
                    {d.demandeur_nom ? `, demandée par ${d.demandeur_nom}` : ""}
                  </span>
                </span>
              ),
              contenu: (
                <div className="eva-dd-demande">
                  <ComparaisonValeurs
                    compacte
                    lignes={lignes}
                    libelleApres="Valeur demandée"
                    ariaLabel="Valeurs demandées pour la correction"
                  />
                  {d.decided_at && (
                    <p className="eva-dd-decision">
                      <strong>Décision du {formaterDateHeure(d.decided_at)}</strong>
                      {d.validateur_nom ? ` par ${d.validateur_nom}` : ""}
                      {d.commentaire_validateur && <span className="eva-dd-decision__commentaire">« {d.commentaire_validateur} »</span>}
                    </p>
                  )}
                </div>
              )
            };
          })}
        />
      )}
    </Carte>
  );
}
