import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import {
  AlertCircle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Info,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import MiseEnPage from "../../../components/MiseEnPage";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  EnteteDePage,
  EtatVide,
  GraphiqueECharts,
  ItemMenu,
  LienBouton,
  MenuDeroulant,
  Modale,
  SeparateurMenu,
  Selecteur,
  Spinner,
  Squelette,
  useMediaQuery,
  type PoigneeGraphique
} from "../../../components/ui";
import GraphiqueCarte from "../../../components/GraphiqueCarte";
import { typeGraphique as descriptionType } from "../../../components/statistiques/typesGraphique";
import { telechargerBlob } from "../../../lib/telechargerBlob";
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
import "../../../styles/statistiques.css";

const GrilleReactive = WidthProvider(GridLayout);

export default function TableauDeBordStats() {
  const toast = useToast();
  const confirmer = useConfirmation();
  const mobile = useMediaQuery("(max-width: 720px)");

  const [tableauxDeBord, setTableauxDeBord] = useState<TableauDeBord[]>([]);
  const [idSelectionne, setIdSelectionne] = useState<string | null>(null);
  const [donneesWidgets, setDonneesWidgets] = useState<Record<string, PivotResultat>>({});
  const [widgetsEnErreur, setWidgetsEnErreur] = useState<Record<string, boolean>>({});
  const [tentativeDonnees, setTentativeDonnees] = useState(0);
  const [mesuresDisponibles, setMesuresDisponibles] = useState<MesureStat[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [modaleCreation, setModaleCreation] = useState(false);
  const [nomNouveauTableau, setNomNouveauTableau] = useState("");
  const [erreurNom, setErreurNom] = useState<string | undefined>(undefined);
  const [creationEnCours, setCreationEnCours] = useState(false);

  const { utilisateur } = useAuth();

  // Poignees de capture des graphiques affiches (id widget -> image PNG) : seul
  // le navigateur a rendu les graphiques (cartes comprises), le serveur ne fait
  // que les mettre en page dans le PDF / classeur Excel.
  const poignees = useRef<Record<string, PoigneeGraphique | null>>({});
  const [exportEnCours, setExportEnCours] = useState<string | null>(null);

  function imagesDesGraphiques(): Record<string, string> {
    const images: Record<string, string> = {};
    for (const [id, poignee] of Object.entries(poignees.current)) {
      const image = poignee?.obtenirImage();
      if (image) images[id] = image;
    }
    return images;
  }

  async function exporterTableau(format: "xlsx" | "pdf") {
    if (!tableauActif) return;
    setExportEnCours(`tableau-${format}`);
    try {
      const blob = await appelApi<Blob>(`/statistiques/tableaux-de-bord/${tableauActif.id}/export/`, {
        methode: "POST",
        corps: { format, images: imagesDesGraphiques() }
      });
      telechargerBlob(blob, `${tableauActif.nom}.${format}`);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'export.");
    } finally {
      setExportEnCours(null);
    }
  }

  async function exporterWidget(widget: WidgetGraphique, format: "xlsx" | "pdf") {
    setExportEnCours(`${widget.id}-${format}`);
    try {
      const blob = await appelApi<Blob>(`/statistiques/widgets/${widget.id}/export/`, {
        methode: "POST",
        corps: { format, image_data_url: poignees.current[widget.id]?.obtenirImage() ?? "" }
      });
      telechargerBlob(blob, `${widget.nom}.${format}`);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'export.");
    } finally {
      setExportEnCours(null);
    }
  }

  async function chargerTableauxDeBord() {
    setChargement(true);
    setErreurChargement(null);
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
      setErreurChargement(e instanceof ErreurApi ? e.message : "Erreur de chargement des tableaux de bord.");
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
        appelApi<PivotResultat>(`/statistiques/widgets/${w.id}/donnees/`)
          .then((donnees) => [w.id, donnees, false] as const)
          .catch(() => [w.id, null, true] as const)
      )
    ).then((resultats) => {
      if (annule) return;
      setDonneesWidgets(Object.fromEntries(resultats.filter(([, donnees]) => donnees).map(([id, donnees]) => [id, donnees as PivotResultat])));
      setWidgetsEnErreur(Object.fromEntries(resultats.filter(([, , enErreur]) => enErreur).map(([id]) => [id, true])));
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableauActif, tentativeDonnees]);

  const libellesMesures = useMemo(() => Object.fromEntries(mesuresDisponibles.map((m) => [m.code, m.label])), [mesuresDisponibles]);
  const unitesMesures = useMemo(() => Object.fromEntries(mesuresDisponibles.map((m) => [m.code, m.unite])), [mesuresDisponibles]);

  const layout: Layout[] = (tableauActif?.widgets ?? []).map((w) => ({
    i: w.id,
    x: w.position_x,
    y: w.position_y,
    w: w.largeur,
    h: w.hauteur,
    minW: 3,
    minH: 3
  }));

  // Petit ecran : une seule colonne, dans l'ordre de lecture de la grille. La
  // disposition enregistree n'est ni lue ni modifiee dans ce mode.
  const widgetsEnPile = useMemo(
    () => [...(tableauActif?.widgets ?? [])].sort((a, b) => a.position_y - b.position_y || a.position_x - b.position_x),
    [tableauActif]
  );

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
      description: `« ${widget.nom} » sera définitivement retiré du tableau de bord.`,
      libelleConfirmer: "Retirer",
      dangereux: true
    });
    if (!confirme) return;
    try {
      await appelApi(`/statistiques/widgets/${widget.id}/`, { methode: "DELETE" });
      toast.succes("Graphique retiré.");
      chargerTableauxDeBord();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de la suppression.");
    }
  }

  async function supprimerTableauDeBord() {
    if (!tableauActif) return;
    const confirme = await confirmer({
      titre: "Supprimer ce tableau de bord ?",
      description: `« ${tableauActif.nom} » et tous ses graphiques seront définitivement supprimés.`,
      libelleConfirmer: "Supprimer",
      dangereux: true
    });
    if (!confirme) return;
    try {
      await appelApi(`/statistiques/tableaux-de-bord/${tableauActif.id}/`, { methode: "DELETE" });
      toast.succes("Tableau de bord supprimé.");
      setIdSelectionne(null);
      chargerTableauxDeBord();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de la suppression.");
    }
  }

  function ouvrirCreation() {
    setErreurNom(undefined);
    setModaleCreation(true);
  }

  async function creerTableauDeBord(evenement?: FormEvent) {
    evenement?.preventDefault();
    if (!nomNouveauTableau.trim()) {
      setErreurNom("Le nom est requis.");
      return;
    }
    setErreurNom(undefined);
    setCreationEnCours(true);
    try {
      const nouveau = await appelApi<TableauDeBord>("/statistiques/tableaux-de-bord/", {
        methode: "POST",
        corps: { nom: nomNouveauTableau, partage: "prive" }
      });
      toast.succes("Tableau de bord créé.");
      setModaleCreation(false);
      setNomNouveauTableau("");
      await chargerTableauxDeBord();
      setIdSelectionne(nouveau.id);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de la création.");
    } finally {
      setCreationEnCours(false);
    }
  }

  function sousTitreWidget(widget: WidgetGraphique): string {
    const type = descriptionType(widget.type_graphique).label;
    const [premiere, ...autres] = widget.mesures;
    if (!premiere) return type;
    const mesure = libellesMesures[premiere] ?? premiere;
    return `${type} · ${mesure}${autres.length > 0 ? ` +${autres.length}` : ""}`;
  }

  function contenuWidget(widget: WidgetGraphique) {
    const donnees = donneesWidgets[widget.id];
    if (donnees && widget.type_graphique === "carte") {
      return (
        <GraphiqueCarte
          ref={(poignee) => {
            poignees.current[widget.id] = poignee;
          }}
          resultat={donnees}
          parametres={widget.parametres_carte}
          libellesMesures={libellesMesures}
          unites={unitesMesures}
          hauteur="100%"
        />
      );
    }
    if (donnees) {
      return (
        <GraphiqueECharts
          ref={(poignee) => {
            poignees.current[widget.id] = poignee;
          }}
          option={construireOptionECharts(donnees, widget.type_graphique, libellesMesures)}
          hauteur="100%"
        />
      );
    }
    if (widgetsEnErreur[widget.id]) {
      return (
        <EtatVide
          compact
          variante="erreur"
          icone={<AlertCircle size={22} />}
          titre="Données indisponibles"
          description="Ce graphique n'a pas pu être calculé."
          action={
            <Bouton variante="secondaire" taille="petit" iconeGauche={<RefreshCw size={14} />} onClick={() => setTentativeDonnees((n) => n + 1)}>
              Réessayer
            </Bouton>
          }
        />
      );
    }
    return <Squelette variante="bloc" hauteur="100%" libelle={`Chargement du graphique ${widget.nom}`} />;
  }

  function carteWidget(widget: WidgetGraphique) {
    const deplacable = estProprietaire && !mobile;
    const exportDuWidget = exportEnCours?.startsWith(`${widget.id}-`) ?? false;
    return (
      <Carte className="eva-st-widget">
        <div className="eva-st-widget__entete">
          <div className={`eva-st-widget__identite eva-widget-poignee${deplacable ? " est-deplacable" : ""}`}>
            {deplacable && <GripVertical size={16} className="eva-st-widget__poignee" aria-hidden="true" />}
            <div className="eva-st-widget__textes">
              <h2 className="eva-st-widget__titre" title={widget.nom}>
                {widget.nom}
              </h2>
              <p className="eva-st-widget__sous-titre">{sousTitreWidget(widget)}</p>
            </div>
          </div>
          <div className="eva-st-widget__actions">
            {exportDuWidget && <Spinner libelle="Export en cours" />}
            <MenuDeroulant ariaLabel={`Actions pour le graphique ${widget.nom}`} declencheur={<MoreHorizontal size={16} />}>
              <ItemMenu icone={FileSpreadsheet} desactive={exportEnCours !== null} onClick={() => exporterWidget(widget, "xlsx")}>
                Exporter en Excel
              </ItemMenu>
              <ItemMenu icone={FileText} desactive={exportEnCours !== null} onClick={() => exporterWidget(widget, "pdf")}>
                Exporter en PDF
              </ItemMenu>
              {estProprietaire && (
                <>
                  <SeparateurMenu />
                  <ItemMenu icone={Trash2} danger onClick={() => supprimerWidget(widget)}>
                    Retirer du tableau de bord
                  </ItemMenu>
                </>
              )}
            </MenuDeroulant>
          </div>
        </div>
        <div className="eva-st-widget__corps">{contenuWidget(widget)}</div>
      </Carte>
    );
  }

  const premierChargement = chargement && tableauxDeBord.length === 0 && !erreurChargement;
  const exportTableauEnCours = exportEnCours?.startsWith("tableau-") ?? false;
  const tableauVide = !!tableauActif && tableauActif.widgets.length === 0;

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Tableaux de bord"
        sousTitre="Vos graphiques enregistrés, disposés librement en grille."
        actions={
          <LienBouton to="/admin-cec/statistiques/constructeur" iconeGauche={<Plus size={16} />}>
            Nouveau graphique
          </LienBouton>
        }
      />

      {premierChargement ? (
        <div className="eva-st-chargement">
          <Squelette variante="carte" lignes={1} libelle="Chargement des tableaux de bord" />
          <div className="eva-st-chargement__grille" aria-hidden="true">
            <Squelette variante="bloc" hauteur={280} />
            <Squelette variante="bloc" hauteur={280} />
          </div>
        </div>
      ) : erreurChargement ? (
        <Carte>
          <EtatVide
            variante="erreur"
            icone={<AlertCircle size={26} />}
            titre="Chargement impossible"
            description={erreurChargement}
            action={
              <Bouton variante="secondaire" iconeGauche={<RefreshCw size={16} />} onClick={chargerTableauxDeBord}>
                Réessayer
              </Bouton>
            }
          />
        </Carte>
      ) : tableauxDeBord.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<LayoutDashboard size={32} />}
            titre="Aucun tableau de bord pour le moment"
            description="Construisez un premier graphique, puis enregistrez-le sur un tableau de bord."
            action={
              <>
                <LienBouton to="/admin-cec/statistiques/constructeur" iconeGauche={<Plus size={16} />}>
                  Construire un graphique
                </LienBouton>
                <Bouton variante="secondaire" iconeGauche={<Plus size={16} />} onClick={ouvrirCreation}>
                  Créer un tableau vide
                </Bouton>
              </>
            }
          />
        </Carte>
      ) : (
        <>
          <Carte variante="plate" className="eva-st-barre-tableau">
            <div className="eva-st-barre-tableau__champ">
              <Champ id="tableau-actif" label="Tableau de bord">
                <Selecteur id="tableau-actif" valeur={idSelectionne ?? ""} onChange={setIdSelectionne}>
                  {tableauxDeBord.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom}
                      {t.partage === "partage_role" ? " (partagé)" : ""}
                    </option>
                  ))}
                </Selecteur>
              </Champ>
            </div>
            <div className="eva-st-barre-tableau__etat">
              {tableauActif && (
                <>
                  {estProprietaire ? (
                    <Badge variante="succes" point>
                      Vous en êtes propriétaire
                    </Badge>
                  ) : (
                    <Badge variante="info" icone={<Lock size={12} aria-hidden="true" />}>
                      Lecture seule
                    </Badge>
                  )}
                  <span className="eva-compteur">
                    {tableauActif.widgets.length} graphique{tableauActif.widgets.length > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
            <div className="eva-st-barre-tableau__actions eva-groupe-boutons">
              <Bouton variante="secondaire" onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
                Nouveau tableau
              </Bouton>
              <MenuDeroulant
                ariaLabel="Exporter le tableau de bord"
                classeDeclencheur="eva-bouton eva-bouton--secondaire"
                declencheur={
                  <>
                    {exportTableauEnCours ? <Spinner /> : <Download size={16} aria-hidden="true" />}
                    Exporter
                    <ChevronDown size={15} aria-hidden="true" />
                  </>
                }
              >
                <ItemMenu icone={FileSpreadsheet} desactive={tableauVide || exportEnCours !== null} onClick={() => exporterTableau("xlsx")}>
                  Classeur Excel
                </ItemMenu>
                <ItemMenu icone={FileText} desactive={tableauVide || exportEnCours !== null} onClick={() => exporterTableau("pdf")}>
                  Document PDF
                </ItemMenu>
              </MenuDeroulant>
              {estProprietaire && (
                <MenuDeroulant ariaLabel="Plus d'actions sur ce tableau de bord" declencheur={<MoreHorizontal size={18} />}>
                  <ItemMenu icone={Trash2} danger onClick={supprimerTableauDeBord}>
                    Supprimer ce tableau de bord
                  </ItemMenu>
                </MenuDeroulant>
              )}
            </div>
          </Carte>

          {tableauActif && !estProprietaire && (
            <Alerte variante="info" titre="Tableau de bord en lecture seule" icone={<Lock size={18} aria-hidden="true" />} className="eva-st-alerte-page">
              Ce tableau est partagé par {tableauActif.proprietaire_nom}. Vous pouvez le consulter et l'exporter, mais pas modifier sa disposition ni retirer ses graphiques.
            </Alerte>
          )}

          {tableauActif && estProprietaire && !tableauVide && (
            <p className="eva-st-astuce eva-st-astuce--page">
              <Info size={15} aria-hidden="true" />
              {mobile
                ? "Sur petit écran, les graphiques sont empilés. Utilisez un écran plus large pour modifier la disposition."
                : "Glissez l'en-tête d'un graphique pour le déplacer, tirez son coin inférieur droit pour le redimensionner."}
            </p>
          )}

          {tableauVide ? (
            <Carte>
              <EtatVide
                icone={<LayoutDashboard size={32} />}
                titre="Ce tableau de bord est vide"
                description="Construisez un graphique et enregistrez-le ici."
                action={
                  <LienBouton to="/admin-cec/statistiques/constructeur" iconeGauche={<Plus size={16} />}>
                    Construire un graphique
                  </LienBouton>
                }
              />
            </Carte>
          ) : (
            tableauActif &&
            (mobile ? (
              <div className="eva-st-pile">
                {widgetsEnPile.map((widget) => (
                  <div key={widget.id} className={`eva-st-pile__element${widget.type_graphique === "carte" ? " eva-st-pile__element--carte" : ""}`}>
                    {carteWidget(widget)}
                  </div>
                ))}
              </div>
            ) : (
              <GrilleReactive
                className={`layout eva-st-grille${estProprietaire ? " est-modifiable" : ""}`}
                layout={layout}
                cols={12}
                rowHeight={48}
                margin={[16, 16]}
                containerPadding={[0, 0]}
                isDraggable={estProprietaire}
                isResizable={estProprietaire}
                onLayoutChange={surChangementDisposition}
                draggableHandle=".eva-widget-poignee"
              >
                {tableauActif.widgets.map((widget) => (
                  <div key={widget.id}>{carteWidget(widget)}</div>
                ))}
              </GrilleReactive>
            ))
          )}
        </>
      )}

      {modaleCreation && (
        <Modale
          titre="Nouveau tableau de bord"
          description="Un tableau de bord regroupe vos graphiques. Il est privé tant que vous ne le partagez pas."
          taille="petit"
          onFermer={() => setModaleCreation(false)}
          actions={
            <>
              <Bouton variante="fantome" onClick={() => setModaleCreation(false)}>
                Annuler
              </Bouton>
              <Bouton chargement={creationEnCours} onClick={() => creerTableauDeBord()}>
                Créer
              </Bouton>
            </>
          }
        >
          <form onSubmit={creerTableauDeBord} noValidate>
            <Champ id="nom-tableau" label="Nom" requis erreur={erreurNom}>
              <input id="nom-tableau" autoFocus value={nomNouveauTableau} onChange={(e) => setNomNouveauTableau(e.target.value)} placeholder="Ex. Suivi mensuel" />
            </Champ>
            <button type="submit" className="eva-sr-only" tabIndex={-1}>
              Créer
            </button>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
