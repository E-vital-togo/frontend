import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileEdit } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { AncreBouton, Bouton, ChargementPage, EnteteDePage, Modale } from "../../components/ui";
import { useToast } from "../../components/ui/ToastProvider";
import { useAuth } from "../../context/AuthContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";
import type { ChampFormulaireEffectif } from "../../types/domaine";

interface ReponseFormulaireEffectif {
  champs: ChampFormulaireEffectif[];
}

export default function ActePdf() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const estAgent = utilisateur?.role === "agent_cec";
  const liens = estAgent ? LIENS_AGENT : LIENS_ADMIN_CEC;

  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [champs, setChamps] = useState<ChampFormulaireEffectif[] | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [nouvellesValeurs, setNouvellesValeurs] = useState<Record<string, string>>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurDemande, setErreurDemande] = useState<string | null>(null);

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

  function ouvrirModaleCorrection() {
    setErreurDemande(null);
    setModaleOuverte(true);
    if (!champs && idDossier) {
      appelApi<ReponseFormulaireEffectif>(`/dossiers/${idDossier}/formulaire/?contexte=verification_etat_civil`)
        .then((reponse) => setChamps(reponse.champs))
        .catch(() => setChamps([]));
    }
  }

  function basculerSelection(code: string) {
    setSelection((precedent) => ({ ...precedent, [code]: !precedent[code] }));
  }

  async function envoyerDemande() {
    if (!idDossier || !champs) return;
    setErreurDemande(null);

    const champsModifies: Record<string, { label: string; ancienne_valeur: unknown; nouvelle_valeur: string }> = {};
    for (const champ of champs) {
      if (!selection[champ.data_element_code]) continue;
      const nouvelleValeur = (nouvellesValeurs[champ.data_element_code] || "").trim();
      if (!nouvelleValeur) continue;
      champsModifies[champ.data_element_code] = {
        label: champ.label,
        ancienne_valeur: champ.valeur_actuelle,
        nouvelle_valeur: nouvelleValeur
      };
    }

    if (Object.keys(champsModifies).length === 0) {
      setErreurDemande("Selectionnez au moins un champ a corriger et indiquez sa nouvelle valeur.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/acte/demande-modification`, {
        methode: "POST",
        corps: { champs_modifies: champsModifies }
      });
      toast.succes("Demande de modification envoyee : elle sera examinee par un administrateur.");
      setModaleOuverte(false);
      setSelection({});
      setNouvellesValeurs({});
    } catch (e) {
      setErreurDemande(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage
        titre="Acte"
        actions={
          estAgent && (
            <Bouton variante="secondaire" taille="petit" onClick={ouvrirModaleCorrection} iconeGauche={<FileEdit size={14} />}>
              Demander une correction
            </Bouton>
          )
        }
      />
      {erreur && <div className="message-erreur">{erreur}</div>}
      {urlPdf ? (
        <div className="eva-carte" style={{ padding: 0, overflow: "hidden" }}>
          <iframe title="Acte" src={urlPdf} style={{ width: "100%", height: "80vh", border: "none", display: "block" }} />
          <div style={{ padding: 14 }}>
            <AncreBouton href={urlPdf} download={`acte-${idDossier}.pdf`} iconeGauche={<Download size={16} />}>
              Telecharger / Imprimer
            </AncreBouton>
          </div>
        </div>
      ) : (
        !erreur && <ChargementPage texte="Generation du document..." />
      )}

      {modaleOuverte && (
        <Modale
          titre="Demander une correction de l'acte"
          large
          onFermer={() => setModaleOuverte(false)}
          actions={
            <>
              <Bouton variante="secondaire" onClick={() => setModaleOuverte(false)} disabled={envoiEnCours}>
                Annuler
              </Bouton>
              <Bouton variante="accent" onClick={envoyerDemande} chargement={envoiEnCours}>
                Envoyer la demande
              </Bouton>
            </>
          }
        >
          <p style={{ fontSize: 13.5, marginBottom: 14 }}>
            L'acte etant deja emis, toute correction passe par la validation d'un administrateur. Cochez le ou les
            champs errones et indiquez leur bonne valeur.
          </p>
          {erreurDemande && <div className="message-erreur">{erreurDemande}</div>}
          {champs === null ? (
            <ChargementPage texte="Chargement des champs..." />
          ) : champs.length === 0 ? (
            <p style={{ color: "var(--couleur-gris-service-2)" }}>Aucun champ disponible pour ce dossier.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "50vh", overflowY: "auto" }}>
              {champs.map((champ) => (
                <label
                  key={champ.data_element_code}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", border: "1px solid var(--couleur-bordure)", borderRadius: 8 }}
                >
                  <input
                    type="checkbox"
                    checked={!!selection[champ.data_element_code]}
                    onChange={() => basculerSelection(champ.data_element_code)}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{champ.label}</div>
                    <div style={{ fontSize: 12, color: "var(--couleur-gris-service-2)", marginBottom: 6 }}>
                      Valeur actuelle : {String(champ.valeur_actuelle ?? "(vide)")}
                    </div>
                    {selection[champ.data_element_code] && (
                      <input
                        placeholder="Nouvelle valeur"
                        value={nouvellesValeurs[champ.data_element_code] || ""}
                        onChange={(e) =>
                          setNouvellesValeurs((precedent) => ({ ...precedent, [champ.data_element_code]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </Modale>
      )}
    </MiseEnPage>
  );
}
