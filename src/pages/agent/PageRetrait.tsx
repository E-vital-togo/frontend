import { useEffect, useRef, useState, type FormEvent } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowRight, Baby, Camera, CheckCircle2, Flower2, Keyboard, PackageCheck, Phone, QrCode, RotateCcw, Search } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import BadgeRetrait from "../../components/retrait/BadgeRetrait";
import ModaleRemiseActe from "../../components/retrait/ModaleRemiseActe";
import OngletTelephoneRetrait from "../../components/retrait/OngletTelephoneRetrait";
import { Alerte, Bouton, Carte, Champ, EnteteDePage, LienBouton, Onglets, Spinner } from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import { LIENS_AGENT } from "./navigation";
import type { Dossier, ResumeRetrait } from "../../types/domaine";
import "../../styles/agent.css";
import "../../styles/retrait.css";

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

function ResultatDossier({ dossier, onNouvelleRecherche, onRetire }: { dossier: Dossier; onNouvelleRecherche: () => void; onRetire: (retrait: ResumeRetrait) => void }) {
  const naissance = dossier.event_type === "naissance";
  const enLigne = useConnectivite();
  const [remiseOuverte, setRemiseOuverte] = useState(false);
  const peutRemettre = dossier.etat_retrait === "a_retirer";
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
        <span className="eva-ag-statuts">
          <BadgeStatut statut={dossier.statut} />
          <BadgeRetrait etat={dossier.etat_retrait} retireLe={dossier.retire_le} retirePar={dossier.retrait?.retire_par_nom} masquerNonEmis />
        </span>
      </div>
      <dl className="eva-definitions">
        <dt>Nom</dt>
        <dd>{dossier.nom || "Non renseigné"}</dd>
        <dt>Date de déclaration</dt>
        <dd>{formaterDate(dossier.date_declaration)}</dd>
        <dt>Date limite</dt>
        <dd>{formaterDate(dossier.date_limite)}</dd>
      </dl>
      {dossier.etat_retrait === "retire" && (
        <p className="eva-rt-carte__note">
          Acte déjà remis{dossier.retrait?.retire_nom_receveur ? ` à ${dossier.retrait.retire_nom_receveur}` : ""}. Il ne peut pas être remis une seconde fois.
        </p>
      )}
      <div className="eva-groupe-boutons eva-ag-resultat__actions">
        {peutRemettre && (
          <Bouton
            onClick={() => setRemiseOuverte(true)}
            disabled={!enLigne}
            title={enLigne ? undefined : "Le retrait nécessite une connexion"}
            iconeGauche={<PackageCheck size={16} />}
          >
            Remettre l'acte
          </Bouton>
        )}
        <LienBouton to={`/agent/dossiers/${dossier.id}`} variante="secondaire" iconeDroite={<ArrowRight size={16} />}>
          Ouvrir le dossier
        </LienBouton>
        <Bouton variante="secondaire" onClick={onNouvelleRecherche} iconeGauche={<RotateCcw size={16} />}>
          Nouvelle recherche
        </Bouton>
      </div>
      {remiseOuverte && (
        <ModaleRemiseActe
          idDossier={dossier.id}
          basePath="/agent"
          libelleFin="Nouvelle recherche"
          onRetire={onRetire}
          onDejaRetire={onRetire}
          onFermer={() => setRemiseOuverte(false)}
          onTerminer={() => {
            setRemiseOuverte(false);
            onNouvelleRecherche();
          }}
        />
      )}
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
        sousTitre="Retrouvez un dossier à partir du code, du QR code ou du numéro de téléphone du déclarant, puis remettez l'acte."
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
                <ResultatDossier
                  dossier={dossierTrouve}
                  onNouvelleRecherche={() => setDossierTrouve(null)}
                  onRetire={(retrait) =>
                    setDossierTrouve((d) => (d ? { ...d, etat_retrait: "retire", retire_le: retrait.retire_le, retrait } : d))
                  }
                />
              </div>
            ) : onglet === "scanner" ? (
              <OngletScanner key={tentativeScanner} onTrouve={setDossierTrouve} onReessayer={() => setTentativeScanner((n) => n + 1)} />
            ) : onglet === "telephone" ? (
              <OngletTelephoneRetrait />
            ) : (
              <OngletCode onTrouve={setDossierTrouve} />
            )}
          </div>
        </section>
      </div>
    </MiseEnPage>
  );
}
