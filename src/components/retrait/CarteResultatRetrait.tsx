import { ArrowRight, Baby, CheckCircle2, Flower2, PackageCheck } from "lucide-react";
import { Bouton, Carte, LienBouton } from "../ui";
import BadgeRetrait from "./BadgeRetrait";
import { dateHeureRetrait } from "../../lib/retrait";
import type { CodeRetraitTrouve } from "../../types/domaine";
import "../../styles/retrait.css";

interface ProprietesCarteResultatRetrait {
  resultat: CodeRetraitTrouve;
  /** Recherche directe (sans code SMS) : la carte met en évidence ce que l'agent doit comparer physiquement. */
  verificationPhysique: boolean;
  /** Le retrait demande le serveur : le bouton est grisé hors ligne. */
  enLigne: boolean;
  onRemettre: (resultat: CodeRetraitTrouve) => void;
}

function formaterDate(valeur: string | undefined): string {
  if (!valeur) return "Non renseignée";
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
}

/** Un acte retrouvé par numéro de téléphone : informations à vérifier en évidence, badge de retrait, actions. */
export default function CarteResultatRetrait({ resultat: r, verificationPhysique, enLigne, onRemettre }: ProprietesCarteResultatRetrait) {
  const naissance = r.event_type !== "deces";
  const libelleNom = naissance ? "Enfant" : "Défunt(e)";
  const peutRemettre = r.etat_retrait === "a_retirer";

  return (
    <Carte className={`eva-rt-carte${r.etat_retrait === "retire" ? " eva-rt-carte--retire" : ""}`}>
      <div className="eva-rt-carte__entete">
        <span className="eva-rt-carte__icone" aria-hidden="true">
          {naissance ? <Baby size={22} /> : <Flower2 size={22} />}
        </span>
        <div className="eva-rt-carte__titre">
          <span className="eva-rt-carte__type">Acte de {naissance ? "naissance" : "décès"}</span>
          <span className="texte-mono eva-texte-petit eva-texte-discret">Code {r.code}</span>
        </div>
        <BadgeRetrait etat={r.etat_retrait} retireLe={r.retire_le} />
      </div>

      <section className="eva-rt-verifier" aria-label={verificationPhysique ? "Informations à comparer avec la personne" : "Informations du dossier"}>
        <h3 className="eva-rt-verifier__titre">{verificationPhysique ? "À comparer avec la personne" : "Informations du dossier"}</h3>
        <ul className="eva-rt-checklist">
          <li>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span className="eva-rt-checklist__libelle">Nom du déclarant</span>
            <strong className="eva-rt-checklist__valeur">{r.declarant_nom || "Non renseigné"}</strong>
          </li>
          <li>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span className="eva-rt-checklist__libelle">Numéro donné à la déclaration</span>
            <strong className="eva-rt-checklist__valeur texte-mono">{r.declarant_telephone || "-"}</strong>
          </li>
          <li>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span className="eva-rt-checklist__libelle">{libelleNom} concerné(e)</span>
            <strong className="eva-rt-checklist__valeur">{r.dossier_nom || "Non renseigné"}</strong>
          </li>
        </ul>
      </section>

      <dl className="eva-rt-carte__details">
        <div>
          <dt>Déclaré le</dt>
          <dd>{formaterDate(r.date_declaration)}</dd>
        </div>
        {r.statut_dossier_libelle && (
          <div>
            <dt>Statut du dossier</dt>
            <dd>{r.statut_dossier_libelle}</dd>
          </div>
        )}
        {r.mairie_nom && (
          <div>
            <dt>Centre d'état civil</dt>
            <dd>{r.mairie_nom}</dd>
          </div>
        )}
      </dl>

      {r.etat_retrait === "retire" && (
        <p className="eva-rt-carte__note">
          Remis le {dateHeureRetrait(r.retire_le)}
          {r.retire_par_nom ? ` par ${r.retire_par_nom}` : ""}
          {r.retire_nom_receveur ? ` à ${r.retire_nom_receveur}` : ""}. Il ne peut pas être remis une seconde fois.
        </p>
      )}
      {r.etat_retrait === "non_emis" && (
        <p className="eva-rt-carte__note">L'acte n'est pas encore émis : il n'y a rien à remettre pour le moment.</p>
      )}

      <div className="eva-groupe-boutons eva-rt-carte__actions">
        {peutRemettre && (
          <Bouton
            onClick={() => onRemettre(r)}
            disabled={!enLigne}
            title={enLigne ? undefined : "Le retrait nécessite une connexion"}
            iconeGauche={<PackageCheck size={16} />}
          >
            Remettre l'acte
          </Bouton>
        )}
        <LienBouton to={`/agent/dossiers/${r.dossier_id}`} variante="secondaire" iconeDroite={<ArrowRight size={16} />}>
          Ouvrir le dossier
        </LienBouton>
      </div>
    </Carte>
  );
}
