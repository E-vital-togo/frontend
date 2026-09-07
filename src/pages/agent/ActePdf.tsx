import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
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
      <h1 style={{ color: "var(--couleur-emeraude)" }}>Acte</h1>
      {erreur && <div className="message-erreur">{erreur}</div>}
      {urlPdf ? (
        <div className="carte" style={{ padding: 0, overflow: "hidden" }}>
          <iframe title="Acte" src={urlPdf} style={{ width: "100%", height: "80vh", border: "none" }} />
          <div style={{ padding: 12 }}>
            <a href={urlPdf} download={`acte-${idDossier}.pdf`} className="bouton-principal">
              Telecharger / Imprimer
            </a>
          </div>
        </div>
      ) : (
        !erreur && <p>Generation du document...</p>
      )}
    </MiseEnPage>
  );
}
