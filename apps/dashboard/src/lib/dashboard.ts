import type { Device, ReliabilityTier } from "@/lib/api";
import type { StatusTone } from "@/components/StatusBadge";

export const TOOL_OPTIONS = [
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  { value: "codex", label: "Codex" },
  { value: "windsurf", label: "Windsurf" },
  { value: "opencode", label: "OpenCode" },
] as const;

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOL_OPTIONS.map((tool) => [tool.value, tool.label])
);

export function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function reliabilityTone(tier?: ReliabilityTier | string | null): StatusTone {
  switch (tier) {
    case "managed":
      return "success";
    case "best_effort":
      return "warning";
    case "unreliable":
    default:
      return "danger";
  }
}

export function releaseStateTone(state: string): { tone: StatusTone; label: string } {
  if (state === "active") return { tone: "success", label: "Active" };
  if (state === "config_applied_unverified") return { tone: "warning", label: "Staged" };
  if (state === "pending") return { tone: "neutral", label: "Pending" };
  if (state.startsWith("failed")) return { tone: "danger", label: "Failed" };
  return { tone: "neutral", label: state.replace(/_/g, " ") };
}

export function submissionStatusTone(status: string): StatusTone {
  if (status === "approved") return "success";
  if (status === "denied") return "danger";
  if (status === "needs_packaging") return "warning";
  return "info";
}

export function machineDisplayName(device: Device): string {
  const explicitMachineId = readInventoryString(device.inventory?.snapshot, ["machineId", "machine_id"]);
  if (explicitMachineId) return explicitMachineId;

  const hostname = readInventoryString(device.inventory?.snapshot, ["hostname", "hostName", "host"]);
  if (hostname) return hostname;

  const atIndex = device.name.lastIndexOf("@");
  if (atIndex >= 0 && atIndex < device.name.length - 1) {
    return device.name.slice(atIndex + 1);
  }

  return device.name;
}

export function machineKey(device: Device): string {
  return [
    device.userId,
    normalizeName(machineDisplayName(device)),
    normalizePlatform(device.platform),
    normalizeArch(device.arch),
  ].join("::");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizePlatform(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "macos") return "darwin";
  if (normalized === "win32") return "windows";
  return normalized;
}

export function normalizeArch(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "aarch64") return "arm64";
  if (normalized === "x86_64") return "x64";
  return normalized;
}

function readInventoryString(snapshot: unknown, keys: string[]): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;

  const stack: unknown[] = [snapshot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }

    stack.push(...Object.values(record));
  }

  return null;
}
