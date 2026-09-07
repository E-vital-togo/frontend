import { useEffect, useState, type FormEvent } from "react";
import MiseEnPage from "../../components/MiseEnPage";
import { appelApi, ErreurApi } from "../../lib/apiClient";
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

export default function UtilisateursAdminCec() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nouveau, setNouveau] = useState<FormulaireNouvelUtilisateur>(VALEURS_INITIALES);
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  function charger() {
    appelApi<ListeOuPaginee<Utilisateur>>("/utilisateurs/").then((donnees) => setUtilisateurs(listeDepuis(donnees)));
  }

  useEffect(() => {
    charger();
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

  async function creerUtilisateur(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    try {
      await appelApi("/utilisateurs/", { methode: "POST", corps: nouveau });
      setFormulaireOuvert(false);
      setNouveau(VALEURS_INITIALES);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "var(--couleur-emeraude)" }}>Agents et administrateurs</h1>
        <button className="bouton-principal" onClick={() => setFormulaireOuvert((v) => !v)}>
          {formulaireOuvert ? "Annuler" : "Ajouter un compte"}
        </button>
      </div>

      {formulaireOuvert && (
        <form onSubmit={creerUtilisateur} className="carte" style={{ maxWidth: 460, marginBottom: 20 }}>
          {erreur && <div className="message-erreur">{erreur}</div>}
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

      <table className="tableau-standard">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Role</th>
            <th>Mairie</th>
            <th>Statut</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </MiseEnPage>
  );
}
