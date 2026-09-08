import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const LIBELLES_ROLE: Record<string, string> = {
  agent_cec: "Agent CEC",
  admin_cec: "Administrateur CEC",
  admin_inseed: "Administrateur INSEED",
  admin_general: "Administrateur general"
};

function initiales(prenoms?: string, nom?: string): string {
  return `${prenoms?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase();
}

/**
 * Remplace le simple "Nom + bouton Deconnexion" de l'en-tete par un menu
 * deroulant : seul point d'acces a /compte (profil + securite).
 */
export default function MenuUtilisateur() {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function surClicExterieur(evenement: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(evenement.target as Node)) {
        setOuvert(false);
      }
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  if (!utilisateur) return null;

  function seDeconnecter() {
    deconnecter();
    navigate("/connexion");
  }

  return (
    <div className="menu-utilisateur" ref={conteneurRef}>
      <button type="button" className="menu-utilisateur__declencheur" onClick={() => setOuvert((v) => !v)}>
        <span className="menu-utilisateur__avatar">{initiales(utilisateur.prenoms, utilisateur.nom)}</span>
        <ChevronDown size={14} />
      </button>
      {ouvert && (
        <div className="menu-utilisateur__volet">
          <div className="menu-utilisateur__entete">
            <div className="menu-utilisateur__nom">
              {utilisateur.prenoms} {utilisateur.nom}
            </div>
            <div className="menu-utilisateur__role">{LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role}</div>
          </div>
          <Link to="/compte" className="menu-utilisateur__lien" onClick={() => setOuvert(false)}>
            <UserRound size={15} />
            Mon compte
          </Link>
          <button type="button" className="menu-utilisateur__bouton" onClick={seDeconnecter}>
            <LogOut size={15} />
            Deconnexion
          </button>
        </div>
      )}
    </div>
  );
}
