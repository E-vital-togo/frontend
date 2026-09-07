import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/domaine";

interface ProprietesRouteProtegee {
  rolesAutorises?: Role[];
  children: ReactNode;
}

export default function RouteProtegee({ rolesAutorises, children }: ProprietesRouteProtegee) {
  const { utilisateur, enChargement } = useAuth();

  if (enChargement) return null;
  if (!utilisateur) return <Navigate to="/connexion" replace />;
  if (rolesAutorises && !rolesAutorises.includes(utilisateur.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
