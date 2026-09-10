import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Phone, Search } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { Bouton, Carte, Champ, EnteteDePage, Onglets, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import type { CodeRetraitTrouve, Dossier } from "../../types/domaine";

const ID_LECTEUR = "eva-lecteur-qr";

function ResultatDossier({ dossier }: { dossier: Dossier }) {
  return (
    <Carte style={{ marginTop: 16, borderColor: "var(--couleur-emeraude)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Dossier {dossier.event_type === "naissance" ? "naissance" : "deces"}</div>
          <div className="texte-mono" style={{ fontSize: 12, color: "var(--couleur-gris-service-2)" }}>{dossier.id}</div>
        </div>
        <BadgeStatut statut={dossier.statut} />
      </div>
      <LienBouton to={`/agent/dossiers/${dossier.id}`}>Ouvrir le dossier</LienBouton>
    </Carte>
  );
}

function OngletScanner({ onTrouve }: { onTrouve: (d: Dossier) => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
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
          // erreur de decodage frame par frame : bruit normal, on ignore
        }
      )
      .then(() => {
        if (demonte) {
          // Composant demonte pendant le demarrage (changement d'onglet
          // rapide, StrictMode en dev) : la camera a bien demarre entre
          // temps, on l'arrete plutot que de laisser le flux ouvert.
          lecteur.stop().catch(() => undefined);
        } else {
          setActif(true);
        }
      })
      .catch(() => {
        if (!demonte) setErreur("Impossible d'acceder a la camera. Verifiez les autorisations du navigateur.");
      });

    return () => {
      demonte = true;
      // lecteur.stop() lance une exception SYNCHRONE (pas une promesse
      // rejetee) si le scan n'a pas encore demarre - inevitable si ce
      // cleanup s'execute avant la resolution de start() (StrictMode en dev
      // double les effets au montage). isScanning evite l'appel dans ce cas.
      if (lecteur.isScanning) {
        lecteur.stop().catch(() => undefined);
      }
    };
  }, [onTrouve]);

  return (
    <div>
      {erreur && <div className="message-erreur">{erreur}</div>}
      <div
        id={ID_LECTEUR}
        style={{ maxWidth: 360, margin: "0 auto", borderRadius: "var(--rayon-standard)", overflow: "hidden", background: "#000" }}
      />
      {!actif && !erreur && (
        <p style={{ textAlign: "center", color: "var(--couleur-gris-service-2)", fontSize: 13, marginTop: 10 }}>
          Demarrage de la camera...
        </p>
      )}
    </div>
  );
}

function OngletCode({ onTrouve }: { onTrouve: (d: Dossier) => void }) {
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function rechercher() {
    if (!code) return;
    setEnCours(true);
    setErreur(null);
    try {
      const dossier = await appelApi<Dossier>(`/codes-retrait/verifier/${code}`);
      onTrouve(dossier);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Code introuvable.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Carte style={{ maxWidth: 420 }}>
      <Champ id="code-retrait" label="Code de retrait">
        <input id="code-retrait" className="texte-mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex. AB12CD34" />
      </Champ>
      {erreur && <div className="message-erreur">{erreur}</div>}
      <Bouton onClick={rechercher} chargement={enCours} iconeGauche={<Search size={16} />}>
        Rechercher
      </Bouton>
    </Carte>
  );
}

function OngletTelephone({ onTrouve }: { onTrouve: (d: Dossier) => void }) {
  const [telephone, setTelephone] = useState("");
  const [resultats, setResultats] = useState<CodeRetraitTrouve[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function rechercher() {
    if (!telephone) return;
    setEnCours(true);
    setErreur(null);
    setResultats(null);
    try {
      const donnees = await appelApi<CodeRetraitTrouve[]>(`/codes-retrait/retrouver?telephone=${encodeURIComponent(telephone)}`);
      setResultats(donnees);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur de recherche.");
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrir(codeTrouve: CodeRetraitTrouve) {
    try {
      const dossier = await appelApi<Dossier>(`/codes-retrait/verifier/${codeTrouve.code}`);
      onTrouve(dossier);
    } catch {
      setErreur("Ce dossier n'est plus accessible.");
    }
  }

  return (
    <Carte style={{ maxWidth: 460 }}>
      <Champ id="telephone" label="Numero de telephone du declarant">
        <input id="telephone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex. 90112233" />
      </Champ>
      {erreur && <div className="message-erreur">{erreur}</div>}
      <Bouton onClick={rechercher} chargement={enCours} iconeGauche={<Phone size={16} />}>
        Rechercher
      </Bouton>

      {resultats && resultats.length === 0 && (
        <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--couleur-gris-service-2)" }}>Aucun code trouve pour ce numero.</p>
      )}
      {resultats && resultats.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Tableau>
            <thead>
              <tr>
                <th>Code</th>
                <th>Emis le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resultats.map((r) => (
                <tr key={r.code}>
                  <td className="texte-mono">{r.code}</td>
                  <td className="texte-mono">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <Bouton variante="fantome" taille="petit" onClick={() => ouvrir(r)}>
                      Ouvrir
                    </Bouton>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        </div>
      )}
    </Carte>
  );
}

export default function PageRetrait() {
  const [onglet, setOnglet] = useState("code");
  const [dossierTrouve, setDossierTrouve] = useState<Dossier | null>(null);

  function surTrouve(dossier: Dossier) {
    setDossierTrouve(dossier);
  }

  function changerOnglet(id: string) {
    setOnglet(id);
    setDossierTrouve(null);
  }

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage titre="Retrait" sousTitre="Retrouver un dossier a partir du code remis au parent/declarant." />
      <Onglets
        onglets={[
          { id: "code", libelle: "Saisir un code" },
          { id: "scanner", libelle: "Scanner un QR" },
          { id: "telephone", libelle: "Par telephone" }
        ]}
        actif={onglet}
        onChanger={changerOnglet}
      />

      {onglet === "scanner" && (
        <>
          {!dossierTrouve && (
            <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--couleur-gris-service-2)", marginBottom: 14, justifyContent: "center" }}>
              <Camera size={15} /> Autorisez l'acces a la camera puis presentez le QR code du declarant.
            </p>
          )}
          {!dossierTrouve && <OngletScanner onTrouve={surTrouve} />}
        </>
      )}
      {onglet === "code" && !dossierTrouve && <OngletCode onTrouve={surTrouve} />}
      {onglet === "telephone" && !dossierTrouve && <OngletTelephone onTrouve={surTrouve} />}

      {dossierTrouve && <ResultatDossier dossier={dossierTrouve} />}
    </MiseEnPage>
  );
}
