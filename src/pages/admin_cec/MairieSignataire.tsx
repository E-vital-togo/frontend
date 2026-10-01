import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FileSignature, Lock, Pencil, Plus, Power, Trash2, UserCheck } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import {
  Avatar,
  Badge,
  BarreOutils,
  BarreRecherche,
  Bouton,
  Champ,
  EnteteDePage,
  ItemMenu,
  ListeResponsive,
  Modale,
  PilulesFiltre,
  Selecteur,
  SeparateurMenu,
  useConfirmation,
  useToast,
  type ColonneListe,
  type PiluleFiltre
} from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import MenuActionsLigne from "./MenuActionsLigne";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDate, libelleEvenement, messageErreur } from "./outils";
import {
  listeDepuis,
  type ActeSigneParSignataire,
  type ListeOuPaginee,
  type Mairie,
  type SignataireMairie
} from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";

interface FormulaireSignataire {
  mairie: string;
  nom: string;
  prenom: string;
  fonction: string;
}

type FiltreSignataire = "" | "actifs" | "inactifs";

const FORMULAIRE_VIDE: FormulaireSignataire = { mairie: "", nom: "", prenom: "", fonction: "" };

interface ProprietesChampsSignataire {
  prefixe: string;
  valeurs: FormulaireSignataire;
  mairies: Mairie[];
  afficherMairie: boolean;
  avecAide?: boolean;
  onChange: (valeurs: FormulaireSignataire) => void;
}

/** Champs communs à la création et à la modification d'un signataire. */
function ChampsSignataire({ prefixe, valeurs, mairies, afficherMairie, avecAide, onChange }: ProprietesChampsSignataire) {
  return (
    <>
      {afficherMairie && (
        <Champ id={`${prefixe}-mairie`} label="Mairie" requis>
          <Selecteur id={`${prefixe}-mairie`} requis valeur={valeurs.mairie} onChange={(v) => onChange({ ...valeurs, mairie: v })}>
            {mairies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </Selecteur>
        </Champ>
      )}
      <div className="eva-grille eva-grille--2 eva-grille--serree">
        <Champ id={`${prefixe}-nom`} label="Nom" requis>
          <input id={`${prefixe}-nom`} required autoComplete="off" value={valeurs.nom} onChange={(e) => onChange({ ...valeurs, nom: e.target.value })} />
        </Champ>
        <Champ id={`${prefixe}-prenom`} label="Prénom" requis>
          <input id={`${prefixe}-prenom`} required autoComplete="off" value={valeurs.prenom} onChange={(e) => onChange({ ...valeurs, prenom: e.target.value })} />
        </Champ>
      </div>
      <Champ id={`${prefixe}-fonction`} label="Fonction" requis aide={avecAide ? "Maire, adjoint au maire, secrétaire général..." : undefined}>
        <input id={`${prefixe}-fonction`} required autoComplete="off" value={valeurs.fonction} onChange={(e) => onChange({ ...valeurs, fonction: e.target.value })} />
      </Champ>
    </>
  );
}

export default function MairieSignataire() {
  const toast = useToast();
  const confirmer = useConfirmation();

  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [signataires, setSignataires] = useState<SignataireMairie[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreSignataire>("");

  const [modaleCreationOuverte, setModaleCreationOuverte] = useState(false);
  const [formulaireCreation, setFormulaireCreation] = useState<FormulaireSignataire>(FORMULAIRE_VIDE);
  const [creationEnCours, setCreationEnCours] = useState(false);

  const [signataireEnEdition, setSignataireEnEdition] = useState<SignataireMairie | null>(null);
  const [formulaireEdition, setFormulaireEdition] = useState<FormulaireSignataire>(FORMULAIRE_VIDE);
  const [editionEnCours, setEditionEnCours] = useState(false);

  const [signataireActesVus, setSignataireActesVus] = useState<SignataireMairie | null>(null);
  const [actesSignes, setActesSignes] = useState<ActeSigneParSignataire[] | null>(null);
  const [chargementActes, setChargementActes] = useState(false);

  const [actionEnCoursId, setActionEnCoursId] = useState<string | null>(null);

  function charger() {
    setChargement(true);
    setErreurChargement(null);
    Promise.all([
      appelApi<ListeOuPaginee<Mairie>>("/mairies/"),
      appelApi<ListeOuPaginee<SignataireMairie>>("/signataires/")
    ])
      .then(([donneesMairies, donneesSignataires]) => {
        const listeMairies = listeDepuis(donneesMairies);
        setMairies(listeMairies);
        setSignataires(listeDepuis(donneesSignataires));
        setFormulaireCreation((precedent) => ({ ...precedent, mairie: precedent.mairie || listeMairies[0]?.id || "" }));
      })
      .catch((e) => setErreurChargement(messageErreur(e, "Impossible de charger les signataires.")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
  }, []);

  const affichageMairie = mairies.length > 1;

  const decompte = useMemo(
    () => ({
      tous: signataires.length,
      actifs: signataires.filter((s) => s.actif).length,
      inactifs: signataires.filter((s) => !s.actif).length
    }),
    [signataires]
  );

  const pilules: PiluleFiltre<FiltreSignataire>[] = [
    { valeur: "", libelle: "Tous", compteur: decompte.tous },
    { valeur: "actifs", libelle: "Actifs", compteur: decompte.actifs },
    { valeur: "inactifs", libelle: "Inactifs", compteur: decompte.inactifs }
  ];

  const signatairesAffiches = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return signataires.filter((s) => {
      if (filtre === "actifs" && !s.actif) return false;
      if (filtre === "inactifs" && s.actif) return false;
      if (!terme) return true;
      return `${s.nom} ${s.prenom} ${s.fonction} ${s.mairie_nom}`.toLowerCase().includes(terme);
    });
  }, [signataires, filtre, recherche]);

  function ouvrirCreation() {
    setFormulaireCreation({ ...FORMULAIRE_VIDE, mairie: mairies[0]?.id || "" });
    setModaleCreationOuverte(true);
  }

  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setCreationEnCours(true);
    try {
      const cree = await appelApi<SignataireMairie>("/signataires/", { methode: "POST", corps: formulaireCreation });
      setSignataires((precedent) => [...precedent, cree]);
      setModaleCreationOuverte(false);
      toast.succes("Signataire ajouté.");
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  function ouvrirEdition(signataire: SignataireMairie) {
    setSignataireEnEdition(signataire);
    setFormulaireEdition({
      mairie: signataire.mairie,
      nom: signataire.nom,
      prenom: signataire.prenom,
      fonction: signataire.fonction
    });
  }

  async function enregistrerEdition(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!signataireEnEdition) return;
    setEditionEnCours(true);
    try {
      const modifie = await appelApi<SignataireMairie>(`/signataires/${signataireEnEdition.id}/`, {
        methode: "PATCH",
        corps: formulaireEdition
      });
      setSignataires((precedent) => precedent.map((s) => (s.id === modifie.id ? modifie : s)));
      setSignataireEnEdition(null);
      toast.succes("Signataire modifié.");
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setEditionEnCours(false);
    }
  }

  async function basculerActif(signataire: SignataireMairie) {
    const ok = signataire.actif
      ? await confirmer({
          titre: `Désactiver ${signataire.prenom} ${signataire.nom} ?`,
          description: "Cette personne ne sera plus proposée aux agents lors de l'émission d'un acte. Les actes déjà signés ne sont pas modifiés.",
          libelleConfirmer: "Désactiver"
        })
      : true;
    if (!ok) return;
    setActionEnCoursId(signataire.id);
    try {
      const modifie = await appelApi<SignataireMairie>(`/signataires/${signataire.id}/`, {
        methode: "PATCH",
        corps: { actif: !signataire.actif }
      });
      setSignataires((precedent) => precedent.map((s) => (s.id === modifie.id ? modifie : s)));
      toast.succes(modifie.actif ? "Signataire réactivé." : "Signataire désactivé.");
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setActionEnCoursId(null);
    }
  }

  async function supprimer(signataire: SignataireMairie) {
    const ok = await confirmer({
      titre: "Supprimer ce signataire ?",
      description: `${signataire.nom} ${signataire.prenom} sera définitivement supprimé. Cette action est irréversible.`,
      libelleConfirmer: "Supprimer",
      dangereux: true
    });
    if (!ok) return;
    setActionEnCoursId(signataire.id);
    try {
      await appelApi(`/signataires/${signataire.id}/`, { methode: "DELETE" });
      setSignataires((precedent) => precedent.filter((s) => s.id !== signataire.id));
      toast.succes("Signataire supprimé.");
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setActionEnCoursId(null);
    }
  }

  async function voirActesSignes(signataire: SignataireMairie) {
    setSignataireActesVus(signataire);
    setActesSignes(null);
    setChargementActes(true);
    try {
      const actes = await appelApi<ActeSigneParSignataire[]>(`/signataires/${signataire.id}/actes-signes/`);
      setActesSignes(actes);
    } catch (e) {
      toast.erreur(messageErreur(e, "Impossible de charger les actes signés."));
      setActesSignes([]);
    } finally {
      setChargementActes(false);
    }
  }

  const colonnes: ColonneListe<SignataireMairie>[] = [
    {
      id: "nom",
      libelle: "Signataire",
      principale: true,
      triable: true,
      valeurTri: (s) => `${s.nom} ${s.prenom}`,
      rendu: (s) => (
        <span className="eva-ac-identite">
          <Avatar nom={s.nom} prenoms={s.prenom} taille="petit" ton={s.actif ? "citron" : "neutre"} />
          <span className="eva-ac-identite__texte">
            <span>
              {s.nom} {s.prenom}
            </span>
            <span className="eva-ac-identite__detail">{s.fonction}</span>
          </span>
        </span>
      )
    },
    ...(affichageMairie
      ? [{ id: "mairie", libelle: "Mairie", triable: true, valeurTri: (s: SignataireMairie) => s.mairie_nom, rendu: (s: SignataireMairie) => s.mairie_nom }]
      : []),
    {
      id: "statut",
      libelle: "Statut",
      rendu: (s) => (
        <span className="eva-ac-badges">
          <Badge variante={s.actif ? "succes" : "neutre"} point>
            {s.actif ? "Actif" : "Inactif"}
          </Badge>
          {s.a_signe_un_acte && (
            <Badge variante="info" icone={<FileSignature size={12} aria-hidden="true" />}>
              A signé des actes
            </Badge>
          )}
        </span>
      )
    },
    {
      id: "actions",
      libelle: "Actions",
      actions: true,
      masquerLibelle: true,
      rendu: (s) => (
        <div className="eva-groupe-boutons">
          <Bouton variante="secondaire" taille="petit" iconeGauche={<FileSignature size={14} />} onClick={() => voirActesSignes(s)}>
            Actes signés
          </Bouton>
          <MenuActionsLigne ariaLabel={`Autres actions pour ${s.prenom} ${s.nom}`}>
            <ItemMenu icone={s.a_signe_un_acte ? Lock : Pencil} desactive={s.a_signe_un_acte} onClick={() => ouvrirEdition(s)}>
              {s.a_signe_un_acte ? "Modifier (identité verrouillée)" : "Modifier"}
            </ItemMenu>
            <ItemMenu icone={Power} desactive={actionEnCoursId === s.id} onClick={() => basculerActif(s)}>
              {s.actif ? "Désactiver" : "Réactiver"}
            </ItemMenu>
            <SeparateurMenu />
            <ItemMenu icone={Trash2} danger desactive={s.a_signe_un_acte || actionEnCoursId === s.id} onClick={() => supprimer(s)}>
              {s.a_signe_un_acte ? "Supprimer (a signé des actes)" : "Supprimer"}
            </ItemMenu>
          </MenuActionsLigne>
        </div>
      )
    }
  ];

  const colonnesActes: ColonneListe<ActeSigneParSignataire>[] = [
    { id: "evenement", libelle: "Événement", principale: true, rendu: (a) => libelleEvenement(a.type_acte) },
    { id: "acte", libelle: "N° d'acte", alignement: "droite", rendu: (a) => <span className="texte-mono">{a.numero_acte}</span> },
    { id: "registre", libelle: "Registre", alignement: "droite", rendu: (a) => <span className="texte-mono">{a.numero_registre}</span> },
    { id: "annee", libelle: "Année", alignement: "droite", rendu: (a) => <span className="texte-mono">{a.annee_registre}</span> },
    { id: "date", libelle: "Établi le", alignement: "droite", rendu: (a) => <span className="texte-mono">{formaterDate(a.date_etablissement)}</span> },
    {
      id: "statut",
      libelle: "Statut",
      rendu: (a) => (
        <Badge variante={a.statut === "actif" ? "succes" : "neutre"} point>
          {a.statut === "actif" ? "Actif" : "Annulé"}
        </Badge>
      )
    }
  ];

  const aucuneMairie = !chargement && !erreurChargement && mairies.length === 0;

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Signataires"
        sousTitre="Les personnes habilitées à signer les actes de votre ou vos mairies. L'agent en choisit une dans une liste déroulante à l'émission d'un acte."
        actions={
          mairies.length > 0 && (
            <Bouton onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
              Ajouter un signataire
            </Bouton>
          )
        }
      />

      {!aucuneMairie && (
        <BarreOutils
          carte
          recherche={<BarreRecherche valeur={recherche} onChanger={setRecherche} placeholder="Rechercher un nom, une fonction..." ariaLabel="Rechercher un signataire" />}
          filtres={<PilulesFiltre ariaLabel="Filtrer les signataires" valeur={filtre} onChanger={setFiltre} pilules={pilules} defilement />}
          compteur={!chargement && !erreurChargement ? compterAvecUnite(signatairesAffiches.length, "signataire") : undefined}
        />
      )}

      <ListeResponsive<SignataireMairie>
        legende="Signataires"
        lignes={signatairesAffiches}
        cle={(s) => s.id}
        colonnes={colonnes}
        chargement={chargement}
        erreur={erreurChargement}
        onReessayer={charger}
        hauteurMax="none"
        sansSurvol
        vide={
          aucuneMairie
            ? { icone: <UserCheck size={26} />, titre: "Aucune mairie dans votre périmètre", description: "Les signataires sont rattachés à une mairie." }
            : signataires.length === 0
              ? {
                  icone: <UserCheck size={26} />,
                  titre: "Aucun signataire enregistré",
                  description: "Ajoutez au moins un signataire pour qu'un agent puisse émettre un acte.",
                  action: (
                    <Bouton onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
                      Ajouter un signataire
                    </Bouton>
                  )
                }
              : { icone: <UserCheck size={26} />, titre: "Aucun signataire ne correspond", description: "Modifiez votre recherche ou le filtre sélectionné." }
        }
      />

      {modaleCreationOuverte && (
        <Modale
          titre="Ajouter un signataire"
          onFermer={() => setModaleCreationOuverte(false)}
          fermerAuClicFond={false}
          actions={
            <>
              <Bouton type="button" variante="fantome" onClick={() => setModaleCreationOuverte(false)}>
                Annuler
              </Bouton>
              <Bouton type="submit" form="formulaire-signataire-creation" chargement={creationEnCours}>
                Ajouter
              </Bouton>
            </>
          }
        >
          <form id="formulaire-signataire-creation" onSubmit={creer}>
            <ChampsSignataire prefixe="creation" valeurs={formulaireCreation} mairies={mairies} afficherMairie={affichageMairie} avecAide onChange={setFormulaireCreation} />
          </form>
        </Modale>
      )}

      {signataireEnEdition && (
        <Modale
          titre="Modifier le signataire"
          onFermer={() => setSignataireEnEdition(null)}
          fermerAuClicFond={false}
          actions={
            <>
              <Bouton type="button" variante="fantome" onClick={() => setSignataireEnEdition(null)}>
                Annuler
              </Bouton>
              <Bouton type="submit" form="formulaire-signataire-edition" chargement={editionEnCours}>
                Enregistrer
              </Bouton>
            </>
          }
        >
          <form id="formulaire-signataire-edition" onSubmit={enregistrerEdition}>
            <ChampsSignataire prefixe="edition" valeurs={formulaireEdition} mairies={mairies} afficherMairie={affichageMairie} onChange={setFormulaireEdition} />
          </form>
        </Modale>
      )}

      {signataireActesVus && (
        <Modale
          titre={`Actes signés par ${signataireActesVus.prenom} ${signataireActesVus.nom}`}
          description={signataireActesVus.fonction}
          onFermer={() => setSignataireActesVus(null)}
          taille="large"
          actions={
            <Bouton variante="secondaire" onClick={() => setSignataireActesVus(null)}>
              Fermer
            </Bouton>
          }
        >
          <ListeResponsive<ActeSigneParSignataire>
            legende="Actes signés"
            lignes={actesSignes ?? []}
            cle={(a) => a.id}
            colonnes={colonnesActes}
            chargement={chargementActes}
            sansCadre
            sansSurvol
            dense
            hauteurMax="50vh"
            lignesSqueleteNombre={4}
            vide={{ icone: <FileSignature size={26} />, titre: "Aucun acte signé par ce signataire" }}
          />
        </Modale>
      )}
    </MiseEnPage>
  );
}
