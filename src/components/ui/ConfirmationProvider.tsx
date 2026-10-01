import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import Modale from "./Modale";
import Bouton from "./Bouton";

interface OptionsConfirmation {
  titre: string;
  description?: string;
  libelleConfirmer?: string;
  libelleAnnuler?: string;
  /** Action destructive : bouton rouge plein, icone d'avertissement, focus sur "Annuler". */
  dangereux?: boolean;
}

type DemandeurConfirmation = (options: OptionsConfirmation) => Promise<boolean>;

const ContexteConfirmation = createContext<DemandeurConfirmation | null>(null);

/**
 * Remplace window.confirm() partout dans l'app par une vraie boite de
 * dialogue coherente avec la charte. Monte une seule fois a la racine
 * (voir App.tsx) ; chaque ecran appelle useConfirmation() pour obtenir une
 * fonction async qui resout true/false selon le choix de l'utilisateur.
 */
export function FournisseurConfirmation({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<OptionsConfirmation | null>(null);
  const resolveur = useRef<((valeur: boolean) => void) | null>(null);

  const confirmer = useCallback<DemandeurConfirmation>((opts) => {
    // Une demande encore ouverte est consideree comme refusee
    resolveur.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveur.current = resolve;
    });
  }, []);

  function repondre(valeur: boolean) {
    resolveur.current?.(valeur);
    resolveur.current = null;
    setOptions(null);
  }

  return (
    <ContexteConfirmation.Provider value={confirmer}>
      {children}
      {options && (
        <Modale
          titre={options.titre}
          taille="petit"
          onFermer={() => repondre(false)}
          actions={
            <>
              <Bouton variante="secondaire" onClick={() => repondre(false)}>
                {options.libelleAnnuler || "Annuler"}
              </Bouton>
              <Bouton variante={options.dangereux ? "danger-plein" : "principal"} onClick={() => repondre(true)}>
                {options.libelleConfirmer || "Confirmer"}
              </Bouton>
            </>
          }
        >
          <div className="eva-confirmation">
            <span className={`eva-confirmation__icone${options.dangereux ? " eva-confirmation__icone--danger" : ""}`} aria-hidden="true">
              {options.dangereux ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
            </span>
            {options.description && <p className="eva-confirmation__texte">{options.description}</p>}
          </div>
        </Modale>
      )}
    </ContexteConfirmation.Provider>
  );
}

export function useConfirmation(): DemandeurConfirmation {
  const contexte = useContext(ContexteConfirmation);
  if (!contexte) throw new Error("useConfirmation doit être utilisé à l'intérieur de FournisseurConfirmation");
  return contexte;
}
