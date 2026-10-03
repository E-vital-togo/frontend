import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BellRing, CalendarClock, MapPin, MoreHorizontal, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import {
  Alerte,
  Badge,
  BarreOutils,
  Bouton,
  Carte,
  Champ,
  EnteteDePage,
  EtatVide,
  ItemMenu,
  MenuDeroulant,
  Modale,
  PilulesFiltre,
  Selecteur,
  SeparateurMenu,
  Squelette,
  useConfirmation,
  useToast,
  type PiluleFiltre
} from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import { useMonTerritoire } from "../../lib/useMonTerritoire";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDate, messageErreur } from "./outils";
import {
  listeDepuis,
  type CampagneRelance,
  type ListeOuPaginee,
  type Mairie,
  type TypeEvenement
} from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";

interface FormulaireCampagne {
  territoire: string;
  event_type: TypeEvenement | "";
  seuils_jours: string;
  message_modele: string;
  actif: boolean;
}

type FiltreCampagne = "" | "actives" | "inactives";

const VIDE: FormulaireCampagne = { territoire: "", event_type: "", seuils_jours: "10, 3", message_modele: "", actif: true };

const LIBELLES_CIBLE: Record<string, string> = {
  naissance: "Naissances",
  deces: "Décès"
};

const VARIABLES_MESSAGE = ["{mairie}", "{code}", "{jours_restants}", "{lien_completion}"];

/** Convertit la saisie "10, 3" en liste de nombres ; `null` si une valeur est invalide. */
function analyserSeuils(texte: string): number[] | null {
  const seuils = texte
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map(Number);
  return seuils.some((n) => Number.isNaN(n) || n < 0) ? null : seuils;
}

export default function CampagnesRelance() {
  const monTerritoire = useMonTerritoire();
  const toast = useToast();
  const confirmer = useConfirmation();

  const [campagnes, setCampagnes] = useState<CampagneRelance[]>([]);
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<FiltreCampagne>("");
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [campagneEnEdition, setCampagneEnEdition] = useState<CampagneRelance | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireCampagne>(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const refMessage = useRef<HTMLTextAreaElement>(null);

  function charger() {
    setChargement(true);
    setErreurChargement(null);
    appelApi<ListeOuPaginee<CampagneRelance>>("/campagnes-relance/")
      .then((donnees) => setCampagnes(listeDepuis(donnees)))
      .catch((e) => setErreurChargement(messageErreur(e, "Impossible de charger les campagnes.")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

  const decompte = useMemo(
    () => ({
      toutes: campagnes.length,
      actives: campagnes.filter((c) => c.actif).length,
      inactives: campagnes.filter((c) => !c.actif).length
    }),
    [campagnes]
  );

  const pilules: PiluleFiltre<FiltreCampagne>[] = [
    { valeur: "", libelle: "Toutes", compteur: decompte.toutes },
    { valeur: "actives", libelle: "Actives", compteur: decompte.actives },
    { valeur: "inactives", libelle: "Inactives", compteur: decompte.inactives }
  ];

  const campagnesAffichees = campagnes.filter((c) => (filtre === "actives" ? c.actif : filtre === "inactives" ? !c.actif : true));

  function ouvrirCreation() {
    setCampagneEnEdition(null);
    setFormulaire({ ...VIDE, territoire: monTerritoire?.id || "" });
    setErreur(null);
    setModaleOuverte(true);
  }

  function ouvrirEdition(c: CampagneRelance) {
    setCampagneEnEdition(c);
    setFormulaire({
      territoire: c.territoire,
      event_type: c.event_type || "",
      seuils_jours: c.seuils_jours.join(", "),
      message_modele: c.message_modele,
      actif: c.actif
    });
    setErreur(null);
    setModaleOuverte(true);
  }

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const seuils = analyserSeuils(formulaire.seuils_jours);
    if (seuils === null) {
      setErreur("Les seuils doivent être des nombres de jours positifs séparés par des virgules, par exemple 10, 3.");
      return;
    }

    setEnCours(true);
    const corps = {
      territoire: formulaire.territoire,
      event_type: formulaire.event_type || null,
      seuils_jours: seuils,
      message_modele: formulaire.message_modele,
      actif: formulaire.actif
    };
    try {
      if (campagneEnEdition) {
        await appelApi(`/campagnes-relance/${campagneEnEdition.id}/`, { methode: "PATCH", corps });
        toast.succes("Campagne mise à jour.");
      } else {
        await appelApi("/campagnes-relance/", { methode: "POST", corps });
        toast.succes("Campagne créée.");
      }
      setModaleOuverte(false);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer(c: CampagneRelance) {
    const ok = await confirmer({
      titre: "Supprimer cette campagne ?",
      description: `Le comportement par défaut national (relances à J-10 et J-3, message générique) s'appliquera de nouveau pour ${c.territoire_nom}.`,
      libelleConfirmer: "Supprimer",
      dangereux: true
    });
    if (!ok) return;
    try {
      await appelApi(`/campagnes-relance/${c.id}/`, { methode: "DELETE" });
      toast.succes("Campagne supprimée.");
      charger();
    } catch (e) {
      toast.erreur(messageErreur(e));
    }
  }

  function insererVariable(variable: string) {
    const champ = refMessage.current;
    const debut = champ?.selectionStart ?? formulaire.message_modele.length;
    const fin = champ?.selectionEnd ?? debut;
    const texte = formulaire.message_modele;
    setFormulaire({ ...formulaire, message_modele: `${texte.slice(0, debut)}${variable}${texte.slice(fin)}` });
    window.requestAnimationFrame(() => {
      champ?.focus();
      champ?.setSelectionRange(debut + variable.length, debut + variable.length);
    });
  }

  const seuilsSaisis = analyserSeuils(formulaire.seuils_jours);
  const erreurSeuils = seuilsSaisis === null ? "Saisissez des nombres de jours séparés par des virgules, par exemple 10, 3." : undefined;

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Campagnes de relance"
        sousTitre="Personnalisez les échéances et le message envoyés au parent ou déclarant avant l'expiration d'un dossier, pour votre zone ou une commune en particulier."
        actions={
          <Bouton onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
            Nouvelle campagne
          </Bouton>
        }
      />

      {campagnes.length > 0 && (
        <BarreOutils
          carte
          filtres={<PilulesFiltre ariaLabel="Filtrer les campagnes" valeur={filtre} onChanger={setFiltre} pilules={pilules} />}
          compteur={compterAvecUnite(campagnesAffichees.length, "campagne")}
        />
      )}

      {chargement && campagnes.length === 0 ? (
        <div className="eva-ac-campagnes" aria-busy="true">
          <Squelette variante="carte" />
          <Squelette variante="carte" />
          <Squelette variante="carte" />
        </div>
      ) : erreurChargement ? (
        <EtatVide
          variante="erreur"
          icone={<Megaphone size={26} />}
          titre="Chargement impossible"
          description={erreurChargement}
          action={
            <Bouton variante="secondaire" onClick={charger}>
              Réessayer
            </Bouton>
          }
        />
      ) : campagnes.length === 0 ? (
        <EtatVide
          icone={<Megaphone size={26} />}
          titre="Aucune campagne personnalisée"
          description="Le comportement par défaut national s'applique : relances à J-10 et J-3, message générique."
          action={
            <Bouton onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
              Créer une campagne
            </Bouton>
          }
        />
      ) : campagnesAffichees.length === 0 ? (
        <EtatVide
          icone={<Megaphone size={26} />}
          titre="Aucune campagne dans cette catégorie"
          action={
            <Bouton variante="secondaire" onClick={() => setFiltre("")}>
              Voir toutes les campagnes
            </Bouton>
          }
        />
      ) : (
        <ul className={chargement ? "eva-ac-campagnes eva-ac-campagnes--charge" : "eva-ac-campagnes"} aria-label="Campagnes de relance">
          {campagnesAffichees.map((c) => (
            <li key={c.id}>
              <Carte className={c.actif ? "eva-ac-campagne" : "eva-ac-campagne eva-ac-campagne--inactive"} variante={c.actif ? "defaut" : "plate"}>
                <div className="eva-ac-campagne__entete">
                  <div className="eva-ac-campagne__titre">
                    <MapPin size={16} aria-hidden="true" />
                    <h2>{c.territoire_nom}</h2>
                  </div>
                  <div className="eva-ac-campagne__outils">
                    <Badge variante={c.actif ? "succes" : "neutre"} point>
                      {c.actif ? "Active" : "Inactive"}
                    </Badge>
                    <MenuDeroulant ariaLabel={`Actions pour la campagne ${c.territoire_nom}`} declencheur={<MoreHorizontal size={16} />}>
                      <ItemMenu icone={Pencil} onClick={() => ouvrirEdition(c)}>
                        Modifier
                      </ItemMenu>
                      <SeparateurMenu />
                      <ItemMenu icone={Trash2} danger onClick={() => supprimer(c)}>
                        Supprimer
                      </ItemMenu>
                    </MenuDeroulant>
                  </div>
                </div>

                <dl className="eva-ac-campagne__infos">
                  <div>
                    <dt>
                      <BellRing size={14} aria-hidden="true" /> Cible
                    </dt>
                    <dd>{c.event_type ? LIBELLES_CIBLE[c.event_type] : "Naissances et décès"}</dd>
                  </div>
                  <div>
                    <dt>
                      <CalendarClock size={14} aria-hidden="true" /> Relances
                    </dt>
                    <dd>
                      {c.seuils_jours.length > 0 ? (
                        <span className="eva-ac-seuils">
                          {c.seuils_jours.map((s) => (
                            <Badge key={s} variante="attente" mono>
                              J-{s}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="eva-texte-discret">Défaut national</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <p className={c.message_modele ? "eva-ac-campagne__message" : "eva-ac-campagne__message eva-ac-campagne__message--defaut"}>
                  {c.message_modele || "Message générique par défaut"}
                </p>

                <div className="eva-ac-campagne__pied">
                  <span className="eva-texte-petit eva-texte-discret">Modifiée le {formaterDate(c.updated_at)}</span>
                  <Bouton variante="secondaire" taille="petit" iconeGauche={<Pencil size={14} />} onClick={() => ouvrirEdition(c)}>
                    Modifier
                  </Bouton>
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      )}

      {modaleOuverte && (
        <Modale
          titre={campagneEnEdition ? "Modifier la campagne" : "Nouvelle campagne de relance"}
          description="Les relances sont envoyées automatiquement aux déclarants dont le dossier approche de l'échéance."
          onFermer={() => setModaleOuverte(false)}
          taille="large"
          fermerAuClicFond={false}
          actions={
            <>
              <Bouton type="button" variante="fantome" onClick={() => setModaleOuverte(false)}>
                Annuler
              </Bouton>
              <Bouton type="submit" form="formulaire-campagne" chargement={enCours}>
                Enregistrer
              </Bouton>
            </>
          }
        >
          <form id="formulaire-campagne" onSubmit={enregistrer}>
            {erreur && (
              <div className="eva-ac-alerte-formulaire">
                <Alerte variante="erreur" onFermer={() => setErreur(null)}>
                  {erreur}
                </Alerte>
              </div>
            )}

            <fieldset className="eva-ac-groupe">
              <legend className="eva-ac-groupe__titre">Périmètre</legend>
              <div className="eva-grille eva-grille--2 eva-grille--serree">
                <Champ id="campagne-territoire" label="S'applique à" requis>
                  <Selecteur
                    id="campagne-territoire"
                    requis
                    placeholder="Sélectionner..."
                    valeur={formulaire.territoire}
                    onChange={(v) => setFormulaire({ ...formulaire, territoire: v })}
                  >
                    {monTerritoire && <option value={monTerritoire.id}>Toute ma zone ({monTerritoire.nom})</option>}
                    {mairies.map((m) => (
                      <option key={m.territoire} value={m.territoire}>
                        Commune de {m.nom}
                      </option>
                    ))}
                  </Selecteur>
                </Champ>
                <Champ id="campagne-event" label="Type d'événement">
                  <Selecteur
                    id="campagne-event"
                    valeur={formulaire.event_type}
                    onChange={(v) => setFormulaire({ ...formulaire, event_type: v as TypeEvenement | "" })}
                  >
                    <option value="">Naissance et décès</option>
                    <option value="naissance">Naissance uniquement</option>
                    <option value="deces">Décès uniquement</option>
                  </Selecteur>
                </Champ>
              </div>
            </fieldset>

            <fieldset className="eva-ac-groupe">
              <legend className="eva-ac-groupe__titre">Échéances</legend>
              <Champ
                id="campagne-seuils"
                label="Seuils de relance (jours avant l'échéance)"
                aide="Nombres séparés par des virgules, par exemple 10, 3. Laissez vide pour reprendre le défaut national."
                erreur={erreurSeuils}
              >
                <input
                  id="campagne-seuils"
                  inputMode="numeric"
                  value={formulaire.seuils_jours}
                  onChange={(e) => setFormulaire({ ...formulaire, seuils_jours: e.target.value })}
                  placeholder="10, 3"
                />
              </Champ>
              <div className="eva-ac-apercu-seuils" aria-live="polite">
                {seuilsSaisis !== null && <span className="eva-texte-petit eva-texte-discret">Relances prévues :</span>}
                {seuilsSaisis === null ? null : seuilsSaisis.length === 0 ? (
                  <Badge variante="neutre">Défaut national (J-10, J-3)</Badge>
                ) : (
                  seuilsSaisis.map((s, i) => (
                    <Badge key={`${s}-${i}`} variante="attente" mono>
                      J-{s}
                    </Badge>
                  ))
                )}
              </div>
            </fieldset>

            <fieldset className="eva-ac-groupe">
              <legend className="eva-ac-groupe__titre">Message</legend>
              <Champ
                id="campagne-message"
                label="Message personnalisé"
                aide="Laissez vide pour utiliser le message générique par défaut."
              >
                <textarea
                  id="campagne-message"
                  ref={refMessage}
                  rows={3}
                  value={formulaire.message_modele}
                  onChange={(e) => setFormulaire({ ...formulaire, message_modele: e.target.value })}
                  placeholder="RECVIT - Rappel : il vous reste {jours_restants} jour(s)..."
                />
              </Champ>
              <div className="eva-ac-variables">
                <span className="eva-texte-petit eva-texte-discret">Insérer une variable :</span>
                {VARIABLES_MESSAGE.map((v) => (
                  <button key={v} type="button" className="eva-ac-variable texte-mono" onClick={() => insererVariable(v)}>
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="eva-ac-groupe">
              <legend className="eva-ac-groupe__titre">État</legend>
              <label className="eva-ac-case">
                <input type="checkbox" checked={formulaire.actif} onChange={(e) => setFormulaire({ ...formulaire, actif: e.target.checked })} />
                Campagne active
              </label>
            </fieldset>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
