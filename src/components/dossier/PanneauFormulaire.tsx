import type { ReactNode } from "react";
import { ClipboardX } from "lucide-react";
import FormulaireDossier from "../FormulaireDossier";
import { Alerte, Carte, EtatVide } from "../ui";
import type { ChampFormulaireEffectif, MiseEnPage } from "../../types/domaine";
import "../../styles/dossier.css";

interface ProprietesPanneauFormulaire {
  idDossier: string;
  champs: ChampFormulaireEffectif[];
  miseEnPage: MiseEnPage | null;
  valeurs: Record<string, unknown>;
  onChange: (codeChamp: string, valeur: unknown) => void;
  verrouille: boolean;
  /** Dernier pas du formulaire par étapes (le bouton d'enregistrement existant). */
  actionFinale: ReactNode;
  /** Champs obligatoires encore vides, à signaler seulement si le dossier peut être marqué complet. */
  manquantsAvantValidation: ChampFormulaireEffectif[];
  /** Des saisies non enregistrées existent : la liste ci-dessus reflète les valeurs déjà enregistrées. */
  modificationsEnAttente: boolean;
}

export default function PanneauFormulaire({
  idDossier,
  champs,
  miseEnPage,
  valeurs,
  onChange,
  verrouille,
  actionFinale,
  manquantsAvantValidation,
  modificationsEnAttente
}: ProprietesPanneauFormulaire) {
  return (
    <div className="eva-dd-panneau">
      {manquantsAvantValidation.length > 0 && (
        <Alerte
          variante="avertissement"
          titre={
            manquantsAvantValidation.length > 1
              ? `${manquantsAvantValidation.length} champs obligatoires à renseigner avant de marquer le dossier complet`
              : "1 champ obligatoire à renseigner avant de marquer le dossier complet"
          }
        >
          <ul className="eva-dd-liste-manquants">
            {manquantsAvantValidation.map((champ) => (
              <li key={champ.data_element_code}>{champ.label}</li>
            ))}
          </ul>
          {modificationsEnAttente && (
            <p className="eva-dd-note-alerte">Cette liste tient compte des valeurs enregistrées : enregistrez vos modifications pour la mettre à jour.</p>
          )}
        </Alerte>
      )}

      <Carte className="eva-dd-carte-formulaire">
        {champs.length > 0 ? (
          <FormulaireDossier
            key={idDossier}
            champs={champs}
            miseEnPage={miseEnPage}
            valeurs={valeurs}
            onChange={onChange}
            verrouille={verrouille}
            cleMemorisation={idDossier}
            sautLibre
            actionFinale={actionFinale}
          />
        ) : (
          <EtatVide
            compact
            variante="neutre"
            icone={<ClipboardX size={24} />}
            titre="Aucun champ à afficher"
            description="Le formulaire de ce dossier n'est pas disponible. S'il a été ouvert hors ligne, reconnectez-vous pour le charger."
          />
        )}
      </Carte>
    </div>
  );
}
