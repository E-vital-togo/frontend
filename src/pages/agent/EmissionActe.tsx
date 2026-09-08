import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import { useToast } from "../../context/ToastContext";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import type { NumerosActeProposes } from "../../types/domaine";

type ChampNumerique = keyof NumerosActeProposes;

export default function EmissionActe() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const navigate = useNavigate();
  const [numeros, setNumeros] = useState<NumerosActeProposes | null>(null);
  const [nomSignataire, setNomSignataire] = useState("");
  const [qualiteSignataire, setQualiteSignataire] = useState("");
  const [dateEtablissement, setDateEtablissement] = useState(new Date().toISOString().slice(0, 10));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { notifier } = useToast();

  useEffect(() => {
    if (!idDossier) return;
    appelApi<NumerosActeProposes>(`/dossiers/${idDossier}/acte/numeros-proposes`)
      .then(setNumeros)
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Erreur"));
  }, [idDossier]);

  function modifierNumero(champ: ChampNumerique, valeur: string) {
    setNumeros((precedent) => (precedent ? { ...precedent, [champ]: Number(valeur) } : precedent));
  }

  async function emettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!idDossier || !numeros) return;
    setEnCours(true);
    try {
      await appelApi(`/dossiers/${idDossier}/acte/emettre`, {
        methode: "POST",
        corps: {
          ...numeros,
          nom_signataire: nomSignataire,
          qualite_signataire: qualiteSignataire,
          date_etablissement: dateEtablissement
        }
      });
      notifier("Acte emis avec succes.", "succes");
      navigate(`/agent/dossiers/${idDossier}/acte-pdf`);
    } catch (e) {
      notifier(e instanceof ErreurApi ? e.message : "Erreur inattendue.", "erreur");
    } finally {
      setEnCours(false);
    }
  }

  if (!numeros) {
    return (
      <MiseEnPage liens={LIENS_AGENT}>
        <p>{erreur ?? "Preparation de la numerotation..."}</p>
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <PageHeader
        titre="Emission de l'acte"
        description="Les numeros sont proposes automatiquement, en sequence pour votre mairie et l'annee en cours. Ils
        restent modifiables avant validation finale. Une fois emis, l'acte ne peut plus etre corrige directement :
        toute erreur passera par une demande de modification."
      />
      <form onSubmit={emettre} className="carte" style={{ maxWidth: 460 }}>
        <div className="champ">
          <label htmlFor="numero-registre">Numero de registre</label>
          <input
            id="numero-registre"
            type="number"
            className="texte-mono"
            value={numeros.numero_registre}
            onChange={(e) => modifierNumero("numero_registre", e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="numero-feuillet">Numero de feuillet</label>
          <input
            id="numero-feuillet"
            type="number"
            className="texte-mono"
            value={numeros.numero_feuillet}
            onChange={(e) => modifierNumero("numero_feuillet", e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="numero-acte">Numero d'acte</label>
          <input
            id="numero-acte"
            type="number"
            className="texte-mono"
            value={numeros.numero_acte}
            onChange={(e) => modifierNumero("numero_acte", e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="annee-registre">Annee du registre</label>
          <input
            id="annee-registre"
            type="number"
            className="texte-mono"
            value={numeros.annee_registre}
            onChange={(e) => modifierNumero("annee_registre", e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="nom-signataire">Nom du signataire</label>
          <input id="nom-signataire" required value={nomSignataire} onChange={(e) => setNomSignataire(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="qualite-signataire">Qualite du signataire</label>
          <input
            id="qualite-signataire"
            required
            placeholder="Maire, adjoint..."
            value={qualiteSignataire}
            onChange={(e) => setQualiteSignataire(e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor="date-etablissement">Date d'etablissement</label>
          <input
            id="date-etablissement"
            type="date"
            required
            value={dateEtablissement}
            onChange={(e) => setDateEtablissement(e.target.value)}
          />
        </div>
        <button type="submit" className="bouton-accent" disabled={enCours}>
          {enCours ? "Emission en cours..." : "Emettre l'acte"}
        </button>
      </form>
    </MiseEnPage>
  );
}
