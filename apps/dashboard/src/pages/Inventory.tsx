import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

interface InventoryItem {
  type: string;
  name: string;
  users: string[];
  command?: string;
  args?: string[];
  managed: boolean;
}

interface MemberSnapshot {
  userId: string;
  name: string;
  email: string;
  updatedAt: string;
  tools: {
    id: string;
    name: string;
    installed: boolean;
    mcpServers: { name: string; command: string; args: string[]; managed: boolean }[];
    skills: { name: string; managed: boolean; preview: string }[];
    agents: { name: string; managed: boolean; preview: string }[];
    rules: { name: string; managed: boolean; preview: string }[];
  }[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_LABELS: Record<string, string> = {
  mcp: "MCP",
  skill: "Skill",
  agent: "Agent",
  rule: "Rule",
};

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  mcp: { bg: "rgba(52, 211, 153, 0.08)", fg: "#34d399" },
  skill: { bg: "rgba(229, 168, 34, 0.08)", fg: "#e5a822" },
  agent: { bg: "rgba(96, 165, 250, 0.08)", fg: "#60a5fa" },
  rule: { bg: "rgba(168, 85, 247, 0.08)", fg: "#a855f7" },
};

export default function Inventory() {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberSnapshot[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  useEffect(() => {
    if (user?.orgId) loadInventory();
  }, [user?.orgId]);

  const loadInventory = async () => {
    if (!user?.orgId) return;
    try {
      const data = await api.getInventory(user.orgId);
      setMembers(data.members);
      setInventory(data.inventory);
    } catch (err) {
      console.error("Failed to load inventory", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = filter === "all"
    ? inventory
    : inventory.filter((i) => i.type === filter);

  const userOnlyItems = inventory.filter((i) => !i.managed);
  const managedItems = inventory.filter((i) => i.managed);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Team Inventory</h1>
        <p className="page-subtitle">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Team Inventory</h1>
        <p className="page-subtitle">
          What your team has installed across their machines. Uploaded automatically when users connect.
        </p>
      </div>

      {/* Summary */}
      <div className="flex gap-3 mb-6">
        <div className="card px-4 py-3 flex-1">
          <div className="text-[22px] font-semibold tabular-nums" style={{ letterSpacing: "-0.02em" }}>
            {members.length}
          </div>
          <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Snapshots uploaded
          </div>
        </div>
        <div className="card px-4 py-3 flex-1">
          <div className="text-[22px] font-semibold tabular-nums" style={{ letterSpacing: "-0.02em" }}>
            {userOnlyItems.length}
          </div>
          <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            User-owned configs
          </div>
        </div>
        <div className="card px-4 py-3 flex-1">
          <div className="text-[22px] font-semibold tabular-nums" style={{ letterSpacing: "-0.02em" }}>
            {managedItems.length}
          </div>
          <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            LFC-managed
          </div>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="card p-6">
          <div className="text-[14px] font-medium mb-1">No snapshots yet</div>
          <div className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
            When team members connect via the tray app, their tool inventories are automatically uploaded here.
            You'll be able to see what MCPs, skills, rules, and agents everyone has — and promote useful ones to org profiles.
          </div>
        </div>
      ) : (
        <>
          {/* Unified inventory table */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="section-title">All configs across team</div>
              <div className="flex gap-1">
                {["all", "mcp", "skill", "rule", "agent"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className="text-[11px] font-medium px-2 py-1 rounded transition-colors cursor-pointer"
                    style={{
                      background: filter === t ? "var(--color-surface-overlay)" : "transparent",
                      color: filter === t ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                      border: "none",
                    }}
                  >
                    {t === "all" ? "All" : TYPE_LABELS[t] + "s"}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name</th>
                      <th>Used by</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item, i) => (
                      <tr key={`${item.type}-${item.name}-${i}`}>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: TYPE_COLORS[item.type]?.bg,
                              color: TYPE_COLORS[item.type]?.fg,
                            }}
                          >
                            {TYPE_LABELS[item.type] || item.type}
                          </span>
                        </td>
                        <td>
                          <div className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>
                            {item.name}
                          </div>
                          {item.command && (
                            <div
                              className="text-[11px] font-mono mt-0.5"
                              style={{ color: "var(--color-text-tertiary)" }}
                            >
                              {item.command} {(item.args || []).join(" ")}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                            {item.users.length} member{item.users.length !== 1 ? "s" : ""}
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: item.managed
                                ? "rgba(52, 211, 153, 0.08)"
                                : "var(--color-accent-subtle)",
                              color: item.managed ? "#34d399" : "var(--color-accent)",
                            }}
                          >
                            {item.managed ? "managed" : "user"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredInventory.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--color-text-tertiary)" }}>
                          No {filter === "all" ? "" : TYPE_LABELS[filter]?.toLowerCase() + " "}configs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Per-member snapshots */}
          <div>
            <div className="section-title mb-3">Per-member snapshots</div>
            <div className="space-y-2">
              {members.map((m) => {
                const isExpanded = expandedMember === m.userId;
                const installedTools = m.tools.filter((t) => t.installed);
                const totalItems = installedTools.reduce(
                  (sum, t) => sum + t.mcpServers.length + t.skills.length + t.agents.length + t.rules.length,
                  0
                );
                return (
                  <div key={m.userId} className="card">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
                      style={{ background: "transparent", border: "none", color: "inherit", textAlign: "left" }}
                      onClick={() => setExpandedMember(isExpanded ? null : m.userId)}
                    >
                      <div>
                        <div className="text-[13px] font-medium">{m.name}</div>
                        <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                          {m.email} — {installedTools.length} tools, {totalItems} configs — {timeAgo(m.updatedAt)}
                        </div>
                      </div>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--color-text-tertiary)", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 150ms" }}
                      >
                        {">"}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                        {installedTools.map((tool) => (
                          <div key={tool.id} className="pt-3">
                            <div className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                              {tool.name}
                            </div>
                            {tool.mcpServers.length > 0 && (
                              <div className="mb-1.5">
                                {tool.mcpServers.map((s) => (
                                  <div key={s.name} className="flex items-center gap-2 py-0.5">
                                    <span className="badge" style={{ ...TYPE_COLORS.mcp, background: TYPE_COLORS.mcp.bg, color: TYPE_COLORS.mcp.fg, fontSize: "9px" }}>MCP</span>
                                    <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                                    <span className="text-[10px] font-mono" style={{ color: "var(--color-text-tertiary)" }}>{s.command}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {tool.skills.length > 0 && (
                              <div className="mb-1.5">
                                {tool.skills.map((s) => (
                                  <div key={s.name} className="flex items-center gap-2 py-0.5">
                                    <span className="badge" style={{ ...TYPE_COLORS.skill, background: TYPE_COLORS.skill.bg, color: TYPE_COLORS.skill.fg, fontSize: "9px" }}>Skill</span>
                                    <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {tool.rules.length > 0 && (
                              <div className="mb-1.5">
                                {tool.rules.map((s) => (
                                  <div key={s.name} className="flex items-center gap-2 py-0.5">
                                    <span className="badge" style={{ ...TYPE_COLORS.rule, background: TYPE_COLORS.rule.bg, color: TYPE_COLORS.rule.fg, fontSize: "9px" }}>Rule</span>
                                    <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {tool.agents.length > 0 && (
                              <div>
                                {tool.agents.map((s) => (
                                  <div key={s.name} className="flex items-center gap-2 py-0.5">
                                    <span className="badge" style={{ ...TYPE_COLORS.agent, background: TYPE_COLORS.agent.bg, color: TYPE_COLORS.agent.fg, fontSize: "9px" }}>Agent</span>
                                    <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
