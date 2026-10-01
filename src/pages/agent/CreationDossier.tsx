import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Baby, CloudOff, FileText, Flower2, Gavel } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Alerte, Bouton, Carte, Champ, EnteteDePage, LienBouton } from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { mettreEnFileAction } from "../../lib/db";
import { useConnectivite } from "../../lib/connectivite";
import { LIENS_AGENT } from "./navigation";
import type { Dossier, TypeDossier, TypeEvenement } from "../../types/domaine";
import "../../styles/agent.css";

interface OptionChoix<V extends string> {
  valeur: V;
  titre: string;
  description: string;
  icone: ReactNode;
}

/** Choix exclusif présenté en cartes (boutons radio natifs : clavier et lecteurs d'écran inchangés). */
function GroupeChoix<V extends string>({
  nom,
  legende,
  valeur,
  options,
  onChanger
}: {
  nom: string;
  legende: string;
  valeur: V;
  options: OptionChoix<V>[];
  onChanger: (valeur: V) => void;
}) {
  return (
    <fieldset className="eva-ag-choix">
      <legend className="eva-ag-choix__legende">
        {legende}
        <span className="eva-champ__requis" aria-hidden="true">
          *
        </span>
      </legend>
      <div className="eva-ag-choix__grille">
        {options.map((option) => (
          <label key={option.valeur} className="eva-ag-choix__option">
            <input
              type="radio"
              className="eva-ag-choix__entree"
              name={nom}
              value={option.valeur}
              checked={valeur === option.valeur}
              onChange={() => onChanger(option.valeur)}
            />
            <span className="eva-ag-choix__carte">
              <span className="eva-ag-choix__icone" aria-hidden="true">
                {option.icone}
              </span>
              <span className="eva-ag-choix__texte">
                <span className="eva-ag-choix__titre">{option.titre}</span>
                <span className="eva-ag-choix__description">{option.description}</span>
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CreationDossier() {
  const navigate = useNavigate();
  const enLigne = useConnectivite();
  const [eventType, setEventType] = useState<TypeEvenement>("naissance");
  const [typeDossier, setTypeDossier] = useState<TypeDossier>("declaration");
  const [dossierLie, setDossierLie] = useState("");
  const [dateDeclaration, setDateDeclaration] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);

    const corps: Record<string, unknown> = { event_type: eventType, type_dossier: typeDossier, date_declaration: dateDeclaration };
    if (typeDossier === "jugement" && dossierLie) corps.dossier_lie = dossierLie;

    try {
      if (enLigne) {
        const dossier = await appelApi<Dossier>("/dossiers/", { methode: "POST", corps });
        navigate(`/agent/dossiers/${dossier.id}`);
      } else {
        await mettreEnFileAction({ type: "creation_dossier", payload: corps });
        navigate("/agent", { state: { messageCreationHorsLigne: true } });
      }
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur inattendue est survenue. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Nouveau dossier"
        sousTitre="À utiliser quand le parent ou le déclarant se présente directement, sans Tracker Event DHIS2 disponible."
        filAriane={[{ libelle: "Dossiers", vers: "/agent/dossiers" }, { libelle: "Nouveau dossier" }]}
      />

      {!enLigne && (
        <Alerte className="eva-ag-alerte-liste" variante="avertissement" icone={<CloudOff size={18} aria-hidden="true" />} titre="Vous êtes hors ligne">
          Le dossier sera enregistré sur cet appareil, puis créé automatiquement dès le retour de la connexion.
        </Alerte>
      )}
      {erreur && (
        <Alerte className="eva-ag-alerte-liste" variante="erreur" titre="Le dossier n'a pas pu être créé" onFermer={() => setErreur(null)}>
          {erreur}
        </Alerte>
      )}

      <Carte className="eva-largeur-moyenne">
        <form onSubmit={soumettre} className="eva-pile eva-pile--large">
          <GroupeChoix<TypeEvenement>
            nom="event-type"
            legende="Type d'événement"
            valeur={eventType}
            onChanger={setEventType}
            options={[
              { valeur: "naissance", titre: "Naissance", description: "Enregistrer la naissance d'un enfant.", icone: <Baby size={22} /> },
              { valeur: "deces", titre: "Décès", description: "Enregistrer le décès d'une personne.", icone: <Flower2 size={22} /> }
            ]}
          />

          <GroupeChoix<TypeDossier>
            nom="type-dossier"
            legende="Type de dossier"
            valeur={typeDossier}
            onChanger={setTypeDossier}
            options={[
              { valeur: "declaration", titre: "Déclaration", description: "Cas général : première déclaration de l'événement.", icone: <FileText size={22} /> },
              {
                valeur: "jugement",
                titre: "Jugement / autorité",
                description: "Après un jugement supplétif (naissance) ou une déclaration de l'autorité (décès).",
                icone: <Gavel size={22} />
              }
            ]}
          />

          <div className="eva-grille eva-grille--2 eva-grille--debut">
            <Champ id="date-declaration" label="Date de déclaration" requis aide="Jour où le déclarant s'est présenté au centre.">
              <input id="date-declaration" type="date" required value={dateDeclaration} onChange={(e) => setDateDeclaration(e.target.value)} />
            </Champ>
            {typeDossier === "jugement" && (
              <Champ
                id="dossier-lie"
                label="Dossier d'origine expiré (facultatif)"
                aide="Identifiant du dossier « sans suite » concerné, pour en reprendre les informations déjà connues. Laisser vide pour repartir de zéro."
              >
                <input
                  id="dossier-lie"
                  className="texte-mono"
                  placeholder="Identifiant du dossier"
                  value={dossierLie}
                  onChange={(e) => setDossierLie(e.target.value)}
                />
              </Champ>
            )}
          </div>

          <div className="eva-groupe-boutons eva-ag-formulaire__actions">
            <Bouton type="submit" chargement={enCours}>
              {enLigne ? "Créer le dossier" : "Enregistrer hors ligne"}
            </Bouton>
            <LienBouton to="/agent/dossiers" variante="fantome">
              Annuler
            </LienBouton>
          </div>
        </form>
      </Carte>
    </MiseEnPage>
  );
}
