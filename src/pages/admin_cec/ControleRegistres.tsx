import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileSpreadsheet, FileText, Hash, ListChecks, RotateCcw, SearchCheck } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import {
  Alerte,
  Badge,
  BarreOutils,
  Bouton,
  Carte,
  CarteStat,
  EnteteDePage,
  EtatVide,
  ListeResponsive,
  Pagination,
  PilulesFiltre,
  Selecteur,
  useToast,
  type ColonneListe,
  type PiluleFiltre
} from "../../components/ui";
import { appelApi, telechargerDocument } from "../../lib/apiClient";
import { telechargerBlob } from "../../lib/telechargerBlob";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDate, messageErreur } from "./outils";
import {
  listeDepuis,
  type ConstatControle,
  type DecoupageControle,
  type GraviteControle,
  type ListeOuPaginee,
  type Mairie,
  type NumerosManquantsControle,
  type RapportControleRegistres,
  type TypeEvenement
} from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";
import "../../styles/statistiques.css";

const TAILLE_PAGE = 25;
const MOIS_PAR_TRANCHE: Record<DecoupageControle, number> = { trimestre: 3, semestre: 6, annee: 12 };

const PILULES_DECOUPAGE: PiluleFiltre<DecoupageControle>[] = [
  { valeur: "trimestre", libelle: "Trimestre" },
  { valeur: "semestre", libelle: "Semestre" },
  { valeur: "annee", libelle: "Année" }
];

const PILULES_EVENEMENT: PiluleFiltre<TypeEvenement | "">[] = [
  { valeur: "", libelle: "Tous" },
  { valeur: "naissance", libelle: "Naissance" },
  { valeur: "deces", libelle: "Décès" }
];

/** Tranche (trimestre ou semestre) qui contient aujourd'hui. */
function trancheCourante(decoupage: DecoupageControle): number {
  return decoupage === "annee" ? 1 : Math.floor(new Date().getMonth() / MOIS_PAR_TRANCHE[decoupage]) + 1;
}

function libelleActe(c: ConstatControle): string {
  return `N° ${c.acte.numero_acte} / ${c.acte.annee_registre}`;
}

export default function ControleRegistres() {
  const navigate = useNavigate();
  const toast = useToast();
  const anneeCourante = new Date().getFullYear();

  const [decoupage, setDecoupage] = useState<DecoupageControle>("trimestre");
  const [annee, setAnnee] = useState(anneeCourante);
  const [numero, setNumero] = useState(trancheCourante("trimestre"));
  const [evenement, setEvenement] = useState<TypeEvenement | "">("");
  const [mairie, setMairie] = useState("");
  const [mairies, setMairies] = useState<Mairie[]>([]);

  const [rapport, setRapport] = useState<RapportControleRegistres | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);

  const [gravite, setGravite] = useState<GraviteControle | "">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((reponse) => setMairies(listeDepuis(reponse)))
      .catch(() => setMairies([]));
  }, []);

  const parametres = useMemo(() => {
    const p = new URLSearchParams({ decoupage, annee: String(annee), numero: String(numero) });
    if (evenement) p.set("event_type", evenement);
    if (mairie) p.set("mairie", mairie);
    return p;
  }, [decoupage, annee, numero, evenement, mairie]);

  useEffect(() => {
    let obsolete = false;
    setChargement(true);
    setErreur(null);
    appelApi<RapportControleRegistres>(`/controle-registres/?${parametres.toString()}`)
      .then((donnees) => {
        if (obsolete) return;
        setRapport(donnees);
        setPage(1);
      })
      .catch((e) => {
        if (!obsolete) setErreur(messageErreur(e, "Impossible de lancer le contrôle."));
      })
      .finally(() => {
        if (!obsolete) setChargement(false);
      });
    return () => {
      obsolete = true;
    };
  }, [parametres, rechargement]);

  function choisirDecoupage(valeur: DecoupageControle) {
    setDecoupage(valeur);
    setNumero(annee === anneeCourante ? trancheCourante(valeur) : 1);
  }

  async function exporter(format: "xlsx" | "pdf") {
    setExportEnCours(format);
    try {
      const p = new URLSearchParams(parametres);
      p.set("format", format);
      const blob = await telechargerDocument(`/controle-registres/export/?${p.toString()}`);
      telechargerBlob(blob, `controle-registres-${rapport?.periode.code ?? annee}.${format}`);
      toast.succes(`Export ${format === "xlsx" ? "Excel" : "PDF"} téléchargé.`);
    } catch (e) {
      toast.erreur(messageErreur(e, "L'export a échoué. Réessayez."));
    } finally {
      setExportEnCours(null);
    }
  }

  const tranches = 12 / MOIS_PAR_TRANCHE[decoupage];
  const pilulesTranche: PiluleFiltre<string>[] = Array.from({ length: tranches }, (_, i) => ({
    valeur: String(i + 1),
    libelle: decoupage === "trimestre" ? `T${i + 1}` : `S${i + 1}`
  }));
  const annees = Array.from({ length: 7 }, (_, i) => anneeCourante - i);

  const constats = rapport?.constats ?? [];
  const constatsFiltres = gravite ? constats.filter((c) => c.gravite === gravite) : constats;
  const pageConstats = constatsFiltres.slice((page - 1) * TAILLE_PAGE, page * TAILLE_PAGE);
  const nombreAnomalies = constats.filter((c) => c.gravite === "anomalie").length;
  const plusieursMairies = (rapport?.mairies.length ?? 0) > 1;
  const resume = rapport?.resume;

  const colonnesConstats: ColonneListe<ConstatControle>[] = [
    {
      id: "gravite",
      libelle: "Gravité",
      nowrap: true,
      rendu: (c) => (
        <Badge variante={c.gravite === "anomalie" ? "danger" : "attente"} point>
          {c.libelle_gravite}
        </Badge>
      )
    },
    {
      id: "acte",
      libelle: "Acte",
      principale: true,
      nowrap: true,
      rendu: (c) => (
        <span className="texte-chiffres">
          {libelleActe(c)}
          {c.acte.statut === "annule" && " (annulé)"}
        </span>
      )
    },
    {
      id: "registre",
      libelle: "Registre / feuillet",
      masquerMobile: true,
      rendu: (c) => <span className="texte-chiffres">{`${c.acte.numero_registre} / ${c.acte.numero_feuillet}`}</span>
    },
    {
      id: "constat",
      libelle: "Constat",
      rendu: (c) => (
        <span className="eva-ac-constat">
          <strong>{c.libelle_regle}</strong>
          <span className="eva-ac-constat__detail">{c.detail}</span>
        </span>
      )
    },
    { id: "evenement", libelle: "Événement", rendu: (c) => `${c.acte.libelle_evenement} le ${formaterDate(c.acte.date_evenement)}` },
    { id: "etabli", libelle: "Établi le", nowrap: true, rendu: (c) => <span className="texte-chiffres">{formaterDate(c.acte.date_etablissement)}</span> },
    { id: "nom", libelle: "Nom", masquerMobile: true, rendu: (c) => c.acte.nom || "-" },
    ...(plusieursMairies ? [{ id: "mairie", libelle: "Mairie", rendu: (c: ConstatControle) => c.acte.mairie }] : [])
  ];

  const colonnesNumeros: ColonneListe<NumerosManquantsControle>[] = [
    { id: "evenement", libelle: "Registre", principale: true, rendu: (n) => `${n.libelle_evenement} ${n.annee_registre}` },
    {
      id: "nature",
      libelle: "Nature",
      rendu: (n) => (n.nature === "acte" ? "Numéro d'acte" : `Feuillet du registre ${n.numero_registre}`)
    },
    { id: "plages", libelle: "Numéros absents", rendu: (n) => <span className="texte-chiffres">{n.plages}</span> },
    { id: "nombre", libelle: "Nombre", numerique: true, rendu: (n) => n.nombre },
    ...(plusieursMairies ? [{ id: "mairie", libelle: "Mairie", rendu: (n: NumerosManquantsControle) => n.mairie }] : [])
  ];

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Contrôle des registres"
        sousTitre="Vérifiez les dates d'établissement des actes avant le contrôle trimestriel du Procureur de la République (loi n° 2009-010, art. 38)."
      />

      <Carte variante="plate" className="eva-st-periode" role="group" aria-label="Période contrôlée">
        <div className="eva-st-periode__filtres">
          <span className="eva-st-periode__titre">Découpage</span>
          <PilulesFiltre<DecoupageControle> ariaLabel="Découpage de la période" valeur={decoupage} onChanger={choisirDecoupage} pilules={PILULES_DECOUPAGE} />
        </div>
        <div className="eva-st-periode__filtres">
          <span className="eva-st-periode__titre">Année</span>
          <Selecteur ariaLabel="Année contrôlée" valeur={String(annee)} onChange={(v) => setAnnee(Number(v) || anneeCourante)}>
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Selecteur>
          {decoupage !== "annee" && (
            <PilulesFiltre<string>
              ariaLabel={decoupage === "trimestre" ? "Trimestre" : "Semestre"}
              valeur={String(numero)}
              onChanger={(v) => setNumero(Number(v))}
              pilules={pilulesTranche}
            />
          )}
        </div>
        <div className="eva-st-periode__filtres eva-st-periode__filtres--large">
          <span className="eva-st-periode__titre">Type d'événement</span>
          <PilulesFiltre<TypeEvenement | ""> ariaLabel="Filtrer par type d'événement" valeur={evenement} onChanger={setEvenement} pilules={PILULES_EVENEMENT} />
        </div>
        {mairies.length > 1 && (
          <div className="eva-st-periode__filtres eva-st-periode__filtres--large">
            <span className="eva-st-periode__titre">Mairie</span>
            <Selecteur ariaLabel="Filtrer par mairie" valeur={mairie} onChange={setMairie}>
              <option value="">Toutes les mairies</option>
              {mairies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </Selecteur>
          </div>
        )}
        <p className="eva-st-periode__aide">
          {rapport ? `${rapport.periode.libelle}, du ${formaterDate(rapport.periode.debut)} au ${formaterDate(rapport.periode.fin)}. ` : ""}
          Sont contrôlés les actes établis ou saisis pendant la période. Délai légal : {rapport?.delais_legaux.naissance ?? 45} jours pour une naissance,{" "}
          {rapport?.delais_legaux.deces ?? 15} jours pour un décès, comptés depuis la date de l'événement.
        </p>
      </Carte>

      <BarreOutils
        compteur={rapport && !erreur ? rapport.periode.libelle : undefined}
        actions={
          <>
            <Bouton variante="secondaire" taille="petit" onClick={() => setRechargement((n) => n + 1)} disabled={chargement} iconeGauche={<RotateCcw size={14} />}>
              Relancer
            </Bouton>
            <Bouton
              variante="secondaire"
              taille="petit"
              onClick={() => exporter("xlsx")}
              chargement={exportEnCours === "xlsx"}
              disabled={exportEnCours !== null || !rapport}
              iconeGauche={<FileSpreadsheet size={15} />}
            >
              Excel
            </Bouton>
            <Bouton
              variante="secondaire"
              taille="petit"
              onClick={() => exporter("pdf")}
              chargement={exportEnCours === "pdf"}
              disabled={exportEnCours !== null || !rapport}
              iconeGauche={<FileText size={15} />}
            >
              PDF
            </Bouton>
          </>
        }
      />

      {erreur ? (
        <Carte>
          <EtatVide
            variante="erreur"
            icone={<AlertTriangle size={26} />}
            titre="Contrôle impossible"
            description={erreur}
            action={
              <Bouton variante="secondaire" iconeGauche={<RotateCcw size={16} />} onClick={() => setRechargement((n) => n + 1)}>
                Réessayer
              </Bouton>
            }
          />
        </Carte>
      ) : (
        <>
          {resume && (
            <section className="eva-st-bloc" aria-label="Synthèse du contrôle">
              <div className="eva-grille-stats">
                <CarteStat
                  icone={<ListChecks size={20} />}
                  valeur={resume.actes_controles.toLocaleString("fr-FR")}
                  libelle="Actes contrôlés"
                  detail={resume.actes_annules > 0 ? compterAvecUnite(resume.actes_annules, "annulé") : undefined}
                />
                <CarteStat icone={<CheckCircle2 size={20} />} valeur={resume.actes_conformes.toLocaleString("fr-FR")} libelle="Actes conformes" />
                <CarteStat
                  icone={<AlertTriangle size={20} />}
                  variante={resume.actes_avec_anomalie > 0 ? "alerte" : "muet"}
                  valeur={resume.actes_avec_anomalie.toLocaleString("fr-FR")}
                  libelle="Actes avec anomalie"
                  detail={resume.par_regle.hors_delai > 0 ? `dont ${resume.par_regle.hors_delai.toLocaleString("fr-FR")} hors délai` : undefined}
                />
                <CarteStat
                  icone={<SearchCheck size={20} />}
                  variante={resume.actes_a_verifier > 0 ? "attention" : "muet"}
                  valeur={resume.actes_a_verifier.toLocaleString("fr-FR")}
                  libelle="Actes à vérifier"
                />
                <CarteStat
                  icone={<Hash size={20} />}
                  variante={resume.numeros_manquants > 0 ? "attention" : "muet"}
                  valeur={resume.numeros_manquants.toLocaleString("fr-FR")}
                  libelle="Numéros absents"
                />
              </div>
              {resume.actes_par_jugement > 0 && (
                <p className="eva-st-periode__aide">
                  {compterAvecUnite(resume.actes_par_jugement, "acte issu", "actes issus")} d'un jugement supplétif : ils ne sont jamais comptés hors délai.
                </p>
              )}
            </section>
          )}

          {rapport?.tronque && (
            <Alerte variante="avertissement" titre="Liste limitée">
              {rapport.constats_total.toLocaleString("fr-FR")} constats : seuls les {constats.length.toLocaleString("fr-FR")} premiers sont affichés. Filtrez par mairie ou par type
              d'événement.
            </Alerte>
          )}

          <section className="eva-st-bloc" aria-label="Constats">
            <BarreOutils
              compteur={rapport ? compterAvecUnite(constatsFiltres.length, "constat") : undefined}
              filtres={
                <PilulesFiltre<GraviteControle | "">
                  ariaLabel="Filtrer par gravité"
                  valeur={gravite}
                  onChanger={(v) => {
                    setGravite(v);
                    setPage(1);
                  }}
                  pilules={[
                    { valeur: "", libelle: "Tous", compteur: constats.length },
                    { valeur: "anomalie", libelle: "Anomalies", compteur: nombreAnomalies },
                    { valeur: "a_verifier", libelle: "À vérifier", compteur: constats.length - nombreAnomalies }
                  ]}
                />
              }
            />
            <ListeResponsive<ConstatControle>
              legende="Constats du contrôle des registres"
              lignes={pageConstats}
              cle={(c, index) => `${c.acte.id}-${c.regle}-${index}`}
              colonnes={colonnesConstats}
              chargement={chargement}
              onLigneClic={(c) => navigate(`/admin-cec/dossiers/${c.acte.dossier_id}`)}
              hauteurMax="none"
              vide={{
                icone: <ClipboardCheck size={26} />,
                titre: gravite ? "Aucun constat de ce type" : "Aucun constat",
                description: resume && resume.actes_controles > 0 ? "Tous les actes contrôlés sur cette période sont conformes." : "Aucun acte établi ou saisi sur cette période."
              }}
            />
            {constatsFiltres.length > TAILLE_PAGE && (
              <Pagination
                page={page}
                taillepage={TAILLE_PAGE}
                total={constatsFiltres.length}
                aSuivant={page * TAILLE_PAGE < constatsFiltres.length}
                aPrecedent={page > 1}
                onChanger={setPage}
              />
            )}
          </section>

          {rapport && rapport.numeros_manquants.length > 0 && (
            <section className="eva-st-bloc" aria-label="Numéros absents du système">
              <h2 className="eva-ac-controle-titre">Numéros absents du système</h2>
              <p className="eva-st-periode__aide">
                Numéros compris entre le premier et le dernier numéro connus, sans acte dans le système. À confronter au registre papier : acte inscrit à la main ou numéro
                sauté.
              </p>
              <ListeResponsive<NumerosManquantsControle>
                legende="Numéros absents du système"
                lignes={rapport.numeros_manquants}
                cle={(n, index) => `${n.mairie}-${n.event_type}-${n.annee_registre}-${n.nature}-${n.numero_registre ?? ""}-${index}`}
                colonnes={colonnesNumeros}
                hauteurMax="none"
                sansSurvol
              />
            </section>
          )}
        </>
      )}
    </MiseEnPage>
  );
}
