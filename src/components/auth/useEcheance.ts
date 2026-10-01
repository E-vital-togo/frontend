import { useEffect, useState } from "react";

/**
 * Secondes restantes avant l'instant `fin` (en ms, comme Date.now()), mises a
 * jour chaque seconde. Renvoie 0 si `fin` est nul ou depassee. Sert au compte a
 * rebours de validite d'un code et a la pause avant de pouvoir renvoyer un SMS.
 */
export function useEcheance(fin: number | null): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    if (fin === null) return;
    setMaintenant(Date.now());
    const minuteur = window.setInterval(() => {
      const instant = Date.now();
      setMaintenant(instant);
      if (instant >= fin) window.clearInterval(minuteur);
    }, 1000);
    return () => window.clearInterval(minuteur);
  }, [fin]);

  if (fin === null) return 0;
  return Math.max(0, Math.ceil((fin - maintenant) / 1000));
}

/** 572 -> "9:32". */
export function formaterDuree(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${minutes}:${String(reste).padStart(2, "0")}`;
}
