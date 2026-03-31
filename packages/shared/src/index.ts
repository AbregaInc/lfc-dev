export type Tool =
  | "claude-desktop"
  | "claude-code"
  | "cursor"
  | "codex"
  | "windsurf"
  | "opencode";

export type ArtifactKind =
  | "instructions"
  | "rule"
  | "agent"
  | "skill"
  | "mcp"
  | "plugin";

export type ReliabilityTier = "managed" | "best_effort" | "unreliable";

export type SourceType =
  | "inline_files"
  | "npm"
  | "pypi"
  | "binary"
  | "docker"
  | "marketplace"
  | "raw_command"
  | "raw_path";

export type RuntimeKind = "none" | "node" | "python" | "docker" | "native";

export type InstallStrategy =
  | "copy_files"
  | "npm_package"
  | "python_package"
  | "download_binary"
  | "pull_image"
  | "write_config_only";

export type ArtifactReleaseStatus = "draft" | "approved" | "deprecated" | "archived";

export type BindingType = "instructions" | "rule" | "agent" | "skill" | "mcp" | "plugin";
export type BindingScope = "user" | "project";

export type RolloutStrategy = "all_at_once" | "canary" | "phased";

export type AssignmentState = "active" | "removed";

export type DeviceActualState =
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

export interface ToolPath {
  tool: Tool;
  bindingType: BindingType;
  mac: string;
  windows: string;
  format: "json" | "markdown" | "toml" | "directory";
  scope: "user" | "project";
}

export const FILE_MAP: ToolPath[] = [
  {
    tool: "claude-desktop",
    bindingType: "mcp",
    mac: "~/Library/Application Support/Claude/claude_desktop_config.json",
    windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
    format: "json",
    scope: "user",
  },
  {
    tool: "claude-code",
    bindingType: "mcp",
    mac: "~/.claude.json",
    windows: "~/.claude.json",
    format: "json",
    scope: "user",
  },
  {
    tool: "claude-code",
    bindingType: "instructions",
    mac: "~/.claude/CLAUDE.md",
    windows: "~/.claude/CLAUDE.md",
    format: "markdown",
    scope: "user",
  },
  {
    tool: "claude-code",
    bindingType: "skill",
    mac: "~/.claude/skills/",
    windows: "~/.claude/skills/",
    format: "directory",
    scope: "user",
  },
  {
    tool: "codex",
    bindingType: "skill",
    mac: "~/.codex/skills/",
    windows: "~/.codex/skills/",
    format: "directory",
    scope: "user",
  },
  {
    tool: "cursor",
    bindingType: "skill",
    mac: "~/.cursor/skills/",
    windows: "~/.cursor/skills/",
    format: "directory",
    scope: "user",
  },
  {
    tool: "windsurf",
    bindingType: "skill",
    mac: "~/.codeium/windsurf/skills/",
    windows: "~/.codeium/windsurf/skills/",
    format: "directory",
    scope: "user",
  },
  {
    tool: "opencode",
    bindingType: "skill",
    mac: "~/.opencode/skills/",
    windows: "~/.opencode/skills/",
    format: "directory",
    scope: "user",
  },
  {
    tool: "claude-code",
    bindingType: "agent",
    mac: "~/.claude/agents/",
    windows: "~/.claude/agents/",
    format: "directory",
    scope: "user",
  },
  {
    tool: "claude-code",
    bindingType: "rule",
    mac: "~/.claude/rules/",
    windows: "~/.claude/rules/",
    format: "directory",
    scope: "user",
  },
  {
    tool: "cursor",
    bindingType: "mcp",
    mac: "~/.cursor/mcp.json",
    windows: "~/.cursor/mcp.json",
    format: "json",
    scope: "user",
  },
  {
    tool: "cursor",
    bindingType: "rule",
    mac: "~/.cursorrules / ~/.cursor/rules/",
    windows: "~/.cursorrules / ~/.cursor/rules/",
    format: "markdown",
    scope: "user",
  },
  {
    tool: "codex",
    bindingType: "instructions",
    mac: "./AGENTS.md",
    windows: "./AGENTS.md",
    format: "markdown",
    scope: "project",
  },
  {
    tool: "windsurf",
    bindingType: "mcp",
    mac: "~/.codeium/windsurf/mcp_config.json",
    windows: "~/.codeium/windsurf/mcp_config.json",
    format: "json",
    scope: "user",
  },
];

export interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  orgId: string | null;
  role: "admin" | "member";
  createdAt: string;
}

export interface Profile {
  id: string;
  orgId: string;
  name: string;
  description?: string | null;
  tools: Tool[];
  createdAt: string;
  updatedAt: string;
}

export interface Secret {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface InviteLink {
  id: string;
  orgId: string;
  code: string;
  expiresAt?: string | null;
  createdAt: string;
}

export interface ArtifactFile {
  path: string;
  content: string;
  executable?: boolean;
  sha256?: string;
}

export interface ArtifactEnvField {
  name: string;
  required: boolean;
  secretRef?: string;
  defaultValue?: string;
}

export interface ArtifactBinding {
  id: string;
  artifactReleaseId: string;
  tool: Tool;
  bindingType: BindingType;
  scope?: BindingScope;
  targetPath?: string | null;
  configTemplate?: string | null;
  configJson?: Record<string, unknown> | null;
}

export interface ArtifactManifest {
  kind: ArtifactKind;
  reliabilityTier: ReliabilityTier;
  source: {
    type: SourceType;
    ref: string;
    version?: string;
    digest?: string;
    metadata?: Record<string, unknown>;
  };
  runtime: {
    kind: RuntimeKind;
    version?: string;
    provisionMode: "managed" | "system";
  };
  install: {
    strategy: InstallStrategy;
    managedRoot: string;
    wrapperName?: string;
  };
  launch?: {
    command: string;
    args: string[];
    env: ArtifactEnvField[];
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
    files?: ArtifactFile[];
    downloadUrl?: string;
    archiveUrl?: string;
    checksum?: string;
    image?: string;
    metadata?: Record<string, unknown>;
  };
  compatibility: {
    os: string[];
    arch: string[];
    tools: Tool[];
  };
  bindings: Array<{
    tool: Tool;
    bindingType: BindingType;
    scope?: BindingScope;
    targetPath?: string;
    configTemplate?: string;
    configJson?: Record<string, unknown>;
  }>;
}

export interface Artifact {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  description?: string | null;
  kind: ArtifactKind;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRelease {
  id: string;
  artifactId: string;
  version: string;
  status: ArtifactReleaseStatus;
  reliabilityTier: ReliabilityTier;
  sourceType: SourceType;
  sourceRef: string;
  sourceVersion?: string | null;
  digest?: string | null;
  manifest: ArtifactManifest;
  reviewNotes?: string | null;
  createdByUserId: string;
  approvedByUserId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
}

export interface ProfileArtifactAssignment {
  id: string;
  profileId: string;
  artifactReleaseId: string;
  desiredState: AssignmentState;
  rolloutStrategy: RolloutStrategy;
  rolloutJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactSubmission {
  id: string;
  orgId: string;
  userId: string;
  sourceDeviceId?: string | null;
  title: string;
  description?: string | null;
  status: "submitted" | "normalized" | "needs_packaging" | "approved" | "denied";
  artifactKind: ArtifactKind;
  sourceTool?: Tool | null;
  reliabilityTier?: ReliabilityTier | null;
  rawCaptureJson: Record<string, unknown>;
  normalizedReleaseId?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  platform: string;
  arch: string;
  clientKind: "tray" | "cli";
  clientVersion: string;
  status: "online" | "offline" | "error";
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTool {
  deviceId: string;
  tool: Tool;
  detectedVersion?: string | null;
  installed: boolean;
  details?: Record<string, unknown> | null;
  lastSeenAt: string;
}

export interface DeviceArtifactState {
  id: string;
  deviceId: string;
  artifactReleaseId: string;
  desiredState: AssignmentState;
  actualState: DeviceActualState;
  activationState?: string | null;
  installRoot?: string | null;
  wrapperPath?: string | null;
  previousReleaseId?: string | null;
  lastErrorCode?: string | null;
  lastErrorDetail?: string | null;
  inventoryJson?: Record<string, unknown> | null;
  lastVerifiedAt?: string | null;
  lastTransitionAt: string;
  updatedAt: string;
}

export interface DeviceInventorySnapshot {
  id: string;
  deviceId: string;
  snapshotJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactHealthCheck {
  id: string;
  deviceId: string;
  artifactReleaseId: string;
  result: "pass" | "fail" | "unknown";
  durationMs?: number | null;
  detailsJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface DeviceRegistrationRequest {
  name: string;
  platform: string;
  arch: string;
  clientKind: "tray" | "cli";
  clientVersion: string;
  detectedTools: Array<{
    tool: Tool;
    detectedVersion?: string;
    installed: boolean;
    details?: Record<string, unknown>;
  }>;
}

export interface DeviceRegistrationResponse {
  device: Device;
  featureFlags: Record<string, boolean>;
}

export interface DeviceSyncStateInput {
  artifactReleaseId: string;
  desiredState: AssignmentState;
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

export interface DeviceSyncRequest {
  detectedTools: Array<{
    tool: Tool;
    detectedVersion?: string;
    installed: boolean;
    details?: Record<string, unknown>;
  }>;
  states: DeviceSyncStateInput[];
  inventory?: unknown;
}

export interface DeviceSyncAssignment {
  assignmentId: string;
  profileId: string;
  profileName: string;
  desiredState: AssignmentState;
  rolloutStrategy: RolloutStrategy;
  artifact: Artifact;
  release: ArtifactRelease;
  resolvedSecrets: Record<string, string>;
}

export interface DeviceSyncResponse {
  device: Device;
  assignments: DeviceSyncAssignment[];
  removals: string[];
  serverTime: string;
}

export const API_ROUTES = {
  register: "/api/auth/register",
  login: "/api/auth/login",
  me: "/api/auth/me",
  createOrg: "/api/orgs",
  getOrg: "/api/orgs/:orgId",
  listProfiles: "/api/orgs/:orgId/profiles",
  getProfile: "/api/orgs/:orgId/profiles/:profileId",
  listProfileArtifacts: "/api/orgs/:orgId/profiles/:profileId/artifacts",
  listArtifacts: "/api/orgs/:orgId/artifacts",
  getArtifact: "/api/orgs/:orgId/artifacts/:artifactId",
  listSubmissions: "/api/orgs/:orgId/submissions",
  listSecrets: "/api/orgs/:orgId/secrets",
  createInvite: "/api/orgs/:orgId/invites",
  acceptInvite: "/api/invites/:code",
  registerDevice: "/api/devices/register",
  syncDevice: "/api/devices/:deviceId/sync",
  listDevices: "/api/orgs/:orgId/devices",
  getAudit: "/api/orgs/:orgId/audit",
} as const;
