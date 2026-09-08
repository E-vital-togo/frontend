import { useState, type FormEvent } from "react";
import { KeyRound, UserRound } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ErreurApi } from "../../lib/apiClient";
import { changerMotDePasse, modifierMonProfil } from "../../services/authService";
import { LIENS_AGENT } from "../agent/navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";
import type { Utilisateur } from "../../types/domaine";

const LIBELLES_ROLE: Record<string, string> = {
  agent_cec: "Agent CEC",
  admin_cec: "Administrateur CEC",
  admin_inseed: "Administrateur INSEED",
  admin_general: "Administrateur general"
};

type Onglet = "profil" | "securite";

export default function PageCompte() {
  const { utilisateur, mettreAJourUtilisateur } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>("profil");
  const liens = utilisateur?.role === "admin_cec" ? LIENS_ADMIN_CEC : LIENS_AGENT;

  if (!utilisateur) return null;

  return (
    <MiseEnPage liens={liens}>
      <PageHeader titre="Mon compte" description="Vos informations personnelles et vos parametres de securite." />

      <div className="onglets">
        <button
          type="button"
          className={`onglets__bouton ${onglet === "profil" ? "onglets__bouton--actif" : ""}`}
          onClick={() => setOnglet("profil")}
        >
          Profil
        </button>
        <button
          type="button"
          className={`onglets__bouton ${onglet === "securite" ? "onglets__bouton--actif" : ""}`}
          onClick={() => setOnglet("securite")}
        >
          Securite
        </button>
      </div>

      {onglet === "profil" ? (
        <FormulaireProfil utilisateur={utilisateur} onEnregistre={mettreAJourUtilisateur} libellesRole={LIBELLES_ROLE} />
      ) : (
        <FormulaireMotDePasse />
      )}
    </MiseEnPage>
  );
}

function FormulaireProfil({
  utilisateur,
  onEnregistre,
  libellesRole
}: {
  utilisateur: Utilisateur;
  onEnregistre: (u: Utilisateur) => void;
  libellesRole: Record<string, string>;
}) {
  const [nom, setNom] = useState(utilisateur.nom);
  const [prenoms, setPrenoms] = useState(utilisateur.prenoms);
  const [enCours, setEnCours] = useState(false);
  const { notifier } = useToast();

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    try {
      const misAJour = await modifierMonProfil({ nom, prenoms });
      onEnregistre(misAJour);
      notifier("Profil mis a jour.", "succes");
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="carte" style={{ maxWidth: 440 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--couleur-gris-service-2)" }}>
        <UserRound size={16} />
        <span style={{ fontSize: 13 }}>Informations personnelles</span>
      </div>
      <div className="champ">
        <label htmlFor="prenoms">Prenoms</label>
        <input id="prenoms" required value={prenoms} onChange={(e) => setPrenoms(e.target.value)} />
      </div>
      <div className="champ">
        <label htmlFor="nom">Nom</label>
        <input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="champ">
        <label htmlFor="email">Email</label>
        <input id="email" value={utilisateur.email} disabled />
      </div>
      <div className="champ">
        <label htmlFor="role">Role</label>
        <input id="role" value={libellesRole[utilisateur.role] ?? utilisateur.role} disabled />
      </div>
      <button type="submit" className="bouton-principal" disabled={enCours}>
        {enCours ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}

function FormulaireMotDePasse() {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const { notifier } = useToast();

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();

    if (nouveau !== confirmation) {
      notifier("La confirmation ne correspond pas au nouveau mot de passe.", "erreur");
      return;
    }

    setEnCours(true);
    try {
      await changerMotDePasse(ancien, nouveau);
      notifier("Mot de passe modifie avec succes.", "succes");
      setAncien("");
      setNouveau("");
      setConfirmation("");
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="carte" style={{ maxWidth: 440 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--couleur-gris-service-2)" }}>
        <KeyRound size={16} />
        <span style={{ fontSize: 13 }}>Changer de mot de passe</span>
      </div>
      <div className="champ">
        <label htmlFor="ancien">Mot de passe actuel</label>
        <input id="ancien" type="password" required value={ancien} onChange={(e) => setAncien(e.target.value)} />
      </div>
      <div className="champ">
        <label htmlFor="nouveau">Nouveau mot de passe</label>
        <input
          id="nouveau"
          type="password"
          required
          minLength={10}
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
        />
      </div>
      <div className="champ">
        <label htmlFor="confirmation">Confirmer le nouveau mot de passe</label>
        <input
          id="confirmation"
          type="password"
          required
          minLength={10}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </div>
      <button type="submit" className="bouton-principal" disabled={enCours}>
        {enCours ? "Modification..." : "Modifier le mot de passe"}
      </button>
    </form>
  );
}
