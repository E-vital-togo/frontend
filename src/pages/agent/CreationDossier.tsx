import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import { Bouton, Carte, Champ, EnteteDePage } from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { mettreEnFileAction } from "../../lib/db";
import { LIENS_AGENT } from "./navigation";
import type { Dossier, TypeDossier, TypeEvenement } from "../../types/domaine";

export default function CreationDossier() {
  const navigate = useNavigate();
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
      if (navigator.onLine) {
        const dossier = await appelApi<Dossier>("/dossiers/", { methode: "POST", corps });
        navigate(`/agent/dossiers/${dossier.id}`);
      } else {
        await mettreEnFileAction({ type: "creation_dossier", payload: corps });
        navigate("/agent", { state: { messageCreationHorsLigne: true } });
      }
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage titre="Nouveau dossier" sousTitre="A utiliser quand le parent/declarant se presente directement, sans Tracker Event DHIS2 disponible." />
      {erreur && <div className="message-erreur">{erreur}</div>}
      <Carte style={{ maxWidth: 460 }}>
        <form onSubmit={soumettre}>
          <Champ id="event-type" label="Type d'evenement" requis>
            <select id="event-type" value={eventType} onChange={(e) => setEventType(e.target.value as TypeEvenement)}>
              <option value="naissance">Naissance</option>
              <option value="deces">Deces</option>
            </select>
          </Champ>
          <Champ id="type-dossier" label="Type de dossier" requis aide={typeDossier === "jugement" ? "A utiliser apres un jugement supletif (naissance) ou une declaration de l'autorite (deces), suite a un dossier expire (sans suite)." : undefined}>
            <select id="type-dossier" value={typeDossier} onChange={(e) => setTypeDossier(e.target.value as TypeDossier)}>
              <option value="declaration">Declaration</option>
              <option value="jugement">Jugement / declaration de l'autorite</option>
            </select>
          </Champ>
          {typeDossier === "jugement" && (
            <Champ id="dossier-lie" label="Dossier d'origine expire (optionnel)" aide="Identifiant du dossier 'sans suite' concerne, pour en reprendre les informations deja connues. Laisser vide pour repartir de zero.">
              <input
                id="dossier-lie"
                placeholder="Identifiant du dossier"
                value={dossierLie}
                onChange={(e) => setDossierLie(e.target.value)}
              />
            </Champ>
          )}
          <Champ id="date-declaration" label="Date de declaration" requis>
            <input
              id="date-declaration"
              type="date"
              required
              value={dateDeclaration}
              onChange={(e) => setDateDeclaration(e.target.value)}
            />
          </Champ>
          <Bouton type="submit" chargement={enCours}>
            Creer le dossier
          </Bouton>
        </form>
      </Carte>
    </MiseEnPage>
  );
}
