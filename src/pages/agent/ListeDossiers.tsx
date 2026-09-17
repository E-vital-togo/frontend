import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { Bouton, Champ, ChargementPage, EnteteDePage, EtatVide, Pagination, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi } from "../../lib/apiClient";
import { telechargerBlob } from "../../lib/telechargerBlob";
import { couleurUrgence, echeanceActive, joursRestants } from "../../lib/urgence";
import { LIENS_AGENT } from "./navigation";
import type { Dossier, ReponsePaginee, StatutDossier, TypeEvenement } from "../../types/domaine";

const STATUTS: Array<{ valeur: StatutDossier | ""; libelle: string }> = [
  { valeur: "", libelle: "Tous les statuts" },
  { valeur: "recu", libelle: "Recu" },
  { valeur: "notifie", libelle: "Notifie" },
  { valeur: "en_attente_complement", libelle: "En attente de complement" },
  { valeur: "complete", libelle: "Complete" },
  { valeur: "acte_emis", libelle: "Acte emis" },
  { valeur: "sans_suite", libelle: "Sans suite" }
];

const TAILLE_PAGE = 25;

export default function ListeDossiers() {
  const [parametresUrl] = useSearchParams();
  const evenementUrl = parametresUrl.get("event_type");
  const [dossiers, setDossiers] = useState<ReponsePaginee<Dossier> | null>(null);
  const [statutFiltre, setStatutFiltre] = useState<StatutDossier | "">("");
  const [evenementFiltre, setEvenementFiltre] = useState<TypeEvenement | "">((evenementUrl as TypeEvenement | null) || "");
  const [recherche, setRecherche] = useState("");
  const [echeanceUniquement, setEcheanceUniquement] = useState(parametresUrl.get("echeance") === "1");
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    // Le lien "Naissance"/"Deces" du sidebar ne change QUE la query string
    // (meme route /agent/dossiers) : react-router ne remonte donc pas ce
    // composant, et le useState ci-dessus (initialise une seule fois au
    // premier montage) ne suivrait jamais un second clic sans ce useEffect.
    setEvenementFiltre((evenementUrl as TypeEvenement | null) || "");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenementUrl]);

  function construireParametres(): URLSearchParams {
    const parametres = new URLSearchParams();
    if (statutFiltre) parametres.set("statut", statutFiltre);
    if (evenementFiltre) parametres.set("event_type", evenementFiltre);
    if (recherche) parametres.set("search", recherche);
    if (echeanceUniquement) parametres.set("echeance_proche", "true");
    return parametres;
  }

  useEffect(() => {
    const parametres = construireParametres();
    parametres.set("page", String(page));

    setChargement(true);
    appelApi<ReponsePaginee<Dossier>>(`/dossiers/?${parametres.toString()}`)
      .then(setDossiers)
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutFiltre, evenementFiltre, recherche, echeanceUniquement, page]);

  async function exporter(format: "xlsx" | "pdf") {
    setExportEnCours(format);
    try {
      const parametres = construireParametres();
      parametres.set("format", format);
      const blob = await appelApi<Blob>(`/dossiers/export/?${parametres.toString()}`);
      telechargerBlob(blob, `dossiers.${format}`);
    } finally {
      setExportEnCours(null);
    }
  }

  const resultats = dossiers?.results ?? [];

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Dossiers"
        sousTitre="Naissances et deces de votre mairie"
        actions={
          <>
            <Bouton
              variante="secondaire"
              taille="petit"
              onClick={() => exporter("xlsx")}
              chargement={exportEnCours === "xlsx"}
              disabled={exportEnCours !== null}
              iconeGauche={exportEnCours !== "xlsx" && <Download size={14} />}
            >
              Excel
            </Bouton>
            <Bouton
              variante="secondaire"
              taille="petit"
              onClick={() => exporter("pdf")}
              chargement={exportEnCours === "pdf"}
              disabled={exportEnCours !== null}
              iconeGauche={exportEnCours !== "pdf" && <Download size={14} />}
            >
              PDF
            </Bouton>
          </>
        }
      />

      <div className="eva-carte" style={{ marginBottom: 20, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px" }}>
          <Champ id="recherche" label="Rechercher">
            <input
              id="recherche"
              type="text"
              placeholder="Nom, identifiant, code de retrait..."
              value={recherche}
              onChange={(e) => {
                setPage(1);
                setRecherche(e.target.value);
              }}
            />
          </Champ>
        </div>
        <div style={{ flex: "0 1 200px" }}>
          <Champ id="filtre-statut" label="Statut">
            <select
              id="filtre-statut"
              value={statutFiltre}
              onChange={(e) => {
                setPage(1);
                setStatutFiltre(e.target.value as StatutDossier | "");
              }}
            >
              {STATUTS.map((s) => (
                <option key={s.valeur} value={s.valeur}>
                  {s.libelle}
                </option>
              ))}
            </select>
          </Champ>
        </div>
        <div style={{ flex: "0 1 160px" }}>
          <Champ id="filtre-evenement" label="Evenement">
            <select
              id="filtre-evenement"
              value={evenementFiltre}
              onChange={(e) => {
                setPage(1);
                setEvenementFiltre(e.target.value as TypeEvenement | "");
              }}
            >
              <option value="">Tous</option>
              <option value="naissance">Naissance</option>
              <option value="deces">Deces</option>
            </select>
          </Champ>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, paddingBottom: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={echeanceUniquement}
            onChange={(e) => {
              setPage(1);
              setEcheanceUniquement(e.target.checked);
            }}
          />
          Echeance proche uniquement
        </label>
      </div>

      {chargement ? (
        <ChargementPage />
      ) : resultats.length === 0 ? (
        <EtatVide icone={<Search size={28} />} titre="Aucun dossier ne correspond a ces criteres" />
      ) : (
        <>
          <Tableau>
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Nom</th>
                <th>Evenement</th>
                <th>Origine</th>
                <th>Statut</th>
                <th>Date de declaration</th>
                <th>Echeance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resultats.map((dossier) => {
                const jours = joursRestants(dossier.date_limite);
                return (
                  <tr key={dossier.id}>
                    <td className="texte-mono">{dossier.id.slice(0, 8)}</td>
                    <td>{dossier.nom || "-"}</td>
                    <td>{dossier.event_type === "naissance" ? "Naissance" : "Deces"}</td>
                    <td>{dossier.origine === "dhis2" ? "DHIS2" : "Manuel"}</td>
                    <td>
                      <BadgeStatut statut={dossier.statut} />
                      {dossier.a_une_nouvelle_version && (
                        <span className="eva-badge eva-badge--info" style={{ marginLeft: 6 }}>
                          Nouvelle version
                        </span>
                      )}
                    </td>
                    <td className="texte-mono">{dossier.date_declaration}</td>
                    <td>
                      {echeanceActive(dossier.statut) ? (
                        <strong className="texte-mono" style={{ color: couleurUrgence(jours) }}>
                          {jours <= 0 ? "Echue" : `${jours} j`}
                        </strong>
                      ) : (
                        <span style={{ color: "var(--couleur-gris-service-2)" }}>-</span>
                      )}
                    </td>
                    <td>
                      <LienBouton to={`/agent/dossiers/${dossier.id}`} variante="fantome" taille="petit">
                        Ouvrir
                      </LienBouton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tableau>
          {dossiers && (
            <Pagination
              page={page}
              taillepage={TAILLE_PAGE}
              total={dossiers.count}
              aSuivant={!!dossiers.next}
              aPrecedent={!!dossiers.previous}
              onChanger={setPage}
            />
          )}
        </>
      )}
    </MiseEnPage>
  );
}
