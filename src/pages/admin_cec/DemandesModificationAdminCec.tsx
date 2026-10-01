import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardCheck, Eye, RefreshCw, XCircle } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import {
  Alerte,
  Badge,
  BarreOutils,
  Bouton,
  Champ,
  EnteteDePage,
  ListeResponsive,
  Modale,
  PilulesFiltre,
  Squelette,
  useToast,
  type ColonneListe,
  type PiluleFiltre,
  type VarianteBadge
} from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDate, formaterDateHeure, libelleDepuisCode, libelleEvenement, messageErreur } from "./outils";
import { listeDepuis, type DemandeModificationActe, type ListeOuPaginee, type NumerosActeProposes } from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";

type StatutDemande = DemandeModificationActe["statut"];
type FiltreStatut = StatutDemande | "toutes";

const LIBELLES_STATUT: Record<StatutDemande, string> = { en_attente: "En attente", validee: "Validée", rejetee: "Rejetée" };
const VARIANTES_STATUT: Record<StatutDemande, VarianteBadge> = { en_attente: "attente", validee: "succes", rejetee: "danger" };
const LIBELLES_NIVEAU: Record<string, string> = { regional: "Régional", national: "National" };

function formaterValeur(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "(vide)";
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

function estVide(valeur: unknown): boolean {
  return valeur === null || valeur === undefined || valeur === "";
}

function BadgeStatutDemande({ statut }: { statut: StatutDemande }) {
  return (
    <Badge variante={VARIANTES_STATUT[statut] ?? "neutre"} point>
      {LIBELLES_STATUT[statut] ?? statut}
    </Badge>
  );
}

function BadgeNiveau({ niveau }: { niveau: string }) {
  return <Badge variante={niveau === "national" ? "info" : "neutre"}>{LIBELLES_NIVEAU[niveau] || niveau}</Badge>;
}

/** Fait défiler la modale jusqu'à l'étape de décision, sinon elle reste sous la comparaison. */
function montrerEtape(element: HTMLFormElement | null) {
  element?.scrollIntoView({ block: "nearest" });
}

export default function DemandesModificationAdminCec() {
  const toast = useToast();
  const [parametresUrl] = useSearchParams();
  const evenementFiltre = parametresUrl.get("event_type") || "";
  const [demandes, setDemandes] = useState<DemandeModificationActe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<FiltreStatut>("en_attente");

  const [demandeExaminee, setDemandeExaminee] = useState<DemandeModificationActe | null>(null);
  const [mode, setMode] = useState<"valider" | "rejeter" | null>(null);
  const [numeros, setNumeros] = useState<NumerosActeProposes | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [actionEnCours, setActionEnCours] = useState(false);
  const [preparationEnCours, setPreparationEnCours] = useState(false);

  function charger() {
    setChargement(true);
    setErreur(null);
    const parametres = new URLSearchParams();
    if (evenementFiltre) parametres.set("dossier__event_type", evenementFiltre);
    appelApi<ListeOuPaginee<DemandeModificationActe>>(`/demandes-modification/?${parametres.toString()}`)
      .then((donnees) => setDemandes(listeDepuis(donnees)))
      .catch((e) => setErreur(messageErreur(e, "Impossible de charger les demandes.")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenementFiltre]);

  const decompte = useMemo(
    () => ({
      en_attente: demandes.filter((d) => d.statut === "en_attente").length,
      validee: demandes.filter((d) => d.statut === "validee").length,
      rejetee: demandes.filter((d) => d.statut === "rejetee").length,
      toutes: demandes.length
    }),
    [demandes]
  );

  const pilules: PiluleFiltre<FiltreStatut>[] = [
    { valeur: "en_attente", libelle: "En attente", compteur: decompte.en_attente, alerte: true },
    { valeur: "validee", libelle: "Validées", compteur: decompte.validee },
    { valeur: "rejetee", libelle: "Rejetées", compteur: decompte.rejetee },
    { valeur: "toutes", libelle: "Toutes", compteur: decompte.toutes }
  ];

  const demandesAffichees = filtre === "toutes" ? demandes : demandes.filter((d) => d.statut === filtre);

  function fermerModale() {
    setDemandeExaminee(null);
    setMode(null);
    setNumeros(null);
    setCommentaire("");
  }

  async function demarrerValidation() {
    if (!demandeExaminee) return;
    setMode("valider");
    setPreparationEnCours(true);
    try {
      const proposes = await appelApi<NumerosActeProposes>(`/demandes-modification/${demandeExaminee.id}/numeros-proposes/`);
      setNumeros(proposes);
    } catch (e) {
      toast.erreur(messageErreur(e, "Impossible de récupérer les numéros proposés."));
      setMode(null);
    } finally {
      setPreparationEnCours(false);
    }
  }

  async function confirmerValidation(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!demandeExaminee || !numeros) return;
    setActionEnCours(true);
    try {
      await appelApi(`/demandes-modification/${demandeExaminee.id}/valider/`, { methode: "POST", corps: numeros });
      toast.succes("Demande validée : l'ancien acte est annulé, un nouvel acte a été émis.");
      fermerModale();
      charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setActionEnCours(false);
    }
  }

  async function confirmerRejet(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!demandeExaminee || !commentaire.trim()) return;
    setActionEnCours(true);
    try {
      await appelApi(`/demandes-modification/${demandeExaminee.id}/rejeter/`, { methode: "POST", corps: { commentaire } });
      toast.info("Demande rejetée.");
      fermerModale();
      charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setActionEnCours(false);
    }
  }

  const colonnes: ColonneListe<DemandeModificationActe>[] = [
    {
      id: "dossier",
      libelle: "Dossier",
      principale: true,
      rendu: (d) => <span className="texte-mono">{d.dossier.slice(0, 8)}</span>
    },
    { id: "evenement", libelle: "Événement", rendu: (d) => libelleEvenement(d.dossier_event_type) },
    {
      id: "champs",
      libelle: "Champs concernés",
      rendu: (d) => compterAvecUnite(Object.keys(d.champs_modifies).length, "champ")
    },
    { id: "niveau", libelle: "Niveau requis", rendu: (d) => <BadgeNiveau niveau={d.niveau_requis} /> },
    { id: "statut", libelle: "Statut", rendu: (d) => <BadgeStatutDemande statut={d.statut} /> },
    {
      id: "date",
      libelle: "Demandée le",
      alignement: "droite",
      triable: true,
      valeurTri: (d) => new Date(d.created_at),
      rendu: (d) => <span className="texte-mono">{formaterDate(d.created_at)}</span>
    },
    {
      id: "actions",
      libelle: "Actions",
      actions: true,
      masquerLibelle: true,
      rendu: (d) => (
        <Bouton
          variante={d.statut === "en_attente" ? "principal" : "secondaire"}
          taille="petit"
          iconeGauche={<Eye size={14} />}
          onClick={() => setDemandeExaminee(d)}
        >
          {d.statut === "en_attente" ? "Examiner" : "Consulter"}
        </Bouton>
      )
    }
  ];

  const enAttente = demandeExaminee?.statut === "en_attente";

  function actionsModale() {
    if (!demandeExaminee) return undefined;
    if (!enAttente) {
      return (
        <Bouton variante="secondaire" onClick={fermerModale}>
          Fermer
        </Bouton>
      );
    }
    if (mode === "valider") {
      return (
        <>
          <Bouton type="button" variante="fantome" onClick={() => setMode(null)} disabled={actionEnCours}>
            Retour
          </Bouton>
          <Bouton
            type="submit"
            form="formulaire-validation"
            chargement={actionEnCours}
            disabled={!numeros || preparationEnCours}
            iconeGauche={<CheckCircle2 size={16} />}
          >
            Confirmer la validation
          </Bouton>
        </>
      );
    }
    if (mode === "rejeter") {
      return (
        <>
          <Bouton type="button" variante="fantome" onClick={() => setMode(null)} disabled={actionEnCours}>
            Retour
          </Bouton>
          <Bouton
            type="submit"
            form="formulaire-rejet"
            variante="danger-plein"
            chargement={actionEnCours}
            disabled={!commentaire.trim()}
            iconeGauche={<XCircle size={16} />}
          >
            Confirmer le rejet
          </Bouton>
        </>
      );
    }
    return (
      <>
        <Bouton type="button" variante="fantome" onClick={fermerModale}>
          Fermer
        </Bouton>
        <Bouton type="button" variante="danger" iconeGauche={<XCircle size={16} />} onClick={() => setMode("rejeter")}>
          Rejeter
        </Bouton>
        <Bouton type="button" iconeGauche={<CheckCircle2 size={16} />} onClick={demarrerValidation}>
          Valider
        </Bouton>
      </>
    );
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Demandes de modification d'acte"
        sousTitre="Les champs d'identité (nom, prénom, sexe, date de naissance ou de décès) exigent une validation nationale ; les autres champs se traitent au niveau régional."
        badges={evenementFiltre ? <Badge variante="info">{libelleEvenement(evenementFiltre)}</Badge> : undefined}
      />

      <BarreOutils
        carte
        filtres={<PilulesFiltre ariaLabel="Filtrer par statut de la demande" valeur={filtre} onChanger={setFiltre} pilules={pilules} defilement />}
        compteur={!chargement && !erreur ? compterAvecUnite(demandesAffichees.length, "demande") : undefined}
        actions={
          <Bouton variante="secondaire" taille="petit" onClick={charger} disabled={chargement} iconeGauche={<RefreshCw size={14} />}>
            Actualiser
          </Bouton>
        }
      />

      <ListeResponsive<DemandeModificationActe>
        legende="Demandes de modification d'acte"
        lignes={demandesAffichees}
        cle={(d) => d.id}
        colonnes={colonnes}
        chargement={chargement}
        erreur={erreur}
        onReessayer={charger}
        onLigneClic={(d) => setDemandeExaminee(d)}
        hauteurMax="none"
        vide={{
          icone: <ClipboardCheck size={26} />,
          titre: filtre === "en_attente" ? "Aucune demande en attente" : "Aucune demande dans cette catégorie",
          description:
            filtre === "en_attente"
              ? "Les demandes de modification envoyées par les agents apparaîtront ici."
              : "Choisissez un autre filtre pour voir les demandes traitées.",
          action:
            filtre !== "toutes" && demandes.length > 0 ? (
              <Bouton variante="secondaire" onClick={() => setFiltre("toutes")}>
                Voir toutes les demandes
              </Bouton>
            ) : undefined
        }}
      />

      {demandeExaminee && (
        <Modale
          titre="Demande de modification"
          description={
            mode === "valider"
              ? "Dernière étape : vérifiez la numérotation du nouvel acte."
              : mode === "rejeter"
                ? "Indiquez le motif communiqué à l'agent à l'origine de la demande."
                : undefined
          }
          onFermer={fermerModale}
          taille="large"
          fermerAuClicFond={false}
          actions={actionsModale()}
        >
          <dl className="eva-ac-synthese">
            <div>
              <dt>Dossier</dt>
              <dd className="texte-mono">{demandeExaminee.dossier.slice(0, 8)}</dd>
            </div>
            <div>
              <dt>Événement</dt>
              <dd>{libelleEvenement(demandeExaminee.dossier_event_type)}</dd>
            </div>
            <div>
              <dt>Niveau requis</dt>
              <dd>
                <BadgeNiveau niveau={demandeExaminee.niveau_requis} />
              </dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>
                <BadgeStatutDemande statut={demandeExaminee.statut} />
              </dd>
            </div>
            <div>
              <dt>Demandée le</dt>
              <dd>{formaterDateHeure(demandeExaminee.created_at)}</dd>
            </div>
            {demandeExaminee.demandeur_nom && (
              <div>
                <dt>Demandeur</dt>
                <dd>{demandeExaminee.demandeur_nom}</dd>
              </div>
            )}
          </dl>

          <h3 className="eva-ac-titre-groupe">
            Modifications demandées ({Object.keys(demandeExaminee.champs_modifies).length})
          </h3>
          <ul className="eva-ac-diffs" aria-label="Comparaison des valeurs avant et après">
            {Object.entries(demandeExaminee.champs_modifies).map(([code, diff]) => (
              <li key={code} className="eva-ac-diff">
                <div className="eva-ac-diff__champ">
                  <span className="eva-ac-diff__libelle">{libelleDepuisCode(code)}</span>
                  <span className="eva-ac-diff__code texte-mono">{code}</span>
                </div>
                <div className="eva-ac-diff__valeurs">
                  <div className="eva-ac-diff__valeur eva-ac-diff__valeur--avant">
                    <span className="eva-ac-diff__etiquette">Avant</span>
                    <span className={estVide(diff.ancienne_valeur) ? "eva-ac-diff__vide" : undefined}>{formaterValeur(diff.ancienne_valeur)}</span>
                  </div>
                  <ArrowRight size={16} className="eva-ac-diff__fleche" aria-hidden="true" />
                  <div className="eva-ac-diff__valeur eva-ac-diff__valeur--apres">
                    <span className="eva-ac-diff__etiquette">Après</span>
                    <span className={estVide(diff.nouvelle_valeur) ? "eva-ac-diff__vide" : undefined}>{formaterValeur(diff.nouvelle_valeur)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {!enAttente && (
            <Alerte variante={demandeExaminee.statut === "validee" ? "succes" : "avertissement"} titre={`Demande ${LIBELLES_STATUT[demandeExaminee.statut].toLowerCase()}`}>
              {demandeExaminee.validateur_nom ? `Traitée par ${demandeExaminee.validateur_nom}` : "Cette demande a déjà été traitée"}
              {demandeExaminee.decided_at ? ` le ${formaterDateHeure(demandeExaminee.decided_at)}.` : "."}
              {demandeExaminee.commentaire_validateur && ` Commentaire : ${demandeExaminee.commentaire_validateur}`}
            </Alerte>
          )}

          {enAttente && mode === "valider" && (
            <form id="formulaire-validation" ref={montrerEtape} className="eva-ac-etape" onSubmit={confirmerValidation}>
              <Alerte variante="avertissement" titre="L'ancien acte sera annulé">
                Un nouvel acte sera émis avec les numéros suivants. Vous pouvez les modifier avant de confirmer.
              </Alerte>
              {!numeros ? (
                <Squelette variante="bloc" hauteur={92} libelle="Préparation de la numérotation" />
              ) : (
                <div className="eva-grille eva-grille--2 eva-grille--serree">
                  <Champ id="v-numero-registre" label="Numéro de registre">
                    <input id="v-numero-registre" type="number" className="texte-mono" value={numeros.numero_registre} onChange={(e) => setNumeros({ ...numeros, numero_registre: Number(e.target.value) })} />
                  </Champ>
                  <Champ id="v-numero-feuillet" label="Numéro de feuillet">
                    <input id="v-numero-feuillet" type="number" className="texte-mono" value={numeros.numero_feuillet} onChange={(e) => setNumeros({ ...numeros, numero_feuillet: Number(e.target.value) })} />
                  </Champ>
                  <Champ id="v-numero-acte" label="Numéro d'acte">
                    <input id="v-numero-acte" type="number" className="texte-mono" value={numeros.numero_acte} onChange={(e) => setNumeros({ ...numeros, numero_acte: Number(e.target.value) })} />
                  </Champ>
                  <Champ id="v-annee-registre" label="Année du registre">
                    <input id="v-annee-registre" type="number" className="texte-mono" value={numeros.annee_registre} onChange={(e) => setNumeros({ ...numeros, annee_registre: Number(e.target.value) })} />
                  </Champ>
                </div>
              )}
            </form>
          )}

          {enAttente && mode === "rejeter" && (
            <form id="formulaire-rejet" ref={montrerEtape} className="eva-ac-etape" onSubmit={confirmerRejet}>
              <Champ id="commentaire-rejet" label="Motif du rejet" requis aide="Ce motif est conservé dans l'historique de la demande.">
                <textarea id="commentaire-rejet" rows={3} required autoFocus value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
              </Champ>
            </form>
          )}
        </Modale>
      )}
    </MiseEnPage>
  );
}
