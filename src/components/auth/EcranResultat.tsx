import { useEffect, useRef, type ReactNode } from "react";
import "../../styles/auth.css";

interface ProprietesEcranResultat {
  /** Couleur de la pastille : succes (emeraude), erreur, attention (citron), neutre. */
  ton?: "succes" | "erreur" | "attention" | "neutre";
  /** Icone lucide (taille 34 conseillee). */
  icone: ReactNode;
  titre: string;
  /** Texte explicatif sous le titre. */
  children?: ReactNode;
  /** Boutons : le premier est l'action principale. */
  actions?: ReactNode;
}

/**
 * Corps d'un ecran de fin de parcours (succes, erreur, introuvable) place dans
 * PageAuth : pastille d'icone, titre (h1), texte, boutons. Le titre recoit le
 * focus a l'affichage pour que les lecteurs d'ecran annoncent le resultat.
 */
export default function EcranResultat({ ton = "neutre", icone, titre, children, actions }: ProprietesEcranResultat) {
  const titreRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titreRef.current?.focus({ preventScroll: false });
  }, []);

  return (
    <div className={`eva-acces-resultat eva-acces-resultat--${ton}`}>
      <span className="eva-acces-resultat__icone" aria-hidden="true">
        {icone}
      </span>
      <h1 className="eva-auth__titre eva-acces-resultat__titre" ref={titreRef} tabIndex={-1}>
        {titre}
      </h1>
      {children && <div className="eva-acces-resultat__texte">{children}</div>}
      {actions && <div className="eva-acces-resultat__actions">{actions}</div>}
    </div>
  );
}
