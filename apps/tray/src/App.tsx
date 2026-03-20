import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Status from "./pages/Status";
import Settings from "./pages/Settings";
import Suggest from "./pages/Suggest";
import Onboarding, { type ToolScan } from "./pages/Onboarding";

type Page = "login" | "status" | "settings" | "suggest" | "onboarding";

interface AppState {
  loggedIn: boolean;
  email?: string;
  apiUrl: string;
  syncInterval: number;
  lastSync?: string;
  syncStatus: string;
  syncError?: string;
  installedTools: string[];
  syncedConfigs: number;
}

interface LocalConfig {
  configType: string;
  name: string;
  preview: string;
  content: string;
}

interface Suggestion {
  id: string;
  title: string;
  configType: string;
  status: string;
  createdAt: string;
}

interface Profile {
  id: string;
  name: string;
}

// Detect if we're running inside Tauri
const isTauri = !!(window as any).__TAURI__;

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/tauri");
  return invoke<T>(cmd, args);
}

// ─── Browser-mode API helper ─────────────────────────────────────────

function getStored() {
  return {
    token: localStorage.getItem("lfc_tray_token"),
    email: localStorage.getItem("lfc_tray_email") || "",
    apiUrl: localStorage.getItem("lfc_tray_api_url") || "http://localhost:3001",
    orgId: localStorage.getItem("lfc_tray_org_id") || "",
  };
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const { token, apiUrl } = getStored();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers as any };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${apiUrl}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── App ─────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [state, setState] = useState<AppState>({
    loggedIn: false,
    apiUrl: "http://localhost:3001",
    syncInterval: 30,
    syncStatus: "idle",
    installedTools: [],
    syncedConfigs: 0,
  });
  const [toolScans, setToolScans] = useState<ToolScan[]>([]);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    if (isTauri) {
      try {
        const status = await tauriInvoke<AppState>("get_status");
        setState(status);
        if (!status.loggedIn) {
          setPage("login");
        } else if (status.syncStatus === "idle" && !status.lastSync) {
          setPage("onboarding");
        } else {
          setPage("status");
        }
        return;
      } catch (e) {
        console.error("[LFC] get_status failed:", e);
      }
    }
    // Browser fallback
    const { token, email, apiUrl } = getStored();
    if (token) {
      setState((s) => ({ ...s, loggedIn: true, email, apiUrl }));
      const hasLastSync = !!localStorage.getItem("lfc_tray_last_sync");
      setPage(hasLastSync ? "status" : "onboarding");
    }
  };

  const handleLogin = async (apiUrl: string, email: string, password: string) => {
    if (isTauri) {
      await tauriInvoke("login", { apiUrl, email, password });
      await loadStatus();
      return;
    }
    // Browser fallback
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("lfc_tray_token", data.token);
    localStorage.setItem("lfc_tray_email", email);
    localStorage.setItem("lfc_tray_api_url", apiUrl);
    localStorage.setItem("lfc_tray_org_id", data.user.orgId);
    setState((s) => ({ ...s, loggedIn: true, email, apiUrl }));
    const hasLastSync = !!localStorage.getItem("lfc_tray_last_sync");
    setPage(hasLastSync ? "status" : "onboarding");
  };

  const handleLogout = async () => {
    if (isTauri) {
      try { await tauriInvoke("logout"); } catch {}
    } else {
      localStorage.removeItem("lfc_tray_token");
      localStorage.removeItem("lfc_tray_email");
      localStorage.removeItem("lfc_tray_api_url");
      localStorage.removeItem("lfc_tray_org_id");
    }
    setState((s) => ({ ...s, loggedIn: false, email: undefined, syncStatus: "idle", syncError: undefined, installedTools: [], syncedConfigs: 0 }));
    setPage("login");
  };

  const handleSyncNow = async () => {
    setState((s) => ({ ...s, syncStatus: "syncing", syncError: undefined }));

    if (isTauri) {
      try {
        await tauriInvoke("sync_now");
        await loadStatus();
      } catch (e: any) {
        const msg = typeof e === "string" ? e : e.message || "Sync failed";
        setState((s) => ({ ...s, syncStatus: "error", syncError: msg }));
      }
      return;
    }

    // Browser fallback
    try {
      const data = await apiFetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({
          installedTools: ["claude-desktop", "claude-code", "cursor", "codex", "windsurf"],
          currentVersions: {},
        }),
      });
      const configs = data.configs || [];
      // Collect unique tools from the response
      const tools = new Set<string>();
      for (const c of configs) {
        for (const t of c.targetTools || []) tools.add(t);
      }
      const now = new Date().toISOString();
      localStorage.setItem("lfc_tray_last_sync", now);
      setState((s) => ({
        ...s,
        syncStatus: "synced",
        lastSync: now,
        syncedConfigs: configs.length,
        installedTools: Array.from(tools),
      }));
    } catch (e: any) {
      setState((s) => ({ ...s, syncStatus: "error", syncError: e.message || "Sync failed" }));
    }
  };

  const handleSaveSettings = async (apiUrl: string, syncInterval: number) => {
    if (isTauri) {
      try { await tauriInvoke("save_settings", { apiUrl, syncInterval }); } catch {}
    } else {
      localStorage.setItem("lfc_tray_api_url", apiUrl);
    }
    setState((s) => ({ ...s, apiUrl, syncInterval }));
    setPage("status");
  };

  // ─── Suggest handlers ───────────────────────────────────────────────

  const handleDetectConfigs = async (): Promise<LocalConfig[]> => {
    if (isTauri) {
      return tauriInvoke<LocalConfig[]>("detect_local_configs");
    }
    // Browser fallback — local config detection requires native app
    console.warn("[LFC] Local config detection requires the native app.");
    return [];
  };

  const handleSubmitSuggestion = async (
    profileId: string,
    configType: string,
    title: string,
    description: string,
    content: string,
  ) => {
    if (isTauri) {
      await tauriInvoke("submit_suggestion", { profileId, configType, title, description, content });
      return;
    }
    // Browser fallback — call API directly
    const { orgId } = getStored();
    await apiFetch(`/api/orgs/${orgId}/suggestions`, {
      method: "POST",
      body: JSON.stringify({ profileId, configType, title, description, content }),
    });
  };

  const handleGetSuggestions = async (): Promise<Suggestion[]> => {
    if (isTauri) {
      return tauriInvoke<Suggestion[]>("get_my_suggestions");
    }
    // Browser fallback
    try {
      const { orgId } = getStored();
      const data = await apiFetch(`/api/orgs/${orgId}/suggestions`);
      return data.suggestions || [];
    } catch {
      return [];
    }
  };

  const handleFetchProfiles = async (): Promise<Profile[]> => {
    if (isTauri) {
      return tauriInvoke<Profile[]>("get_profiles");
    }
    // Browser fallback
    try {
      const { orgId } = getStored();
      const data = await apiFetch(`/api/orgs/${orgId}/profiles`);
      return data.profiles || [];
    } catch {
      return [];
    }
  };

  // ─── Scan tools handler ────────────────────────────────────────────

  const handleScanTools = async () => {
    let scans: ToolScan[] = [];
    if (isTauri) {
      scans = await tauriInvoke<ToolScan[]>("scan_tools");
    }
    setToolScans(scans);
    // Upload snapshot to server so admin can see the team's inventory
    if (scans.length > 0) {
      try {
        await handleUploadSnapshot(scans);
      } catch (e) {
        console.warn("[LFC] Snapshot upload failed:", e);
      }
    }
  };

  const handleUploadSnapshot = async (tools: ToolScan[]) => {
    if (isTauri) {
      await tauriInvoke("upload_snapshot", { tools });
      return;
    }
    // Browser fallback
    await apiFetch("/api/snapshots", {
      method: "POST",
      body: JSON.stringify({ tools }),
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (page === "login") {
    return <Login apiUrl={state.apiUrl} onLogin={handleLogin} />;
  }

  if (page === "onboarding") {
    return (
      <Onboarding
        scans={toolScans}
        onScanTools={handleScanTools}
        onUploadSnapshot={handleUploadSnapshot}
        onSyncNow={handleSyncNow}
        onGoToStatus={() => setPage("status")}
      />
    );
  }

  if (page === "settings") {
    return (
      <Settings
        apiUrl={state.apiUrl}
        syncInterval={state.syncInterval}
        onSave={handleSaveSettings}
        onBack={() => setPage("status")}
      />
    );
  }

  if (page === "suggest") {
    return (
      <Suggest
        onBack={() => setPage("status")}
        onDetectConfigs={handleDetectConfigs}
        onSubmitSuggestion={handleSubmitSuggestion}
        onGetSuggestions={handleGetSuggestions}
        onFetchProfiles={handleFetchProfiles}
      />
    );
  }

  return (
    <Status
      email={state.email || ""}
      syncStatus={state.syncStatus}
      syncError={state.syncError}
      lastSync={state.lastSync}
      installedTools={state.installedTools}
      syncedConfigs={state.syncedConfigs}
      toolScans={toolScans}
      onSyncNow={handleSyncNow}
      onRescan={handleScanTools}
      onSettings={() => setPage("settings")}
      onSuggest={() => setPage("suggest")}
      onLogout={handleLogout}
    />
  );
}
