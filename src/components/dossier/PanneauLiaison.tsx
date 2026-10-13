import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, HeartOff, Link2, Search, Unlink } from "lucide-react";
import { Alerte, Badge, Bouton, Carte, Spinner } from "../ui";
import { useConfirmation } from "../ui/ConfirmationProvider";
import { useToast } from "../ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { formaterDate } from "./utilitaires";
import type { CandidatLiaison, LiaisonDeces, LiaisonDossier, ResumeDossierLie } from "../../types/domaine";
import "../../styles/dossier.css";

/** Pendant « Recherche en cours » : relecture toutes les 3 s, au plus 10 fois (le calcul se fait en arrière-plan). */
const DELAI_RELECTURE_MS = 3000;
const RELECTURES_MAX = 10;

interface ProprietesPanneauLiaison {
  idDossier: string;
  basePath: string;
  /** Peut décider (agent et admin CEC) ; faux en lecture seule. */
  peutDecider: boolean;
  /** Remonte la situation au parent (avertissement avant « complet » ou « émission » au niveau « moyen »). */
  onSituation?: (liaison: LiaisonDeces | null) => void;
}

function messageErreur(e: unknown): string {
  return e instanceof ErreurApi || e instanceof Error ? e.message : "Erreur inattendue.";
}

function libelleActe(r: ResumeDossierLie): string {
  return r.numero_acte ? `acte n° ${r.numero_acte}${r.annee_registre ? ` / ${r.annee_registre}` : ""}` : "acte non numéroté";
}

function lienDossier(basePath: string, r: ResumeDossierLie, libelle: string) {
  return r.consultable ? (
    <Link className="eva-lien" to={`${basePath}/dossiers/${r.dossier_id}`}>
      {libelle}
    </Link>
  ) : (
    <span className="eva-dd-liaison__neutre">Dossier suivi par {r.mairie} (consultation réservée à cette mairie)</span>
  );
}

function CarteCandidat({
  candidat,
  basePath,
  peutDecider,
  occupe,
  onConfirmer,
  onRejeter
}: {
  candidat: CandidatLiaison;
  basePath: string;
  peutDecider: boolean;
  occupe: boolean;
  onConfirmer: () => void;
  onRejeter: () => void;
}) {
  const [detailOuvert, setDetailOuvert] = useState(false);
  const n = candidat.naissance;
  return (
    <li className="eva-dd-liaison__candidat">
      <div className="eva-dd-liaison__entete">
        <div className="eva-dd-liaison__identite">
          <span className="eva-dd-liaison__nom">{n.nom || "Nom non renseigné"}</span>
          <span className="eva-dd-liaison__meta">
            {n.naissance ? `Né(e) le ${n.naissance}` : "Date de naissance inconnue"}
            {n.mere ? ` - mère : ${n.mere}` : ""}
          </span>
          <span className="eva-dd-liaison__meta">
            {n.mairie} - {libelleActe(n)}
          </span>
          <span className="eva-dd-liaison__meta">{lienDossier(basePath, n, "Voir le dossier de naissance")}</span>
        </div>
        <div className="eva-dd-liaison__score">
          <span className="eva-dd-liaison__score-valeur">{candidat.score} %</span>
          <span
            className={`eva-dd-liaison__jauge${candidat.forte ? " eva-dd-liaison__jauge--forte" : ""}`}
            role="img"
            aria-label={`Sûreté de la correspondance : ${candidat.score} %`}
          >
            <span style={{ width: `${candidat.score}%` }} />
          </span>
          <Badge variante={candidat.forte ? "succes" : "attente"}>{candidat.forte ? "Correspondance forte" : "À vérifier"}</Badge>
        </div>
      </div>

      <div className="eva-dd-liaison__actions">
        {peutDecider && (
          <>
            <Bouton onClick={onConfirmer} disabled={occupe} iconeGauche={<Link2 size={16} />}>
              C'est la bonne personne
            </Bouton>
            <Bouton variante="secondaire" onClick={onRejeter} disabled={occupe}>
              Ce n'est pas elle
            </Bouton>
          </>
        )}
        <Bouton
          variante="fantome"
          onClick={() => setDetailOuvert((o) => !o)}
          aria-expanded={detailOuvert}
          iconeGauche={detailOuvert ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        >
          {detailOuvert ? "Masquer le détail" : "Voir le détail"}
        </Bouton>
      </div>

      {detailOuvert && (
        <div className="eva-dd-liaison__detail">
          <table>
            <caption className="eva-sr-only">Détail de la comparaison, critère par critère</caption>
            <thead>
              <tr>
                <th scope="col">Critère</th>
                <th scope="col">Décès</th>
                <th scope="col">Naissance</th>
                <th scope="col">Concordance</th>
              </tr>
            </thead>
            <tbody>
              {candidat.detail.map((c) => (
                <tr key={c.code}>
                  <th scope="row">{c.libelle}</th>
                  <td>{c.valeur_deces || "-"}</td>
                  <td>{c.valeur_naissance || "-"}</td>
                  <td>
                    {c.score === null ? (
                      <span className="eva-dd-liaison__neutre">
                        {c.statut === "absent_deces" ? "Non renseigné sur le décès" : "Non renseigné sur la naissance"}
                      </span>
                    ) : (
                      `${c.score} %`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

/**
 * Liaison naissance / décès d'un dossier (voir apps.liaisons). Sur un décès : naissances candidates à confirmer,
 * naissance retrouvée ou non. Sur une naissance : décès lié, le cas échéant. N'affiche rien tant que la fonction
 * est désactivée par l'Admin Général (réglage par défaut) ou sans information utile.
 */
export default function PanneauLiaison({ idDossier, basePath, peutDecider, onSituation }: ProprietesPanneauLiaison) {
  const toast = useToast();
  const confirmer = useConfirmation();
  const [liaison, setLiaison] = useState<LiaisonDossier | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const relectures = useRef(0);

  const appliquer = useCallback(
    (reponse: LiaisonDossier) => {
      setLiaison(reponse);
      setErreur(null);
      onSituation?.(reponse.role === "deces" && reponse.active ? reponse : null);
    },
    [onSituation]
  );

  useEffect(() => {
    let annule = false;
    relectures.current = 0;
    setLiaison(null);
    appelApi<LiaisonDossier>(`/dossiers/${idDossier}/liaison`)
      .then((r) => !annule && appliquer(r))
      .catch((e: unknown) => !annule && setErreur(messageErreur(e)));
    return () => {
      annule = true;
    };
  }, [idDossier, appliquer]);

  const enAttente = liaison?.role === "deces" && liaison.situation === "en_attente";
  useEffect(() => {
    if (!enAttente || relectures.current >= RELECTURES_MAX) return;
    const minuteur = window.setTimeout(() => {
      relectures.current += 1;
      appelApi<LiaisonDossier>(`/dossiers/${idDossier}/liaison`)
        .then(appliquer)
        .catch(() => undefined);
    }, DELAI_RELECTURE_MS);
    return () => window.clearTimeout(minuteur);
  }, [enAttente, liaison, idDossier, appliquer]);

  async function agir(chemin: string, corps: Record<string, unknown> | undefined, succes?: string) {
    setOccupe(true);
    try {
      const reponse = await appelApi<LiaisonDossier>(`/dossiers/${idDossier}/liaison/${chemin}`, {
        methode: "POST",
        corps
      });
      appliquer(reponse);
      if (succes) toast.succes(succes);
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  async function annulerLiaison(candidat: CandidatLiaison) {
    const ok = await confirmer({
      titre: "Annuler la liaison ?",
      description:
        "La naissance ne sera plus marquée comme décédée. La mairie de naissance n'est pas prévenue de cette annulation.",
      libelleConfirmer: "Annuler la liaison",
      dangereux: true
    });
    if (ok) await agir("annuler", { liaison_id: candidat.id }, "Liaison annulée.");
  }

  if (erreur) return null; // fonction d'aide : une panne ne doit jamais gêner le dossier
  if (!liaison || !liaison.active) return null;

  // ---- Naissance : décès lié ----------------------------------------------------------------------
  if (liaison.role === "naissance") {
    const d = liaison.deces;
    if (!d) return null;
    return (
      <Alerte variante="info" titre="Personne décédée">
        Décès enregistré{d.date_evenement ? ` le ${formaterDate(d.date_evenement)}` : ""} par {d.mairie} ({libelleActe(d)}).{" "}
        {lienDossier(basePath, d, "Voir le dossier de décès")}
      </Alerte>
    );
  }

  // ---- Décès --------------------------------------------------------------------------------------
  const l = liaison;
  const relancer = (
    <Bouton variante="secondaire" taille="petit" onClick={() => agir("recalculer", undefined)} chargement={occupe} iconeGauche={<Search size={14} />}>
      Relancer la recherche
    </Bouton>
  );

  if (l.situation === "confirmee" && l.confirmee) {
    const n = l.confirmee.naissance;
    return (
      <Alerte
        variante="succes"
        titre="Naissance retrouvée et liée"
        actions={
          peutDecider ? (
            <Bouton variante="secondaire" taille="petit" onClick={() => annulerLiaison(l.confirmee as CandidatLiaison)} disabled={occupe} iconeGauche={<Unlink size={14} />}>
              Annuler la liaison
            </Bouton>
          ) : undefined
        }
      >
        {n.nom || "Personne"}
        {n.naissance ? `, né(e) le ${n.naissance}` : ""} ({n.mairie}, {libelleActe(n)}) - correspondance à {l.confirmee.score} %.{" "}
        {lienDossier(basePath, n, "Voir le dossier de naissance")}
      </Alerte>
    );
  }

  if (l.situation === "incomplet") {
    return (
      <Alerte variante={l.avertissement ? "avertissement" : "info"} titre="Recherche de la naissance en attente">
        {l.manquants.length > 0
          ? `Renseignez ${l.manquants.join(", ").toLowerCase()} pour lancer la recherche de la naissance.`
          : l.message}
      </Alerte>
    );
  }

  if (l.situation === "en_attente") {
    return (
      <Alerte variante="info" titre="Recherche de la naissance en cours" icone={<Spinner />}>
        La recherche se fait en arrière-plan, la réponse s'affichera ici dans quelques secondes.
      </Alerte>
    );
  }

  if (l.situation === "propositions") {
    return (
      <Carte
        titre="Naissances correspondantes"
        description="Vérifiez qu'il s'agit bien de la même personne avant de confirmer. La confirmation marque la naissance comme décédée et prévient sa mairie."
      >
        <div className="eva-dd-liaison">
          {l.avertissement && <Alerte variante="avertissement">{l.avertissement}</Alerte>}
          <ul className="eva-dd-liaison__liste">
            {l.candidats.map((c) => (
              <CarteCandidat
                key={c.id}
                candidat={c}
                basePath={basePath}
                peutDecider={peutDecider}
                occupe={occupe}
                onConfirmer={() => agir("confirmer", { liaison_id: c.id }, "Naissance liée au décès.")}
                onRejeter={() => agir("rejeter", { liaison_id: c.id })}
              />
            ))}
          </ul>
          {peutDecider && (
            <div className="eva-dd-liaison__actions">
              <Bouton variante="secondaire" onClick={() => agir("aucune", undefined, "Noté : aucune naissance correspondante.")} disabled={occupe} iconeGauche={<HeartOff size={16} />}>
                Aucune ne correspond
              </Bouton>
              {relancer}
            </div>
          )}
        </div>
      </Carte>
    );
  }

  // introuvable / aucune_declaree
  const bloquant = l.niveau_blocage === "bloquant";
  return (
    <Alerte
      variante={l.avertissement || bloquant ? "avertissement" : "info"}
      titre="Naissance non retrouvée"
      actions={peutDecider ? relancer : undefined}
    >
      {l.situation === "aucune_declaree"
        ? "Aucune naissance correspondante n'a été retrouvée (vous avez indiqué qu'aucune proposition ne convenait)."
        : "Aucune naissance correspondante n'a été retrouvée pour cette personne."}
      {bloquant && l.moment === "complet" && " Le dossier ne pourra pas être marqué comme complet tant qu'une naissance n'est pas liée."}
      {bloquant && l.moment === "emission" && " L'acte ne pourra pas être émis tant qu'une naissance n'est pas liée."}
    </Alerte>
  );
}
