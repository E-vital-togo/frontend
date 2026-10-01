import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileSignature, ShieldAlert } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Alerte, Bouton, Carte, Champ, EnteteDePage, LienBouton, Selecteur, Squelette, useConfirmation } from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type ListeOuPaginee, type NumerosActeProposes, type SignataireMairie } from "../../types/domaine";
import "../../styles/agent.css";

type ChampNumerique = keyof NumerosActeProposes;

function formaterDate(valeur: string): string {
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("fr-FR");
}

export default function EmissionActe() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const navigate = useNavigate();
  const confirmer = useConfirmation();
  const [numeros, setNumeros] = useState<NumerosActeProposes | null>(null);
  const [signataires, setSignataires] = useState<SignataireMairie[]>([]);
  const [signatairesCharges, setSignatairesCharges] = useState(false);
  const [signataireId, setSignataireId] = useState("");
  const [dateEtablissement, setDateEtablissement] = useState(new Date().toISOString().slice(0, 10));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [relance, setRelance] = useState(0);

  useEffect(() => {
    if (!idDossier) return;
    setErreurChargement(null);
    appelApi<NumerosActeProposes>(`/dossiers/${idDossier}/acte/numeros-proposes`)
      .then(setNumeros)
      .catch((e: unknown) => setErreurChargement(e instanceof Error ? e.message : "Erreur inattendue."));
  }, [idDossier, relance]);

  useEffect(() => {
    appelApi<ListeOuPaginee<SignataireMairie>>("/signataires/?actif=true")
      .then((donnees) => {
        const liste = listeDepuis(donnees);
        setSignataires(liste);
        if (liste.length > 0) setSignataireId(liste[0].id);
      })
      .catch(() => setSignataires([]))
      .finally(() => setSignatairesCharges(true));
  }, []);

  function modifierNumero(champ: ChampNumerique, valeur: string) {
    setNumeros((precedent) => (precedent ? { ...precedent, [champ]: Number(valeur) } : precedent));
  }

  async function emettre() {
    if (!idDossier || !numeros || !signataireId) return;

    const confirme = await confirmer({
      titre: "Émettre cet acte ?",
      description:
        "Une fois émis, l'acte ne pourra plus être corrigé directement : toute erreur passera par une demande de modification validée par un administrateur.",
      libelleConfirmer: "Émettre l'acte",
      dangereux: true
    });
    if (!confirme) return;

    setEnCours(true);
    setErreur(null);
    try {
      await appelApi(`/dossiers/${idDossier}/acte/emettre`, {
        methode: "POST",
        corps: {
          ...numeros,
          signataire: signataireId,
          date_etablissement: dateEtablissement
        }
      });
      navigate(`/agent/dossiers/${idDossier}/acte-pdf`);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur inattendue est survenue. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  const filAriane = [
    { libelle: "Dossiers", vers: "/agent/dossiers" },
    { libelle: "Dossier", vers: `/agent/dossiers/${idDossier}` },
    { libelle: "Émission de l'acte" }
  ];

  if (!numeros) {
    return (
      <MiseEnPage liens={LIENS_AGENT}>
        <EnteteDePage titre="Émission de l'acte" sousTitre="Préparation de la numérotation du registre." filAriane={filAriane} />
        {erreurChargement ? (
          <Alerte
            variante="erreur"
            titre="La numérotation n'a pas pu être préparée"
            actions={
              <>
                <Bouton variante="secondaire" taille="petit" onClick={() => setRelance((n) => n + 1)}>
                  Réessayer
                </Bouton>
                <LienBouton to={`/agent/dossiers/${idDossier}`} variante="fantome" taille="petit" iconeGauche={<ArrowLeft size={14} />}>
                  Retour au dossier
                </LienBouton>
              </>
            }
          >
            {erreurChargement}
          </Alerte>
        ) : (
          <div className="eva-grille eva-grille--2-1" aria-busy="true">
            <Squelette variante="carte" libelle="Préparation de la numérotation" />
            <Squelette variante="carte" libelle="Préparation du récapitulatif" />
          </div>
        )}
      </MiseEnPage>
    );
  }

  const signataire = signataires.find((s) => s.id === signataireId);
  const aucunSignataire = signatairesCharges && signataires.length === 0;

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Émission de l'acte"
        sousTitre="Les numéros sont proposés automatiquement, en séquence pour votre centre et l'année en cours. Ils restent modifiables avant la validation finale."
        filAriane={filAriane}
      />

      {erreur && (
        <Alerte className="eva-ag-alerte-liste" variante="erreur" titre="L'acte n'a pas pu être émis" onFermer={() => setErreur(null)}>
          {erreur}
        </Alerte>
      )}

      <form
        id="formulaire-emission"
        className="eva-grille eva-grille--2-1 eva-grille--debut"
        onSubmit={(e) => {
          e.preventDefault();
          emettre();
        }}
      >
        <div className="eva-pile">
          <Carte titre="Numérotation du registre" description="Reprenez les numéros du registre papier si ceux proposés ne correspondent pas.">
            <div className="eva-grille eva-grille--2 eva-grille--serree eva-ag-numeros">
              <Champ id="numero-registre" label="Numéro de registre">
                <input id="numero-registre" type="number" className="texte-mono" value={numeros.numero_registre} onChange={(e) => modifierNumero("numero_registre", e.target.value)} />
              </Champ>
              <Champ id="numero-feuillet" label="Numéro de feuillet">
                <input id="numero-feuillet" type="number" className="texte-mono" value={numeros.numero_feuillet} onChange={(e) => modifierNumero("numero_feuillet", e.target.value)} />
              </Champ>
              <Champ id="numero-acte" label="Numéro d'acte">
                <input id="numero-acte" type="number" className="texte-mono" value={numeros.numero_acte} onChange={(e) => modifierNumero("numero_acte", e.target.value)} />
              </Champ>
              <Champ id="annee-registre" label="Année du registre">
                <input id="annee-registre" type="number" className="texte-mono" value={numeros.annee_registre} onChange={(e) => modifierNumero("annee_registre", e.target.value)} />
              </Champ>
            </div>
          </Carte>

          <Carte titre="Établissement de l'acte" description="Personne qui signe l'acte et date d'établissement.">
            {aucunSignataire && (
              <Alerte variante="avertissement" compacte titre="Aucun signataire actif">
                Demandez à votre administrateur de centre d'en ajouter un (Personnalisation, puis Signataires).
              </Alerte>
            )}
            <div className="eva-grille eva-grille--2 eva-grille--serree">
              <Champ id="signataire" label="Signataire" requis>
                <Selecteur
                  id="signataire"
                  requis
                  placeholder={signataires.length > 0 ? "Choisir un signataire" : signatairesCharges ? "Aucun signataire disponible" : "Chargement..."}
                  valeur={signataireId}
                  onChange={setSignataireId}
                >
                  {signataires.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom} {s.prenom} ({s.fonction})
                    </option>
                  ))}
                </Selecteur>
              </Champ>
              <Champ id="date-etablissement" label="Date d'établissement" requis>
                <input id="date-etablissement" type="date" required value={dateEtablissement} onChange={(e) => setDateEtablissement(e.target.value)} />
              </Champ>
            </div>
          </Carte>
        </div>

        <aside className="eva-ag-recap" aria-label="Récapitulatif avant émission">
          <Carte titre="Récapitulatif" description={idDossier ? `Dossier ${idDossier.slice(0, 8)}` : undefined}>
            <dl className="eva-definitions eva-ag-recap__liste">
              <dt>Registre</dt>
              <dd className="texte-mono">{numeros.numero_registre}</dd>
              <dt>Feuillet</dt>
              <dd className="texte-mono">{numeros.numero_feuillet}</dd>
              <dt>Acte</dt>
              <dd className="texte-mono">{numeros.numero_acte}</dd>
              <dt>Année</dt>
              <dd className="texte-mono">{numeros.annee_registre}</dd>
              <dt>Signataire</dt>
              <dd>{signataire ? `${signataire.nom} ${signataire.prenom}` : "-"}</dd>
              <dt>Établi le</dt>
              <dd>{formaterDate(dateEtablissement)}</dd>
            </dl>
          </Carte>
          <Alerte variante="avertissement" icone={<ShieldAlert size={18} aria-hidden="true" />} titre="Émission irréversible">
            Après l'émission, l'acte est verrouillé. Vérifiez les numéros et le signataire avant de continuer.
          </Alerte>
          <Bouton type="submit" variante="accent" taille="grand" pleineLargeur chargement={enCours} disabled={!signataireId} iconeGauche={<FileSignature size={18} />}>
            Émettre l'acte
          </Bouton>
          <LienBouton to={`/agent/dossiers/${idDossier}`} variante="fantome" pleineLargeur>
            Retour au dossier
          </LienBouton>
        </aside>
      </form>
    </MiseEnPage>
  );
}
