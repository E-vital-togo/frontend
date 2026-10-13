import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bouton, Carte } from "../ui";
import { appelApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import { formaterDate } from "./utilitaires";
import type { DecesSignale } from "../../types/domaine";

interface ReponseDecesSignales {
  count: number;
  results: DecesSignale[];
}

/**
 * Notification de la mairie de naissance (liaison naissance / décès) : un décès déclaré par une autre mairie vient
 * d'être lié à une naissance de sa zone. Information seule : « Marquer comme vu » la retire de la liste. N'affiche
 * rien quand la fonction est désactivée, hors ligne, ou sans décès à signaler.
 */
export default function DecesSignales({ basePath }: { basePath: string }) {
  const enLigne = useConnectivite();
  const [donnees, setDonnees] = useState<ReponseDecesSignales | null>(null);

  const charger = useCallback(() => {
    appelApi<ReponseDecesSignales>("/liaisons/deces-signales")
      .then(setDonnees)
      .catch(() => setDonnees(null));
  }, []);

  useEffect(() => {
    if (enLigne) charger();
  }, [enLigne, charger]);

  async function marquerVu(id: string) {
    try {
      await appelApi(`/liaisons/deces-signales/${id}/vu`, { methode: "POST" });
    } finally {
      charger();
    }
  }

  if (!donnees || donnees.count === 0) return null;
  return (
    <Carte
      titre="Décès signalés"
      description={`${donnees.count} personne${donnees.count > 1 ? "s" : ""} née${donnees.count > 1 ? "s" : ""} dans votre zone ${
        donnees.count > 1 ? "ont" : "a"
      } été déclarée${donnees.count > 1 ? "s" : ""} décédée${donnees.count > 1 ? "s" : ""} par une autre mairie.`}
    >
      <ul className="eva-dd-liaison__liste">
        {donnees.results.map((s) => (
          <li key={s.id} className="eva-dd-liaison__candidat">
            <div className="eva-dd-liaison__entete">
              <div className="eva-dd-liaison__identite">
                <span className="eva-dd-liaison__nom">{s.deces.nom || "Personne"}</span>
                <span className="eva-dd-liaison__meta">
                  Décès{s.deces.date_evenement ? ` le ${formaterDate(s.deces.date_evenement)}` : ""} - déclaré par {s.deces.mairie}
                </span>
              </div>
              <div className="eva-dd-liaison__actions">
                <Link className="eva-lien" to={`${basePath}/dossiers/${s.naissance_dossier_id}`}>
                  Voir la naissance
                </Link>
                <Bouton variante="secondaire" taille="petit" onClick={() => marquerVu(s.id)}>
                  Marquer comme vu
                </Bouton>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
