import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "../Logo";
import { cx } from "./utilitaires";

interface ProprietesPageAuth {
  /** Titre de l'ecran (h1) : "Connexion", "Verification du code"... */
  titre?: string;
  /** Texte d'introduction sous le titre (ReactNode : on peut y mettre un <strong>). */
  description?: ReactNode;
  /** Icone lucide (ex: `<Mail size={26} />`) dans une pastille au-dessus du titre. */
  icone?: ReactNode;
  /** Message (Alerte) affiche entre le logo et le titre. */
  message?: ReactNode;
  /** Logo vertical plus grand (accueil, ecran d'entree) plutot que l'horizontal. */
  logoVertical?: boolean;
  /** Carte plus large (680px) pour un formulaire complet (ex: declaration du parent). */
  large?: boolean;
  /** Aligne la carte en haut de l'ecran (formulaire long) au lieu de la centrer. */
  alignementHaut?: boolean;
  /** Lien "Retour" en haut de la carte. */
  retour?: { libelle: string; vers?: string; onClick?: () => void };
  /** Pied de carte : liens secondaires ("Mot de passe oublie ?"), centre. */
  pied?: ReactNode;
  /** Ligne de signature sous la carte (defaut : "Naissances - Décès - Statistiques" ; `false` pour la masquer). */
  signature?: string | false;
  children: ReactNode;
}

/**
 * Mise en page plein ecran SANS menu pour connexion, verification du code,
 * reinitialisation du mot de passe et parcours parent : carte centree sur un
 * fond doux a motif de marque, logo, pied de page. Calquee sur
 * backend/templates/base_auth.html.
 */
export default function PageAuth({
  titre,
  description,
  icone,
  message,
  logoVertical,
  large,
  alignementHaut,
  retour,
  pied,
  signature = "Naissances - Décès - Statistiques",
  children
}: ProprietesPageAuth) {
  return (
    <main className={cx("eva-auth", large && "eva-auth--large", alignementHaut && "eva-auth--haut")} id="contenu">
      <div className="eva-auth__carte">
        {retour &&
          (retour.vers ? (
            <Link to={retour.vers} className="eva-auth__retour">
              <ArrowLeft size={15} aria-hidden="true" />
              {retour.libelle}
            </Link>
          ) : (
            <button type="button" className="eva-auth__retour" onClick={retour.onClick}>
              <ArrowLeft size={15} aria-hidden="true" />
              {retour.libelle}
            </button>
          ))}
        <div className={cx("eva-auth__logo", logoVertical && "eva-auth__logo--vertical")}>
          <Logo variante={logoVertical ? "vertical" : "horizontal"} hauteur={logoVertical ? 96 : 44} />
        </div>
        {message}
        {(titre || description || icone) && (
          <div className="eva-auth__entete">
            {icone && (
              <span className="eva-auth__icone" aria-hidden="true">
                {icone}
              </span>
            )}
            {titre && <h1 className="eva-auth__titre">{titre}</h1>}
            {description && <p className="eva-auth__texte">{description}</p>}
          </div>
        )}
        {children}
        {pied && <div className="eva-auth__pied">{pied}</div>}
      </div>
      {signature && <p className="eva-auth__signature">{signature}</p>}
    </main>
  );
}
