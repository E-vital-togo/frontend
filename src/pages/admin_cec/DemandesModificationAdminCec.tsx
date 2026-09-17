import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Bouton, Champ, ChargementPage, EnteteDePage, EtatVide, Modale, Tableau } from "../../components/ui";
import { useToast } from "../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { listeDepuis, type DemandeModificationActe, type ListeOuPaginee, type NumerosActeProposes } from "../../types/domaine";

const LIBELLES_STATUT: Record<string, string> = { en_attente: "En attente", validee: "Validee", rejetee: "Rejetee" };
const LIBELLES_NIVEAU: Record<string, string> = { regional: "Regional", national: "National" };

function formaterValeur(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "(vide)";
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

export default function DemandesModificationAdminCec() {
  const toast = useToast();
  const [parametresUrl] = useSearchParams();
  const evenementFiltre = parametresUrl.get("event_type") || "";
  const [demandes, setDemandes] = useState<DemandeModificationActe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [afficherToutes, setAfficherToutes] = useState(false);

  const [demandeExaminee, setDemandeExaminee] = useState<DemandeModificationActe | null>(null);
  const [mode, setMode] = useState<"valider" | "rejeter" | null>(null);
  const [numeros, setNumeros] = useState<NumerosActeProposes | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [actionEnCours, setActionEnCours] = useState(false);

  function charger() {
    setChargement(true);
    const parametres = new URLSearchParams();
    if (evenementFiltre) parametres.set("dossier__event_type", evenementFiltre);
    appelApi<ListeOuPaginee<DemandeModificationActe>>(`/demandes-modification/?${parametres.toString()}`)
      .then((donnees) => setDemandes(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenementFiltre]);

  const demandesAffichees = afficherToutes ? demandes : demandes.filter((d) => d.statut === "en_attente");

  function fermerModale() {
    setDemandeExaminee(null);
    setMode(null);
    setNumeros(null);
    setCommentaire("");
  }

  async function demarrerValidation() {
    if (!demandeExaminee) return;
    setMode("valider");
    try {
      const proposes = await appelApi<NumerosActeProposes>(`/demandes-modification/${demandeExaminee.id}/numeros-proposes/`);
      setNumeros(proposes);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Impossible de recuperer les numeros proposes.");
      setMode(null);
    }
  }

  async function confirmerValidation(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!demandeExaminee || !numeros) return;
    setActionEnCours(true);
    try {
      await appelApi(`/demandes-modification/${demandeExaminee.id}/valider/`, { methode: "POST", corps: numeros });
      toast.succes("Demande validee : l'ancien acte est annule, un nouvel acte a ete emis.");
      fermerModale();
      charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setActionEnCours(false);
    }
  }

  async function confirmerRejet(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!demandeExaminee || !commentaire.trim()) return;
    setActionEnCours(true);
    try {
      await appelApi(`/demandes-modification/${demandeExaminee.id}/rejeter/`, { methode: "POST", corps: { commentaire } });
      toast.info("Demande rejetee.");
      fermerModale();
      charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setActionEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Demandes de modification d'acte"
        sousTitre="Les champs d'identite (nom, prenom, sexe, date de naissance/deces) exigent une validation nationale ; les autres champs se traitent au niveau regional."
        actions={
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
            <input type="checkbox" checked={afficherToutes} onChange={(e) => setAfficherToutes(e.target.checked)} />
            Voir aussi les demandes traitees
          </label>
        }
      />

      {chargement ? (
        <ChargementPage />
      ) : demandesAffichees.length === 0 ? (
        <EtatVide icone={<CheckCircle2 size={28} />} titre="Aucune demande en attente" />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Dossier</th>
              <th>Niveau requis</th>
              <th>Statut</th>
              <th>Demande le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {demandesAffichees.map((d) => (
              <tr key={d.id}>
                <td className="texte-mono">{d.dossier.slice(0, 8)}</td>
                <td>{LIBELLES_NIVEAU[d.niveau_requis] || d.niveau_requis}</td>
                <td>
                  <span
                    className={`eva-badge ${d.statut === "validee" ? "eva-badge--succes" : d.statut === "rejetee" ? "eva-badge--danger" : "eva-badge--attente"}`}
                  >
                    {LIBELLES_STATUT[d.statut] || d.statut}
                  </span>
                </td>
                <td className="texte-mono">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                <td>
                  <Bouton variante="fantome" taille="petit" iconeGauche={<Eye size={14} />} onClick={() => setDemandeExaminee(d)}>
                    Examiner
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {demandeExaminee && (
        <Modale titre="Demande de modification" onFermer={fermerModale} large>
          <div style={{ marginBottom: 14, fontSize: 13.5, color: "var(--couleur-gris-service-2)" }}>
            Dossier <span className="texte-mono">{demandeExaminee.dossier.slice(0, 8)}</span> · Niveau requis{" "}
            <strong>{LIBELLES_NIVEAU[demandeExaminee.niveau_requis] || demandeExaminee.niveau_requis}</strong>
          </div>

          <div className="eva-tableau-conteneur" style={{ marginBottom: 18 }}>
            <table className="eva-tableau">
              <thead>
                <tr>
                  <th>Champ</th>
                  <th>Ancienne valeur</th>
                  <th>Nouvelle valeur</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(demandeExaminee.champs_modifies).map(([code, diff]) => (
                  <tr key={code}>
                    <td>{code}</td>
                    <td>{formaterValeur(diff.ancienne_valeur)}</td>
                    <td style={{ fontWeight: 600 }}>{formaterValeur(diff.nouvelle_valeur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {demandeExaminee.statut !== "en_attente" && (
            <p style={{ fontSize: 13.5, color: "var(--couleur-gris-service-2)" }}>
              Cette demande a deja ete traitee ({LIBELLES_STATUT[demandeExaminee.statut]}).
              {demandeExaminee.commentaire_validateur && ` Commentaire : ${demandeExaminee.commentaire_validateur}`}
            </p>
          )}

          {demandeExaminee.statut === "en_attente" && mode === null && (
            <div style={{ display: "flex", gap: 10 }}>
              <Bouton variante="accent" iconeGauche={<CheckCircle2 size={16} />} onClick={demarrerValidation}>
                Valider
              </Bouton>
              <Bouton variante="danger" iconeGauche={<XCircle size={16} />} onClick={() => setMode("rejeter")}>
                Rejeter
              </Bouton>
            </div>
          )}

          {mode === "valider" && (
            <form onSubmit={confirmerValidation}>
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                L'ancien acte sera annule et un nouvel acte emis avec les numeros suivants (modifiables) :
              </p>
              {!numeros ? (
                <ChargementPage texte="Preparation de la numerotation..." />
              ) : (
                <>
                  <div className="eva-grille-2" style={{ gap: 14 }}>
                    <Champ id="v-numero-registre" label="Numero de registre">
                      <input id="v-numero-registre" type="number" className="texte-mono" value={numeros.numero_registre} onChange={(e) => setNumeros({ ...numeros, numero_registre: Number(e.target.value) })} />
                    </Champ>
                    <Champ id="v-numero-feuillet" label="Numero de feuillet">
                      <input id="v-numero-feuillet" type="number" className="texte-mono" value={numeros.numero_feuillet} onChange={(e) => setNumeros({ ...numeros, numero_feuillet: Number(e.target.value) })} />
                    </Champ>
                    <Champ id="v-numero-acte" label="Numero d'acte">
                      <input id="v-numero-acte" type="number" className="texte-mono" value={numeros.numero_acte} onChange={(e) => setNumeros({ ...numeros, numero_acte: Number(e.target.value) })} />
                    </Champ>
                    <Champ id="v-annee-registre" label="Annee du registre">
                      <input id="v-annee-registre" type="number" className="texte-mono" value={numeros.annee_registre} onChange={(e) => setNumeros({ ...numeros, annee_registre: Number(e.target.value) })} />
                    </Champ>
                  </div>
                  <div className="eva-modale__actions" style={{ marginTop: 18 }}>
                    <Bouton type="button" variante="fantome" onClick={() => setMode(null)}>
                      Retour
                    </Bouton>
                    <Bouton type="submit" variante="accent" chargement={actionEnCours}>
                      Confirmer la validation
                    </Bouton>
                  </div>
                </>
              )}
            </form>
          )}

          {mode === "rejeter" && (
            <form onSubmit={confirmerRejet}>
              <Champ id="commentaire-rejet" label="Motif du rejet" requis>
                <textarea id="commentaire-rejet" rows={3} required value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
              </Champ>
              <div className="eva-modale__actions">
                <Bouton type="button" variante="fantome" onClick={() => setMode(null)}>
                  Retour
                </Bouton>
                <Bouton type="submit" variante="danger" chargement={actionEnCours} disabled={!commentaire.trim()}>
                  Confirmer le rejet
                </Bouton>
              </div>
            </form>
          )}
        </Modale>
      )}
    </MiseEnPage>
  );
}
