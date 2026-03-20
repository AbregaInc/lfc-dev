import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type SyncStatusType = "up_to_date" | "outdated" | "never_synced";

function getSyncStatusInfo(member: any): { status: SyncStatusType; label: string; bg: string; color: string } {
  if (!member.lastSync) {
    return { status: "never_synced", label: "Never synced", bg: "var(--color-surface-sunken)", color: "var(--color-text-tertiary)" };
  }

  const hoursSinceSync = (Date.now() - new Date(member.lastSync).getTime()) / (1000 * 60 * 60);
  const configMatch = member.configVersionMatch !== false;

  if (hoursSinceSync <= 24 && configMatch) {
    return { status: "up_to_date", label: "Up to date", bg: "#f0fdf4", color: "#16a34a" };
  }

  return { status: "outdated", label: "Outdated", bg: "#fffbeb", color: "#d97706" };
}

export default function TeamStatus() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    if (!user?.orgId) return;
    setLoading(true);
    try {
      const data = await api.getSyncStatus(user.orgId);
      setMembers(data.members);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = {
    up_to_date: members.filter((m) => getSyncStatusInfo(m).status === "up_to_date").length,
    outdated: members.filter((m) => getSyncStatusInfo(m).status === "outdated").length,
    never_synced: members.filter((m) => getSyncStatusInfo(m).status === "never_synced").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Team Status</h1>
          <p className="page-subtitle">Sync status of your team members</p>
        </div>
        <button onClick={loadStatus} className="btn-secondary">Refresh</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#16a34a" }}>Up to date</div>
          <div className="text-[22px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{statusCounts.up_to_date}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#d97706" }}>Outdated</div>
          <div className="text-[22px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{statusCounts.outdated}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-tertiary)" }}>Never synced</div>
          <div className="text-[22px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{statusCounts.never_synced}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>No team members found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Name</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Email</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Last Sync</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Installed Tools</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const statusInfo = getSyncStatusInfo(m);
                return (
                  <tr key={m.id || i} style={{ borderBottom: i < members.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
                          style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}
                        >
                          {m.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{m.email}</td>
                    <td className="px-5 py-3.5 text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                      {m.lastSync ? timeAgo(m.lastSync) : "Never"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(m.installedTools || []).length > 0 ? (
                          (m.installedTools as string[]).map((tool) => (
                            <span
                              key={tool}
                              className="badge"
                              style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}
                            >
                              {tool}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="badge"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
