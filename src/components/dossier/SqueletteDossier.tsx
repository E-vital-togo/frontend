import { Squelette } from "../ui";
import "../../styles/dossier.css";

/** Forme de la page pendant le tout premier chargement : fil d'Ariane, titre, fiche, onglets, formulaire. */
export default function SqueletteDossier() {
  return (
    <div className="eva-dd-squelette" role="status" aria-live="polite">
      <span className="eva-sr-only">Chargement du dossier</span>
      <div aria-hidden="true" className="eva-dd-squelette__contenu">
        <Squelette variante="texte" lignes={1} largeur={220} hauteur="12px" />
        <Squelette variante="titre" largeur="min(360px, 70%)" hauteur="30px" />
        <Squelette variante="bloc" hauteur={84} />
        <Squelette variante="bouton" largeur={140} />
        <Squelette variante="carte" lignes={6} />
      </div>
    </div>
  );
}
