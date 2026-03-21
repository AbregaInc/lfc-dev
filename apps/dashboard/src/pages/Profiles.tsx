import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

const TOOL_LABELS: Record<string, string> = {
  "claude-desktop": "Claude Desktop",
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  windsurf: "Windsurf",
  opencode: "OpenCode",
};

const TOOL_COLORS: Record<string, { bg: string; text: string }> = {
  "claude-desktop": { bg: "#fff7ed", text: "#c2410c" },
  "claude-code": { bg: "#faf5ff", text: "#7c3aed" },
  cursor: { bg: "#eff6ff", text: "#2563eb" },
  codex: { bg: "#f0fdf4", text: "#16a34a" },
  windsurf: { bg: "#f0fdfa", text: "#0d9488" },
  opencode: { bg: "#fdf2f8", text: "#db2777" },
};

export default function Profiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", description: "", tools: [] as string[] });
  const [error, setError] = useState("");

  // Org creation state (shown if user has no org)
  const [newOrg, setNewOrg] = useState({ name: "", slug: "" });
  const [suggestedOrgs, setSuggestedOrgs] = useState<{ orgId: string; orgName: string; memberCount: number }[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);

  useEffect(() => {
    if (user?.orgId) {
      loadProfiles();
    } else {
      const suggestion = sessionStorage.getItem("lfc_suggested_orgs");
      if (suggestion) {
        setSuggestedOrgs(JSON.parse(suggestion));
        sessionStorage.removeItem("lfc_suggested_orgs");
      }
    }
  }, [user]);

  const loadProfiles = async () => {
    if (!user?.orgId) return;
    const data = await api.listProfiles(user.orgId);
    setProfiles(data.profiles);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.createOrg(newOrg.name, newOrg.slug);
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setJoiningByCode(true);
    try {
      await api.acceptInvite(inviteCode.trim());
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoiningByCode(false);
    }
  };

  if (!user?.orgId) {
    return (
      <div className="max-w-[460px] mx-auto pt-12">
        <h1 className="page-title">Get started</h1>
        <p className="page-subtitle mb-8">Join an existing organization or create a new one.</p>

        {suggestedOrgs.length > 0 && (
          <div
            className="card p-5 mb-6"
            style={{ borderColor: "var(--color-accent)", background: "var(--color-accent-subtle)" }}
          >
            <div className="text-[14px] font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
              {suggestedOrgs.length === 1
                ? "Your team may already be on LFC"
                : `${suggestedOrgs.length} teams from your company are on LFC`}
            </div>
            <div className="text-[13px] mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Ask your admin for an invite link to join.
            </div>
            <div className="mt-3 space-y-1.5">
              {suggestedOrgs.map((org) => (
                <div
                  key={org.orgId}
                  className="flex items-center justify-between px-3 py-2 rounded-md"
                  style={{ background: "rgba(255,255,255,0.6)" }}
                >
                  <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{org.orgName}</span>
                  <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>{org.memberCount} member{org.memberCount !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5 mb-4">
          <div className="text-[15px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>Join with invite code</div>
          <div className="text-[13px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>Got an invite link from your team admin? Paste the code here.</div>
          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="e.g., acme-invite-2024" className="input-base flex-1 font-mono" required />
            <button type="submit" disabled={joiningByCode} className="btn-primary shrink-0">{joiningByCode ? "Joining..." : "Join"}</button>
          </form>
        </div>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          <span className="text-[12px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>OR</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
        </div>

        <div className="card p-5">
          <div className="text-[15px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>Create a new organization</div>
          <div className="text-[13px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>You'll be the admin. Invite your team after setup.</div>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px]" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}>{error}</div>
            )}
            <div>
              <label className="label">Organization name</label>
              <input type="text" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} placeholder="Acme Corp" className="input-base" required />
            </div>
            <div>
              <label className="label">URL slug</label>
              <input type="text" value={newOrg.slug} onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="acme" className="input-base font-mono" required />
            </div>
            <button type="submit" className="btn-primary w-full">Create organization</button>
          </form>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user?.orgId) return;
    try {
      await api.createProfile(user.orgId, newProfile);
      setShowCreate(false);
      setNewProfile({ name: "", description: "", tools: [] });
      loadProfiles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTool = (tool: string) => {
    setNewProfile((p) => ({
      ...p,
      tools: p.tools.includes(tool) ? p.tools.filter((t) => t !== tool) : [...p.tools, tool],
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Profiles</h1>
          <p className="page-subtitle">Config bundles assigned to your team</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          New profile
        </button>
      </div>

      {showCreate && (
        <div className="card p-5 mb-6">
          <div className="text-[15px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
            Create profile
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px]" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}>
                {error}
              </div>
            )}

            <div>
              <label className="label">Name</label>
              <input type="text" value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} placeholder="e.g., Backend Team" className="input-base" required />
            </div>

            <div>
              <label className="label">Description</label>
              <input type="text" value={newProfile.description} onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })} placeholder="Optional" className="input-base" />
            </div>

            <div>
              <label className="label">Target tools</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TOOL_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTool(key)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer"
                    style={{
                      background: newProfile.tools.includes(key) ? "var(--color-text-primary)" : "var(--color-surface)",
                      color: newProfile.tools.includes(key) ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                      borderColor: newProfile.tools.includes(key) ? "var(--color-text-primary)" : "var(--color-border)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {profiles.map((profile) => (
          <Link
            key={profile.id}
            to={`/app/profiles/${profile.id}`}
            className="card p-5 block hover:border-[var(--color-text-tertiary)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {profile.name}
                </div>
                {profile.description && (
                  <div className="text-[13px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                    {profile.description}
                  </div>
                )}
              </div>
              <div className="text-[12px] font-medium tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                {profile.configCount} config{profile.configCount !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.tools.map((tool: string) => {
                const colors = TOOL_COLORS[tool] || { bg: "#f4f4f5", text: "#52525b" };
                return (
                  <span
                    key={tool}
                    className="badge"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {TOOL_LABELS[tool] || tool}
                  </span>
                );
              })}
            </div>
          </Link>
        ))}

        {profiles.length === 0 && !showCreate && (
          <div className="card p-12 text-center">
            <div className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>
              No profiles yet. Create one to get started.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
