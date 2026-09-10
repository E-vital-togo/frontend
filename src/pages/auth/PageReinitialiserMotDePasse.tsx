import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import Logo from "../../components/Logo";
import { Bouton, Champ } from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";

/**
 * Destination du lien envoye par email (voir apps.utilisateurs.tasks.
 * envoyer_lien_reinitialisation : "${FRONTEND_URL}/reinitialiser-mot-de-
 * passe/:uidb64/:token"). Cette route n'existait pas cote frontend - le
 * lien envoye par email menait a une page introuvable et personne ne
 * pouvait terminer une reinitialisation de mot de passe oublie.
 */
export default function PageReinitialiserMotDePasse() {
  const { uidb64, token } = useParams<{ uidb64: string; token: string }>();
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reussi, setReussi] = useState(false);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    if (nouveauMotDePasse !== confirmation) {
      setErreur("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    if (!uidb64 || !token) {
      setErreur("Lien de reinitialisation incomplet.");
      return;
    }

    setEnCours(true);
    try {
      await appelApi("/auth/mot-de-passe-oublie/confirmer", {
        methode: "POST",
        corps: { uidb64, token, nouveau_mot_de_passe: nouveauMotDePasse }
      });
      setReussi(true);
    } catch (e) {
      setErreur(
        e instanceof ErreurApi
          ? e.message
          : "Ce lien de reinitialisation est invalide ou a expire. Demandez-en un nouveau depuis l'ecran de connexion."
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="eva-ecran-centre">
      <div className="eva-carte eva-ecran-centre__carte">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Logo variante="vertical" hauteur={80} />
        </div>
        <h1 style={{ fontSize: 18, color: "var(--couleur-emeraude)", marginBottom: 10 }}>
          Reinitialiser le mot de passe
        </h1>

        {reussi ? (
          <>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              Votre mot de passe a ete reinitialise avec succes. Vous pouvez maintenant vous connecter.
            </p>
            <Link to="/connexion" className="eva-bouton eva-bouton--principal eva-bouton--moyen" style={{ width: "100%", justifyContent: "center" }}>
              Aller a la connexion
            </Link>
          </>
        ) : (
          <form onSubmit={soumettre}>
            <p className="eva-sous-titre" style={{ marginBottom: 14 }}>
              Choisissez un nouveau mot de passe (au moins 10 caracteres).
            </p>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <Champ id="nouveau-mdp" label="Nouveau mot de passe" requis>
              <input
                id="nouveau-mdp"
                type="password"
                required
                minLength={10}
                autoFocus
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
              />
            </Champ>
            <Champ id="confirmation-mdp" label="Confirmer le nouveau mot de passe" requis>
              <input
                id="confirmation-mdp"
                type="password"
                required
                minLength={10}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </Champ>
            <Bouton
              type="submit"
              chargement={enCours}
              style={{ width: "100%" }}
              iconeGauche={!enCours && <KeyRound size={16} />}
            >
              Reinitialiser le mot de passe
            </Bouton>
          </form>
        )}

        {!reussi && (
          <Link
            to="/connexion"
            style={{ display: "block", textAlign: "center", fontSize: 12.5, color: "var(--couleur-gris-service-2)", marginTop: 16 }}
          >
            Retour a la connexion
          </Link>
        )}
      </div>
    </div>
  );
}
