import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/theme.css";

const conteneur = document.getElementById("root");
if (!conteneur) {
  throw new Error("Element #root introuvable dans index.html");
}

createRoot(conteneur).render(
  <StrictMode>
    <App />
  </StrictMode>
);
