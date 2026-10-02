import type { ReactNode } from "react";
import { DatabaseZap, Lock } from "lucide-react";
import BadgeStatut from "../BadgeStatut";
import BadgeRetrait from "../retrait/BadgeRetrait";
import { Badge, EnteteDePage } from "../ui";
import { formaterDate, resumeEcheance } from "./utilitaires";
import type { Acte, Dossier } from "../../types/domaine";
import "../../styles/dossier.css";

interface ProprietesEnteteDossier {
  dossier: Dossier;
  /** "/agent" ou "/admin-cec". */
  basePath: string;
  acte: Acte | null;
  /** Données affichées depuis la copie locale (hors ligne). */
  horsLigne: boolean;
  actions: ReactNode;
}

/** En-tête du dossier : fil d'Ariane, titre, badges d'état, fiche récapitulative et actions. */
export default function EnteteDossier({ dossier, basePath, acte, horsLigne, actions }: ProprietesEnteteDossier) {
  const typeDossier = dossier.event_type === "naissance" ? "naissance" : "décès";
  const reference = dossier.id.slice(0, 8);
  const titre = dossier.nom || `Dossier de ${typeDossier}`;
  const echeance = resumeEcheance(dossier);

  return (
    <header className="eva-dd-entete">
      <EnteteDePage
        filAriane={[
          { libelle: "Dossiers", vers: `${basePath}/dossiers` },
          { libelle: dossier.nom ? `${dossier.nom} (${reference})` : `Dossier ${reference}` }
        ]}
        titre={titre}
        badges={
          <>
            <BadgeStatut statut={dossier.statut} />
            <BadgeRetrait
              etat={dossier.etat_retrait}
              retireLe={dossier.retire_le}
              retirePar={dossier.retrait?.retire_par_nom}
              detaille
              masquerNonEmis
            />
            {dossier.verrouille && (
              <Badge variante="neutre" icone={<Lock size={13} aria-hidden="true" />}>
                Verrouillé
              </Badge>
            )}
            {horsLigne && (
              <Badge variante="attente" icone={<DatabaseZap size={13} aria-hidden="true" />}>
                Copie locale
              </Badge>
            )}
          </>
        }
        sousTitre={
          <>
            Dossier de {typeDossier} <span aria-hidden="true">·</span> Référence{" "}
            <span className="texte-mono" title={dossier.id}>
              {reference}
            </span>
          </>
        }
        actions={actions}
      />

      <dl className="eva-dd-fiche">
        <div className="eva-dd-fiche__item">
          <dt>Origine</dt>
          <dd>{dossier.origine === "dhis2" ? "DHIS2 (transmis par l'hôpital)" : "Saisie manuelle"}</dd>
        </div>
        <div className="eva-dd-fiche__item">
          <dt>Centre d'état civil</dt>
          <dd>{dossier.mairie_nom || "-"}</dd>
        </div>
        <div className="eva-dd-fiche__item">
          <dt>Déclaré le</dt>
          <dd>{formaterDate(dossier.date_declaration)}</dd>
        </div>
        {dossier.date_evenement && (
          <div className="eva-dd-fiche__item">
            <dt>{dossier.event_type === "naissance" ? "Né(e) le" : "Décédé(e) le"}</dt>
            <dd>{formaterDate(dossier.date_evenement)}</dd>
          </div>
        )}
        <div className={echeance.etat === "inactive" ? "eva-dd-fiche__item" : "eva-dd-fiche__item eva-dd-fiche__item--echeance"}>
          <dt>Échéance</dt>
          <dd>
            <span className="eva-dd-fiche__echeance">
              {formaterDate(dossier.date_limite)}
              {echeance.etat !== "inactive" && (
                <Badge variante={echeance.variante} point>
                  {echeance.libelle}
                </Badge>
              )}
            </span>
          </dd>
        </div>
        {acte && (
          <div className="eva-dd-fiche__item">
            <dt>Acte</dt>
            <dd>
              <span className="texte-mono">
                n° {acte.numero_acte} / {acte.annee_registre}
              </span>
              <span className="eva-dd-fiche__precision">
                Registre {acte.numero_registre}, feuillet {acte.numero_feuillet}
              </span>
            </dd>
          </div>
        )}
      </dl>
    </header>
  );
}
