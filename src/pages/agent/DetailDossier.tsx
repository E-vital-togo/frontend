import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import BadgeStatut from "../../components/BadgeStatut";
import ChampDynamique from "../../components/ChampDynamique";
import ModaleNouvelleVersionDhis2 from "../../components/ModaleNouvelleVersionDhis2";
import Squelette from "../../components/Squelette";
import { useToast } from "../../context/ToastContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { mettreEnFileAction, mettreEnCacheDossier, dossierEnCache } from "../../lib/db";
import { LIENS_AGENT } from "./navigation";
import type { ChampFormulaireEffectif, Dossier } from "../../types/domaine";

interface ReponseFormulaireEffectif {
  champs: ChampFormulaireEffectif[];
}

export default function DetailDossier() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const navigate = useNavigate();
  const { notifier } = useToast();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [champs, setChamps] = useState<ChampFormulaireEffectif[]>([]);
  const [valeursModifiees, setValeursModifiees] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [horsLigne, setHorsLigne] = useState(!navigator.onLine);
  const [modaleNouvelleVersionOuverte, setModaleNouvelleVersionOuverte] = useState(false);
  const [decisionEnCours, setDecisionEnCours] = useState(false);

  async function charger() {
    if (!idDossier) return;

    if (navigator.onLine) {
      try {
        const [d, f] = await Promise.all([
          appelApi<Dossier>(`/dossiers/${idDossier}/`),
          appelApi<ReponseFormulaireEffectif>(`/dossiers/${idDossier}/formulaire/?contexte=verification_etat_civil`)
        ]);
        setDossier(d);
        setChamps(f.champs);
        await mettreEnCacheDossier(d);
        setHorsLigne(false);
        return;
      } catch {
        // bascule sur le cache si l'appel echoue malgre une connexion presente
      }
    }
    const enCache = await dossierEnCache(idDossier);
    if (enCache) {
      setDossier(enCache);
      setHorsLigne(true);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDossier]);

  function modifierValeur(codeChamp: string, valeur: string) {
    setValeursModifiees((precedent) => ({ ...precedent, [codeChamp]: valeur }));
  }

  async function enregistrer() {
    if (!idDossier || !dossier) return;
    setEnregistrement(true);
    const entrees = Object.entries(valeursModifiees);

    try {
      if (navigator.onLine) {
        for (const [dataElementCode, valeur] of entrees) {
          await appelApi(`/dossiers/${idDossier}/valeurs/`, {
            methode: "POST",
            corps: { data_element_code: dataElementCode, valeur }
          });
        }
        notifier("Modifications enregistrees.", "succes");
      } else {
        for (const [dataElementCode, valeur] of entrees) {
          await mettreEnFileAction({
            type: "ajout_valeur",
            dossierId: idDossier,
            versionConnue: dossier.version,
            payload: { data_element_code: dataElementCode, valeur }
          });
        }
        notifier("Hors-ligne : modifications mises en file, elles seront envoyees au retour du reseau.", "info");
      }
      setValeursModifiees({});
      await charger();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setEnregistrement(false);
    }
  }

  async function valider() {
    if (!idDossier) return;
    try {
      await appelApi(`/dossiers/${idDossier}/valider/`, { methode: "POST" });
      notifier("Dossier marque comme complete.", "succes");
      await charger();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    }
  }

  async function accepterNouvelleVersion() {
    if (!idDossier) return;
    setDecisionEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/nouvelle-version/accepter/`, { methode: "POST" });
      notifier("Modification DHIS2 appliquee au dossier.", "succes");
      setModaleNouvelleVersionOuverte(false);
      await charger();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setDecisionEnCours(false);
    }
  }

  async function refuserNouvelleVersion() {
    if (!idDossier) return;
    setDecisionEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/nouvelle-version/refuser/`, { methode: "POST" });
      notifier("Modification DHIS2 refusee, dossier inchange.", "info");
      setModaleNouvelleVersionOuverte(false);
      await charger();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setDecisionEnCours(false);
    }
  }

  if (!dossier) {
    return (
      <MiseEnPage liens={LIENS_AGENT}>
        <Squelette lignes={6} />
      </MiseEnPage>
    );
  }

  const peutValider =
    dossier.statut === "recu" || dossier.statut === "notifie" || dossier.statut === "en_attente_complement";
  const peutEmettreActe = dossier.statut === "complete";

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <PageHeader
        titre={`Dossier ${dossier.event_type === "naissance" ? "naissance" : "deces"}`}
        actions={<BadgeStatut statut={dossier.statut} />}
      />

      {horsLigne && (
        <div className="carte carte--avertissement" style={{ marginBottom: 16 }}>
          Vous consultez une version mise en cache localement. Les modifications seront envoyees au retour du reseau.
        </div>
      )}

      {dossier.nouvelle_version && (
        <div
          className="carte carte--avertissement"
          style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
        >
          <span>Une modification recue de DHIS2 est en attente de votre decision sur ce dossier.</span>
          <button className="bouton-principal" onClick={() => setModaleNouvelleVersionOuverte(true)}>
            Voir la modification
          </button>
        </div>
      )}

      {modaleNouvelleVersionOuverte && dossier.nouvelle_version && (
        <ModaleNouvelleVersionDhis2
          nouvelleVersion={dossier.nouvelle_version}
          enCours={decisionEnCours}
          onAccepter={accepterNouvelleVersion}
          onRefuser={refuserNouvelleVersion}
          onFermer={() => setModaleNouvelleVersionOuverte(false)}
        />
      )}

      <div className="carte" style={{ marginBottom: 20 }}>
        <p className="texte-mono" style={{ fontSize: 12, color: "var(--couleur-gris-service-2)" }}>
          Origine : {dossier.origine === "dhis2" ? "DHIS2" : "Manuel"} - Date de declaration :{" "}
          {dossier.date_declaration} - Date limite : {dossier.date_limite}
        </p>

        {champs.map((champ) => (
          <ChampDynamique
            key={champ.data_element_code}
            champ={champ}
            valeur={valeursModifiees[champ.data_element_code] ?? champ.valeur_actuelle}
            onChange={modifierValeur}
          />
        ))}

        {champs.length === 0 && (
          <p style={{ color: "var(--couleur-gris-service-2)" }}>
            Aucun champ a afficher pour ce contexte (dossier peut-etre en cache hors-ligne, sans formulaire
            disponible).
          </p>
        )}

        {champs.length > 0 && (
          <button
            className="bouton-principal"
            onClick={enregistrer}
            disabled={enregistrement || Object.keys(valeursModifiees).length === 0}
          >
            {enregistrement ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {peutValider && (
          <button className="bouton-secondaire" onClick={valider}>
            Marquer comme complete
          </button>
        )}
        {peutEmettreActe && (
          <button className="bouton-accent" onClick={() => navigate(`/agent/dossiers/${idDossier}/emission-acte`)}>
            Emettre l'acte
          </button>
        )}
        {dossier.statut === "acte_emis" && (
          <Link to={`/agent/dossiers/${idDossier}/acte-pdf`} className="bouton-secondaire">
            Voir le PDF de l'acte
          </Link>
        )}
      </div>
    </MiseEnPage>
  );
}
