import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, KeyRound } from "lucide-react";
import ChampMotDePasse from "../../components/auth/ChampMotDePasse";
import EcranResultat from "../../components/auth/EcranResultat";
import { decrireErreur, type MessageErreur } from "../../components/auth/messagesAuth";
import { Alerte, Bouton, LienBouton, PageAuth } from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import "../../styles/auth.css";

const LONGUEUR_MINIMALE = 10;

/**
 * Destination du lien envoye par email (voir apps.utilisateurs.tasks.
 * envoyer_lien_reinitialisation : "${FRONTEND_URL}/reinitialiser-mot-de-
 * passe/:uidb64/:token"). Cette route n'existait pas cote frontend : le
 * lien envoye par email menait a une page introuvable et personne ne
 * pouvait terminer une reinitialisation de mot de passe oublie.
 */
export default function PageReinitialiserMotDePasse() {
  const { uidb64, token } = useParams<{ uidb64: string; token: string }>();
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const [reussi, setReussi] = useState(false);
  const [lienInvalide, setLienInvalide] = useState(false);

  const confirmationDifferente = confirmation.length > 0 && confirmation !== nouveauMotDePasse;

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setLienInvalide(false);

    if (nouveauMotDePasse !== confirmation) return;
    if (!uidb64 || !token) {
      setErreur({ variante: "erreur", titre: "Lien incomplet", message: "Ce lien de réinitialisation est incomplet. Demandez-en un nouveau depuis l'écran de connexion." });
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
      // Le serveur distingue un lien perime ("lien_invalide") d'un mot de passe refuse (trop courant, trop proche...).
      const perime = e instanceof ErreurApi && e.code === "lien_invalide";
      setLienInvalide(perime);
      setErreur(decrireErreur(e, perime ? "Lien invalide ou expiré" : "Mot de passe refusé"));
    } finally {
      setEnCours(false);
    }
  }

  if (reussi) {
    return (
      <PageAuth>
        <EcranResultat
          ton="succes"
          icone={<CheckCircle2 size={34} />}
          titre="Mot de passe réinitialisé"
          actions={
            <LienBouton to="/connexion" pleineLargeur>
              Aller à la connexion
            </LienBouton>
          }
        >
          <p>Votre mot de passe a bien été modifié. Vous pouvez maintenant vous connecter avec le nouveau.</p>
        </EcranResultat>
      </PageAuth>
    );
  }

  return (
    <PageAuth
      titre="Nouveau mot de passe"
      description="Choisissez un mot de passe que vous n'utilisez nulle part ailleurs."
      icone={<KeyRound size={26} />}
      retour={{ libelle: "Retour à la connexion", vers: "/connexion" }}
      message={
        erreur ? (
          <Alerte
            variante={erreur.variante}
            titre={erreur.titre}
            actions={
              lienInvalide ? (
                <LienBouton to="/connexion" variante="secondaire" taille="petit">
                  Demander un nouveau lien
                </LienBouton>
              ) : undefined
            }
          >
            {erreur.message}
          </Alerte>
        ) : undefined
      }
    >
      <form onSubmit={soumettre}>
        <ChampMotDePasse
          id="nouveau-mdp"
          label="Nouveau mot de passe"
          requis
          minLength={LONGUEUR_MINIMALE}
          autoFocus
          autoComplete="new-password"
          aide={`Au moins ${LONGUEUR_MINIMALE} caractères.`}
          valeur={nouveauMotDePasse}
          onChange={setNouveauMotDePasse}
        />
        <ChampMotDePasse
          id="confirmation-mdp"
          label="Confirmer le nouveau mot de passe"
          requis
          minLength={LONGUEUR_MINIMALE}
          autoComplete="new-password"
          erreur={confirmationDifferente ? "Les deux mots de passe ne sont pas identiques." : undefined}
          valeur={confirmation}
          onChange={setConfirmation}
        />
        <div className="eva-auth__actions">
          <Bouton type="submit" pleineLargeur chargement={enCours} iconeGauche={<KeyRound size={17} />}>
            Réinitialiser le mot de passe
          </Bouton>
        </div>
      </form>
    </PageAuth>
  );
}
