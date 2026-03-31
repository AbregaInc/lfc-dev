import { useEffect, useState } from "react";

import BrandMark from "../components/BrandMark";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  sharedRegistryMetrics,
  sharedRegistryPreview,
  sharedSkillPreview,
  toolInventoryMetrics,
  toolSummary,
  type ToolScan,
} from "../lib/toolScan";

type Step = "scanning" | "done";
type Phase = "scan" | "sync";

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
  const [phase, setPhase] = useState<Phase>("scan");
  const [error, setError] = useState<string>();

  useEffect(() => {
    // App recreates the async callbacks on each render; restarting this effect mid-setup
    // cancels the in-flight onboarding sequence before it can reach the sync step.
    if (step !== "scanning") return;
    let cancelled = false;

    (async () => {
      try {
        setPhase("scan");
        await withTimeout(
          onScanTools(),
          15000,
          "Tool detection took too long. Open the desktop client and retry once the local server is responding."
        );
        if (cancelled) return;
        setPhase("sync");
        await withTimeout(
          onSyncNow(),
          30000,
          "Initial sync took too long. Check that the local server is running, then retry from the desktop client."
        );
        if (cancelled) return;
        setStep("done");
      } catch (err: any) {
        if (!cancelled) {
          setError(typeof err === "string" ? err : err.message || "Setup failed");
          setStep("done");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step]);

  const installed = scans.filter((scan) => scan.installed);
  const sharedMetrics = sharedRegistryMetrics(installed);
  const sharedPreviewText = sharedRegistryPreview(installed);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b bg-background/90 px-4 py-4">
        <div className="flex items-start gap-3">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-foreground">Desktop client</div>
              <StatusBadge tone="neutral">First sync</StatusBadge>
              <StatusBadge tone={step === "scanning" ? "info" : error ? "warning" : "success"}>
                {step === "scanning" ? "Scanning" : error ? "Needs review" : "Ready"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Scan compatible tools, apply managed artifacts, and register this machine with Fleet.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4 py-4">
        {step === "scanning" ? (
          <Card>
            <CardContent className="space-y-5 py-6">
              <div className="flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
              </div>
              <div className="space-y-2 text-center">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Setting up this machine
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Looking for Claude Code, Cursor, Claude Desktop, Codex, and any managed content
                  already on disk.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border bg-muted/25 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    Detect local tools and register inventory
                  </span>
                  <StatusBadge tone={phase === "scan" ? "info" : "success"}>
                    {phase === "scan" ? "Running" : "Done"}
                  </StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">Apply approved artifacts</span>
                  <StatusBadge tone={phase === "sync" ? "info" : "neutral"}>
                    {phase === "sync" ? "Running" : "Queued"}
                  </StatusBadge>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>{installed.length > 0 ? "Detected tools" : "No tools detected"}</CardTitle>
                <CardDescription>
                  {installed.length > 0
                    ? "These tools are now eligible for managed assignments. Shared skills are shown once in their own registry section, then linked into compatible tools."
                    : "Install a supported tool and run another scan from the status page."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {installed.length > 0 ? (
                  <>
                    {sharedMetrics.totalItems > 0 ? (
                      <div className="rounded-xl border bg-background px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground">Shared registry</div>
                            <div className="mt-1 text-xs leading-5 text-muted-foreground">
                              {sharedMetrics.totalItems} shared skill
                              {sharedMetrics.totalItems === 1 ? "" : "s"} installed once in ~/.agents/skills.
                            </div>
                          </div>
                          <StatusBadge tone="info">Shared</StatusBadge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <StatusBadge tone="info">
                            {sharedMetrics.totalItems} shared skill
                            {sharedMetrics.totalItems === 1 ? "" : "s"}
                          </StatusBadge>
                          <StatusBadge tone={sharedMetrics.unmanagedItems > 0 ? "warning" : "success"}>
                            {sharedMetrics.unmanagedItems > 0
                              ? `${sharedMetrics.unmanagedItems} unmanaged`
                              : "Managed ready"}
                          </StatusBadge>
                        </div>

                        {sharedPreviewText ? (
                          <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                            {sharedPreviewText}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {installed.map((scan) => {
                      const metrics = toolInventoryMetrics(scan);
                      const preview = sharedSkillPreview(scan);

                      return (
                        <div key={scan.id} className="rounded-xl border bg-background px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">{scan.name}</div>
                              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                {toolSummary(scan)}
                              </div>
                            </div>
                            <StatusBadge tone="success">Detected</StatusBadge>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {metrics.toolSkills > 0 ? (
                              <StatusBadge tone="neutral">
                                {metrics.toolSkills} tool-local skill
                                {metrics.toolSkills === 1 ? "" : "s"}
                              </StatusBadge>
                            ) : null}
                            {metrics.sharedSkills > 0 ? (
                              <StatusBadge tone="info">
                                {metrics.sharedSkills} linked shared
                              </StatusBadge>
                            ) : null}
                            {scan.instructions ? (
                              <StatusBadge tone={scan.id === "codex" ? "warning" : "neutral"}>
                                {scan.id === "codex" ? "Project instructions" : "User instructions"}
                              </StatusBadge>
                            ) : null}
                          </div>

                          {preview ? (
                            <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                              Reads shared registry: {preview}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                    No compatible tools were found during setup.
                  </div>
                )}
              </CardContent>
            </Card>

            {!error ? (
              <Card className="bg-secondary/45">
                <CardContent className="py-4">
                  <div className="text-sm font-medium text-foreground">
                    Your personal config stays put
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    LFC only updates entries it manages. Personal MCPs, local instructions, and
                    custom notes are preserved.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </main>

      <footer className="border-t bg-background/90 px-4 py-3">
        {step === "scanning" ? (
          <Button variant="ghost" className="w-full" onClick={() => setStep("done")}>
            Skip for now
          </Button>
        ) : (
          <Button className="w-full" onClick={onGoToStatus}>
            Open desktop client
          </Button>
        )}
      </footer>
    </div>
  );
}
