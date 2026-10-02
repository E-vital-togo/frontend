import { Navigate } from "react-router-dom";
import { ChevronRight, KeyRound, Landmark, UserRound } from "lucide-react";
import { CarteLien, LienBouton, PageAuth } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/domaine";
import "../styles/auth.css";

const DESTINATION_PAR_ROLE: Partial<Record<Role, string>> = {
  agent_cec: "/agent",
  admin_cec: "/admin-cec"
};

/**
 * Point d'entree "/" : une personne connectee est envoyee vers son espace ;
 * sinon, l'ecran d'accueil propose les deux entrees de l'application (parent
 * ou declarant, agent ou administrateur) au lieu d'un renvoi direct vers la
 * connexion, qui laissait les parents sans repere.
 */
export default function PageAccueil() {
  const { utilisateur, enChargement } = useAuth();
  if (enChargement) return null;
  if (utilisateur) return <Navigate to={DESTINATION_PAR_ROLE[utilisateur.role] || "/connexion"} replace />;

  return (
    <PageAuth
      large
      nomDeveloppe
      titre="Bienvenue sur le RECVIT"
      description="Le système national d'enregistrement des naissances et des décès. Choisissez votre espace pour continuer."
      pied={
        <>
          <p className="eva-acces-pied__lien">Vous avez perdu votre code de retrait ?</p>
          <LienBouton to="/retrouver-mon-code" variante="fantome" taille="petit" iconeGauche={<KeyRound size={15} />}>
            Retrouver mon code
          </LienBouton>
        </>
      }
    >
      <nav className="eva-acces-choix" aria-label="Choisir mon espace">
        <CarteLien to="/completion" className="eva-acces-choix__carte">
          <span className="eva-acces-choix__icone eva-acces-choix__icone--parent" aria-hidden="true">
            <UserRound size={24} />
          </span>
          <span className="eva-acces-choix__texte">
            <span className="eva-acces-choix__titre">Je suis parent ou déclarant</span>
            <span className="eva-acces-choix__description">Compléter ma déclaration ou suivre mon dossier avec mon code de retrait.</span>
          </span>
          <ChevronRight size={20} className="eva-acces-choix__fleche" aria-hidden="true" />
        </CarteLien>
        <CarteLien to="/connexion" className="eva-acces-choix__carte">
          <span className="eva-acces-choix__icone" aria-hidden="true">
            <Landmark size={24} />
          </span>
          <span className="eva-acces-choix__texte">
            <span className="eva-acces-choix__titre">Agent ou administrateur</span>
            <span className="eva-acces-choix__description">Me connecter à l'espace de gestion de l'état civil.</span>
          </span>
          <ChevronRight size={20} className="eva-acces-choix__fleche" aria-hidden="true" />
        </CarteLien>
      </nav>
    </PageAuth>
  );
}
