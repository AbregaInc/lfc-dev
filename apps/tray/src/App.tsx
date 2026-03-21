import { useState, useEffect } from "react";
import { API_URL } from "./config";
import Login from "./pages/Login";
import Status from "./pages/Status";
import Onboarding, { type ToolScan } from "./pages/Onboarding";

type Page = "login" | "status" | "onboarding";

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

const isTauri = !!(window as any).__TAURI__;

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/tauri");
  return invoke<T>(cmd, args);
}

function getStored() {
  return {
    token: localStorage.getItem("lfc_tray_token"),
    email: localStorage.getItem("lfc_tray_email") || "",
    apiUrl: API_URL,
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

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [state, setState] = useState<AppState>({
    loggedIn: false,
    apiUrl: API_URL,
    syncInterval: 300,
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
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("lfc_tray_token", data.token);
    localStorage.setItem("lfc_tray_email", email);
    localStorage.setItem("lfc_tray_org_id", data.user.orgId);
    setState((s) => ({ ...s, loggedIn: true, email, apiUrl }));
    setPage("onboarding");
  };

  const handleLogout = async () => {
    if (isTauri) {
      try { await tauriInvoke("logout"); } catch {}
    } else {
      localStorage.removeItem("lfc_tray_token");
      localStorage.removeItem("lfc_tray_email");
      localStorage.removeItem("lfc_tray_org_id");
      localStorage.removeItem("lfc_tray_last_sync");
    }
    setState((s) => ({ ...s, loggedIn: false, email: undefined, syncStatus: "idle", syncError: undefined, installedTools: [], syncedConfigs: 0 }));
    setToolScans([]);
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

    try {
      const data = await apiFetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({
          installedTools: ["claude-desktop", "claude-code", "cursor", "codex", "windsurf"],
          currentVersions: {},
        }),
      });
      const configs = data.configs || [];
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

  const handleSaveSyncInterval = async (syncInterval: number) => {
    if (isTauri) {
      try { await tauriInvoke("save_settings", { apiUrl: API_URL, syncInterval }); } catch {}
    }
    setState((s) => ({ ...s, syncInterval }));
  };

  const handleScanTools = async () => {
    let scans: ToolScan[] = [];
    if (isTauri) {
      scans = await tauriInvoke<ToolScan[]>("scan_tools");
    }
    setToolScans(scans);
    if (scans.length > 0) {
      try {
        if (isTauri) {
          await tauriInvoke("upload_snapshot", { tools: scans });
        } else {
          await apiFetch("/api/snapshots", {
            method: "POST",
            body: JSON.stringify({ tools: scans }),
          });
        }
      } catch (e) {
        console.warn("[LFC] Snapshot upload failed:", e);
      }
    }
  };

  if (page === "login") {
    return <Login onLogin={handleLogin} />;
  }

  if (page === "onboarding") {
    return (
      <Onboarding
        scans={toolScans}
        onScanTools={handleScanTools}
        onSyncNow={handleSyncNow}
        onGoToStatus={() => setPage("status")}
      />
    );
  }

  return (
    <Status
      email={state.email || ""}
      syncStatus={state.syncStatus}
      syncError={state.syncError}
      lastSync={state.lastSync}
      syncedConfigs={state.syncedConfigs}
      syncInterval={state.syncInterval}
      toolScans={toolScans}
      onSyncNow={handleSyncNow}
      onRescan={handleScanTools}
      onSaveSyncInterval={handleSaveSyncInterval}
      onLogout={handleLogout}
    />
  );
}
