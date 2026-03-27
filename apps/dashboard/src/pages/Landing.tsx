import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import StatusBadge from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const GITHUB_DOWNLOAD = "https://github.com/AbregaInc/lfc-dev/releases/latest/download";

const setupSteps = [
  {
    step: "1",
    title: "Create the workspace",
    detail:
      "Set up the org, define approved MCPs, instructions, rules, and shared secrets in one place.",
    meta: "Takes about 2 minutes",
  },
  {
    step: "2",
    title: "Install the client",
    detail:
      "Each teammate installs the tray app once. LFC detects their tools and binds into the local files those tools already read.",
    meta: "macOS and Windows",
  },
  {
    step: "3",
    title: "Let it keep itself current",
    detail:
      "Approved changes sync in the background. Personal local entries stay intact, and Fleet shows what actually applied.",
    meta: "Automatic sync and verification",
  },
];

const adminDefines = [
  { label: "MCP", tone: "success" as const, value: "github, postgres, sentry, jira" },
  { label: "Instructions", tone: "info" as const, value: "Acme coding standards" },
  { label: "Rules", tone: "neutral" as const, value: "TypeScript strict, named exports" },
  { label: "Secrets", tone: "warning" as const, value: "GITHUB_TOKEN, SENTRY_DSN" },
];

const fileMap = [
  {
    tool: "Claude Code",
    files: [
      "~/.claude.json",
      "~/.claude/CLAUDE.md",
      "~/.claude/rules/",
      "~/.claude/skills/",
      "~/.claude/agents/",
    ],
  },
  {
    tool: "Cursor",
    files: ["~/.cursor/mcp.json", ".cursorrules", ".cursor/rules/"],
  },
  {
    tool: "Claude Desktop",
    files: ["~/Library/.../claude_desktop_config.json"],
  },
  {
    tool: "Codex",
    files: ["~/AGENTS.md", "~/.codex/mcp.json"],
  },
  {
    tool: "Windsurf",
    files: ["~/.codeium/windsurf/mcp_config.json"],
  },
];

const managedEntries = [
  {
    name: "github",
    command: "npx @modelcontextprotocol/server-github",
    tone: "success" as const,
    label: "lfc-managed",
  },
  {
    name: "postgres",
    command: "npx @modelcontextprotocol/server-postgres",
    tone: "success" as const,
    label: "lfc-managed",
  },
  {
    name: "sentry",
    command: "npx @sentry/mcp-server",
    tone: "success" as const,
    label: "lfc-managed",
  },
  {
    name: "jira",
    command: "npx @atlassian/mcp-jira",
    tone: "success" as const,
    label: "lfc-managed",
  },
  {
    name: "gmail",
    command: "npx @gongrzhe/server-gmail-autoauth-mcp",
    tone: "warning" as const,
    label: "yours",
  },
];

const inventory = [
  { type: "MCP", name: "github", users: 12, tone: "success" as const },
  { type: "MCP", name: "postgres", users: 8, tone: "success" as const },
  { type: "Skill", name: "frontend-design", users: 6, tone: "warning" as const },
  { type: "Skill", name: "code-review", users: 5, tone: "warning" as const },
  { type: "Rule", name: "coding-standards", users: 12, tone: "neutral" as const },
];

const reviewFlow = [
  { step: "1", title: "Discover", detail: "A developer finds a useful MCP or skill locally." },
  { step: "2", title: "Suggest", detail: "They submit it back to the org through the client." },
  { step: "3", title: "Review", detail: "An admin approves it and assigns it to profiles." },
  { step: "4", title: "Deploy", detail: "The release rolls out automatically to matching machines." },
];

const auditEvents = [
  { action: "Config updated", user: "Sarah K.", detail: "MCP servers in Backend profile", time: "2m", tone: "info" as const },
  { action: "Approved", user: "Admin", detail: "Add Sentry MCP from Boris T.", time: "15m", tone: "success" as const },
  { action: "Sync", user: "Alex M.", detail: "4 configs, 3 tools", time: "22m", tone: "info" as const },
  { action: "Joined", user: "Jamie L.", detail: "via invite link", time: "1h", tone: "neutral" as const },
  { action: "Secret rotated", user: "Admin", detail: "GITHUB_TOKEN", time: "3h", tone: "warning" as const },
];

const detectedTools = [
  { name: "Claude Code", detail: "5 MCPs, 12 skills, 3 rules, 2 agents" },
  { name: "Cursor", detail: "5 MCPs, 2 rules" },
  { name: "Claude Desktop", detail: "5 MCPs" },
  { name: "Codex", detail: "3 MCPs, instructions" },
  { name: "Windsurf", detail: "2 MCPs" },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    detail: "Up to 5 users. All core features included.",
    cta: "Start free",
    featured: false,
  },
  {
    name: "Team",
    price: "$25",
    period: "per user / year",
    subline: "That's just $2.08/mo per user",
    detail: "Up to 50 users. Priority support.",
    cta: "Start team plan",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    detail: "SSO, SCIM, audit export, and self-hosted options.",
    cta: "Talk to us",
    featured: false,
  },
];

function LinkButton({
  to,
  children,
  variant = "default",
  size = "default",
}: {
  to: string;
  children: ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary" | "link";
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Link to={to} className={buttonVariants({ variant, size })}>
      {children}
    </Link>
  );
}

function DownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className={buttonVariants({ variant: "outline" })}>
      {label}
    </a>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <div className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function ProofPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden py-0 shadow-sm">
      <CardHeader className="border-b bg-muted/25 py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="py-4">{children}</CardContent>
    </Card>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 min-w-14 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold tracking-[0.16em] text-primary-foreground shadow-sm">
              LFC
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                Artifact rollout for AI tooling
              </div>
              <div className="text-xs text-muted-foreground">Local AI config rollout for teams</div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <a href="#how-it-works" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              How it works
            </a>
            <a href="#safety" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Safety
            </a>
            <a href="#pricing" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Pricing
            </a>
            <a href="#download" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Download
            </a>
            <LinkButton to="/login" variant="ghost" size="sm">
              Sign in
            </LinkButton>
            <LinkButton to="/register" size="sm">
              Start free
            </LinkButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-18">
        <section className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <div className="max-w-3xl">
            <StatusBadge tone="info">AI tool config management</StatusBadge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.02]">
              Stop sharing config files in Slack.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              LFC manages MCP servers, instructions, skills, and rules across your team&apos;s AI
              tools. One dashboard. Every tool. Secrets stay secret.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/register">Start free</LinkButton>
              <a href="#how-it-works" className={buttonVariants({ variant: "outline" })}>
                See how it works
              </a>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">One dashboard</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Approve releases, assign profiles, and keep secrets out of ad hoc setup docs.
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Every tool</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Claude Code, Cursor, Codex, Claude Desktop, and Windsurf all get the files they expect.
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Secrets stay secret</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Managed launches resolve credentials at install time without pasting tokens onto laptops by hand.
                </p>
              </div>
            </div>
          </div>

          <ProofPanel
            title="From discovery to rollout"
            description="The control loop stays explicit: submit, review, assign, apply, verify."
          >
            <div className="space-y-3">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">github-mcp</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      npm package · pinned release · Claude Code, Cursor, Codex
                    </div>
                  </div>
                  <StatusBadge tone="success">Managed</StatusBadge>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">jira-relay</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Local plugin import · compatible with Cursor only
                    </div>
                  </div>
                  <StatusBadge tone="warning">Best effort</StatusBadge>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">legacy-notes</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Path-based import from one developer machine
                    </div>
                  </div>
                  <StatusBadge tone="danger">Unreliable</StatusBadge>
                </div>
              </div>
            </div>

            <Separator className="my-5" />

            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">
                Fleet reads like operations, not guesswork
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Profile
                  </div>
                  <div className="mt-2 text-base font-medium text-foreground">Backend team</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    6 approved artifacts · Claude Code and Codex only
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Machine
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-base font-medium text-foreground">MacBookPro</div>
                    <StatusBadge tone="success">Healthy</StatusBadge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    4 registrations collapsed · last verification passed
                  </div>
                </div>
              </div>
            </div>
          </ProofPanel>
        </section>

        <section className="mt-16 border-y py-12">
          <div className="grid gap-8 md:grid-cols-3">
            {setupSteps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {item.step}
                </div>
                <div className="mt-4 text-base font-medium text-foreground">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                <div className="mt-3 text-xs font-medium text-muted-foreground">{item.meta}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mt-20 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionIntro
            eyebrow="How it works"
            title="Write once, deploy everywhere."
            description="Define your MCP servers, coding instructions, and rules once in the dashboard. LFC writes them to the correct file, in the correct format, for every supported tool on every team member’s machine."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <ProofPanel title="Admin defines">
              <div className="space-y-4">
                {adminDefines.map((item) => (
                  <div key={item.label}>
                    <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
                    <div className="mt-2 text-sm text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </ProofPanel>

            <ProofPanel title="LFC writes to">
              <div className="space-y-4">
                {fileMap.map((item) => (
                  <div key={item.tool}>
                    <div className="text-sm font-medium text-foreground">{item.tool}</div>
                    <div className="mt-2 space-y-1">
                      {item.files.map((file) => (
                        <div key={file} className="font-mono text-xs text-muted-foreground">
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ProofPanel>
          </div>
        </section>

        <section id="safety" className="mt-20 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionIntro
            eyebrow="Safety"
            title="Your configs are never deleted."
            description="LFC only touches entries it manages. User-owned MCP servers, personal skills, and local rules are preserved on every sync, and every write is backed up first."
          />

          <ProofPanel title="~/.claude.json → mcpServers">
            <div className="divide-y">
              {managedEntries.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{entry.name}</div>
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {entry.command}
                    </div>
                  </div>
                  <StatusBadge tone={entry.tone}>{entry.label}</StatusBadge>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
              Only entries with <code className="font-mono text-foreground">_managed_by: "lfc"</code> are ever modified.
            </div>
          </ProofPanel>
        </section>

        <section className="mt-20 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <ProofPanel
            title="See what your team has"
            description="When users connect, LFC scans their tools and uploads an inventory. Admins can see what is actually in use before promoting it into a managed release."
          >
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <div>Type</div>
                <div>Name</div>
                <div className="text-right">Members</div>
              </div>
              {inventory.map((item) => (
                <div
                  key={`${item.type}-${item.name}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-background px-3 py-3"
                >
                  <StatusBadge tone={item.tone}>{item.type}</StatusBadge>
                  <div className="text-sm text-foreground">{item.name}</div>
                  <div className="text-right text-sm text-muted-foreground">{item.users}</div>
                </div>
              ))}
            </div>
          </ProofPanel>

          <ProofPanel
            title="Config flows both ways"
            description="Users discover useful MCPs and skills on their own. They suggest them back to the org, and approved releases roll out automatically."
          >
            <div className="space-y-3">
              {reviewFlow.map((item, index) => (
                <div key={item.step} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {item.step}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                  </div>
                  {index < reviewFlow.length - 1 ? (
                    <div className="ml-auto pt-1 text-xs text-muted-foreground">→</div>
                  ) : null}
                </div>
              ))}
            </div>
          </ProofPanel>
        </section>

        <section className="mt-20 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <ProofPanel
            title="Full audit trail"
            description="Every config change, sync event, secret rotation, and suggestion is logged with who, what, and when."
          >
            <div className="space-y-2">
              {auditEvents.map((event) => (
                <div
                  key={`${event.action}-${event.user}-${event.time}`}
                  className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-lg border bg-background px-3 py-3"
                >
                  <div className="justify-self-start">
                    <StatusBadge tone={event.tone}>{event.action}</StatusBadge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground">{event.user}</div>
                    <div className="truncate text-sm text-muted-foreground">{event.detail}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{event.time}</div>
                </div>
              ))}
            </div>
          </ProofPanel>

          <ProofPanel
            title="Auto-detects everything"
            description="The tray app scans the machine, finds supported AI tools, and previews what is configured before writing a single byte."
          >
            <div className="space-y-2">
              {detectedTools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between gap-4 rounded-lg border bg-background px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-foreground">{tool.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{tool.detail}</span>
                </div>
              ))}
            </div>
          </ProofPanel>
        </section>

        <section id="pricing" className="mt-20">
          <SectionIntro
            eyebrow="Pricing"
            title="Free for small teams. Pay when you grow."
            description="All prices are annual, not monthly. Start with the full product on a small team, then move up when you need more seats or enterprise controls."
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.featured ? "border-primary/70 bg-card py-0 shadow-sm" : "py-0 shadow-sm"}
              >
                <CardContent className="space-y-4 py-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">{plan.name}</div>
                    {plan.featured ? <StatusBadge tone="warning">Most teams</StatusBadge> : null}
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-4xl font-semibold tracking-tight text-foreground">
                        {plan.price}
                      </div>
                      {plan.period ? (
                        <div className="text-sm text-muted-foreground">{plan.period}</div>
                      ) : null}
                    </div>
                    {plan.subline ? (
                      <div className="mt-2 text-sm text-muted-foreground">{plan.subline}</div>
                    ) : null}
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">{plan.detail}</p>

                  <Link
                    to="/register"
                    className={buttonVariants({
                      variant: plan.featured ? "default" : "outline",
                    })}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="download" className="mt-20">
          <Card className="py-0 shadow-sm">
            <CardContent className="flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  Download
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  Install the client, register the machine, and let Fleet tell the truth.
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  The client scans compatible tools, syncs assignments, writes managed bindings,
                  verifies the result, and reports health back to the dashboard.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <DownloadButton
                  href={`${GITHUB_DOWNLOAD}/LFC_aarch64.dmg`}
                  label="macOS (Apple Silicon)"
                />
                <DownloadButton
                  href={`${GITHUB_DOWNLOAD}/LFC_x64.dmg`}
                  label="macOS (Intel)"
                />
                <DownloadButton href={`${GITHUB_DOWNLOAD}/LFC_x64.msi`} label="Windows" />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <div>LFC — Looking For Config</div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <Link to="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-foreground">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
