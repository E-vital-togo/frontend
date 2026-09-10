import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Save } from "lucide-react";
import MiseEnPage from "../components/MiseEnPage";
import { Bouton, Carte, Champ, ChargementPage, EnteteDePage } from "../components/ui";
import { useToast } from "../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { LIENS_AGENT } from "./agent/navigation";
import { LIENS_ADMIN_CEC } from "./admin_cec/navigation";
import type { Utilisateur } from "../types/domaine";

const LIBELLES_ROLE: Record<string, string> = {
  agent_cec: "Agent d'etat civil",
  admin_cec: "Administrateur CEC",
  admin_inseed: "Administrateur INSEED",
  admin_general: "Administrateur general"
};

export default function PageMonCompte() {
  const { utilisateur: utilisateurConnecte } = useAuth();
  const toast = useToast();
  const liens = utilisateurConnecte?.role === "admin_cec" ? LIENS_ADMIN_CEC : LIENS_AGENT;

  const [profil, setProfil] = useState<Utilisateur | null>(null);
  const [nom, setNom] = useState("");
  const [prenoms, setPrenoms] = useState("");
  const [enregistrementProfil, setEnregistrementProfil] = useState(false);

  const [ancienMotDePasse, setAncienMotDePasse] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState("");
  const [changementEnCours, setChangementEnCours] = useState(false);
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | null>(null);

  useEffect(() => {
    appelApi<Utilisateur>("/utilisateurs/me/").then((donnees) => {
      setProfil(donnees);
      setNom(donnees.nom);
      setPrenoms(donnees.prenoms);
    });
  }, []);

  async function enregistrerProfil(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnregistrementProfil(true);
    try {
      const donnees = await appelApi<Utilisateur>("/utilisateurs/me/", { methode: "PATCH", corps: { nom, prenoms } });
      setProfil(donnees);
      toast.succes("Profil mis a jour.");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrementProfil(false);
    }
  }

  async function changerMotDePasse(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurMotDePasse(null);
    if (nouveauMotDePasse !== confirmationMotDePasse) {
      setErreurMotDePasse("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setChangementEnCours(true);
    try {
      await appelApi("/auth/changer-mot-de-passe", {
        methode: "POST",
        corps: { ancien_mot_de_passe: ancienMotDePasse, nouveau_mot_de_passe: nouveauMotDePasse }
      });
      setAncienMotDePasse("");
      setNouveauMotDePasse("");
      setConfirmationMotDePasse("");
      toast.succes("Mot de passe modifie.");
    } catch (e) {
      setErreurMotDePasse(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setChangementEnCours(false);
    }
  }

  if (!profil) {
    return (
      <MiseEnPage liens={liens}>
        <ChargementPage />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage titre="Mon compte" sousTitre={LIBELLES_ROLE[profil.role] || profil.role} />

      <div className="eva-grille-2">
        <Carte>
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>Informations personnelles</h2>
          <p className="eva-sous-titre" style={{ marginBottom: 16 }}>
            Email, role et mairie sont geres par votre administrateur et ne peuvent pas etre modifies ici.
          </p>
          <form onSubmit={enregistrerProfil}>
            <Champ id="nom" label="Nom" requis>
              <input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
            </Champ>
            <Champ id="prenoms" label="Prenoms" requis>
              <input id="prenoms" required value={prenoms} onChange={(e) => setPrenoms(e.target.value)} />
            </Champ>
            <Champ id="email-lecture" label="Email">
              <input id="email-lecture" value={profil.email} disabled className="texte-mono" />
            </Champ>
            <Bouton type="submit" chargement={enregistrementProfil} iconeGauche={<Save size={16} />}>
              Enregistrer
            </Bouton>
          </form>
        </Carte>

        <Carte>
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>Mot de passe</h2>
          <p className="eva-sous-titre" style={{ marginBottom: 16 }}>
            Une connexion demande toujours ensuite un code recu par email (double authentification).
          </p>
          {erreurMotDePasse && <div className="message-erreur">{erreurMotDePasse}</div>}
          <form onSubmit={changerMotDePasse}>
            <Champ id="ancien-mdp" label="Mot de passe actuel" requis>
              <input
                id="ancien-mdp"
                type="password"
                required
                value={ancienMotDePasse}
                onChange={(e) => setAncienMotDePasse(e.target.value)}
              />
            </Champ>
            <Champ id="nouveau-mdp" label="Nouveau mot de passe" requis>
              <input
                id="nouveau-mdp"
                type="password"
                required
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
              />
            </Champ>
            <Champ id="confirmation-mdp" label="Confirmer le nouveau mot de passe" requis>
              <input
                id="confirmation-mdp"
                type="password"
                required
                value={confirmationMotDePasse}
                onChange={(e) => setConfirmationMotDePasse(e.target.value)}
              />
            </Champ>
            <Bouton type="submit" variante="secondaire" chargement={changementEnCours} iconeGauche={<KeyRound size={16} />}>
              Changer le mot de passe
            </Bouton>
          </form>
        </Carte>
      </div>
    </MiseEnPage>
  );
}
