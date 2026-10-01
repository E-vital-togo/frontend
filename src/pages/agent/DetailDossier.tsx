import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WifiOff } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import ActionsDossier from "../../components/dossier/ActionsDossier";
import { BandeauHorsLigne, BandeauVerrou } from "../../components/dossier/BandeauxDossier";
import EnteteDossier from "../../components/dossier/EnteteDossier";
import PanneauDemandes from "../../components/dossier/PanneauDemandes";
import PanneauFormulaire from "../../components/dossier/PanneauFormulaire";
import PanneauHistorique from "../../components/dossier/PanneauHistorique";
import PanneauNotifications from "../../components/dossier/PanneauNotifications";
import PropositionDhis2 from "../../components/dossier/PropositionDhis2";
import SqueletteDossier from "../../components/dossier/SqueletteDossier";
import { champEstVide } from "../../components/dossier/utilitaires";
import { useProtectionDepart } from "../../components/dossier/useProtectionDepart";
import { Badge, BarreEnregistrement, Bouton, EtatVide, LienBouton, Modale, Onglets } from "../../components/ui";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import { useToast } from "../../components/ui/ToastProvider";
import { useAuth } from "../../context/AuthContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import {
  mettreEnFileAction,
  mettreEnCacheDossier,
  dossierEnCache,
  mettreEnCacheInstantane,
  instantaneEnCache,
  cleCacheFormulaire
} from "../../lib/db";
import { useConnectivite } from "../../lib/connectivite";
import { planFormulaire } from "../../lib/formulaire";
import { mettreEnCacheMiseEnPage, miseEnPageEnCache } from "../../lib/formulairesHorsLigne";
import { telechargerBlob } from "../../lib/telechargerBlob";
import { LIENS_AGENT } from "./navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";
import {
  listeDepuis,
  type Acte,
  type ChampFormulaireEffectif,
  type DemandeModificationActe,
  type Dossier,
  type ListeOuPaginee,
  type MiseEnPage as MiseEnPageFormulaire,
  type NotificationDossier,
  type ReponseFormulaireEffectif,
  type SignataireMairie,
  type ValeurChamp
} from "../../types/domaine";
import "../../styles/dossier.css";

function messageErreur(e: unknown, defaut = "Erreur inattendue."): string {
  return e instanceof ErreurApi ? e.message : defaut;
}

function pluriel(nombre: number, singulier: string, plurielTexte = `${singulier}s`): string {
  return `${nombre} ${nombre > 1 ? plurielTexte : singulier}`;
}

export default function DetailDossier() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmer = useConfirmation();
  const { utilisateur } = useAuth();
  const estAgent = utilisateur?.role === "agent_cec";
  const liens = estAgent ? LIENS_AGENT : LIENS_ADMIN_CEC;
  const basePath = estAgent ? "/agent" : "/admin-cec";

  const enLigne = useConnectivite();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [champs, setChamps] = useState<ChampFormulaireEffectif[]>([]);
  // Étapes du formulaire ; null = liste plate (configuration linéaire, ancien serveur, ancien cache).
  const [miseEnPage, setMiseEnPage] = useState<MiseEnPageFormulaire | null>(null);
  const [valeursModifiees, setValeursModifiees] = useState<Record<string, unknown>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [horsLigne, setHorsLigne] = useState(!enLigne);
  const [onglet, setOnglet] = useState("formulaire");
  const [historique, setHistorique] = useState<ValeurChamp[] | null>(null);
  const [erreurHistorique, setErreurHistorique] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationDossier[] | null>(null);
  const [erreurNotifications, setErreurNotifications] = useState<string | null>(null);
  const [demandes, setDemandes] = useState<DemandeModificationActe[] | null>(null);
  const [erreurDemandes, setErreurDemandes] = useState<string | null>(null);
  const [decisionEnCours, setDecisionEnCours] = useState(false);
  const [relanceEnCours, setRelanceEnCours] = useState(false);
  const [acte, setActe] = useState<Acte | null>(null);
  const [signataireVisible, setSignataireVisible] = useState<SignataireMairie | null>(null);
  const [chargementSignataire, setChargementSignataire] = useState(false);
  const [apercuActeEnCours, setApercuActeEnCours] = useState(false);

  const nbModifications = Object.keys(valeursModifiees).length;
  useProtectionDepart(nbModifications > 0, nbModifications);

  // `chargement` ne sert qu'au tout premier affichage (distinguer "on
  // attend encore" de "il n'y a rien en cache") : il n'est jamais remis à
  // true ici, sinon chaque rechargement après une action - validation,
  // acceptation d'une version DHIS2 - ferait clignoter toute la page en
  // squelette alors qu'elle peut rester affichée.
  async function charger() {
    if (!idDossier) return;

    if (enLigne) {
      try {
        const [d, f] = await Promise.all([
          appelApi<Dossier>(`/dossiers/${idDossier}/`),
          appelApi<ReponseFormulaireEffectif>(`/dossiers/${idDossier}/formulaire/?contexte=verification_etat_civil`)
        ]);
        setDossier(d);
        setChamps(f.champs);
        setMiseEnPage(f.mise_en_page ?? null);
        setHorsLigne(false);
        setChargement(false);
        await mettreEnCacheDossier(d);
        await mettreEnCacheInstantane(cleCacheFormulaire(idDossier), f.champs);
        await mettreEnCacheMiseEnPage(idDossier, f.mise_en_page);
        return;
      } catch {
        // bascule sur le cache si l'appel échoue malgré une connexion présente
      }
    }

    const [enCache, formulaire, miseEnPageCache] = await Promise.all([
      dossierEnCache(idDossier),
      instantaneEnCache<ChampFormulaireEffectif[]>(cleCacheFormulaire(idDossier)),
      miseEnPageEnCache(idDossier)
    ]);
    if (enCache) setDossier(enCache);
    if (formulaire) {
      setChamps(formulaire.donnees);
      setMiseEnPage(miseEnPageCache);
    }
    setHorsLigne(true);
    setChargement(false);
  }

  useEffect(() => {
    // `enLigne` fait partie des dépendances : au retour du réseau, l'écran
    // doit repasser sur les données du serveur au lieu de rester sur la
    // copie en cache affichée pendant la coupure.
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDossier, enLigne]);

  useEffect(() => {
    // Au retour du réseau, les panneaux restés en erreur se rechargent.
    if (enLigne) {
      setErreurHistorique(null);
      setErreurNotifications(null);
      setErreurDemandes(null);
    }
  }, [enLigne]);

  useEffect(() => {
    if (onglet === "historique" && idDossier && historique === null && erreurHistorique === null) {
      appelApi<ValeurChamp[]>(`/dossiers/${idDossier}/historique/`)
        .then(setHistorique)
        .catch((e) => setErreurHistorique(messageErreur(e, "Impossible de charger l'historique.")));
    }
  }, [onglet, idDossier, historique, erreurHistorique]);

  useEffect(() => {
    if (onglet === "notifications" && idDossier && notifications === null && erreurNotifications === null) {
      appelApi<ListeOuPaginee<NotificationDossier>>(`/dossiers/${idDossier}/notifications/`)
        .then((donnees) => setNotifications(listeDepuis(donnees)))
        .catch((e) => setErreurNotifications(messageErreur(e, "Impossible de charger les notifications.")));
    }
  }, [onglet, idDossier, notifications, erreurNotifications]);

  useEffect(() => {
    // Suivi des demandes de modification d'acte : chargé à l'ouverture de
    // l'onglet, et au premier affichage du dossier pour afficher le compteur.
    if (idDossier && demandes === null && erreurDemandes === null && (onglet === "demandes" || dossier)) {
      appelApi<DemandeModificationActe[]>(`/dossiers/${idDossier}/acte/demandes-modification`)
        .then(setDemandes)
        .catch((e) => setErreurDemandes(messageErreur(e, "Impossible de charger les demandes.")));
    }
  }, [onglet, idDossier, demandes, erreurDemandes, dossier]);

  useEffect(() => {
    // Nécessaire pour le bouton "Voir le signataire" (à côté de "Voir le
    // PDF") : seul le PDF était accessible jusqu'ici, sans donnée JSON sur
    // l'acte lui-même.
    if (idDossier && dossier?.statut === "acte_emis" && acte === null) {
      appelApi<Acte>(`/dossiers/${idDossier}/acte/`)
        .then(setActe)
        .catch(() => setActe(null));
    }
  }, [idDossier, dossier, acte]);

  function rafraichirDemandes() {
    setErreurDemandes(null);
    setDemandes(null);
  }

  async function voirSignataire() {
    if (!acte?.signataire) return;
    setChargementSignataire(true);
    try {
      const signataire = await appelApi<SignataireMairie>(`/signataires/${acte.signataire}/`);
      setSignataireVisible(signataire);
    } catch (e) {
      toast.erreur(messageErreur(e, "Impossible de charger le signataire."));
    } finally {
      setChargementSignataire(false);
    }
  }

  async function relancerMaintenant() {
    if (!idDossier) return;
    const ok = await confirmer({
      titre: "Envoyer une relance maintenant ?",
      description:
        "Un SMS ou un message WhatsApp sera envoyé immédiatement au déclarant, en plus des relances automatiques déjà programmées (J-10 et J-3).",
      libelleConfirmer: "Envoyer la relance"
    });
    if (!ok) return;
    setRelanceEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/notifications/relance-manuelle`, { methode: "POST" });
      toast.succes("Relance envoyée.");
      setNotifications(null);
      setErreurNotifications(null);
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setRelanceEnCours(false);
    }
  }

  function modifierValeur(codeChamp: string, valeur: unknown) {
    setErreurEnregistrement(null);
    setValeursModifiees((precedent) => ({ ...precedent, [codeChamp]: valeur }));
  }

  async function enregistrer() {
    if (!idDossier || !dossier) return;
    setEnregistrement(true);
    setErreurEnregistrement(null);
    const entrees = Object.entries(valeursModifiees);

    try {
      if (enLigne) {
        for (const [dataElementCode, valeur] of entrees) {
          await appelApi(`/dossiers/${idDossier}/valeurs/`, {
            methode: "POST",
            corps: { data_element_code: dataElementCode, valeur }
          });
        }
        toast.succes("Modifications enregistrées.");
      } else {
        for (const [dataElementCode, valeur] of entrees) {
          // valeur_precedente : ignorée par le backend (qui ne lit que
          // data_element_code/valeur dans le payload), mais indispensable
          // pour pouvoir restaurer l'affichage local si l'agent annule cette
          // action depuis l'écran Synchronisation avant ou après son envoi -
          // sans ça, rien ne permet de savoir à quoi revenir.
          const valeurPrecedente = champs.find((c) => c.data_element_code === dataElementCode)?.valeur_actuelle ?? null;
          await mettreEnFileAction({
            type: "ajout_valeur",
            dossierId: idDossier,
            versionConnue: dossier.version,
            payload: { data_element_code: dataElementCode, valeur, valeur_precedente: valeurPrecedente }
          });
        }

        // Applique localement ce qui vient d'être mis en file. Sans ça, le
        // charger() ci-dessous relisait le cache - inchangé, puisque l'action
        // n'est justement pas encore partie au serveur - et le champ revenait
        // à son ancienne valeur juste après le message de confirmation.
        const champsAJour = champs.map((champ) =>
          champ.data_element_code in valeursModifiees
            ? { ...champ, valeur_actuelle: valeursModifiees[champ.data_element_code] }
            : champ
        );
        setChamps(champsAJour);
        setValeursModifiees({});
        setHistorique(null);
        await mettreEnCacheInstantane(cleCacheFormulaire(idDossier), champsAJour);
        toast.info("Hors ligne : modifications mises en file d'attente, elles seront envoyées au retour du réseau.");
        return;
      }
      setValeursModifiees({});
      setHistorique(null);
      await charger();
    } catch (e) {
      const message = messageErreur(e);
      setErreurEnregistrement(`Échec de l'enregistrement : ${message}`);
      toast.erreur(message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function annulerModifications() {
    const ok = await confirmer({
      titre: "Annuler les modifications ?",
      description: `${pluriel(nbModifications, "modification non enregistrée", "modifications non enregistrées")} ${nbModifications > 1 ? "seront abandonnées" : "sera abandonnée"}. Les valeurs reviendront à celles du dossier.`,
      libelleConfirmer: "Abandonner les modifications",
      libelleAnnuler: "Continuer la saisie",
      dangereux: true
    });
    if (!ok) return;
    setErreurEnregistrement(null);
    setValeursModifiees({});
  }

  async function valider() {
    if (!idDossier) return;
    if (champsObligatoiresManquants.length > 0) {
      toast.erreur(
        `Champs obligatoires manquants : ${champsObligatoiresManquants.map((c) => c.label).join(", ")}.`
      );
      return;
    }
    const avertissement =
      nbModifications > 0
        ? ` Attention : ${pluriel(nbModifications, "modification non enregistrée", "modifications non enregistrées")} ne ${nbModifications > 1 ? "seront" : "sera"} pas prise${nbModifications > 1 ? "s" : ""} en compte.`
        : "";
    const ok = await confirmer({
      titre: "Marquer ce dossier comme complet ?",
      description: `L'agent pourra ensuite procéder à l'émission de l'acte. Cette étape confirme que toutes les informations nécessaires ont été vérifiées.${avertissement}`,
      libelleConfirmer: "Marquer comme complet"
    });
    if (!ok) return;
    try {
      await appelApi(`/dossiers/${idDossier}/valider/`, { methode: "POST" });
      toast.succes("Dossier marqué comme complet.");
      await charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    }
  }

  async function telechargerApercuActe() {
    if (!idDossier) return;
    setApercuActeEnCours(true);
    try {
      const blob = await appelApi<Blob>(`/dossiers/${idDossier}/acte/apercu-pdf`);
      telechargerBlob(blob, "apercu-acte.pdf");
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setApercuActeEnCours(false);
    }
  }

  async function accepterNouvelleVersion() {
    if (!idDossier) return;
    setDecisionEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/nouvelle-version/accepter/`, { methode: "POST" });
      toast.succes("Nouvelle version acceptée : les valeurs ont été mises à jour.");
      setHistorique(null);
      await charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setDecisionEnCours(false);
    }
  }

  async function refuserNouvelleVersion() {
    if (!idDossier) return;
    const ok = await confirmer({
      titre: "Refuser cette mise à jour DHIS2 ?",
      description: "Le dossier restera inchangé. Cette proposition sera classée sans suite.",
      libelleConfirmer: "Refuser la mise à jour",
      dangereux: true
    });
    if (!ok) return;
    setDecisionEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/nouvelle-version/refuser/`, { methode: "POST" });
      toast.info("Mise à jour refusée.");
      await charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setDecisionEnCours(false);
    }
  }

  if (chargement) {
    return (
      <MiseEnPage liens={liens}>
        <SqueletteDossier />
      </MiseEnPage>
    );
  }

  if (!dossier) {
    // Hors ligne sur un dossier jamais consulté en ligne : il n'y a rien en
    // cache local à afficher. On le dit, plutôt que de laisser tourner un
    // chargement qui n'aboutira jamais.
    return (
      <MiseEnPage liens={liens}>
        <div className="eva-dd">
          <EtatVide
            variante={enLigne ? "erreur" : "attention"}
            icone={<WifiOff size={26} />}
            titre={enLigne ? "Ce dossier n'a pas pu être chargé" : "Ce dossier n'est pas disponible hors ligne"}
            description={
              enLigne
                ? "Le serveur n'a pas répondu, et aucune copie de ce dossier n'est conservée sur cet appareil. Réessayez dans un instant."
                : "Seuls les dossiers déjà ouverts au moins une fois avec du réseau sont conservés sur cet appareil. Reconnectez-vous pour le consulter."
            }
            action={
              <div className="eva-groupe-boutons">
                <LienBouton to={`${basePath}/dossiers`} variante="secondaire">
                  Retour aux dossiers
                </LienBouton>
                {enLigne && <Bouton onClick={() => void charger()}>Réessayer</Bouton>}
              </div>
            }
          />
        </div>
      </MiseEnPage>
    );
  }

  const peutValider =
    dossier.statut === "recu" || dossier.statut === "notifie" || dossier.statut === "en_attente_complement";
  const champsObligatoiresManquants = champs.filter((c) => c.obligatoire && champEstVide(c.valeur_actuelle));
  const enEtapes = planFormulaire(champs, miseEnPage).mode === "etapes";
  const peutEmettreActe = estAgent && dossier.statut === "complete";
  const peutRelancer = dossier.statut !== "acte_emis" && dossier.statut !== "sans_suite";
  const propositionEnAttente = dossier.nouvelle_version?.statut === "en_attente" ? dossier.nouvelle_version : null;
  const demandesEnAttente = demandes ? demandes.filter((d) => d.statut === "en_attente").length : 0;

  // Bouton d'enregistrement du dernier pas (récapitulatif) en mode étapes ; en
  // mode linéaire et sur les autres onglets, la barre collante fait le travail.
  const boutonEnregistrer = (
    <Bouton onClick={enregistrer} chargement={enregistrement} disabled={nbModifications === 0}>
      {enLigne ? "Enregistrer les modifications" : "Enregistrer hors ligne"}
    </Bouton>
  );

  const compteur = (nombre: number | undefined) => (nombre && nombre > 0 ? nombre : undefined);

  return (
    <MiseEnPage liens={liens}>
      <div className="eva-dd">
        <EnteteDossier
          dossier={dossier}
          basePath={basePath}
          acte={acte}
          horsLigne={horsLigne}
          actions={
            <ActionsDossier
              peutValider={peutValider}
              explicationValidationBloquee={
                champsObligatoiresManquants.length > 0
                  ? `Champs obligatoires manquants : ${champsObligatoiresManquants.map((c) => c.label).join(", ")}.`
                  : undefined
              }
              onValider={valider}
              peutApercevoir={dossier.statut === "complete"}
              apercuEnCours={apercuActeEnCours}
              onApercu={telechargerApercuActe}
              peutEmettre={peutEmettreActe}
              onEmettre={() => navigate(`${basePath}/dossiers/${idDossier}/emission-acte`)}
              lienActe={dossier.statut === "acte_emis" ? `${basePath}/dossiers/${idDossier}/acte-pdf` : undefined}
              peutVoirSignataire={dossier.statut === "acte_emis" && !!acte?.signataire}
              signataireEnCours={chargementSignataire}
              onSignataire={voirSignataire}
              peutRelancer={peutRelancer}
              relanceEnCours={relanceEnCours}
              onRelancer={relancerMaintenant}
              masquerMobile={nbModifications > 0}
            />
          }
        />

        {horsLigne && <BandeauHorsLigne lienSynchronisation={estAgent ? "/agent/synchronisation" : undefined} />}

        {dossier.verrouille && idDossier && (
          <BandeauVerrou
            idDossier={idDossier}
            peutDemander={estAgent}
            champs={champs}
            demandesEnAttente={demandesEnAttente}
            onDemandeEnvoyee={rafraichirDemandes}
            onVoirDemandes={() => setOnglet("demandes")}
          />
        )}

        {propositionEnAttente && (
          <PropositionDhis2
            proposition={propositionEnAttente}
            champs={champs}
            decisionEnCours={decisionEnCours}
            horsLigne={horsLigne}
            onAccepter={accepterNouvelleVersion}
            onRefuser={refuserNouvelleVersion}
          />
        )}

        <Onglets
          ariaLabel="Sections du dossier"
          actif={onglet}
          onChanger={setOnglet}
          onglets={[
            { id: "formulaire", libelle: "Formulaire" },
            { id: "historique", libelle: "Historique", compteur: compteur(historique?.length) },
            { id: "notifications", libelle: "Notifications", compteur: compteur(notifications?.length) },
            { id: "demandes", libelle: "Demandes", compteur: compteur(demandes?.length) }
          ]}
        />

        <div role="tabpanel" id={`onglet-panneau-${onglet}`} aria-labelledby={`onglet-${onglet}`}>
          {onglet === "formulaire" && idDossier && (
            <PanneauFormulaire
              idDossier={idDossier}
              champs={champs}
              miseEnPage={miseEnPage}
              valeurs={valeursModifiees}
              onChange={modifierValeur}
              verrouille={dossier.verrouille}
              actionFinale={enEtapes ? boutonEnregistrer : undefined}
              manquantsAvantValidation={peutValider ? champsObligatoiresManquants : []}
              modificationsEnAttente={nbModifications > 0}
            />
          )}
          {onglet === "historique" && (
            <PanneauHistorique
              historique={historique}
              erreur={erreurHistorique}
              champs={champs}
              horsLigne={horsLigne}
              onReessayer={() => setErreurHistorique(null)}
            />
          )}
          {onglet === "notifications" && (
            <PanneauNotifications
              notifications={notifications}
              erreur={erreurNotifications}
              horsLigne={horsLigne}
              onReessayer={() => setErreurNotifications(null)}
              peutRelancer={peutRelancer}
              relanceEnCours={relanceEnCours}
              onRelancer={relancerMaintenant}
            />
          )}
          {onglet === "demandes" && (
            <PanneauDemandes
              demandes={demandes}
              erreur={erreurDemandes}
              champs={champs}
              horsLigne={horsLigne}
              onReessayer={() => setErreurDemandes(null)}
            />
          )}
        </div>

        <BarreEnregistrement
          modifie={nbModifications > 0}
          masquerSiInchange
          enregistrement={enregistrement}
          erreur={erreurEnregistrement}
          onEnregistrer={enregistrer}
          onAnnuler={annulerModifications}
          libelleAnnuler="Annuler les modifications"
          libelleEnregistrer={enLigne ? "Enregistrer" : "Enregistrer hors ligne"}
          messageModifie={`${pluriel(nbModifications, "modification non enregistrée", "modifications non enregistrées")}${
            enLigne ? "" : " (hors ligne : elles seront mises en file d'attente)"
          }`}
          avertirAvantDepart
        />
      </div>

      {signataireVisible && (
        <Modale titre="Signataire de l'acte" taille="petit" onFermer={() => setSignataireVisible(null)}>
          <dl className="eva-definitions">
            <dt>Nom</dt>
            <dd>
              {signataireVisible.nom} {signataireVisible.prenom}
            </dd>
            <dt>Fonction</dt>
            <dd>{signataireVisible.fonction}</dd>
            <dt>Statut</dt>
            <dd>
              {signataireVisible.actif ? (
                <Badge variante="succes" point>
                  Actif
                </Badge>
              ) : (
                <Badge variante="attente" point>
                  Signataire désactivé
                </Badge>
              )}
            </dd>
          </dl>
        </Modale>
      )}
    </MiseEnPage>
  );
}
