import { useEffect, useMemo, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import MiseEnPage from "../../../components/MiseEnPage";
import { Bouton, Carte, Champ, ChargementPage, EnteteDePage, EtatVide, GraphiqueECharts, LienBouton, Modale } from "../../../components/ui";
import { useConfirmation } from "../../../components/ui/ConfirmationProvider";
import { useToast } from "../../../components/ui/ToastProvider";
import { useAuth } from "../../../context/AuthContext";
import { appelApi, ErreurApi } from "../../../lib/apiClient";
import { construireOptionECharts } from "../../../lib/graphiques";
import { LIENS_ADMIN_CEC } from "../navigation";
import type { ListeOuPaginee, MesureStat, PivotResultat, TableauDeBord, WidgetGraphique } from "../../../types/domaine";
import { listeDepuis } from "../../../types/domaine";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const GrilleReactive = WidthProvider(GridLayout);

export default function TableauDeBordStats() {
  const toast = useToast();
  const confirmer = useConfirmation();

  const [tableauxDeBord, setTableauxDeBord] = useState<TableauDeBord[]>([]);
  const [idSelectionne, setIdSelectionne] = useState<string | null>(null);
  const [donneesWidgets, setDonneesWidgets] = useState<Record<string, PivotResultat>>({});
  const [mesuresDisponibles, setMesuresDisponibles] = useState<MesureStat[]>([]);
  const [chargement, setChargement] = useState(true);
  const [modaleCreation, setModaleCreation] = useState(false);
  const [nomNouveauTableau, setNomNouveauTableau] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);

  const { utilisateur } = useAuth();

  async function chargerTableauxDeBord() {
    setChargement(true);
    try {
      const [tableaux, mesures] = await Promise.all([
        appelApi<ListeOuPaginee<TableauDeBord>>("/statistiques/tableaux-de-bord/"),
        appelApi<MesureStat[]>("/statistiques/mesures")
      ]);
      const liste = listeDepuis(tableaux);
      setTableauxDeBord(liste);
      setMesuresDisponibles(mesures);
      setIdSelectionne((actuel) => actuel && liste.some((t) => t.id === actuel) ? actuel : liste[0]?.id ?? null);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur de chargement des tableaux de bord.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerTableauxDeBord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tableauActif = tableauxDeBord.find((t) => t.id === idSelectionne) ?? null;
  const estProprietaire = !!tableauActif && tableauActif.proprietaire === utilisateur?.id;

  useEffect(() => {
    if (!tableauActif) return;
    let annule = false;
    Promise.all(
      tableauActif.widgets.map((w) =>
        appelApi<PivotResultat>(`/statistiques/widgets/${w.id}/donnees/`).then((donnees) => [w.id, donnees] as const)
      )
    ).then((paires) => {
      if (annule) return;
      setDonneesWidgets(Object.fromEntries(paires));
    });
    return () => {
      annule = true;
    };
  }, [tableauActif]);

  const libellesMesures = useMemo(() => Object.fromEntries(mesuresDisponibles.map((m) => [m.code, m.label])), [mesuresDisponibles]);

  const layout: Layout[] = (tableauActif?.widgets ?? []).map((w) => ({
    i: w.id,
    x: w.position_x,
    y: w.position_y,
    w: w.largeur,
    h: w.hauteur,
    minW: 3,
    minH: 3
  }));

  async function surChangementDisposition(nouvelleDisposition: Layout[]) {
    if (!tableauActif || !estProprietaire) return;
    const changements = nouvelleDisposition.filter((item) => {
      const widget = tableauActif.widgets.find((w) => w.id === item.i);
      return widget && (widget.position_x !== item.x || widget.position_y !== item.y || widget.largeur !== item.w || widget.hauteur !== item.h);
    });
    if (changements.length === 0) return;
    await Promise.all(
      changements.map((item) =>
        appelApi(`/statistiques/widgets/${item.i}/`, {
          methode: "PATCH",
          corps: { position_x: item.x, position_y: item.y, largeur: item.w, hauteur: item.h }
        }).catch(() => {})
      )
    );
    setTableauxDeBord((tableaux) =>
      tableaux.map((t) =>
        t.id !== tableauActif.id
          ? t
          : {
              ...t,
              widgets: t.widgets.map((w) => {
                const item = nouvelleDisposition.find((i) => i.i === w.id);
                return item ? { ...w, position_x: item.x, position_y: item.y, largeur: item.w, hauteur: item.h } : w;
              })
            }
      )
    );
  }

  async function supprimerWidget(widget: WidgetGraphique) {
    const confirme = await confirmer({
      titre: "Retirer ce graphique ?",
      description: `"${widget.nom}" sera definitivement retire du tableau de bord.`,
      dangereux: true
    });
    if (!confirme) return;
    try {
      await appelApi(`/statistiques/widgets/${widget.id}/`, { methode: "DELETE" });
      toast.succes("Graphique retire.");
      chargerTableauxDeBord();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de la suppression.");
    }
  }

  async function supprimerTableauDeBord() {
    if (!tableauActif) return;
    const confirme = await confirmer({
      titre: "Supprimer ce tableau de bord ?",
      description: `"${tableauActif.nom}" et tous ses graphiques seront definitivement supprimes.`,
      dangereux: true
    });
    if (!confirme) return;
    try {
      await appelApi(`/statistiques/tableaux-de-bord/${tableauActif.id}/`, { methode: "DELETE" });
      toast.succes("Tableau de bord supprime.");
      setIdSelectionne(null);
      chargerTableauxDeBord();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de la suppression.");
    }
  }

  async function creerTableauDeBord() {
    if (!nomNouveauTableau.trim()) {
      toast.erreur("Le nom est requis.");
      return;
    }
    setCreationEnCours(true);
    try {
      const nouveau = await appelApi<TableauDeBord>("/statistiques/tableaux-de-bord/", {
        methode: "POST",
        corps: { nom: nomNouveauTableau, partage: "prive" }
      });
      toast.succes("Tableau de bord cree.");
      setModaleCreation(false);
      setNomNouveauTableau("");
      await chargerTableauxDeBord();
      setIdSelectionne(nouveau.id);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de la creation.");
    } finally {
      setCreationEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Tableaux de bord"
        sousTitre="Vos graphiques enregistres, disposes librement en grille."
        actions={
          <LienBouton to="/admin-cec/statistiques/constructeur" iconeGauche={<Plus size={15} />}>
            Nouveau graphique
          </LienBouton>
        }
      />

      {chargement ? (
        <ChargementPage />
      ) : tableauxDeBord.length === 0 ? (
        <EtatVide
          icone={<LayoutDashboard size={32} />}
          titre="Aucun tableau de bord pour le moment"
          description="Construisez un premier graphique, puis enregistrez-le sur un tableau de bord."
          action={
            <LienBouton to="/admin-cec/statistiques/constructeur" iconeGauche={<Plus size={15} />}>
              Construire un graphique
            </LienBouton>
          }
        />
      ) : (
        <>
          <div className="eva-carte" style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "0 1 260px" }}>
              <Champ id="tableau-actif" label="Tableau de bord">
                <select id="tableau-actif" value={idSelectionne ?? ""} onChange={(e) => setIdSelectionne(e.target.value)}>
                  {tableauxDeBord.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom}
                      {t.partage === "partage_role" ? " (partage)" : ""}
                    </option>
                  ))}
                </select>
              </Champ>
            </div>
            <Bouton variante="fantome" onClick={() => setModaleCreation(true)} iconeGauche={<Plus size={15} />}>
              Nouveau tableau de bord
            </Bouton>
            {estProprietaire && (
              <Bouton variante="danger" onClick={supprimerTableauDeBord} iconeGauche={<Trash2 size={15} />}>
                Supprimer ce tableau de bord
              </Bouton>
            )}
            {!estProprietaire && tableauActif && (
              <p style={{ fontSize: 12.5, color: "var(--couleur-gris-service-2)", paddingBottom: 10 }}>
                Tableau de bord partage par {tableauActif.proprietaire_nom} - lecture seule, disposition non modifiable.
              </p>
            )}
          </div>

          {tableauActif && tableauActif.widgets.length === 0 ? (
            <EtatVide
              icone={<LayoutDashboard size={32} />}
              titre="Ce tableau de bord est vide"
              description="Construisez un graphique et enregistrez-le ici."
              action={
                <LienBouton to="/admin-cec/statistiques/constructeur" iconeGauche={<Plus size={15} />}>
                  Construire un graphique
                </LienBouton>
              }
            />
          ) : (
            tableauActif && (
              <GrilleReactive
                className="layout"
                layout={layout}
                cols={12}
                rowHeight={48}
                isDraggable={estProprietaire}
                isResizable={estProprietaire}
                onLayoutChange={surChangementDisposition}
                draggableHandle=".eva-widget-poignee"
              >
                {tableauActif.widgets.map((widget) => {
                  const donnees = donneesWidgets[widget.id];
                  return (
                    <div key={widget.id}>
                      <Carte style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <div className="eva-widget-poignee" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, cursor: estProprietaire ? "grab" : "default" }}>
                          <h2 style={{ fontSize: 13.5 }}>{widget.nom}</h2>
                          {estProprietaire && (
                            <button
                              type="button"
                              onClick={() => supprimerWidget(widget)}
                              className="eva-bouton eva-bouton--petit eva-bouton--fantome"
                              aria-label="Retirer ce graphique"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                          {donnees ? (
                            <GraphiqueECharts option={construireOptionECharts(donnees, widget.type_graphique, libellesMesures)} hauteur="100%" />
                          ) : (
                            <p style={{ fontSize: 12.5, color: "var(--couleur-gris-service-2)" }}>Chargement...</p>
                          )}
                        </div>
                      </Carte>
                    </div>
                  );
                })}
              </GrilleReactive>
            )
          )}
        </>
      )}

      {modaleCreation && (
        <Modale
          titre="Nouveau tableau de bord"
          onFermer={() => setModaleCreation(false)}
          actions={
            <>
              <Bouton variante="fantome" onClick={() => setModaleCreation(false)}>
                Annuler
              </Bouton>
              <Bouton chargement={creationEnCours} onClick={creerTableauDeBord}>
                Creer
              </Bouton>
            </>
          }
        >
          <Champ id="nom-tableau" label="Nom" requis>
            <input id="nom-tableau" value={nomNouveauTableau} onChange={(e) => setNomNouveauTableau(e.target.value)} placeholder="Ex. Suivi mensuel" />
          </Champ>
        </Modale>
      )}
    </MiseEnPage>
  );
}
