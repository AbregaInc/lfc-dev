#!/usr/bin/env node
/**
 * LFC CLI — a Node.js sync client for testing the full flow without Tauri.
 *
 * Usage:
 *   pnpm --filter cli lfc login                    # Login and save token
 *   pnpm --filter cli lfc sync                     # Sync configs to disk
 *   pnpm --filter cli lfc sync --dry-run           # Show what would be written
 *   pnpm --filter cli lfc status                   # Show detected tools + sync state
 *   pnpm --filter cli lfc reset                    # Remove all lfc-managed configs
 */

import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

// ─── Config ──────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), ".lfc");
const CONFIG_FILE = path.join(CONFIG_DIR, "cli-config.json");
const BACKUP_DIR = path.join(CONFIG_DIR, "backups");

interface CliConfig {
  apiUrl: string;
  token: string | null;
  email: string | null;
}

function loadConfig(): CliConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return { apiUrl: "http://localhost:3001", token: null, email: null };
  }
}

function saveConfig(config: CliConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ─── Safety: backup before any write ─────────────────────────────────

function backupFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = path.basename(filePath);
  const ts = Math.floor(Date.now() / 1000);
  const backupPath = path.join(BACKUP_DIR, `${filename}.${ts}.bak`);
  try {
    fs.copyFileSync(filePath, backupPath);
    console.log(`  [backup] ${filePath} → ${backupPath}`);
    return backupPath;
  } catch (e: any) {
    console.error(`  [WARNING] Failed to backup ${filePath}: ${e.message}`);
    return null;
  }
}

// ─── API Client ──────────────────────────────────────────────────────

async function apiRequest(config: CliConfig, method: string, path: string, body?: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Tool Detection ──────────────────────────────────────────────────

interface DetectedTool {
  name: string;
  id: string;
  configPath: string;
  exists: boolean;
}

function detectTools(): DetectedTool[] {
  const home = os.homedir();
  const tools: DetectedTool[] = [
    {
      name: "Claude Desktop",
      id: "claude-desktop",
      configPath: path.join(home, "Library/Application Support/Claude/claude_desktop_config.json"),
      exists: fs.existsSync(path.join(home, "Library/Application Support/Claude")),
    },
    {
      name: "Claude Code",
      id: "claude-code",
      configPath: path.join(home, ".claude.json"),
      exists: fs.existsSync(path.join(home, ".claude")),
    },
    {
      name: "Cursor",
      id: "cursor",
      configPath: path.join(home, ".cursor/mcp.json"),
      exists: fs.existsSync(path.join(home, ".cursor")),
    },
    {
      name: "Codex",
      id: "codex",
      configPath: path.join(home, ".codex"),
      exists: fs.existsSync(path.join(home, ".codex")),
    },
    {
      name: "Windsurf",
      id: "windsurf",
      configPath: path.join(home, ".codeium/windsurf/mcp_config.json"),
      exists: fs.existsSync(path.join(home, ".codeium/windsurf")),
    },
  ];
  return tools;
}

// ─── Config Writers (SAFE — never lose user data) ────────────────────

interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  _managed_by?: string;
}

const MCP_PATHS: Record<string, (home: string) => string> = {
  "claude-desktop": (h) => path.join(h, "Library/Application Support/Claude/claude_desktop_config.json"),
  "claude-code": (h) => path.join(h, ".claude.json"),
  cursor: (h) => path.join(h, ".cursor/mcp.json"),
  windsurf: (h) => path.join(h, ".codeium/windsurf/mcp_config.json"),
  codex: (h) => path.join(h, ".codex/mcp.json"),
};

/**
 * Write MCP config for a specific tool.
 *
 * SAFETY GUARANTEES:
 * 1. Backs up the original file before any modification
 * 2. Only removes entries tagged with _managed_by: "lfc"
 * 3. If an org server name collides with a user server, the user server
 *    is renamed to "{name}_user" — never deleted
 * 4. Validates that user entry count is preserved; aborts if not
 * 5. All other keys in the file (non-mcpServers) are preserved exactly
 */
function writeMcpConfig(toolId: string, servers: McpServer[], dryRun: boolean): string {
  const home = os.homedir();
  const pathFn = MCP_PATHS[toolId];
  if (!pathFn) return `  [skip] Unknown tool: ${toolId}`;

  const configPath = pathFn(home);

  // Read existing or create new
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      config = {};
    }
  }

  if (!config.mcpServers) config.mcpServers = {};

  // Count user entries BEFORE
  const userEntriesBefore = Object.entries(config.mcpServers)
    .filter(([_, v]: [string, any]) => v?._managed_by !== "lfc")
    .map(([k]) => k);

  // Remove only lfc-managed entries
  const removedKeys: string[] = [];
  for (const [key, value] of Object.entries(config.mcpServers)) {
    if ((value as any)?._managed_by === "lfc") {
      removedKeys.push(key);
      delete config.mcpServers[key];
    }
  }

  // Add new lfc-managed entries, handling name collisions
  const addedKeys: string[] = [];
  for (const server of servers) {
    if (config.mcpServers[server.name] && (config.mcpServers[server.name] as any)?._managed_by !== "lfc") {
      // Name collision with user entry — rename user's, never delete
      const userEntry = config.mcpServers[server.name];
      const renamed = `${server.name}_user`;
      config.mcpServers[renamed] = userEntry;
      delete config.mcpServers[server.name];
      console.log(`  [collision] renamed user's '${server.name}' → '${renamed}'`);
    }
    const entry: any = { command: server.command, args: server.args || [], _managed_by: "lfc" };
    if (server.env && Object.keys(server.env).length > 0) entry.env = server.env;
    config.mcpServers[server.name] = entry;
    addedKeys.push(server.name);
  }

  // SAFETY CHECK: user entries must be preserved
  const userEntriesAfter = Object.entries(config.mcpServers)
    .filter(([_, v]: [string, any]) => v?._managed_by !== "lfc")
    .map(([k]) => k);

  if (userEntriesAfter.length < userEntriesBefore.length) {
    return `  [SAFETY ABORT] User entries would be lost in ${configPath} (${userEntriesBefore.length} → ${userEntriesAfter.length})`;
  }

  const json = JSON.stringify(config, null, 2);

  if (dryRun) {
    const lines = [
      `  ${configPath}`,
      removedKeys.length > 0 ? `    removed: ${removedKeys.join(", ")}` : null,
      addedKeys.length > 0 ? `    added: ${addedKeys.join(", ")}` : null,
      `    user entries preserved: ${userEntriesAfter.length}`,
    ];
    return lines.filter(Boolean).join("\n");
  }

  // Backup before writing
  backupFile(configPath);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, json);
  return `  ${configPath} (${addedKeys.length} servers, ${userEntriesAfter.length} user entries preserved)`;
}

/**
 * Core helper: write markdown content using lfc markers.
 * SAFETY: Only modifies content inside markers. Backs up before writing.
 */
function writeMarkdownWithMarkers(filePath: string, content: string, dryRun: boolean): string {
  const startMarker = "<!-- lfc:start -->";
  const endMarker = "<!-- lfc:end -->";
  const managedBlock = `${startMarker}\n${content}\n${endMarker}`;

  let existing = "";
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, "utf-8");
  }

  let newContent: string;
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    newContent = existing.slice(0, startIdx) + managedBlock + existing.slice(endIdx + endMarker.length);
  } else if (existing.trim() === "") {
    newContent = managedBlock;
  } else {
    newContent = existing.trimEnd() + "\n\n" + managedBlock + "\n";
  }

  const extractUser = (s: string) => {
    const si = s.indexOf(startMarker);
    const ei = s.indexOf(endMarker);
    if (si !== -1 && ei !== -1) return s.slice(0, si) + s.slice(ei + endMarker.length);
    if (si !== -1) return s.slice(0, si);
    return s;
  };
  if (extractUser(newContent).trim() !== extractUser(existing).trim()) {
    return `  [SAFETY ABORT] User content in ${filePath} would be modified`;
  }

  if (dryRun) {
    return `  ${filePath}\n    managed block: ${content.split("\n").length} lines`;
  }

  backupFile(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, newContent);
  return `  ${filePath} (updated)`;
}

/**
 * Write markdown instructions with lfc markers.
 * SAFETY: Only modifies content inside markers. Backs up before writing.
 */
function writeMarkdownConfig(toolId: string, content: string, dryRun: boolean): string {
  const home = os.homedir();
  const paths: Record<string, string> = {
    "claude-code": path.join(home, ".claude/CLAUDE.md"),
    codex: path.join(home, "AGENTS.md"),
  };

  const filePath = paths[toolId];
  if (!filePath) return `  [skip] Markdown instructions not supported for: ${toolId}`;

  return writeMarkdownWithMarkers(filePath, content, dryRun);
}

/**
 * Write cursor rules using lfc markers in .cursorrules.
 * SAFETY: Only modifies content inside markers. Backs up before writing.
 */
function writeCursorRules(content: string, dryRun: boolean): string {
  const home = os.homedir();
  const filePath = path.join(home, ".cursorrules");
  return writeMarkdownWithMarkers(filePath, content, dryRun);
}

/**
 * Write agent files.
 * SAFETY: Uses lfc- prefix for managed agents. Never overwrites user agents.
 */
function writeAgent(toolId: string, name: string, content: string, dryRun: boolean): string {
  const home = os.homedir();
  if (toolId !== "claude-code") return `  [skip] Agents not supported for: ${toolId}`;

  const agentsDir = path.join(home, ".claude/agents");
  const agentPath = path.join(agentsDir, `lfc-${name}.md`);
  const managedContent = `<!-- managed_by: lfc -->\n${content}`;

  // Check if user has an agent with the same name
  const userAgentFile = path.join(agentsDir, `${name}.md`);
  if (fs.existsSync(userAgentFile)) {
    const isOurs = fs.readFileSync(userAgentFile, "utf-8").includes("<!-- managed_by: lfc -->");
    if (!isOurs) {
      console.log(`  [info] Agent '${name}' exists as user-owned — using lfc-${name} prefix`);
    }
  }

  if (dryRun) {
    return `  ${agentPath}\n    content: ${content.split("\n").length} lines`;
  }

  fs.mkdirSync(agentsDir, { recursive: true });
  backupFile(agentPath);
  fs.writeFileSync(agentPath, managedContent);
  return `  ${agentPath} (written)`;
}

/**
 * Write rule files.
 * SAFETY: Uses lfc- prefix for managed rules. Never overwrites user rules.
 */
function writeRule(toolId: string, name: string, content: string, dryRun: boolean): string {
  const home = os.homedir();

  let rulesDir: string;
  let extension: string;
  if (toolId === "claude-code") {
    rulesDir = path.join(home, ".claude/rules");
    extension = "md";
  } else if (toolId === "cursor") {
    rulesDir = path.join(home, ".cursor/rules");
    extension = "mdc";
  } else {
    return `  [skip] Rules not supported for: ${toolId}`;
  }

  const rulePath = path.join(rulesDir, `lfc-${name}.${extension}`);
  const managedContent = `<!-- managed_by: lfc -->\n${content}`;

  // Check if user has a rule with the same name
  const userRuleFile = path.join(rulesDir, `${name}.${extension}`);
  if (fs.existsSync(userRuleFile)) {
    const isOurs = fs.readFileSync(userRuleFile, "utf-8").includes("<!-- managed_by: lfc -->");
    if (!isOurs) {
      console.log(`  [info] Rule '${name}' exists as user-owned — using lfc-${name} prefix`);
    }
  }

  if (dryRun) {
    return `  ${rulePath}\n    content: ${content.split("\n").length} lines`;
  }

  fs.mkdirSync(rulesDir, { recursive: true });
  backupFile(rulePath);
  fs.writeFileSync(rulePath, managedContent);
  return `  ${rulePath} (written)`;
}

/**
 * Write skill files.
 * SAFETY: Uses lfc- prefix for managed skills. Never overwrites user skills.
 */
function writeSkill(toolId: string, name: string, content: string, dryRun: boolean): string {
  const home = os.homedir();
  if (toolId !== "claude-code") return `  [skip] Skills not supported for: ${toolId}`;

  const skillsDir = path.join(home, ".claude/skills");
  const skillDir = path.join(skillsDir, `lfc-${name}`);
  const skillPath = path.join(skillDir, "SKILL.md");
  const managedContent = `<!-- managed_by: lfc -->\n${content}`;

  // Check if user has a skill with the same name
  const userSkillDir = path.join(skillsDir, name);
  const userSkillFile = path.join(skillsDir, `${name}.md`);
  if (fs.existsSync(userSkillDir) || fs.existsSync(userSkillFile)) {
    const isOurs = fs.existsSync(userSkillDir)
      ? fs.readFileSync(path.join(userSkillDir, "SKILL.md"), "utf-8").includes("<!-- managed_by: lfc -->")
      : fs.readFileSync(userSkillFile, "utf-8").includes("<!-- managed_by: lfc -->");
    if (!isOurs) {
      console.log(`  [info] Skill '${name}' exists as user-owned — using lfc-${name} prefix`);
    }
  }

  if (dryRun) {
    return `  ${skillPath}\n    content: ${content.split("\n").length} lines`;
  }

  fs.mkdirSync(skillDir, { recursive: true });
  backupFile(skillPath);
  fs.writeFileSync(skillPath, managedContent);
  return `  ${skillPath} (written)`;
}

// ─── Reset (remove all lfc-managed entries) ──────────────────────────

function resetConfigs(dryRun: boolean) {
  const home = os.homedir();
  const mcpPaths = Object.values(MCP_PATHS).map((fn) => fn(home));

  console.log(dryRun ? "\n[dry-run] Would remove lfc-managed entries from:\n" : "\nRemoving lfc-managed entries:\n");

  for (const p of mcpPaths) {
    if (!fs.existsSync(p)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (!config.mcpServers) continue;
      const removed: string[] = [];
      for (const [key, value] of Object.entries(config.mcpServers)) {
        if ((value as any)?._managed_by === "lfc") {
          removed.push(key);
          if (!dryRun) delete config.mcpServers[key];
        }
      }
      if (removed.length > 0) {
        if (!dryRun) {
          backupFile(p);
          fs.writeFileSync(p, JSON.stringify(config, null, 2));
        }
        console.log(`  ${p}: removed ${removed.join(", ")}`);
      }
    } catch {}
  }

  // Remove lfc markers from markdown files
  const startMarker = "<!-- lfc:start -->";
  const endMarker = "<!-- lfc:end -->";

  const markerFiles = [
    path.join(home, ".claude/CLAUDE.md"),
    path.join(home, "AGENTS.md"),
    path.join(home, ".cursorrules"),
  ];

  for (const mdPath of markerFiles) {
    if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, "utf-8");
      const startIdx = content.indexOf(startMarker);
      const endIdx = content.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        const newContent = (content.slice(0, startIdx) + content.slice(endIdx + endMarker.length)).trim();
        if (!dryRun) {
          backupFile(mdPath);
          fs.writeFileSync(mdPath, newContent || "");
        }
        console.log(`  ${mdPath}: removed managed block`);
      }
    }
  }

  // Remove lfc-managed skills (only lfc- prefixed dirs)
  const skillsDir = path.join(home, ".claude/skills");
  if (fs.existsSync(skillsDir)) {
    try {
      for (const entry of fs.readdirSync(skillsDir)) {
        if (entry.startsWith("lfc-")) {
          const skillPath = path.join(skillsDir, entry);
          if (!dryRun) {
            fs.rmSync(skillPath, { recursive: true });
          }
          console.log(`  ${skillPath}: removed`);
        }
      }
    } catch {}
  }

  // Remove lfc-managed agents (only lfc- prefixed files)
  const agentsDir = path.join(home, ".claude/agents");
  if (fs.existsSync(agentsDir)) {
    try {
      for (const entry of fs.readdirSync(agentsDir)) {
        if (entry.startsWith("lfc-")) {
          const agentPath = path.join(agentsDir, entry);
          if (!dryRun) {
            fs.rmSync(agentPath);
          }
          console.log(`  ${agentPath}: removed`);
        }
      }
    } catch {}
  }

  // Remove lfc-managed rules from .claude/rules/ and .cursor/rules/
  const ruleDirs = [
    path.join(home, ".claude/rules"),
    path.join(home, ".cursor/rules"),
  ];

  for (const rulesDir of ruleDirs) {
    if (fs.existsSync(rulesDir)) {
      try {
        for (const entry of fs.readdirSync(rulesDir)) {
          if (entry.startsWith("lfc-")) {
            const rulePath = path.join(rulesDir, entry);
            if (!dryRun) {
              fs.rmSync(rulePath);
            }
            console.log(`  ${rulePath}: removed`);
          }
        }
      } catch {}
    }
  }
}

// ─── Prompt helper ───────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

// ─── Commands ────────────────────────────────────────────────────────

async function cmdLogin() {
  const config = loadConfig();
  const apiUrl = await prompt(`API URL [${config.apiUrl}]: `) || config.apiUrl;
  const email = await prompt("Email [admin@acme.com]: ") || "admin@acme.com";
  const password = await prompt("Password [password123]: ") || "password123";

  config.apiUrl = apiUrl;

  try {
    const data = await apiRequest(config, "POST", "/api/auth/login", { email, password });
    config.token = data.token;
    config.email = email;
    saveConfig(config);
    console.log(`\nLogged in as ${email} (org: ${data.user.orgId || "none"})`);
    console.log(`Config saved to ${CONFIG_FILE}`);
  } catch (err: any) {
    console.error(`Login failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdStatus() {
  const config = loadConfig();
  console.log("\n--- LFC Client Status ---\n");
  console.log(`API:   ${config.apiUrl}`);
  console.log(`User:  ${config.email || "(not logged in)"}`);
  console.log(`Token: ${config.token ? config.token.slice(0, 20) + "..." : "(none)"}`);

  console.log("\nDetected tools:");
  const tools = detectTools();
  for (const tool of tools) {
    console.log(`  ${tool.exists ? "[x]" : "[ ]"} ${tool.name} — ${tool.configPath}`);
  }

  if (config.token) {
    try {
      const me = await apiRequest(config, "GET", "/api/auth/me");
      console.log(`\nOrg:   ${me.user.orgId || "(none)"}`);
      console.log(`Role:  ${me.user.role}`);
    } catch {}
  }
  console.log("");
}

async function cmdSync(dryRun: boolean) {
  const config = loadConfig();
  if (!config.token) {
    console.error("Not logged in. Run: pnpm --filter cli lfc login");
    process.exit(1);
  }

  const tools = detectTools();
  const installed = tools.filter((t) => t.exists).map((t) => t.id);

  console.log(dryRun ? "\n[dry-run] Sync preview:\n" : "\nSyncing configs...\n");
  console.log(`Installed tools: ${installed.join(", ") || "(none detected)"}\n`);

  try {
    const data = await apiRequest(config, "POST", "/api/sync", {
      installedTools: installed,
      currentVersions: {},
    });

    if (data.configs.length === 0) {
      console.log("No configs to sync. All up to date.");
      return;
    }

    for (const item of data.configs) {
      console.log(`Profile: ${item.profileName} / ${item.configType} (v${item.version})`);
      console.log(`Target tools: ${item.targetTools.join(", ")}`);

      for (const tool of item.targetTools) {
        // Skip unknown tools gracefully
        const knownTools = new Set([...Object.keys(MCP_PATHS), "claude-code", "codex", "cursor"]);
        if (!knownTools.has(tool)) {
          console.log(`  [skip] Unknown tool: ${tool}`);
          continue;
        }

        let result: string;
        switch (item.configType) {
          case "mcp": {
            const payload = JSON.parse(item.content);
            result = writeMcpConfig(tool, payload.servers, dryRun);
            break;
          }
          case "instructions": {
            result = writeMarkdownConfig(tool, item.content, dryRun);
            break;
          }
          case "skills": {
            try {
              const skill = JSON.parse(item.content);
              result = writeSkill(tool, skill.name || "unnamed", skill.content || "", dryRun);
            } catch {
              result = `  [skip] Invalid skill content`;
            }
            break;
          }
          case "agents": {
            try {
              const agent = JSON.parse(item.content);
              result = writeAgent(tool, agent.name || "unnamed", agent.content || "", dryRun);
            } catch {
              result = `  [skip] Invalid agent content`;
            }
            break;
          }
          case "rules": {
            if (tool === "cursor") {
              // Check if it's JSON (named rule) or plain text (inline rules)
              try {
                const rule = JSON.parse(item.content);
                if (rule.name) {
                  // Named rule file — write to .cursor/rules/lfc-{name}.mdc
                  result = writeRule(tool, rule.name, rule.content || "", dryRun);
                } else if (rule.content) {
                  // Inline rules — write to .cursorrules with markers
                  result = writeCursorRules(rule.content, dryRun);
                } else {
                  result = writeCursorRules(item.content, dryRun);
                }
              } catch {
                // Plain text content — write to .cursorrules with markers
                result = writeCursorRules(item.content, dryRun);
              }
            } else {
              // claude-code rules: JSON with name/content
              try {
                const rule = JSON.parse(item.content);
                result = writeRule(tool, rule.name || "unnamed", rule.content || "", dryRun);
              } catch {
                result = `  [skip] Invalid rule content`;
              }
            }
            break;
          }
          default:
            result = `  [skip] Unknown config type: ${item.configType}`;
        }
        console.log(result);
      }
      console.log("");
    }

    console.log(dryRun ? "No files were modified (dry run)." : "Sync complete.");
  } catch (err: any) {
    console.error(`Sync failed: ${err.message}`);
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const dryRun = args.includes("--dry-run");

switch (command) {
  case "login":
    cmdLogin();
    break;
  case "sync":
    cmdSync(dryRun);
    break;
  case "status":
    cmdStatus();
    break;
  case "reset":
    resetConfigs(dryRun);
    break;
  default:
    console.log(`
LFC CLI — sync AI tool configs from your org

Commands:
  login                Login to LFC API
  sync                 Sync configs to local tool files
  sync --dry-run       Preview what would change without writing
  status               Show detected tools and connection info
  reset                Remove all lfc-managed config entries
  reset --dry-run      Preview what would be removed

Usage:
  pnpm --filter cli lfc login
  pnpm --filter cli lfc sync --dry-run
  pnpm --filter cli lfc sync
`);
}
