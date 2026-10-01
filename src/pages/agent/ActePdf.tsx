import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, ExternalLink, FileWarning } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import DemandeCorrectionActe from "../../components/DemandeCorrectionActe";
import { AncreBouton, Alerte, Bouton, Carte, Champ, EnteteDePage, Selecteur, Squelette } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";
import "../../styles/agent.css";

// Le volet N°4 (INSEED) n'existe plus sur le formulaire national depuis que
// l'INSEED accède directement aux données via ses requêtes agrégées (voir
// apps.actes.services_pdf côté backend) : jamais proposé ici.
const VOLETS = [
  { valeur: "", libelle: "Tous les volets (1, 2, 3, 5)" },
  { valeur: "1", libelle: "Volet N°1 (Souche)" },
  { valeur: "2", libelle: "Volet N°2 (Ministère de l'Administration Territoriale)" },
  { valeur: "3", libelle: "Volet N°3 (Greffe du Tribunal)" },
  { valeur: "5", libelle: "Volet N°5 (Déclarant)" }
];

export default function ActePdf() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const { utilisateur } = useAuth();
  const estAgent = utilisateur?.role === "agent_cec";
  const liens = estAgent ? LIENS_AGENT : LIENS_ADMIN_CEC;
  const basePath = estAgent ? "/agent" : "/admin-cec";

  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [voletSelectionne, setVoletSelectionne] = useState("");
  const [relance, setRelance] = useState(0);

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
      .catch((e: unknown) => setErreur(e instanceof ErreurApi || e instanceof Error ? e.message : "Erreur inattendue."));

    return () => {
      if (urlObjet) URL.revokeObjectURL(urlObjet);
    };
  }, [idDossier, voletSelectionne, relance]);

  const libelleVolet = VOLETS.find((v) => v.valeur === voletSelectionne)?.libelle ?? VOLETS[0].libelle;
  const nomFichier = voletSelectionne ? `acte-${idDossier}-volet${voletSelectionne}.pdf` : `acte-${idDossier}.pdf`;
  const enGeneration = !urlPdf && !erreur;

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage
        titre="Acte"
        sousTitre="Aperçu du document officiel, à télécharger ou à imprimer volet par volet."
        filAriane={[
          { libelle: "Dossiers", vers: `${basePath}/dossiers` },
          { libelle: "Dossier", vers: `${basePath}/dossiers/${idDossier}` },
          { libelle: "Acte" }
        ]}
        actions={estAgent && idDossier && <DemandeCorrectionActe idDossier={idDossier} libelle="Demander une correction" />}
      />

      <Carte className="eva-ag-barre-acte">
        <Champ id="volet" label="Volet à imprimer" className="eva-ag-barre-acte__choix">
          <Selecteur id="volet" valeur={voletSelectionne} onChange={setVoletSelectionne}>
            {VOLETS.map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {v.libelle}
              </option>
            ))}
          </Selecteur>
        </Champ>
        <div className="eva-groupe-boutons eva-ag-barre-acte__actions">
          <AncreBouton
            href={urlPdf ?? undefined}
            download={nomFichier}
            desactive={!urlPdf}
            iconeGauche={<Download size={16} />}
          >
            Télécharger / Imprimer
          </AncreBouton>
          <AncreBouton
            href={urlPdf ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            variante="secondaire"
            desactive={!urlPdf}
            iconeGauche={<ExternalLink size={16} />}
          >
            Ouvrir dans un onglet
          </AncreBouton>
        </div>
      </Carte>

      <div className="eva-ag-apercu" aria-busy={enGeneration}>
        {erreur ? (
          <Alerte
            variante="erreur"
            titre="Le document n'a pas pu être généré"
            icone={<FileWarning size={18} aria-hidden="true" />}
            actions={
              <Bouton variante="secondaire" taille="petit" onClick={() => setRelance((n) => n + 1)}>
                Réessayer
              </Bouton>
            }
          >
            {erreur}
          </Alerte>
        ) : urlPdf ? (
          <>
            <iframe className="eva-ag-apercu__cadre" title={`Aperçu de l'acte : ${libelleVolet}`} src={urlPdf} />
            <p className="eva-ag-apercu__aide">Si l'aperçu ne s'affiche pas sur votre appareil, utilisez « Télécharger / Imprimer ».</p>
          </>
        ) : (
          <div role="status" aria-live="polite">
            <Squelette variante="bloc" hauteur={560} libelle="Génération du document en cours" />
            <p className="eva-ag-apercu__aide">Génération du document en cours...</p>
          </div>
        )}
      </div>
    </MiseEnPage>
  );
}
