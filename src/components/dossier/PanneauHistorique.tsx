import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { Bouton, Carte, EtatVide, Frise, PilulesFiltre, Squelette } from "../ui";
import ErreurChargement from "./ErreurChargement";
import { formaterDateHeure, formaterValeurPourChamp, libelleSource } from "./utilitaires";
import type { ChampFormulaireEffectif, ValeurChamp } from "../../types/domaine";
import "../../styles/dossier.css";

const TAILLE_PAGE = 25;

interface ProprietesPanneauHistorique {
  historique: ValeurChamp[] | null;
  erreur: string | null;
  champs: ChampFormulaireEffectif[];
  horsLigne: boolean;
  onReessayer: () => void;
}

export default function PanneauHistorique({ historique, erreur, champs, horsLigne, onReessayer }: ProprietesPanneauHistorique) {
  const [source, setSource] = useState("");
  const [limite, setLimite] = useState(TAILLE_PAGE);
  const parCode = useMemo(() => new Map(champs.map((c) => [c.data_element_code, c])), [champs]);

  const sources = useMemo(() => {
    const compte = new Map<string, number>();
    for (const valeur of historique ?? []) compte.set(valeur.source, (compte.get(valeur.source) ?? 0) + 1);
    return Array.from(compte.entries());
  }, [historique]);

  const filtre = useMemo(() => (historique ?? []).filter((v) => !source || v.source === source), [historique, source]);
  const visibles = filtre.slice(0, limite);

  return (
    <Carte
      titre="Historique des valeurs"
      description="Chaque valeur enregistrée sur ce dossier, avec sa date et son auteur."
    >
      {erreur ? (
        <ErreurChargement titre="Historique indisponible" message={erreur} horsLigne={horsLigne} onReessayer={onReessayer} />
      ) : historique === null ? (
        <Squelette variante="texte" lignes={5} libelle="Chargement de l'historique" />
      ) : historique.length === 0 ? (
        <EtatVide
          compact
          variante="neutre"
          icone={<History size={24} />}
          titre="Aucune valeur enregistrée"
          description="Les valeurs saisies ou reçues pour ce dossier apparaîtront ici."
        />
      ) : (
        <div className="eva-dd-historique">
          {sources.length > 1 && (
            <PilulesFiltre
              ariaLabel="Filtrer l'historique par source"
              valeur={source}
              onChanger={(valeur) => {
                setSource(valeur);
                setLimite(TAILLE_PAGE);
              }}
              defilement
              pilules={[
                { valeur: "", libelle: "Toutes les sources", compteur: historique.length },
                ...sources.map(([code, nombre]) => ({ valeur: code, libelle: libelleSource(code), compteur: nombre }))
              ]}
            />
          )}
          <Frise
            elements={visibles.map((v) => {
              const champ = parCode.get(v.data_element_code);
              return {
                id: v.id,
                date: formaterDateHeure(v.created_at),
                titre: champ?.label ?? v.data_element_code,
                variante: v.source === "dhis2" ? "neutre" : "defaut",
                contenu: (
                  <>
                    <span className="eva-dd-valeur">{formaterValeurPourChamp(champ, v.valeur)}</span>
                    <span className="eva-dd-source">{libelleSource(v.source)}</span>
                  </>
                )
              };
            })}
          />
          {filtre.length > visibles.length && (
            <div className="eva-dd-plus">
              <Bouton variante="secondaire" onClick={() => setLimite((l) => l + TAILLE_PAGE)}>
                Afficher plus ({filtre.length - visibles.length} {filtre.length - visibles.length > 1 ? "restantes" : "restante"})
              </Bouton>
            </div>
          )}
        </div>
      )}
    </Carte>
  );
}
