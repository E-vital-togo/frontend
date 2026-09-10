import { useEffect, useState } from "react";
import { appelApi } from "./apiClient";
import { useAuth } from "../context/AuthContext";
import type { Territoire } from "../types/domaine";

/** Le territoire administre par l'admin_cec connecte (null pour tout autre role, ou tant qu'il charge). */
export function useMonTerritoire(): Territoire | null {
  const { utilisateur } = useAuth();
  const [territoire, setTerritoire] = useState<Territoire | null>(null);

  useEffect(() => {
    if (!utilisateur?.territoire_scope) {
      setTerritoire(null);
      return;
    }
    appelApi<Territoire>(`/territoires/${utilisateur.territoire_scope}/`).then(setTerritoire);
  }, [utilisateur]);

  return territoire;
}
