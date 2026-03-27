import { useEffect, useState } from "react";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";
import { timeAgo } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

import { useAuth } from "../lib/auth";

type FilterKey = "all" | "artifacts" | "submissions" | "fleet" | "users" | "secrets";

const ACTION_TONES: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  "artifact.created": { label: "Artifact created", tone: "success" },
  "artifact.release.created": { label: "Release drafted", tone: "warning" },
  "artifact.release.approved": { label: "Release approved", tone: "success" },
  "artifact.release.deprecated": { label: "Release deprecated", tone: "danger" },
  "profile.assignment.updated": { label: "Profile updated", tone: "info" },
  "profile.assignment.deleted": { label: "Assignment removed", tone: "danger" },
  "submission.created": { label: "Submission received", tone: "warning" },
  "submission.approved": { label: "Submission approved", tone: "success" },
  "submission.denied": { label: "Submission denied", tone: "danger" },
  "suggestion.created": { label: "Suggestion submitted", tone: "warning" },
  "suggestion.approved": { label: "Suggestion approved", tone: "success" },
  "suggestion.denied": { label: "Suggestion denied", tone: "danger" },
  "device.registered": { label: "Device registered", tone: "info" },
  "device.synced": { label: "Device synced", tone: "info" },
  "sync.completed": { label: "Legacy sync", tone: "info" },
  "snapshot.uploaded": { label: "Inventory uploaded", tone: "info" },
  "user.joined": { label: "User joined", tone: "neutral" },
  "user.invited": { label: "Invite created", tone: "neutral" },
  "secret.created": { label: "Secret created", tone: "warning" },
  "secret.deleted": { label: "Secret deleted", tone: "danger" },
  "config.created": { label: "Legacy config created", tone: "success" },
  "config.updated": { label: "Legacy config updated", tone: "info" },
  "config.deleted": { label: "Legacy config deleted", tone: "danger" },
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "artifacts", label: "Artifacts" },
  { value: "submissions", label: "Submissions" },
  { value: "fleet", label: "Fleet" },
  { value: "users", label: "Users" },
  { value: "secrets", label: "Secrets" },
] as const;

function getStyle(action: string) {
  return ACTION_TONES[action] || { label: action, tone: "neutral" as const };
}

function parseDetails(value: string | null | undefined): Record<string, any> {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function describeEvent(event: any): string {
  const details = parseDetails(event.details);
  switch (event.action) {
    case "artifact.created":
      return [details.name, details.kind, details.version].filter(Boolean).join(" · ");
    case "artifact.release.created":
      return (
        [details.artifactId, details.version, details.status].filter(Boolean).join(" · ") ||
        "New release"
      );
    case "artifact.release.approved":
      return "Release marked approved";
    case "artifact.release.deprecated":
      return "Release marked deprecated";
    case "profile.assignment.updated":
      return [details.artifactReleaseId, details.desiredState, details.rolloutStrategy]
        .filter(Boolean)
        .join(" · ");
    case "profile.assignment.deleted":
      return details.assignmentId || "Profile assignment removed";
    case "submission.created":
      return [details.title, details.artifactKind, details.reliabilityTier]
        .filter(Boolean)
        .join(" · ");
    case "submission.approved":
      return `${Array.isArray(details.profileIds) ? details.profileIds.length : 0} profile target${
        Array.isArray(details.profileIds) && details.profileIds.length === 1 ? "" : "s"
      }`;
    case "submission.denied":
      return details.reviewNotes || "Rejected during review";
    case "config.created":
    case "config.updated":
    case "config.deleted":
      return `${details.configType || "config"} in ${details.profileName || "profile"}`;
    case "suggestion.created":
    case "suggestion.approved":
    case "suggestion.denied":
      return details.title || "";
    case "sync.completed":
      return `${details.configCount || 0} configs, ${(details.installedTools || []).length} tools`;
    case "device.registered":
      return [details.clientKind, details.clientVersion].filter(Boolean).join(" · ");
    case "device.synced":
      return `${details.assignmentCount || 0} assignments, ${details.removalCount || 0} removals`;
    case "user.joined":
      return details.orgName || "";
    case "user.invited":
      return `Code: ${details.code || ""}`;
    case "secret.created":
    case "secret.deleted":
      return details.name || "";
    case "snapshot.uploaded":
      return `${details.toolCount || 0} tools detected`;
    default:
      return event.details ? JSON.stringify(details).slice(0, 80) : "";
  }
}

function matchesFilter(action: string, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "artifacts") {
    return (
      action.startsWith("artifact.") ||
      action.startsWith("profile.assignment.") ||
      action.startsWith("config.")
    );
  }
  if (filter === "submissions") {
    return action.startsWith("submission.") || action.startsWith("suggestion.");
  }
  if (filter === "fleet") {
    return (
      action.startsWith("device.") ||
      action.startsWith("sync.") ||
      action.startsWith("snapshot.")
    );
  }
  if (filter === "users") return action.startsWith("user.");
  if (filter === "secrets") return action.startsWith("secret.");
  return true;
}

export default function AuditLog() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");
  const pageSize = 50;

  useEffect(() => {
    setEntries([]);
    setOffset(0);
    void load(0, true);
  }, [filter, user?.orgId]);

  const load = async (newOffset: number, replace = false) => {
    if (!user?.orgId) return;
    if (replace) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await api.getAuditLog(user.orgId, pageSize, newOffset);
      const rows = (data.entries || []).filter((entry: any) =>
        matchesFilter(entry.action || "", filter)
      );
      if (replace) setEntries(rows);
      else setEntries((current) => [...current, ...rows]);
      setTotal(data.total);
      setOffset(newOffset + pageSize);
    } catch {
      if (replace) setEntries([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="Approvals, assignments, device syncs, invites, and secret changes across the organization."
      />

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              buttonVariants({
                variant: filter === option.value ? "secondary" : "ghost",
                size: "sm",
              }),
              "cursor-pointer"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <EmptyState title="Loading audit log..." />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No events found"
          description="Try another filter or perform an action in the dashboard."
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => {
                const style = getStyle(entry.action);
                return (
                  <TableRow key={entry.id || index}>
                    <TableCell>
                      <StatusBadge tone={style.tone}>{style.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {entry.userName || "System"}
                    </TableCell>
                    <TableCell className="max-w-xl whitespace-normal text-muted-foreground">
                      {describeEvent(entry)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {timeAgo(entry.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {offset < total ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => void load(offset)}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
