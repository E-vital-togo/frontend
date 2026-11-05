import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import BarriereErreur from "./components/BarriereErreur";
// Polices hebergees avec l'application (plus d'appel a Google Fonts :
// rendu non bloque par un tiers, disponibles hors ligne via le service worker).
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles/theme.css";
import "./styles/formulaire.css";
import "./styles/composants.css";

const conteneur = document.getElementById("root");
if (!conteneur) {
  throw new Error("Element #root introuvable dans index.html");
}

createRoot(conteneur).render(
  <StrictMode>
    <BarriereErreur>
      <App />
    </BarriereErreur>
  </StrictMode>
);
