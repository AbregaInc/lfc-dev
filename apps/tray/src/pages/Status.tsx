import { useState } from "react";

import BrandMark from "../components/BrandMark";
import StatusBadge from "../components/StatusBadge";
import { Button, ButtonLink, buttonVariants } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  bindingScopeDescription,
  bindingScopeLabel,
  resolveBindingScope,
} from "../lib/bindings";
import {
  sharedRegistryMetrics,
  sharedRegistryPreview,
  sharedRegistrySkills,
  sharedSkillPreview,
  skillAvailabilityLabel,
  toolConfigSummary,
  toolInventoryMetrics,
  toolScopedSkills,
  type ToolScan,
} from "../lib/toolScan";
import { cn } from "../lib/utils";
import { DASHBOARD_URL } from "../config";

function formatTime(ts?: string): string {
  if (!ts) return "Never";
  const value = Number(ts);
  if (!Number.isNaN(value) && value > 1e12) {
    return new Date(value).toLocaleTimeString();
  }
  return new Date(ts).toLocaleTimeString();
}

function previewText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 140);
}

const INTERVAL_LABELS: Record<number, string> = {
  300: "5m",
  1800: "30m",
  7200: "2h",
  86400: "24h",
};

const TOOL_LABELS: Record<string, string> = {
  shared: "Shared registry",
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  windsurf: "Windsurf",
  opencode: "OpenCode",
};

const SHARED_SECTION_ID = "shared";

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

type SkillConfigItem = {
  type: "skill";
  name: string;
  managed: boolean;
  preview: string;
  scope?: string;
  supportedTools?: string[];
  path?: string;
  distributionScope?: "shared" | "tool";
};

function itemKey(toolId: string, item: ConfigItem): string {
  return `${toolId}:${item.type}:${item.name}`;
}

const TYPE_ORDER: Record<string, number> = { mcp: 0, skill: 1, agent: 2, rule: 3 };

const TYPE_META: Record<string, { label: string; tone: "success" | "warning" | "info" | "neutral" }> = {
  mcp: { label: "MCP", tone: "success" },
  skill: { label: "Skill", tone: "warning" },
  agent: { label: "Agent", tone: "info" },
  rule: { label: "Rule", tone: "neutral" },
};

function supportedToolsText(tools: string[] | undefined): string | null {
  if (!tools || tools.length <= 1) return null;
  return tools.map((tool) => TOOL_LABELS[tool] || tool).join(", ");
}

function itemStorageDescription(toolId: string, item: ConfigItem): string {
  if (item.type === "skill") {
    return skillAvailabilityLabel(item) === "Shared"
      ? "Installed once in ~/.agents/skills and linked into this tool."
      : "Stored only in this tool's local skills directory right now.";
  }

  return bindingScopeDescription(toolId, item.type);
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
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [suggestingKey, setSuggestingKey] = useState<string | null>(null);

  const installedScans = toolScans.filter((scan) => scan.installed);
  const sharedSkills = sharedRegistrySkills(installedScans);
  const sharedMetrics = sharedRegistryMetrics(installedScans);
  const sharedPreview = sharedRegistryPreview(installedScans);
  const isConnected = syncStatus !== "error";
  const isSyncing = syncStatus === "syncing";
  const isSynced = syncStatus === "synced";
  const isError = syncStatus === "error";

  const getConfigItems = (scan: ToolScan): ConfigItem[] => {
    const items: ConfigItem[] = [
      ...scan.mcpServers.map((server) => ({ type: "mcp" as const, ...server })),
      ...toolScopedSkills(scan).map((skill) => ({ type: "skill" as const, ...skill })),
      ...scan.rules.map((rule) => ({ type: "rule" as const, ...rule })),
      ...scan.agents.map((agent) => ({ type: "agent" as const, ...agent })),
    ];

    items.sort(
      (a, b) =>
        (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) ||
        Number(a.managed) - Number(b.managed) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    return items;
  };

  const sharedItems: SkillConfigItem[] = sharedSkills.map((skill) => ({
    type: "skill",
    ...skill,
  }));

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

  const toggleTool = (toolId: string) => {
    setExpandedTools((current) => {
      const next = new Set(current);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const expandAllTools = () => {
    const ids = installedScans.map((scan) => scan.id);
    if (sharedItems.length > 0) {
      ids.unshift(SHARED_SECTION_ID);
    }
    setExpandedTools(new Set(ids));
  };

  const collapseAllTools = () => {
    setExpandedTools(new Set());
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="border-b bg-background/90 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <BrandMark />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Desktop client</div>
              <div className="truncate text-xs leading-5 text-muted-foreground">{email}</div>
            </div>
          </div>
          <StatusBadge tone={isConnected ? "success" : "danger"}>
            {isConnected ? "Connected" : "Error"}
          </StatusBadge>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">Sync</div>
                    <StatusBadge
                      tone={isError ? "danger" : isSyncing ? "info" : isSynced ? "success" : "neutral"}
                    >
                      {isError ? "Blocked" : isSyncing ? "Syncing" : isSynced ? "Applied" : "Idle"}
                    </StatusBadge>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {lastSync ? `Last successful check at ${formatTime(lastSync)}.` : "This machine has not synced yet."}
                  </p>
                </div>
                <Button size="sm" onClick={onSyncNow} disabled={isSyncing}>
                  {isSyncing ? "Syncing..." : "Sync now"}
                </Button>
              </div>

              {isSynced ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                  {syncedConfigs > 0
                    ? `${syncedConfigs} artifact${syncedConfigs === 1 ? "" : "s"} applied on the last run.`
                    : "Last sync completed. No assignments matched this machine."}
                </div>
              ) : null}

              {isError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                  {syncError || "Sync failed. Check that the API is reachable and try again."}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Detected tools</CardTitle>
                  <CardDescription>
                    Expand a tool to review local MCPs, skills, rules, and suggest unmanaged items
                    back to your org.
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {installedScans.length + (sharedItems.length > 0 ? 1 : 0) > 1 ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={expandAllTools}>
                        Expand all
                      </Button>
                      <Button variant="ghost" size="sm" onClick={collapseAllTools}>
                        Collapse all
                      </Button>
                    </>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={onRescan}>
                    Rescan
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {installedScans.length > 0 ? (
                <>
                  {sharedItems.length > 0 ? (
                    (() => {
                      const isExpanded = expandedTools.has(SHARED_SECTION_ID);
                      const unmanaged = sharedItems.filter((item) => !item.managed);
                      const supportedToolsLabel =
                        sharedMetrics.supportedTools
                          .map((tool) => TOOL_LABELS[tool] || tool)
                          .join(", ") || "compatible tools";

                      return (
                        <div className="rounded-xl border bg-background">
                          <button
                            type="button"
                            onClick={() => toggleTool(SHARED_SECTION_ID)}
                            aria-expanded={isExpanded}
                            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 text-left"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                                isExpanded
                                  ? "border-primary/35 bg-primary/12 text-foreground"
                                  : "border-border bg-muted/30 text-muted-foreground"
                              )}
                            >
                              {isExpanded ? "−" : "+"}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">
                                Shared registry
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                {sharedItems.length} shared skill{sharedItems.length === 1 ? "" : "s"} installed once in
                                {" "}~/.agents/skills and linked into compatible tools.
                              </span>
                              <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                                Available in {supportedToolsLabel}
                              </span>
                              {sharedPreview ? (
                                <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                                  {sharedPreview}
                                </span>
                              ) : null}
                            </span>
                            <span className="flex flex-col items-end gap-2 justify-self-end text-right">
                              <span className="flex max-w-[11rem] flex-wrap justify-end gap-1.5">
                                <StatusBadge tone="info">
                                  {sharedItems.length} shared
                                </StatusBadge>
                                <StatusBadge tone={sharedMetrics.unmanagedItems > 0 ? "warning" : "success"}>
                                  {sharedMetrics.unmanagedItems > 0
                                    ? `${sharedMetrics.unmanagedItems} unmanaged`
                                    : "Managed ready"}
                                </StatusBadge>
                              </span>
                              <span className="text-[11px] leading-4 text-muted-foreground">
                                {isExpanded
                                  ? `Hide ${sharedItems.length} item${sharedItems.length === 1 ? "" : "s"}`
                                  : `Show ${sharedItems.length} item${sharedItems.length === 1 ? "" : "s"}`}
                              </span>
                            </span>
                          </button>

                          {isExpanded ? (
                            <div className="space-y-3 border-t px-3 py-3">
                              {sharedMetrics.unmanagedItems > 1 ? (
                                <div className="flex justify-start">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                      suggestingKey === `${SHARED_SECTION_ID}:all` ||
                                      unmanaged.every((item) =>
                                        suggestedItems.has(itemKey(SHARED_SECTION_ID, item))
                                      )
                                    }
                                    onClick={() =>
                                      handleSuggestAll(
                                        SHARED_SECTION_ID,
                                        unmanaged.filter(
                                          (item) => !suggestedItems.has(itemKey(SHARED_SECTION_ID, item))
                                        )
                                      )
                                    }
                                  >
                                    {suggestingKey === `${SHARED_SECTION_ID}:all`
                                      ? "Suggesting..."
                                      : unmanaged.every((item) =>
                                            suggestedItems.has(itemKey(SHARED_SECTION_ID, item))
                                        )
                                        ? "All suggested"
                                        : `Suggest all ${sharedMetrics.unmanagedItems}`}
                                  </Button>
                                </div>
                              ) : null}

                              <div className="space-y-2">
                                {sharedItems.map((item) => {
                                  const key = itemKey(SHARED_SECTION_ID, item);
                                  const isSuggested = suggestedItems.has(key);
                                  const isSuggesting = suggestingKey === key;
                                  const alsoAvailable = supportedToolsText(item.supportedTools);

                                  return (
                                    <div key={key} className="rounded-xl border bg-muted/20 px-3 py-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge tone="warning">Skill</StatusBadge>
                                            <StatusBadge tone="info">Shared</StatusBadge>
                                            <div className="text-sm font-medium text-foreground">
                                              {item.name}
                                            </div>
                                          </div>

                                          {item.preview ? (
                                            <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                              {previewText(item.preview)}
                                            </div>
                                          ) : null}

                                          <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                                            Installed once in ~/.agents/skills and linked into each compatible tool.
                                          </div>
                                          {alsoAvailable ? (
                                            <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                              Available in {alsoAvailable}
                                            </div>
                                          ) : null}
                                          {item.path ? (
                                            <div className="mt-1 break-all text-[11px] leading-5 text-muted-foreground">
                                              {item.path}
                                            </div>
                                          ) : null}
                                        </div>

                                        <div className="shrink-0">
                                          {item.managed ? (
                                            <StatusBadge tone="success">Managed</StatusBadge>
                                          ) : isSuggested ? (
                                            <StatusBadge tone="info">Suggested</StatusBadge>
                                          ) : (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={isSuggesting}
                                              onClick={() => handleSuggest(SHARED_SECTION_ID, item)}
                                            >
                                              {isSuggesting ? "Sending..." : "Suggest"}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()
                  ) : null}

                  {installedScans.map((scan) => {
                    const isExpanded = expandedTools.has(scan.id);
                    const items = getConfigItems(scan);
                    const unmanaged = items.filter((item) => !item.managed);
                    const localOnlyCount = unmanaged.length;
                    const itemCount = items.length;
                    const instructionScope = scan.instructions
                      ? resolveBindingScope(scan.id, "instructions")
                      : null;
                    const metrics = toolInventoryMetrics(scan);
                    const linkedSharedPreview = sharedSkillPreview(scan);

                    return (
                      <div key={scan.id} className="rounded-xl border bg-background">
                        <button
                          type="button"
                          onClick={() => toggleTool(scan.id)}
                          aria-expanded={isExpanded}
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 text-left"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                              isExpanded
                                ? "border-primary/35 bg-primary/12 text-foreground"
                                : "border-border bg-muted/30 text-muted-foreground"
                            )}
                          >
                            {isExpanded ? "−" : "+"}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">
                              {scan.name}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {toolConfigSummary(scan)}
                            </span>
                            <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                              {[
                                metrics.toolSkills > 0
                                  ? `${metrics.toolSkills} tool-local skill${metrics.toolSkills === 1 ? "" : "s"}`
                                  : null,
                                scan.instructions
                                  ? scan.id === "codex"
                                    ? "project instructions"
                                    : "user instructions"
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "No tool-local items detected"}
                            </span>
                            {linkedSharedPreview ? (
                              <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                                Reads shared registry: {linkedSharedPreview}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex flex-col items-end gap-2 justify-self-end text-right">
                            <span className="flex max-w-[11rem] flex-wrap justify-end gap-1.5">
                              {metrics.toolSkills > 0 ? (
                                <StatusBadge tone="neutral">
                                  {metrics.toolSkills} tool local
                                </StatusBadge>
                              ) : null}
                              {metrics.sharedSkills > 0 ? (
                                <StatusBadge tone="info">
                                  {metrics.sharedSkills} linked shared
                                </StatusBadge>
                              ) : null}
                              <StatusBadge tone={localOnlyCount > 0 ? "warning" : "success"}>
                                {localOnlyCount > 0 ? `${localOnlyCount} unmanaged` : "Managed ready"}
                              </StatusBadge>
                            </span>
                            <span className="text-[11px] leading-4 text-muted-foreground">
                              {isExpanded
                                ? `Hide ${itemCount + (scan.instructions ? 1 : 0)} item${itemCount + (scan.instructions ? 1 : 0) === 1 ? "" : "s"}`
                                : `Show ${itemCount + (scan.instructions ? 1 : 0)} item${itemCount + (scan.instructions ? 1 : 0) === 1 ? "" : "s"}`}
                            </span>
                          </span>
                        </button>

                        {isExpanded ? (
                          <div className="space-y-3 border-t px-3 py-3">
                            {scan.instructions ? (
                              <div className="rounded-xl border bg-muted/20 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <StatusBadge tone="info">Instructions</StatusBadge>
                                      {instructionScope ? (
                                        <StatusBadge tone="neutral">
                                          {bindingScopeLabel(instructionScope)}
                                        </StatusBadge>
                                      ) : null}
                                      <div className="text-sm font-medium text-foreground">
                                        {scan.instructions.path.split("/").pop() || scan.instructions.path}
                                      </div>
                                    </div>
                                    <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                      {bindingScopeDescription(scan.id, "instructions")}
                                    </div>
                                    <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                      {scan.instructions.userContentLines} user line
                                      {scan.instructions.userContentLines === 1 ? "" : "s"} ·{" "}
                                      {scan.instructions.managedContentLines} managed line
                                      {scan.instructions.managedContentLines === 1 ? "" : "s"}
                                    </div>
                                  </div>
                                  <div className="shrink-0">
                                    <StatusBadge tone={scan.instructions.hasManagedBlock ? "success" : "warning"}>
                                      {scan.instructions.hasManagedBlock ? "Managed block" : "Local only"}
                                    </StatusBadge>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {localOnlyCount > 1 ? (
                              <div className="flex justify-start">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    suggestingKey === `${scan.id}:all` ||
                                    unmanaged.every((item) =>
                                      suggestedItems.has(itemKey(scan.id, item))
                                    )
                                  }
                                  onClick={() =>
                                    handleSuggestAll(
                                      scan.id,
                                      unmanaged.filter(
                                        (item) => !suggestedItems.has(itemKey(scan.id, item))
                                      )
                                    )
                                  }
                                >
                                  {suggestingKey === `${scan.id}:all`
                                    ? "Suggesting..."
                                    : unmanaged.every((item) =>
                                          suggestedItems.has(itemKey(scan.id, item))
                                      )
                                      ? "All suggested"
                                      : `Suggest all ${localOnlyCount}`}
                                </Button>
                              </div>
                            ) : null}

                            {items.length > 0 ? (
                              <div className="space-y-2">
                                {items.map((item) => {
                                  const meta = TYPE_META[item.type];
                                  const key = itemKey(scan.id, item);
                                  const isSuggested = suggestedItems.has(key);
                                  const isSuggesting = suggestingKey === key;
                                  const scope = resolveBindingScope(scan.id, item.type, item.scope);
                                  const alsoAvailable = supportedToolsText(item.supportedTools);

                                  return (
                                    <div
                                      key={key}
                                      className="rounded-xl border bg-muted/20 px-3 py-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                                            {item.type === "skill" ? (
                                              <StatusBadge tone={skillAvailabilityLabel(item) === "Shared" ? "info" : "neutral"}>
                                                {skillAvailabilityLabel(item)}
                                              </StatusBadge>
                                            ) : (
                                              <StatusBadge tone="neutral">
                                                {bindingScopeLabel(scope)}
                                              </StatusBadge>
                                            )}
                                            <div className="text-sm font-medium text-foreground">
                                              {item.name}
                                            </div>
                                          </div>

                                          {item.type === "mcp" ? (
                                            <div className="mt-2 break-all font-mono text-[11px] leading-5 text-muted-foreground">
                                              {[item.command, ...item.args].filter(Boolean).join(" ")}
                                            </div>
                                          ) : item.preview ? (
                                            <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                              {previewText(item.preview)}
                                            </div>
                                          ) : null}

                                          <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                                            {itemStorageDescription(scan.id, item)}
                                          </div>
                                          {alsoAvailable ? (
                                            <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                              Also available in {alsoAvailable}
                                            </div>
                                          ) : null}
                                          {item.path ? (
                                            <div className="mt-1 break-all text-[11px] leading-5 text-muted-foreground">
                                              {item.path}
                                            </div>
                                          ) : null}
                                        </div>

                                        <div className="shrink-0">
                                          {item.managed ? (
                                            <StatusBadge tone="success">Managed</StatusBadge>
                                          ) : isSuggested ? (
                                            <StatusBadge tone="info">Suggested</StatusBadge>
                                          ) : (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={isSuggesting}
                                              onClick={() => handleSuggest(scan.id, item)}
                                            >
                                              {isSuggesting ? "Sending..." : "Suggest"}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                                No tool-local artifacts detected for this tool. Shared skills live in the Shared registry section.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  No tools detected yet. Run another scan after installing a supported client.
                </div>
              )}
            </CardContent>
          </Card>

          {showSettings ? (
            <Card>
              <CardHeader>
                <CardTitle>Sync schedule</CardTitle>
                <CardDescription>
                  Choose how often the desktop client checks for updated assignments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {[300, 1800, 7200, 86400].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onSaveSyncInterval(value)}
                      className={cn(
                        buttonVariants({
                          variant: syncInterval === value ? "default" : "outline",
                          size: "sm",
                        }),
                        "w-full justify-center"
                      )}
                    >
                      {INTERVAL_LABELS[value]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>

      <footer className="border-t bg-background/90 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSettings((value) => !value)}>
              {showSettings ? "Hide schedule" : "Sync schedule"}
            </Button>
            <ButtonLink
              href={DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="sm"
            >
              Open dashboard
            </ButtonLink>
          </div>
          <Button variant="danger" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </footer>
    </div>
  );
}
