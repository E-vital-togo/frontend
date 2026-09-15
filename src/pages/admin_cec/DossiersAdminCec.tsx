import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { Bouton, Champ, ChargementPage, EnteteDePage, EtatVide, Pagination, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi } from "../../lib/apiClient";
import { telechargerBlob } from "../../lib/telechargerBlob";
import { LIENS_ADMIN_CEC } from "./navigation";
import {
  listeDepuis,
  type Dossier,
  type ListeOuPaginee,
  type Mairie,
  type ReponsePaginee,
  type StatutDossier,
  type TypeEvenement
} from "../../types/domaine";

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

export default function DossiersAdminCec() {
  const [dossiers, setDossiers] = useState<ReponsePaginee<Dossier> | null>(null);
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [statutFiltre, setStatutFiltre] = useState<StatutDossier | "">("");
  const [evenementFiltre, setEvenementFiltre] = useState<TypeEvenement | "">("");
  const [mairieFiltre, setMairieFiltre] = useState("");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

  function construireParametres(): URLSearchParams {
    const parametres = new URLSearchParams();
    if (statutFiltre) parametres.set("statut", statutFiltre);
    if (evenementFiltre) parametres.set("event_type", evenementFiltre);
    if (mairieFiltre) parametres.set("mairie", mairieFiltre);
    if (recherche) parametres.set("search", recherche);
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
  }, [statutFiltre, evenementFiltre, mairieFiltre, recherche, page]);

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
  const affichageMairie = mairies.length > 1;

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Dossiers de la zone"
        sousTitre="Tous les dossiers de votre perimetre territorial"
        actions={
          <>
            <Bouton variante="secondaire" taille="petit" onClick={() => exporter("xlsx")} chargement={exportEnCours === "xlsx"} disabled={exportEnCours !== null} iconeGauche={exportEnCours !== "xlsx" && <Download size={14} />}>
              Excel
            </Bouton>
            <Bouton variante="secondaire" taille="petit" onClick={() => exporter("pdf")} chargement={exportEnCours === "pdf"} disabled={exportEnCours !== null} iconeGauche={exportEnCours !== "pdf" && <Download size={14} />}>
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
              value={recherche}
              onChange={(e) => {
                setPage(1);
                setRecherche(e.target.value);
              }}
              placeholder="Nom, identifiant..."
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
        {affichageMairie && (
          <div style={{ flex: "0 1 200px" }}>
            <Champ id="filtre-mairie" label="Mairie">
              <select
                id="filtre-mairie"
                value={mairieFiltre}
                onChange={(e) => {
                  setPage(1);
                  setMairieFiltre(e.target.value);
                }}
              >
                <option value="">Toutes</option>
                {mairies.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
        )}
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
                <th>Evenement</th>
                <th>Mairie</th>
                <th>Statut</th>
                <th>Date de declaration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resultats.map((dossier) => (
                <tr key={dossier.id}>
                  <td className="texte-mono">{dossier.id.slice(0, 8)}</td>
                  <td>{dossier.event_type === "naissance" ? "Naissance" : "Deces"}</td>
                  <td>{dossier.mairie_nom || "-"}</td>
                  <td>
                    <BadgeStatut statut={dossier.statut} />
                  </td>
                  <td className="texte-mono">{dossier.date_declaration}</td>
                  <td>
                    <LienBouton to={`/admin-cec/dossiers/${dossier.id}`} variante="fantome" taille="petit">
                      Ouvrir
                    </LienBouton>
                  </td>
                </tr>
              ))}
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
