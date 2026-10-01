import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Clock, ShieldCheck } from "lucide-react";
import ChampCode from "../../components/auth/ChampCode";
import { decrireErreur, type MessageErreur } from "../../components/auth/messagesAuth";
import { formaterDuree, useEcheance } from "../../components/auth/useEcheance";
import { Alerte, Bouton, LienBouton, PageAuth } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { ErreurApi } from "../../lib/apiClient";
import type { Role } from "../../types/domaine";
import "../../styles/auth.css";

const DESTINATION_PAR_ROLE: Partial<Record<Role, string>> = {
  agent_cec: "/agent",
  admin_cec: "/admin-cec"
};

/** Validite d'un code de connexion (DUREE_VALIDITE_CODE_2FA_MINUTES cote serveur). */
const DUREE_CODE_SECONDES = 10 * 60;
const LONGUEUR_CODE = 6;

interface EtatConnexion {
  email: string;
  /** Instant d'envoi du code (Date.now()), transmis par la page de connexion. */
  envoyeLe?: number;
}

export default function PageVerifierCode() {
  const { validerCode } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const etat = state as EtatConnexion | null;
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const [erreurChamp, setErreurChamp] = useState<string | undefined>();
  const [enCours, setEnCours] = useState(false);
  // Sans horodatage (ancien lien, rechargement de l'app), on part de l'ouverture de la page.
  const [ouvertLe] = useState(() => Date.now());
  const restant = useEcheance((etat?.envoyeLe ?? ouvertLe) + DUREE_CODE_SECONDES * 1000);

  if (!etat?.email) {
    return <Navigate to="/connexion" replace />;
  }
  const email = etat.email;
  const expire = restant === 0;

  function modifierCode(valeur: string) {
    setCode(valeur);
    setErreurChamp(undefined);
  }

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    if (code.length < LONGUEUR_CODE) {
      setErreurChamp(`Saisissez les ${LONGUEUR_CODE} chiffres du code reçu par email.`);
      return;
    }
    setEnCours(true);
    try {
      const utilisateur = await validerCode(email, code);
      navigate(DESTINATION_PAR_ROLE[utilisateur.role] || "/", { replace: true });
    } catch (e) {
      const description = decrireErreur(e, "Code refusé", "Code invalide ou expiré.");
      if (e instanceof ErreurApi && e.statut >= 400 && e.statut < 500 && e.statut !== 429 && e.code !== "trop_de_tentatives") {
        // Code faux ou expire : l'erreur se lit sur les cases, pas dans un bandeau.
        setErreurChamp(description.message);
      } else {
        setErreur(description);
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <PageAuth
      titre="Code de connexion"
      icone={<ShieldCheck size={26} />}
      description={
        <>
          Un code à {LONGUEUR_CODE} chiffres a été envoyé à <strong className="eva-acces-email">{email}</strong>.
        </>
      }
      retour={{ libelle: "Retour à la connexion", vers: "/connexion" }}
      message={
        erreur ? (
          <Alerte variante={erreur.variante} titre={erreur.titre}>
            {erreur.message}
          </Alerte>
        ) : undefined
      }
      pied={
        <p className="eva-acces-pied__note">
          Rien reçu ? Vérifiez vos courriers indésirables, ou revenez à la connexion pour recevoir un nouveau code.
        </p>
      }
    >
      <form onSubmit={soumettre}>
        <ChampCode id="code" label="Code de connexion" libelleMasque valeur={code} onChange={modifierCode} longueur={LONGUEUR_CODE} autoFocus erreur={erreurChamp} />

        {expire ? (
          <Alerte variante="avertissement" titre="Ce code a expiré" compacte className="eva-acces-espace-haut">
            Revenez à la connexion pour recevoir un nouveau code.
            <div className="eva-alerte__actions">
              <LienBouton to="/connexion" variante="secondaire" taille="petit">
                Recevoir un nouveau code
              </LienBouton>
            </div>
          </Alerte>
        ) : (
          <p className="eva-acces-minuteur">
            <Clock size={15} aria-hidden="true" />
            <span>
              Ce code expire dans <strong className="texte-mono">{formaterDuree(restant)}</strong>
            </span>
          </p>
        )}

        <div className="eva-auth__actions">
          <Bouton type="submit" pleineLargeur chargement={enCours}>
            Valider
          </Bouton>
        </div>
      </form>
    </PageAuth>
  );
}
