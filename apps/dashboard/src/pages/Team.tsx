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

type SyncStatus = "up_to_date" | "outdated" | "never_synced";

function getSyncStatus(member: any): { status: SyncStatus; label: string; bg: string; color: string } {
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

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  mcp: { bg: "rgba(52, 211, 153, 0.08)", fg: "#34d399" },
  skill: { bg: "rgba(229, 168, 34, 0.08)", fg: "#e5a822" },
  agent: { bg: "rgba(96, 165, 250, 0.08)", fg: "#60a5fa" },
  rule: { bg: "rgba(168, 85, 247, 0.08)", fg: "#a855f7" },
};

const TYPE_LABELS: Record<string, string> = {
  mcp: "MCP",
  skill: "Skill",
  agent: "Agent",
  rule: "Rule",
};

type Tab = "members" | "inventory";

export default function Team() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<any[]>([]);
  const [syncMembers, setSyncMembers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [invSnapshots, setInvSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [addingToProfile, setAddingToProfile] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<Record<string, "saving" | "saved">>({});

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user?.orgId) loadAll();
  }, [user?.orgId]);

  const loadAll = async () => {
    if (!user?.orgId) return;
    setLoading(true);
    try {
      const [usersData, statusData, invData, profilesData] = await Promise.all([
        api.listUsers(user.orgId),
        api.getSyncStatus(user.orgId),
        api.getInventory(user.orgId),
        api.listProfiles(user.orgId),
      ]);
      setMembers(usersData.users);
      setSyncMembers(statusData.members);
      setInventory(invData.inventory);
      setInvSnapshots(invData.members);
      setProfiles(profilesData.profiles);
    } catch (err) {
      console.error("Failed to load team data", err);
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async () => {
    if (!user?.orgId) return;
    setInviteLoading(true);
    try {
      const data = await api.createInvite(user.orgId);
      setInviteCode(data.invite.code);
    } catch (err) {
      console.error(err);
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const copyToClipboard = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToProfile = async (item: any, profileId: string) => {
    if (!user?.orgId) return;
    const itemKey = `${item.type}:${item.name}`;
    setAddStatus((s) => ({ ...s, [itemKey]: "saving" }));
    try {
      if (item.type === "mcp") {
        const profileData = await api.getProfile(user.orgId, profileId);
        const mcpConfig = profileData.configs.find((c: any) => c.configType === "mcp");
        let servers: any[] = [];
        if (mcpConfig) {
          try { servers = JSON.parse(mcpConfig.content).servers || []; } catch {}
        }
        servers.push({ name: item.name, command: item.command || "", args: item.args || [], env: {}, _managed_by: "lfc" });
        await api.upsertConfig(user.orgId, profileId, "mcp", JSON.stringify({ servers }));
      } else {
        const configType = item.type === "skill" ? "skills" : item.type === "agent" ? "agents" : "rules";
        await api.upsertConfig(user.orgId, profileId, configType, JSON.stringify({ name: item.name, content: item.content || "" }));
      }
      setAddStatus((s) => ({ ...s, [itemKey]: "saved" }));
      setAddingToProfile(null);
      setTimeout(() => { loadAll(); setAddStatus((s) => { const n = { ...s }; delete n[itemKey]; return n; }); }, 1500);
    } catch (err) {
      console.error("Failed to add to profile", err);
      setAddStatus((s) => { const n = { ...s }; delete n[itemKey]; return n; });
    }
  };

  // Build a merged member view: user data + sync status
  const mergedMembers = members.map((u) => {
    const sync = syncMembers.find((m) => m.id === u.id || m.email === u.email);
    return { ...u, ...sync };
  });

  const statusCounts = {
    up_to_date: mergedMembers.filter((m) => getSyncStatus(m).status === "up_to_date").length,
    outdated: mergedMembers.filter((m) => getSyncStatus(m).status === "outdated").length,
    never_synced: mergedMembers.filter((m) => getSyncStatus(m).status === "never_synced").length,
  };

  const filteredInventory = inventoryFilter === "all"
    ? inventory
    : inventory.filter((i: any) => i.type === inventoryFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={loadAll} className="btn-secondary">Refresh</button>
      </div>

      {/* Invite section — admin only */}
      {isAdmin && (
        <div className="card p-5 mb-6">
          <div className="section-title mb-1">Invite members</div>
          <p className="text-[13px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>
            Generate a link to share with your team.
          </p>
          <button onClick={generateInvite} disabled={inviteLoading} className="btn-primary">
            {inviteLoading ? "Generating..." : "Generate invite link"}
          </button>
          {inviteUrl && (
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="input-base font-mono text-[12px]"
                  style={{ background: "var(--color-surface-sunken)" }}
                />
                <button onClick={copyToClipboard} className="btn-primary shrink-0">
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[12px] mt-2" style={{ color: "var(--color-text-tertiary)" }}>
                Share this link. Recipients will create an account and join your org.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status summary */}
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["members", "inventory"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-[12px] font-medium px-3 py-1.5 rounded transition-colors cursor-pointer"
            style={{
              background: tab === t ? "var(--color-surface-overlay)" : "transparent",
              color: tab === t ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              border: "none",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 text-center text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</div>
      ) : tab === "members" ? (
        /* Members table */
        <div className="card overflow-hidden">
          {mergedMembers.length === 0 ? (
            <div className="p-12 text-center text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>No members yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Role</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Tools</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Last sync</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {mergedMembers.map((m, i) => {
                  const statusInfo = getSyncStatus(m);
                  return (
                    <tr key={m.id} style={{ borderBottom: i < mergedMembers.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
                            style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}
                          >
                            {m.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{m.name}</div>
                            <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="badge"
                          style={{
                            background: m.role === "admin" ? "#faf5ff" : "var(--color-surface-sunken)",
                            color: m.role === "admin" ? "#7c3aed" : "var(--color-text-tertiary)",
                          }}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(m.installedTools || []).length > 0 ? (
                            (m.installedTools as string[]).map((tool: string) => (
                              <span
                                key={tool}
                                className="badge"
                                style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}
                              >
                                {tool}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                        {m.lastSync ? timeAgo(m.lastSync) : "Never"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
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
      ) : (
        /* Inventory tab */
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="section-title">All configs across team</div>
            <div className="flex gap-1">
              {["all", "mcp", "skill", "rule", "agent"].map((t) => (
                <button
                  key={t}
                  onClick={() => setInventoryFilter(t)}
                  className="text-[11px] font-medium px-2 py-1 rounded transition-colors cursor-pointer"
                  style={{
                    background: inventoryFilter === t ? "var(--color-surface-overlay)" : "transparent",
                    color: inventoryFilter === t ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                    border: "none",
                  }}
                >
                  {t === "all" ? "All" : TYPE_LABELS[t] + "s"}
                </button>
              ))}
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="card p-6">
              <div className="text-[14px] font-medium mb-1">No inventory yet</div>
              <div className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
                When team members connect via the desktop app, their tool inventories appear here.
              </div>
            </div>
          ) : (
            <>
              <div className="card mb-6">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Used by</th>
                        <th>Source</th>
                        {isAdmin && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map((item: any, i: number) => {
                        const itemKey = `${item.type}:${item.name}`;
                        const status = addStatus[itemKey];
                        const isPickingProfile = addingToProfile === itemKey;

                        return (
                          <tr key={`${item.type}-${item.name}-${i}`}>
                            <td>
                              <span className="badge" style={{ background: TYPE_COLORS[item.type]?.bg, color: TYPE_COLORS[item.type]?.fg }}>
                                {TYPE_LABELS[item.type] || item.type}
                              </span>
                            </td>
                            <td>
                              <div className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>{item.name}</div>
                              {item.command && (
                                <div className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
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
                                  background: item.managed ? "rgba(52, 211, 153, 0.08)" : "var(--color-accent-subtle)",
                                  color: item.managed ? "#34d399" : "var(--color-accent)",
                                }}
                              >
                                {item.managed ? "managed" : "user"}
                              </span>
                            </td>
                            {isAdmin && (
                              <td>
                                {item.managed ? null : status === "saved" ? (
                                  <span className="text-[11px] font-medium" style={{ color: "var(--color-success)" }}>Added</span>
                                ) : status === "saving" ? (
                                  <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>Saving...</span>
                                ) : isPickingProfile ? (
                                  <select
                                    className="input-base text-[11px]"
                                    style={{ padding: "4px 8px", minWidth: "120px" }}
                                    autoFocus
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) handleAddToProfile(item, e.target.value);
                                    }}
                                    onBlur={() => setAddingToProfile(null)}
                                  >
                                    <option value="" disabled>Select profile...</option>
                                    {profiles.map((p: any) => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <button
                                    className="btn-ghost text-[11px]"
                                    style={{ color: "var(--color-accent)", padding: "2px 8px" }}
                                    onClick={() => setAddingToProfile(itemKey)}
                                  >
                                    Add to profile
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {filteredInventory.length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: "center", color: "var(--color-text-tertiary)" }}>
                            No {inventoryFilter === "all" ? "" : TYPE_LABELS[inventoryFilter]?.toLowerCase() + " "}configs found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-member snapshots */}
              <div className="section-title mb-3">Per-member snapshots</div>
              <div className="space-y-2">
                {invSnapshots.map((m: any) => {
                  const isExpanded = expandedMember === m.userId;
                  const installedTools = m.tools.filter((t: any) => t.installed);
                  const totalItems = installedTools.reduce(
                    (sum: number, t: any) => sum + t.mcpServers.length + t.skills.length + t.agents.length + t.rules.length,
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
                            {installedTools.length} tools, {totalItems} configs — {timeAgo(m.updatedAt)}
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
                          {installedTools.map((tool: any) => (
                            <div key={tool.id} className="pt-3">
                              <div className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                                {tool.name}
                              </div>
                              {[
                                { items: tool.mcpServers, type: "mcp", label: "MCP" },
                                { items: tool.skills, type: "skill", label: "Skill" },
                                { items: tool.rules, type: "rule", label: "Rule" },
                                { items: tool.agents, type: "agent", label: "Agent" },
                              ].filter((g) => g.items.length > 0).map((group) => (
                                <div key={group.type} className="mb-1.5">
                                  {group.items.map((s: any) => (
                                    <div key={s.name} className="flex items-center gap-2 py-0.5">
                                      <span className="badge" style={{ background: TYPE_COLORS[group.type]?.bg, color: TYPE_COLORS[group.type]?.fg, fontSize: "9px" }}>
                                        {group.label}
                                      </span>
                                      <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{s.name}</span>
                                      {s.command && <span className="text-[10px] font-mono" style={{ color: "var(--color-text-tertiary)" }}>{s.command}</span>}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
