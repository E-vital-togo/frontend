import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Power, Search, UserX } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Bouton, Carte, Champ, ChargementPage, EnteteDePage, EtatVide, Modale, Tableau } from "../../components/ui";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import { useToast } from "../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useMonTerritoire } from "../../lib/useMonTerritoire";
import { LIENS_ADMIN_CEC } from "./navigation";
import {
  listeDepuis,
  niveauxInferieurs,
  type ListeOuPaginee,
  type Mairie,
  type Territoire,
  type TypeTerritoire,
  type Utilisateur
} from "../../types/domaine";

type RoleCreation = "agent_cec" | "admin_cec";

interface FormulaireNouvelUtilisateur {
  email: string;
  password: string;
  nom: string;
  prenoms: string;
  role: RoleCreation;
  mairie: string;
  territoire_scope: string;
}

const VALEURS_INITIALES: FormulaireNouvelUtilisateur = {
  email: "",
  password: "",
  nom: "",
  prenoms: "",
  role: "agent_cec",
  mairie: "",
  territoire_scope: ""
};

const LIBELLES_ROLE: Record<string, string> = {
  agent_cec: "Agent CEC",
  admin_cec: "Administrateur CEC",
  admin_inseed: "Administrateur INSEED",
  admin_general: "Administrateur general"
};

const LIBELLES_TYPE_TERRITOIRE: Record<string, string> = {
  pays: "pays",
  region: "region",
  prefecture: "prefecture",
  commune: "commune"
};

export default function UtilisateursAdminCec() {
  const monTerritoire = useMonTerritoire();
  const toast = useToast();
  const confirmer = useConfirmation();

  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [territoiresEnfants, setTerritoiresEnfants] = useState<Territoire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nouveau, setNouveau] = useState<FormulaireNouvelUtilisateur>(VALEURS_INITIALES);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);

  const [utilisateurEnEdition, setUtilisateurEnEdition] = useState<Utilisateur | null>(null);
  const [editionNom, setEditionNom] = useState("");
  const [editionPrenoms, setEditionPrenoms] = useState("");
  const [editionMairie, setEditionMairie] = useState("");
  const [editionEnCours, setEditionEnCours] = useState(false);

  function charger() {
    setChargement(true);
    const parametres = recherche ? `?search=${encodeURIComponent(recherche)}` : "";
    appelApi<ListeOuPaginee<Utilisateur>>(`/utilisateurs/${parametres}`)
      .then((donnees) => setUtilisateurs(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    const gestionnaire = window.setTimeout(charger, 300);
    return () => window.clearTimeout(gestionnaire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  useEffect(() => {
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

  // Determine ce que l'admin_cec connecte a le droit de creer : un agent
  // dans n'importe quelle mairie de son perimetre, quel que soit son propre
  // niveau, et un administrateur CEC a n'importe quel niveau strictement
  // inferieur au sien - pas seulement le niveau immediatement en-dessous
  // (voir apps.utilisateurs.services.peut_creer_admin_cec/peut_creer_agent_cec
  // cote backend, qui appliquent la meme regle).
  const niveauxAdminPossibles = monTerritoire ? niveauxInferieurs(monTerritoire.type) : [];
  const peutCreerAgent = !!monTerritoire;
  const peutCreerAdminCec = niveauxAdminPossibles.length > 0;

  const [niveauCible, setNiveauCible] = useState<TypeTerritoire | "">("");

  useEffect(() => {
    if (niveauxAdminPossibles.length > 0 && !niveauxAdminPossibles.includes(niveauCible as TypeTerritoire)) {
      setNiveauCible(niveauxAdminPossibles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monTerritoire]);

  useEffect(() => {
    if (!peutCreerAdminCec || !niveauCible || !monTerritoire) {
      setTerritoiresEnfants([]);
      return;
    }
    appelApi<ListeOuPaginee<Territoire>>(`/territoires/?type=${niveauCible}&sous_territoire=${monTerritoire.id}`)
      .then((donnees) => setTerritoiresEnfants(listeDepuis(donnees)))
      .catch(() => setTerritoiresEnfants([]));
  }, [peutCreerAdminCec, niveauCible, monTerritoire]);

  // Si un seul des deux roles est possible, le formulaire s'y fixe directement.
  useEffect(() => {
    if (peutCreerAgent && !peutCreerAdminCec) setNouveau((n) => ({ ...n, role: "agent_cec" }));
    if (!peutCreerAgent && peutCreerAdminCec) setNouveau((n) => ({ ...n, role: "admin_cec" }));
  }, [peutCreerAgent, peutCreerAdminCec]);

  const nomMairie = useMemo(() => {
    const table: Record<string, string> = {};
    for (const m of mairies) table[m.id] = m.nom;
    return table;
  }, [mairies]);

  async function creerUtilisateur(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      const corps: Record<string, unknown> = {
        email: nouveau.email,
        password: nouveau.password,
        nom: nouveau.nom,
        prenoms: nouveau.prenoms,
        role: nouveau.role
      };
      if (nouveau.role === "agent_cec") corps.mairie = nouveau.mairie;
      else corps.territoire_scope = nouveau.territoire_scope;

      await appelApi("/utilisateurs/", { methode: "POST", corps });
      setFormulaireOuvert(false);
      setNouveau({ ...VALEURS_INITIALES, role: nouveau.role });
      toast.succes("Compte cree.");
      charger();
    } catch (e) {
      setErreurCreation(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setCreationEnCours(false);
    }
  }

  function ouvrirEdition(u: Utilisateur) {
    setUtilisateurEnEdition(u);
    setEditionNom(u.nom);
    setEditionPrenoms(u.prenoms);
    setEditionMairie(u.mairie || "");
  }

  async function enregistrerEdition(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!utilisateurEnEdition) return;
    setEditionEnCours(true);
    try {
      await appelApi(`/utilisateurs/${utilisateurEnEdition.id}/`, {
        methode: "PATCH",
        corps: { nom: editionNom, prenoms: editionPrenoms, mairie: editionMairie || null }
      });
      toast.succes("Compte mis a jour.");
      setUtilisateurEnEdition(null);
      charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEditionEnCours(false);
    }
  }

  async function basculerActivation(u: Utilisateur) {
    if (u.is_active) {
      const ok = await confirmer({
        titre: `Desactiver le compte de ${u.prenoms} ${u.nom} ?`,
        description: "La personne ne pourra plus se connecter tant que le compte n'est pas reactive.",
        libelleConfirmer: "Desactiver",
        dangereux: true
      });
      if (!ok) return;
    }
    try {
      await appelApi(`/utilisateurs/${u.id}/`, { methode: "PATCH", corps: { is_active: !u.is_active } });
      toast.succes(u.is_active ? "Compte desactive." : "Compte reactive.");
      charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Agents et administrateurs"
        sousTitre="Comptes de votre perimetre territorial"
        actions={
          (peutCreerAgent || peutCreerAdminCec) && (
            <Bouton onClick={() => setFormulaireOuvert((v) => !v)} iconeGauche={<Plus size={16} />}>
              Ajouter un compte
            </Bouton>
          )
        }
      />

      {formulaireOuvert && (
        <Carte style={{ maxWidth: 460, marginBottom: 20 }}>
          <form onSubmit={creerUtilisateur}>
            {erreurCreation && <div className="message-erreur">{erreurCreation}</div>}

            {peutCreerAgent && peutCreerAdminCec && (
              <Champ id="role-creation" label="Type de compte" requis>
                <select
                  id="role-creation"
                  value={nouveau.role}
                  onChange={(e) => setNouveau({ ...nouveau, role: e.target.value as RoleCreation })}
                >
                  <option value="agent_cec">Agent d'etat civil (mairie)</option>
                  <option value="admin_cec">Administrateur CEC</option>
                </select>
              </Champ>
            )}

            <Champ id="nom" label="Nom" requis>
              <input id="nom" required value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} />
            </Champ>
            <Champ id="prenoms" label="Prenoms" requis>
              <input id="prenoms" required value={nouveau.prenoms} onChange={(e) => setNouveau({ ...nouveau, prenoms: e.target.value })} />
            </Champ>
            <Champ id="email" label="Email" requis>
              <input id="email" type="email" required value={nouveau.email} onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })} />
            </Champ>
            <Champ id="password" label="Mot de passe initial" requis aide="Au moins 10 caracteres. La personne pourra le changer depuis son compte.">
              <input id="password" type="password" required minLength={10} value={nouveau.password} onChange={(e) => setNouveau({ ...nouveau, password: e.target.value })} />
            </Champ>

            {nouveau.role === "agent_cec" ? (
              <Champ id="mairie" label="Mairie" requis>
                <select id="mairie" required value={nouveau.mairie} onChange={(e) => setNouveau({ ...nouveau, mairie: e.target.value })}>
                  <option value="">Selectionner une mairie</option>
                  {mairies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              </Champ>
            ) : (
              <>
                {niveauxAdminPossibles.length > 1 && (
                  <Champ
                    id="niveau-cible"
                    label="Niveau du territoire"
                    requis
                    aide="Vous pouvez creer un administrateur a n'importe quel niveau sous le votre, pas seulement le niveau immediatement inferieur."
                  >
                    <select
                      id="niveau-cible"
                      value={niveauCible}
                      onChange={(e) => {
                        setNiveauCible(e.target.value as TypeTerritoire);
                        setNouveau({ ...nouveau, territoire_scope: "" });
                      }}
                    >
                      {niveauxAdminPossibles.map((n) => (
                        <option key={n} value={n}>
                          {LIBELLES_TYPE_TERRITOIRE[n]}
                        </option>
                      ))}
                    </select>
                  </Champ>
                )}
                <Champ
                  id="territoire-scope"
                  label={`Territoire administre (${LIBELLES_TYPE_TERRITOIRE[niveauCible || ""]})`}
                  requis
                  aide="Le nouvel administrateur gerera ce territoire et tout ce qui en depend."
                >
                  <select
                    id="territoire-scope"
                    required
                    value={nouveau.territoire_scope}
                    onChange={(e) => setNouveau({ ...nouveau, territoire_scope: e.target.value })}
                  >
                    <option value="">Selectionner un territoire</option>
                    {territoiresEnfants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nom}
                      </option>
                    ))}
                  </select>
                </Champ>
              </>
            )}

            <Bouton type="submit" chargement={creationEnCours}>
              Creer le compte
            </Bouton>
          </form>
        </Carte>
      )}

      <div style={{ maxWidth: 340, marginBottom: 16 }}>
        <Champ id="recherche-utilisateur" label="Rechercher">
          <input id="recherche-utilisateur" placeholder="Nom, prenoms, email..." value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </Champ>
      </div>

      {chargement ? (
        <ChargementPage />
      ) : utilisateurs.length === 0 ? (
        <EtatVide icone={<Search size={26} />} titre="Aucun utilisateur ne correspond a cette recherche" />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Role</th>
              <th>Mairie</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.prenoms} {u.nom}
                </td>
                <td className="texte-mono">{u.email}</td>
                <td>{LIBELLES_ROLE[u.role] || u.role}</td>
                <td>{(u.mairie && nomMairie[u.mairie]) || "—"}</td>
                <td>
                  <span className={`eva-badge ${u.is_active ? "eva-badge--succes" : "eva-badge--neutre"}`}>
                    {u.is_active ? "Actif" : "Desactive"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <Bouton variante="fantome" taille="petit" onClick={() => ouvrirEdition(u)} iconeGauche={<Pencil size={14} />}>
                    Modifier
                  </Bouton>
                  <Bouton
                    variante="fantome"
                    taille="petit"
                    onClick={() => basculerActivation(u)}
                    iconeGauche={u.is_active ? <UserX size={14} /> : <Power size={14} />}
                  >
                    {u.is_active ? "Desactiver" : "Reactiver"}
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {utilisateurEnEdition && (
        <Modale titre={`Modifier ${utilisateurEnEdition.prenoms} ${utilisateurEnEdition.nom}`} onFermer={() => setUtilisateurEnEdition(null)}>
          <form onSubmit={enregistrerEdition}>
            <Champ id="edition-nom" label="Nom" requis>
              <input id="edition-nom" required value={editionNom} onChange={(e) => setEditionNom(e.target.value)} />
            </Champ>
            <Champ id="edition-prenoms" label="Prenoms" requis>
              <input id="edition-prenoms" required value={editionPrenoms} onChange={(e) => setEditionPrenoms(e.target.value)} />
            </Champ>
            {utilisateurEnEdition.role === "agent_cec" && (
              <Champ id="edition-mairie" label="Mairie" requis>
                <select id="edition-mairie" required value={editionMairie} onChange={(e) => setEditionMairie(e.target.value)}>
                  {mairies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              </Champ>
            )}
            <div className="eva-modale__actions">
              <Bouton type="button" variante="fantome" onClick={() => setUtilisateurEnEdition(null)}>
                Annuler
              </Bouton>
              <Bouton type="submit" chargement={editionEnCours}>
                Enregistrer
              </Bouton>
            </div>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
