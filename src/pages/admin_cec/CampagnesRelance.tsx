import { useEffect, useState, type FormEvent } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Bouton, Champ, ChargementPage, EnteteDePage, EtatVide, Modale, Tableau } from "../../components/ui";
import { useConfirmation } from "../../components/ui/ConfirmationProvider";
import { useToast } from "../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useMonTerritoire } from "../../lib/useMonTerritoire";
import { LIENS_ADMIN_CEC } from "./navigation";
import {
  listeDepuis,
  type CampagneRelance,
  type ListeOuPaginee,
  type Mairie,
  type TypeEvenement
} from "../../types/domaine";

interface FormulaireCampagne {
  territoire: string;
  event_type: TypeEvenement | "";
  seuils_jours: string;
  message_modele: string;
  actif: boolean;
}

const VIDE: FormulaireCampagne = { territoire: "", event_type: "", seuils_jours: "10, 3", message_modele: "", actif: true };

const LIBELLES_EVENEMENT: Record<string, string> = { naissance: "Naissance", deces: "Deces" };

export default function CampagnesRelance() {
  const monTerritoire = useMonTerritoire();
  const toast = useToast();
  const confirmer = useConfirmation();

  const [campagnes, setCampagnes] = useState<CampagneRelance[]>([]);
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [chargement, setChargement] = useState(true);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [campagneEnEdition, setCampagneEnEdition] = useState<CampagneRelance | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireCampagne>(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function charger() {
    setChargement(true);
    appelApi<ListeOuPaginee<CampagneRelance>>("/campagnes-relance/")
      .then((donnees) => setCampagnes(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

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

    const seuils = formulaire.seuils_jours
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map(Number);
    if (seuils.some((n) => Number.isNaN(n) || n < 0)) {
      setErreur("Les seuils doivent etre des nombres de jours positifs separes par des virgules, ex. 10, 3.");
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
        toast.succes("Campagne mise a jour.");
      } else {
        await appelApi("/campagnes-relance/", { methode: "POST", corps });
        toast.succes("Campagne creee.");
      }
      setModaleOuverte(false);
      charger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer(c: CampagneRelance) {
    const ok = await confirmer({
      titre: "Supprimer cette campagne ?",
      description: `Le comportement par defaut national (relances a J-10/J-3, message generique) s'appliquera de nouveau pour ${c.territoire_nom}.`,
      libelleConfirmer: "Supprimer",
      dangereux: true
    });
    if (!ok) return;
    try {
      await appelApi(`/campagnes-relance/${c.id}/`, { methode: "DELETE" });
      toast.succes("Campagne supprimee.");
      charger();
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur inattendue.");
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Campagnes de relance"
        sousTitre="Personnalisez les echeances et le message envoyes au parent/declarant avant expiration d'un dossier, pour votre zone ou une commune en particulier."
        actions={
          <Bouton onClick={ouvrirCreation} iconeGauche={<Plus size={16} />}>
            Nouvelle campagne
          </Bouton>
        }
      />

      {chargement ? (
        <ChargementPage />
      ) : campagnes.length === 0 ? (
        <EtatVide
          icone={<Megaphone size={28} />}
          titre="Aucune campagne personnalisee"
          description="Le comportement par defaut national s'applique : relances a J-10 et J-3, message generique."
        />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Territoire</th>
              <th>Evenement</th>
              <th>Seuils (jours)</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campagnes.map((c) => (
              <tr key={c.id}>
                <td>{c.territoire_nom}</td>
                <td>{c.event_type ? LIBELLES_EVENEMENT[c.event_type] : "Naissance + Deces"}</td>
                <td className="texte-mono">{c.seuils_jours.length > 0 ? c.seuils_jours.join(", ") : "Defaut national"}</td>
                <td>
                  <span className={`eva-badge ${c.actif ? "eva-badge--succes" : "eva-badge--neutre"}`}>
                    {c.actif ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <Bouton variante="fantome" taille="petit" onClick={() => ouvrirEdition(c)} iconeGauche={<Pencil size={14} />}>
                    Modifier
                  </Bouton>
                  <Bouton variante="fantome" taille="petit" onClick={() => supprimer(c)} iconeGauche={<Trash2 size={14} />}>
                    Supprimer
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {modaleOuverte && (
        <Modale titre={campagneEnEdition ? "Modifier la campagne" : "Nouvelle campagne de relance"} onFermer={() => setModaleOuverte(false)} large>
          <form onSubmit={enregistrer}>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <Champ id="campagne-territoire" label="S'applique a" requis>
              <select
                id="campagne-territoire"
                required
                value={formulaire.territoire}
                onChange={(e) => setFormulaire({ ...formulaire, territoire: e.target.value })}
              >
                <option value="">Selectionner...</option>
                {monTerritoire && <option value={monTerritoire.id}>Toute ma zone ({monTerritoire.nom})</option>}
                {mairies.map((m) => (
                  <option key={m.territoire} value={m.territoire}>
                    Commune de {m.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ id="campagne-event" label="Type d'evenement">
              <select
                id="campagne-event"
                value={formulaire.event_type}
                onChange={(e) => setFormulaire({ ...formulaire, event_type: e.target.value as TypeEvenement | "" })}
              >
                <option value="">Naissance et deces</option>
                <option value="naissance">Naissance uniquement</option>
                <option value="deces">Deces uniquement</option>
              </select>
            </Champ>
            <Champ id="campagne-seuils" label="Seuils de relance (jours avant echeance)" aide="Nombres separes par des virgules, ex. 10, 3. Laisser vide pour reprendre le defaut national.">
              <input
                id="campagne-seuils"
                value={formulaire.seuils_jours}
                onChange={(e) => setFormulaire({ ...formulaire, seuils_jours: e.target.value })}
                placeholder="10, 3"
              />
            </Champ>
            <Champ
              id="campagne-message"
              label="Message personnalise"
              aide="Vide = message generique par defaut. Variables disponibles : {mairie}, {code}, {jours_restants}, {lien_completion}."
            >
              <textarea
                id="campagne-message"
                rows={3}
                value={formulaire.message_modele}
                onChange={(e) => setFormulaire({ ...formulaire, message_modele: e.target.value })}
                placeholder="E-Vital - Rappel : il vous reste {jours_restants} jour(s)..."
              />
            </Champ>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, marginBottom: 16 }}>
              <input type="checkbox" checked={formulaire.actif} onChange={(e) => setFormulaire({ ...formulaire, actif: e.target.checked })} />
              Campagne active
            </label>
            <div className="eva-modale__actions">
              <Bouton type="button" variante="fantome" onClick={() => setModaleOuverte(false)}>
                Annuler
              </Bouton>
              <Bouton type="submit" chargement={enCours}>
                Enregistrer
              </Bouton>
            </div>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
