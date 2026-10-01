import { useId, useMemo, useState } from "react";
import { FileEdit, SearchX } from "lucide-react";
import { Alerte, BarreRecherche, Bouton, Champ, EtatVide, Modale, Selecteur, Squelette } from "./ui";
import type { VarianteBouton, TailleBouton } from "./ui/Bouton";
import { useToast } from "./ui/ToastProvider";
import ComparaisonValeurs from "./dossier/ComparaisonValeurs";
import { formaterValeurPourChamp } from "./dossier/utilitaires";
import { appelApi, ErreurApi } from "../lib/apiClient";
import type { ChampFormulaireEffectif } from "../types/domaine";
import "../styles/dossier.css";

interface ReponseFormulaireEffectif {
  champs: ChampFormulaireEffectif[];
}

interface ProprietesDemandeCorrectionActe {
  idDossier: string;
  /** Évite un fetch redondant quand l'écran appelant a déjà chargé les champs (ex : DetailDossier). */
  champsPreCharges?: ChampFormulaireEffectif[];
  variante?: VarianteBouton;
  taille?: TailleBouton;
  libelle?: string;
  onEnvoyee?: () => void;
}

/** Comparaison insensible à la casse et aux accents (recherche d'un champ dans la liste). */
function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Bouton + fenêtre de demande de correction d'un acte déjà émis. Partagé
 * entre ActePdf.tsx (où elle vivait seule à l'origine) et DetailDossier.tsx
 * (où elle doit être accessible directement, sans passer par l'écran PDF) :
 * une seule logique d'envoi, jamais deux versions à maintenir en parallèle.
 */
export default function DemandeCorrectionActe({
  idDossier,
  champsPreCharges,
  variante = "secondaire",
  taille = "petit",
  libelle = "Demander une modification",
  onEnvoyee
}: ProprietesDemandeCorrectionActe) {
  const toast = useToast();
  const prefixe = useId().replace(/:/g, "");
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [champs, setChamps] = useState<ChampFormulaireEffectif[] | null>(champsPreCharges ?? null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [nouvellesValeurs, setNouvellesValeurs] = useState<Record<string, string>>({});
  const [recherche, setRecherche] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurDemande, setErreurDemande] = useState<string | null>(null);

  function ouvrir() {
    setErreurDemande(null);
    setModaleOuverte(true);
    if (!champs) {
      appelApi<ReponseFormulaireEffectif>(`/dossiers/${idDossier}/formulaire/?contexte=verification_etat_civil`)
        .then((reponse) => setChamps(reponse.champs))
        .catch(() => setChamps([]));
    }
  }

  function basculerSelection(code: string) {
    setSelection((precedent) => ({ ...precedent, [code]: !precedent[code] }));
  }

  function fermer() {
    setModaleOuverte(false);
    setRecherche("");
  }

  async function envoyerDemande() {
    if (!champs) return;
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
      setErreurDemande("Sélectionnez au moins un champ à corriger et indiquez sa nouvelle valeur.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/acte/demande-modification`, {
        methode: "POST",
        corps: { champs_modifies: champsModifies }
      });
      toast.succes("Demande de modification envoyée : elle sera examinée par un administrateur.");
      fermer();
      setSelection({});
      setNouvellesValeurs({});
      onEnvoyee?.();
    } catch (e) {
      setErreurDemande(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const champsAffiches = useMemo(() => {
    if (!champs) return [];
    const terme = normaliser(recherche.trim());
    return terme ? champs.filter((c) => normaliser(c.label).includes(terme)) : champs;
  }, [champs, recherche]);

  // Champs cochés ET renseignés : c'est exactement ce qui sera envoyé.
  const recapitulatif = useMemo(() => {
    if (!champs) return [];
    return champs
      .filter((c) => selection[c.data_element_code] && (nouvellesValeurs[c.data_element_code] || "").trim() !== "")
      .map((c) => ({
        cle: c.data_element_code,
        libelle: c.label,
        avant: formaterValeurPourChamp(c, c.valeur_actuelle),
        apres: formaterValeurPourChamp(c, (nouvellesValeurs[c.data_element_code] || "").trim())
      }));
  }, [champs, selection, nouvellesValeurs]);

  const nbSelectionnes = champs ? champs.filter((c) => selection[c.data_element_code]).length : 0;

  function controleSaisie(champ: ChampFormulaireEffectif, id: string) {
    const code = champ.data_element_code;
    const valeur = nouvellesValeurs[code] || "";
    const changer = (v: string) => setNouvellesValeurs((precedent) => ({ ...precedent, [code]: v }));
    if (champ.type_champ === "select" && champ.options.length > 0) {
      return (
        <Selecteur id={id} valeur={valeur} onChange={changer} options={champ.options} placeholder="Choisir une valeur" effacable />
      );
    }
    const type = champ.type_champ === "date" ? "date" : champ.type_champ === "nombre_entier" || champ.type_champ === "nombre_decimal" ? "number" : "text";
    return (
      <input
        id={id}
        type={type}
        step={champ.type_champ === "nombre_decimal" ? "any" : undefined}
        value={valeur}
        onChange={(e) => changer(e.target.value)}
      />
    );
  }

  return (
    <>
      <Bouton variante={variante} taille={taille} onClick={ouvrir} iconeGauche={<FileEdit size={taille === "petit" ? 14 : 16} />}>
        {libelle}
      </Bouton>

      {modaleOuverte && (
        <Modale
          titre="Demander une modification de l'acte"
          description="L'acte est déjà émis : toute correction est examinée par un administrateur avant la réémission."
          taille="large"
          fermerAuClicFond={false}
          onFermer={fermer}
          actions={
            <>
              <Bouton variante="secondaire" onClick={fermer} disabled={envoiEnCours}>
                Annuler
              </Bouton>
              <Bouton onClick={envoyerDemande} chargement={envoiEnCours}>
                Envoyer la demande
              </Bouton>
            </>
          }
        >
          {erreurDemande && (
            <Alerte variante="erreur" onFermer={() => setErreurDemande(null)} className="eva-dd-modale-alerte">
              {erreurDemande}
            </Alerte>
          )}

          {champs === null ? (
            <Squelette variante="texte" lignes={6} libelle="Chargement des champs" />
          ) : champs.length === 0 ? (
            <EtatVide compact variante="neutre" icone={<SearchX size={24} />} titre="Aucun champ disponible" description="Le formulaire de ce dossier n'a pas pu être chargé." />
          ) : (
            <div className="eva-dd-correction">
              <p className="eva-dd-correction__intro">Cochez les champs erronés, puis indiquez la valeur correcte pour chacun.</p>

              {champs.length > 8 && (
                <div className="eva-dd-correction__recherche">
                  <BarreRecherche
                    valeur={recherche}
                    onChanger={setRecherche}
                    placeholder="Rechercher un champ"
                    ariaLabel="Rechercher un champ à corriger"
                    pleineLargeur
                  />
                </div>
              )}

              <p className="eva-dd-correction__compteur" role="status" aria-live="polite">
                {nbSelectionnes === 0
                  ? "Aucun champ sélectionné"
                  : `${nbSelectionnes} champ${nbSelectionnes > 1 ? "s" : ""} sélectionné${nbSelectionnes > 1 ? "s" : ""}`}
              </p>

              <ul className="eva-dd-correction__liste">
                {champsAffiches.map((champ) => {
                  const code = champ.data_element_code;
                  const coche = !!selection[code];
                  const idCase = `${prefixe}-case-${code}`;
                  const idSaisie = `${prefixe}-saisie-${code}`;
                  return (
                    <li key={code} className={coche ? "eva-dd-choix eva-dd-choix--actif" : "eva-dd-choix"}>
                      <div className="eva-dd-choix__ligne">
                        <input id={idCase} type="checkbox" checked={coche} onChange={() => basculerSelection(code)} />
                        <label htmlFor={idCase} className="eva-dd-choix__libelle">
                          <span className="eva-dd-choix__nom">{champ.label}</span>
                          <span className="eva-dd-choix__actuelle">
                            Valeur actuelle : <span className="eva-dd-valeur">{formaterValeurPourChamp(champ, champ.valeur_actuelle)}</span>
                          </span>
                        </label>
                      </div>
                      {coche && (
                        <div className="eva-dd-choix__saisie">
                          <Champ id={idSaisie} label="Nouvelle valeur">
                            {controleSaisie(champ, idSaisie)}
                          </Champ>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {champsAffiches.length === 0 && <p className="eva-dd-correction__aucun">Aucun champ ne correspond à « {recherche} ».</p>}

              {recapitulatif.length > 0 && (
                <section className="eva-dd-correction__recap" aria-label="Récapitulatif de la demande">
                  <h3>Récapitulatif de la demande</h3>
                  <ComparaisonValeurs
                    lignes={recapitulatif}
                    libelleApres="Valeur demandée"
                    ariaLabel="Valeurs avant et après correction"
                  />
                </section>
              )}
            </div>
          )}
        </Modale>
      )}
    </>
  );
}
