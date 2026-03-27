import { useState } from "react";
import { DASHBOARD_URL } from "../config";
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
  return parts.length > 0 ? parts.join(", ") : "No artifacts";
}

function unmanagedCount(scan: ToolScan): number {
  return (
    scan.mcpServers.filter((s) => !s.managed).length +
    scan.skills.filter((s) => !s.managed).length +
    scan.rules.filter((s) => !s.managed).length +
    scan.agents.filter((s) => !s.managed).length
  );
}

const INTERVAL_LABELS: Record<number, string> = {
  300: "5m",
  1800: "30m",
  7200: "2h",
  86400: "24h",
};

type ConfigItem = { type: "mcp"; name: string; command: string; args: string[]; managed: boolean }
  | { type: "skill" | "rule" | "agent"; name: string; managed: boolean; preview: string };

function itemKey(toolId: string, item: ConfigItem): string {
  return `${toolId}:${item.type}:${item.name}`;
}

export default function Status({
  email,
  syncStatus,
  syncError,
  lastSync,
  syncedConfigs,
  syncInterval,
  toolScans,
  suggestedItems,
  onSyncNow,
  onRescan,
  onSuggest,
  onSuggestAll,
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
  suggestedItems: Set<string>;
  onSyncNow: () => void;
  onRescan: () => void;
  onSuggest: (toolId: string, item: ConfigItem) => Promise<void>;
  onSuggestAll: (toolId: string, items: ConfigItem[]) => Promise<void>;
  onSaveSyncInterval: (interval: number) => void;
  onLogout: () => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [suggestingKey, setSuggestingKey] = useState<string | null>(null);
  const isConnected = syncStatus !== "error";
  const isSyncing = syncStatus === "syncing";
  const isSynced = syncStatus === "synced";
  const isError = syncStatus === "error";

  const handleSuggest = async (toolId: string, item: ConfigItem) => {
    const key = itemKey(toolId, item);
    setSuggestingKey(key);
    try {
      await onSuggest(toolId, item);
    } finally {
      setSuggestingKey(null);
    }
  };

  const handleSuggestAll = async (toolId: string, items: ConfigItem[]) => {
    setSuggestingKey(`${toolId}:all`);
    try {
      await onSuggestAll(toolId, items);
    } finally {
      setSuggestingKey(null);
    }
  };

  const TYPE_ORDER: Record<string, number> = { mcp: 0, skill: 1, agent: 2, rule: 3 };

  const getConfigItems = (scan: ToolScan): ConfigItem[] => {
    const items: ConfigItem[] = [
      ...scan.mcpServers.map((s) => ({ type: "mcp" as const, ...s })),
      ...scan.skills.map((s) => ({ type: "skill" as const, ...s })),
      ...scan.rules.map((s) => ({ type: "rule" as const, ...s })),
      ...scan.agents.map((s) => ({ type: "agent" as const, ...s })),
    ];
    items.sort((a, b) =>
      (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9)
      || Number(a.managed) - Number(b.managed)
      || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return items;
  };

  const TYPE_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
    mcp: { bg: "rgba(52, 211, 153, 0.08)", fg: "#34d399", label: "MCP" },
    skill: { bg: "rgba(229, 168, 34, 0.08)", fg: "#e5a822", label: "Skill" },
    agent: { bg: "rgba(96, 165, 250, 0.08)", fg: "#60a5fa", label: "Agent" },
    rule: { bg: "rgba(168, 85, 247, 0.08)", fg: "#a855f7", label: "Rule" },
  };

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
            style={{ background: "var(--color-accent)", color: "var(--color-text-inverse)" }}
          >
            LFC
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
              {syncedConfigs} artifact{syncedConfigs !== 1 ? "s" : ""} applied
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

        {/* Tools card — expandable */}
        <div className="card p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="section-title">Detected tools</div>
            <button className="btn-ghost text-[11px]" onClick={onRescan}>Rescan</button>
          </div>
          {toolScans.length > 0 ? (
            <div className="space-y-1">
              {toolScans.filter((s) => s.installed).map((scan) => {
                const isExpanded = expandedTool === scan.id;
                const items = getConfigItems(scan);
                const unmanaged = items.filter((i) => !i.managed);
                const unmanagedN = unmanaged.length;

                return (
                  <div key={scan.id}>
                    {/* Tool header — clickable */}
                    <button
                      className="w-full flex items-center gap-2 py-1.5 rounded-md transition-colors"
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", textAlign: "left" }}
                      onClick={() => setExpandedTool(isExpanded ? null : scan.id)}
                    >
                      <span
                        className="text-[10px] shrink-0 transition-transform"
                        style={{
                          color: "var(--color-text-tertiary)",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      >
                        {"\u25B6"}
                      </span>
                      <span
                        className="w-[5px] h-[5px] rounded-full shrink-0"
                        style={{ background: "var(--color-success)" }}
                      />
                      <span className="text-[12px] font-medium flex-1" style={{ color: "var(--color-text-secondary)" }}>
                        {scan.name}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                        {toolConfigSummary(scan)}
                      </span>
                    </button>

                    {/* Expanded config list */}
                    {isExpanded && (
                      <div className="ml-[17px] mt-1 mb-2">
                        {/* Suggest all button */}
                        {unmanagedN > 1 && (
                          <div className="mb-2">
                            <button
                              className="btn-ghost text-[11px]"
                              style={{ color: "var(--color-accent)" }}
                              disabled={suggestingKey === `${scan.id}:all` || unmanaged.every((i) => suggestedItems.has(itemKey(scan.id, i)))}
                              onClick={() => handleSuggestAll(scan.id, unmanaged.filter((i) => !suggestedItems.has(itemKey(scan.id, i))))}
                            >
                              {suggestingKey === `${scan.id}:all`
                                ? "Suggesting..."
                                : unmanaged.every((i) => suggestedItems.has(itemKey(scan.id, i)))
                                  ? "All suggested"
                                  : `Suggest all ${unmanagedN} to team`}
                            </button>
                          </div>
                        )}

                        {items.length === 0 ? (
                          <div className="text-[11px] py-1" style={{ color: "var(--color-text-tertiary)" }}>
                            No artifacts detected
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {items.map((item) => {
                              const key = itemKey(scan.id, item);
                              const isSuggested = suggestedItems.has(key);
                              const isSuggesting = suggestingKey === key;
                              const badge = TYPE_BADGE[item.type];

                              return (
                                <div key={key} className="flex items-center gap-2 py-1">
                                  <span
                                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                                    style={{ background: badge.bg, color: badge.fg }}
                                  >
                                    {badge.label}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                                      {item.name}
                                    </span>
                                    {item.type === "mcp" && (
                                      <span className="text-[10px] font-mono ml-1.5" style={{ color: "var(--color-text-tertiary)" }}>
                                        {item.command}
                                      </span>
                                    )}
                                  </div>
                                  {item.managed ? (
                                    <span
                                      className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                                      style={{ background: "rgba(52, 211, 153, 0.08)", color: "#34d399" }}
                                    >
                                      Managed
                                    </span>
                                  ) : isSuggested ? (
                                    <span
                                      className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                                      style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
                                    >
                                      Suggested
                                    </span>
                                  ) : (
                                    <button
                                      className="btn-ghost text-[10px] shrink-0"
                                      style={{ color: "var(--color-accent)", padding: "2px 6px" }}
                                      disabled={isSuggesting}
                                      onClick={() => handleSuggest(scan.id, item)}
                                    >
                                      {isSuggesting ? "..." : "Suggest"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
              {[300, 1800, 7200, 86400].map((val) => (
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-ghost"
          >
            {showSettings ? "Hide settings" : "Settings"}
          </button>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ color: "var(--color-accent)", textDecoration: "none" }}
          >
            Open Dashboard
          </a>
        </div>
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
