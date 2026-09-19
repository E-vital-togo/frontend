import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import DemandeCorrectionActe from "../../components/DemandeCorrectionActe";
import { AncreBouton, Champ, ChargementPage, EnteteDePage } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { appelApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";

// Le volet N°4 (INSEED) n'existe plus sur le formulaire national depuis que
// l'INSEED accede directement aux donnees via ses requetes agregees (voir
// apps.actes.services_pdf cote backend) : jamais propose ici.
const VOLETS = [
  { valeur: "", libelle: "Tous les volets (1, 2, 3, 5)" },
  { valeur: "1", libelle: "Volet N°1 (Souche)" },
  { valeur: "2", libelle: "Volet N°2 (Ministere de l'Administration Territoriale)" },
  { valeur: "3", libelle: "Volet N°3 (Greffe du Tribunal)" },
  { valeur: "5", libelle: "Volet N°5 (Declarant)" }
];

export default function ActePdf() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const { utilisateur } = useAuth();
  const estAgent = utilisateur?.role === "agent_cec";
  const liens = estAgent ? LIENS_AGENT : LIENS_ADMIN_CEC;

  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [voletSelectionne, setVoletSelectionne] = useState("");

  useEffect(() => {
    if (!idDossier) return;
    let urlObjet: string | undefined;

    setUrlPdf(null);
    setErreur(null);
    const parametres = voletSelectionne ? `?volet=${voletSelectionne}` : "";
    appelApi<Blob>(`/dossiers/${idDossier}/acte/pdf${parametres}`)
      .then((blob) => {
        urlObjet = URL.createObjectURL(blob);
        setUrlPdf(urlObjet);
      })
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Erreur"));

    return () => {
      if (urlObjet) URL.revokeObjectURL(urlObjet);
    };
  }, [idDossier, voletSelectionne]);

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage
        titre="Acte"
        actions={estAgent && idDossier && <DemandeCorrectionActe idDossier={idDossier} libelle="Demander une correction" />}
      />
      <div className="eva-carte" style={{ marginBottom: 20, maxWidth: 320 }}>
        <Champ id="volet" label="Volet a imprimer">
          <select id="volet" value={voletSelectionne} onChange={(e) => setVoletSelectionne(e.target.value)}>
            {VOLETS.map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {v.libelle}
              </option>
            ))}
          </select>
        </Champ>
      </div>
      {erreur && <div className="message-erreur">{erreur}</div>}
      {urlPdf ? (
        <div className="eva-carte" style={{ padding: 0, overflow: "hidden" }}>
          <iframe title="Acte" src={urlPdf} style={{ width: "100%", height: "80vh", border: "none", display: "block" }} />
          <div style={{ padding: 14 }}>
            <AncreBouton
              href={urlPdf}
              download={voletSelectionne ? `acte-${idDossier}-volet${voletSelectionne}.pdf` : `acte-${idDossier}.pdf`}
              iconeGauche={<Download size={16} />}
            >
              Telecharger / Imprimer
            </AncreBouton>
          </div>
        </div>
      ) : (
        !erreur && <ChargementPage texte="Generation du document..." />
      )}
    </MiseEnPage>
  );
}
