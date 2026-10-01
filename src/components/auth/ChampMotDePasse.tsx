import { useRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Bouton, Champ } from "../ui";
import "../../styles/auth.css";

interface ProprietesChampMotDePasse {
  id: string;
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  /** current-password (connexion, mot de passe actuel) ou new-password (creation, changement). */
  autoComplete: "current-password" | "new-password";
  requis?: boolean;
  autoFocus?: boolean;
  minLength?: number;
  aide?: string;
  erreur?: string;
  placeholder?: string;
}

/**
 * Champ mot de passe avec cadenas et bouton afficher / masquer (utile sur
 * telephone, ou une faute de frappe est vite faite). Le focus revient dans le
 * champ apres la bascule, comme dans les gabarits Django.
 */
export default function ChampMotDePasse({
  id,
  label,
  valeur,
  onChange,
  autoComplete,
  requis,
  autoFocus,
  minLength,
  aide,
  erreur,
  placeholder
}: ProprietesChampMotDePasse) {
  const [visible, setVisible] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const idMessage = erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined;

  function basculer() {
    setVisible((v) => !v);
    champ.current?.focus();
  }

  return (
    <Champ id={id} label={label} requis={requis} aide={aide} erreur={erreur}>
      <div className="eva-acces-groupe">
        <span className="eva-acces-groupe__icone" aria-hidden="true">
          <Lock size={17} />
        </span>
        <input
          ref={champ}
          id={id}
          type={visible ? "text" : "password"}
          required={requis}
          minLength={minLength}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={idMessage}
          aria-invalid={erreur ? true : undefined}
        />
        <Bouton
          type="button"
          variante="fantome"
          taille="petit"
          iconeSeule
          className="eva-acces-groupe__action"
          iconeGauche={visible ? <EyeOff size={17} /> : <Eye size={17} />}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          onClick={basculer}
        />
      </div>
    </Champ>
  );
}
