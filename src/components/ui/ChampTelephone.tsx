import { lazy, Suspense } from "react";
import type { ProprietesChampTelephone } from "./ChampTelephoneCorps";

/**
 * Champ telephone (selecteur de pays + saisie validee). Le corps du composant
 * (ChampTelephoneCorps.tsx) embarque libphonenumber-js (~60 Ko compresses) et
 * charge les drapeaux SVG (~45 Ko compresses) : il est charge a la demande,
 * pour ne pas alourdir le premier affichage des ecrans sans telephone
 * (connexion, tableaux de bord). Precache par le service worker, donc
 * disponible hors ligne comme le reste de l'app.
 */
const Corps = lazy(() => import("./ChampTelephoneCorps"));

export type { ProprietesChampTelephone };

export default function ChampTelephone(proprietes: ProprietesChampTelephone) {
  return (
    <Suspense
      fallback={
        <input id={proprietes.id} type="tel" inputMode="tel" disabled aria-busy="true" value="" placeholder="Chargement..." readOnly />
      }
    >
      <Corps {...proprietes} />
    </Suspense>
  );
}
