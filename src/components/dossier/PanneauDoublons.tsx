import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Baby, ChevronDown, ChevronUp, Copy, RotateCcw, Search, UserX, Users } from "lucide-react";
import { Alerte, Badge, Bouton, Carte, Spinner } from "../ui";
import { useConfirmation } from "../ui/ConfirmationProvider";
import { useToast } from "../ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { formaterDate } from "./utilitaires";
import type { DoublonSuspect, DoublonsDossier, ResumeDossierDoublon } from "../../types/domaine";
import "../../styles/dossier.css";

const DELAI_RELECTURE_MS = 3000;
const RELECTURES_MAX = 10;

interface ProprietesPanneauDoublons {
  idDossier: string;
  basePath: string;
  peutDecider: boolean;
  /** Change à chaque enregistrement du dossier : relance la lecture (le calcul se refait en arrière-plan). */
  version: number;
  /** Remonte l'état au parent (avertissement avant « complet » / « émission », dossier en double). */
  onEtat?: (etat: DoublonsDossier | null) => void;
}

function messageErreur(e: unknown): string {
  return e instanceof ErreurApi || e instanceof Error ? e.message : "Erreur inattendue.";
}

function identite(r: ResumeDossierDoublon): string {
  const morceaux = [r.naissance ? `né(e) le ${r.naissance}` : r.date_evenement ? `évènement du ${formaterDate(r.date_evenement)}` : ""];
  if (r.mere) morceaux.push(`mère : ${r.mere}`);
  return morceaux.filter(Boolean).join(" - ");
}

function provenance(r: ResumeDossierDoublon): string {
  const lieu = r.formation_sanitaire ? `${r.formation_sanitaire} → ${r.mairie}` : r.mairie;
  const acte = r.numero_acte ? `, acte n° ${r.numero_acte}${r.annee_registre ? ` / ${r.annee_registre}` : ""}` : "";
  return `${lieu} - ${r.statut_libelle}${acte}`;
}

function LienAutre({ basePath, r }: { basePath: string; r: ResumeDossierDoublon }) {
  return r.consultable ? (
    <Link className="eva-lien" to={`${basePath}/dossiers/${r.dossier_id}`}>
      Voir le dossier n° {r.identifiant.slice(0, 8)}
    </Link>
  ) : (
    <span className="eva-dd-liaison__neutre">Dossier n° {r.identifiant.slice(0, 8)} suivi par {r.mairie} (consultation réservée à cette mairie)</span>
  );
}

function CarteSuspect({
  suspect,
  basePath,
  peutDecider,
  occupe,
  onConfirmer,
  onEcarter,
  onAnnuler
}: {
  suspect: DoublonSuspect;
  basePath: string;
  peutDecider: boolean;
  occupe: boolean;
  onConfirmer: (doublon: "ce_dossier" | "autre") => void;
  onEcarter: () => void;
  onAnnuler: () => void;
}) {
  const [detailOuvert, setDetailOuvert] = useState(false);
  const a = suspect.autre;
  const tranche = suspect.statut !== "propose";
  return (
    <li className="eva-dd-liaison__candidat">
      <div className="eva-dd-liaison__entete">
        <div className="eva-dd-liaison__identite">
          <span className="eva-dd-liaison__nom">{a.nom || "Nom non renseigné"}</span>
          <span className="eva-dd-liaison__meta">{identite(a) || "Date inconnue"}</span>
          <span className="eva-dd-liaison__meta">{provenance(a)}</span>
          <span className="eva-dd-liaison__meta">
            <LienAutre basePath={basePath} r={a} />
          </span>
          {suspect.motif === "multiple_excedentaire" && (
            <span className="eva-dd-liaison__meta">
              <Badge variante="attente">Naissance multiple : un dossier de trop</Badge>
            </span>
          )}
        </div>
        <div className="eva-dd-liaison__score">
          <span className="eva-dd-liaison__score-valeur">{suspect.score} %</span>
          <span
            className={`eva-dd-liaison__jauge${suspect.forte ? " eva-dd-liaison__jauge--forte" : ""}`}
            role="img"
            aria-label={`Ressemblance : ${suspect.score} %`}
          >
            <span style={{ width: `${suspect.score}%` }} />
          </span>
          {tranche ? (
            <Badge variante={suspect.statut === "confirme" ? "danger" : "neutre"}>{suspect.statut_libelle}</Badge>
          ) : (
            <Badge variante={suspect.forte ? "danger" : "attente"}>{suspect.forte ? "Doublon probable" : "À vérifier"}</Badge>
          )}
        </div>
      </div>

      {suspect.statut === "confirme" && (
        <p className="eva-dd-liaison__meta">
          {suspect.ce_dossier_est_le_doublon
            ? "Ce dossier est le doublon : il ne recevra pas d'acte."
            : "L'autre dossier est le doublon : ce dossier-ci est conservé."}
          {suspect.decide_par ? ` Décision de ${suspect.decide_par}` : ""}
          {suspect.decide_le ? ` le ${formaterDate(suspect.decide_le)}.` : ""}
        </p>
      )}

      <div className="eva-dd-liaison__actions">
        {peutDecider && !tranche && (
          <>
            <Bouton onClick={() => onConfirmer("ce_dossier")} disabled={occupe} iconeGauche={<Copy size={16} />}>
              Ce dossier est le doublon
            </Bouton>
            <Bouton variante="secondaire" onClick={() => onConfirmer("autre")} disabled={occupe}>
              L'autre est le doublon
            </Bouton>
            <Bouton variante="secondaire" onClick={onEcarter} disabled={occupe} iconeGauche={<UserX size={16} />}>
              Personnes différentes
            </Bouton>
          </>
        )}
        {peutDecider && tranche && (
          <Bouton variante="fantome" onClick={onAnnuler} disabled={occupe} iconeGauche={<RotateCcw size={16} />}>
            Annuler la décision
          </Bouton>
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
            <caption className="eva-sr-only">Comparaison critère par critère</caption>
            <thead>
              <tr>
                <th scope="col">Critère</th>
                <th scope="col">Ce dossier</th>
                <th scope="col">L'autre dossier</th>
                <th scope="col">Concordance</th>
              </tr>
            </thead>
            <tbody>
              {suspect.detail.map((c) => (
                <tr key={c.code}>
                  <th scope="row">{c.libelle}</th>
                  <td>{c.valeur_ce_dossier || "-"}</td>
                  <td>{c.valeur_autre || "-"}</td>
                  <td>
                    {c.score === null ? (
                      <span className="eva-dd-liaison__neutre">
                        {c.statut === "absent_ce_dossier" ? "Non renseigné ici" : "Non renseigné dans l'autre"}
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
 * Doublons possibles d'un dossier (apps.dedoublonnage) : dossiers de la même zone qui pourraient désigner la même
 * personne, et enfants d'une même naissance multiple. Rien n'est fusionné : l'agent tranche. N'affiche rien tant que
 * la fonction est désactivée (réglage par défaut) ou sans information utile.
 */
export default function PanneauDoublons({ idDossier, basePath, peutDecider, version, onEtat }: ProprietesPanneauDoublons) {
  const toast = useToast();
  const confirmer = useConfirmation();
  const [etat, setEtat] = useState<DoublonsDossier | null>(null);
  const [erreur, setErreur] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const relectures = useRef(0);

  const appliquer = useCallback(
    (reponse: DoublonsDossier) => {
      setEtat(reponse);
      setErreur(false);
      onEtat?.(reponse.active ? reponse : null);
    },
    [onEtat]
  );

  useEffect(() => {
    let annule = false;
    relectures.current = 0;
    appelApi<DoublonsDossier>(`/dossiers/${idDossier}/doublons`)
      .then((r) => !annule && appliquer(r))
      .catch(() => !annule && setErreur(true));
    return () => {
      annule = true;
    };
  }, [idDossier, version, appliquer]);

  useEffect(() => {
    if (!etat?.calcul_en_attente || relectures.current >= RELECTURES_MAX) return;
    const minuteur = window.setTimeout(() => {
      relectures.current += 1;
      appelApi<DoublonsDossier>(`/dossiers/${idDossier}/doublons`).then(appliquer).catch(() => undefined);
    }, DELAI_RELECTURE_MS);
    return () => window.clearTimeout(minuteur);
  }, [etat, idDossier, appliquer]);

  async function agir(chemin: string, corps?: Record<string, unknown>, succes?: string) {
    setOccupe(true);
    try {
      appliquer(await appelApi<DoublonsDossier>(`/dossiers/${idDossier}/${chemin}`, { methode: "POST", corps }));
      if (succes) toast.succes(succes);
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  async function confirmerDoublon(s: DoublonSuspect, doublon: "ce_dossier" | "autre") {
    const ok = await confirmer({
      titre: doublon === "ce_dossier" ? "Ce dossier est-il le doublon ?" : "L'autre dossier est-il le doublon ?",
      description:
        doublon === "ce_dossier"
          ? "Ce dossier ne pourra plus recevoir d'acte. Vous pourrez ensuite le classer sans suite."
          : `Le dossier suivi par ${s.autre.mairie} ne pourra plus recevoir d'acte. Ce dossier-ci est conservé.`,
      libelleConfirmer: "Confirmer le doublon",
      dangereux: true
    });
    if (ok) await agir(`doublons/${s.id}/confirmer`, { doublon }, "Doublon confirmé.");
  }

  async function retirerDeLaNaissanceMultiple() {
    const ok = await confirmer({
      titre: "Ce dossier ne fait pas partie de cette naissance multiple ?",
      description: "Il ne sera plus relié aux autres enfants et sera comparé normalement aux autres dossiers.",
      libelleConfirmer: "Retirer de la naissance multiple"
    });
    if (ok) await agir("naissance-multiple/retirer", undefined, "Dossier retiré de la naissance multiple.");
  }

  if (erreur || !etat || !etat.active) return null;
  const aTrancher = etat.suspects.filter((s) => s.statut === "propose");
  const tranches = etat.suspects.filter((s) => s.statut !== "propose");
  const multiple = etat.naissance_multiple;
  if (!aTrancher.length && !tranches.length && !multiple && !etat.calcul_en_attente) return null;

  return (
    <div className="eva-dd-liaison">
      {etat.en_double && (
        <Alerte variante="erreur" titre="Dossier confirmé en double">
          Ce dossier a été confirmé comme doublon d'un autre dossier : aucun acte ne peut être émis. Classez-le sans suite, ou
          annulez la décision si elle est erronée.
        </Alerte>
      )}

      {multiple && (
        <Alerte
          variante={multiple.excedent ? "avertissement" : "info"}
          titre={
            multiple.nombre_attendu >= 2
              ? `Naissance multiple : ${multiple.nombre_dossiers} dossier(s) pour ${multiple.nombre_attendu} enfant(s)`
              : "Naissance multiple"
          }
          icone={<Baby size={18} />}
          actions={
            peutDecider ? (
              <Bouton variante="secondaire" taille="petit" onClick={retirerDeLaNaissanceMultiple} disabled={occupe}>
                Ne fait pas partie de cette naissance
              </Bouton>
            ) : undefined
          }
        >
          Relié à :{" "}
          {multiple.freres.map((f, i) => (
            <span key={f.dossier_id}>
              {i > 0 && ", "}
              {f.nom || "enfant sans nom"} ({f.mairie}){" "}
              {f.consultable && (
                <Link className="eva-lien" to={`${basePath}/dossiers/${f.dossier_id}`}>
                  voir
                </Link>
              )}
            </span>
          ))}
          .{multiple.excedent && " Il y a plus de dossiers que d'enfants : un dossier est probablement en double (voir ci-dessous)."}
        </Alerte>
      )}

      {etat.calcul_en_attente && !aTrancher.length && (
        <Alerte variante="info" titre="Recherche de doublons en cours" icone={<Spinner />}>
          La comparaison avec les dossiers de la zone se fait en arrière-plan.
        </Alerte>
      )}

      {(aTrancher.length > 0 || tranches.length > 0) && (
        <Carte
          titre={aTrancher.length ? `Doublons possibles (${aTrancher.length} à vérifier)` : "Doublons tranchés"}
          description="Dossiers de la même zone qui pourraient désigner la même personne. Vérifiez avant de trancher : rien n'est fusionné automatiquement."
        >
          {etat.avertissement && <Alerte variante="avertissement">{etat.avertissement}</Alerte>}
          <ul className="eva-dd-liaison__liste">
            {[...aTrancher, ...tranches].map((s) => (
              <CarteSuspect
                key={s.id}
                suspect={s}
                basePath={basePath}
                peutDecider={peutDecider}
                occupe={occupe}
                onConfirmer={(doublon) => confirmerDoublon(s, doublon)}
                onEcarter={() => agir(`doublons/${s.id}/ecarter`, undefined, "Noté : personnes différentes.")}
                onAnnuler={() => agir(`doublons/${s.id}/annuler`, undefined, "Décision annulée.")}
              />
            ))}
          </ul>
          {peutDecider && (
            <div className="eva-dd-liaison__actions">
              <Bouton variante="fantome" taille="petit" onClick={() => agir("doublons/recalculer")} chargement={occupe} iconeGauche={<Search size={14} />}>
                Relancer la recherche
              </Bouton>
              {etat.ecartes > 0 && (
                <span className="eva-dd-liaison__neutre">
                  <Users size={14} aria-hidden="true" /> {etat.ecartes} paire(s) écartée(s) (personnes différentes)
                </span>
              )}
            </div>
          )}
        </Carte>
      )}
    </div>
  );
}
