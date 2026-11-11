import { useState, type ReactNode } from "react";
import { ChevronDown, ClipboardX } from "lucide-react";
import FormulaireDossier from "../FormulaireDossier";
import { Alerte, Carte, EtatVide, useMediaQuery } from "../ui";
import type { ChampFormulaireEffectif, MiseEnPage } from "../../types/domaine";
import { useConnectivite } from "../../lib/connectivite";
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
  const enLigne = useConnectivite();
  // Sur téléphone, la liste complète poussait le formulaire hors de l'écran :
  // l'alerte reste un titre court, la liste s'ouvre à la demande.
  const mobile = useMediaQuery("(max-width: 720px)");
  const [listeOuverte, setListeOuverte] = useState(false);
  const nbManquants = manquantsAvantValidation.length;
  const listeVisible = !mobile || listeOuverte;
  const titreAlerte = mobile
    ? `${nbManquants} ${nbManquants > 1 ? "champs obligatoires" : "champ obligatoire"} à renseigner`
    : nbManquants > 1
      ? `${nbManquants} champs obligatoires à renseigner avant de marquer le dossier complet`
      : "1 champ obligatoire à renseigner avant de marquer le dossier complet";

  return (
    <div className="eva-dd-panneau">
      {nbManquants > 0 && (
        <Alerte variante="avertissement" titre={titreAlerte} compacte={mobile}>
          {mobile && (
            <button
              type="button"
              className="eva-dd-bascule-manquants"
              aria-expanded={listeOuverte}
              aria-controls={`manquants-${idDossier}`}
              onClick={() => setListeOuverte((o) => !o)}
            >
              {listeOuverte ? "Masquer la liste" : "Voir la liste"}
              <ChevronDown size={14} aria-hidden="true" className={listeOuverte ? "est-ouvert" : undefined} />
            </button>
          )}
          {listeVisible && (
            <ul className="eva-dd-liste-manquants" id={`manquants-${idDossier}`}>
              {manquantsAvantValidation.map((champ) => (
                <li key={champ.data_element_code}>{champ.label}</li>
              ))}
            </ul>
          )}
          {listeVisible && modificationsEnAttente && (
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
            description={
              enLigne
                ? "Aucun champ n'est configuré pour ce type de dossier. L'Admin Général règle les champs des formulaires."
                : "Le formulaire de ce dossier n'est pas conservé sur l'appareil. Il s'affichera au retour du réseau."
            }
          />
        )}
      </Carte>
    </div>
  );
}
