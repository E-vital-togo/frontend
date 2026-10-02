import { useEffect, useState, type FormEvent } from "react";
import { MailCheck, MessageSquareWarning, Search, SendHorizontal, ShieldCheck, WifiOff } from "lucide-react";
import ChampCode from "../auth/ChampCode";
import CarteResultatRetrait from "./CarteResultatRetrait";
import ModaleRemiseActe from "./ModaleRemiseActe";
import { Alerte, Bouton, Carte, Champ, ChampTelephone, Squelette, useToast } from "../ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import { signalerModeRetrait, useModeRetrait } from "../../lib/retrait";
import type { CodeRetraitTrouve, DemandeCodeGuichet, DeclarantRetrait, ResumeRetrait } from "../../types/domaine";
import "../../styles/retrait.css";

type Phase = "numero" | "code" | "resultats";

const DELAI_RENVOI_DEFAUT = 30;

function declarantDepuis(r: CodeRetraitTrouve): DeclarantRetrait | undefined {
  if (!r.event_type) return undefined;
  return {
    nom: r.declarant_nom ?? "",
    qualite: r.declarant_qualite ?? "",
    telephone: r.declarant_telephone ?? "",
    dossier_nom: r.dossier_nom ?? "",
    event_type: r.event_type
  };
}

/**
 * Recherche par numéro de téléphone au guichet. Deux parcours selon le réglage
 * de l'Administrateur Général :
 *  - vérification physique (défaut) : la liste s'affiche directement, avec en
 *    évidence ce que l'agent doit comparer à ce que dit la personne ;
 *  - code SMS : le déclarant reçoit un code qu'il communique à l'agent, la
 *    liste n'est révélée qu'après sa saisie.
 */
export default function OngletTelephoneRetrait() {
  const toast = useToast();
  const enLigne = useConnectivite();
  const { verificationSms, rafraichir } = useModeRetrait();

  // E.164 ("+22890123456") ; le backend retrouve aussi les codes créés avec un ancien format libre.
  const [telephone, setTelephone] = useState("");
  const [telephoneValide, setTelephoneValide] = useState(false);
  const [phase, setPhase] = useState<Phase>("numero");
  const [code, setCode] = useState("");
  const [resultats, setResultats] = useState<CodeRetraitTrouve[] | null>(null);
  const [verifieParSms, setVerifieParSms] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [smsIndisponible, setSmsIndisponible] = useState<string | null>(null);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [resteAvantRenvoi, setResteAvantRenvoi] = useState(0);
  const [validiteMinutes, setValiditeMinutes] = useState(10);
  const [aRemettre, setARemettre] = useState<CodeRetraitTrouve | null>(null);

  // Décompte avant de pouvoir renvoyer un code.
  useEffect(() => {
    if (resteAvantRenvoi <= 0) return;
    const minuteur = window.setTimeout(() => setResteAvantRenvoi((n) => n - 1), 1000);
    return () => window.clearTimeout(minuteur);
  }, [resteAvantRenvoi]);

  // L'administrateur a désactivé la vérification pendant la saisie du code : retour à la recherche directe.
  useEffect(() => {
    if (verificationSms === false && phase === "code") {
      setPhase("numero");
      setCode("");
      setErreurCode(null);
      toast.info("La vérification par SMS vient d'être désactivée : la recherche affiche directement les actes.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationSms]);

  function reinitialiser() {
    setPhase("numero");
    setTelephone("");
    setTelephoneValide(false);
    setCode("");
    setResultats(null);
    setVerifieParSms(false);
    setErreur(null);
    setSmsIndisponible(null);
    setErreurCode(null);
    setResteAvantRenvoi(0);
  }

  function traiterErreurMode(e: unknown): boolean {
    if (!(e instanceof ErreurApi)) return false;
    if (e.code === "verification_sms_requise") {
      signalerModeRetrait(true);
      setErreur(null);
      toast.info("La vérification par SMS est activée : un code va être envoyé au déclarant.");
      return true;
    }
    if (e.code === "verification_sms_non_requise") {
      signalerModeRetrait(false);
      setErreur(null);
      toast.info("La vérification par SMS est désactivée : la recherche affiche directement les actes.");
      void rafraichir();
      return true;
    }
    return false;
  }

  // --- Vérification physique : liste directe ---------------------------
  async function rechercherDirectement(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!telephone || !telephoneValide) return;
    setEnCours(true);
    setErreur(null);
    setResultats(null);
    try {
      const donnees = await appelApi<CodeRetraitTrouve[]>(`/codes-retrait/rechercher?telephone=${encodeURIComponent(telephone)}`);
      setResultats(donnees);
      setVerifieParSms(false);
      setPhase("resultats");
    } catch (e) {
      if (!traiterErreurMode(e)) setErreur(e instanceof ErreurApi ? e.message : "Erreur de recherche.");
    } finally {
      setEnCours(false);
    }
  }

  // --- Code SMS : étape 1, envoi du code -------------------------------
  async function demanderCode(evenement?: FormEvent<HTMLFormElement>) {
    evenement?.preventDefault();
    if (!telephone || !telephoneValide) return;
    setEnCours(true);
    setErreur(null);
    setSmsIndisponible(null);
    setErreurCode(null);
    try {
      const reponse = await appelApi<DemandeCodeGuichet>("/codes-retrait/guichet/demander-code", { methode: "POST", corps: { telephone } });
      setValiditeMinutes(reponse.validite_minutes || 10);
      setResteAvantRenvoi(reponse.delai_renvoi_secondes || DELAI_RENVOI_DEFAUT);
      setCode("");
      setPhase("code");
    } catch (e) {
      if (e instanceof ErreurApi && e.code === "sms_indisponible") {
        setSmsIndisponible(e.message);
      } else if (e instanceof ErreurApi && e.code === "attente_requise") {
        // Un code vient d'être envoyé : on passe à la saisie plutôt que de bloquer l'agent.
        setResteAvantRenvoi(DELAI_RENVOI_DEFAUT);
        setPhase("code");
      } else if (!traiterErreurMode(e)) {
        setErreur(e instanceof ErreurApi ? e.message : "Le code n'a pas pu être envoyé.");
      }
    } finally {
      setEnCours(false);
    }
  }

  // --- Code SMS : étape 2, saisie du code ------------------------------
  async function verifierCode(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (code.length !== 6) return;
    setEnCours(true);
    setErreurCode(null);
    try {
      const donnees = await appelApi<CodeRetraitTrouve[]>("/codes-retrait/guichet/verifier-code", { methode: "POST", corps: { telephone, code } });
      setResultats(donnees);
      setVerifieParSms(true);
      setPhase("resultats");
    } catch (e) {
      if (!traiterErreurMode(e)) {
        setErreurCode(e instanceof ErreurApi ? e.message : "Le code n'a pas pu être vérifié.");
        setCode("");
      }
    } finally {
      setEnCours(false);
    }
  }

  function enregistrerRetrait(dossierId: string, retrait: ResumeRetrait) {
    setResultats((precedents) =>
      precedents
        ? precedents.map((r) =>
            r.dossier_id === dossierId
              ? {
                  ...r,
                  etat_retrait: "retire",
                  retire_le: retrait.retire_le,
                  retire_par_nom: retrait.retire_par_nom,
                  retire_nom_receveur: retrait.retire_nom_receveur
                }
              : r
          )
        : precedents
    );
  }

  const champNumero = (
    <Champ id="telephone" label="Numéro de téléphone du déclarant" aide="Le numéro donné lors de la déclaration du dossier.">
      <ChampTelephone id="telephone" nom="telephone" valeur={telephone} onChange={setTelephone} onValidite={setTelephoneValide} />
    </Champ>
  );

  // --- Rendu -----------------------------------------------------------
  if (verificationSms === null) {
    return enLigne ? (
      <Carte className="eva-ag-formulaire">
        <Squelette variante="bloc" hauteur={120} libelle="Chargement du mode de recherche" />
      </Carte>
    ) : (
      <Alerte variante="avertissement" icone={<WifiOff size={18} aria-hidden="true" />} titre="Connexion nécessaire">
        La recherche par numéro de téléphone interroge le serveur : elle n'est pas disponible hors ligne. Utilisez le code de retrait ou le QR code remis au déclarant.
      </Alerte>
    );
  }

  return (
    <div className="eva-ag-telephone">
      {phase === "numero" && verificationSms === false && (
        <Carte className="eva-ag-formulaire">
          <form onSubmit={rechercherDirectement} noValidate>
            {champNumero}
            <p className="eva-rt-aide-mode">
              <ShieldCheck size={16} aria-hidden="true" />
              Vous vérifierez vous-même l'identité du déclarant : aucun SMS n'est envoyé.
            </p>
            {erreur && <Alerte variante="erreur" compacte>{erreur}</Alerte>}
            <div className="eva-ag-formulaire__actions">
              <Bouton type="submit" chargement={enCours} disabled={!telephone || !telephoneValide || !enLigne} iconeGauche={<Search size={16} />}>
                Rechercher les actes
              </Bouton>
            </div>
          </form>
        </Carte>
      )}

      {phase === "numero" && verificationSms === true && (
        <Carte className="eva-ag-formulaire">
          <form onSubmit={demanderCode} noValidate>
            {champNumero}
            <p className="eva-rt-aide-mode">
              <MailCheck size={16} aria-hidden="true" />
              Un code à 6 chiffres sera envoyé par SMS au déclarant. Il vous le communiquera pour afficher ses actes.
            </p>
            {smsIndisponible && (
              <Alerte variante="erreur" icone={<MessageSquareWarning size={18} aria-hidden="true" />} titre="Service SMS indisponible">
                {smsIndisponible}
              </Alerte>
            )}
            {erreur && <Alerte variante="erreur" compacte>{erreur}</Alerte>}
            <div className="eva-ag-formulaire__actions">
              <Bouton type="submit" chargement={enCours} disabled={!telephone || !telephoneValide || !enLigne} iconeGauche={<SendHorizontal size={16} />}>
                Envoyer le code au déclarant
              </Bouton>
            </div>
          </form>
        </Carte>
      )}

      {phase === "code" && (
        <Carte className="eva-ag-formulaire">
          <form onSubmit={verifierCode} noValidate>
            <Alerte variante="info" icone={<MailCheck size={18} aria-hidden="true" />} titre="Un code a été envoyé au déclarant">
              Demandez-lui le code reçu par SMS au <span className="texte-mono">{telephone}</span>, puis saisissez-le. Il est valable {validiteMinutes} minutes et ne sert qu'une fois.
            </Alerte>
            <div className="eva-rt-code">
              <ChampCode
                id="code-guichet"
                label="Code reçu par le déclarant"
                valeur={code}
                onChange={(valeur) => {
                  setCode(valeur);
                  setErreurCode(null);
                }}
                erreur={erreurCode ?? undefined}
                autoFocus
              />
            </div>
            <div className="eva-ag-formulaire__actions eva-rt-code__actions">
              <Bouton type="submit" chargement={enCours} disabled={code.length !== 6 || !enLigne} iconeGauche={<ShieldCheck size={16} />}>
                Afficher les actes
              </Bouton>
              <Bouton type="button" variante="secondaire" onClick={() => void demanderCode()} disabled={resteAvantRenvoi > 0 || enCours || !enLigne}>
                {resteAvantRenvoi > 0 ? `Renvoyer le code (${resteAvantRenvoi} s)` : "Renvoyer le code"}
              </Bouton>
              <Bouton type="button" variante="fantome" onClick={() => { setPhase("numero"); setCode(""); setErreurCode(null); }}>
                Changer de numéro
              </Bouton>
            </div>
            {smsIndisponible && (
              <Alerte variante="erreur" icone={<MessageSquareWarning size={18} aria-hidden="true" />} titre="Service SMS indisponible" className="eva-rt-alerte-haute">
                {smsIndisponible}
              </Alerte>
            )}
            <p className="eva-rt-aide-sms">
              Le SMS n'arrive pas ? Vérifiez le numéro, puis patientez un instant. S'il n'arrive toujours pas : <strong>demandez à l'administrateur de désactiver la vérification par SMS</strong>, vous pourrez alors
              vérifier l'identité en personne.
            </p>
          </form>
        </Carte>
      )}

      <div aria-live="polite">
        {phase === "resultats" && resultats && (
          <section aria-label="Actes trouvés" className="eva-rt-resultats">
            {verifieParSms ? (
              <Alerte variante="succes" compacte icone={<ShieldCheck size={18} aria-hidden="true" />}>
                Code validé : le déclarant a prouvé qu'il possède ce numéro.
              </Alerte>
            ) : (
              <Alerte variante="avertissement" titre="Vérifiez physiquement avant de remettre l'acte" icone={<ShieldCheck size={18} aria-hidden="true" />}>
                Comparez le <strong>nom du déclarant</strong>, le <strong>numéro de téléphone</strong> et le <strong>nom de l'enfant ou du défunt</strong> avec ce que dit la personne et sa pièce d'identité.
              </Alerte>
            )}

            {resultats.length === 0 ? (
              <Alerte variante="info" titre="Aucun acte trouvé pour ce numéro">
                Vérifiez le numéro, ou essayez avec le code de retrait remis au déclarant.
              </Alerte>
            ) : (
              <>
                <p className="eva-ag-compteur-resultats">
                  {resultats.length} acte{resultats.length > 1 ? "s" : ""} trouvé{resultats.length > 1 ? "s" : ""}
                </p>
                <ul className="eva-rt-cartes">
                  {resultats.map((r) => (
                    <li key={r.code}>
                      <CarteResultatRetrait resultat={r} verificationPhysique={!verifieParSms} enLigne={enLigne} onRemettre={setARemettre} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div>
              <Bouton variante="secondaire" onClick={reinitialiser} iconeGauche={<Search size={16} />}>
                Nouvelle recherche
              </Bouton>
            </div>
          </section>
        )}
      </div>

      {aRemettre && (
        <ModaleRemiseActe
          idDossier={aRemettre.dossier_id}
          declarantInitial={declarantDepuis(aRemettre)}
          basePath="/agent"
          libelleFin="Nouvelle recherche"
          onRetire={(retrait) => enregistrerRetrait(aRemettre.dossier_id, retrait)}
          onDejaRetire={(retrait) => enregistrerRetrait(aRemettre.dossier_id, retrait)}
          onFermer={() => setARemettre(null)}
          onTerminer={() => {
            setARemettre(null);
            reinitialiser();
          }}
        />
      )}
    </div>
  );
}
