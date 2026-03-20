import { useState, useEffect } from "react";

export interface ToolScan {
  id: string;
  name: string;
  installed: boolean;
  mcpServers: { name: string; command: string; args: string[]; managed: boolean }[];
  skills: { name: string; managed: boolean; preview: string }[];
  agents: { name: string; managed: boolean; preview: string }[];
  rules: { name: string; managed: boolean; preview: string }[];
  instructions: {
    path: string;
    hasManagedBlock: boolean;
    userContentLines: number;
    managedContentLines: number;
  } | null;
}

type OnboardingStep = "scanning" | "results" | "preview" | "done";

function toolSummaryText(scan: ToolScan): string {
  const parts: string[] = [];
  if (scan.mcpServers.length > 0) parts.push(`${scan.mcpServers.length} MCP server${scan.mcpServers.length !== 1 ? "s" : ""}`);
  if (scan.skills.length > 0) parts.push(`${scan.skills.length} skill${scan.skills.length !== 1 ? "s" : ""}`);
  if (scan.agents.length > 0) parts.push(`${scan.agents.length} agent${scan.agents.length !== 1 ? "s" : ""}`);
  if (scan.rules.length > 0) parts.push(`${scan.rules.length} rule${scan.rules.length !== 1 ? "s" : ""}`);
  if (scan.instructions) parts.push("instructions");
  return parts.length > 0 ? parts.join(", ") : "No configs detected";
}

function Badge({ managed }: { managed: boolean }) {
  return (
    <span
      className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
      style={{
        background: managed ? "var(--color-success-subtle)" : "var(--color-accent-subtle)",
        color: managed ? "var(--color-success)" : "var(--color-accent)",
        letterSpacing: "0.04em",
      }}
    >
      {managed ? "managed" : "user"}
    </span>
  );
}

function ToolDetail({ scan }: { scan: ToolScan }) {
  const [expanded, setExpanded] = useState(false);

  const totalItems = scan.mcpServers.length + scan.skills.length + scan.agents.length + scan.rules.length + (scan.instructions ? 1 : 0);

  return (
    <div
      className="card p-3"
      style={{ opacity: scan.installed ? 1 : 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium">{scan.name}</span>
          <span
            className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
            style={{
              background: scan.installed ? "var(--color-success-subtle)" : "var(--color-border)",
              color: scan.installed ? "var(--color-success)" : "var(--color-text-tertiary)",
              letterSpacing: "0.04em",
            }}
          >
            {scan.installed ? "installed" : "not installed"}
          </span>
        </div>
        {scan.installed && totalItems > 0 && (
          <button
            className="btn-ghost text-[11px]"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide" : "Details"}
          </button>
        )}
      </div>
      <div className="text-[11px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
        {toolSummaryText(scan)}
      </div>

      {expanded && (
        <div
          className="mt-2.5 pt-2.5 space-y-2"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {scan.mcpServers.length > 0 && (
            <div>
              <div className="section-title mb-1">MCP Servers</div>
              {scan.mcpServers.map((s) => (
                <div key={s.name} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                  <Badge managed={s.managed} />
                </div>
              ))}
            </div>
          )}
          {scan.skills.length > 0 && (
            <div>
              <div className="section-title mb-1">Skills</div>
              {scan.skills.map((s) => (
                <div key={s.name} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                  <Badge managed={s.managed} />
                </div>
              ))}
            </div>
          )}
          {scan.agents.length > 0 && (
            <div>
              <div className="section-title mb-1">Agents</div>
              {scan.agents.map((s) => (
                <div key={s.name} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                  <Badge managed={s.managed} />
                </div>
              ))}
            </div>
          )}
          {scan.rules.length > 0 && (
            <div>
              <div className="section-title mb-1">Rules</div>
              {scan.rules.map((s) => (
                <div key={s.name} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                  <Badge managed={s.managed} />
                </div>
              ))}
            </div>
          )}
          {scan.instructions && (
            <div>
              <div className="section-title mb-1">Instructions</div>
              <div className="text-[11px] py-0.5" style={{ color: "var(--color-text-secondary)" }}>
                {scan.instructions.path}
                {scan.instructions.hasManagedBlock ? " (has managed block)" : ""}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SyncPreview({ scans }: { scans: ToolScan[] }) {
  const installedScans = scans.filter((s) => s.installed);

  // Count what will be added (managed items across all tools)
  let managedMcpCount = 0;
  let managedSkillCount = 0;
  let managedRuleCount = 0;
  let managedAgentCount = 0;
  let instructionCount = 0;

  // Count existing user items
  let userMcpCount = 0;
  let userSkillCount = 0;
  let userRuleCount = 0;
  let userAgentCount = 0;

  for (const scan of installedScans) {
    for (const s of scan.mcpServers) {
      if (s.managed) managedMcpCount++;
      else userMcpCount++;
    }
    for (const s of scan.skills) {
      if (s.managed) managedSkillCount++;
      else userSkillCount++;
    }
    for (const s of scan.agents) {
      if (s.managed) managedAgentCount++;
      else userAgentCount++;
    }
    for (const s of scan.rules) {
      if (s.managed) managedRuleCount++;
      else userRuleCount++;
    }
    if (scan.instructions) instructionCount++;
  }

  const totalUserItems = userMcpCount + userSkillCount + userRuleCount + userAgentCount;
  const changes: string[] = [];

  if (managedMcpCount > 0) changes.push(`Will sync ${managedMcpCount} MCP server${managedMcpCount !== 1 ? "s" : ""}`);
  if (managedSkillCount > 0) changes.push(`Will sync ${managedSkillCount} skill${managedSkillCount !== 1 ? "s" : ""}`);
  if (managedAgentCount > 0) changes.push(`Will sync ${managedAgentCount} agent${managedAgentCount !== 1 ? "s" : ""}`);
  if (managedRuleCount > 0) changes.push(`Will sync ${managedRuleCount} rule${managedRuleCount !== 1 ? "s" : ""}`);
  if (instructionCount > 0) changes.push(`Will update instructions in ${instructionCount} tool${instructionCount !== 1 ? "s" : ""}`);

  return (
    <div className="space-y-3">
      {changes.length > 0 ? (
        <div className="card p-3 space-y-1.5">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-[5px] h-[5px] rounded-full shrink-0"
                style={{ background: "var(--color-success)" }}
              />
              <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{c}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-3">
          <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            No managed configs to sync yet. Your team admin can add configs via the dashboard.
          </div>
        </div>
      )}

      {totalUserItems > 0 && (
        <div
          className="card p-3"
          style={{ borderColor: "var(--color-accent)", borderWidth: "1px" }}
        >
          <div className="flex items-start gap-2">
            <span
              className="text-[12px] font-medium shrink-0 mt-px"
              style={{ color: "var(--color-accent)" }}
            >
              Safe
            </span>
            <div>
              <div className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                Your existing configs ({totalUserItems} item{totalUserItems !== 1 ? "s" : ""}) will NOT be modified.
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                LFC only manages entries tagged with _managed_by: lfc. Your personal configs are never deleted.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Onboarding({
  scans,
  onScanTools,
  onUploadSnapshot,
  onSyncNow,
  onGoToStatus,
}: {
  scans: ToolScan[];
  onScanTools: () => Promise<void>;
  onUploadSnapshot: (tools: ToolScan[]) => Promise<void>;
  onSyncNow: () => Promise<void>;
  onGoToStatus: () => void;
}) {
  const [step, setStep] = useState<OnboardingStep>("scanning");
  const [scanError, setScanError] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();

  useEffect(() => {
    if (step === "scanning") {
      let cancelled = false;
      setScanError(undefined);
      onScanTools()
        .then(async () => {
          if (cancelled) return;
          // Upload snapshot to server so admin can see what this user has
          try {
            // scans is populated by onScanTools via parent setState
            // Give React a tick to update, then upload
            await new Promise((r) => setTimeout(r, 100));
          } catch {}
          setStep("results");
        })
        .catch((err) => {
          if (!cancelled) {
            setScanError(typeof err === "string" ? err : err.message || "Scan failed");
            setStep("results");
          }
        });
      return () => { cancelled = true; };
    }
  }, [step]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(undefined);
    try {
      await onSyncNow();
      setStep("done");
    } catch (err: any) {
      setSyncError(typeof err === "string" ? err : err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const stepTitles: Record<OnboardingStep, string> = {
    scanning: "Scanning your tools...",
    results: "Here's what we found",
    preview: "Preview sync changes",
    done: "You're all set!",
  };

  const stepDescriptions: Record<OnboardingStep, string> = {
    scanning: "Looking for AI coding tools on your machine",
    results: "We detected the following tools and their configurations",
    preview: "Here's what will happen when we sync",
    done: "Your tools are now configured by your team",
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-surface)" }}>
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {(["scanning", "results", "preview", "done"] as OnboardingStep[]).map((s, i) => (
            <div
              key={s}
              className="h-[3px] flex-1 rounded-full"
              style={{
                background:
                  i <= ["scanning", "results", "preview", "done"].indexOf(step)
                    ? "var(--color-accent)"
                    : "var(--color-border)",
                transition: "background 300ms ease",
              }}
            />
          ))}
        </div>

        <div className="text-[15px] font-semibold" style={{ letterSpacing: "-0.01em" }}>
          {stepTitles[step]}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
          {stepDescriptions[step]}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 overflow-auto">
        {step === "scanning" && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-8 h-8 rounded-full"
              style={{
                border: "2px solid var(--color-border)",
                borderTopColor: "var(--color-accent)",
                animation: "onboarding-spin 800ms linear infinite",
              }}
            />
            <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
              Checking Claude Code, Cursor, Claude Desktop...
            </div>
          </div>
        )}

        {step === "results" && (
          <div className="space-y-2.5">
            {scanError && (
              <div
                className="p-2.5 rounded-lg text-[12px]"
                style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
              >
                {scanError}
              </div>
            )}
            {scans.length > 0 ? (
              scans.map((scan) => <ToolDetail key={scan.id} scan={scan} />)
            ) : (
              <div className="card p-3.5">
                <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                  {scanError
                    ? "Could not scan for tools. You can continue and scan later."
                    : "No tools detected. Install a supported AI tool and try again, or continue to set up sync."}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-2.5">
            <SyncPreview scans={scans} />
            {syncError && (
              <div
                className="p-2.5 rounded-lg text-[12px]"
                style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
              >
                {syncError}
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold"
              style={{ background: "var(--color-success-subtle)", color: "var(--color-success)" }}
            >
              OK
            </div>
            <div>
              <div className="text-[13px] font-medium">Sync complete</div>
              <div className="text-[12px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                Your tools are now configured by your team. LFC will keep them in sync automatically.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        {step === "scanning" && (
          <button
            className="btn-ghost w-full text-center"
            onClick={() => setStep("results")}
          >
            Skip scan
          </button>
        )}

        {step === "results" && (
          <button
            className="btn-primary w-full"
            onClick={() => setStep("preview")}
          >
            Continue
          </button>
        )}

        {step === "preview" && (
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={onGoToStatus}
            >
              Skip for now
            </button>
            <button
              className="btn-primary flex-1"
              disabled={syncing}
              onClick={handleSync}
            >
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>
        )}

        {step === "done" && (
          <button
            className="btn-primary w-full"
            onClick={onGoToStatus}
          >
            Go to status
          </button>
        )}
      </div>

      <style>{`
        @keyframes onboarding-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
