import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FournisseurAuth } from "./context/AuthContext";
import { FournisseurToast } from "./components/ui/ToastProvider";
import { FournisseurConfirmation } from "./components/ui/ConfirmationProvider";
import { ChargementPage } from "./components/ui";
import RouteProtegee from "./components/RouteProtegee";

import PageAccueil from "./pages/PageAccueil";
import PageIntrouvable from "./pages/PageIntrouvable";

import PageConnexion from "./pages/auth/PageConnexion";
import PageVerifierCode from "./pages/auth/PageVerifierCode";
import PageReinitialiserMotDePasse from "./pages/auth/PageReinitialiserMotDePasse";

import TableauDeBordAgent from "./pages/agent/TableauDeBordAgent";
import ListeDossiers from "./pages/agent/ListeDossiers";
import DetailDossier from "./pages/agent/DetailDossier";
import CreationDossier from "./pages/agent/CreationDossier";
import EmissionActe from "./pages/agent/EmissionActe";
import ActePdf from "./pages/agent/ActePdf";
import ConflitsSynchronisation from "./pages/agent/ConflitsSynchronisation";
import Synchronisation from "./pages/agent/Synchronisation";

import UtilisateursAdminCec from "./pages/admin_cec/UtilisateursAdminCec";
import DemandesModificationAdminCec from "./pages/admin_cec/DemandesModificationAdminCec";
import DossiersAdminCec from "./pages/admin_cec/DossiersAdminCec";
import NotificationsEchouees from "./pages/admin_cec/NotificationsEchouees";
import CampagnesRelance from "./pages/admin_cec/CampagnesRelance";
import JournalZone from "./pages/admin_cec/JournalZone";
import PersonnalisationMairie from "./pages/admin_cec/PersonnalisationMairie";
import MairieSignataire from "./pages/admin_cec/MairieSignataire";

import PageCompletionAccueil from "./pages/parent/PageCompletionAccueil";
import PageCompletionParent from "./pages/parent/PageCompletionParent";
import PageStatutCompletion from "./pages/parent/PageStatutCompletion";
import PageRetrouverCode from "./pages/parent/PageRetrouverCode";

import PageMonCompte from "./pages/PageMonCompte";

// Chargees a la demande : la lecture de QR (html5-qrcode) et les graphiques
// (recharts) representent a elles seules la majorite du poids du bundle,
// alors qu'elles ne concernent qu'un seul ecran chacune. Les separer garde
// le coeur de la PWA (parcours agent CEC, utilise hors-ligne sur le
// terrain) leger a charger sur une connexion faible.
const PageRetrait = lazy(() => import("./pages/agent/PageRetrait"));
const TableauDeBordAdminCec = lazy(() => import("./pages/admin_cec/TableauDeBordAdminCec"));
// ECharts + react-grid-layout representent a eux deux plusieurs centaines de
// Ko : memes raisons de separation que PageRetrait/TableauDeBordAdminCec
// ci-dessus (voir le commentaire au-dessus de ce bloc).
const TableauDeBordStats = lazy(() => import("./pages/admin_cec/statistiques/TableauDeBordStats"));
const ConstructeurGraphique = lazy(() => import("./pages/admin_cec/statistiques/ConstructeurGraphique"));

export default function App() {
  return (
    <BrowserRouter>
      <FournisseurAuth>
        <FournisseurToast>
        <FournisseurConfirmation>
        <Suspense fallback={<ChargementPage />}>
        <Routes>
          <Route path="/" element={<PageAccueil />} />
          <Route path="/connexion" element={<PageConnexion />} />
          <Route path="/connexion/code" element={<PageVerifierCode />} />
          <Route path="/reinitialiser-mot-de-passe/:uidb64/:token" element={<PageReinitialiserMotDePasse />} />

          {/* Parent/declarant : acces public, sans authentification */}
          <Route path="/completion" element={<PageCompletionAccueil />} />
          <Route path="/completion/:code" element={<PageCompletionParent />} />
          <Route path="/completion/statut/:code" element={<PageStatutCompletion />} />

          {/* Agent CEC */}
          <Route
            path="/agent"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <TableauDeBordAgent />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/dossiers"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <ListeDossiers />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/dossiers/nouveau"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <CreationDossier />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/dossiers/:idDossier"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <DetailDossier />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/dossiers/:idDossier/emission-acte"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <EmissionActe />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/dossiers/:idDossier/acte-pdf"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <ActePdf />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/conflits"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <ConflitsSynchronisation />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/synchronisation"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <Synchronisation />
              </RouteProtegee>
            }
          />
          <Route
            path="/agent/retrait"
            element={
              <RouteProtegee rolesAutorises={["agent_cec"]}>
                <PageRetrait />
              </RouteProtegee>
            }
          />

          {/* Admin CEC (scope mairie / prefecture / region / pays) */}
          <Route
            path="/admin-cec"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <TableauDeBordAdminCec />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/statistiques"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <TableauDeBordStats />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/statistiques/constructeur"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <ConstructeurGraphique />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/utilisateurs"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <UtilisateursAdminCec />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/demandes-modification"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <DemandesModificationAdminCec />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/dossiers"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <DossiersAdminCec />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/dossiers/:idDossier"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <DetailDossier />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/dossiers/:idDossier/acte-pdf"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <ActePdf />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/conflits"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <ConflitsSynchronisation />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/notifications-echouees"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <NotificationsEchouees />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/campagnes-relance"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <CampagnesRelance />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/journal"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <JournalZone />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/personnalisation"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <PersonnalisationMairie />
              </RouteProtegee>
            }
          />
          <Route
            path="/admin-cec/signataires"
            element={
              <RouteProtegee rolesAutorises={["admin_cec"]}>
                <MairieSignataire />
              </RouteProtegee>
            }
          />

          {/* Partage entre agent_cec et admin_cec */}
          <Route
            path="/mon-compte"
            element={
              <RouteProtegee rolesAutorises={["agent_cec", "admin_cec"]}>
                <PageMonCompte />
              </RouteProtegee>
            }
          />

          {/* Parent/declarant : recherche d'un code perdu par telephone, acces public */}
          <Route path="/retrouver-mon-code" element={<PageRetrouverCode />} />

          <Route path="*" element={<PageIntrouvable />} />
        </Routes>
        </Suspense>
        </FournisseurConfirmation>
        </FournisseurToast>
      </FournisseurAuth>
    </BrowserRouter>
  );
}
