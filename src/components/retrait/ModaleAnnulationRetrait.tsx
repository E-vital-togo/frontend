import { useState, type FormEvent } from "react";
import { Alerte, Bouton, Champ, Modale } from "../ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { dateHeureRetrait, libelleQualite } from "../../lib/retrait";
import type { ReponseRetrait, ResumeRetrait } from "../../types/domaine";
import "../../styles/retrait.css";

interface ProprietesModaleAnnulationRetrait {
  idDossier: string;
  retrait: ResumeRetrait;
  onFermer: () => void;
  onAnnule: () => void;
}

const MOTIF_MIN = 5;

/** Annulation d'un retrait (administrateur du centre d'état civil) : motif obligatoire, trace conservée. */
export default function ModaleAnnulationRetrait({ idDossier, retrait, onFermer, onAnnule }: ProprietesModaleAnnulationRetrait) {
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function annuler(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (motif.trim().length < MOTIF_MIN) return;
    setEnCours(true);
    setErreur(null);
    try {
      await appelApi<ReponseRetrait>(`/dossiers/${idDossier}/acte/retrait/annuler`, { methode: "POST", corps: { motif: motif.trim() } });
      onAnnule();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "L'annulation n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale titre="Annuler le retrait de l'acte" taille="moyen" onFermer={onFermer} fermerAuClicFond={false}>
      <form onSubmit={annuler} noValidate className="eva-rt-formulaire">
        <Alerte variante="avertissement" titre="Le retrait redeviendra « à retirer »">
          Retrait du {dateHeureRetrait(retrait.retire_le)}
          {retrait.retire_par_nom ? ` enregistré par ${retrait.retire_par_nom}` : ""}
          {retrait.retire_nom_receveur ? `, remis à ${retrait.retire_nom_receveur}` : ""}
          {retrait.retire_qualite ? ` (${libelleQualite(retrait.retire_qualite).toLowerCase()})` : ""}. La trace de ce retrait, votre nom et le motif restent consignés dans l'historique.
        </Alerte>
        <Champ id="annulation-motif" label="Motif de l'annulation" requis aide={`Obligatoire, ${MOTIF_MIN} caractères au minimum.`}>
          <textarea id="annulation-motif" rows={3} maxLength={1000} value={motif} onChange={(e) => setMotif(e.target.value)} autoFocus required />
        </Champ>
        {erreur && <Alerte variante="erreur" compacte>{erreur}</Alerte>}
        <div className="eva-modale__actions">
          <Bouton type="button" variante="secondaire" onClick={onFermer} disabled={enCours}>
            Garder le retrait
          </Bouton>
          <Bouton type="submit" variante="danger-plein" chargement={enCours} disabled={motif.trim().length < MOTIF_MIN}>
            Annuler le retrait
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
