import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, ExternalLink, FileSignature, FileWarning } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import DemandeCorrectionActe from "../../components/DemandeCorrectionActe";
import { AncreBouton, Alerte, Bouton, Carte, Champ, EnteteDePage, LienBouton, Selecteur, Squelette } from "../../components/ui";
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

interface ProprietesActePdf {
  /**
   * Aperçu de l'acte avant émission (dossier "complet") : même affichage que l'acte
   * réel, mais sur l'aperçu non officiel (aucun numéro réservé, tous les volets d'un coup).
   */
  apercu?: boolean;
}

export default function ActePdf({ apercu = false }: ProprietesActePdf) {
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
    const parametres = !apercu && voletSelectionne ? `?volet=${voletSelectionne}` : "";
    appelApi<Blob>(`/dossiers/${idDossier}/acte/${apercu ? "apercu-pdf" : "pdf"}${parametres}`)
      .then((blob) => {
        urlObjet = URL.createObjectURL(blob);
        setUrlPdf(urlObjet);
      })
      .catch((e: unknown) => setErreur(e instanceof ErreurApi || e instanceof Error ? e.message : "Erreur inattendue."));

    return () => {
      if (urlObjet) URL.revokeObjectURL(urlObjet);
    };
  }, [idDossier, voletSelectionne, relance, apercu]);

  const libelleVolet = apercu
    ? "Aperçu"
    : (VOLETS.find((v) => v.valeur === voletSelectionne)?.libelle ?? VOLETS[0].libelle);
  const nomFichier = apercu
    ? `apercu-acte-${idDossier}.pdf`
    : voletSelectionne
      ? `acte-${idDossier}-volet${voletSelectionne}.pdf`
      : `acte-${idDossier}.pdf`;
  const enGeneration = !urlPdf && !erreur;

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage
        titre={apercu ? "Aperçu de l'acte" : "Acte"}
        sousTitre={
          apercu
            ? "Rendu de l'acte avant son émission, pour vérifier les informations."
            : "Aperçu du document officiel, à télécharger ou à imprimer volet par volet."
        }
        filAriane={[
          { libelle: "Dossiers", vers: `${basePath}/dossiers` },
          { libelle: "Dossier", vers: `${basePath}/dossiers/${idDossier}` },
          { libelle: apercu ? "Aperçu de l'acte" : "Acte" }
        ]}
        actions={
          !apercu && estAgent && idDossier && <DemandeCorrectionActe idDossier={idDossier} libelle="Demander une correction" />
        }
      />

      {apercu && (
        <Alerte variante="info" titre="Aperçu non officiel">
          Aucun numéro de registre, de feuillet ni d'acte n'est encore réservé. Le document est régénéré à chaque ouverture
          d'après l'état actuel du dossier.
        </Alerte>
      )}

      <Carte className="eva-ag-barre-acte">
        {!apercu && (
          <Champ id="volet" label="Volet à imprimer" className="eva-ag-barre-acte__choix">
            <Selecteur id="volet" valeur={voletSelectionne} onChange={setVoletSelectionne}>
              {VOLETS.map((v) => (
                <option key={v.valeur} value={v.valeur}>
                  {v.libelle}
                </option>
              ))}
            </Selecteur>
          </Champ>
        )}
        <div className="eva-groupe-boutons eva-ag-barre-acte__actions">
          <AncreBouton
            href={urlPdf ?? undefined}
            download={nomFichier}
            desactive={!urlPdf}
            iconeGauche={<Download size={16} />}
          >
            {apercu ? "Télécharger l'aperçu" : "Télécharger / Imprimer"}
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
          {apercu && (
            <LienBouton to={`${basePath}/dossiers/${idDossier}`} variante="secondaire">
              Retour au dossier
            </LienBouton>
          )}
          {apercu && estAgent && (
            <LienBouton to={`${basePath}/dossiers/${idDossier}/emission-acte`} iconeGauche={<FileSignature size={16} />}>
              Émettre l'acte
            </LienBouton>
          )}
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
            <p className="eva-ag-apercu__aide">Si l'aperçu ne s'affiche pas sur votre appareil, utilisez « {apercu ? "Télécharger l'aperçu" : "Télécharger / Imprimer"} ».</p>
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
