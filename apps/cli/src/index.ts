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
import { spawnSync } from "child_process";

// ─── Config ──────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), ".lfc");
const CONFIG_FILE = path.join(CONFIG_DIR, "cli-config.json");
const STATE_FILE = path.join(CONFIG_DIR, "cli-state.json");
const BACKUP_DIR = path.join(CONFIG_DIR, "backups");
const ARTIFACTS_DIR = path.join(CONFIG_DIR, "artifacts");
const BIN_DIR = path.join(CONFIG_DIR, "bin");

interface CliConfig {
  apiUrl: string;
  token: string | null;
  email: string | null;
  orgId: string | null;
  deviceId: string | null;
}

function loadConfig(): CliConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return { apiUrl: "http://localhost:8787", token: null, email: null, orgId: null, deviceId: null };
  }
}

function saveConfig(config: CliConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

type DeviceActualState =
  | "pending"
  | "fetching"
  | "installing"
  | "staged"
  | "verifying"
  | "active"
  | "failed"
  | "rollback_pending"
  | "rolled_back"
  | "removed"
  | "config_applied_unverified"
  | "failed_prerequisites"
  | "unknown_runtime";

interface LocalArtifactState {
  artifactReleaseId: string;
  desiredState: "active" | "removed";
  actualState: DeviceActualState;
  activationState?: string;
  installRoot?: string;
  wrapperPath?: string;
  previousReleaseId?: string;
  lastErrorCode?: string;
  lastErrorDetail?: string;
  inventoryJson?: Record<string, unknown>;
  lastVerifiedAt?: string;
  lastTransitionAt: string;
}

interface LocalEvent {
  at: string;
  artifactReleaseId?: string;
  eventType: string;
  detail?: string;
}

interface CliState {
  artifactStates: Record<string, LocalArtifactState>;
  events: LocalEvent[];
}

function loadState(): CliState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { artifactStates: {}, events: [] };
  }
}

function saveState(state: CliState) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function logLocalEvent(state: CliState, event: LocalEvent) {
  state.events = [event, ...state.events].slice(0, 200);
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
    {
      name: "OpenCode",
      id: "opencode",
      configPath: path.join(home, ".opencode"),
      exists: fs.existsSync(path.join(home, ".opencode")),
    },
  ];
  return tools;
}

interface ManifestEnvField {
  name: string;
  required: boolean;
  secretRef?: string;
  defaultValue?: string;
}

interface ArtifactManifest {
  kind: "instructions" | "rule" | "agent" | "skill" | "mcp" | "plugin";
  reliabilityTier: "managed" | "best_effort" | "unreliable";
  source: {
    type: "inline_files" | "npm" | "pypi" | "binary" | "docker" | "marketplace" | "raw_command" | "raw_path";
    ref: string;
    version?: string;
    digest?: string;
    metadata?: Record<string, unknown>;
  };
  runtime: {
    kind: "none" | "node" | "python" | "docker" | "native";
    version?: string;
    provisionMode: "managed" | "system";
  };
  install: {
    strategy: "copy_files" | "npm_package" | "python_package" | "download_binary" | "pull_image" | "write_config_only";
    managedRoot: string;
    wrapperName?: string;
  };
  launch?: {
    command: string;
    args: string[];
    env: ManifestEnvField[];
  };
  verify?: {
    type: "file_hash" | "exec" | "http" | "none";
    command?: string;
    args?: string[];
    url?: string;
    timeoutMs?: number;
    expectedExitCode?: number;
  };
  payload?: {
    files?: Array<{ path: string; content: string; executable?: boolean }>;
    downloadUrl?: string;
    checksum?: string;
    image?: string;
    metadata?: Record<string, unknown>;
  };
  compatibility: {
    os: string[];
    arch: string[];
    tools: string[];
  };
  bindings: Array<{
    tool: string;
    bindingType: "instructions" | "rule" | "agent" | "skill" | "mcp" | "plugin";
    targetPath?: string;
    configTemplate?: string;
    configJson?: Record<string, unknown>;
  }>;
}

interface SyncAssignment {
  assignmentId: string;
  profileId: string;
  profileName: string;
  desiredState: "active" | "removed";
  rolloutStrategy: "all_at_once" | "canary" | "phased";
  artifact: {
    id: string;
    slug: string;
    name: string;
    kind: string;
  };
  release: {
    id: string;
    artifactId: string;
    version: string;
    status: string;
    reliabilityTier: "managed" | "best_effort" | "unreliable";
    manifest: ArtifactManifest;
  };
  resolvedSecrets: Record<string, string>;
}

interface DeviceRegistrationResponse {
  device: {
    id: string;
    orgId: string;
    userId: string;
    name: string;
    platform: string;
    arch: string;
    clientKind: string;
    clientVersion: string;
    status: string;
    lastSeenAt: string;
  };
  featureFlags: Record<string, boolean>;
}

interface DeviceSyncResponse {
  device: DeviceRegistrationResponse["device"];
  assignments: SyncAssignment[];
  removals: string[];
  serverTime: string;
}

interface InstallResult {
  installRoot: string;
  wrapperPath?: string;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function artifactRoot(releaseId: string) {
  return path.join(ARTIFACTS_DIR, releaseId);
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function writeExecutable(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  fs.chmodSync(filePath, 0o755);
}

function runCommand(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout.trim();
}

function findPythonCommand(): string | null {
  for (const candidate of ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf-8", stdio: "pipe" });
    if (result.status === 0) return candidate;
  }
  return null;
}

function hasManagedMcpEntries(toolId: string) {
  const pathFn = MCP_PATHS[toolId];
  if (!pathFn) return false;
  const configPath = pathFn(os.homedir());
  if (!fs.existsSync(configPath)) return false;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return Object.values(config.mcpServers || {}).some((value: any) => value?._managed_by === "lfc");
  } catch {
    return false;
  }
}

function hasManagedMarkdownBlock(filePath: string) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.includes("<!-- lfc:start -->") && content.includes("<!-- lfc:end -->");
  } catch {
    return false;
  }
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

const SKILL_TOOL_PATHS: Record<string, (home: string) => string> = {
  "claude-code": (h) => path.join(h, ".claude/skills"),
  codex: (h) => path.join(h, ".codex/skills"),
  cursor: (h) => path.join(h, ".cursor/skills"),
  windsurf: (h) => path.join(h, ".codeium/windsurf/skills"),
  opencode: (h) => path.join(h, ".opencode/skills"),
};

function sharedSkillsDir() {
  return path.join(os.homedir(), ".agents/skills");
}

function managedSkillName(name: string) {
  return `lfc-${name}`;
}

function managedSkillRoot(name: string) {
  return path.join(sharedSkillsDir(), managedSkillName(name));
}

function managedSkillFile(name: string) {
  return path.join(managedSkillRoot(name), "SKILL.md");
}

function skillEntryIsManaged(entryPath: string) {
  try {
    const stat = fs.lstatSync(entryPath);
    if (stat.isSymbolicLink()) {
      const resolved = fs.realpathSync(entryPath);
      return resolved.startsWith(sharedSkillsDir());
    }
    if (stat.isDirectory()) {
      return fs.readFileSync(path.join(entryPath, "SKILL.md"), "utf-8").includes("<!-- managed_by: lfc -->");
    }
    return fs.readFileSync(entryPath, "utf-8").includes("<!-- managed_by: lfc -->");
  } catch {
    return false;
  }
}

function ensureSkillSymlink(target: string, linkPath: string, dryRun: boolean) {
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat) {
      if (!skillEntryIsManaged(linkPath)) {
        throw new Error(`Managed skill link ${linkPath} already exists but is not owned by LFC`);
      }
      if (fs.realpathSync(linkPath) === target) {
        return;
      }
      if (!dryRun) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  if (dryRun) return;
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath, "dir");
}

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
 * Write skills into the shared global registry and fan them out into tool skill dirs.
 * SAFETY: Uses lfc- prefix, shared roots, and symlinks. Never overwrites user skills.
 */
function writeSkill(toolId: string, name: string, content: string, dryRun: boolean): string {
  const skillsDir = SKILL_TOOL_PATHS[toolId]?.(os.homedir());
  if (!skillsDir) return `  [skip] Skills not supported for: ${toolId}`;

  const skillDir = managedSkillRoot(name);
  const skillPath = managedSkillFile(name);
  const linkPath = path.join(skillsDir, managedSkillName(name));
  const managedContent = `<!-- managed_by: lfc -->\n${content}`;

  if (fs.existsSync(skillDir) && !skillEntryIsManaged(skillDir)) {
    return `  [SAFETY ABORT] Shared skill root ${skillDir} exists but is not owned by LFC`;
  }

  if (dryRun) {
    return `  ${skillPath}\n    shared root: ${skillDir}\n    link: ${linkPath}\n    content: ${content.split("\n").length} lines`;
  }

  fs.mkdirSync(skillDir, { recursive: true });
  if (!fs.existsSync(skillPath) || fs.readFileSync(skillPath, "utf-8") !== managedContent) {
    backupFile(skillPath);
    fs.writeFileSync(skillPath, managedContent);
  }
  ensureSkillSymlink(skillDir, linkPath, dryRun);
  return `  ${linkPath} -> ${skillDir}`;
}

function removeManagedSkillRoots(desiredNames: Set<string>, dryRun: boolean): string[] {
  const skillsDir = sharedSkillsDir();
  if (!fs.existsSync(skillsDir)) return [];
  const removed: string[] = [];
  for (const entry of fs.readdirSync(skillsDir)) {
    if (!entry.startsWith("lfc-")) continue;
    const logicalName = entry.replace(/^lfc-/, "").replace(/\.md$/, "");
    if (desiredNames.has(logicalName)) continue;
    const target = path.join(skillsDir, entry);
    removed.push(target);
    if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
  }
  return removed;
}

function removeManagedSkillLinks(toolId: string, desiredNames: Set<string>, dryRun: boolean): string[] {
  const skillsDir = SKILL_TOOL_PATHS[toolId]?.(os.homedir());
  if (!skillsDir || !fs.existsSync(skillsDir)) return [];
  const removed: string[] = [];
  for (const entry of fs.readdirSync(skillsDir)) {
    if (!entry.startsWith("lfc-")) continue;
    const logicalName = entry.replace(/^lfc-/, "").replace(/\.md$/, "");
    if (desiredNames.has(logicalName)) continue;
    const target = path.join(skillsDir, entry);
    removed.push(target);
    if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
  }
  return removed;
}

function removeManagedAgents(desiredNames: Set<string>, dryRun: boolean): string[] {
  const agentsDir = path.join(os.homedir(), ".claude/agents");
  if (!fs.existsSync(agentsDir)) return [];
  const removed: string[] = [];
  for (const entry of fs.readdirSync(agentsDir)) {
    if (!entry.startsWith("lfc-")) continue;
    const logicalName = entry.replace(/^lfc-/, "").replace(/\.md$/, "");
    if (desiredNames.has(logicalName)) continue;
    const target = path.join(agentsDir, entry);
    removed.push(target);
    if (!dryRun) fs.rmSync(target, { force: true });
  }
  return removed;
}

function removeManagedRules(toolId: string, desiredNames: Set<string>, dryRun: boolean): string[] {
  const home = os.homedir();
  const rulesDir =
    toolId === "cursor" ? path.join(home, ".cursor/rules")
    : toolId === "claude-code" ? path.join(home, ".claude/rules")
    : null;
  if (!rulesDir || !fs.existsSync(rulesDir)) return [];
  const removed: string[] = [];
  for (const entry of fs.readdirSync(rulesDir)) {
    if (!entry.startsWith("lfc-")) continue;
    const logicalName = entry.replace(/^lfc-/, "").replace(/\.(md|mdc)$/, "");
    if (desiredNames.has(logicalName)) continue;
    const target = path.join(rulesDir, entry);
    removed.push(target);
    if (!dryRun) fs.rmSync(target, { force: true });
  }
  return removed;
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

  // Remove lfc-managed skills from shared roots and all supported tool links.
  const skillRootsDir = sharedSkillsDir();
  if (fs.existsSync(skillRootsDir)) {
    try {
      for (const entry of fs.readdirSync(skillRootsDir)) {
        if (!entry.startsWith("lfc-")) continue;
        const skillPath = path.join(skillRootsDir, entry);
        if (!dryRun) {
          fs.rmSync(skillPath, { recursive: true, force: true });
        }
        console.log(`  ${skillPath}: removed`);
      }
    } catch {}
  }
  for (const toolPath of Object.values(SKILL_TOOL_PATHS)) {
    const skillsDir = toolPath(home);
    if (!fs.existsSync(skillsDir)) continue;
    try {
      for (const entry of fs.readdirSync(skillsDir)) {
        if (!entry.startsWith("lfc-")) continue;
        const skillPath = path.join(skillsDir, entry);
        if (!dryRun) {
          fs.rmSync(skillPath, { recursive: true, force: true });
        }
        console.log(`  ${skillPath}: removed`);
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

function buildInventorySnapshot() {
  return {
    tools: detectTools().map((tool) => ({
      id: tool.id,
      name: tool.name,
      installed: tool.exists,
    })),
  };
}

async function registerDevice(config: CliConfig): Promise<DeviceRegistrationResponse> {
  const detectedTools = detectTools().map((tool) => ({
    tool: tool.id,
    installed: tool.exists,
  }));

  const response = await apiRequest(config, "POST", "/api/devices/register", {
    deviceId: config.deviceId,
    name: `${os.userInfo().username}@${os.hostname()}`,
    platform: process.platform,
    arch: process.arch,
    clientKind: "cli",
    clientVersion: "0.1.0",
    detectedTools,
  });

  config.deviceId = response.device.id;
  saveConfig(config);
  return response as DeviceRegistrationResponse;
}

function resolveBindingContent(assignment: SyncAssignment) {
  const files = assignment.release.manifest.payload?.files || [];
  if (files.length === 0) return "";
  const preferred =
    files.find((file) => /SKILL\.md$/i.test(file.path)) ||
    files.find((file) => /instructions/i.test(file.path)) ||
    files[0];
  return preferred?.content || "";
}

function renderInstructionBlock(assignment: SyncAssignment) {
  const content = resolveBindingContent(assignment).trim();
  return content
    ? `# ${assignment.artifact.name}\n${content}`
    : `# ${assignment.artifact.name}\n`;
}

function writeEnvFiles(root: string, manifest: ArtifactManifest, resolvedSecrets: Record<string, string>) {
  const envDir = path.join(root, "env");
  ensureDir(envDir);
  const envLines: string[] = [];
  for (const field of manifest.launch?.env || []) {
    const value = resolvedSecrets[field.name] ?? field.defaultValue;
    if (value !== undefined) {
      envLines.push(`export ${field.name}=${shellEscape(String(value))}`);
    }
  }
  const envFile = path.join(envDir, "env.sh");
  fs.writeFileSync(envFile, `${envLines.join("\n")}\n`, { mode: 0o600 });
  return envFile;
}

function installCopyFiles(assignment: SyncAssignment, dryRun: boolean): InstallResult {
  const root = artifactRoot(assignment.release.id);
  const files = assignment.release.manifest.payload?.files || [];
  if (!dryRun) {
    ensureDir(path.join(root, "payload"));
    for (const file of files) {
      const target = path.join(root, "payload", file.path);
      ensureDir(path.dirname(target));
      fs.writeFileSync(target, file.content);
      if (file.executable) fs.chmodSync(target, 0o755);
    }
  }
  return { installRoot: root };
}

function installNpmPackage(assignment: SyncAssignment, dryRun: boolean): InstallResult {
  const manifest = assignment.release.manifest;
  if (!manifest.launch?.command || !manifest.source.version) {
    throw new Error("npm_package installer requires launch.command and source.version");
  }

  const root = artifactRoot(assignment.release.id);
  const wrapperPath = path.join(BIN_DIR, manifest.install.wrapperName || assignment.artifact.slug);
  if (!dryRun) {
    ensureDir(root);
    ensureDir(BIN_DIR);
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ private: true, name: `lfc-${assignment.release.id}` }, null, 2));
    runCommand("npm", ["install", "--silent", "--no-package-lock", "--prefix", root, `${manifest.source.ref}@${manifest.source.version}`], root);
    const envFile = writeEnvFiles(root, manifest, assignment.resolvedSecrets);
    writeExecutable(
      wrapperPath,
      `#!/bin/sh\nset -e\n. ${shellEscape(envFile)}\nexec ${shellEscape(path.join(root, "node_modules", ".bin", manifest.launch.command))} "$@"\n`
    );
  }
  return { installRoot: root, wrapperPath };
}

function installPythonPackage(assignment: SyncAssignment, dryRun: boolean): InstallResult {
  const manifest = assignment.release.manifest;
  if (!manifest.launch?.command || !manifest.source.version) {
    throw new Error("python_package installer requires launch.command and source.version");
  }
  const python = findPythonCommand();
  if (!python) {
    const error = new Error("python3/python not found");
    (error as any).code = "missing_python";
    throw error;
  }

  const root = artifactRoot(assignment.release.id);
  const venvDir = path.join(root, "venv");
  const wrapperPath = path.join(BIN_DIR, manifest.install.wrapperName || assignment.artifact.slug);
  if (!dryRun) {
    ensureDir(root);
    ensureDir(BIN_DIR);
    runCommand(python, ["-m", "venv", venvDir], root);
    const pip = path.join(venvDir, "bin", "pip");
    runCommand(pip, ["install", `${manifest.source.ref}==${manifest.source.version}`], root);
    const envFile = writeEnvFiles(root, manifest, assignment.resolvedSecrets);
    writeExecutable(
      wrapperPath,
      `#!/bin/sh\nset -e\n. ${shellEscape(envFile)}\nexec ${shellEscape(path.join(venvDir, "bin", manifest.launch.command))} "$@"\n`
    );
  }
  return { installRoot: root, wrapperPath };
}

async function installBinaryDownload(assignment: SyncAssignment, dryRun: boolean): Promise<InstallResult> {
  const manifest = assignment.release.manifest;
  if (!manifest.payload?.downloadUrl || !manifest.launch?.command) {
    throw new Error("download_binary installer requires payload.downloadUrl and launch.command");
  }
  const root = artifactRoot(assignment.release.id);
  const binaryPath = path.join(root, "bin", manifest.launch.command);
  const wrapperPath = path.join(BIN_DIR, manifest.install.wrapperName || assignment.artifact.slug);
  if (!dryRun) {
    ensureDir(path.dirname(binaryPath));
    ensureDir(BIN_DIR);
    const res = await fetch(manifest.payload.downloadUrl);
    if (!res.ok) throw new Error(`Failed to download binary: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(binaryPath, buffer);
    fs.chmodSync(binaryPath, 0o755);
    const envFile = writeEnvFiles(root, manifest, assignment.resolvedSecrets);
    writeExecutable(
      wrapperPath,
      `#!/bin/sh\nset -e\n. ${shellEscape(envFile)}\nexec ${shellEscape(binaryPath)} "$@"\n`
    );
  }
  return { installRoot: root, wrapperPath };
}

function installDockerImage(assignment: SyncAssignment, dryRun: boolean): InstallResult {
  const manifest = assignment.release.manifest;
  const image = manifest.payload?.image || manifest.source.ref;
  const wrapperPath = path.join(BIN_DIR, manifest.install.wrapperName || assignment.artifact.slug);
  const root = artifactRoot(assignment.release.id);
  if (!image || !manifest.launch?.command) {
    throw new Error("pull_image installer requires an image and launch.command");
  }
  if (!dryRun) {
    ensureDir(root);
    ensureDir(BIN_DIR);
    runCommand("docker", ["pull", image], root);
    const envFile = writeEnvFiles(root, manifest, assignment.resolvedSecrets);
    writeExecutable(
      wrapperPath,
      `#!/bin/sh\nset -e\n. ${shellEscape(envFile)}\nexec docker run --rm -i --entrypoint ${shellEscape(manifest.launch.command)} ${shellEscape(image)} "$@"\n`
    );
  }
  return { installRoot: root, wrapperPath };
}

function installWriteConfigOnly(assignment: SyncAssignment): InstallResult {
  return {
    installRoot: artifactRoot(assignment.release.id),
    wrapperPath: assignment.release.manifest.launch?.command,
  };
}

async function ensureAssignmentInstalled(assignment: SyncAssignment, dryRun: boolean): Promise<InstallResult> {
  switch (assignment.release.manifest.install.strategy) {
    case "copy_files":
      return installCopyFiles(assignment, dryRun);
    case "npm_package":
      return installNpmPackage(assignment, dryRun);
    case "python_package":
      return installPythonPackage(assignment, dryRun);
    case "download_binary":
      return installBinaryDownload(assignment, dryRun);
    case "pull_image":
      return installDockerImage(assignment, dryRun);
    case "write_config_only":
      return installWriteConfigOnly(assignment);
    default:
      throw new Error(`Unsupported install strategy: ${assignment.release.manifest.install.strategy}`);
  }
}

function cleanupArtifactInstalls(keepReleaseIds: Set<string>, dryRun: boolean) {
  if (!fs.existsSync(ARTIFACTS_DIR)) return [];
  const removed: string[] = [];
  for (const entry of fs.readdirSync(ARTIFACTS_DIR)) {
    if (keepReleaseIds.has(entry)) continue;
    const target = path.join(ARTIFACTS_DIR, entry);
    removed.push(target);
    if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
  }
  if (!fs.existsSync(BIN_DIR)) return removed;
  for (const entry of fs.readdirSync(BIN_DIR)) {
    const target = path.join(BIN_DIR, entry);
    const content = fs.readFileSync(target, "utf-8");
    const matchesKeep = [...keepReleaseIds].some((releaseId) => content.includes(releaseId));
    if (matchesKeep) continue;
    removed.push(target);
    if (!dryRun) fs.rmSync(target, { force: true });
  }
  return removed;
}

function verifyAssignment(assignment: SyncAssignment, runtimeCommand: string | undefined, dryRun: boolean) {
  const verify = assignment.release.manifest.verify;
  if (!verify || verify.type === "none" || dryRun) return { actualState: assignment.release.reliabilityTier === "unreliable" ? "config_applied_unverified" : "active" as DeviceActualState };

  try {
    if (verify.type === "exec") {
      const command = runtimeCommand || verify.command || assignment.release.manifest.launch?.command;
      if (!command) {
        return { actualState: "unknown_runtime" as DeviceActualState, lastErrorCode: "missing_verify_command", lastErrorDetail: "No verification command available" };
      }
      runCommand(command, verify.args || []);
    }
    return { actualState: "active" as DeviceActualState, lastVerifiedAt: new Date().toISOString() };
  } catch (error: any) {
    return {
      actualState: "failed" as DeviceActualState,
      lastErrorCode: "verify_failed",
      lastErrorDetail: error.message,
    };
  }
}

async function applyAssignments(assignments: SyncAssignment[], removals: string[], state: CliState, dryRun: boolean) {
  const results: LocalArtifactState[] = [];
  const installedToolIds = new Set(detectTools().filter((tool) => tool.exists).map((tool) => tool.id));
  const instructionsByTool = new Map<string, string[]>();
  const inlineRulesByTool = new Map<string, string[]>();
  const mcpServersByTool = new Map<string, McpServer[]>();
  const desiredSkillRoots = new Set<string>();
  const desiredSkillsByTool = new Map<string, Set<string>>();
  const desiredAgents = new Set<string>();
  const desiredClaudeRules = new Set<string>();
  const desiredCursorRules = new Set<string>();

  for (const assignment of assignments) {
    const releaseId = assignment.release.id;
    const currentState: LocalArtifactState = state.artifactStates[releaseId] || {
      artifactReleaseId: releaseId,
      desiredState: "active",
      actualState: "pending",
      lastTransitionAt: new Date().toISOString(),
    };

    try {
      currentState.desiredState = assignment.desiredState;
      currentState.actualState = "installing";
      currentState.lastTransitionAt = new Date().toISOString();

      const installResult = await ensureAssignmentInstalled(assignment, dryRun);
      currentState.installRoot = installResult.installRoot;
      if (installResult.wrapperPath) currentState.wrapperPath = installResult.wrapperPath;

      for (const binding of assignment.release.manifest.bindings) {
        const bindingContent = resolveBindingContent(assignment);
        if (binding.bindingType === "instructions") {
          const blocks = instructionsByTool.get(binding.tool) || [];
          blocks.push(renderInstructionBlock(assignment));
          instructionsByTool.set(binding.tool, blocks);
        } else if (binding.bindingType === "rule" && binding.tool === "cursor" && binding.configJson?.inline === true) {
          const blocks = inlineRulesByTool.get(binding.tool) || [];
          blocks.push(renderInstructionBlock(assignment));
          inlineRulesByTool.set(binding.tool, blocks);
        } else if (binding.bindingType === "mcp") {
          const servers = mcpServersByTool.get(binding.tool) || [];
          servers.push({
            name: String(binding.configJson?.serverName || assignment.artifact.slug),
            command: installResult.wrapperPath || assignment.release.manifest.launch?.command || "",
            args: Array.isArray(binding.configJson?.args) ? binding.configJson?.args as string[] : assignment.release.manifest.launch?.args || [],
            env: Object.fromEntries(
              (assignment.release.manifest.launch?.env || [])
                .map((field) => [
                  field.name,
                  assignment.resolvedSecrets[field.name] ?? field.defaultValue ?? "",
                ])
                .filter(([, value]) => value !== "")
            ),
            _managed_by: "lfc",
          });
          mcpServersByTool.set(binding.tool, servers);
        } else if (binding.bindingType === "skill") {
          desiredSkillRoots.add(assignment.artifact.slug);
          const desiredForTool = desiredSkillsByTool.get(binding.tool) || new Set<string>();
          desiredForTool.add(assignment.artifact.slug);
          desiredSkillsByTool.set(binding.tool, desiredForTool);
          console.log(writeSkill(binding.tool, assignment.artifact.slug, bindingContent, dryRun));
        } else if (binding.bindingType === "agent") {
          desiredAgents.add(assignment.artifact.slug);
          console.log(writeAgent(binding.tool, assignment.artifact.slug, bindingContent, dryRun));
        } else if (binding.bindingType === "rule") {
          if (binding.tool === "cursor") desiredCursorRules.add(assignment.artifact.slug);
          if (binding.tool === "claude-code") desiredClaudeRules.add(assignment.artifact.slug);
          console.log(writeRule(binding.tool, assignment.artifact.slug, bindingContent, dryRun));
        }
      }

      const verification = verifyAssignment(assignment, installResult.wrapperPath, dryRun);
      currentState.actualState = verification.actualState;
      currentState.lastVerifiedAt = verification.lastVerifiedAt;
      currentState.lastErrorCode = verification.lastErrorCode;
      currentState.lastErrorDetail = verification.lastErrorDetail;
      currentState.lastTransitionAt = new Date().toISOString();
    } catch (error: any) {
      currentState.actualState = error.code === "missing_python" ? "failed_prerequisites" : "failed";
      currentState.lastErrorCode = error.code || "install_failed";
      currentState.lastErrorDetail = error.message;
      currentState.lastTransitionAt = new Date().toISOString();
      logLocalEvent(state, {
        at: currentState.lastTransitionAt,
        artifactReleaseId: releaseId,
        eventType: "install_failed",
        detail: error.message,
      });
    }

    state.artifactStates[releaseId] = currentState;
    results.push(currentState);
  }

  for (const tool of ["claude-code", "codex"]) {
    const markdownPath =
      tool === "claude-code" ? path.join(os.homedir(), ".claude/CLAUDE.md")
      : path.join(os.homedir(), "AGENTS.md");
    if ((instructionsByTool.get(tool) || []).length > 0 || hasManagedMarkdownBlock(markdownPath)) {
      console.log(writeMarkdownConfig(tool, (instructionsByTool.get(tool) || []).join("\n\n"), dryRun));
    }
  }
  if ((inlineRulesByTool.get("cursor") || []).length > 0 || hasManagedMarkdownBlock(path.join(os.homedir(), ".cursorrules"))) {
    console.log(writeCursorRules((inlineRulesByTool.get("cursor") || []).join("\n\n"), dryRun));
  }
  for (const tool of Object.keys(MCP_PATHS)) {
    if ((mcpServersByTool.get(tool) || []).length > 0 || hasManagedMcpEntries(tool)) {
      console.log(writeMcpConfig(tool, mcpServersByTool.get(tool) || [], dryRun));
    }
  }

  const removedSkillRoots = removeManagedSkillRoots(desiredSkillRoots, dryRun);
  const removedSkillLinks = ["claude-code", "codex", "cursor", "windsurf", "opencode"]
    .flatMap((toolId) => removeManagedSkillLinks(toolId, desiredSkillsByTool.get(toolId) || new Set<string>(), dryRun));
  const removedAgents = removeManagedAgents(desiredAgents, dryRun);
  const removedClaudeRules = removeManagedRules("claude-code", desiredClaudeRules, dryRun);
  const removedCursorRules = removeManagedRules("cursor", desiredCursorRules, dryRun);
  const removedInstalls = cleanupArtifactInstalls(new Set(assignments.map((assignment) => assignment.release.id)), dryRun);

  for (const removed of [...removedSkillRoots, ...removedSkillLinks, ...removedAgents, ...removedClaudeRules, ...removedCursorRules, ...removedInstalls]) {
    console.log(`  [cleanup] ${removed}`);
  }

  for (const releaseId of removals) {
    delete state.artifactStates[releaseId];
  }

  return results;
}

async function syncDevice(config: CliConfig, state: CliState, dryRun: boolean) {
  if (!config.deviceId) {
    const registration = await registerDevice(config);
    console.log(`Registered device ${registration.device.name} (${registration.device.id})`);
  }

  const detectedTools = detectTools().map((tool) => ({
    tool: tool.id,
    installed: tool.exists,
  }));

  const response = await apiRequest(config, "POST", `/api/devices/${config.deviceId}/sync`, {
    detectedTools,
    states: Object.values(state.artifactStates),
    inventory: buildInventorySnapshot(),
  }) as DeviceSyncResponse;

  console.log(`Server time: ${response.serverTime}`);
  console.log(`Assignments: ${response.assignments.length}`);
  if (response.removals.length > 0) {
    console.log(`Removals: ${response.removals.join(", ")}`);
  }

  const appliedStates = await applyAssignments(response.assignments, response.removals, state, dryRun);
  const checks = appliedStates
    .filter((artifactState) => artifactState.actualState === "active" || artifactState.actualState === "config_applied_unverified")
    .map((artifactState) => ({
      artifactReleaseId: artifactState.artifactReleaseId,
      result: artifactState.actualState === "active" ? "pass" : "unknown",
      durationMs: 0,
      detailsJson: null,
    }));

  if (!dryRun && checks.length > 0) {
    await apiRequest(config, "POST", `/api/devices/${config.deviceId}/health`, { checks });
  }

  saveState(state);
}

function cmdDoctor() {
  console.log("\nRuntime doctor:\n");
  for (const [command, args] of [["node", ["--version"]], ["npm", ["--version"]], ["python3", ["--version"]], ["docker", ["--version"]]] as const) {
    const result = spawnSync(command, args, { encoding: "utf-8", stdio: "pipe" });
    if (result.status === 0) {
      console.log(`  [ok] ${command}: ${(result.stdout || result.stderr).trim()}`);
    } else {
      console.log(`  [missing] ${command}`);
    }
  }
  console.log("");
}

function cmdEvents() {
  const state = loadState();
  console.log("\nRecent local events:\n");
  if (state.events.length === 0) {
    console.log("  (none)\n");
    return;
  }
  for (const event of state.events.slice(0, 20)) {
    console.log(`  ${event.at}  ${event.eventType}${event.artifactReleaseId ? `  ${event.artifactReleaseId}` : ""}${event.detail ? `  ${event.detail}` : ""}`);
  }
  console.log("");
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
    config.orgId = data.user.orgId || null;
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
  const state = loadState();
  console.log("\n--- LFC Client Status ---\n");
  console.log(`API:   ${config.apiUrl}`);
  console.log(`User:  ${config.email || "(not logged in)"}`);
  console.log(`Token: ${config.token ? config.token.slice(0, 20) + "..." : "(none)"}`);
  console.log(`Org:   ${config.orgId || "(none)"}`);
  console.log(`Device:${config.deviceId || "(not registered)"}`);
  console.log(`States:${Object.keys(state.artifactStates).length}`);

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
  const state = loadState();
  if (!config.token) {
    console.error("Not logged in. Run: pnpm --filter cli lfc login");
    process.exit(1);
  }

  try {
    console.log(dryRun ? "\n[dry-run] Sync preview:\n" : "\nSyncing artifacts...\n");
    await syncDevice(config, state, dryRun);
    console.log(dryRun ? "\nDry run complete.\n" : "\nArtifact sync complete.\n");
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
  case "logout": {
    const config = loadConfig();
    config.token = null;
    config.email = null;
    config.orgId = null;
    config.deviceId = null;
    saveConfig(config);
    console.log("\nLogged out.\n");
    break;
  }
  case "device":
    if (args[1] === "register") {
      registerDevice(loadConfig())
        .then((result) => {
          console.log(`\nRegistered device ${result.device.name} (${result.device.id})\n`);
        })
        .catch((error) => {
          console.error(`Device registration failed: ${error.message}`);
          process.exit(1);
        });
      break;
    }
    console.log("\nUsage: pnpm --filter cli lfc device register\n");
    break;
  case "sync":
  case "sync-v2":
    cmdSync(dryRun);
    break;
  case "status":
    cmdStatus();
    break;
  case "doctor":
    cmdDoctor();
    break;
  case "events":
    cmdEvents();
    break;
  case "reset":
    resetConfigs(dryRun);
    break;
  default:
    console.log(`
LFC CLI — artifact sync client

Commands:
  login                Login to LFC API
  logout               Clear local auth and device state
  device register      Register this machine as an LFC device
  sync                 Sync artifact assignments to local tool files
  sync --dry-run       Preview what would change without writing
  sync-v2              Alias for sync
  status               Show detected tools, device, and local state
  doctor               Check local runtime prerequisites
  events               Show recent local install events
  reset                Remove all lfc-managed config entries
  reset --dry-run      Preview what would be removed

Usage:
  pnpm --filter cli lfc login
  pnpm --filter cli lfc device register
  pnpm --filter cli lfc sync --dry-run
  pnpm --filter cli lfc sync
`);
}
