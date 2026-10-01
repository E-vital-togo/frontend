import { useEffect, useRef, useState, type FormEvent } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowRight, Baby, Camera, CheckCircle2, Flower2, Keyboard, Phone, QrCode, RotateCcw, Search } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { Alerte, Bouton, Carte, Champ, ChampTelephone, EnteteDePage, LienBouton, Onglets, Spinner } from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import type { CodeRetraitTrouve, Dossier } from "../../types/domaine";
import "../../styles/agent.css";

const ID_LECTEUR = "eva-lecteur-qr";
const PREFIXE_ONGLETS = "retrait";

function formaterDate(valeur: string | null | undefined): string {
  if (!valeur) return "Non renseignée";
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
}

/** Numéro d'étape + titre : la page se lit comme un parcours (méthode, recherche, dossier). */
function TitreEtape({ numero, titre, fait }: { numero: number; titre: string; fait?: boolean }) {
  return (
    <h2 className="eva-ag-etape">
      <span className={fait ? "eva-ag-etape__pastille eva-ag-etape__pastille--fait" : "eva-ag-etape__pastille"} aria-hidden="true">
        {fait ? <CheckCircle2 size={16} /> : numero}
      </span>
      <span className="eva-sr-only">Étape {numero} : </span>
      {titre}
    </h2>
  );
}

function ResultatDossier({ dossier, onNouvelleRecherche }: { dossier: Dossier; onNouvelleRecherche: () => void }) {
  const naissance = dossier.event_type === "naissance";
  return (
    <Carte className="eva-ag-resultat" variante="accent" aria-live="polite">
      <div className="eva-ag-resultat__entete">
        <span className="eva-ag-resultat__icone" aria-hidden="true">
          {naissance ? <Baby size={22} /> : <Flower2 size={22} />}
        </span>
        <div className="eva-ag-resultat__titre">
          <span className="eva-ag-resultat__type">Dossier de {naissance ? "naissance" : "décès"}</span>
          <span className="texte-mono eva-texte-petit eva-texte-discret">{dossier.id}</span>
        </div>
        <BadgeStatut statut={dossier.statut} />
      </div>
      <dl className="eva-definitions">
        <dt>Nom</dt>
        <dd>{dossier.nom || "Non renseigné"}</dd>
        <dt>Date de déclaration</dt>
        <dd>{formaterDate(dossier.date_declaration)}</dd>
        <dt>Date limite</dt>
        <dd>{formaterDate(dossier.date_limite)}</dd>
      </dl>
      <div className="eva-groupe-boutons eva-ag-resultat__actions">
        <LienBouton to={`/agent/dossiers/${dossier.id}`} iconeDroite={<ArrowRight size={16} />}>
          Ouvrir le dossier
        </LienBouton>
        <Bouton variante="secondaire" onClick={onNouvelleRecherche} iconeGauche={<RotateCcw size={16} />}>
          Nouvelle recherche
        </Bouton>
      </div>
    </Carte>
  );
}

function OngletScanner({ onTrouve, onReessayer }: { onTrouve: (d: Dossier) => void; onReessayer: () => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurCamera, setErreurCamera] = useState(false);
  const [actif, setActif] = useState(false);
  const instance = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let demonte = false;
    const lecteur = new Html5Qrcode(ID_LECTEUR);
    instance.current = lecteur;

    lecteur
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        async (texteDecode) => {
          try {
            await lecteur.pause(true);
            const dossier = await appelApi<Dossier>("/codes-retrait/qr/verifier", {
              methode: "POST",
              corps: { payload: texteDecode }
            });
            onTrouve(dossier);
          } catch (e) {
            setErreur(e instanceof ErreurApi ? e.message : "QR code invalide ou dossier introuvable.");
            lecteur.resume();
          }
        },
        () => {
          // erreur de décodage frame par frame : bruit normal, on ignore
        }
      )
      .then(() => {
        if (demonte) {
          // Composant démonté pendant le démarrage (changement d'onglet
          // rapide, StrictMode en dev) : la caméra a bien démarré entre
          // temps, on l'arrête plutôt que de laisser le flux ouvert.
          lecteur.stop().catch(() => undefined);
        } else {
          setActif(true);
        }
      })
      .catch(() => {
        if (!demonte) {
          setErreurCamera(true);
          setErreur("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.");
        }
      });

    return () => {
      demonte = true;
      // lecteur.stop() lance une exception SYNCHRONE (pas une promesse
      // rejetée) si le scan n'a pas encore démarré - inévitable si ce
      // cleanup s'exécute avant la résolution de start() (StrictMode en dev
      // double les effets au montage). isScanning évite l'appel dans ce cas.
      if (lecteur.isScanning) {
        lecteur.stop().catch(() => undefined);
      }
    };
  }, [onTrouve]);

  return (
    <Carte className="eva-ag-scanner">
      <p className="eva-ag-aide">
        <Camera size={16} aria-hidden="true" />
        Autorisez l'accès à la caméra, puis présentez le QR code remis au déclarant.
      </p>
      {erreur && (
        <Alerte
          variante={erreurCamera ? "erreur" : "avertissement"}
          onFermer={erreurCamera ? undefined : () => setErreur(null)}
          actions={
            erreurCamera ? (
              <Bouton variante="secondaire" taille="petit" onClick={onReessayer} iconeGauche={<RotateCcw size={14} />}>
                Réessayer
              </Bouton>
            ) : undefined
          }
        >
          {erreur}
        </Alerte>
      )}
      <div className={erreurCamera ? "eva-ag-lecteur eva-ag-lecteur--masque" : "eva-ag-lecteur"}>
        <div id={ID_LECTEUR} className="eva-ag-lecteur__cadre" />
        {!actif && !erreur && (
          <p className="eva-ag-lecteur__attente" role="status">
            <Spinner /> Démarrage de la caméra...
          </p>
        )}
      </div>
    </Carte>
  );
}

function OngletCode({ onTrouve }: { onTrouve: (d: Dossier) => void }) {
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function rechercher(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const codeSaisi = code.trim();
    if (!codeSaisi) return;
    setEnCours(true);
    setErreur(null);
    try {
      const dossier = await appelApi<Dossier>(`/codes-retrait/verifier/${codeSaisi}`);
      onTrouve(dossier);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Code introuvable.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Carte className="eva-ag-formulaire">
      <form onSubmit={rechercher} noValidate>
        <Champ id="code-retrait" label="Code de retrait" aide="Le code remis au déclarant, en lettres et chiffres (les majuscules sont appliquées automatiquement).">
          <input
            id="code-retrait"
            className="texte-mono"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex. AB12CD34"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
        </Champ>
        {erreur && <Alerte variante="erreur" compacte>{erreur}</Alerte>}
        <div className="eva-ag-formulaire__actions">
          <Bouton type="submit" chargement={enCours} disabled={!code.trim()} iconeGauche={<Search size={16} />}>
            Rechercher le dossier
          </Bouton>
        </div>
      </form>
    </Carte>
  );
}

function OngletTelephone({ onTrouve }: { onTrouve: (d: Dossier) => void }) {
  // E.164 ("+22890123456") ; le backend retrouve aussi les codes créés avec un ancien format libre.
  const [telephone, setTelephone] = useState("");
  const [telephoneValide, setTelephoneValide] = useState(false);
  const [resultats, setResultats] = useState<CodeRetraitTrouve[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverture, setOuverture] = useState<string | null>(null);

  async function rechercher(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!telephone || !telephoneValide) return;
    setEnCours(true);
    setErreur(null);
    setResultats(null);
    try {
      const donnees = await appelApi<CodeRetraitTrouve[]>(`/codes-retrait/rechercher?telephone=${encodeURIComponent(telephone)}`);
      setResultats(donnees);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur de recherche.");
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrir(codeTrouve: CodeRetraitTrouve) {
    setOuverture(codeTrouve.code);
    try {
      const dossier = await appelApi<Dossier>(`/codes-retrait/verifier/${codeTrouve.code}`);
      onTrouve(dossier);
    } catch {
      setErreur("Ce dossier n'est plus accessible.");
    } finally {
      setOuverture(null);
    }
  }

  return (
    <div className="eva-ag-telephone">
      <Carte className="eva-ag-formulaire">
        <form onSubmit={rechercher} noValidate>
          <Champ id="telephone" label="Numéro de téléphone du déclarant" aide="Le numéro donné lors de la déclaration du dossier.">
            <ChampTelephone id="telephone" nom="telephone" valeur={telephone} onChange={setTelephone} onValidite={setTelephoneValide} />
          </Champ>
          {erreur && <Alerte variante="erreur" compacte>{erreur}</Alerte>}
          <div className="eva-ag-formulaire__actions">
            <Bouton type="submit" chargement={enCours} disabled={!telephone || !telephoneValide} iconeGauche={<Search size={16} />}>
              Rechercher les codes
            </Bouton>
          </div>
        </form>
      </Carte>

      <div aria-live="polite">
        {resultats && resultats.length === 0 && (
          <Alerte variante="info" titre="Aucun code trouvé pour ce numéro">
            Vérifiez le numéro, ou essayez avec le code de retrait remis au déclarant.
          </Alerte>
        )}
        {resultats && resultats.length > 0 && (
          <section aria-label="Codes trouvés">
            <p className="eva-ag-compteur-resultats">
              {resultats.length} code{resultats.length > 1 ? "s" : ""} trouvé{resultats.length > 1 ? "s" : ""}
            </p>
            <ul className="eva-ag-cartes-codes">
              {resultats.map((r) => (
                <li key={r.code}>
                  <Carte className="eva-ag-code">
                    <span className="eva-ag-code__icone" aria-hidden="true">
                      <QrCode size={20} />
                    </span>
                    <div className="eva-ag-code__corps">
                      <span className="texte-mono eva-ag-code__valeur">{r.code}</span>
                      <span className="eva-texte-petit eva-texte-discret">Émis le {formaterDate(r.created_at)}</span>
                    </div>
                    <Bouton
                      variante="secondaire"
                      taille="petit"
                      onClick={() => ouvrir(r)}
                      chargement={ouverture === r.code}
                      disabled={ouverture !== null}
                      iconeDroite={<ArrowRight size={15} />}
                    >
                      Ouvrir
                    </Bouton>
                  </Carte>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default function PageRetrait() {
  const [onglet, setOnglet] = useState("code");
  const [dossierTrouve, setDossierTrouve] = useState<Dossier | null>(null);
  const [tentativeScanner, setTentativeScanner] = useState(0);

  function changerOnglet(id: string) {
    setOnglet(id);
    setDossierTrouve(null);
  }

  // Focus sur le résultat dès qu'un dossier est retrouvé (lecteurs d'écran, clavier).
  const refResultat = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (dossierTrouve) refResultat.current?.focus();
  }, [dossierTrouve]);

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Retrait d'acte"
        sousTitre="Retrouvez un dossier à partir du code, du QR code ou du numéro de téléphone remis au déclarant."
      />

      <div className="eva-ag-parcours">
        <section className="eva-ag-parcours__etape" aria-labelledby="retrait-etape-1">
          <div id="retrait-etape-1">
            <TitreEtape numero={1} titre="Choisissez comment retrouver le dossier" fait={!!dossierTrouve} />
          </div>
          <Onglets
            variante="pilules"
            ariaLabel="Méthode de recherche"
            prefixeId={PREFIXE_ONGLETS}
            actif={onglet}
            onChanger={changerOnglet}
            onglets={[
              { id: "code", libelle: "Saisir un code", icone: <Keyboard size={16} aria-hidden="true" /> },
              { id: "scanner", libelle: "Scanner un QR", icone: <QrCode size={16} aria-hidden="true" /> },
              { id: "telephone", libelle: "Par téléphone", icone: <Phone size={16} aria-hidden="true" /> }
            ]}
          />
        </section>

        <section className="eva-ag-parcours__etape" aria-labelledby="retrait-etape-2">
          <div id="retrait-etape-2">
            <TitreEtape
              numero={2}
              titre={dossierTrouve ? "Dossier retrouvé" : onglet === "scanner" ? "Présentez le QR code" : onglet === "telephone" ? "Saisissez le numéro" : "Saisissez le code"}
              fait={!!dossierTrouve}
            />
          </div>
          <div role="tabpanel" id={`${PREFIXE_ONGLETS}-panneau-${onglet}`} aria-labelledby={`${PREFIXE_ONGLETS}-${onglet}`}>
            {dossierTrouve ? (
              <div ref={refResultat} tabIndex={-1} className="eva-ag-resultat-focus">
                <ResultatDossier dossier={dossierTrouve} onNouvelleRecherche={() => setDossierTrouve(null)} />
              </div>
            ) : onglet === "scanner" ? (
              <OngletScanner key={tentativeScanner} onTrouve={setDossierTrouve} onReessayer={() => setTentativeScanner((n) => n + 1)} />
            ) : onglet === "telephone" ? (
              <OngletTelephone onTrouve={setDossierTrouve} />
            ) : (
              <OngletCode onTrouve={setDossierTrouve} />
            )}
          </div>
        </section>
      </div>
    </MiseEnPage>
  );
}
