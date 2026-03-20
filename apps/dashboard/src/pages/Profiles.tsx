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

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    if (!user?.orgId) return;
    const data = await api.listProfiles(user.orgId);
    setProfiles(data.profiles);
  };

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
            to={`/profiles/${profile.id}`}
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
