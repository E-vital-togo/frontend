import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Power, UserX, Users } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import {
  Alerte,
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
import { useMonTerritoire } from "../../lib/useMonTerritoire";
import MenuActionsLigne from "./MenuActionsLigne";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDate, messageErreur } from "./outils";
import {
  listeDepuis,
  niveauxInferieurs,
  type ListeOuPaginee,
  type Mairie,
  type Territoire,
  type TypeTerritoire,
  type Utilisateur
} from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";

type RoleCreation = "agent_cec" | "admin_cec";
type FiltreUtilisateur = "" | "agent_cec" | "admin_cec" | "inactifs";

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
  admin_general: "Administrateur général"
};

const LIBELLES_TYPE_TERRITOIRE: Record<string, string> = {
  pays: "pays",
  region: "région",
  prefecture: "préfecture",
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
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreUtilisateur>("");

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
    setErreurChargement(null);
    const parametres = recherche ? `?search=${encodeURIComponent(recherche)}` : "";
    appelApi<ListeOuPaginee<Utilisateur>>(`/utilisateurs/${parametres}`)
      .then((donnees) => setUtilisateurs(listeDepuis(donnees)))
      .catch((e) => setErreurChargement(messageErreur(e, "Impossible de charger les comptes.")))
      .finally(() => setChargement(false));
  }

  // L'anti-rebond (300 ms) est porté par BarreRecherche : `recherche` ne change
  // qu'une fois la saisie stabilisée.
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  useEffect(() => {
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

  // Détermine ce que l'admin_cec connecté a le droit de créer : un agent
  // dans n'importe quelle mairie de son périmètre, quel que soit son propre
  // niveau, et un administrateur CEC à n'importe quel niveau strictement
  // inférieur au sien - pas seulement le niveau immédiatement en-dessous
  // (voir apps.utilisateurs.services.peut_creer_admin_cec/peut_creer_agent_cec
  // côté backend, qui appliquent la même règle).
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

  // Si un seul des deux rôles est possible, le formulaire s'y fixe directement.
  useEffect(() => {
    if (peutCreerAgent && !peutCreerAdminCec) setNouveau((n) => ({ ...n, role: "agent_cec" }));
    if (!peutCreerAgent && peutCreerAdminCec) setNouveau((n) => ({ ...n, role: "admin_cec" }));
  }, [peutCreerAgent, peutCreerAdminCec]);

  const nomMairie = useMemo(() => {
    const table: Record<string, string> = {};
    for (const m of mairies) table[m.id] = m.nom;
    return table;
  }, [mairies]);

  const decompte = useMemo(
    () => ({
      tous: utilisateurs.length,
      agent_cec: utilisateurs.filter((u) => u.role === "agent_cec").length,
      admin_cec: utilisateurs.filter((u) => u.role !== "agent_cec").length,
      inactifs: utilisateurs.filter((u) => !u.is_active).length
    }),
    [utilisateurs]
  );

  const pilules: PiluleFiltre<FiltreUtilisateur>[] = [
    { valeur: "", libelle: "Tous", compteur: decompte.tous },
    { valeur: "agent_cec", libelle: "Agents", compteur: decompte.agent_cec },
    { valeur: "admin_cec", libelle: "Administrateurs", compteur: decompte.admin_cec },
    { valeur: "inactifs", libelle: "Désactivés", compteur: decompte.inactifs }
  ];

  const utilisateursAffiches = useMemo(() => {
    if (filtre === "agent_cec") return utilisateurs.filter((u) => u.role === "agent_cec");
    if (filtre === "admin_cec") return utilisateurs.filter((u) => u.role !== "agent_cec");
    if (filtre === "inactifs") return utilisateurs.filter((u) => !u.is_active);
    return utilisateurs;
  }, [utilisateurs, filtre]);

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
      toast.succes("Compte créé.");
      charger();
    } catch (e) {
      setErreurCreation(messageErreur(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  function ouvrirCreation() {
    setErreurCreation(null);
    setFormulaireOuvert(true);
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
      toast.succes("Compte mis à jour.");
      setUtilisateurEnEdition(null);
      charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setEditionEnCours(false);
    }
  }

  async function basculerActivation(u: Utilisateur) {
    const ok = u.is_active
      ? await confirmer({
          titre: `Désactiver le compte de ${u.prenoms} ${u.nom} ?`,
          description: "La personne ne pourra plus se connecter tant que le compte n'est pas réactivé.",
          libelleConfirmer: "Désactiver",
          dangereux: true
        })
      : await confirmer({
          titre: `Réactiver le compte de ${u.prenoms} ${u.nom} ?`,
          description: "La personne pourra de nouveau se connecter avec ses identifiants.",
          libelleConfirmer: "Réactiver"
        });
    if (!ok) return;
    try {
      await appelApi(`/utilisateurs/${u.id}/`, { methode: "PATCH", corps: { is_active: !u.is_active } });
      toast.succes(u.is_active ? "Compte désactivé." : "Compte réactivé.");
      charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    }
  }

  const colonnes: ColonneListe<Utilisateur>[] = [
    {
      id: "nom",
      libelle: "Utilisateur",
      principale: true,
      triable: true,
      valeurTri: (u) => `${u.nom} ${u.prenoms}`,
      rendu: (u) => (
        <span className="eva-ac-identite">
          <Avatar nom={u.nom} prenoms={u.prenoms} taille="petit" ton={u.is_active ? "citron" : "neutre"} />
          <span className="eva-ac-identite__texte">
            <span>
              {u.prenoms} {u.nom}
            </span>
            <span className="eva-ac-identite__detail texte-mono">{u.email}</span>
          </span>
        </span>
      )
    },
    {
      id: "role",
      libelle: "Rôle",
      triable: true,
      valeurTri: (u) => LIBELLES_ROLE[u.role] || u.role,
      rendu: (u) => <Badge variante={u.role === "agent_cec" ? "neutre" : "info"}>{LIBELLES_ROLE[u.role] || u.role}</Badge>
    },
    { id: "mairie", libelle: "Mairie", rendu: (u) => (u.mairie && nomMairie[u.mairie]) || "-" },
    {
      id: "statut",
      libelle: "Statut",
      rendu: (u) => (
        <Badge variante={u.is_active ? "succes" : "neutre"} point>
          {u.is_active ? "Actif" : "Désactivé"}
        </Badge>
      )
    },
    {
      id: "cree",
      libelle: "Créé le",
      alignement: "droite",
      masquerMobile: true,
      triable: true,
      valeurTri: (u) => new Date(u.date_joined),
      rendu: (u) => <span className="texte-mono">{formaterDate(u.date_joined)}</span>
    },
    {
      id: "actions",
      libelle: "Actions",
      actions: true,
      masquerLibelle: true,
      rendu: (u) => (
        <MenuActionsLigne ariaLabel={`Actions pour ${u.prenoms} ${u.nom}`}>
          <ItemMenu icone={Pencil} onClick={() => ouvrirEdition(u)}>
            Modifier
          </ItemMenu>
          <SeparateurMenu />
          {u.is_active ? (
            <ItemMenu icone={UserX} danger onClick={() => basculerActivation(u)}>
              Désactiver le compte
            </ItemMenu>
          ) : (
            <ItemMenu icone={Power} onClick={() => basculerActivation(u)}>
              Réactiver le compte
            </ItemMenu>
          )}
        </MenuActionsLigne>
      )
    }
  ];

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Agents et administrateurs"
        sousTitre="Comptes de votre périmètre territorial"
        actions={
          (peutCreerAgent || peutCreerAdminCec) && (
            <Bouton onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
              Ajouter un compte
            </Bouton>
          )
        }
      />

      <BarreOutils
        carte
        recherche={
          <BarreRecherche
            valeur={recherche}
            onChanger={setRecherche}
            delai={300}
            placeholder="Rechercher un nom, un email..."
            ariaLabel="Rechercher un compte"
            chargement={chargement && utilisateurs.length > 0}
          />
        }
        filtres={<PilulesFiltre ariaLabel="Filtrer les comptes" valeur={filtre} onChanger={setFiltre} pilules={pilules} defilement />}
        compteur={!chargement && !erreurChargement ? compterAvecUnite(utilisateursAffiches.length, "compte") : undefined}
      />

      <ListeResponsive<Utilisateur>
        legende="Comptes de votre périmètre"
        lignes={utilisateursAffiches}
        cle={(u) => u.id}
        colonnes={colonnes}
        chargement={chargement}
        erreur={erreurChargement}
        onReessayer={charger}
        hauteurMax="none"
        sansSurvol
        vide={{
          icone: <Users size={26} />,
          titre: recherche || filtre ? "Aucun compte ne correspond" : "Aucun compte dans votre périmètre",
          description: recherche || filtre ? "Modifiez votre recherche ou le filtre sélectionné." : "Ajoutez un premier agent ou administrateur."
        }}
      />

      {formulaireOuvert && (
        <Modale
          titre="Ajouter un compte"
          description="Le compte est actif dès sa création. La personne se connecte avec son email et le mot de passe initial."
          onFermer={() => setFormulaireOuvert(false)}
          taille="large"
          fermerAuClicFond={false}
          actions={
            <>
              <Bouton type="button" variante="fantome" onClick={() => setFormulaireOuvert(false)}>
                Annuler
              </Bouton>
              <Bouton type="submit" form="formulaire-creation-utilisateur" chargement={creationEnCours}>
                Créer le compte
              </Bouton>
            </>
          }
        >
          <form id="formulaire-creation-utilisateur" onSubmit={creerUtilisateur}>
            {erreurCreation && (
              <div className="eva-ac-alerte-formulaire">
                <Alerte variante="erreur" onFermer={() => setErreurCreation(null)}>
                  {erreurCreation}
                </Alerte>
              </div>
            )}

            <fieldset className="eva-ac-groupe">
              <legend className="eva-ac-groupe__titre">Identité</legend>
              <div className="eva-grille eva-grille--2 eva-grille--serree">
                <Champ id="nom" label="Nom" requis>
                  <input id="nom" required autoComplete="off" value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} />
                </Champ>
                <Champ id="prenoms" label="Prénoms" requis>
                  <input id="prenoms" required autoComplete="off" value={nouveau.prenoms} onChange={(e) => setNouveau({ ...nouveau, prenoms: e.target.value })} />
                </Champ>
              </div>
            </fieldset>

            <fieldset className="eva-ac-groupe">
              <legend className="eva-ac-groupe__titre">Accès</legend>
              <div className="eva-grille eva-grille--2 eva-grille--serree">
                <Champ id="email" label="Email" requis>
                  <input id="email" type="email" required autoComplete="off" value={nouveau.email} onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })} />
                </Champ>
                <Champ id="password" label="Mot de passe initial" requis aide="Au moins 10 caractères. La personne pourra le changer depuis son compte.">
                  <input id="password" type="password" required minLength={10} autoComplete="new-password" value={nouveau.password} onChange={(e) => setNouveau({ ...nouveau, password: e.target.value })} />
                </Champ>
              </div>
            </fieldset>

            <fieldset className="eva-ac-groupe">
              <legend className="eva-ac-groupe__titre">Rôle et rattachement</legend>
              {peutCreerAgent && peutCreerAdminCec && (
                <Champ id="role-creation" label="Type de compte" requis>
                  <Selecteur id="role-creation" valeur={nouveau.role} onChange={(v) => setNouveau({ ...nouveau, role: v as RoleCreation })}>
                    <option value="agent_cec">Agent d'état civil (mairie)</option>
                    <option value="admin_cec">Administrateur CEC</option>
                  </Selecteur>
                </Champ>
              )}

              {nouveau.role === "agent_cec" ? (
                <Champ id="mairie" label="Mairie" requis>
                  <Selecteur id="mairie" requis placeholder="Sélectionner une mairie" valeur={nouveau.mairie} onChange={(v) => setNouveau({ ...nouveau, mairie: v })}>
                    {mairies.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom}
                      </option>
                    ))}
                  </Selecteur>
                </Champ>
              ) : (
                <>
                  {niveauxAdminPossibles.length > 1 && (
                    <Champ
                      id="niveau-cible"
                      label="Niveau du territoire"
                      requis
                      aide="Vous pouvez créer un administrateur à n'importe quel niveau sous le vôtre, pas seulement le niveau immédiatement inférieur."
                    >
                      <Selecteur
                        id="niveau-cible"
                        valeur={niveauCible}
                        onChange={(v) => {
                          setNiveauCible(v as TypeTerritoire);
                          setNouveau({ ...nouveau, territoire_scope: "" });
                        }}
                      >
                        {niveauxAdminPossibles.map((n) => (
                          <option key={n} value={n}>
                            {LIBELLES_TYPE_TERRITOIRE[n]}
                          </option>
                        ))}
                      </Selecteur>
                    </Champ>
                  )}
                  <Champ
                    id="territoire-scope"
                    label={`Territoire administré (${LIBELLES_TYPE_TERRITOIRE[niveauCible || ""] ?? "territoire"})`}
                    requis
                    aide="Le nouvel administrateur gérera ce territoire et tout ce qui en dépend."
                  >
                    <Selecteur id="territoire-scope" requis placeholder="Sélectionner un territoire" valeur={nouveau.territoire_scope} onChange={(v) => setNouveau({ ...nouveau, territoire_scope: v })}>
                      {territoiresEnfants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nom}
                        </option>
                      ))}
                    </Selecteur>
                  </Champ>
                </>
              )}
            </fieldset>
          </form>
        </Modale>
      )}

      {utilisateurEnEdition && (
        <Modale
          titre={`Modifier ${utilisateurEnEdition.prenoms} ${utilisateurEnEdition.nom}`}
          onFermer={() => setUtilisateurEnEdition(null)}
          fermerAuClicFond={false}
          actions={
            <>
              <Bouton type="button" variante="fantome" onClick={() => setUtilisateurEnEdition(null)}>
                Annuler
              </Bouton>
              <Bouton type="submit" form="formulaire-edition-utilisateur" chargement={editionEnCours}>
                Enregistrer
              </Bouton>
            </>
          }
        >
          <form id="formulaire-edition-utilisateur" onSubmit={enregistrerEdition}>
            <Champ id="edition-email" label="Email" verrouille aide="L'adresse de connexion ne peut pas être modifiée ici.">
              <input id="edition-email" readOnly value={utilisateurEnEdition.email} />
            </Champ>
            <div className="eva-grille eva-grille--2 eva-grille--serree">
              <Champ id="edition-nom" label="Nom" requis>
                <input id="edition-nom" required value={editionNom} onChange={(e) => setEditionNom(e.target.value)} />
              </Champ>
              <Champ id="edition-prenoms" label="Prénoms" requis>
                <input id="edition-prenoms" required value={editionPrenoms} onChange={(e) => setEditionPrenoms(e.target.value)} />
              </Champ>
            </div>
            {utilisateurEnEdition.role === "agent_cec" && (
              <Champ id="edition-mairie" label="Mairie" requis>
                <Selecteur id="edition-mairie" requis valeur={editionMairie} onChange={setEditionMairie}>
                  {mairies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </Selecteur>
              </Champ>
            )}
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
