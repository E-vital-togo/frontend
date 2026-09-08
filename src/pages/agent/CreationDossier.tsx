import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import { useToast } from "../../context/ToastContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { mettreEnFileAction } from "../../lib/db";
import { LIENS_AGENT } from "./navigation";
import type { Dossier, TypeEvenement } from "../../types/domaine";

export default function CreationDossier() {
  const navigate = useNavigate();
  const [eventType, setEventType] = useState<TypeEvenement>("naissance");
  const [dateDeclaration, setDateDeclaration] = useState("");
  const [enCours, setEnCours] = useState(false);
  const { notifier } = useToast();

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);

    try {
      if (navigator.onLine) {
        const dossier = await appelApi<Dossier>("/dossiers/", {
          methode: "POST",
          corps: { event_type: eventType, type_dossier: "declaration", date_declaration: dateDeclaration }
        });
        navigate(`/agent/dossiers/${dossier.id}`);
      } else {
        await mettreEnFileAction({
          type: "creation_dossier",
          payload: { event_type: eventType, type_dossier: "declaration", date_declaration: dateDeclaration }
        });
        navigate("/agent", { state: { messageCreationHorsLigne: true } });
      }
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <PageHeader
        titre="Nouveau dossier (declaration papier)"
        description="A utiliser quand le parent/declarant se presente directement, sans Tracker Event DHIS2 disponible."
      />
      <form onSubmit={soumettre} className="carte" style={{ maxWidth: 420 }}>
        <div className="champ">
          <label htmlFor="event-type">Type d'evenement</label>
          <select id="event-type" value={eventType} onChange={(e) => setEventType(e.target.value as TypeEvenement)}>
            <option value="naissance">Naissance</option>
            <option value="deces">Deces</option>
          </select>
        </div>
        <div className="champ">
          <label htmlFor="date-declaration">Date de declaration</label>
          <input
            id="date-declaration"
            type="date"
            required
            value={dateDeclaration}
            onChange={(e) => setDateDeclaration(e.target.value)}
          />
        </div>
        <button type="submit" className="bouton-principal" disabled={enCours}>
          {enCours ? "Creation..." : "Creer le dossier"}
        </button>
      </form>
    </MiseEnPage>
  );
}
