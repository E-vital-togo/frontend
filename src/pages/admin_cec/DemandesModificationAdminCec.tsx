import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileEdit, XCircle } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import BarreRecherche from "../../components/BarreRecherche";
import Pagination from "../../components/Pagination";
import EtatVide from "../../components/EtatVide";
import Squelette from "../../components/Squelette";
import { useToast } from "../../context/ToastContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useListePaginee } from "../../hooks/useListePaginee";
import { LIENS_ADMIN_CEC } from "./navigation";
import type { DemandeModificationActe, NumerosActeProposes } from "../../types/domaine";

const TAILLE_PAGE = 25;

type PanneauAction = { id: string; mode: "valider" | "rejeter" } | null;

export default function DemandesModificationAdminCec() {
  const [recherche, setRecherche] = useState("");
  const [panneau, setPanneau] = useState<PanneauAction>(null);

  const cheminBase = useMemo(() => {
    return recherche ? `/demandes-modification/?search=${encodeURIComponent(recherche)}` : "/demandes-modification/";
  }, [recherche]);

  const {
    items: demandes,
    count,
    page,
    setPage,
    totalPages,
    chargement,
    recharger
  } = useListePaginee<DemandeModificationActe>(cheminBase, TAILLE_PAGE);

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <PageHeader
        titre="Demandes de modification d'acte"
        description="Les champs d'identite (nom, prenom, sexe, date de naissance/deces) exigent une validation
        nationale ; les autres champs se traitent au niveau regional."
      />

      <div style={{ marginBottom: 16 }}>
        <BarreRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher par demandeur ou commentaire..." />
      </div>

      {chargement ? (
        <Squelette lignes={4} />
      ) : (
        <>
          <table className="tableau-standard">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Niveau requis</th>
                <th>Statut</th>
                <th>Demandeur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <LigneDemande
                  key={d.id}
                  demande={d}
                  panneau={panneau}
                  onOuvrir={(mode) => setPanneau({ id: d.id, mode })}
                  onFermer={() => setPanneau(null)}
                  onTraite={() => {
                    setPanneau(null);
                    recharger();
                  }}
                />
              ))}
              {demandes.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EtatVide icone={FileEdit} message="Aucune demande en attente." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={count} taillePage={TAILLE_PAGE} onChangerPage={setPage} />
        </>
      )}
    </MiseEnPage>
  );
}

function LigneDemande({
  demande,
  panneau,
  onOuvrir,
  onFermer,
  onTraite
}: {
  demande: DemandeModificationActe;
  panneau: PanneauAction;
  onOuvrir: (mode: "valider" | "rejeter") => void;
  onFermer: () => void;
  onTraite: () => void;
}) {
  const panneauOuvert = panneau?.id === demande.id ? panneau.mode : null;

  return (
    <>
      <tr>
        <td className="texte-mono">{demande.dossier.slice(0, 8)}</td>
        <td>{demande.niveau_requis === "national" ? "National" : "Regional"}</td>
        <td>{LIBELLES_STATUT[demande.statut]}</td>
        <td className="texte-mono">{demande.demandeur.slice(0, 8)}</td>
        <td style={{ display: "flex", gap: 8 }}>
          {demande.statut === "en_attente" && (
            <>
              <button className="bouton-principal" onClick={() => onOuvrir("valider")}>
                Valider
              </button>
              <button className="bouton-secondaire" onClick={() => onOuvrir("rejeter")}>
                Rejeter
              </button>
            </>
          )}
        </td>
      </tr>
      {panneauOuvert === "valider" && (
        <tr>
          <td colSpan={5} style={{ background: "var(--couleur-papier)" }}>
            <PanneauValidation demandeId={demande.id} onAnnuler={onFermer} onValide={onTraite} />
          </td>
        </tr>
      )}
      {panneauOuvert === "rejeter" && (
        <tr>
          <td colSpan={5} style={{ background: "var(--couleur-papier)" }}>
            <PanneauRejet demandeId={demande.id} onAnnuler={onFermer} onRejete={onTraite} />
          </td>
        </tr>
      )}
    </>
  );
}

const LIBELLES_STATUT: Record<DemandeModificationActe["statut"], string> = {
  en_attente: "En attente",
  validee: "Validee",
  rejetee: "Rejetee"
};

function PanneauValidation({
  demandeId,
  onAnnuler,
  onValide
}: {
  demandeId: string;
  onAnnuler: () => void;
  onValide: () => void;
}) {
  const [numeros, setNumeros] = useState<NumerosActeProposes | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { notifier } = useToast();

  useEffect(() => {
    appelApi<NumerosActeProposes>(`/demandes-modification/${demandeId}/numeros-proposes/`)
      .then(setNumeros)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : "Impossible de proposer des numeros."))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeId]);

  async function confirmer() {
    if (!numeros) return;
    setEnCours(true);
    try {
      await appelApi(`/demandes-modification/${demandeId}/valider/`, { methode: "POST", corps: numeros });
      notifier("Nouvel acte emis, demande validee.", "succes");
      onValide();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <Squelette lignes={2} />;

  return (
    <div style={{ padding: "12px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "var(--couleur-gris-service-2)" }}>
        <CheckCircle2 size={16} />
        <span style={{ fontSize: 13 }}>Nouvel acte (numerotation reservee, non consommee tant que non confirmee)</span>
      </div>
      {erreur && <div className="message-erreur">{erreur}</div>}
      {numeros && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <ChampNumero label="Registre" valeur={numeros.numero_registre} onChange={(v) => setNumeros({ ...numeros, numero_registre: v })} />
          <ChampNumero label="Feuillet" valeur={numeros.numero_feuillet} onChange={(v) => setNumeros({ ...numeros, numero_feuillet: v })} />
          <ChampNumero label="Acte" valeur={numeros.numero_acte} onChange={(v) => setNumeros({ ...numeros, numero_acte: v })} />
          <ChampNumero label="Annee" valeur={numeros.annee_registre} onChange={(v) => setNumeros({ ...numeros, annee_registre: v })} />
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="bouton-principal" onClick={confirmer} disabled={enCours || !numeros}>
          {enCours ? "Emission..." : "Confirmer l'emission du nouvel acte"}
        </button>
        <button className="bouton-secondaire" onClick={onAnnuler} disabled={enCours}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function ChampNumero({ label, valeur, onChange }: { label: string; valeur: number; onChange: (v: number) => void }) {
  return (
    <div className="champ" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <input
        type="number"
        className="texte-mono"
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 110 }}
      />
    </div>
  );
}

function PanneauRejet({ demandeId, onAnnuler, onRejete }: { demandeId: string; onAnnuler: () => void; onRejete: () => void }) {
  const [commentaire, setCommentaire] = useState("");
  const [enCours, setEnCours] = useState(false);
  const { notifier } = useToast();

  async function confirmer() {
    if (!commentaire.trim()) {
      notifier("Le motif du rejet est requis.", "erreur");
      return;
    }
    setEnCours(true);
    try {
      await appelApi(`/demandes-modification/${demandeId}/rejeter/`, { methode: "POST", corps: { commentaire } });
      notifier("Demande rejetee.", "succes");
      onRejete();
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div style={{ padding: "12px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "var(--couleur-gris-service-2)" }}>
        <XCircle size={16} />
        <span style={{ fontSize: 13 }}>Motif du rejet</span>
      </div>
      <div className="champ" style={{ maxWidth: 460 }}>
        <textarea
          rows={3}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Expliquez pourquoi cette demande est rejetee..."
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="bouton-principal" onClick={confirmer} disabled={enCours}>
          {enCours ? "Envoi..." : "Confirmer le rejet"}
        </button>
        <button className="bouton-secondaire" onClick={onAnnuler} disabled={enCours}>
          Annuler
        </button>
      </div>
    </div>
  );
}
