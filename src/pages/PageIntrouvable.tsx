import { Link } from "react-router-dom";
import Logo from "../components/Logo";

export default function PageIntrouvable() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Logo variante="symbole" hauteur={48} />
      <p>Page introuvable.</p>
      <Link to="/" className="bouton-principal">
        Retour a l'accueil
      </Link>
    </div>
  );
}
