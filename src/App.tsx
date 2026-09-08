import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FournisseurAuth } from "./context/AuthContext";
import { FournisseurToast } from "./context/ToastContext";
import ConteneurToasts from "./components/ConteneurToasts";
import RouteProtegee from "./components/RouteProtegee";

import PageAccueil from "./pages/PageAccueil";
import PageIntrouvable from "./pages/PageIntrouvable";

import PageConnexion from "./pages/auth/PageConnexion";
import PageVerifierCode from "./pages/auth/PageVerifierCode";

import TableauDeBordAgent from "./pages/agent/TableauDeBordAgent";
import ListeDossiers from "./pages/agent/ListeDossiers";
import DetailDossier from "./pages/agent/DetailDossier";
import CreationDossier from "./pages/agent/CreationDossier";
import EmissionActe from "./pages/agent/EmissionActe";
import ActePdf from "./pages/agent/ActePdf";
import ConflitsSynchronisation from "./pages/agent/ConflitsSynchronisation";

import TableauDeBordAdminCec from "./pages/admin_cec/TableauDeBordAdminCec";
import UtilisateursAdminCec from "./pages/admin_cec/UtilisateursAdminCec";
import DemandesModificationAdminCec from "./pages/admin_cec/DemandesModificationAdminCec";

import PageCompletionParent from "./pages/parent/PageCompletionParent";
import PageStatutCompletion from "./pages/parent/PageStatutCompletion";

import PageCompte from "./pages/compte/PageCompte";

export default function App() {
  return (
    <BrowserRouter>
      <FournisseurToast>
      <FournisseurAuth>
        <ConteneurToasts />
        <Routes>
          <Route path="/" element={<PageAccueil />} />
          <Route path="/connexion" element={<PageConnexion />} />
          <Route path="/connexion/code" element={<PageVerifierCode />} />

          {/* Parent/declarant : acces public, sans authentification */}
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

          {/* Mon compte : accessible a tout utilisateur authentifie (agent ou admin CEC) */}
          <Route
            path="/compte"
            element={
              <RouteProtegee rolesAutorises={["agent_cec", "admin_cec"]}>
                <PageCompte />
              </RouteProtegee>
            }
          />

          <Route path="*" element={<PageIntrouvable />} />
        </Routes>
      </FournisseurAuth>
      </FournisseurToast>
    </BrowserRouter>
  );
}
