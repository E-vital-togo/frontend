import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Fingerprint, ShieldCheck, ShieldX } from "lucide-react";
import { Alerte, Badge, Bouton, Carte, Champ } from "../ui";
import { useToast } from "../ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { formaterDate } from "./utilitaires";
import type { IdentiteNationaleDossier } from "../../types/domaine";
import "../../styles/dossier.css";

interface ProprietesPanneau {
  idDossier: string;
  version: number;
}

const ROLES = [
  { valeur: "mere", libelle: "Mère" },
  { valeur: "pere", libelle: "Père" },
  { valeur: "declarant", libelle: "Déclarant" }
];

function libelleSource(source: string | null): string {
  if (source === "mosip") return "attribué par l'ANID";
  if (source === "liaison") return "repris de la naissance liée";
  if (source === "saisie") return "saisi dans le dossier";
  return "";
}

/**
 * Identité nationale de la personne du dossier (apps.interop, MOSIP / ANID) : NIU, échanges avec l'ANID, et
 * vérification du NIU d'un déclarant (authentification démographique IDA). N'affiche rien tant que l'intégration est
 * désactivée (réglage par défaut).
 */
export default function PanneauIdentiteNationale({ idDossier, version }: ProprietesPanneau) {
  const toast = useToast();
  const [etat, setEtat] = useState<IdentiteNationaleDossier | null>(null);
  const [niuVisible, setNiuVisible] = useState(false);
  const [formulaire, setFormulaire] = useState({ role: "mere", niu: "", nom: "", date_naissance: "", sexe: "" });
  const [verification, setVerification] = useState<{ resultat: boolean; niu: string; erreur: string } | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let annule = false;
    appelApi<IdentiteNationaleDossier>(`/dossiers/${idDossier}/identite-nationale`)
      .then((r) => !annule && setEtat(r))
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [idDossier, version]);

  async function verifier(e: FormEvent) {
    e.preventDefault();
    setOccupe(true);
    setVerification(null);
    try {
      setVerification(await appelApi(`/identite/verifier`, { methode: "POST", corps: { ...formulaire, dossier_id: idDossier } }));
    } catch (err) {
      toast.erreur(err instanceof ErreurApi || err instanceof Error ? err.message : "Vérification impossible.");
    } finally {
      setOccupe(false);
    }
  }

  if (!etat || !etat.actif) return null;
  const dernier = etat.echanges[0];
  const enDifficulte = dernier && ["echec", "abandonne", "attente_niu"].includes(dernier.statut);

  return (
    <Carte titre="Identité nationale" description="Lien entre ce dossier et l'identité nationale (ANID).">
      <div className="eva-dd-liaison">
        {etat.niu ? (
          <div className="eva-dd-liaison__entete">
            <div className="eva-dd-liaison__identite">
              <span className="eva-dd-liaison__nom">
                <Fingerprint size={16} aria-hidden="true" /> NIU {niuVisible ? etat.niu : `•••••• ${etat.niu.slice(-4)}`}
              </span>
              <span className="eva-dd-liaison__meta">{libelleSource(etat.source)}</span>
            </div>
            <div className="eva-dd-liaison__score">
              {etat.desactivee ? <Badge variante="neutre">Identité désactivée (décès)</Badge> : <Badge variante="succes">Identité active</Badge>}
              <Bouton variante="fantome" taille="petit" onClick={() => setNiuVisible((v) => !v)} iconeGauche={niuVisible ? <EyeOff size={14} /> : <Eye size={14} />}>
                {niuVisible ? "Masquer" : "Afficher"}
              </Bouton>
            </div>
          </div>
        ) : (
          <span className="eva-dd-liaison__neutre">Aucun NIU connu pour la personne de ce dossier.</span>
        )}

        {dernier && (
          <Alerte variante={enDifficulte ? "avertissement" : dernier.statut === "termine" ? "succes" : "info"} compacte titre={`${dernier.processus_libelle} : ${dernier.statut_libelle}`}>
            Demandé le {formaterDate(dernier.cree_le)}
            {dernier.termine_le ? `, terminé le ${formaterDate(dernier.termine_le)}` : ""}.{dernier.erreur ? ` ${dernier.erreur}` : ""}
          </Alerte>
        )}

        {etat.verification_disponible && (
          <form onSubmit={verifier} className="eva-dd-liaison__detail">
            <p className="eva-dd-liaison__meta">Vérifier le NIU d'un déclarant auprès de l'ANID (nom, date de naissance et sexe doivent correspondre).</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              <Champ id="idn-role" label="Personne">
                <select id="idn-role" value={formulaire.role} onChange={(e) => setFormulaire({ ...formulaire, role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r.valeur} value={r.valeur}>
                      {r.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ id="idn-niu" label="NIU" requis>
                <input id="idn-niu" inputMode="numeric" autoComplete="off" value={formulaire.niu} onChange={(e) => setFormulaire({ ...formulaire, niu: e.target.value })} required />
              </Champ>
              <Champ id="idn-nom" label="Nom et prénoms" requis>
                <input id="idn-nom" value={formulaire.nom} onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} required />
              </Champ>
              <Champ id="idn-date" label="Date de naissance">
                <input id="idn-date" type="date" value={formulaire.date_naissance} onChange={(e) => setFormulaire({ ...formulaire, date_naissance: e.target.value })} />
              </Champ>
              <Champ id="idn-sexe" label="Sexe">
                <select id="idn-sexe" value={formulaire.sexe} onChange={(e) => setFormulaire({ ...formulaire, sexe: e.target.value })}>
                  <option value="">-</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </Champ>
            </div>
            <div className="eva-dd-liaison__actions">
              <Bouton type="submit" variante="secondaire" chargement={occupe}>
                Vérifier auprès de l'ANID
              </Bouton>
            </div>
            {verification && (
              <Alerte
                variante={verification.resultat ? "succes" : "avertissement"}
                icone={verification.resultat ? <ShieldCheck size={18} aria-hidden="true" /> : <ShieldX size={18} aria-hidden="true" />}
                titre={verification.resultat ? "Identité confirmée par l'ANID" : "Identité non confirmée"}
              >
                NIU {verification.niu}.{" "}
                {verification.resultat ? "" : verification.erreur || "Les informations saisies ne correspondent pas à l'identité enregistrée."}
              </Alerte>
            )}
          </form>
        )}
      </div>
    </Carte>
  );
}
