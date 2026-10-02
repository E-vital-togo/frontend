import { Clock, KeyRound, RefreshCw } from "lucide-react";
import EcranResultat from "./EcranResultat";
import { Bouton, LienBouton, PageAuth } from "../ui";
import "../../styles/auth.css";
import "../../styles/completion-desactivee.css";

interface ProprietesEcranCompletionIndisponible {
  /** Message de l'administrateur, uniquement s'il est personnalise (le texte par defaut est deja couvert par l'ecran). */
  message?: string;
  /** Code de retrait deja connu (page de completion ou de suivi) : rappele pour la mairie. */
  code?: string;
  /** Relit l'etat aupres du serveur ; si la completion est reactivee, la page reprend son cours. */
  onReessayer: () => void;
  reessaiEnCours?: boolean;
}

/**
 * Ecran des pages parent quand la completion en ligne est coupee par
 * l'administration (code `completion_desactivee` ou /completion/etat inactif).
 * Rassurant et sans jargon technique : ce n'est pas une erreur du parent, et
 * il peut finaliser sa declaration directement a la mairie.
 */
export default function EcranCompletionIndisponible({ message, code, onReessayer, reessaiEnCours }: ProprietesEcranCompletionIndisponible) {
  return (
    <PageAuth>
      <EcranResultat
        ton="attention"
        icone={<Clock size={34} />}
        titre="La complétion en ligne est momentanément indisponible"
        actions={
          <>
            <Bouton type="button" pleineLargeur iconeGauche={<RefreshCw size={16} />} chargement={reessaiEnCours} onClick={onReessayer}>
              Réessayer
            </Bouton>
            <LienBouton to="/retrouver-mon-code" variante="secondaire" pleineLargeur iconeGauche={<KeyRound size={17} />}>
              J'ai perdu mon code
            </LienBouton>
          </>
        }
      >
        <p>Ce n'est pas un problème de votre côté, et vous n'avez rien à refaire pour le moment.</p>
        {message && <blockquote className="eva-ci-message">{message}</blockquote>}
        <div className="eva-ci-conduite">
          <p className="eva-ci-conduite__titre">Que faire ?</p>
          <p>Présentez-vous à la mairie avec le code de retrait reçu par SMS ou avec votre récépissé : l'agent vous aidera à finaliser votre déclaration.</p>
        </div>
        {code && (
          <p className="eva-acces-rappel-code">
            Votre code de retrait : <strong className="texte-mono">{code}</strong>
          </p>
        )}
      </EcranResultat>
    </PageAuth>
  );
}
