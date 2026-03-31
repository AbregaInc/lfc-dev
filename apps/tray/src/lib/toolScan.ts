export type DistributionScope = "shared" | "tool";

export interface ScannedMcp {
  name: string;
  command: string;
  args: string[];
  managed: boolean;
}

export interface ScannedItem {
  name: string;
  managed: boolean;
  preview: string;
  scope?: string;
  supportedTools?: string[];
  path?: string;
  distributionScope?: DistributionScope;
}

export interface ScannedMarkdown {
  path: string;
  hasManagedBlock: boolean;
  userContentLines: number;
  managedContentLines: number;
}

export interface ToolScan {
  id: string;
  name: string;
  installed: boolean;
  mcpServers: ScannedMcp[];
  skills: ScannedItem[];
  agents: ScannedItem[];
  rules: ScannedItem[];
  instructions: ScannedMarkdown | null;
}

export function toolScopedSkills(scan: ToolScan): ScannedItem[] {
  return scan.skills.filter((skill) => !isSharedSkill(skill));
}

export function sharedRegistrySkills(scans: ToolScan[]): ScannedItem[] {
  const merged = new Map<string, ScannedItem>();

  for (const scan of scans) {
    for (const skill of scan.skills.filter((item) => isSharedSkill(item))) {
      const existing = merged.get(skill.name);
      if (existing) {
        existing.managed = existing.managed || skill.managed;
        existing.preview ||= skill.preview;
        existing.path ||= skill.path;
        existing.scope ||= skill.scope;
        existing.supportedTools = Array.from(
          new Set([...(existing.supportedTools || []), ...(skill.supportedTools || [])])
        ).sort((left, right) => left.localeCompare(right));
        existing.distributionScope = "shared";
        continue;
      }

      merged.set(skill.name, {
        ...skill,
        distributionScope: "shared",
        supportedTools: [...(skill.supportedTools || [])].sort((left, right) =>
          left.localeCompare(right)
        ),
      });
    }
  }

  return [...merged.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  );
}

export function sharedRegistryMetrics(scans: ToolScan[]) {
  const skills = sharedRegistrySkills(scans);
  const managedItems = skills.filter((skill) => skill.managed).length;
  const supportedTools = Array.from(
    new Set(skills.flatMap((skill) => skill.supportedTools || []))
  ).sort((left, right) => left.localeCompare(right));

  return {
    totalItems: skills.length,
    managedItems,
    unmanagedItems: Math.max(skills.length - managedItems, 0),
    supportedTools,
  };
}

export function toolSummary(scan: ToolScan): string {
  const parts: string[] = [];
  const sharedSkills = scan.skills.filter((skill) => isSharedSkill(skill)).length;
  if (scan.mcpServers.length > 0) {
    parts.push(`${scan.mcpServers.length} MCP server${scan.mcpServers.length !== 1 ? "s" : ""}`);
  }
  const toolSkills = toolScopedSkills(scan);
  if (toolSkills.length > 0) {
    parts.push(`${toolSkills.length} skill${toolSkills.length !== 1 ? "s" : ""}`);
  }
  if (scan.rules.length > 0) {
    parts.push(`${scan.rules.length} rule${scan.rules.length !== 1 ? "s" : ""}`);
  }
  if (scan.instructions) {
    parts.push("instructions");
  }
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return sharedSkills > 0 ? "Shared registry only" : "No artifacts detected";
}

export function toolConfigSummary(scan: ToolScan): string {
  const parts: string[] = [];
  const managedMcp = scan.mcpServers.filter((server) => server.managed).length;
  const totalMcp = scan.mcpServers.length;
  const toolSkills = toolScopedSkills(scan);
  const sharedSkills = scan.skills.filter((skill) => isSharedSkill(skill)).length;

  if (totalMcp > 0) {
    parts.push(`${totalMcp} MCP${managedMcp > 0 ? ` (${managedMcp} managed)` : ""}`);
  }
  if (toolSkills.length > 0) {
    const managedToolSkills = toolSkills.filter((skill) => skill.managed).length;
    parts.push(
      `${toolSkills.length} skill${toolSkills.length !== 1 ? "s" : ""}${
        managedToolSkills > 0 ? ` (${managedToolSkills} managed)` : ""
      }`
    );
  }
  if (scan.rules.length > 0) {
    parts.push(`${scan.rules.length} rule${scan.rules.length !== 1 ? "s" : ""}`);
  }
  if (scan.agents.length > 0) {
    parts.push(`${scan.agents.length} agent${scan.agents.length !== 1 ? "s" : ""}`);
  }
  if (scan.instructions) {
    parts.push("instructions");
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }
  return sharedSkills > 0 ? "Shared registry only" : "No artifacts";
}

export function isSharedSkill(item: Pick<ScannedItem, "distributionScope" | "path" | "supportedTools">): boolean {
  if (item.distributionScope) {
    return item.distributionScope === "shared";
  }

  if (item.path?.includes("/.agents/skills/") || item.path?.includes("\\.agents\\skills\\")) {
    return true;
  }

  return (item.supportedTools?.length || 0) > 1;
}

export function skillAvailabilityLabel(item: Pick<ScannedItem, "distributionScope" | "path" | "supportedTools">): string {
  return isSharedSkill(item) ? "Shared" : "Tool only";
}

export function toolInventoryMetrics(scan: ToolScan) {
  const sharedSkills = scan.skills.filter((skill) => isSharedSkill(skill)).length;
  const toolSkills = toolScopedSkills(scan).length;
  const managedItems =
    scan.mcpServers.filter((server) => server.managed).length +
    toolScopedSkills(scan).filter((skill) => skill.managed).length +
    scan.agents.filter((agent) => agent.managed).length +
    scan.rules.filter((rule) => rule.managed).length +
    (scan.instructions?.hasManagedBlock ? 1 : 0);
  const totalItems =
    scan.mcpServers.length +
    toolSkills +
    scan.agents.length +
    scan.rules.length +
    (scan.instructions ? 1 : 0);
  const unmanagedItems = Math.max(totalItems - managedItems, 0);

  return {
    sharedSkills,
    toolSkills,
    managedItems,
    totalItems,
    unmanagedItems,
  };
}

export function sharedSkillPreview(scan: ToolScan, limit = 3): string | null {
  const names = scan.skills
    .filter((skill) => isSharedSkill(skill))
    .map((skill) => skill.name)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));

  if (names.length === 0) {
    return null;
  }

  const visible = names.slice(0, limit);
  const remaining = names.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")} +${remaining}` : visible.join(", ");
}

export function sharedRegistryPreview(scans: ToolScan[], limit = 4): string | null {
  const names = sharedRegistrySkills(scans).map((skill) => skill.name);

  if (names.length === 0) {
    return null;
  }

  const visible = names.slice(0, limit);
  const remaining = names.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")} +${remaining}` : visible.join(", ");
}
