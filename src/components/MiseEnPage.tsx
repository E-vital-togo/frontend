import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { listerActionsEnAttente } from "../lib/db";
import { synchroniser, surRetourConnexion } from "../lib/syncService";
import type { LienNavigation } from "../types/domaine";

interface ProprietesMiseEnPage {
  liens: LienNavigation[];
  children: ReactNode;
}

export default function MiseEnPage({ liens, children }: ProprietesMiseEnPage) {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();
  const [nombreEnAttente, setNombreEnAttente] = useState(0);
  const [enLigne, setEnLigne] = useState(navigator.onLine);

  async function rafraichirCompteur() {
    const actions = await listerActionsEnAttente();
    setNombreEnAttente(actions.length);
  }

  useEffect(() => {
    rafraichirCompteur();
    const gererEnLigne = () => setEnLigne(true);
    const gererHorsLigne = () => setEnLigne(false);
    window.addEventListener("online", gererEnLigne);
    window.addEventListener("offline", gererHorsLigne);

    const retirer = surRetourConnexion(async () => {
      await synchroniser();
      await rafraichirCompteur();
    });

    return () => {
      window.removeEventListener("online", gererEnLigne);
      window.removeEventListener("offline", gererHorsLigne);
      retirer();
    };
  }, []);

  function seDeconnecter() {
    deconnecter();
    navigate("/connexion");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--couleur-emeraude)",
          color: "var(--couleur-blanc)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <Logo variante="horizontal-inverse" hauteur={26} />
        <nav style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 14 }}>
          {liens.map((lien) => (
            <Link key={lien.chemin} to={lien.chemin} style={{ color: "var(--couleur-blanc)", textDecoration: "none", opacity: 0.9 }}>
              {lien.libelle}
            </Link>
          ))}
          <span className="texte-mono" title={enLigne ? "Connecte" : "Hors-ligne"} style={{ fontSize: 12, opacity: 0.9 }}>
            {enLigne ? "EN LIGNE" : "HORS-LIGNE"}
            {nombreEnAttente > 0 && ` - ${nombreEnAttente} EN ATTENTE`}
          </span>
          <span style={{ opacity: 0.85, fontSize: 13 }}>
            {utilisateur?.prenoms} {utilisateur?.nom}
          </span>
          <button
            onClick={seDeconnecter}
            className="bouton-secondaire"
            style={{ borderColor: "var(--couleur-blanc)", color: "var(--couleur-blanc)" }}
          >
            Deconnexion
          </button>
        </nav>
      </header>
      <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "28px 20px 60px" }}>
        {children}
      </main>
    </div>
  );
}
