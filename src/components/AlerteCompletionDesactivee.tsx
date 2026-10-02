import type { ReactNode } from "react";
import { PauseCircle } from "lucide-react";
import { Alerte } from "./ui";
import { useEtatCompletion } from "../lib/etatCompletion";
import "../styles/completion-desactivee.css";

interface ProprietesAlerteCompletionDesactivee {
  /** Complete ou remplace le texte par defaut (conseille de rester concis). */
  children?: ReactNode;
  /** Titre du bandeau (defaut : "Notifications et rappels désactivés"). */
  titre?: string;
  className?: string;
}

/**
 * Bandeau d'information des espaces agent / admin CEC : s'affiche UNIQUEMENT
 * quand l'administrateur general a coupe la completion parent (voir
 * lib/etatCompletion.ts, qui suppose "actif" en cas d'erreur reseau : aucun
 * bandeau sur la foi d'une panne). Ton "info" et non "erreur" : c'est une
 * decision de l'administration, pas un incident.
 */
export default function AlerteCompletionDesactivee({
  children,
  titre = "Notifications et rappels désactivés",
  className
}: ProprietesAlerteCompletionDesactivee) {
  const { active } = useEtatCompletion();
  if (active) return null;
  return (
    <Alerte variante="info" titre={titre} icone={<PauseCircle size={18} aria-hidden="true" />} className={["eva-ci-bandeau", className].filter(Boolean).join(" ")}>
      {children ?? (
        <>
          Les notifications et rappels sont désactivés par l'administration : aucun SMS n'est envoyé aux parents et le formulaire de complétion en ligne
          est indisponible. Les dossiers gardent leur statut et les codes de retrait restent valables au guichet.
        </>
      )}
    </Alerte>
  );
}
