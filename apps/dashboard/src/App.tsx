import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profiles from "./pages/Profiles";
import ProfileDetail from "./pages/ProfileDetail";
import Secrets from "./pages/Secrets";
import Suggestions from "./pages/Suggestions";
import TeamStatus from "./pages/TeamStatus";
import AuditLog from "./pages/AuditLog";
import Users from "./pages/Users";
import Invite from "./pages/Invite";
import Join from "./pages/Join";
import Inventory from "./pages/Inventory";
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
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/profiles" element={<Profiles />} />
                  <Route path="/profiles/:id" element={<ProfileDetail />} />
                  <Route path="/secrets" element={<Secrets />} />
                  <Route path="/suggestions" element={<Suggestions />} />
                  <Route path="/status" element={<TeamStatus />} />
                  <Route path="/audit" element={<AuditLog />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/invite" element={<Invite />} />
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
