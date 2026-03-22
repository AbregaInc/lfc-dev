import { Link } from "react-router-dom";

// ─── Mock data for live "screenshots" ───────────────────────────────

const MOCK_MCP_SERVERS = [
  { name: "github", command: "npx @modelcontextprotocol/server-github", managed: true },
  { name: "postgres", command: "npx @modelcontextprotocol/server-postgres", managed: true },
  { name: "sentry", command: "npx @sentry/mcp-server", managed: true },
  { name: "jira", command: "npx @atlassian/mcp-jira", managed: true },
  { name: "gmail", command: "npx @gongrzhe/server-gmail-autoauth-mcp", managed: false },
];

const MOCK_AUDIT = [
  { action: "Config updated", user: "Sarah K.", detail: "MCP servers in Backend profile", time: "2m", color: "#60a5fa" },
  { action: "Approved", user: "Admin", detail: "Add Sentry MCP from Boris T.", time: "15m", color: "#34d399" },
  { action: "Sync", user: "Alex M.", detail: "4 configs, 3 tools", time: "22m", color: "#60a5fa" },
  { action: "Joined", user: "Jamie L.", detail: "via invite link", time: "1h", color: "#a855f7" },
  { action: "Secret rotated", user: "Admin", detail: "GITHUB_TOKEN", time: "3h", color: "#e5a822" },
];

const MOCK_INVENTORY = [
  { type: "MCP", name: "github", users: 12, color: "#34d399" },
  { type: "MCP", name: "postgres", users: 8, color: "#34d399" },
  { type: "Skill", name: "frontend-design", users: 6, color: "#e5a822" },
  { type: "Skill", name: "code-review", users: 5, color: "#e5a822" },
  { type: "Rule", name: "coding-standards", users: 12, color: "#a855f7" },
];

const FILE_MAP = [
  { tool: "Claude Code", files: ["~/.claude.json", "~/.claude/CLAUDE.md", "~/.claude/rules/", "~/.claude/skills/", "~/.claude/agents/"] },
  { tool: "Cursor", files: ["~/.cursor/mcp.json", ".cursorrules", ".cursor/rules/"] },
  { tool: "Claude Desktop", files: ["~/Library/.../claude_desktop_config.json"] },
  { tool: "Codex", files: ["~/AGENTS.md", "~/.codex/mcp.json"] },
  { tool: "Windsurf", files: ["~/.codeium/windsurf/mcp_config.json"] },
];

// ─── Reusable pieces ────────────────────────────────────────────────

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--color-text-tertiary)", letterSpacing: "0.06em" }}>
        {children}
      </span>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[9px] font-semibold uppercase px-1.5 py-px rounded"
      style={{ background: `${color}12`, color, letterSpacing: "0.03em" }}
    >
      {label}
    </span>
  );
}

function Section({
  title,
  text,
  children,
  id,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mb-28">
      <div className="mb-8" style={{ maxWidth: "480px" }}>
        <h2
          className="text-[20px] font-semibold mb-2"
          style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.3 }}
        >
          {title}
        </h2>
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
          {text}
        </p>
      </div>
      {children}
    </section>
  );
}

// ─── Download links ─────────────────────────────────────────────────

const GITHUB_DOWNLOAD = "https://github.com/AbregaInc/lfc-dev/releases/latest/download";

function DownloadLinks({ size = "default" }: { size?: "small" | "default" }) {
  const isSmall = size === "small";
  return (
    <div className={`flex items-center justify-center gap-${isSmall ? "2" : "3"} flex-wrap`}>
      <a
        href={`${GITHUB_DOWNLOAD}/LFC_aarch64.dmg`}
        className={`text-[${isSmall ? "11px" : "13px"}] font-medium px-${isSmall ? "3" : "4"} py-${isSmall ? "1" : "2"} rounded-md`}
        style={{
          border: "1px solid var(--color-border)",
          color: "var(--color-text-secondary)",
          textDecoration: "none",
        }}
      >
        macOS (Apple Silicon)
      </a>
      <a
        href={`${GITHUB_DOWNLOAD}/LFC_x64.dmg`}
        className={`text-[${isSmall ? "11px" : "13px"}] font-medium px-${isSmall ? "3" : "4"} py-${isSmall ? "1" : "2"} rounded-md`}
        style={{
          border: "1px solid var(--color-border)",
          color: "var(--color-text-secondary)",
          textDecoration: "none",
        }}
      >
        macOS (Intel)
      </a>
      <a
        href={`${GITHUB_DOWNLOAD}/LFC_x64.msi`}
        className={`text-[${isSmall ? "11px" : "13px"}] font-medium px-${isSmall ? "3" : "4"} py-${isSmall ? "1" : "2"} rounded-md`}
        style={{
          border: "1px solid var(--color-border)",
          color: "var(--color-text-secondary)",
          textDecoration: "none",
        }}
        target="_blank"
        rel="noopener noreferrer"
      >
        Windows
      </a>
    </div>
  );
}

// ─── Landing ────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div style={{ background: "var(--color-surface-sunken)" }}>
      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 mx-auto" style={{ maxWidth: "880px" }}>
        <span className="text-[14px] font-bold" style={{ color: "var(--color-accent)" }}>LFC</span>
        <div className="flex items-center gap-4">
          <a href="#download" className="text-[13px]" style={{ color: "var(--color-text-tertiary)", textDecoration: "none" }}>Download</a>
          <a href="#pricing" className="text-[13px]" style={{ color: "var(--color-text-tertiary)", textDecoration: "none" }}>Pricing</a>
          <Link to="/login" className="text-[13px]" style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}>Sign in</Link>
          <Link
            to="/register"
            className="text-[12px] font-medium px-3.5 py-1.5 rounded-md"
            style={{
              background: "var(--color-text-primary)",
              color: "var(--color-text-inverse)",
              textDecoration: "none",
            }}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="pt-16 pb-20 px-6 mx-auto" style={{ maxWidth: "880px" }}>
        <div style={{ maxWidth: "560px" }}>
          <p className="text-[12px] font-semibold uppercase mb-4" style={{ color: "var(--color-accent)", letterSpacing: "0.06em" }}>
            AI tool config management
          </p>
          <h1
            className="text-[40px] font-bold leading-[1.1] mb-5"
            style={{ color: "var(--color-text-primary)", letterSpacing: "-0.03em" }}
          >
            Stop sharing config files in Slack.
          </h1>
          <p className="text-[16px] leading-[1.6] mb-8" style={{ color: "var(--color-text-tertiary)" }}>
            LFC manages MCP servers, instructions, skills, and rules across your team's AI tools.
            One dashboard. Every tool. Secrets stay secret.
          </p>
          <div className="flex gap-3">
            <Link
              to="/register"
              className="text-[13px] font-medium px-5 py-2.5 rounded-md"
              style={{
                background: "var(--color-text-primary)",
                color: "var(--color-text-inverse)",
                textDecoration: "none",
              }}
            >
              Start for free
            </Link>
            <a
              href="#how-it-works"
              className="text-[13px] font-medium px-5 py-2.5 rounded-md"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
            >
              See how it works
            </a>
          </div>
        </div>
      </div>

      {/* ── Setup steps ──────────────────────────────────────── */}
      <div
        className="px-6 py-14 mb-8"
        style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="mx-auto flex items-start justify-center gap-16" style={{ maxWidth: "720px" }}>
          {[
            {
              n: "1",
              title: "Sign up",
              desc: "Create your org, add your team's MCP servers, instructions, and rules.",
              detail: "Takes 2 minutes",
            },
            {
              n: "2",
              title: "Install the app",
              desc: "Team members download the LFC tray app. Mac and Windows supported.",
              detail: null,
              downloads: true,
            },
            {
              n: "3",
              title: "Done",
              desc: "Configs sync automatically. Tools are configured. No manual setup ever again.",
              detail: "Syncs every 5 min",
            },
          ].map((step) => (
            <div key={step.n} className="flex-1 text-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold mx-auto mb-3"
                style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
              >
                {step.n}
              </div>
              <div className="text-[14px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                {step.title}
              </div>
              <p className="text-[13px] leading-relaxed mb-2" style={{ color: "var(--color-text-tertiary)" }}>
                {step.desc}
              </p>
              {"downloads" in step && step.downloads ? (
                <DownloadLinks size="small" />
              ) : (
                <span className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                  {step.detail}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="px-6 mx-auto" style={{ maxWidth: "880px" }}>

        {/* How it works */}
        <Section
          id="how-it-works"
          title="Write once, deploy everywhere"
          text="Define your MCP servers, coding instructions, and rules once in the dashboard. LFC writes them to the correct file, in the correct format, for every tool on every team member's machine."
        >
          <div className="grid grid-cols-2 gap-4">
            {/* Left: what admin defines */}
            <Panel>
              <PanelHeader>Admin defines</PanelHeader>
              <div className="p-4 space-y-3">
                <div>
                  <Tag label="MCP" color="#34d399" />
                  <div className="text-[13px] mt-1" style={{ color: "var(--color-text-primary)" }}>github, postgres, sentry, jira</div>
                </div>
                <div>
                  <Tag label="Instructions" color="#60a5fa" />
                  <div className="text-[13px] mt-1" style={{ color: "var(--color-text-primary)" }}>Acme coding standards</div>
                </div>
                <div>
                  <Tag label="Rules" color="#a855f7" />
                  <div className="text-[13px] mt-1" style={{ color: "var(--color-text-primary)" }}>TypeScript strict, named exports</div>
                </div>
                <div>
                  <Tag label="Secrets" color="#e5a822" />
                  <div className="text-[13px] mt-1" style={{ color: "var(--color-text-primary)" }}>GITHUB_TOKEN, SENTRY_DSN</div>
                </div>
              </div>
            </Panel>

            {/* Right: where it ends up */}
            <Panel>
              <PanelHeader>LFC writes to</PanelHeader>
              <div className="p-4 space-y-2.5">
                {FILE_MAP.map((tool) => (
                  <div key={tool.tool}>
                    <div className="text-[12px] font-medium mb-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      {tool.tool}
                    </div>
                    {tool.files.map((f) => (
                      <div key={f} className="text-[11px] font-mono pl-3" style={{ color: "var(--color-text-tertiary)" }}>{f}</div>
                    ))}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </Section>

        {/* Safety */}
        <Section
          title="Your configs are never deleted"
          text="LFC only touches entries it manages. User-owned MCP servers, personal skills, and local rules are preserved on every sync. Every write is backed up first."
        >
          <Panel>
            <PanelHeader>~/.claude.json → mcpServers</PanelHeader>
            <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {MOCK_MCP_SERVERS.map((s) => (
                <div key={s.name} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>{s.name}</span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--color-text-tertiary)" }}>{s.command}</span>
                  </div>
                  <Tag label={s.managed ? "lfc-managed" : "yours"} color={s.managed ? "#34d399" : "#e5a822"} />
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 text-[11px]" style={{ color: "var(--color-text-tertiary)", borderTop: "1px solid var(--color-border)" }}>
              Only entries with <code className="font-mono" style={{ color: "var(--color-accent)" }}>_managed_by: "lfc"</code> are ever modified.
            </div>
          </Panel>
        </Section>

        {/* Inventory */}
        <Section
          title="See what your team has"
          text="When users connect, LFC scans their tools and uploads an inventory. See which MCPs and skills are popular. Promote useful ones to org profiles with one click."
        >
          <Panel>
            <PanelHeader>Team Inventory — 12 members</PanelHeader>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Type", "Name", "Members"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 2 ? "right" : "left",
                        padding: "8px 16px",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--color-text-tertiary)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_INVENTORY.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <Tag label={item.type} color={item.color} />
                    </td>
                    <td style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)", fontSize: "13px" }}>
                      {item.name}
                    </td>
                    <td style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border-subtle)", textAlign: "right", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                      {item.users}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Section>

        {/* Bottom-up flow */}
        <Section
          title="Config flows both ways"
          text="Users discover useful MCPs and skills on their own. They suggest them back to the org. Admin reviews, approves, and the config rolls out to the whole team automatically."
        >
          <Panel className="p-5">
            <div className="flex items-start gap-6">
              {[
                { n: "1", t: "Discover", d: "User finds a useful MCP or skill" },
                { n: "2", t: "Suggest", d: "Submits it via the tray app" },
                { n: "3", t: "Review", d: "Admin sees it in the dashboard" },
                { n: "4", t: "Deploy", d: "Approved config syncs to all" },
              ].map((step, i) => (
                <div key={step.n} className="flex-1 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full"
                      style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
                    >
                      {step.n}
                    </span>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{step.t}</span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>{step.d}</p>
                  {i < 3 && (
                    <div
                      className="absolute top-2.5 -right-3 text-[10px]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {"\u2192"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </Section>

        {/* Audit */}
        <Section
          title="Full audit trail"
          text="Every config change, sync event, secret rotation, and suggestion is logged with who, what, and when."
        >
          <Panel>
            <PanelHeader>Recent activity</PanelHeader>
            {MOCK_AUDIT.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2"
                style={{ borderBottom: i < MOCK_AUDIT.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}
              >
                <Tag label={e.action} color={e.color} />
                <span className="text-[13px] shrink-0" style={{ color: "var(--color-text-primary)" }}>{e.user}</span>
                <span className="text-[12px] flex-1 truncate" style={{ color: "var(--color-text-tertiary)" }}>{e.detail}</span>
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-tertiary)" }}>{e.time}</span>
              </div>
            ))}
          </Panel>
        </Section>

        {/* Tool detection */}
        <Section
          title="Auto-detects everything"
          text="The tray app scans your machine, finds every AI tool, and shows exactly what's configured. It previews changes before writing a single byte."
        >
          <Panel className="p-4">
            <div className="space-y-1.5">
              {[
                { name: "Claude Code", detail: "5 MCPs, 12 skills, 3 rules, 2 agents" },
                { name: "Cursor", detail: "5 MCPs, 2 rules" },
                { name: "Claude Desktop", detail: "5 MCPs" },
                { name: "Codex", detail: "3 MCPs, instructions" },
                { name: "Windsurf", detail: "2 MCPs" },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between py-2 px-3 rounded"
                  style={{ background: "var(--color-surface)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-[6px] h-[6px] rounded-full" style={{ background: "#34d399" }} />
                    <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{t.name}</span>
                  </div>
                  <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>{t.detail}</span>
                </div>
              ))}
            </div>
          </Panel>
        </Section>

        {/* ── Download ─────────────────────────────────────────── */}
        <Section
          id="download"
          title="Download LFC"
          text="Install the tray app to sync configs automatically. Or use the CLI if you prefer the terminal."
        >
          <div className="space-y-4">
            <Panel className="p-6">
              <div className="text-[14px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                Desktop app
              </div>
              <p className="text-[13px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>
                System tray app for macOS and Windows. Syncs in the background every 5 minutes.
              </p>
              <DownloadLinks />
            </Panel>

          </div>
        </Section>

        {/* ── Pricing ──────────────────────────────────────────── */}
        <section id="pricing" className="mb-20">
          <div className="mb-8">
            <h2
              className="text-[20px] font-semibold mb-2"
              style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}
            >
              Pricing
            </h2>
            <p className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>
              Free for small teams. Pay when you grow. <span style={{ color: "var(--color-accent)" }}>All prices are per year</span> — not monthly.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "Free", price: "$0", period: "forever", desc: "Up to 5 users. All features included.", accent: false },
              { name: "Team", price: "$25", period: "per user / year", monthly: "$2.08/mo per user", desc: "Up to 50 users. Priority support.", accent: true },
              { name: "Enterprise", price: "Custom", period: "", desc: "SSO, SCIM, audit export, self-hosted option.", accent: false },
            ].map((plan) => (
              <Panel key={plan.name} className="p-5">
                <div
                  className="text-[12px] font-semibold mb-3"
                  style={{ color: plan.accent ? "var(--color-accent)" : "var(--color-text-secondary)" }}
                >
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[28px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                      {plan.period}
                    </span>
                  )}
                </div>
                {"monthly" in plan && plan.monthly && (
                  <div
                    className="text-[11px] font-medium mb-2 px-2 py-0.5 rounded inline-block"
                    style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
                  >
                    That's just {plan.monthly}
                  </div>
                )}
                <p className="text-[12px] mb-5" style={{ color: "var(--color-text-tertiary)" }}>{plan.desc}</p>
                <Link
                  to="/register"
                  className="block text-center text-[12px] font-medium px-4 py-2 rounded-md"
                  style={{
                    background: plan.accent ? "var(--color-text-primary)" : "transparent",
                    color: plan.accent ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                    border: plan.accent ? "none" : "1px solid var(--color-border)",
                    textDecoration: "none",
                  }}
                >
                  {plan.name === "Enterprise" ? "Contact us" : "Get started"}
                </Link>
              </Panel>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="px-6 py-6 mx-auto flex items-center justify-between" style={{ maxWidth: "880px", borderTop: "1px solid var(--color-border)" }}>
        <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          LFC — Looking For Config
        </span>
        <div className="flex items-center gap-4">
          <a href="#pricing" className="text-[12px]" style={{ color: "var(--color-text-tertiary)", textDecoration: "none" }}>Pricing</a>
          <Link to="/login" className="text-[12px]" style={{ color: "var(--color-text-tertiary)", textDecoration: "none" }}>Sign in</Link>
          <Link to="/register" className="text-[12px]" style={{ color: "var(--color-text-tertiary)", textDecoration: "none" }}>Get started</Link>
        </div>
      </footer>
    </div>
  );
}
