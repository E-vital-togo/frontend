import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/domaine";

const DESTINATION_PAR_ROLE: Partial<Record<Role, string>> = {
  agent_cec: "/agent",
  admin_cec: "/admin-cec"
};

export default function PageAccueil() {
  const { utilisateur, enChargement } = useAuth();
  if (enChargement) return null;
  if (!utilisateur) return <Navigate to="/connexion" replace />;
  return <Navigate to={DESTINATION_PAR_ROLE[utilisateur.role] || "/connexion"} replace />;
}
