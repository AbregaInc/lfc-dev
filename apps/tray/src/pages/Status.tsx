import { useState } from "react";
import type { ToolScan } from "./Onboarding";

const TOOL_LABELS: Record<string, string> = {
  "claude-desktop": "Claude Desktop",
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  windsurf: "Windsurf",
};

function formatTime(ts?: string): string {
  if (!ts) return "Never";
  const n = Number(ts);
  if (!isNaN(n) && n > 1e12) return new Date(n).toLocaleTimeString();
  return new Date(ts).toLocaleTimeString();
}

function toolConfigSummary(scan: ToolScan): string {
  const parts: string[] = [];
  const managedMcp = scan.mcpServers.filter((s) => s.managed).length;
  const totalMcp = scan.mcpServers.length;
  if (totalMcp > 0) parts.push(`${totalMcp} MCP${managedMcp > 0 ? ` (${managedMcp} managed)` : ""}`);
  const totalSkills = scan.skills.length;
  if (totalSkills > 0) parts.push(`${totalSkills} skill${totalSkills !== 1 ? "s" : ""}`);
  const totalRules = scan.rules.length;
  if (totalRules > 0) parts.push(`${totalRules} rule${totalRules !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "No configs";
}

const INTERVAL_LABELS: Record<number, string> = {
  30: "30s",
  60: "1m",
  300: "5m",
  900: "15m",
};

export default function Status({
  email,
  syncStatus,
  syncError,
  lastSync,
  syncedConfigs,
  syncInterval,
  toolScans,
  onSyncNow,
  onRescan,
  onSaveSyncInterval,
  onLogout,
}: {
  email: string;
  syncStatus: string;
  syncError?: string;
  lastSync?: string;
  syncedConfigs: number;
  syncInterval: number;
  toolScans: ToolScan[];
  onSyncNow: () => void;
  onRescan: () => void;
  onSaveSyncInterval: (interval: number) => void;
  onLogout: () => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const isConnected = syncStatus !== "error";
  const isSyncing = syncStatus === "syncing";
  const isSynced = syncStatus === "synced";
  const isError = syncStatus === "error";

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-surface)" }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
            style={{ background: "var(--color-text-primary)", color: "var(--color-text-inverse)" }}
          >
            LF
          </div>
          <div>
            <div className="text-[13px] font-semibold" style={{ letterSpacing: "-0.01em" }}>LFC</div>
            <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>{email}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-[6px] h-[6px] rounded-full"
            style={{ background: isConnected ? "var(--color-success)" : "var(--color-danger)" }}
          />
          <span className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
            {isConnected ? "Connected" : "Error"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 space-y-3 overflow-auto">
        {/* Sync card */}
        <div className="card p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">Sync</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                {lastSync ? `Last: ${formatTime(lastSync)}` : "Not synced yet"}
              </div>
            </div>
            <button onClick={onSyncNow} disabled={isSyncing} className="btn-primary">
              {isSyncing ? "Syncing..." : "Sync now"}
            </button>
          </div>
          {isSynced && syncedConfigs > 0 && (
            <div
              className="mt-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
              style={{ background: "var(--color-success-subtle)", color: "var(--color-success)" }}
            >
              {syncedConfigs} config{syncedConfigs !== 1 ? "s" : ""} synced
            </div>
          )}
          {isError && (
            <div
              className="mt-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
              style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
            >
              {syncError || "Sync failed. Is the API running?"}
            </div>
          )}
        </div>

        {/* Tools card */}
        <div className="card p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="section-title">Detected tools</div>
            <button className="btn-ghost text-[11px]" onClick={onRescan}>Rescan</button>
          </div>
          {toolScans.length > 0 ? (
            <div className="space-y-2">
              {toolScans.filter((s) => s.installed).map((scan) => (
                <div key={scan.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-[5px] h-[5px] rounded-full shrink-0"
                      style={{ background: "var(--color-success)" }}
                    />
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                      {scan.name}
                    </span>
                  </div>
                  <div
                    className="text-[11px] ml-[13px] mt-0.5"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {toolConfigSummary(scan)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
              No tools detected yet.
            </div>
          )}
        </div>

        {/* Inline settings */}
        {showSettings && (
          <div className="card p-3.5">
            <div className="section-title mb-2">Sync interval</div>
            <div className="flex gap-1.5">
              {[30, 60, 300, 900].map((val) => (
                <button
                  key={val}
                  onClick={() => onSaveSyncInterval(val)}
                  className="flex-1 py-1.5 rounded-md text-[11px] font-medium"
                  style={{
                    background: syncInterval === val ? "var(--color-text-primary)" : "var(--color-surface)",
                    color: syncInterval === val ? "var(--color-text-inverse)" : "var(--color-text-tertiary)",
                    border: syncInterval === val ? "none" : "1px solid var(--color-border)",
                    cursor: "pointer",
                  }}
                >
                  {INTERVAL_LABELS[val]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 flex items-center justify-between shrink-0"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="btn-ghost"
        >
          {showSettings ? "Hide settings" : "Settings"}
        </button>
        <button
          onClick={onLogout}
          className="btn-ghost"
          style={{ color: "var(--color-danger)" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
