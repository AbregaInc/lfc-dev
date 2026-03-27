import { asArray, asRecord, slugify, uniqueStrings } from "./utils.js";

export type ArtifactKind = "instructions" | "rule" | "agent" | "skill" | "mcp" | "plugin";
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
export type InstallStrategy =
  | "copy_files"
  | "npm_package"
  | "python_package"
  | "download_binary"
  | "pull_image"
  | "write_config_only";

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
    kind: "none" | "node" | "python" | "docker" | "native";
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
    env: Array<{ name: string; required: boolean; secretRef?: string; defaultValue?: string }>;
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
    files?: Array<{ path: string; content: string; executable?: boolean; sha256?: string }>;
    downloadUrl?: string;
    archiveUrl?: string;
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
    bindingType: string;
    targetPath?: string;
    configTemplate?: string;
    configJson?: Record<string, unknown>;
  }>;
}

function baseManifest(kind: ArtifactKind, reliabilityTier: ReliabilityTier): ArtifactManifest {
  return {
    kind,
    reliabilityTier,
    source: { type: "inline_files", ref: kind },
    runtime: { kind: "none", provisionMode: "managed" },
    install: { strategy: "copy_files", managedRoot: "~/.lfc/artifacts" },
    verify: { type: "none" },
    compatibility: { os: ["darwin", "linux", "windows"], arch: ["x64", "arm64"], tools: [] },
    bindings: [],
  };
}

export function deriveReleaseFields(manifest: ArtifactManifest) {
  return {
    reliabilityTier: manifest.reliabilityTier,
    sourceType: manifest.source.type,
    sourceRef: manifest.source.ref,
    sourceVersion: manifest.source.version ?? null,
    digest: manifest.source.digest ?? manifest.payload?.checksum ?? null,
  };
}

export function secretRefsForManifest(manifest: ArtifactManifest): string[] {
  return uniqueStrings(
    (manifest.launch?.env || [])
      .map((envField) => envField.secretRef)
      .filter((value): value is string => Boolean(value))
  );
}

export function normalizeSubmissionCapture(input: Record<string, unknown>): {
  manifest: ArtifactManifest;
  reliabilityTier: ReliabilityTier;
  status: "normalized" | "needs_packaging";
  notes: string[];
  name: string;
  kind: ArtifactKind;
} {
  const kind = (input.kind as ArtifactKind) || "skill";
  const notes: string[] = [];
  const name = typeof input.name === "string" && input.name ? input.name : "Imported Artifact";
  const tool = typeof input.tool === "string" ? input.tool : typeof input.sourceTool === "string" ? input.sourceTool : "claude-code";
  const content = typeof input.content === "string" ? input.content : "";
  const files = asArray<Record<string, unknown>>(input.files);
  const envKeys = uniqueStrings(asArray<string>(input.envKeys));
  const envSchema = envKeys.map((key) => ({ name: key, required: false, secretRef: key }));

  if (kind !== "mcp" && kind !== "plugin") {
    const manifest = baseManifest(kind, "managed");
    const bindingType = kind === "instructions" ? "instructions" : kind;
    manifest.source = { type: "inline_files", ref: `inline:${slugify(name)}` };
    manifest.install = { strategy: "copy_files", managedRoot: "~/.lfc/artifacts" };
    manifest.payload = {
      files:
        files.length > 0
          ? files.map((file) => ({
              path: typeof file.path === "string" ? file.path : `${bindingType}.md`,
              content: typeof file.content === "string" ? file.content : "",
              executable: Boolean(file.executable),
            }))
          : [{ path: `${bindingType}.md`, content }],
    };
    manifest.compatibility.tools = [tool];
    manifest.bindings = [{ tool, bindingType }];
    return {
      manifest,
      reliabilityTier: "managed",
      status: "normalized",
      notes,
      name,
      kind,
    };
  }

  if (kind === "plugin") {
    const manifest = baseManifest("plugin", "unreliable");
    manifest.source = {
      type: "marketplace",
      ref: typeof input.marketplaceId === "string" ? input.marketplaceId : name,
      version: typeof input.version === "string" ? input.version : undefined,
      metadata: asRecord(input.metadata),
    };
    manifest.install = { strategy: "write_config_only", managedRoot: "~/.lfc/artifacts" };
    manifest.compatibility.tools = [tool];
    manifest.bindings = [{ tool, bindingType: "plugin" }];
    notes.push("Plugin install path is vendor-specific, so this submission is marked unreliable.");
    return {
      manifest,
      reliabilityTier: "unreliable",
      status: "needs_packaging",
      notes,
      name,
      kind,
    };
  }

  const serverName =
    typeof input.serverName === "string" && input.serverName.length > 0
      ? input.serverName
      : slugify(name).replace(/-/g, "_");
  const mcpArgs = asArray<string>(input.args).filter((value): value is string => typeof value === "string");
  const command = typeof input.command === "string" ? input.command : "";
  const normalizedPackage = typeof input.packageName === "string" ? input.packageName : "";
  const normalizedVersion = typeof input.packageVersion === "string" ? input.packageVersion : "";
  const binaryName = typeof input.binaryName === "string" ? input.binaryName : "";
  const downloadUrl = typeof input.downloadUrl === "string" ? input.downloadUrl : "";
  const pythonPackage = typeof input.pythonPackage === "string" ? input.pythonPackage : "";
  const pythonVersion = typeof input.pythonVersion === "string" ? input.pythonVersion : "";
  const pythonEntrypoint = typeof input.entrypoint === "string" ? input.entrypoint : "";
  const dockerImage = typeof input.image === "string" ? input.image : "";
  const dockerEntrypoint = typeof input.dockerEntrypoint === "string" ? input.dockerEntrypoint : "";

  if (normalizedPackage && normalizedVersion && binaryName) {
    const manifest = baseManifest("mcp", "managed");
    manifest.source = { type: "npm", ref: normalizedPackage, version: normalizedVersion };
    manifest.runtime = { kind: "node", version: ">=18", provisionMode: "system" };
    manifest.install = {
      strategy: "npm_package",
      managedRoot: "~/.lfc/artifacts",
      wrapperName: slugify(name),
    };
    manifest.launch = {
      command: binaryName,
      args: mcpArgs,
      env: envSchema,
    };
    manifest.verify = {
      type: "exec",
      command: binaryName,
      args: ["--help"],
      expectedExitCode: 0,
      timeoutMs: 5000,
    };
    manifest.compatibility.tools = [tool];
    manifest.bindings = [
      {
        tool,
        bindingType: "mcp",
        configJson: { serverName, args: mcpArgs },
      },
    ];
    return {
      manifest,
      reliabilityTier: "managed",
      status: "normalized",
      notes,
      name,
      kind,
    };
  }

  if (downloadUrl && binaryName) {
    const manifest = baseManifest("mcp", "managed");
    manifest.source = { type: "binary", ref: downloadUrl, digest: typeof input.checksum === "string" ? input.checksum : undefined };
    manifest.runtime = { kind: "native", provisionMode: "managed" };
    manifest.install = {
      strategy: "download_binary",
      managedRoot: "~/.lfc/artifacts",
      wrapperName: slugify(name),
    };
    manifest.launch = { command: binaryName, args: mcpArgs, env: envSchema };
    manifest.payload = { downloadUrl, checksum: typeof input.checksum === "string" ? input.checksum : undefined };
    manifest.compatibility.tools = [tool];
    manifest.bindings = [{ tool, bindingType: "mcp", configJson: { serverName, args: mcpArgs } }];
    notes.push("Binary downloads are deterministic only if the checksum remains stable.");
    return {
      manifest,
      reliabilityTier: "managed",
      status: "normalized",
      notes,
      name,
      kind,
    };
  }

  if (pythonPackage && pythonVersion && pythonEntrypoint) {
    const manifest = baseManifest("mcp", "best_effort");
    manifest.source = { type: "pypi", ref: pythonPackage, version: pythonVersion };
    manifest.runtime = { kind: "python", version: ">=3.10", provisionMode: "system" };
    manifest.install = {
      strategy: "python_package",
      managedRoot: "~/.lfc/artifacts",
      wrapperName: slugify(name),
    };
    manifest.launch = { command: pythonEntrypoint, args: mcpArgs, env: envSchema };
    manifest.compatibility.tools = [tool];
    manifest.bindings = [{ tool, bindingType: "mcp", configJson: { serverName, args: mcpArgs } }];
    notes.push("Python MCPs require a compatible system Python runtime on every machine.");
    return {
      manifest,
      reliabilityTier: "best_effort",
      status: "normalized",
      notes,
      name,
      kind,
    };
  }

  if (dockerImage && dockerEntrypoint) {
    const manifest = baseManifest("mcp", "best_effort");
    manifest.source = { type: "docker", ref: dockerImage, version: typeof input.imageDigest === "string" ? input.imageDigest : undefined };
    manifest.runtime = { kind: "docker", provisionMode: "system" };
    manifest.install = {
      strategy: "pull_image",
      managedRoot: "~/.lfc/artifacts",
      wrapperName: slugify(name),
    };
    manifest.launch = { command: dockerEntrypoint, args: mcpArgs, env: envSchema };
    manifest.payload = { image: dockerImage, metadata: { imageDigest: input.imageDigest ?? null } };
    manifest.compatibility.tools = [tool];
    manifest.bindings = [{ tool, bindingType: "mcp", configJson: { serverName, args: mcpArgs } }];
    notes.push("Docker-based MCPs require the Docker daemon to be available on client machines.");
    return {
      manifest,
      reliabilityTier: "best_effort",
      status: "normalized",
      notes,
      name,
      kind,
    };
  }

  const manifest = baseManifest("mcp", command.startsWith("/") || command.startsWith("~") ? "unreliable" : "unreliable");
  manifest.source = {
    type: command.startsWith("/") || command.startsWith("~") ? "raw_path" : "raw_command",
    ref: command || "unknown-command",
    metadata: { args: mcpArgs },
  };
  manifest.runtime = { kind: "native", provisionMode: "system" };
  manifest.install = {
    strategy: "write_config_only",
    managedRoot: "~/.lfc/artifacts",
    wrapperName: slugify(name),
  };
  manifest.launch = { command, args: mcpArgs, env: envSchema };
  manifest.compatibility.tools = [tool];
  manifest.bindings = [{ tool, bindingType: "mcp", configJson: { serverName, args: mcpArgs } }];

  if (command === "npx" || command === "npm" || command === "pnpm" || command === "uvx") {
    notes.push("This MCP depends on a package manager at runtime and is marked unreliable.");
  } else if (manifest.source.type === "raw_path") {
    notes.push("This MCP references a local path, so it may not exist on other machines.");
  } else {
    notes.push("This MCP could not be normalized to a typed installer and is marked unreliable.");
  }

  return {
    manifest,
    reliabilityTier: "unreliable",
    status: "needs_packaging",
    notes,
    name,
    kind,
  };
}
