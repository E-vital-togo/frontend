import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import { Bouton, Carte, Champ, ChargementPage, EnteteDePage } from "../../components/ui";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type ListeOuPaginee, type NumerosActeProposes, type SignataireMairie } from "../../types/domaine";

type ChampNumerique = keyof NumerosActeProposes;

export default function EmissionActe() {
  const { idDossier } = useParams<{ idDossier: string }>();
  const navigate = useNavigate();
  const confirmer = useConfirmation();
  const [numeros, setNumeros] = useState<NumerosActeProposes | null>(null);
  const [signataires, setSignataires] = useState<SignataireMairie[]>([]);
  const [signataireId, setSignataireId] = useState("");
  const [dateEtablissement, setDateEtablissement] = useState(new Date().toISOString().slice(0, 10));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!idDossier) return;
    appelApi<NumerosActeProposes>(`/dossiers/${idDossier}/acte/numeros-proposes`)
      .then(setNumeros)
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Erreur"));
  }, [idDossier]);

  useEffect(() => {
    appelApi<ListeOuPaginee<SignataireMairie>>("/signataires/?actif=true")
      .then((donnees) => {
        const liste = listeDepuis(donnees);
        setSignataires(liste);
        if (liste.length > 0) setSignataireId(liste[0].id);
      })
      .catch(() => setSignataires([]));
  }, []);

  function modifierNumero(champ: ChampNumerique, valeur: string) {
    setNumeros((precedent) => (precedent ? { ...precedent, [champ]: Number(valeur) } : precedent));
  }

  async function emettre() {
    if (!idDossier || !numeros || !signataireId) return;

    const confirme = await confirmer({
      titre: "Emettre cet acte ?",
      description: "Une fois emis, l'acte ne pourra plus etre corrige directement : toute erreur passera par une demande de modification validee par un administrateur.",
      libelleConfirmer: "Emettre l'acte"
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
      setErreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnCours(false);
    }
  }

  if (!numeros) {
    return (
      <MiseEnPage liens={LIENS_AGENT}>
        {erreur ? <div className="message-erreur">{erreur}</div> : <ChargementPage texte="Preparation de la numerotation..." />}
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Emission de l'acte"
        sousTitre="Les numeros sont proposes automatiquement, en sequence pour votre mairie et l'annee en cours. Ils restent modifiables avant validation finale."
      />
      {erreur && <div className="message-erreur">{erreur}</div>}
      <Carte style={{ maxWidth: 480 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            emettre();
          }}
        >
          <div className="eva-grille-2" style={{ gap: 14 }}>
            <Champ id="numero-registre" label="Numero de registre">
              <input id="numero-registre" type="number" className="texte-mono" value={numeros.numero_registre} onChange={(e) => modifierNumero("numero_registre", e.target.value)} />
            </Champ>
            <Champ id="numero-feuillet" label="Numero de feuillet">
              <input id="numero-feuillet" type="number" className="texte-mono" value={numeros.numero_feuillet} onChange={(e) => modifierNumero("numero_feuillet", e.target.value)} />
            </Champ>
            <Champ id="numero-acte" label="Numero d'acte">
              <input id="numero-acte" type="number" className="texte-mono" value={numeros.numero_acte} onChange={(e) => modifierNumero("numero_acte", e.target.value)} />
            </Champ>
            <Champ id="annee-registre" label="Annee du registre">
              <input id="annee-registre" type="number" className="texte-mono" value={numeros.annee_registre} onChange={(e) => modifierNumero("annee_registre", e.target.value)} />
            </Champ>
          </div>
          <Champ
            id="signataire"
            label="Signataire"
            requis
            aide={
              signataires.length === 0
                ? "Aucun signataire actif pour votre mairie : demandez a votre administrateur CEC d'en ajouter un (Personnalisation > Signataires)."
                : undefined
            }
          >
            <select id="signataire" required value={signataireId} onChange={(e) => setSignataireId(e.target.value)}>
              {signataires.length === 0 && <option value="">Aucun signataire disponible</option>}
              {signataires.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom} {s.prenom} ({s.fonction})
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="date-etablissement" label="Date d'etablissement" requis>
            <input id="date-etablissement" type="date" required value={dateEtablissement} onChange={(e) => setDateEtablissement(e.target.value)} />
          </Champ>
          <Bouton type="submit" variante="accent" chargement={enCours} disabled={!signataireId}>
            Emettre l'acte
          </Bouton>
        </form>
      </Carte>
    </MiseEnPage>
  );
}
