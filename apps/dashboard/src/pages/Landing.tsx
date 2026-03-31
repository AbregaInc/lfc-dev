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

const GITHUB_DOWNLOAD = "https://github.com/AbregaInc/lfc-dev/releases/latest/download";

function ToolLogo({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground" title={name}>
      {children}
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
}

const iconClass = "h-5 w-5 fill-current";

const supportedTools = [
  {
    name: "Claude Code",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass}>
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
      </svg>
    ),
  },
  {
    name: "Cursor",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass}>
        <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
      </svg>
    ),
  },
  {
    name: "Claude Desktop",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass}>
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
      </svg>
    ),
  },
  {
    name: "Codex",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass}>
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    ),
  },
  {
    name: "Windsurf",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass}>
        <path d="M23.55 5.067c-1.2038-.002-2.1806.973-2.1806 2.1765v4.8676c0 .972-.8035 1.7594-1.7597 1.7594-.568 0-1.1352-.286-1.4718-.7659l-4.9713-7.1003c-.4125-.5896-1.0837-.941-1.8103-.941-1.1334 0-2.1533.9635-2.1533 2.153v4.8957c0 .972-.7969 1.7594-1.7596 1.7594-.57 0-1.1363-.286-1.4728-.7658L.4076 5.1598C.2822 4.9798 0 5.0688 0 5.2882v4.2452c0 .2147.0656.4228.1884.599l5.4748 7.8183c.3234.462.8006.8052 1.3509.9298 1.3771.313 2.6446-.747 2.6446-2.0977v-4.893c0-.972.7875-1.7593 1.7596-1.7593h.003a1.798 1.798 0 0 1 1.4718.7658l4.9723 7.0994c.4135.5905 1.05.941 1.8093.941 1.1587 0 2.1515-.9645 2.1515-2.153v-4.8948c0-.972.7875-1.7594 1.7596-1.7594h.194a.22.22 0 0 0 .2204-.2202v-4.622a.22.22 0 0 0-.2203-.2203Z" />
      </svg>
    ),
  },
  {
    name: "OpenCode",
    icon: null,
  },
];

const beforeAfter = {
  before: [
    "New hire copies MCP configs from a stale Notion doc",
    "GITHUB_TOKEN pasted in Slack — stays in search forever",
    "Half the team has Sentry, half doesn't know it exists",
    "No one knows which skills or instructions are standard",
    "Config breaks after an update — no one notices for a week",
  ],
  after: [
    "New hire installs client, picks a profile, done in 2 minutes",
    "Secrets resolve at install time — tokens never leave the dashboard",
    "Approved tools push to every machine automatically",
    "One source of truth, visible to the whole team",
    "Fleet catches drift immediately",
  ],
};

const setupSteps = [
  {
    step: "1",
    title: "Define",
    detail: "Pick MCPs, skills, instructions, rules. Group into profiles.",
  },
  {
    step: "2",
    title: "Install",
    detail: "Tray app auto-detects AI tools. Previews before writing.",
  },
  {
    step: "3",
    title: "Sync",
    detail: "Changes push automatically. Personal configs untouched.",
  },
];

const adminDefines = [
  { label: "MCP", tone: "success" as const, value: "github, postgres, sentry, jira" },
  { label: "Shared skills", tone: "warning" as const, value: "frontend-design, teach-impeccable, code-review" },
  { label: "Instructions", tone: "info" as const, value: "Acme coding standards" },
  { label: "Rules", tone: "neutral" as const, value: "TypeScript strict, named exports" },
  { label: "Secrets", tone: "warning" as const, value: "GITHUB_TOKEN, SENTRY_DSN" },
];

const fileMap = [
  { tool: "Shared registry", files: ["~/.agents/skills/"] },
  { tool: "Claude Code", files: ["~/.claude.json", "~/.claude/CLAUDE.md", "~/.claude/skills/", "~/.claude/rules/", "~/.claude/agents/"] },
  { tool: "Cursor", files: ["~/.cursor/mcp.json", ".cursorrules", ".cursor/rules/", "~/.cursor/skills/"] },
  { tool: "Claude Desktop", files: ["~/Library/.../claude_desktop_config.json"] },
  { tool: "Codex", files: ["~/AGENTS.md", "~/.codex/mcp.json", "~/.codex/skills/"] },
  { tool: "Windsurf", files: ["~/.codeium/windsurf/mcp_config.json", "~/.codeium/windsurf/skills/"] },
  { tool: "OpenCode", files: ["~/.opencode/skills/"] },
];

const managedEntries = [
  { name: "github", command: "npx @modelcontextprotocol/server-github", tone: "success" as const, label: "lfc-managed" },
  { name: "postgres", command: "npx @modelcontextprotocol/server-postgres", tone: "success" as const, label: "lfc-managed" },
  { name: "sentry", command: "npx @sentry/mcp-server", tone: "success" as const, label: "lfc-managed" },
  { name: "jira", command: "npx @atlassian/mcp-jira", tone: "success" as const, label: "lfc-managed" },
  { name: "gmail", command: "npx @gongrzhe/server-gmail-autoauth-mcp", tone: "warning" as const, label: "yours" },
];

const inventory = [
  { type: "MCP", name: "github", users: 12, tone: "success" as const },
  { type: "Shared", name: "frontend-design", users: 6, tone: "warning" as const },
  { type: "Shared", name: "teach-impeccable", users: 4, tone: "warning" as const },
  { type: "Project", name: "AGENTS.md defaults", users: 7, tone: "info" as const },
  { type: "Rule", name: "coding-standards", users: 12, tone: "neutral" as const },
];

const reviewFlow = [
  { step: "1", title: "Discover", detail: "Dev finds a useful MCP or skill locally." },
  { step: "2", title: "Suggest", detail: "Submits it back to the org." },
  { step: "3", title: "Review", detail: "Admin approves, assigns to profiles." },
  { step: "4", title: "Deploy", detail: "Rolls out to matching machines." },
];

const auditEvents = [
  { action: "Config updated", user: "Sarah K.", detail: "MCP servers in Backend profile", time: "2m", tone: "info" as const },
  { action: "Approved", user: "Admin", detail: "Add Sentry MCP from Boris T.", time: "15m", tone: "success" as const },
  { action: "Sync", user: "Alex M.", detail: "4 configs, 3 tools", time: "22m", tone: "info" as const },
  { action: "Joined", user: "Jamie L.", detail: "via invite link", time: "1h", tone: "neutral" as const },
  { action: "Secret rotated", user: "Admin", detail: "GITHUB_TOKEN", time: "3h", tone: "warning" as const },
];

const detectedTools = [
  { name: "Shared registry", detail: "28 skills installed once, linked into all tools" },
  { name: "Claude Code", detail: "4 MCPs, 29 skills, 2 agents" },
  { name: "Cursor", detail: "1 MCP, 28 skills" },
  { name: "Claude Desktop", detail: "3 MCPs" },
  { name: "Codex", detail: "instructions, 28 skills" },
  { name: "Windsurf", detail: "28 skills" },
  { name: "OpenCode", detail: "28 skills" },
];

const plans = [
  { name: "Free", price: "$0", period: "forever", detail: "Up to 5 users. All features.", cta: "Start free", featured: false },
  { name: "Team", price: "$25", period: "per user / year", subline: "$2.08/mo per user", detail: "Up to 50 users. Priority support.", cta: "Start team plan", featured: true },
  { name: "Enterprise", price: "Custom", period: "", detail: "SSO, SCIM, audit export, self-hosted.", cta: "Talk to us", featured: false },
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
      {/* ── Header ── */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 min-w-14 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold tracking-[0.16em] text-primary-foreground shadow-sm">
              LFC
            </div>
            <div className="text-sm font-medium text-foreground">
              AI tool config for teams
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <a href="#how-it-works" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              How it works
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
        {/* ── Hero ── */}
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.02]">
            Same AI tools. Same config. Every machine.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Define your team&apos;s MCP servers, skills, instructions, and rules once. LFC keeps everyone&apos;s tools in sync.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton to="/register">Start free</LinkButton>
            <a href="#how-it-works" className={buttonVariants({ variant: "outline" })}>
              How it works
            </a>
          </div>
        </section>

        {/* ── Tool strip ── */}
        <section className="mt-14 border-y py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <span className="text-xs text-muted-foreground">Works with</span>
            {supportedTools.map((tool) => (
              <ToolLogo key={tool.name} name={tool.name}>
                {tool.icon}
              </ToolLogo>
            ))}
          </div>
        </section>

        {/* ── Before / After ── */}
        <section className="mt-14 grid gap-4 lg:grid-cols-2">
          <Card className="py-0 shadow-sm">
            <CardHeader className="border-b bg-muted/25 py-3">
              <CardTitle className="text-sm text-muted-foreground">Without LFC</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <ul className="space-y-2.5">
                {beforeAfter.before.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="shrink-0 text-red-400">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-primary/40 py-0 shadow-sm">
            <CardHeader className="border-b bg-muted/25 py-3">
              <CardTitle className="text-sm">With LFC</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <ul className="space-y-2.5">
                {beforeAfter.after.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-foreground">
                    <span className="shrink-0 text-emerald-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">How it works</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {setupSteps.map((item) => (
              <div key={item.step}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {item.step}
                </div>
                <div className="mt-3 text-sm font-medium text-foreground">{item.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── What it manages ── */}
        <section className="mt-20 grid gap-4 md:grid-cols-2">
          <ProofPanel title="You define">
            <div className="space-y-3">
              {adminDefines.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
                  <span className="text-sm text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </ProofPanel>

          <ProofPanel title="LFC Manages">
            <div className="space-y-3">
              {fileMap.map((item) => (
                <div key={item.tool}>
                  <div className="text-sm font-medium text-foreground">{item.tool}</div>
                  <div className="mt-1 space-y-0.5">
                    {item.files.map((file) => (
                      <div key={file} className="font-mono text-xs text-muted-foreground">{file}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ProofPanel>
        </section>

        {/* ── Safety ── */}
        <section className="mt-20 grid gap-4 lg:grid-cols-[0.6fr_1fr] lg:items-start">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your configs are safe.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Only <code className="font-mono text-foreground">_managed_by: &quot;lfc&quot;</code> entries are touched. Everything else is preserved.
            </p>
          </div>

          <ProofPanel title="~/.claude.json mcpServers">
            <div className="divide-y">
              {managedEntries.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{entry.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{entry.command}</div>
                  </div>
                  <StatusBadge tone={entry.tone}>{entry.label}</StatusBadge>
                </div>
              ))}
            </div>
          </ProofPanel>
        </section>

        {/* ── Visibility + Review ── */}
        <section className="mt-20 grid gap-4 lg:grid-cols-2">
          <ProofPanel title="Team inventory">
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <div>Type</div>
                <div>Name</div>
                <div className="text-right">Users</div>
              </div>
              {inventory.map((item) => (
                <div
                  key={`${item.type}-${item.name}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                >
                  <StatusBadge tone={item.tone}>{item.type}</StatusBadge>
                  <div className="text-sm text-foreground">{item.name}</div>
                  <div className="text-right text-sm text-muted-foreground">{item.users}</div>
                </div>
              ))}
            </div>
          </ProofPanel>

          <ProofPanel title="Bottom-up suggestions">
            <div className="space-y-2.5">
              {reviewFlow.map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {item.step}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </ProofPanel>
        </section>

        {/* ── Audit + Detection ── */}
        <section className="mt-20 grid gap-4 lg:grid-cols-2">
          <ProofPanel title="Audit trail">
            <div className="space-y-2">
              {auditEvents.map((event) => (
                <div
                  key={`${event.action}-${event.user}-${event.time}`}
                  className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                >
                  <div className="justify-self-start">
                    <StatusBadge tone={event.tone}>{event.action}</StatusBadge>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-foreground">{event.user}</div>
                    <div className="truncate text-sm text-muted-foreground">{event.detail}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{event.time}</div>
                </div>
              ))}
            </div>
          </ProofPanel>

          <ProofPanel title="Auto-detection">
            <div className="space-y-2">
              {detectedTools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between gap-4 rounded-lg border bg-background px-3 py-2.5"
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

        {/* ── Pricing ── */}
        <section id="pricing" className="mt-20">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Pricing</h2>
          <p className="mt-2 text-sm text-muted-foreground">Free up to 5 users. Annual billing.</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.featured ? "flex border-primary/70 bg-card py-0 shadow-sm" : "flex py-0 shadow-sm"}
              >
                <CardContent className="flex flex-1 flex-col py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">{plan.name}</div>
                    {plan.featured ? <StatusBadge tone="warning">Most teams</StatusBadge> : null}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-semibold tracking-tight text-foreground">{plan.price}</div>
                      {plan.period ? <div className="text-sm text-muted-foreground">{plan.period}</div> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{plan.subline ?? "\u00A0"}</div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{plan.detail}</p>
                  <div className="mt-auto pt-4">
                    <Link
                      to="/register"
                      className={buttonVariants({ variant: plan.featured ? "default" : "outline", className: "w-full" })}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Download ── */}
        <section id="download" className="mt-20">
          <Card className="py-0 shadow-sm">
            <CardContent className="flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Ready in under 5 minutes.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a workspace, install the client, done.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <DownloadButton href={`${GITHUB_DOWNLOAD}/LFC_aarch64.dmg`} label="macOS (Apple Silicon)" />
                <DownloadButton href={`${GITHUB_DOWNLOAD}/LFC_x64.dmg`} label="macOS (Intel)" />
                <DownloadButton href={`${GITHUB_DOWNLOAD}/LFC_x64.msi`} label="Windows" />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <div>LFC</div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
            <Link to="/register" className="hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
