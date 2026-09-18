import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BellRing, CheckCircle2, FileSignature, GitCompareArrows, UserCheck } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import ChampDynamique from "../../components/ChampDynamique";
import { Badge, Bouton, Carte, ChargementPage, EnteteDePage, Frise, Modale, Onglets } from "../../components/ui";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import { useToast } from "../../components/ui/ToastProvider";
import { useAuth } from "../../context/AuthContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { mettreEnFileAction, mettreEnCacheDossier, dossierEnCache } from "../../lib/db";
import { useConnectivite } from "../../lib/connectivite";
import { LIENS_AGENT } from "./navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";
import {
  listeDepuis,
  type Acte,
  type ChampFormulaireEffectif,
  type DemandeModificationActe,
  type Dossier,
  type ListeOuPaginee,
  type NotificationDossier,
  type SignataireMairie,
  type ValeurChamp
} from "../../types/domaine";

const LIBELLES_STATUT_DEMANDE: Record<DemandeModificationActe["statut"], { texte: string; variante: "attente" | "succes" | "danger" }> = {
  en_attente: { texte: "En attente de validation", variante: "attente" },
  validee: { texte: "Validee : acte reemis", variante: "succes" },
  rejetee: { texte: "Rejetee", variante: "danger" }
};

interface ReponseFormulaireEffectif {
  champs: ChampFormulaireEffectif[];
}

const LIBELLES_TYPE_NOTIFICATION: Record<string, string> = {
  initiale: "Notification initiale",
  relance: "Relance",
  confirmation: "Confirmation"
};

const LIBELLES_STATUT_NOTIFICATION: Record<string, string> = {
  envoye: "Envoyee",
  echec: "Echec",
  en_attente: "En attente"
};

function formaterValeur(valeur: unknown): string {
  console.log("valeur à formater ", valeur);
  if (valeur === null || valeur === undefined || valeur === "") return "(vide)";
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
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
  const [valeursModifiees, setValeursModifiees] = useState<Record<string, unknown>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [horsLigne, setHorsLigne] = useState(!enLigne);
  const [onglet, setOnglet] = useState("formulaire");
  const [historique, setHistorique] = useState<ValeurChamp[] | null>(null);
  const [notifications, setNotifications] = useState<NotificationDossier[] | null>(null);
  const [demandes, setDemandes] = useState<DemandeModificationActe[] | null>(null);
  const [decisionEnCours, setDecisionEnCours] = useState(false);
  const [relanceEnCours, setRelanceEnCours] = useState(false);
  const [acte, setActe] = useState<Acte | null>(null);
  const [signataireVisible, setSignataireVisible] = useState<SignataireMairie | null>(null);
  const [chargementSignataire, setChargementSignataire] = useState(false);

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

  useEffect(() => {
    if (onglet === "historique" && idDossier && historique === null) {
      appelApi<ValeurChamp[]>(`/dossiers/${idDossier}/historique/`)
        .then(setHistorique)
        .catch(() => setHistorique([]));
    }
  }, [onglet, idDossier, historique]);

  useEffect(() => {
    if (onglet === "notifications" && idDossier && notifications === null) {
      appelApi<ListeOuPaginee<NotificationDossier>>(`/dossiers/${idDossier}/notifications/`)
        .then((donnees) => setNotifications(listeDepuis(donnees)))
        .catch(() => setNotifications([]));
    }
  }, [onglet, idDossier, notifications]);

  useEffect(() => {
    // Suivi des demandes de modification d'acte : charge a l'ouverture de
    // l'onglet, et au premier affichage du dossier pour afficher le compteur.
    if (idDossier && demandes === null && (onglet === "demandes" || dossier)) {
      appelApi<DemandeModificationActe[]>(`/dossiers/${idDossier}/acte/demandes-modification`)
        .then(setDemandes)
        .catch(() => setDemandes([]));
    }
  }, [onglet, idDossier, demandes, dossier]);

  useEffect(() => {
    // Necessaire pour le bouton "Voir le signataire" (a cote de "Voir le
    // PDF") : seul le PDF etait accessible jusqu'ici, sans donnee JSON sur
    // l'acte lui-meme.
    if (idDossier && dossier?.statut === "acte_emis" && acte === null) {
      appelApi<Acte>(`/dossiers/${idDossier}/acte/`)
        .then(setActe)
        .catch(() => setActe(null));
    }
  }, [idDossier, dossier, acte]);

  async function voirSignataire() {
    if (!acte?.signataire) return;
    setChargementSignataire(true);
    try {
      const signataire = await appelApi<SignataireMairie>(`/signataires/${acte.signataire}/`);
      setSignataireVisible(signataire);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Impossible de charger le signataire.");
    } finally {
      setChargementSignataire(false);
    }
  }

  async function relancerMaintenant() {
    if (!idDossier) return;
    const ok = await confirmer({
      titre: "Envoyer une relance maintenant ?",
      description: "Un SMS/WhatsApp sera envoye immediatement au declarant, en plus des relances automatiques deja programmees (J-10/J-3)."
    });
    if (!ok) return;
    setRelanceEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/notifications/relance-manuelle`, { methode: "POST" });
      toast.succes("Relance envoyee.");
      setNotifications(null);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setRelanceEnCours(false);
    }
  }

  const libelleParCode = useMemo(() => {
    const table: Record<string, string> = {};
    for (const c of champs) table[c.data_element_code] = c.label;
    return table;
  }, [champs]);

  function modifierValeur(codeChamp: string, valeur: unknown) {
    setValeursModifiees((precedent) => ({ ...precedent, [codeChamp]: valeur }));
  }

  async function enregistrer() {
    if (!idDossier || !dossier) return;
    setEnregistrement(true);
    const entrees = Object.entries(valeursModifiees);

    try {
      if (enLigne) {
        for (const [dataElementCode, valeur] of entrees) {
          await appelApi(`/dossiers/${idDossier}/valeurs/`, {
            methode: "POST",
            corps: { data_element_code: dataElementCode, valeur }
          });
        }
        toast.succes("Modifications enregistrees.");
      } else {
        for (const [dataElementCode, valeur] of entrees) {
          await mettreEnFileAction({
            type: "ajout_valeur",
            dossierId: idDossier,
            versionConnue: dossier.version,
            payload: { data_element_code: dataElementCode, valeur }
          });
        }
        toast.info("Hors-ligne : modifications mises en file, elles seront envoyees au retour du reseau.");
      }
      setValeursModifiees({});
      setHistorique(null);
      await charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function valider() {
    if (!idDossier) return;
    const ok = await confirmer({
      titre: "Marquer ce dossier comme complet ?",
      description: "L'agent pourra ensuite proceder a l'emission de l'acte. Cette etape confirme que toutes les informations necessaires ont ete verifiees.",
      libelleConfirmer: "Marquer comme complet"
    });
    if (!ok) return;
    try {
      await appelApi(`/dossiers/${idDossier}/valider/`, { methode: "POST" });
      toast.succes("Dossier marque comme complet.");
      await charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    }
  }

  async function accepterNouvelleVersion() {
    if (!idDossier) return;
    setDecisionEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/nouvelle-version/accepter/`, { methode: "POST" });
      toast.succes("Nouvelle version acceptee : les valeurs ont ete mises a jour.");
      setHistorique(null);
      await charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setDecisionEnCours(false);
    }
  }

  async function refuserNouvelleVersion() {
    if (!idDossier) return;
    const ok = await confirmer({
      titre: "Refuser cette mise a jour DHIS2 ?",
      description: "Le dossier restera inchange. Cette proposition sera classee sans suite.",
      libelleConfirmer: "Refuser",
      dangereux: true
    });
    if (!ok) return;
    setDecisionEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/nouvelle-version/refuser/`, { methode: "POST" });
      toast.info("Mise a jour refusee.");
      await charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setDecisionEnCours(false);
    }
  }

  if (!dossier) {
    return (
      <MiseEnPage liens={liens}>
        <ChargementPage texte="Chargement du dossier..." />
      </MiseEnPage>
    );
  }

  const peutValider =
    dossier.statut === "recu" || dossier.statut === "notifie" || dossier.statut === "en_attente_complement";
  const peutEmettreActe = estAgent && dossier.statut === "complete";
  const peutRelancer = dossier.statut !== "acte_emis" && dossier.statut !== "sans_suite";
  const propositionEnAttente = dossier.nouvelle_version?.statut === "en_attente" ? dossier.nouvelle_version : null;
  console.log("propositionEnAttente", propositionEnAttente);

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage
        titre={`Dossier ${dossier.event_type === "naissance" ? "naissance" : "deces"}`}
        sousTitre={
          <span className="texte-mono">
            Origine {dossier.origine === "dhis2" ? "DHIS2" : "manuelle"} · Declare le {dossier.date_declaration} ·
            Limite {dossier.date_limite}
          </span>
        }
        actions={<BadgeStatut statut={dossier.statut} />}
      />

      {horsLigne && (
        <div className="eva-carte" style={{ background: "var(--couleur-citron-fond)", borderColor: "var(--couleur-citron-profond)", marginBottom: 16, fontSize: 13.5 }}>
          Vous consultez une version mise en cache localement. Les modifications seront envoyees au retour du reseau.
        </div>
      )}

      {propositionEnAttente && (
        <Carte style={{ marginBottom: 20, borderColor: "var(--couleur-citron-profond)", background: "var(--couleur-citron-fond)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <GitCompareArrows size={18} color="var(--couleur-vert-profond)" />
            <strong style={{ fontSize: 14 }}>Une mise a jour a ete recue depuis DHIS2</strong>
          </div>
          <p style={{ fontSize: 13.5, marginBottom: 12 }}>
            L'hopital a transmis des valeurs differentes de celles deja connues pour ce dossier. Rien n'a ete
            applique : comparez et decidez ci-dessous.
          </p>
          <div className="eva-tableau-conteneur" style={{ marginBottom: 14 }}>
            <table className="eva-tableau">
              <thead>
                <tr>
                  <th>Champ</th>
                  <th>Valeur actuelle</th>
                  <th>Valeur proposee</th>
                </tr>
              </thead>
              <tbody>
                {propositionEnAttente.champs_modifies.map((diff, index) => (
                  <tr key={index}>

                    <td>{diff.label || diff.data_element_code || "-"}</td>
                    <td>{formaterValeur(diff.valeur_actuelle)}</td>
                    <td style={{ fontWeight: 600 }}>{formaterValeur(diff.valeur_proposee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Bouton variante="accent" onClick={accepterNouvelleVersion} chargement={decisionEnCours}>
              Accepter la mise a jour
            </Bouton>
            <Bouton variante="secondaire" onClick={refuserNouvelleVersion} disabled={decisionEnCours}>
              Refuser
            </Bouton>
          </div>
        </Carte>
      )}

      <Onglets
        onglets={[
          { id: "formulaire", libelle: "Formulaire" },
          { id: "historique", libelle: "Historique" },
          { id: "notifications", libelle: "Notifications" },
          {
            id: "demandes",
            libelle:
              "Demandes de modification" +
              (demandes && demandes.some((d) => d.statut === "en_attente")
                ? ` (${demandes.filter((d) => d.statut === "en_attente").length} en attente)`
                : "")
          }
        ]}
        actif={onglet}
        onChanger={setOnglet}
      />

      {onglet === "formulaire" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          {peutRelancer && (
            <Bouton
              variante="fantome"
              taille="petit"
              onClick={relancerMaintenant}
              chargement={relanceEnCours}
              iconeGauche={!relanceEnCours && <BellRing size={14} />}
            >
              Relancer maintenant
            </Bouton>
          )}
        </div>
      )}

      {onglet === "formulaire" ? (
        <>
          <Carte style={{ marginBottom: 20 }}>
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
              <Bouton onClick={enregistrer} chargement={enregistrement} disabled={Object.keys(valeursModifiees).length === 0}>
                Enregistrer les modifications
              </Bouton>
            )}
          </Carte>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {peutValider && (
              <Bouton variante="secondaire" onClick={valider} iconeGauche={<CheckCircle2 size={16} />}>
                Marquer comme complete
              </Bouton>
            )}
            {peutEmettreActe && (
              <Bouton variante="accent" onClick={() => navigate(`${basePath}/dossiers/${idDossier}/emission-acte`)} iconeGauche={<FileSignature size={16} />}>
                Emettre l'acte
              </Bouton>
            )}
            {dossier.statut === "acte_emis" && (
              <Link to={`${basePath}/dossiers/${idDossier}/acte-pdf`} className="eva-bouton eva-bouton--secondaire eva-bouton--moyen">
                Voir le PDF de l'acte
              </Link>
            )}
            {dossier.statut === "acte_emis" && acte?.signataire && (
              <Bouton
                variante="fantome"
                onClick={voirSignataire}
                chargement={chargementSignataire}
                iconeGauche={<UserCheck size={16} />}
              >
                Voir le signataire
              </Bouton>
            )}
          </div>
        </>
      ) : onglet === "historique" ? (
        <Carte>
          {historique === null ? (
            <ChargementPage texte="Chargement de l'historique..." />
          ) : historique.length === 0 ? (
            <p style={{ color: "var(--couleur-gris-service-2)" }}>Aucune valeur enregistree pour ce dossier.</p>
          ) : (
            <Frise
              elements={historique.map((v) => ({
                id: v.id,
                date: new Date(v.created_at).toLocaleString("fr-FR"),
                contenu: (
                  <>
                    <strong>{libelleParCode[v.data_element_code] || v.data_element_code}</strong> ={" "}
                    {formaterValeur(v.valeur)}{" "}
                    <span style={{ color: "var(--couleur-gris-service-2)" }}>, {v.source === "dhis2" ? "DHIS2" : v.source === "parent" ? "le parent/declarant" : v.source === "agent_sante" ? "l'agent de sante" : "l'agent d'etat civil"}
                    </span>
                  </>
                )
              }))}
            />
          )}
        </Carte>
      ) : onglet === "demandes" ? (
        <Carte>
          {demandes === null ? (
            <ChargementPage texte="Chargement des demandes..." />
          ) : demandes.length === 0 ? (
            <p style={{ color: "var(--couleur-gris-service-2)" }}>
              Aucune demande de modification d'acte pour ce dossier. Une demande se fait depuis l'ecran de l'acte, une fois celui-ci emis.
            </p>
          ) : (
            <Frise
              elements={demandes.map((d) => {
                const etat = LIBELLES_STATUT_DEMANDE[d.statut];
                return {
                  id: d.id,
                  date: new Date(d.created_at).toLocaleString("fr-FR"),
                  contenu: (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <Badge variante={etat.variante}>{etat.texte}</Badge>
                        <span style={{ fontSize: 12, color: "var(--couleur-gris-service-2)" }}>
                          validation {d.niveau_requis === "national" ? "nationale" : "regionale"} requise
                          {d.demandeur_nom ? ` , demandee par ${d.demandeur_nom}` : ""}
                        </span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                        {Object.entries(d.champs_modifies).map(([code, valeurs]) => (
                          <li key={code}>
                            <strong>{libelleParCode[code] || code}</strong> : {formaterValeur(valeurs.ancienne_valeur)}{" "}
                            <span style={{ color: "var(--couleur-gris-service-2)" }}>devient</span> {formaterValeur(valeurs.nouvelle_valeur)}
                          </li>
                        ))}
                      </ul>
                      {d.decided_at && (
                        <div style={{ fontSize: 12.5, color: "var(--couleur-gris-service-1)" }}>
                          Decision le {new Date(d.decided_at).toLocaleString("fr-FR")}
                          {d.validateur_nom ? ` par ${d.validateur_nom}` : ""}
                          {d.commentaire_validateur ? ` : ${d.commentaire_validateur}` : ""}
                        </div>
                      )}
                    </div>
                  )
                };
              })}
            />
          )}
        </Carte>
      ) : (
        <Carte>
          {notifications === null ? (
            <ChargementPage texte="Chargement des notifications..." />
          ) : notifications.length === 0 ? (
            <p style={{ color: "var(--couleur-gris-service-2)" }}>Aucune notification envoyee pour ce dossier.</p>
          ) : (
            <div className="eva-tableau-conteneur">
              <table className="eva-tableau">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Canal</th>
                    <th>Fournisseur</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td className="texte-mono">{new Date(n.created_at).toLocaleString("fr-FR")}</td>
                      <td>{LIBELLES_TYPE_NOTIFICATION[n.type] || n.type}</td>
                      <td>{n.canal === "sms" ? "SMS" : "WhatsApp"}</td>
                      <td>{n.fournisseur_utilise || "-"}</td>
                      <td>{LIBELLES_STATUT_NOTIFICATION[n.statut] || n.statut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
      )}

      {signataireVisible && (
        <Modale titre="Signataire de l'acte" onFermer={() => setSignataireVisible(null)}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            {signataireVisible.nom} {signataireVisible.prenom}
          </p>
          <p style={{ color: "var(--couleur-gris-service-2)", marginBottom: 10 }}>{signataireVisible.fonction}</p>
          {!signataireVisible.actif && <Badge variante="attente">Signataire desactive</Badge>}
        </Modale>
      )}
    </MiseEnPage>
  );
}
