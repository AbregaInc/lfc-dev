// LFC Shared Types

// ─── Tools & File Map ───────────────────────────────────────────────

export type Tool = "claude-desktop" | "claude-code" | "cursor" | "codex" | "windsurf" | "opencode";

export type ConfigType = "mcp" | "instructions" | "skills" | "settings" | "agents" | "rules";

export interface ToolPath {
  tool: Tool;
  configType: ConfigType;
  mac: string;
  windows: string;
  format: "json" | "markdown" | "toml";
  scope: "user" | "project";
}

/** The canonical file map — where each tool reads its config */
export const FILE_MAP: ToolPath[] = [
  { tool: "claude-desktop", configType: "mcp", mac: "~/Library/Application Support/Claude/claude_desktop_config.json", windows: "%APPDATA%\\Claude\\claude_desktop_config.json", format: "json", scope: "user" },
  { tool: "claude-code", configType: "mcp", mac: "~/.claude.json", windows: "~/.claude.json", format: "json", scope: "user" },
  { tool: "claude-code", configType: "instructions", mac: "~/.claude/CLAUDE.md", windows: "~/.claude/CLAUDE.md", format: "markdown", scope: "user" },
  { tool: "claude-code", configType: "settings", mac: "~/.claude/settings.json", windows: "~/.claude/settings.json", format: "json", scope: "user" },
  { tool: "claude-code", configType: "skills", mac: "~/.claude/skills/", windows: "~/.claude/skills/", format: "markdown", scope: "user" },
  { tool: "claude-code", configType: "agents", mac: "~/.claude/agents/", windows: "~/.claude/agents/", format: "markdown", scope: "user" },
  { tool: "cursor", configType: "mcp", mac: "~/.cursor/mcp.json", windows: "~/.cursor/mcp.json", format: "json", scope: "user" },
  { tool: "codex", configType: "instructions", mac: "./AGENTS.md", windows: "./AGENTS.md", format: "markdown", scope: "project" },
  { tool: "windsurf", configType: "mcp", mac: "~/.codeium/windsurf/mcp_config.json", windows: "~/.codeium/windsurf/mcp_config.json", format: "json", scope: "user" },
];

// ─── MCP Server Definition ──────────────────────────────────────────

export interface McpServerDef {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Secret references like {{SECRET_NAME}} that get resolved at sync time */
  envSecrets?: Record<string, string>;
}

// ─── Org / User / Profile ───────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: "admin" | "member";
  createdAt: string;
}

export interface Profile {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  /** Which tools this profile targets */
  tools: Tool[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileConfig {
  id: string;
  profileId: string;
  configType: ConfigType;
  /** The actual config content — JSON string for mcp/settings, markdown for instructions/skills */
  content: string;
  version: number;
  updatedAt: string;
}

// ─── Secrets ────────────────────────────────────────────────────────

export interface Secret {
  id: string;
  orgId: string;
  name: string;
  /** Never returned in API responses — only a reference */
  createdAt: string;
  updatedAt: string;
}

// ─── Sync Protocol ──────────────────────────────────────────────────

export interface SyncRequest {
  /** Tools detected on the user's machine */
  installedTools: Tool[];
  /** Current config versions the agent has (for diffing) */
  currentVersions: Record<string, number>;
}

export interface SyncResponse {
  /** Configs that need updating */
  configs: SyncConfigItem[];
  /** Secrets needed for these configs (encrypted) */
  secrets: Record<string, string>;
}

export interface SyncConfigItem {
  profileId: string;
  profileName: string;
  configType: ConfigType;
  /** Tool-agnostic content */
  content: string;
  version: number;
  /** Which tools to write this config to */
  targetTools: Tool[];
}

// ─── Invite ─────────────────────────────────────────────────────────

export interface InviteLink {
  id: string;
  orgId: string;
  code: string;
  expiresAt?: string;
  createdAt: string;
}

// ─── API Routes ─────────────────────────────────────────────────────

export const API_ROUTES = {
  // Auth
  register: "/api/auth/register",
  login: "/api/auth/login",
  me: "/api/auth/me",

  // Org
  createOrg: "/api/orgs",
  getOrg: "/api/orgs/:orgId",

  // Profiles
  listProfiles: "/api/orgs/:orgId/profiles",
  createProfile: "/api/orgs/:orgId/profiles",
  getProfile: "/api/orgs/:orgId/profiles/:profileId",
  updateProfile: "/api/orgs/:orgId/profiles/:profileId",

  // Profile Configs
  listProfileConfigs: "/api/orgs/:orgId/profiles/:profileId/configs",
  upsertProfileConfig: "/api/orgs/:orgId/profiles/:profileId/configs",
  deleteProfileConfig: "/api/orgs/:orgId/profiles/:profileId/configs/:configId",

  // Secrets
  listSecrets: "/api/orgs/:orgId/secrets",
  createSecret: "/api/orgs/:orgId/secrets",
  deleteSecret: "/api/orgs/:orgId/secrets/:secretId",

  // Invite
  createInvite: "/api/orgs/:orgId/invites",
  acceptInvite: "/api/invites/:code",

  // Sync (agent endpoint)
  sync: "/api/sync",

  // Users
  listUsers: "/api/orgs/:orgId/users",
} as const;
