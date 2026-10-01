import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Building2, ImageOff, Upload, X } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Alerte, Badge, BarreEnregistrement, Bouton, Carte, Champ, EnteteDePage, EtatVide, Selecteur, Squelette, useConfirmation, useToast } from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { messageErreur } from "./outils";
import { listeDepuis, type ListeOuPaginee, type Mairie } from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export default function PersonnalisationMairie() {
  const toast = useToast();
  const confirmer = useConfirmation();
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [mairieId, setMairieId] = useState("");
  const [nom, setNom] = useState("");
  const [fichierLogo, setFichierLogo] = useState<File | null>(null);
  const [cleChampFichier, setCleChampFichier] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);
  const refChampFichier = useRef<HTMLInputElement>(null);

  function charger() {
    setChargement(true);
    setErreurChargement(null);
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => {
        const liste = listeDepuis(donnees);
        setMairies(liste);
        if (liste.length > 0) {
          setMairieId(liste[0].id);
          setNom(liste[0].nom);
        }
      })
      .catch((e) => setErreurChargement(messageErreur(e, "Impossible de charger les mairies.")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
  }, []);

  const mairieActive = mairies.find((m) => m.id === mairieId);

  // Aperçu local du fichier choisi, libéré à chaque changement.
  const urlApercu = useMemo(() => (fichierLogo ? URL.createObjectURL(fichierLogo) : null), [fichierLogo]);
  useEffect(() => {
    return () => {
      if (urlApercu) URL.revokeObjectURL(urlApercu);
    };
  }, [urlApercu]);

  const modifie = !!mairieActive && (nom !== mairieActive.nom || fichierLogo !== null);
  const logoAffiche = urlApercu ?? mairieActive?.logo ?? null;

  function viderFichier() {
    setFichierLogo(null);
    setCleChampFichier((n) => n + 1);
  }

  function reinitialiser() {
    setNom(mairieActive?.nom || "");
    viderFichier();
    setErreurEnregistrement(null);
  }

  async function changerMairie(id: string) {
    if (id === mairieId) return;
    if (modifie) {
      const ok = await confirmer({
        titre: "Abandonner les modifications ?",
        description: "Les changements non enregistrés de cette mairie seront perdus.",
        libelleConfirmer: "Abandonner"
      });
      if (!ok) return;
    }
    setMairieId(id);
    setNom(mairies.find((m) => m.id === id)?.nom || "");
    viderFichier();
    setErreurEnregistrement(null);
  }

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!mairieId) return;
    setEnregistrement(true);
    setErreurEnregistrement(null);
    try {
      const donnees = new FormData();
      donnees.set("nom", nom);
      if (fichierLogo) donnees.set("logo", fichierLogo);

      const misAJour = await appelApi<Mairie>(`/mairies/${mairieId}/personnalisation/`, {
        methode: "PATCH",
        corps: donnees,
        estFormData: true
      });
      setMairies((precedent) => precedent.map((m) => (m.id === mairieId ? misAJour : m)));
      setNom(misAJour.nom);
      viderFichier();
      toast.succes("Mairie personnalisée. Les prochains actes générés utiliseront ce logo.");
    } catch (e) {
      setErreurEnregistrement(messageErreur(e, "L'enregistrement a échoué. Vos modifications sont conservées, réessayez."));
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) {
    return (
      <MiseEnPage liens={LIENS_ADMIN_CEC}>
        <EnteteDePage titre="Personnalisation" sousTitre="Nom affiché et logo utilisés sur les actes PDF générés pour une mairie de votre périmètre." />
        <div className="eva-grille eva-grille--2-1 eva-grille--debut">
          <Squelette variante="carte" />
          <Squelette variante="carte" />
        </div>
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Personnalisation"
        sousTitre="Nom affiché et logo utilisés sur les actes PDF générés pour une mairie de votre périmètre."
        badges={mairies.length === 1 && mairieActive ? <Badge variante="neutre">{mairieActive.nom}</Badge> : undefined}
      />

      {erreurChargement ? (
        <EtatVide
          variante="erreur"
          icone={<Building2 size={26} />}
          titre="Chargement impossible"
          description={erreurChargement}
          action={
            <Bouton variante="secondaire" onClick={charger}>
              Réessayer
            </Bouton>
          }
        />
      ) : mairies.length === 0 ? (
        <EtatVide icone={<Building2 size={26} />} titre="Aucune mairie dans votre périmètre" description="La personnalisation s'applique aux mairies rattachées à votre zone." />
      ) : (
        <form onSubmit={enregistrer} className="eva-ac-formulaire-page">
          <div className="eva-grille eva-grille--2-1 eva-grille--debut">
            <Carte titre="Identité de la mairie" description="Nom et logo de la mairie sélectionnée.">
              {mairies.length > 1 && (
                <Champ id="mairie-select" label="Mairie" requis>
                  <Selecteur id="mairie-select" valeur={mairieId} onChange={(v) => void changerMairie(v)}>
                    {mairies.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom}
                      </option>
                    ))}
                  </Selecteur>
                </Champ>
              )}

              <Champ id="nom-mairie" label="Nom affiché" requis aide="Apparaît sur les actes PDF, les SMS et le formulaire de complétion en ligne.">
                <input id="nom-mairie" required value={nom} onChange={(e) => setNom(e.target.value)} />
              </Champ>

              <Champ id="logo-mairie" label="Logo" aide="Image PNG ou JPEG, affichée en en-tête des actes générés pour cette mairie.">
                <input
                  key={cleChampFichier}
                  ref={refChampFichier}
                  id="logo-mairie"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setFichierLogo(e.target.files?.[0] || null)}
                />
              </Champ>

              {fichierLogo && (
                <div className="eva-ac-fichier" role="status">
                  <Upload size={16} aria-hidden="true" />
                  <span className="eva-ac-fichier__nom">{fichierLogo.name}</span>
                  <span className="eva-ac-fichier__taille texte-mono">{formaterTaille(fichierLogo.size)}</span>
                  <Bouton type="button" variante="fantome" taille="petit" iconeSeule iconeGauche={<X size={14} />} aria-label="Retirer le fichier choisi" onClick={viderFichier} />
                </div>
              )}
            </Carte>

            <Carte titre="Aperçu de l'en-tête" description="Rendu indicatif sur un acte PDF.">
              <div className="eva-ac-apercu">
                <div className="eva-ac-apercu__logo">
                  {logoAffiche ? (
                    <img src={logoAffiche} alt={fichierLogo ? "Nouveau logo (aperçu)" : "Logo actuel de la mairie"} />
                  ) : (
                    <span className="eva-ac-apercu__absent">
                      <ImageOff size={22} aria-hidden="true" />
                      Aucun logo
                    </span>
                  )}
                </div>
                <div className="eva-ac-apercu__texte">
                  <span className="eva-ac-apercu__republique">République togolaise</span>
                  <strong className="eva-ac-apercu__nom">{nom.trim() || "Nom de la mairie"}</strong>
                  {mairieActive?.adresse && <span className="eva-ac-apercu__detail">{mairieActive.adresse}</span>}
                  {mairieActive?.telephone && <span className="eva-ac-apercu__detail texte-mono">{mairieActive.telephone}</span>}
                </div>
              </div>
              {fichierLogo ? (
                <Alerte variante="info" compacte>
                  Nouveau logo sélectionné : il ne sera appliqué qu'après l'enregistrement.
                </Alerte>
              ) : (
                <p className="eva-texte-petit eva-texte-discret eva-sans-marge">
                  {mairieActive?.logo ? "Logo actuellement utilisé sur les actes." : "Aucun logo n'est défini : les actes sont générés sans logo."}
                </p>
              )}
            </Carte>
          </div>

          <BarreEnregistrement
            modifie={modifie}
            enregistrement={enregistrement}
            erreur={erreurEnregistrement}
            typeEnregistrer="submit"
            onAnnuler={reinitialiser}
            avertirAvantDepart
          />
        </form>
      )}
    </MiseEnPage>
  );
}
