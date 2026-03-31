export type BindingScope = "user" | "project";

export function resolveBindingScope(
  tool: string,
  bindingType: string,
  explicitScope?: string | null
): BindingScope {
  if (explicitScope === "project" || explicitScope === "user") {
    return explicitScope;
  }

  if (tool === "codex" && bindingType === "instructions") {
    return "project";
  }

  return "user";
}

export function bindingScopeLabel(scope: BindingScope): string {
  return scope === "project" ? "Project" : "Global";
}

export function bindingScopeDescription(tool: string, bindingType: string): string {
  const scope = resolveBindingScope(tool, bindingType);

  if (scope === "project") {
    return "Shared once through a project file.";
  }

  if (bindingType === "skill") {
    return "Installed once in the shared global skills registry and linked into this tool.";
  }

  return "Stored once in this tool's shared user-level config.";
}
