# LFC (lfc.dev) — Product Strategy

## Name: **Looking For Config** (lfc.dev)

*"Your AI tools are looking for config. We make sure they find the right one."*

## What We're Building

A third-party SaaS (free < 5 users, $25/user/year team plan up to 50, enterprise call-us) that lets organizations manage, sync, and secure AI tool configurations across their team. We don't control any of the AI tools — we manage the **files they read**.

**Deploy:** GitHub → AWS via Pulumi.

## The Problem

Every AI coding/desktop tool reads config from specific files on disk. An org with 50 people using Claude Desktop, Cursor, and Codex has hundreds of config files to keep in sync. Today, admins share configs via Slack, wikis, or "just copy this JSON." API keys end up in plaintext. New hires spend a day setting up. When an MCP endpoint changes, someone has to tell everyone to update manually.

## What We Control: The File Map

Every tool reads specific files from specific paths. This is our entire attack surface:

| Tool | What | Path (Mac) | Path (Windows) | Format |
|------|------|-----------|-----------------|--------|
| **Claude Desktop** | MCP servers | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | JSON |
| **Claude Code** | MCPs | `~/.claude.json` (user) / `.claude/.mcp.json` (project) | same | JSON |
| **Claude Code** | Instructions | `~/.claude/CLAUDE.md` (global) / `./CLAUDE.md` (project) | same | Markdown |
| **Claude Code** | Settings | `~/.claude/settings.json` | same | JSON |
| **Claude Code** | Skills | `~/.claude/skills/` (global) / `.claude/skills/` (project) | same | Markdown |
| **Claude Code** | Agents | `~/.claude/agents/` / `.claude/agents/` | same | Markdown |
| **Claude Code** | Rules | `.claude/rules/*.md` | same | Markdown |
| **Codex** | Config | `~/.codex/config.toml` | same | TOML |
| **Codex** | Auth | `~/.codex/auth.json` | same | JSON |
| **Codex** | Instructions | `./AGENTS.md` | same | Markdown |
| **OpenCode** | Config | `~/.config/opencode/opencode.json` / `./opencode.json` | same | JSON |
| **OpenCode** | Agents | `~/.config/opencode/agents/` / `.opencode/agents/` | same | Markdown |
| **Cursor** | MCP servers | `~/.cursor/mcp.json` (global) / `.cursor/mcp.json` (project) | same | JSON |
| **Cursor** | Rules | `.cursorrules` / `.cursor/rules/*.mdc` | same | Markdown |
| **Windsurf** | MCP servers | `~/.codeium/windsurf/mcp_config.json` | same | JSON |
| **Windsurf** | Managed MCP | `managed-mcp.json` (system-wide) | same | JSON |

**Key insight:** Many tools share the same MCP JSON schema (`mcpServers` format). Instructions are all Markdown. The config surface is heterogeneous but finite and mappable.

---

## Architecture

### The Agent (runs on user's machine)

A lightweight background process (tray app on Mac/Windows, daemon on Linux) that:

1. Authenticates with our API (org invite link → login → done)
2. Polls for config updates (or WebSocket for real-time)
3. Writes/updates the correct files on disk for each tool the user has installed
4. Resolves secrets at write time (API keys injected into configs, never stored in our API response plaintext — encrypted in transit, decrypted locally)
5. Watches for local changes and warns if they'll be overwritten (or merges intelligently)

### The API (our hosted backend)

- Stores config profiles (the canonical "what should this tool look like")
- Maps profiles → groups → users
- Stores encrypted secrets (API keys, tokens)
- Serves configs to agents: "you are user X in group Y, here are your files"
- Audit log of all changes and deliveries

### The Admin Dashboard (web app)

- Visual editor for configs (not just raw JSON/TOML)
- Group management (teams, roles, or just "everyone")
- Secrets management (add/rotate API keys, scoped to specific configs)
- Status dashboard: who has what version, who's out of date
- Diff preview before publishing changes

---

## MVP Scope

### What ships
- **Tauri tray app** (`lfc`) — small native binary, system tray, auto-launch on login. Also exposes CLI mode for developer/CI workflows.
- **Admin web dashboard** — React + Vite
- **API backend** — manages configs, users, groups, secrets
- **Supported tools (MVP):** Claude Desktop, Claude Code, Cursor (covers ~80% of market)
- **Supported config types (MVP):** MCP servers + instructions (CLAUDE.md/AGENTS.md/.cursorrules) + Skills

### Merge strategy (critical detail)
We do NOT overwrite the user's entire config file. We:
1. Read existing config
2. Identify org-managed entries (tagged with `"_managed_by": "lfc"` or namespaced like `org/server-name`)
3. Add/update/remove only org-managed entries
4. Leave user's personal configs untouched
5. Write back

For Markdown files (CLAUDE.md, AGENTS.md, .cursorrules):
- Org-managed content is wrapped in clear markers: `<!-- lfc:start -->` ... `<!-- lfc:end -->`
- User content outside these markers is never touched
- If the file doesn't exist, we create it with just the org section
