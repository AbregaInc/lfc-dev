import { useState, useEffect } from "react";
import { API_URL } from "./config";
import Login from "./pages/Login";
import Status from "./pages/Status";
import Onboarding, { type ToolScan } from "./pages/Onboarding";

type Page = "login" | "status" | "onboarding";

type ConfigItem = { type: "mcp"; name: string; command: string; args: string[]; managed: boolean }
  | { type: "skill" | "rule" | "agent"; name: string; managed: boolean; preview: string };

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
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

function getStored() {
  const storedOrgId = localStorage.getItem("lfc_tray_org_id");
  return {
    token: localStorage.getItem("lfc_tray_token"),
    email: localStorage.getItem("lfc_tray_email") || "",
    apiUrl: API_URL,
    orgId: storedOrgId && storedOrgId !== "null" ? storedOrgId : "",
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
    syncInterval: 7200,
    syncStatus: "idle",
    installedTools: [],
    syncedConfigs: 0,
  });
  const [toolScans, setToolScans] = useState<ToolScan[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<Set<string>>(new Set());
  const [defaultProfileId, setDefaultProfileId] = useState<string | null>(null);

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
    const { token, email, apiUrl, orgId } = getStored();
    if (token && orgId) {
      setState((s) => ({ ...s, loggedIn: true, email, apiUrl }));
      const hasLastSync = !!localStorage.getItem("lfc_tray_last_sync");
      setPage(hasLastSync ? "status" : "onboarding");
    } else if (token) {
      localStorage.removeItem("lfc_tray_token");
      localStorage.removeItem("lfc_tray_email");
      localStorage.removeItem("lfc_tray_org_id");
      localStorage.removeItem("lfc_tray_last_sync");
    }
  };

  const loadDefaultProfile = async () => {
    try {
      const { orgId } = getStored();
      if (!orgId) return;
      const data = await apiFetch(`/api/orgs/${orgId}/profiles`);
      const profiles = data.profiles || [];
      if (profiles.length > 0) {
        setDefaultProfileId(profiles[0].id);
      }
    } catch (e) {
      console.warn("[LFC] Failed to load profiles:", e);
    }
  };

  const handleLogin = async (apiUrl: string, email: string, password: string) => {
    if (isTauri) {
      await tauriInvoke("login", { apiUrl, email, password });
      await loadStatus();
      await loadDefaultProfile();
      return;
    }
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    if (!data.user?.orgId) {
      throw new Error("This account is not part of an organization. Create one or join by invite in the dashboard first.");
    }
    localStorage.setItem("lfc_tray_token", data.token);
    localStorage.setItem("lfc_tray_email", email);
    localStorage.setItem("lfc_tray_org_id", data.user.orgId);
    setState((s) => ({ ...s, loggedIn: true, email, apiUrl }));
    await loadDefaultProfile();
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

  const buildSuggestionContent = (item: ConfigItem): { configType: string; title: string; content: string } => {
    if (item.type === "mcp") {
      return {
        configType: "mcp",
        title: `Add ${item.name} MCP server`,
        content: JSON.stringify({ servers: [{ name: item.name, command: item.command, args: item.args, env: {}, _managed_by: "lfc" }] }),
      };
    }
    return {
      configType: item.type === "skill" ? "skills" : item.type === "agent" ? "agents" : "rules",
      title: `Add ${item.name} ${item.type}`,
      content: JSON.stringify({ name: item.name, content: item.preview || "" }),
    };
  };

  const handleSuggest = async (toolId: string, item: ConfigItem) => {
    const { orgId } = getStored();
    if (!orgId || !defaultProfileId) return;
    const { configType, title, content } = buildSuggestionContent(item);

    if (isTauri) {
      try {
        await tauriInvoke("submit_suggestion", { profileId: defaultProfileId, configType, title, content, description: `From ${toolId}` });
      } catch (e) {
        console.warn("[LFC] Tauri submit_suggestion failed, falling back to API:", e);
        await apiFetch(`/api/orgs/${orgId}/suggestions`, {
          method: "POST",
          body: JSON.stringify({ profileId: defaultProfileId, configType, title, content, description: `From ${toolId}` }),
        });
      }
    } else {
      await apiFetch(`/api/orgs/${orgId}/suggestions`, {
        method: "POST",
        body: JSON.stringify({ profileId: defaultProfileId, configType, title, content, description: `From ${toolId}` }),
      });
    }

    const key = `${toolId}:${item.type}:${item.name}`;
    setSuggestedItems((prev) => new Set(prev).add(key));
  };

  const handleSuggestAll = async (toolId: string, items: ConfigItem[]) => {
    for (const item of items) {
      await handleSuggest(toolId, item);
    }
  };

  // Load default profile on mount if already logged in
  useEffect(() => {
    if (state.loggedIn && !defaultProfileId) {
      loadDefaultProfile();
    }
  }, [state.loggedIn]);

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
      suggestedItems={suggestedItems}
      onSyncNow={handleSyncNow}
      onRescan={handleScanTools}
      onSuggest={handleSuggest}
      onSuggestAll={handleSuggestAll}
      onSaveSyncInterval={handleSaveSyncInterval}
      onLogout={handleLogout}
    />
  );
}
