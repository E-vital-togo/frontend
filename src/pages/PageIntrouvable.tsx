import { useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, Home } from "lucide-react";
import EcranResultat from "../components/auth/EcranResultat";
import { Bouton, LienBouton, PageAuth } from "../components/ui";
import "../styles/auth.css";

export default function PageIntrouvable() {
  const navigate = useNavigate();

  return (
    <PageAuth>
      <EcranResultat
        ton="neutre"
        icone={<Compass size={34} />}
        titre="Page introuvable"
        actions={
          <>
            <LienBouton to="/" pleineLargeur iconeGauche={<Home size={17} />}>
              Retour à l'accueil
            </LienBouton>
            {window.history.length > 1 && (
              <Bouton type="button" variante="secondaire" pleineLargeur iconeGauche={<ArrowLeft size={17} />} onClick={() => navigate(-1)}>
                Revenir à la page précédente
              </Bouton>
            )}
          </>
        }
      >
        <p className="eva-acces-code-erreur texte-mono">Erreur 404</p>
        <p>Cette adresse ne correspond à aucun écran de l'application. Le lien est peut-être incorrect ou n'existe plus.</p>
      </EcranResultat>
    </PageAuth>
  );
}
