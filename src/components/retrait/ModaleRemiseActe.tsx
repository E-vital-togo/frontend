import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, FileText, WifiOff } from "lucide-react";
import { Alerte, Bouton, Champ, LienBouton, Modale, PilulesFiltre, Selecteur, Squelette } from "../ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import { PIECES_IDENTITE, QUALITES_RECEVEUR, dateHeureRetrait, libellePiece, libelleQualite } from "../../lib/retrait";
import type { DeclarantRetrait, PieceIdentite, QualiteReceveur, ReponseRetrait, ResumeRetrait } from "../../types/domaine";
import "../../styles/retrait.css";

interface ProprietesModaleRemiseActe {
  idDossier: string;
  /** Informations déjà connues (résultat de recherche) : affichées sans attendre la relecture du serveur. */
  declarantInitial?: DeclarantRetrait;
  /** "/agent" : lien vers l'acte à imprimer après la remise. */
  basePath: string;
  /** Libellé du bouton de sortie après la remise (« Nouvelle recherche », « Fermer »...). */
  libelleFin: string;
  /** Appelé dès que le retrait est enregistré (mise à jour de l'écran appelant). */
  onRetire: (retrait: ResumeRetrait) => void;
  /** Fermeture de la fenêtre (annulation, croix, Échap). */
  onFermer: () => void;
  /** Bouton de sortie de l'écran de succès (défaut : `onFermer`). */
  onTerminer?: () => void;
  /** Appelé quand le serveur indique que l'acte a déjà été retiré (l'écran appelant se met à jour). */
  onDejaRetire?: (retrait: ResumeRetrait) => void;
}

/**
 * Remise de l'acte au déclarant, en un seul écran : rappel des informations à
 * vérifier, nom de la personne qui retire, qualité, pièce vérifiée,
 * confirmation d'identité obligatoire. Exige le serveur : jamais mis en file
 * d'attente hors ligne (un même acte ne doit jamais être remis deux fois).
 */
export default function ModaleRemiseActe({
  idDossier,
  declarantInitial,
  basePath,
  libelleFin,
  onRetire,
  onFermer,
  onTerminer,
  onDejaRetire
}: ProprietesModaleRemiseActe) {
  const enLigne = useConnectivite();
  const [declarant, setDeclarant] = useState<DeclarantRetrait | null>(declarantInitial ?? null);
  const [dejaRetire, setDejaRetire] = useState<ResumeRetrait | null>(null);
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState(declarantInitial?.nom ?? "");
  const nomModifie = useRef(false);
  const [qualite, setQualite] = useState<QualiteReceveur>("declarant");
  const [piece, setPiece] = useState<PieceIdentite | "">("");
  const [note, setNote] = useState("");
  const [identiteVerifiee, setIdentiteVerifiee] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<ResumeRetrait | null>(null);
  const refNom = useRef<HTMLInputElement>(null);

  // Relecture du serveur : nom du déclarant (préremplissage) et détection d'un retrait déjà fait par un collègue.
  useEffect(() => {
    let annule = false;
    appelApi<ReponseRetrait>(`/dossiers/${idDossier}/acte/retrait`)
      .then((reponse) => {
        if (annule) return;
        if (reponse.declarant) {
          setDeclarant(reponse.declarant);
          if (!nomModifie.current && reponse.declarant.nom) setNom(reponse.declarant.nom);
        }
        if (reponse.retrait.etat === "retire") {
          setDejaRetire(reponse.retrait);
          onDejaRetire?.(reponse.retrait);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDossier]);

  async function confirmer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!nom.trim() || !identiteVerifiee || !enLigne) return;
    setEnCours(true);
    setErreur(null);
    try {
      const reponse = await appelApi<ReponseRetrait>(`/dossiers/${idDossier}/acte/retrait`, {
        methode: "POST",
        corps: { nom_receveur: nom.trim(), qualite, piece, note: note.trim(), identite_verifiee: true }
      });
      setSucces(reponse.retrait);
      onRetire(reponse.retrait);
    } catch (e) {
      if (e instanceof ErreurApi && e.code === "acte_deja_retire") {
        // Un collègue a validé entre-temps : on relit pour afficher qui et quand.
        try {
          const reponse = await appelApi<ReponseRetrait>(`/dossiers/${idDossier}/acte/retrait`);
          setDejaRetire(reponse.retrait.etat === "retire" ? reponse.retrait : null);
          if (reponse.retrait.etat === "retire") onDejaRetire?.(reponse.retrait);
        } catch {
          setErreur(e.message);
        }
      } else {
        setErreur(e instanceof ErreurApi ? e.message : "Le retrait n'a pas pu être enregistré. Réessayez.");
      }
    } finally {
      setEnCours(false);
    }
  }

  // --- Écran de succès -------------------------------------------------
  if (succes) {
    return (
      <Modale
        titre="Acte remis"
        taille="moyen"
        onFermer={onFermer}
        fermerAuClicFond={false}
        actions={
          <>
            <LienBouton to={`${basePath}/dossiers/${idDossier}/acte-pdf`} variante="secondaire" iconeGauche={<FileText size={16} />}>
              Télécharger / imprimer l'acte
            </LienBouton>
            <Bouton onClick={onTerminer ?? onFermer}>{libelleFin}</Bouton>
          </>
        }
      >
        <div className="eva-rt-succes" role="status">
          <span className="eva-rt-succes__icone" aria-hidden="true">
            <CheckCircle2 size={28} />
          </span>
          <p className="eva-rt-succes__titre">Le retrait est enregistré.</p>
          <p className="eva-rt-succes__texte">
            L'acte a été remis à <strong>{succes.retire_nom_receveur}</strong>
            {succes.retire_qualite ? ` (${libelleQualite(succes.retire_qualite).toLowerCase()})` : ""}, le {dateHeureRetrait(succes.retire_le)}.
          </p>
          <p className="eva-rt-succes__texte eva-texte-discret">Vous pouvez imprimer les volets de l'acte maintenant, ou plus tard depuis le dossier.</p>
        </div>
      </Modale>
    );
  }

  // --- Acte déjà retiré --------------------------------------------------
  if (dejaRetire) {
    return (
      <Modale titre="Remettre l'acte" taille="moyen" onFermer={onFermer} actions={<Bouton onClick={onFermer}>Fermer</Bouton>}>
        <Alerte variante="erreur" titre="Cet acte a déjà été retiré">
          Retiré le {dateHeureRetrait(dejaRetire.retire_le)}
          {dejaRetire.retire_par_nom ? ` par ${dejaRetire.retire_par_nom}` : ""}
          {dejaRetire.retire_nom_receveur ? `, remis à ${dejaRetire.retire_nom_receveur}` : ""}
          {dejaRetire.retire_qualite ? ` (${libelleQualite(dejaRetire.retire_qualite).toLowerCase()})` : ""}. Une seconde remise n'est pas possible : si c'est une erreur, demandez à l'administrateur
          du centre d'état civil d'annuler le retrait.
        </Alerte>
      </Modale>
    );
  }

  const peutConfirmer = enLigne && !!nom.trim() && identiteVerifiee && !enCours;

  return (
    <Modale
      titre="Remettre l'acte"
      description="Vérifiez l'identité de la personne avant de remettre l'acte. Le retrait est enregistré à votre nom."
      taille="moyen"
      onFermer={onFermer}
      fermerAuClicFond={false}
      refFocusInitial={refNom}
    >
      <form onSubmit={confirmer} noValidate className="eva-rt-formulaire">
        {!enLigne && (
          <Alerte variante="avertissement" icone={<WifiOff size={18} aria-hidden="true" />} titre="Connexion nécessaire">
            Le retrait doit être enregistré tout de suite sur le serveur : il ne peut pas être mis en attente hors ligne, afin qu'un même acte ne soit jamais remis
            deux fois. Reconnectez-vous pour continuer.
          </Alerte>
        )}

        <section className="eva-rt-verifier" aria-label="Informations à vérifier auprès de la personne">
          <h3 className="eva-rt-verifier__titre">À vérifier auprès de la personne</h3>
          {chargement && !declarant ? (
            <Squelette variante="bloc" hauteur={64} libelle="Chargement des informations du déclarant" />
          ) : (
            <dl className="eva-rt-verifier__liste">
              <div>
                <dt>Déclarant</dt>
                <dd>{declarant?.nom || "Non renseigné"}</dd>
              </div>
              <div>
                <dt>Numéro</dt>
                <dd className="texte-mono">{declarant?.telephone || "-"}</dd>
              </div>
              <div>
                <dt>{declarant?.event_type === "deces" ? "Défunt(e)" : declarant?.event_type === "naissance" ? "Enfant" : "Dossier"}</dt>
                <dd>{declarant?.dossier_nom || "Non renseigné"}</dd>
              </div>
            </dl>
          )}
        </section>

        <Champ id="remise-nom" label="Nom de la personne qui retire l'acte" requis>
          <input
            id="remise-nom"
            ref={refNom}
            value={nom}
            maxLength={200}
            onChange={(e) => {
              nomModifie.current = true;
              setNom(e.target.value);
            }}
            autoComplete="off"
            required
          />
        </Champ>

        <div className="eva-rt-groupe">
          <span className="eva-rt-etiquette" id="remise-qualite-etiquette">
            Qualité de la personne
          </span>
          <PilulesFiltre<QualiteReceveur>
            ariaLabel="Qualité de la personne qui retire l'acte"
            valeur={qualite}
            onChanger={setQualite}
            pilules={QUALITES_RECEVEUR.map((q) => ({ valeur: q.valeur, libelle: q.libelle }))}
          />
        </div>

        <Champ id="remise-piece" label="Pièce d'identité vérifiée (facultatif)">
          <Selecteur
            id="remise-piece"
            valeur={piece}
            onChange={(valeur) => setPiece(valeur as PieceIdentite | "")}
            options={PIECES_IDENTITE.map((p) => ({ valeur: p.valeur, libelle: p.libelle }))}
            placeholder="Choisir la pièce présentée"
            recherche={false}
            effacable
          />
        </Champ>

        <Champ id="remise-note" label="Note (facultatif)" aide={piece ? `Pièce choisie : ${libellePiece(piece)}.` : undefined}>
          <textarea id="remise-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Champ>

        <label className="eva-rt-case">
          <input type="checkbox" checked={identiteVerifiee} onChange={(e) => setIdentiteVerifiee(e.target.checked)} />
          <span>J'ai vérifié l'identité de la personne</span>
        </label>

        {erreur && <Alerte variante="erreur" compacte>{erreur}</Alerte>}

        <div className="eva-modale__actions">
          <Bouton type="button" variante="secondaire" onClick={onFermer} disabled={enCours}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={enCours} disabled={!peutConfirmer}>
            Confirmer le retrait
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
