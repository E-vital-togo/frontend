import { CompassIcon } from "lucide-react";
import Logo from "../components/Logo";
import { LienBouton } from "../components/ui";

export default function PageIntrouvable() {
  return (
    <div className="eva-ecran-centre">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Logo variante="symbole" hauteur={48} />
        <CompassIcon size={32} color="var(--couleur-gris-service-2)" />
        <div style={{ textAlign: "center" }}>
          <h1 className="eva-titre-page">Page introuvable</h1>
          <p className="eva-sous-titre">Cette adresse ne correspond a aucun ecran de l'application.</p>
        </div>
        <LienBouton to="/">Retour a l'accueil</LienBouton>
      </div>
    </div>
  );
}
