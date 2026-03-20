import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

function timeAgo(dateStr: string): string {
  const d = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const ACTION_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  "config.created":      { label: "Config created",      bg: "rgba(52,211,153,0.1)",  fg: "#34d399" },
  "config.updated":      { label: "Config updated",      bg: "rgba(96,165,250,0.1)",  fg: "#60a5fa" },
  "config.deleted":      { label: "Config deleted",      bg: "rgba(239,68,68,0.1)",   fg: "#ef4444" },
  "suggestion.created":  { label: "Suggestion submitted", bg: "rgba(229,168,34,0.1)", fg: "#e5a822" },
  "suggestion.approved": { label: "Suggestion approved", bg: "rgba(52,211,153,0.1)",  fg: "#34d399" },
  "suggestion.denied":   { label: "Suggestion denied",   bg: "rgba(239,68,68,0.1)",   fg: "#ef4444" },
  "sync.completed":      { label: "Sync",                bg: "rgba(96,165,250,0.1)",  fg: "#60a5fa" },
  "user.joined":         { label: "User joined",         bg: "rgba(168,85,247,0.1)",  fg: "#a855f7" },
  "user.invited":        { label: "Invite created",      bg: "rgba(168,85,247,0.1)",  fg: "#a855f7" },
  "secret.created":      { label: "Secret created",      bg: "rgba(229,168,34,0.1)",  fg: "#e5a822" },
  "secret.deleted":      { label: "Secret deleted",      bg: "rgba(239,68,68,0.1)",   fg: "#ef4444" },
  "snapshot.uploaded":    { label: "Snapshot uploaded",   bg: "rgba(96,165,250,0.1)",  fg: "#60a5fa" },
};

function getStyle(action: string) {
  return ACTION_STYLES[action] || { label: action, bg: "rgba(152,152,160,0.1)", fg: "#9898a0" };
}

function describeEvent(event: any): string {
  const details = event.details ? JSON.parse(event.details) : {};
  switch (event.action) {
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

const FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "config.", label: "Configs" },
  { value: "suggestion.", label: "Suggestions" },
  { value: "sync.", label: "Syncs" },
  { value: "user.", label: "Users" },
  { value: "secret.", label: "Secrets" },
  { value: "snapshot.", label: "Snapshots" },
];

export default function AuditLog() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const PAGE_SIZE = 50;

  useEffect(() => {
    setEntries([]);
    setOffset(0);
    load(0, true);
  }, [filter]);

  const load = async (newOffset: number, replace = false) => {
    if (!user?.orgId) return;
    replace ? setLoading(true) : setLoadingMore(true);
    try {
      const data = await api.getAuditLog(user.orgId, PAGE_SIZE, newOffset);
      let rows = data.entries || [];
      if (filter) rows = rows.filter((e: any) => (e.action || "").startsWith(filter));
      replace ? setEntries(rows) : setEntries((prev) => [...prev, ...rows]);
      setTotal(data.total);
      setOffset(newOffset + PAGE_SIZE);
    } catch {
      if (replace) setEntries([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Activity history for your organization</p>
        </div>
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className="text-[11px] font-medium px-2 py-1 rounded transition-colors cursor-pointer"
              style={{
                background: filter === opt.value ? "var(--color-surface-overlay)" : "transparent",
                color: filter === opt.value ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                border: "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
            No events found.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Details</th>
                  <th style={{ textAlign: "right" }}>When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const style = getStyle(entry.action);
                  return (
                    <tr key={entry.id || i}>
                      <td>
                        <span
                          className="badge"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          {style.label}
                        </span>
                      </td>
                      <td>
                        <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>
                          {entry.userName || "System"}
                        </span>
                      </td>
                      <td>
                        <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                          {describeEvent(entry)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                          {timeAgo(entry.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {offset < total && (
            <div className="p-3 text-center" style={{ borderTop: "1px solid var(--color-border)" }}>
              <button onClick={() => load(offset)} disabled={loadingMore} className="btn-ghost">
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
