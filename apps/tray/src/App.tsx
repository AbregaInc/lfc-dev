import { useState, useEffect } from "react";
import { API_URL } from "./config";
import Login from "./pages/Login";
import Status from "./pages/Status";
import Onboarding from "./pages/Onboarding";
import type { ToolScan } from "./lib/toolScan";

type Page = "login" | "status" | "onboarding";

type ConfigItem =
  | {
      type: "mcp";
      name: string;
      command: string;
      args: string[];
      managed: boolean;
      scope?: string;
      supportedTools?: string[];
      path?: string;
      distributionScope?: "shared" | "tool";
    }
  | {
      type: "skill" | "rule" | "agent";
      name: string;
      managed: boolean;
      preview: string;
      scope?: string;
      supportedTools?: string[];
      path?: string;
      distributionScope?: "shared" | "tool";
    };

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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function tauriInvokeWithTimeout<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  timeoutMs: number,
  message: string
): Promise<T> {
  return withTimeout(tauriInvoke<T>(cmd, args), timeoutMs, message);
}

function getStored() {
  return {
    token: localStorage.getItem("lfc_tray_token"),
    email: localStorage.getItem("lfc_tray_email") || "",
    apiUrl: API_URL,
    orgId: localStorage.getItem("lfc_tray_org_id") || "",
    deviceId: localStorage.getItem("lfc_tray_device_id") || "",
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
        const status = await tauriInvokeWithTimeout<AppState>(
          "get_status",
          undefined,
          5000,
          "Tray status check timed out"
        );
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

  const ensureBrowserDevice = async () => {
    const { deviceId } = getStored();
    const data = await apiFetch("/api/devices/register", {
      method: "POST",
      body: JSON.stringify({
        deviceId: deviceId || undefined,
        name: `browser@${window.location.hostname || "local"}`,
        platform: navigator.platform || "browser",
        arch: "unknown",
        clientKind: "tray-web",
        clientVersion: "0.1.0",
        detectedTools: [],
      }),
    });
    const resolvedDeviceId = data.device?.id as string;
    if (resolvedDeviceId) {
      localStorage.setItem("lfc_tray_device_id", resolvedDeviceId);
    }
    return resolvedDeviceId;
  };

  const handleLogin = async (apiUrl: string, email: string, password: string) => {
    if (isTauri) {
      await tauriInvokeWithTimeout(
        "login",
        { apiUrl, email, password },
        15000,
        "Tray login timed out. Check the local API URL and try again."
      );
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
    localStorage.setItem("lfc_tray_token", data.token);
    localStorage.setItem("lfc_tray_email", email);
    localStorage.setItem("lfc_tray_org_id", data.user.orgId);
    localStorage.removeItem("lfc_tray_device_id");
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
      localStorage.removeItem("lfc_tray_device_id");
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
        await tauriInvokeWithTimeout(
          "sync_now",
          undefined,
          30000,
          "Initial sync timed out. Check that the local server is reachable and retry."
        );
        await loadStatus();
      } catch (e: any) {
        const msg = typeof e === "string" ? e : e.message || "Sync failed";
        setState((s) => ({ ...s, syncStatus: "error", syncError: msg }));
      }
      return;
    }

    try {
      const deviceId = await ensureBrowserDevice();
      const data = await apiFetch(`/api/devices/${deviceId}/sync`, {
        method: "POST",
        body: JSON.stringify({
          detectedTools: [],
          states: [],
          inventory: [],
        }),
      });
      const now = new Date().toISOString();
      localStorage.setItem("lfc_tray_last_sync", now);
      setState((s) => ({
        ...s,
        syncStatus: "synced",
        lastSync: now,
        syncedConfigs: (data.assignments || []).length,
      }));
    } catch (e: any) {
      setState((s) => ({ ...s, syncStatus: "error", syncError: e.message || "Sync failed" }));
    }
  };

  const handleSaveSyncInterval = async (syncInterval: number) => {
    if (isTauri) {
      try {
        await tauriInvokeWithTimeout(
          "save_settings",
          { apiUrl: API_URL, syncInterval },
          5000,
          "Saving tray settings timed out"
        );
      } catch {}
    }
    setState((s) => ({ ...s, syncInterval }));
  };

  const handleScanTools = async () => {
    let scans: ToolScan[] = [];
    if (isTauri) {
      scans = await tauriInvokeWithTimeout<ToolScan[]>(
        "scan_tools",
        undefined,
        15000,
        "Tool detection timed out. Close the tray and try again."
      );
    }
    setToolScans(scans);
    if (scans.length > 0) {
      try {
        if (isTauri) {
          await tauriInvokeWithTimeout(
            "upload_snapshot",
            { tools: scans },
            15000,
            "Inventory upload timed out"
          );
        } else {
          const deviceId = await ensureBrowserDevice();
          await apiFetch(`/api/devices/${deviceId}/inventory`, {
            method: "POST",
            body: JSON.stringify({ inventory: scans }),
          });
        }
      } catch (e) {
        console.warn("[LFC] Snapshot upload failed:", e);
      }
    }
  };

  const buildSuggestionContent = (
    toolId: string,
    item: ConfigItem
  ): { title: string; capture: Record<string, unknown> } => {
    const supportedTools =
      item.supportedTools && item.supportedTools.length > 0 ? item.supportedTools : [toolId];
    const sourceTool =
      toolId === "shared" ? supportedTools[0] || "claude-code" : toolId;

    if (item.type === "mcp") {
      return {
        title: `Add ${item.name} MCP server`,
        capture: {
          kind: "mcp",
          name: item.name,
          tool: sourceTool,
          supportedTools,
          serverName: item.name,
          command: item.command,
          args: item.args,
          envKeys: [],
          path: item.path,
          scope: item.scope,
          distributionScope: item.distributionScope,
        },
      };
    }

    return {
      title: `Add ${item.name} ${item.type}`,
      capture: {
        kind: item.type,
        name: item.name,
        tool: sourceTool,
        supportedTools,
        content: item.preview || "",
        path: item.path,
        scope: item.scope,
        distributionScope: item.distributionScope,
      },
    };
  };

  const handleSuggest = async (toolId: string, item: ConfigItem) => {
    const { orgId } = getStored();
    if (!orgId || !defaultProfileId) return;
    const { title, capture } = buildSuggestionContent(toolId, item);

    if (isTauri) {
      try {
        const content =
          item.type === "mcp"
            ? JSON.stringify({ servers: [{ name: item.name, command: item.command, args: item.args, env: {}, _managed_by: "lfc" }] })
            : JSON.stringify({ name: item.name, content: item.preview || "" });
        const configType = item.type === "mcp" ? "mcp" : item.type === "skill" ? "skills" : item.type === "agent" ? "agents" : "rules";
        await tauriInvoke("submit_suggestion", {
          profileId: defaultProfileId,
          configType,
          title,
          content,
          description: `From ${toolId}`,
          capture,
        });
      } catch (e) {
        console.warn("[LFC] Tauri submit_suggestion failed, falling back to API:", e);
        await apiFetch(`/api/orgs/${orgId}/submissions`, {
          method: "POST",
          body: JSON.stringify({
            title,
            description: `From ${toolId}`,
            capture: {
              ...capture,
              tool: toolId,
              metadata: { profileId: defaultProfileId },
            },
          }),
        });
      }
    } else {
      await apiFetch(`/api/orgs/${orgId}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: `From ${toolId}`,
          capture: {
            ...capture,
            tool: toolId,
            metadata: { profileId: defaultProfileId },
          },
        }),
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
