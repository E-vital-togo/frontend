import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, Pencil, Plus, Power, Trash2, UserCheck } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Badge, Bouton, Champ, ChargementPage, EnteteDePage, EtatVide, Modale, Tableau } from "../../components/ui";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import { useToast } from "../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import {
  listeDepuis,
  type ActeSigneParSignataire,
  type ListeOuPaginee,
  type Mairie,
  type SignataireMairie
} from "../../types/domaine";

interface FormulaireSignataire {
  mairie: string;
  nom: string;
  prenom: string;
  fonction: string;
}

const FORMULAIRE_VIDE: FormulaireSignataire = { mairie: "", nom: "", prenom: "", fonction: "" };

export default function MairieSignataire() {
  const toast = useToast();
  const confirmer = useConfirmation();

  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [signataires, setSignataires] = useState<SignataireMairie[]>([]);
  const [chargement, setChargement] = useState(true);

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
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
  }, []);

  const affichageMairie = mairies.length > 1;

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
      toast.succes("Signataire ajoute.");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
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
      toast.succes("Signataire modifie.");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEditionEnCours(false);
    }
  }

  async function basculerActif(signataire: SignataireMairie) {
    setActionEnCoursId(signataire.id);
    try {
      const modifie = await appelApi<SignataireMairie>(`/signataires/${signataire.id}/`, {
        methode: "PATCH",
        corps: { actif: !signataire.actif }
      });
      setSignataires((precedent) => precedent.map((s) => (s.id === modifie.id ? modifie : s)));
      toast.succes(modifie.actif ? "Signataire reactive." : "Signataire desactive.");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setActionEnCoursId(null);
    }
  }

  async function supprimer(signataire: SignataireMairie) {
    const ok = await confirmer({
      titre: "Supprimer ce signataire ?",
      description: `${signataire.nom} ${signataire.prenom} sera definitivement supprime. Cette action est irreversible.`,
      libelleConfirmer: "Supprimer",
      dangereux: true
    });
    if (!ok) return;
    setActionEnCoursId(signataire.id);
    try {
      await appelApi(`/signataires/${signataire.id}/`, { methode: "DELETE" });
      setSignataires((precedent) => precedent.filter((s) => s.id !== signataire.id));
      toast.succes("Signataire supprime.");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
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
      toast.erreur(e instanceof ErreurApi ? e.message : "Impossible de charger les actes signes.");
      setActesSignes([]);
    } finally {
      setChargementActes(false);
    }
  }

  if (chargement) {
    return (
      <MiseEnPage liens={LIENS_ADMIN_CEC}>
        <ChargementPage />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Signataires"
        sousTitre="Les personnes habilitees a signer les actes de votre/vos mairie(s). Choisies dans une liste deroulante par l'agent a l'emission d'un acte."
        actions={
          mairies.length > 0 && (
            <Bouton onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
              Ajouter un signataire
            </Bouton>
          )
        }
      />

      {mairies.length === 0 ? (
        <EtatVide icone={<UserCheck size={28} />} titre="Aucune mairie dans votre perimetre." />
      ) : signataires.length === 0 ? (
        <EtatVide
          icone={<UserCheck size={28} />}
          titre="Aucun signataire enregistre"
          description="Ajoutez au moins un signataire pour qu'un agent puisse emettre un acte."
        />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Fonction</th>
              {affichageMairie && <th>Mairie</th>}
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {signataires.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.nom} {s.prenom}
                </td>
                <td>{s.fonction}</td>
                {affichageMairie && <td>{s.mairie_nom}</td>}
                <td>
                  <Badge variante={s.actif ? "succes" : "neutre"}>{s.actif ? "Actif" : "Inactif"}</Badge>
                  {s.a_signe_un_acte && (
                    <span style={{ marginLeft: 6 }}>
                      <Badge variante="info">A signe des actes</Badge>
                    </span>
                  )}
                </td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Bouton
                    variante="fantome"
                    taille="petit"
                    iconeGauche={<Eye size={14} />}
                    onClick={() => voirActesSignes(s)}
                  >
                    Actes signes
                  </Bouton>
                  <Bouton
                    variante="fantome"
                    taille="petit"
                    iconeGauche={<Pencil size={14} />}
                    disabled={s.a_signe_un_acte}
                    title={s.a_signe_un_acte ? "Deja signe un acte : identite non modifiable" : undefined}
                    onClick={() => ouvrirEdition(s)}
                  >
                    Modifier
                  </Bouton>
                  <Bouton
                    variante="fantome"
                    taille="petit"
                    iconeGauche={<Power size={14} />}
                    chargement={actionEnCoursId === s.id}
                    onClick={() => basculerActif(s)}
                  >
                    {s.actif ? "Desactiver" : "Reactiver"}
                  </Bouton>
                  <Bouton
                    variante="fantome"
                    taille="petit"
                    iconeGauche={<Trash2 size={14} />}
                    disabled={s.a_signe_un_acte}
                    title={s.a_signe_un_acte ? "Deja signe un acte : suppression impossible, desactivez-le" : undefined}
                    chargement={actionEnCoursId === s.id}
                    onClick={() => supprimer(s)}
                  >
                    Supprimer
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {modaleCreationOuverte && (
        <Modale titre="Ajouter un signataire" onFermer={() => setModaleCreationOuverte(false)}>
          <form onSubmit={creer}>
            {affichageMairie && (
              <Champ id="creation-mairie" label="Mairie" requis>
                <select
                  id="creation-mairie"
                  required
                  value={formulaireCreation.mairie}
                  onChange={(e) => setFormulaireCreation({ ...formulaireCreation, mairie: e.target.value })}
                >
                  {mairies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              </Champ>
            )}
            <Champ id="creation-nom" label="Nom" requis>
              <input
                id="creation-nom"
                required
                value={formulaireCreation.nom}
                onChange={(e) => setFormulaireCreation({ ...formulaireCreation, nom: e.target.value })}
              />
            </Champ>
            <Champ id="creation-prenom" label="Prenom" requis>
              <input
                id="creation-prenom"
                required
                value={formulaireCreation.prenom}
                onChange={(e) => setFormulaireCreation({ ...formulaireCreation, prenom: e.target.value })}
              />
            </Champ>
            <Champ id="creation-fonction" label="Fonction" requis aide="Maire, adjoint au maire, secretaire general...">
              <input
                id="creation-fonction"
                required
                value={formulaireCreation.fonction}
                onChange={(e) => setFormulaireCreation({ ...formulaireCreation, fonction: e.target.value })}
              />
            </Champ>
            <div className="eva-modale__actions">
              <Bouton type="button" variante="fantome" onClick={() => setModaleCreationOuverte(false)}>
                Annuler
              </Bouton>
              <Bouton type="submit" chargement={creationEnCours}>
                Ajouter
              </Bouton>
            </div>
          </form>
        </Modale>
      )}

      {signataireEnEdition && (
        <Modale titre="Modifier le signataire" onFermer={() => setSignataireEnEdition(null)}>
          <form onSubmit={enregistrerEdition}>
            {affichageMairie && (
              <Champ id="edition-mairie" label="Mairie" requis>
                <select
                  id="edition-mairie"
                  required
                  value={formulaireEdition.mairie}
                  onChange={(e) => setFormulaireEdition({ ...formulaireEdition, mairie: e.target.value })}
                >
                  {mairies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              </Champ>
            )}
            <Champ id="edition-nom" label="Nom" requis>
              <input
                id="edition-nom"
                required
                value={formulaireEdition.nom}
                onChange={(e) => setFormulaireEdition({ ...formulaireEdition, nom: e.target.value })}
              />
            </Champ>
            <Champ id="edition-prenom" label="Prenom" requis>
              <input
                id="edition-prenom"
                required
                value={formulaireEdition.prenom}
                onChange={(e) => setFormulaireEdition({ ...formulaireEdition, prenom: e.target.value })}
              />
            </Champ>
            <Champ id="edition-fonction" label="Fonction" requis>
              <input
                id="edition-fonction"
                required
                value={formulaireEdition.fonction}
                onChange={(e) => setFormulaireEdition({ ...formulaireEdition, fonction: e.target.value })}
              />
            </Champ>
            <div className="eva-modale__actions">
              <Bouton type="button" variante="fantome" onClick={() => setSignataireEnEdition(null)}>
                Annuler
              </Bouton>
              <Bouton type="submit" chargement={editionEnCours}>
                Enregistrer
              </Bouton>
            </div>
          </form>
        </Modale>
      )}

      {signataireActesVus && (
        <Modale titre={`Actes signes par ${signataireActesVus.nom} ${signataireActesVus.prenom}`} onFermer={() => setSignataireActesVus(null)} large>
          {chargementActes ? (
            <ChargementPage />
          ) : !actesSignes || actesSignes.length === 0 ? (
            <EtatVide icone={<CheckCircle2 size={28} />} titre="Aucun acte signe par ce signataire" />
          ) : (
            <Tableau>
              <thead>
                <tr>
                  <th>Evenement</th>
                  <th>N° acte</th>
                  <th>Registre</th>
                  <th>Annee</th>
                  <th>Date d'etablissement</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {actesSignes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.type_acte === "naissance" ? "Naissance" : "Deces"}</td>
                    <td className="texte-mono">{a.numero_acte}</td>
                    <td className="texte-mono">{a.numero_registre}</td>
                    <td className="texte-mono">{a.annee_registre}</td>
                    <td className="texte-mono">{a.date_etablissement}</td>
                    <td>
                      <Badge variante={a.statut === "actif" ? "succes" : "neutre"}>
                        {a.statut === "actif" ? "Actif" : "Annule"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tableau>
          )}
        </Modale>
      )}
    </MiseEnPage>
  );
}
