import { useEffect, useState } from "react";
import { History, PackageCheck, Undo2 } from "lucide-react";
import { Alerte, Badge, Bouton } from "../ui";
import { appelApi } from "../../lib/apiClient";
import { MODES_VERIFICATION, dateHeureRetrait, libellePiece, libelleQualite } from "../../lib/retrait";
import type { EntreeJournalRetrait, ReponseRetrait, ResumeRetrait } from "../../types/domaine";
import "../../styles/retrait.css";

interface ProprietesBandeauRetrait {
  idDossier: string;
  retrait: ResumeRetrait;
  /** L'administrateur du centre d'état civil peut annuler un retrait. */
  peutAnnuler: boolean;
  onAnnuler: () => void;
  /** Change quand le retrait change (le journal est relu). */
  version: string;
}

/** Dossier dont l'acte a été retiré : qui, quand, à qui, comment, et l'historique des retraits et annulations. */
export default function BandeauRetrait({ idDossier, retrait, peutAnnuler, onAnnuler, version }: ProprietesBandeauRetrait) {
  const [ouvert, setOuvert] = useState(false);
  const [journal, setJournal] = useState<EntreeJournalRetrait[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    setJournal(null);
    setErreur(false);
  }, [version]);

  useEffect(() => {
    if (!ouvert || journal !== null || erreur) return;
    appelApi<ReponseRetrait>(`/dossiers/${idDossier}/acte/retrait`)
      .then((reponse) => setJournal(reponse.historique ?? []))
      .catch(() => setErreur(true));
  }, [ouvert, journal, erreur, idDossier]);

  const details = [
    retrait.retire_nom_receveur && `Remis à ${retrait.retire_nom_receveur}${retrait.retire_qualite ? ` (${libelleQualite(retrait.retire_qualite).toLowerCase()})` : ""}`,
    retrait.retire_piece && `pièce : ${libellePiece(retrait.retire_piece)}`,
    retrait.retire_mode_verification && MODES_VERIFICATION[retrait.retire_mode_verification]
  ].filter(Boolean);

  return (
    <Alerte
      variante="succes"
      titre={`Acte retiré le ${dateHeureRetrait(retrait.retire_le)}${retrait.retire_par_nom ? ` par ${retrait.retire_par_nom}` : ""}`}
      icone={<PackageCheck size={18} aria-hidden="true" />}
      className="eva-dd-bandeau"
      actions={
        <>
          <Bouton variante="fantome" iconeGauche={<History size={15} />} onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
            {ouvert ? "Masquer l'historique du retrait" : "Historique du retrait"}
          </Bouton>
          {peutAnnuler && (
            <Bouton variante="danger" iconeGauche={<Undo2 size={15} />} onClick={onAnnuler}>
              Annuler le retrait
            </Bouton>
          )}
        </>
      }
    >
      {details.join(" ; ")}
      {retrait.retire_note ? ` - Note : ${retrait.retire_note}` : ""}
      {ouvert && (
        <div className="eva-rt-historique" aria-live="polite">
          {erreur && <span>L'historique n'a pas pu être chargé.</span>}
          {!erreur && journal === null && <span>Chargement de l'historique...</span>}
          {journal && journal.length === 0 && <span>Aucune entrée.</span>}
          {journal && journal.length > 0 && (
            <ul>
              {journal.map((e) => (
                <li key={e.id}>
                  <Badge variante={e.action === "retrait" ? "succes" : "attente"}>{e.action === "retrait" ? "Retrait" : "Annulation"}</Badge>
                  <span>
                    {dateHeureRetrait(e.date)} par {e.utilisateur_nom || "inconnu"}
                    {e.action === "retrait"
                      ? `, remis à ${e.nom_receveur}${e.qualite ? ` (${libelleQualite(e.qualite).toLowerCase()})` : ""}${e.mode_verification ? `, ${MODES_VERIFICATION[e.mode_verification].toLowerCase()}` : ""}`
                      : ` - motif : ${e.motif}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Alerte>
  );
}
