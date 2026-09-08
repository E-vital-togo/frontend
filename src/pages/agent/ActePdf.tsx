import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import Squelette from "../../components/Squelette";
import { appelApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";

export default function ActePdf() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!idDossier) return;
    let urlObjet: string | undefined;

    appelApi<Blob>(`/dossiers/${idDossier}/acte/pdf`)
      .then((blob) => {
        urlObjet = URL.createObjectURL(blob);
        setUrlPdf(urlObjet);
      })
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Erreur"));

    return () => {
      if (urlObjet) URL.revokeObjectURL(urlObjet);
    };
  }, [idDossier]);

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <PageHeader titre="Acte" description="Document officiel genere a partir des donnees validees du dossier." />
      {erreur && <div className="message-erreur">{erreur}</div>}
      {urlPdf ? (
        <div className="carte" style={{ padding: 0, overflow: "hidden" }}>
          <iframe title="Acte" src={urlPdf} style={{ width: "100%", height: "80vh", border: "none" }} />
          <div style={{ padding: 12 }}>
            <a
              href={urlPdf}
              download={`acte-${idDossier}.pdf`}
              className="bouton-principal"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
            >
              <Download size={15} />
              Telecharger / Imprimer
            </a>
          </div>
        </div>
      ) : (
        !erreur && <Squelette lignes={4} />
      )}
    </MiseEnPage>
  );
}
