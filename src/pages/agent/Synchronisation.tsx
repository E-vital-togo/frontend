import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Bouton, ChargementPage, EnteteDePage, EtatVide, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import {
  listerActionsEchouees,
  listerActionsEnAttente,
  supprimerActionEchouee,
  supprimerActionEnAttente,
  type ActionEchouee,
  type ActionEnAttente
} from "../../lib/db";
import { restaurerValeurPrecedente } from "../../lib/formulairesHorsLigne";
import { LIENS_AGENT } from "./navigation";

const LIBELLES_TYPE: Record<string, string> = {
  creation_dossier: "Creation de dossier",
  ajout_valeur: "Modification de champ",
  validation_dossier: "Validation de dossier"
};

/**
 * Etat de la file locale (Dexie) de CET appareil, distinct de l'ecran
 * "Conflits" (voir ConflitsSynchronisation.tsx) qui lit ConflitSync cote
 * serveur - un journal partage par toute la mairie. Ici, rien n'est envoye
 * au serveur pour le cas "erreur" : la visibilite et la possibilite
 * d'annuler restent entierement locales a cet agent, sur cet appareil.
 */
export default function Synchronisation() {
  const confirmer = useConfirmation();
  const [enAttente, setEnAttente] = useState<ActionEnAttente[] | null>(null);
  const [echouees, setEchouees] = useState<ActionEchouee[] | null>(null);

  async function charger() {
    const [a, e] = await Promise.all([listerActionsEnAttente(), listerActionsEchouees()]);
    setEnAttente(a);
    setEchouees(e);
  }

  useEffect(() => {
    charger();
  }, []);

  /**
   * Sans ca, abandonner une modification de champ laissait l'ecran de
   * detail continuer a afficher la valeur saisie (ecrite de facon
   * optimiste dans le cache au moment de l'enregistrement, voir
   * DetailDossier.enregistrer) comme si elle etait toujours en cours -
   * alors que l'agent vient justement de dire de l'oublier.
   */
  async function restaurerSiAjoutValeur(action: ActionEnAttente | ActionEchouee) {
    if (action.type !== "ajout_valeur" || !action.dossierId) return;
    const { data_element_code: code, valeur_precedente: valeurPrecedente } = action.payload as {
      data_element_code?: string;
      valeur_precedente?: unknown;
    };
    if (!code) return;
    await restaurerValeurPrecedente(action.dossierId, code, valeurPrecedente ?? null);
  }

  async function annulerEnAttente(action: ActionEnAttente) {
    const ok = await confirmer({
      titre: "Abandonner cette modification ?",
      description: "Cette saisie faite hors-ligne n'a pas encore ete envoyee et ne le sera jamais si vous l'abandonnez. Cette action est irreversible.",
      libelleConfirmer: "Abandonner",
      dangereux: true
    });
    if (!ok || action.localId === undefined) return;
    await restaurerSiAjoutValeur(action);
    await supprimerActionEnAttente(action.localId);
    await charger();
  }

  async function annulerEchouee(action: ActionEchouee) {
    const ok = await confirmer({
      titre: "Abandonner cette modification ?",
      description: "Le serveur a rejete cette saisie hors-ligne. L'abandonner la retire definitivement de cet appareil. Cette action est irreversible.",
      libelleConfirmer: "Abandonner",
      dangereux: true
    });
    if (!ok || action.localId === undefined) return;
    await restaurerSiAjoutValeur(action);
    await supprimerActionEchouee(action.localId);
    await charger();
  }

  function ligneAction(action: ActionEnAttente | ActionEchouee) {
    if (action.type !== "ajout_valeur") return LIBELLES_TYPE[action.type] || action.type;
    const code = (action.payload as { data_element_code?: string }).data_element_code;
    return `${LIBELLES_TYPE.ajout_valeur}${code ? ` (${code})` : ""}`;
  }

  if (enAttente === null || echouees === null) {
    return (
      <MiseEnPage liens={LIENS_AGENT}>
        <ChargementPage />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Synchronisation"
        sousTitre="Etat de la file de cet appareil : actions pas encore envoyees, et actions que le serveur a explicitement rejetees."
      />

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>En attente</h2>
      {enAttente.length === 0 ? (
        <EtatVide
          icone={<CheckCircle2 size={26} />}
          titre="Aucune action en attente"
          description="Tout ce qui a ete saisi sur cet appareil a deja ete envoye."
        />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Date</th>
              <th>Dossier</th>
              <th>Action</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {enAttente.map((action) => (
              <tr key={action.localId}>
                <td className="texte-mono">{new Date(action.horodatageClient).toLocaleString("fr-FR")}</td>
                <td className="texte-mono">{action.dossierId ? action.dossierId.slice(0, 8) : "-"}</td>
                <td>{ligneAction(action)}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  {action.dossierId && (
                    <LienBouton to={`/agent/dossiers/${action.dossierId}`} variante="fantome" taille="petit">
                      Reprendre le dossier
                    </LienBouton>
                  )}
                  <Bouton
                    variante="danger"
                    taille="petit"
                    onClick={() => annulerEnAttente(action)}
                    iconeGauche={<Trash2 size={14} />}
                  >
                    Annuler
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      <h2 style={{ fontSize: 16, margin: "28px 0 12px" }}>Echouees</h2>
      {echouees.length === 0 ? (
        <EtatVide
          icone={<CheckCircle2 size={26} />}
          titre="Aucune action echouee"
          description="Aucune synchronisation n'a ete rejetee par le serveur."
        />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Date</th>
              <th>Dossier</th>
              <th>Action</th>
              <th>Raison</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {echouees.map((action) => (
              <tr key={action.localId}>
                <td className="texte-mono">{new Date(action.horodatageEchec).toLocaleString("fr-FR")}</td>
                <td className="texte-mono">{action.dossierId ? action.dossierId.slice(0, 8) : "-"}</td>
                <td>{ligneAction(action)}</td>
                <td className="eva-tableau__cellule-large">{action.message || action.code || "-"}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  {action.dossierId && (
                    <LienBouton to={`/agent/dossiers/${action.dossierId}`} variante="fantome" taille="petit">
                      Reprendre le dossier
                    </LienBouton>
                  )}
                  <Bouton
                    variante="danger"
                    taille="petit"
                    onClick={() => annulerEchouee(action)}
                    iconeGauche={<Trash2 size={14} />}
                  >
                    Annuler
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </MiseEnPage>
  );
}
