import { useEffect, useState } from "react";
import { appelApi } from "./apiClient";
import { estEnLigne, surChangementConnectivite } from "./connectivite";
import { useAuth } from "../context/AuthContext";
import {
  listeDepuis,
  type Dossier,
  type ConflitSync,
  type DemandeModificationActe,
  type ListeOuPaginee,
  type NotificationEchouee,
  type Utilisateur
} from "../types/domaine";

export interface Compteurs {
  echeances: number;
  echeancesNaissance: number;
  echeancesDeces: number;
  conflits: number;
  demandes: number;
  demandesNaissance: number;
  demandesDeces: number;
  notificationsEchouees: number;
  notificationsEchoueesNaissance: number;
  notificationsEchoueesDeces: number;
}

const VIDE: Compteurs = {
  echeances: 0,
  echeancesNaissance: 0,
  echeancesDeces: 0,
  conflits: 0,
  demandes: 0,
  demandesNaissance: 0,
  demandesDeces: 0,
  notificationsEchouees: 0,
  notificationsEchoueesNaissance: 0,
  notificationsEchoueesDeces: 0
};

/**
 * Etat garde au niveau module, PAS dans un useState de useCompteurs.
 * MiseEnPage est remonte a chaque changement de route (chaque page rend son
 * propre <MiseEnPage>, ce n'est pas un layout persistant) : un useState
 * local repartirait donc de VIDE a chaque navigation, y compris hors-ligne
 * - ou aucun fetch n'a lieu pour le repeupler, laissant le badge afficher 0
 * en permanence des qu'on change de page. Meme logique que
 * lib/connectivite.ts : une seule verite partagee qui survit aux montages,
 * useCompteurs() n'etant plus qu'une vue reactive dessus.
 */
let compteurs: Compteurs = VIDE;
let utilisateurCourant: Utilisateur | null = null;
const ecouteurs = new Set<(valeur: Compteurs) => void>();
let demarre = false;

function definir(valeur: Compteurs): void {
  compteurs = valeur;
  ecouteurs.forEach((ecouteur) => ecouteur(compteurs));
}

/**
 * Ni requete inutile (on sait deja qu'elle echouera) ni, surtout, remise a
 * zero des compteurs reels sur un simple echec reseau : un conflit de
 * synchronisation existant ne doit pas disparaitre de la cloche de
 * notification parce que le reseau a eu un blip pendant le polling. On
 * garde la derniere valeur connue et on laisse le badge de connectivite
 * (MiseEnPage) porter le signal "hors-ligne", pas ce compteur.
 */
function rafraichir(): void {
  if (!utilisateurCourant || !estEnLigne()) return;

  if (utilisateurCourant.role === "agent_cec") {
    // Naissance/Deces demandes separement (plutot qu'un seul appel puis un
    // filtre client) : le total affiche sur "Dossiers" est construit comme
    // leur somme, jamais une troisieme valeur independante qui pourrait
    // diverger de ce qu'affichent les sous-liens.
    Promise.all([
      appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true&event_type=naissance"),
      appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true&event_type=deces"),
      appelApi<ListeOuPaginee<ConflitSync>>("/sync/conflits/")
    ])
      .then(([dossiersNaissance, dossiersDeces, conflits]) => {
        const echeancesNaissance = listeDepuis(dossiersNaissance).length;
        const echeancesDeces = listeDepuis(dossiersDeces).length;
        definir({
          echeances: echeancesNaissance + echeancesDeces,
          echeancesNaissance,
          echeancesDeces,
          conflits: listeDepuis(conflits).length,
          demandes: 0,
          demandesNaissance: 0,
          demandesDeces: 0,
          notificationsEchouees: 0,
          notificationsEchoueesNaissance: 0,
          notificationsEchoueesDeces: 0
        });
      })
      .catch(() => {});
  } else if (utilisateurCourant.role === "admin_cec") {
    // Meme principe que pour l'agent : naissance/deces demandes separement
    // (filtre backend, pas un split client) pour que le total du parent
    // soit garanti egal a la somme affichee sur les sous-liens.
    Promise.all([
      appelApi<ListeOuPaginee<DemandeModificationActe>>("/demandes-modification/?statut=en_attente&dossier__event_type=naissance"),
      appelApi<ListeOuPaginee<DemandeModificationActe>>("/demandes-modification/?statut=en_attente&dossier__event_type=deces"),
      appelApi<ListeOuPaginee<ConflitSync>>("/sync/conflits/"),
      appelApi<ListeOuPaginee<NotificationEchouee>>("/notifications-echouees/?dossier__event_type=naissance"),
      appelApi<ListeOuPaginee<NotificationEchouee>>("/notifications-echouees/?dossier__event_type=deces")
    ])
      .then(([demandesNaissance, demandesDeces, conflits, notifNaissance, notifDeces]) => {
        const compteDemandesNaissance = listeDepuis(demandesNaissance).length;
        const compteDemandesDeces = listeDepuis(demandesDeces).length;
        const compteNotifNaissance = listeDepuis(notifNaissance).length;
        const compteNotifDeces = listeDepuis(notifDeces).length;
        definir({
          echeances: 0,
          echeancesNaissance: 0,
          echeancesDeces: 0,
          conflits: listeDepuis(conflits).length,
          demandes: compteDemandesNaissance + compteDemandesDeces,
          demandesNaissance: compteDemandesNaissance,
          demandesDeces: compteDemandesDeces,
          notificationsEchouees: compteNotifNaissance + compteNotifDeces,
          notificationsEchoueesNaissance: compteNotifNaissance,
          notificationsEchoueesDeces: compteNotifDeces
        });
      })
      .catch(() => {});
  }
}

function demarrerSiBesoin(): void {
  if (demarre) return;
  demarre = true;
  window.setInterval(rafraichir, 60_000);
  // Redeclenche immediatement au retour de connexion CONFIRME (voir
  // connectivite.ts), plutot que d'attendre jusqu'a 60s pour rafraichir des
  // compteurs restes potentiellement perimes depuis la coupure.
  surChangementConnectivite((enLigne) => {
    if (enLigne) rafraichir();
  });
}

export function useCompteurs(): Compteurs & { rafraichir: () => void } {
  const { utilisateur } = useAuth();
  const [valeur, setValeur] = useState(() => compteurs);

  useEffect(() => {
    demarrerSiBesoin();
    ecouteurs.add(setValeur);
    return () => {
      ecouteurs.delete(setValeur);
    };
  }, []);

  useEffect(() => {
    utilisateurCourant = utilisateur;
    if (!utilisateur) {
      definir(VIDE);
    } else {
      rafraichir();
    }
  }, [utilisateur]);

  return { ...valeur, rafraichir };
}
