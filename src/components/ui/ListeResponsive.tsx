import { isValidElement, useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, AlertCircle, Inbox } from "lucide-react";
import Bouton from "./Bouton";
import EtatVide from "./EtatVide";
import Selecteur from "./Selecteur";
import { cx } from "./utilitaires";

export type SensTri = "asc" | "desc";

export interface EtatTri {
  colonne: string;
  sens: SensTri;
}

export interface ColonneListe<T> {
  /** Identifiant unique de la colonne (sert aussi au tri). */
  id: string;
  /** Intitule de l'en-tete et libelle de la valeur dans la fiche mobile. */
  libelle: string;
  /** Contenu de la cellule. */
  rendu: (ligne: T, index: number) => ReactNode;
  /** Alignement du contenu (defaut : gauche). */
  alignement?: "gauche" | "centre" | "droite";
  /** Colonne de nombres : police mono, alignee a droite. */
  numerique?: boolean;
  /** Colonne d'identification : en gras sur desktop, TITRE de la fiche sur mobile. Une seule par liste. */
  principale?: boolean;
  /** Colonne de boutons : alignee a droite, en pied de fiche sur mobile (toujours visible). */
  actions?: boolean;
  /** Absente de la fiche mobile (colonne secondaire). */
  masquerMobile?: boolean;
  /** Libelle de la valeur dans la fiche mobile ; `false` = valeur sans libelle. */
  libelleMobile?: string | false;
  /** En-tete masque visuellement (reste lu par les lecteurs d'ecran) : utile pour la colonne d'actions. */
  masquerLibelle?: boolean;
  /** Colonne triable (en-tete cliquable). */
  triable?: boolean;
  /** Valeur comparee par le tri local. Inutile si le tri est gere par le serveur (`onTri`). */
  valeurTri?: (ligne: T) => string | number | Date | null | undefined;
  /** Largeur de la colonne sur desktop (ex: "120px", "20%"). */
  largeur?: string;
  /** Empeche le retour a la ligne dans la cellule (desktop). */
  nowrap?: boolean;
}

interface ContenuVide {
  icone?: ReactNode;
  titre: string;
  description?: string;
  action?: ReactNode;
}

interface ProprietesListeResponsive<T> {
  colonnes: ColonneListe<T>[];
  lignes: T[];
  /** Cle React unique d'une ligne (ex: `(d) => d.id`). */
  cle: (ligne: T, index: number) => string;
  /** Nom accessible du tableau (lu par les lecteurs d'ecran). */
  legende: string;

  /** Chargement initial : affiche des squelettes. Si des lignes existent deja, elles sont grisees (rafraichissement). */
  chargement?: boolean;
  /** Message d'erreur : remplace la liste par un etat d'erreur. */
  erreur?: string | null;
  /** Bouton "Reessayer" de l'etat d'erreur. */
  onReessayer?: () => void;
  /** Etat vide : `{ titre, description?, icone?, action? }` ou un noeud React libre. */
  vide?: ContenuVide | ReactNode;

  /** Rend chaque ligne cliquable (et atteignable au clavier : Entree ou Espace). Les controles internes (boutons, liens, champs) gardent leur propre action. */
  onLigneClic?: (ligne: T) => void;
  /** Classe ajoutee a une ligne (ex: `classeUrgence(jours)` pour teinter selon l'urgence). */
  classeLigne?: (ligne: T) => string | undefined;

  /** Tri gere par le parent (controle) : etat courant. A combiner avec `onTri`. */
  tri?: EtatTri | null;
  /** Appele au clic sur un en-tete triable (`null` = retour a l'ordre d'origine). Sans `onTri`, le tri est local. */
  onTri?: (tri: EtatTri | null) => void;
  /** Tri initial du mode local (non controle). */
  triInitial?: EtatTri;

  /** Hauteur maximale du cadre sur desktop avant defilement interne, en-tete collant (defaut "70vh" ; "none" pour desactiver). */
  hauteurMax?: string;
  /** Cellules resserrees. */
  dense?: boolean;
  /** Retire le cadre (liste deja placee dans une carte). */
  sansCadre?: boolean;
  /** Desactive la teinte de survol (liste non cliquable). */
  sansSurvol?: boolean;
  /** Nombre de lignes de squelette pendant le chargement (defaut 6). */
  lignesSqueleteNombre?: number;
  className?: string;
}

const collateur = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

function comparer(a: string | number | Date | null | undefined, b: string | number | Date | null | undefined): number {
  const vide = (v: unknown) => v === null || v === undefined || v === "";
  if (vide(a) && vide(b)) return 0;
  if (vide(a)) return 1; // les valeurs vides toujours en fin de liste
  if (vide(b)) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collateur.compare(String(a), String(b));
}

const SELECTEUR_INTERACTIF = "a, button, input, select, textarea, label, summary, [role='button'], [role='menuitem'], [data-ligne-ignorer]";

function classesCellule<T>(colonne: ColonneListe<T>): string {
  return cx(
    colonne.alignement === "centre" && "eva-liste__cellule--centre",
    colonne.alignement === "droite" && "eva-liste__cellule--droite",
    colonne.numerique && "eva-liste__cellule--numerique",
    colonne.principale && "eva-liste__cellule--principale",
    colonne.actions && "eva-liste__cellule--actions",
    colonne.nowrap && "eva-liste__cellule--nowrap",
    colonne.masquerMobile && "eva-liste__cellule--masquee-mobile",
    colonne.libelleMobile === false && "eva-liste__cellule--sans-libelle"
  );
}

function estContenuVide(valeur: unknown): valeur is ContenuVide {
  return typeof valeur === "object" && valeur !== null && !isValidElement(valeur) && "titre" in valeur;
}

/**
 * Liste de donnees evoluee : tableau a en-tete collant sur desktop, fiches
 * lisibles (sans defilement horizontal, actions visibles) sous 720px.
 * Colonnes declaratives, tri optionnel (local ou serveur), ligne cliquable,
 * etats de chargement (squelettes), d'erreur et vide integres.
 */
export default function ListeResponsive<T>({
  colonnes,
  lignes,
  cle,
  legende,
  chargement = false,
  erreur,
  onReessayer,
  vide,
  onLigneClic,
  classeLigne,
  tri,
  onTri,
  triInitial,
  hauteurMax = "70vh",
  dense,
  sansCadre,
  sansSurvol,
  lignesSqueleteNombre = 6,
  className
}: ProprietesListeResponsive<T>) {
  const [triInterne, setTriInterne] = useState<EtatTri | null>(triInitial ?? null);
  const controle = tri !== undefined;
  const triActif = controle ? tri : triInterne;
  const triLocal = !onTri;

  const lignesAffichees = useMemo(() => {
    if (!triLocal || !triActif) return lignes;
    const colonne = colonnes.find((c) => c.id === triActif.colonne);
    if (!colonne?.valeurTri) return lignes;
    const extraire = colonne.valeurTri;
    const facteur = triActif.sens === "asc" ? 1 : -1;
    return [...lignes].sort((a, b) => facteur * comparer(extraire(a), extraire(b)));
  }, [lignes, colonnes, triActif, triLocal]);

  function changerTri(colonne: ColonneListe<T>) {
    let suivant: EtatTri | null;
    if (triActif?.colonne !== colonne.id) suivant = { colonne: colonne.id, sens: "asc" };
    else if (triActif.sens === "asc") suivant = { colonne: colonne.id, sens: "desc" };
    else suivant = null;
    if (!controle) setTriInterne(suivant);
    onTri?.(suivant);
  }

  const idTri = `${useId().replace(/:/g, "")}-tri`;

  function changerTriMobile(valeur: string) {
    if (!valeur) {
      if (!controle) setTriInterne(null);
      onTri?.(null);
      return;
    }
    const [colonne, sens] = valeur.split(":");
    const suivant: EtatTri = { colonne, sens: sens === "desc" ? "desc" : "asc" };
    if (!controle) setTriInterne(suivant);
    onTri?.(suivant);
  }

  function surClic(evenement: MouseEvent<HTMLTableRowElement>, ligne: T) {
    if (!onLigneClic) return;
    if ((evenement.target as HTMLElement).closest(SELECTEUR_INTERACTIF) && evenement.target !== evenement.currentTarget) return;
    onLigneClic(ligne);
  }

  function surClavier(evenement: KeyboardEvent<HTMLTableRowElement>, ligne: T) {
    if (!onLigneClic || evenement.target !== evenement.currentTarget) return;
    if (evenement.key === "Enter" || evenement.key === " ") {
      evenement.preventDefault();
      onLigneClic(ligne);
    }
  }

  const colonnesTriables = colonnes.filter((c) => c.triable);
  const squelettes = chargement && lignes.length === 0;
  const rafraichissement = chargement && lignes.length > 0;
  const styleCadre = hauteurMax !== "none" ? ({ "--liste-hauteur-max": hauteurMax } as CSSProperties) : undefined;

  // ---- Etats sans tableau : erreur, vide ----
  if (erreur && !chargement) {
    return (
      <div className={cx("eva-liste", className)}>
        <div className="eva-liste__cadre eva-liste__etat">
          <EtatVide
            variante="erreur"
            icone={<AlertCircle size={26} />}
            titre="Impossible de charger la liste"
            description={erreur}
            action={onReessayer && <Bouton variante="secondaire" onClick={onReessayer}>Réessayer</Bouton>}
          />
        </div>
      </div>
    );
  }

  if (!chargement && lignes.length === 0) {
    const contenu = estContenuVide(vide) ? (
      <EtatVide icone={vide.icone ?? <Inbox size={26} />} titre={vide.titre} description={vide.description} action={vide.action} />
    ) : vide ? (
      vide
    ) : (
      <EtatVide icone={<Inbox size={26} />} titre="Aucun résultat" description="Modifiez votre recherche ou vos filtres." />
    );
    return (
      <div className={cx("eva-liste", className)}>
        <div className="eva-liste__cadre eva-liste__etat">{contenu}</div>
      </div>
    );
  }

  // ---- Tableau ----
  const lignesAGenerer: Array<T | null> = squelettes ? Array.from({ length: lignesSqueleteNombre }, () => null) : lignesAffichees;

  return (
    <div
      className={cx(
        "eva-liste",
        dense && "eva-liste--dense",
        sansCadre && "eva-liste--sans-cadre",
        sansSurvol && "eva-liste--sans-survol",
        rafraichissement && "eva-liste--charge-suite",
        className
      )}
      aria-busy={chargement || undefined}
    >
      {colonnesTriables.length > 0 && (
        <div className="eva-liste__tri-mobile">
          <span id={`${idTri}-etiquette`}>Trier par</span>
          <Selecteur
            id={idTri}
            etiquettePar={`${idTri}-etiquette`}
            titre="Trier par"
            recherche={false}
            valeur={triActif ? `${triActif.colonne}:${triActif.sens}` : ""}
            onChange={changerTriMobile}
            options={[
              { valeur: "", libelle: "Ordre par défaut" },
              ...colonnesTriables.flatMap((c) => [
                { valeur: `${c.id}:asc`, libelle: `${c.libelle} (croissant)` },
                { valeur: `${c.id}:desc`, libelle: `${c.libelle} (décroissant)` }
              ])
            ]}
          />
        </div>
      )}

      <div className="eva-liste__cadre" style={styleCadre}>
        <table className="eva-liste__table" role="table" aria-label={legende}>
          <thead role="rowgroup">
            <tr role="row">
              {colonnes.map((colonne) => {
                const sensAria = triActif?.colonne === colonne.id ? (triActif.sens === "asc" ? "ascending" : "descending") : undefined;
                const Fleche = sensAria === "ascending" ? ArrowUp : sensAria === "descending" ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={colonne.id}
                    role="columnheader"
                    scope="col"
                    className={classesCellule({ ...colonne, principale: false, masquerMobile: false, libelleMobile: undefined })}
                    style={colonne.largeur ? { width: colonne.largeur } : undefined}
                    aria-sort={colonne.triable ? (sensAria ?? "none") : undefined}
                  >
                    {colonne.triable ? (
                      <button type="button" className="eva-liste__tri" onClick={() => changerTri(colonne)}>
                        <span className={colonne.masquerLibelle ? "eva-sr-only" : undefined}>{colonne.libelle}</span>
                        <Fleche size={13} aria-hidden="true" />
                      </button>
                    ) : colonne.masquerLibelle ? (
                      <span className="eva-sr-only">{colonne.libelle}</span>
                    ) : (
                      colonne.libelle
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {lignesAGenerer.map((ligne, index) => {
              if (ligne === null) {
                return (
                  <tr key={`squelette-${index}`} role="row" aria-hidden="true">
                    {colonnes.map((colonne, j) => (
                      <td
                        key={colonne.id}
                        role="cell"
                        data-label={colonne.libelleMobile === false ? undefined : (colonne.libelleMobile ?? colonne.libelle)}
                        className={cx(
                          classesCellule(colonne),
                          "eva-liste__squelette-cellule",
                          j === 0 && "eva-liste__squelette-cellule--large",
                          colonne.actions && "eva-liste__squelette-cellule--courte"
                        )}
                      >
                        <span className="eva-squelette" />
                      </td>
                    ))}
                  </tr>
                );
              }
              return (
                <tr
                  key={cle(ligne, index)}
                  role="row"
                  className={cx("eva-liste__ligne", onLigneClic && "est-cliquable", classeLigne?.(ligne))}
                  tabIndex={onLigneClic ? 0 : undefined}
                  onClick={onLigneClic ? (e) => surClic(e, ligne) : undefined}
                  onKeyDown={onLigneClic ? (e) => surClavier(e, ligne) : undefined}
                >
                  {colonnes.map((colonne) => (
                    <td
                      key={colonne.id}
                      role="cell"
                      data-label={colonne.libelleMobile === false ? undefined : (colonne.libelleMobile ?? colonne.libelle)}
                      className={classesCellule(colonne)}
                    >
                      {colonne.rendu(ligne, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {chargement && <span className="eva-sr-only" role="status">Chargement en cours</span>}
    </div>
  );
}
