import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import BarreRecherche from "../../components/BarreRecherche";
import Pagination from "../../components/Pagination";
import EtatVide from "../../components/EtatVide";
import Squelette from "../../components/Squelette";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useListePaginee } from "../../hooks/useListePaginee";
import { LIENS_ADMIN_CEC } from "./navigation";
import { listeDepuis, type Mairie, type Utilisateur, type ListeOuPaginee } from "../../types/domaine";

interface FormulaireNouvelUtilisateur {
  email: string;
  password: string;
  nom: string;
  prenoms: string;
  role: "agent_cec";
  mairie: string;
}

const VALEURS_INITIALES: FormulaireNouvelUtilisateur = {
  email: "",
  password: "",
  nom: "",
  prenoms: "",
  role: "agent_cec",
  mairie: ""
};

const TAILLE_PAGE = 25;

export default function UtilisateursAdminCec() {
  const [recherche, setRecherche] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nouveau, setNouveau] = useState<FormulaireNouvelUtilisateur>(VALEURS_INITIALES);
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const { notifier } = useToast();
  const { utilisateur: utilisateurConnecte } = useAuth();

  const cheminBase = useMemo(() => {
    return recherche ? `/utilisateurs/?search=${encodeURIComponent(recherche)}` : "/utilisateurs/";
  }, [recherche]);

  const {
    items: utilisateurs,
    count,
    page,
    setPage,
    totalPages,
    chargement,
    recharger
  } = useListePaginee<Utilisateur>(cheminBase, TAILLE_PAGE);

  useEffect(() => {
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

  async function creerUtilisateur(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    try {
      await appelApi("/utilisateurs/", { methode: "POST", corps: nouveau });
      setFormulaireOuvert(false);
      setNouveau(VALEURS_INITIALES);
      notifier("Compte cree avec succes.", "succes");
      recharger();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    }
  }

  async function basculerActif(u: Utilisateur) {
    try {
      await appelApi(`/utilisateurs/${u.id}/`, { methode: "PATCH", corps: { is_active: !u.is_active } });
      notifier(u.is_active ? "Compte desactive." : "Compte reactive.", "succes");
      recharger();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <PageHeader
        titre="Agents et administrateurs"
        description="Comptes rattaches a votre perimetre."
        actions={
          <button className="bouton-principal" onClick={() => setFormulaireOuvert((v) => !v)}>
            {formulaireOuvert ? "Annuler" : "Ajouter un compte"}
          </button>
        }
      />

      {formulaireOuvert && (
        <form onSubmit={creerUtilisateur} className="carte" style={{ maxWidth: 460, marginBottom: 20 }}>
          <div className="champ">
            <label htmlFor="nom">Nom</label>
            <input id="nom" required value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} />
          </div>
          <div className="champ">
            <label htmlFor="prenoms">Prenoms</label>
            <input
              id="prenoms"
              required
              value={nouveau.prenoms}
              onChange={(e) => setNouveau({ ...nouveau, prenoms: e.target.value })}
            />
          </div>
          <div className="champ">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={nouveau.email}
              onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })}
            />
          </div>
          <div className="champ">
            <label htmlFor="password">Mot de passe initial</label>
            <input
              id="password"
              type="password"
              required
              value={nouveau.password}
              onChange={(e) => setNouveau({ ...nouveau, password: e.target.value })}
            />
          </div>
          <div className="champ">
            <label htmlFor="mairie">Mairie</label>
            <select id="mairie" required value={nouveau.mairie} onChange={(e) => setNouveau({ ...nouveau, mairie: e.target.value })}>
              <option value="">Selectionner une mairie</option>
              {mairies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="bouton-principal">
            Creer le compte
          </button>
        </form>
      )}

      <div style={{ marginBottom: 16 }}>
        <BarreRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher par nom ou email..." />
      </div>

      {chargement ? (
        <Squelette lignes={5} />
      ) : (
        <>
          <table className="tableau-standard">
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
                  <td>{u.role}</td>
                  <td>{u.mairie || "-"}</td>
                  <td>{u.is_active ? "Actif" : "Desactive"}</td>
                  <td>
                    {u.id !== utilisateurConnecte?.id && (
                      <button className="bouton-secondaire" onClick={() => basculerActif(u)}>
                        {u.is_active ? "Desactiver" : "Reactiver"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {utilisateurs.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EtatVide icone={Users} message="Aucun compte ne correspond a ces criteres." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={count} taillePage={TAILLE_PAGE} onChangerPage={setPage} />
        </>
      )}
    </MiseEnPage>
  );
}
