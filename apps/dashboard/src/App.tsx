import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profiles from "./pages/Profiles";
import ProfileDetail from "./pages/ProfileDetail";
import Artifacts from "./pages/Artifacts";
import Secrets from "./pages/Secrets";
import Suggestions from "./pages/Suggestions";
import AuditLog from "./pages/AuditLog";
import Team from "./pages/Team";
import Join from "./pages/Join";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join/:code" element={<Join />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/" element={<Profiles />} />
                  <Route path="/profiles" element={<Navigate to="/app" />} />
                  <Route path="/profiles/:id" element={<ProfileDetail />} />
                  <Route path="/artifacts" element={<Artifacts />} />
                  <Route path="/secrets" element={<Secrets />} />
                  <Route path="/submissions" element={<Suggestions />} />
                  <Route path="/fleet" element={<Team />} />
                  <Route path="/suggestions" element={<Navigate to="/app/submissions" replace />} />
                  <Route path="/team" element={<Navigate to="/app/fleet" replace />} />
                  <Route path="/audit" element={<AuditLog />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/app" />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
