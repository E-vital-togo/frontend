import { useCallback, useEffect, useState } from "react";
import { appelApi } from "./apiClient";
import { useConnectivite } from "./connectivite";
import { useAuth } from "../context/AuthContext";
import {
  listeDepuis,
  type Dossier,
  type ConflitSync,
  type DemandeModificationActe,
  type ListeOuPaginee,
  type NotificationEchouee
} from "../types/domaine";

export interface Compteurs {
  echeances: number;
  conflits: number;
  demandes: number;
  notificationsEchouees: number;
}

const VIDE: Compteurs = { echeances: 0, conflits: 0, demandes: 0, notificationsEchouees: 0 };

/**
 * Petits compteurs affiches en badge dans la navigation et la cloche de
 * notifications. Volontairement approximatifs plutot qu'exacts a grande
 * echelle : /demandes-modification/ n'a pas de filtre statut cote backend,
 * donc le compte "demandes" se base sur la premiere page recue - suffisant
 * pour un indicateur de nav, pas pour une decision metier.
 */
export function useCompteurs(): Compteurs & { rafraichir: () => void } {
  const { utilisateur } = useAuth();
  const enLigne = useConnectivite();
  const [compteurs, setCompteurs] = useState<Compteurs>(VIDE);

  // Ni requete inutile (on sait deja qu'elle echouera) ni, surtout, remise a
  // zero des compteurs reels sur un simple echec reseau : un conflit de
  // synchronisation existant ne doit pas disparaitre de la cloche de
  // notification parce que le reseau a eu un blip pendant le polling. On
  // garde la derniere valeur connue et on laisse le badge de connectivite
  // (MiseEnPage) porter le signal "hors-ligne", pas ce compteur.
  const rafraichir = useCallback(() => {
    if (!utilisateur || !enLigne) return;

    if (utilisateur.role === "agent_cec") {
      Promise.all([
        appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true"),
        appelApi<ListeOuPaginee<ConflitSync>>("/sync/conflits/")
      ])
        .then(([dossiers, conflits]) => {
          setCompteurs({
            echeances: listeDepuis(dossiers).length,
            conflits: listeDepuis(conflits).length,
            demandes: 0,
            notificationsEchouees: 0
          });
        })
        .catch(() => {});
    } else if (utilisateur.role === "admin_cec") {
      Promise.all([
        appelApi<ListeOuPaginee<DemandeModificationActe>>("/demandes-modification/"),
        appelApi<ListeOuPaginee<ConflitSync>>("/sync/conflits/"),
        appelApi<ListeOuPaginee<NotificationEchouee>>("/notifications-echouees/")
      ])
        .then(([demandes, conflits, notificationsEchouees]) => {
          const enAttente = listeDepuis(demandes).filter((d) => d.statut === "en_attente").length;
          setCompteurs({
            echeances: 0,
            conflits: listeDepuis(conflits).length,
            demandes: enAttente,
            notificationsEchouees: listeDepuis(notificationsEchouees).length
          });
        })
        .catch(() => {});
    }
  }, [utilisateur, enLigne]);

  useEffect(() => {
    rafraichir();
    const intervalle = window.setInterval(rafraichir, 60_000);
    return () => window.clearInterval(intervalle);
  }, [rafraichir]);

  return { ...compteurs, rafraichir };
}
