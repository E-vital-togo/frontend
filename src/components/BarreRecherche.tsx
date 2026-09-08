import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

interface ProprietesBarreRecherche {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  delaiMs?: number;
}

/**
 * Champ de recherche avec debounce integre : onChange n'est appele qu'apres
 * une pause de saisie, pour ne pas declencher un appel API a chaque frappe.
 */
export default function BarreRecherche({
  valeur,
  onChange,
  placeholder = "Rechercher...",
  delaiMs = 350
}: ProprietesBarreRecherche) {
  const [saisie, setSaisie] = useState(valeur);
  const premierRendu = useRef(true);

  useEffect(() => {
    setSaisie(valeur);
  }, [valeur]);

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const minuteur = setTimeout(() => onChange(saisie), delaiMs);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie]);

  return (
    <div className="barre-recherche">
      <Search size={16} />
      <input
        type="text"
        value={saisie}
        placeholder={placeholder}
        onChange={(e) => setSaisie(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}
