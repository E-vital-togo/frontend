import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Modale from "./Modale";
import Bouton from "./Bouton";

interface OptionsConfirmation {
  titre: string;
  description?: string;
  libelleConfirmer?: string;
  libelleAnnuler?: string;
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
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveur.current = resolve;
    });
  }, []);

  function repondre(valeur: boolean) {
    resolveur.current?.(valeur);
    setOptions(null);
  }

  return (
    <ContexteConfirmation.Provider value={confirmer}>
      {children}
      {options && (
        <Modale
          titre={options.titre}
          onFermer={() => repondre(false)}
          actions={
            <>
              <Bouton variante="fantome" onClick={() => repondre(false)}>
                {options.libelleAnnuler || "Annuler"}
              </Bouton>
              <Bouton variante={options.dangereux ? "danger" : "principal"} onClick={() => repondre(true)}>
                {options.libelleConfirmer || "Confirmer"}
              </Bouton>
            </>
          }
        >
          {options.description && <p style={{ color: "var(--couleur-gris-service-1)", fontSize: 14 }}>{options.description}</p>}
        </Modale>
      )}
    </ContexteConfirmation.Provider>
  );
}

export function useConfirmation(): DemandeurConfirmation {
  const contexte = useContext(ContexteConfirmation);
  if (!contexte) throw new Error("useConfirmation doit etre utilise a l'interieur de FournisseurConfirmation");
  return contexte;
}
