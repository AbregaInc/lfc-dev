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

type Step = "scanning" | "done";

function toolSummary(scan: ToolScan): string {
  const parts: string[] = [];
  if (scan.mcpServers.length > 0) parts.push(`${scan.mcpServers.length} MCP server${scan.mcpServers.length !== 1 ? "s" : ""}`);
  if (scan.skills.length > 0) parts.push(`${scan.skills.length} skill${scan.skills.length !== 1 ? "s" : ""}`);
  if (scan.rules.length > 0) parts.push(`${scan.rules.length} rule${scan.rules.length !== 1 ? "s" : ""}`);
  if (scan.instructions) parts.push("instructions");
  return parts.length > 0 ? parts.join(", ") : "No artifacts detected";
}

export default function Onboarding({
  scans,
  onScanTools,
  onSyncNow,
  onGoToStatus,
}: {
  scans: ToolScan[];
  onScanTools: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onGoToStatus: () => void;
}) {
  const [step, setStep] = useState<Step>("scanning");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (step !== "scanning") return;
    let cancelled = false;

    (async () => {
      try {
        await onScanTools();
        if (cancelled) return;
        await onSyncNow();
        if (cancelled) return;
        setStep("done");
      } catch (err: any) {
        if (!cancelled) {
          setError(typeof err === "string" ? err : err.message || "Setup failed");
          setStep("done");
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const installed = scans.filter((s) => s.installed);

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-surface)" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-1.5 mb-3">
          <div
            className="h-[3px] flex-1 rounded-full"
            style={{
              background: "var(--color-accent)",
              transition: "background 300ms ease",
            }}
          />
          <div
            className="h-[3px] flex-1 rounded-full"
            style={{
              background: step === "done" ? "var(--color-accent)" : "var(--color-border)",
              transition: "background 300ms ease",
            }}
          />
        </div>
        <div className="text-[15px] font-semibold" style={{ letterSpacing: "-0.01em" }}>
          {step === "scanning" ? "Setting up..." : "You're all set"}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
          {step === "scanning"
            ? "Scanning tools and syncing your team's artifacts"
            : "Your tools are now managed by your team"}
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

        {step === "done" && (
          <div className="space-y-3">
            {error && (
              <div
                className="p-2.5 rounded-lg text-[12px]"
                style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
              >
                {error}
              </div>
            )}

            {installed.length > 0 ? (
              <div className="card p-3.5">
                <div className="section-title mb-2">Detected tools</div>
                <div className="space-y-2">
                  {installed.map((scan) => (
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
                      <div className="text-[11px] ml-[13px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                        {toolSummary(scan)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card p-3.5">
                <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                  No tools detected. Install a supported AI tool and rescan from the status page.
                </div>
              </div>
            )}

            {!error && (
              <div
                className="card p-3"
                style={{ borderColor: "var(--color-accent)", borderWidth: "1px" }}
              >
                <div className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                  LFC will keep your managed artifacts in sync automatically. Your personal configs are never modified.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
        {step === "scanning" ? (
          <button className="btn-ghost w-full text-center" onClick={() => setStep("done")}>
            Skip
          </button>
        ) : (
          <button className="btn-primary w-full" onClick={onGoToStatus}>
            Done
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
