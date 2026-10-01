import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, KeyRound, Mail, RefreshCw, Save, ShieldCheck } from "lucide-react";
import ChampMotDePasse from "../components/auth/ChampMotDePasse";
import { accentuer } from "../components/auth/messagesAuth";
import MiseEnPage from "../components/MiseEnPage";
import { Alerte, Avatar, Badge, Bouton, Carte, Champ, EnteteDePage, Squelette } from "../components/ui";
import { useToast } from "../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { LIENS_AGENT } from "./agent/navigation";
import { LIENS_ADMIN_CEC } from "./admin_cec/navigation";
import type { Utilisateur } from "../types/domaine";
import "../styles/auth.css";

const LIBELLES_ROLE: Record<string, string> = {
  agent_cec: "Agent d'état civil",
  admin_cec: "Administrateur CEC",
  admin_inseed: "Administrateur INSEED",
  admin_general: "Administrateur général"
};

function dateLongue(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function PageMonCompte() {
  const { utilisateur: utilisateurConnecte } = useAuth();
  const toast = useToast();
  const liens = utilisateurConnecte?.role === "admin_cec" ? LIENS_ADMIN_CEC : LIENS_AGENT;

  const [profil, setProfil] = useState<Utilisateur | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [nom, setNom] = useState("");
  const [prenoms, setPrenoms] = useState("");
  const [enregistrementProfil, setEnregistrementProfil] = useState(false);

  const [ancienMotDePasse, setAncienMotDePasse] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState("");
  const [changementEnCours, setChangementEnCours] = useState(false);
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | null>(null);

  const charger = useCallback(() => {
    setErreurChargement(false);
    appelApi<Utilisateur>("/utilisateurs/me/")
      .then((donnees) => {
        setProfil(donnees);
        setNom(donnees.nom);
        setPrenoms(donnees.prenoms);
      })
      .catch(() => setErreurChargement(true));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function enregistrerProfil(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnregistrementProfil(true);
    try {
      const donnees = await appelApi<Utilisateur>("/utilisateurs/me/", { methode: "PATCH", corps: { nom, prenoms } });
      setProfil(donnees);
      toast.succes("Profil mis à jour.");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? accentuer(e.message) : "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrementProfil(false);
    }
  }

  async function changerMotDePasse(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurMotDePasse(null);
    if (nouveauMotDePasse !== confirmationMotDePasse) {
      setErreurMotDePasse("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setChangementEnCours(true);
    try {
      await appelApi("/auth/changer-mot-de-passe", {
        methode: "POST",
        corps: { ancien_mot_de_passe: ancienMotDePasse, nouveau_mot_de_passe: nouveauMotDePasse }
      });
      setAncienMotDePasse("");
      setNouveauMotDePasse("");
      setConfirmationMotDePasse("");
      toast.succes("Mot de passe modifié.");
    } catch (e) {
      setErreurMotDePasse(e instanceof ErreurApi ? accentuer(e.message) : "Erreur inattendue.");
    } finally {
      setChangementEnCours(false);
    }
  }

  if (erreurChargement && !profil) {
    return (
      <MiseEnPage liens={liens}>
        <EnteteDePage titre="Mon compte" />
        <Alerte
          variante="erreur"
          titre="Profil indisponible"
          actions={
            <Bouton type="button" variante="secondaire" taille="petit" iconeGauche={<RefreshCw size={15} />} onClick={charger}>
              Réessayer
            </Bouton>
          }
        >
          Impossible de charger vos informations. Vérifiez votre connexion, puis réessayez.
        </Alerte>
      </MiseEnPage>
    );
  }

  if (!profil) {
    return (
      <MiseEnPage liens={liens}>
        <EnteteDePage titre="Mon compte" sousTitre="Chargement de votre profil..." />
        <div className="eva-acces-compte" role="status" aria-busy="true">
          <span className="eva-sr-only">Chargement de votre profil</span>
          <Squelette variante="carte" lignes={1} libelle="" />
          <div className="eva-grille eva-grille--2 eva-grille--debut">
            <Squelette variante="carte" lignes={4} libelle="" />
            <Squelette variante="carte" lignes={4} libelle="" />
          </div>
        </div>
      </MiseEnPage>
    );
  }

  const modifie = nom !== profil.nom || prenoms !== profil.prenoms;
  const depuis = dateLongue(profil.date_joined);
  const confirmationDifferente = confirmationMotDePasse.length > 0 && confirmationMotDePasse !== nouveauMotDePasse;

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage titre="Mon compte" sousTitre="Vos informations personnelles et la sécurité de votre accès." />

      <div className="eva-acces-compte">
        <Carte className="eva-acces-identite">
          <Avatar nom={profil.nom} prenoms={profil.prenoms} taille="grand" />
          <div className="eva-acces-identite__texte">
            <p className="eva-acces-identite__nom">
              {profil.prenoms} {profil.nom}
            </p>
            <Badge variante="info">{LIBELLES_ROLE[profil.role] || profil.role}</Badge>
          </div>
          <ul className="eva-acces-identite__details">
            <li>
              <Mail size={16} aria-hidden="true" />
              <span className="eva-sr-only">Email : </span>
              <span className="texte-mono">{profil.email}</span>
            </li>
            {depuis && (
              <li>
                <CalendarDays size={16} aria-hidden="true" />
                Membre depuis le {depuis}
              </li>
            )}
          </ul>
        </Carte>

        <div className="eva-grille eva-grille--2 eva-grille--debut">
          <form onSubmit={enregistrerProfil}>
            <Carte
              titre="Informations personnelles"
              description="Votre email, votre rôle et votre mairie sont gérés par votre administrateur et ne peuvent pas être modifiés ici."
              pied={
                <Bouton type="submit" chargement={enregistrementProfil} disabled={!modifie} iconeGauche={<Save size={16} />}>
                  Enregistrer
                </Bouton>
              }
            >
              <Champ id="nom" label="Nom" requis>
                <input id="nom" required autoComplete="family-name" value={nom} onChange={(e) => setNom(e.target.value)} />
              </Champ>
              <Champ id="prenoms" label="Prénoms" requis>
                <input id="prenoms" required autoComplete="given-name" value={prenoms} onChange={(e) => setPrenoms(e.target.value)} />
              </Champ>
              <Champ id="email-lecture" label="Email">
                <input id="email-lecture" value={profil.email} disabled className="texte-mono" />
              </Champ>
            </Carte>
          </form>

          <form onSubmit={changerMotDePasse}>
            <Carte
              titre="Mot de passe"
              description="Chaque connexion demande ensuite un code reçu par email (double authentification)."
              pied={
                <Bouton type="submit" variante="secondaire" chargement={changementEnCours} iconeGauche={<KeyRound size={16} />}>
                  Changer le mot de passe
                </Bouton>
              }
            >
              {erreurMotDePasse && (
                <Alerte variante="erreur" className="eva-acces-espace-bas">
                  {erreurMotDePasse}
                </Alerte>
              )}
              <ChampMotDePasse id="ancien-mdp" label="Mot de passe actuel" requis autoComplete="current-password" valeur={ancienMotDePasse} onChange={setAncienMotDePasse} />
              <ChampMotDePasse id="nouveau-mdp" label="Nouveau mot de passe" requis autoComplete="new-password" aide="Au moins 10 caractères." valeur={nouveauMotDePasse} onChange={setNouveauMotDePasse} />
              <ChampMotDePasse
                id="confirmation-mdp"
                label="Confirmer le nouveau mot de passe"
                requis
                autoComplete="new-password"
                erreur={confirmationDifferente ? "Les deux mots de passe ne sont pas identiques." : undefined}
                valeur={confirmationMotDePasse}
                onChange={setConfirmationMotDePasse}
              />
              <p className="eva-acces-note-securite">
                <ShieldCheck size={15} aria-hidden="true" />
                Ne partagez jamais votre mot de passe ni vos codes de connexion.
              </p>
            </Carte>
          </form>
        </div>
      </div>
    </MiseEnPage>
  );
}
