import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

const TOOL_OPTIONS = [
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  { value: "codex", label: "Codex" },
  { value: "windsurf", label: "Windsurf" },
  { value: "opencode", label: "OpenCode" },
];

interface McpServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  _managed_by: string;
}

export default function ProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("mcp");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [skillName, setSkillName] = useState("");
  const [skillContent, setSkillContent] = useState("");

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    if (!user?.orgId || !id) return;
    const data = await api.getProfile(user.orgId, id);
    setProfile(data.profile);
    setConfigs(data.configs);
    for (const config of data.configs) {
      if (config.configType === "mcp") {
        try { setMcpServers(JSON.parse(config.content).servers || []); } catch { setMcpServers([]); }
      } else if (config.configType === "instructions") {
        setInstructions(config.content);
      } else if (config.configType === "skills") {
        try { const p = JSON.parse(config.content); setSkillName(p.name || ""); setSkillContent(p.content || ""); } catch { setSkillContent(config.content); }
      }
    }
  };

  const save = async (type: string, content: string) => {
    if (!user?.orgId || !id) return;
    setSaving(true);
    setMessage("");
    try {
      await api.upsertConfig(user.orgId, id, type, content);
      setMessage("Saved");
      setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveMcp = () => save("mcp", JSON.stringify({ servers: mcpServers }));
  const saveInstructions = () => save("instructions", instructions);
  const saveSkills = () => save("skills", JSON.stringify({ name: skillName, content: skillContent }));

  const updateTools = async (tools: string[]) => {
    if (!user?.orgId || !id) return;
    await api.updateProfile(user.orgId, id, { tools });
    setProfile({ ...profile, tools });
  };

  const addServer = (server: McpServer) => { setMcpServers([...mcpServers, { ...server, _managed_by: "lfc" }]); setShowAddServer(false); };
  const removeServer = (index: number) => setMcpServers(mcpServers.filter((_, i) => i !== index));
  const updateServer = (index: number, server: McpServer) => { const u = [...mcpServers]; u[index] = server; setMcpServers(u); setEditingServer(null); };

  if (!profile) return <div className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</div>;

  const tabs = [
    { id: "mcp", label: "MCP Servers" },
    { id: "instructions", label: "Instructions" },
    { id: "skills", label: "Skills" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">{profile.name}</h1>
        {profile.description && <p className="page-subtitle">{profile.description}</p>}
      </div>

      {/* Tools */}
      <div className="card p-4 mb-6">
        <div className="section-title mb-3">Target tools</div>
        <div className="flex flex-wrap gap-2">
          {TOOL_OPTIONS.map((tool) => (
            <button
              key={tool.value}
              onClick={() => {
                const tools = profile.tools.includes(tool.value)
                  ? profile.tools.filter((t: string) => t !== tool.value)
                  : [...profile.tools, tool.value];
                updateTools(tools);
              }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer"
              style={{
                background: profile.tools.includes(tool.value) ? "var(--color-text-primary)" : "var(--color-surface)",
                color: profile.tools.includes(tool.value) ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                borderColor: profile.tools.includes(tool.value) ? "var(--color-text-primary)" : "var(--color-border)",
              }}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div
          className="mb-4 p-3 rounded-lg text-[13px] font-medium"
          style={{
            background: message.startsWith("Error") ? "var(--color-danger-subtle)" : "var(--color-success-subtle)",
            color: message.startsWith("Error") ? "var(--color-danger)" : "var(--color-success)",
          }}
        >
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "var(--color-surface-sunken)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 px-4 py-2 rounded-md text-[13px] font-medium transition-all cursor-pointer border-none"
            style={{
              background: activeTab === tab.id ? "var(--color-surface)" : "transparent",
              color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              boxShadow: activeTab === tab.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MCP Servers */}
      {activeTab === "mcp" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">MCP Servers</div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddServer(true)} className="btn-secondary">Add server</button>
              <button onClick={saveMcp} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save changes"}</button>
            </div>
          </div>

          {showAddServer && <McpServerForm onSave={addServer} onCancel={() => setShowAddServer(false)} />}

          <div className="space-y-2">
            {mcpServers.map((server, index) => (
              <div key={index} className="card p-4">
                {editingServer === server ? (
                  <McpServerForm initial={server} onSave={(s) => updateServer(index, s)} onCancel={() => setEditingServer(null)} />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{server.name}</div>
                      <code className="text-[12px] mt-1 block font-mono" style={{ color: "var(--color-text-secondary)" }}>
                        {server.command} {server.args?.join(" ")}
                      </code>
                      {Object.keys(server.env || {}).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(server.env).map(([key, val]) => (
                            <span key={key} className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}>
                              {key}={val.startsWith("{{") ? val : "***"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button onClick={() => setEditingServer(server)} className="btn-ghost" style={{ padding: "4px 8px" }}>Edit</button>
                      <button onClick={() => removeServer(index)} className="btn-danger">Remove</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {mcpServers.length === 0 && !showAddServer && (
              <div className="card p-10 text-center">
                <div className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>No MCP servers. Add one to get started.</div>
              </div>
            )}
          </div>

          <FileHint tools={profile.tools} type="mcp" />
        </div>
      )}

      {/* Instructions */}
      {activeTab === "instructions" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">Team instructions</div>
            <button onClick={saveInstructions} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save changes"}</button>
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Write team instructions in Markdown..."
            className="input-base font-mono resize-y"
            style={{ minHeight: "240px", fontSize: "13px", lineHeight: "1.6" }}
          />
          <FileHint tools={profile.tools} type="instructions" skillName="" />
        </div>
      )}

      {/* Skills */}
      {activeTab === "skills" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">Skills</div>
            <button onClick={saveSkills} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save changes"}</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Skill name</label>
              <input type="text" value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="e.g., code-review" className="input-base" />
            </div>
            <div>
              <label className="label">Content (Markdown)</label>
              <textarea
                value={skillContent}
                onChange={(e) => setSkillContent(e.target.value)}
                placeholder="Write skill instructions..."
                className="input-base font-mono resize-y"
                style={{ minHeight: "180px", fontSize: "13px", lineHeight: "1.6" }}
              />
            </div>
          </div>
          <FileHint tools={profile.tools} type="skills" skillName={skillName} />
        </div>
      )}
    </div>
  );
}

function FileHint({ tools, type, skillName }: { tools: string[]; type: string; skillName?: string }) {
  const files: string[] = [];
  if (type === "mcp") {
    if (tools.includes("claude-desktop")) files.push("~/Library/Application Support/Claude/claude_desktop_config.json");
    if (tools.includes("claude-code")) files.push("~/.claude.json");
    if (tools.includes("cursor")) files.push("~/.cursor/mcp.json");
  } else if (type === "instructions") {
    if (tools.includes("claude-code")) files.push("~/.claude/CLAUDE.md");
    if (tools.includes("cursor")) files.push(".cursorrules");
    if (tools.includes("codex")) files.push("AGENTS.md");
  } else if (type === "skills") {
    if (tools.includes("claude-code")) files.push(`~/.claude/skills/${skillName || "<name>"}.md`);
  }
  if (files.length === 0) return null;
  return (
    <div className="mt-5 p-3.5 rounded-lg text-[12px] font-mono" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-tertiary)" }}>
      <span className="font-sans font-medium text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: "var(--color-text-tertiary)" }}>
        Synced to
      </span>
      {files.map((f) => <div key={f}>{f}</div>)}
    </div>
  );
}

function McpServerForm({ initial, onSave, onCancel }: { initial?: McpServer; onSave: (s: McpServer) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [command, setCommand] = useState(initial?.command || "");
  const [argsStr, setArgsStr] = useState(initial?.args?.join(", ") || "");
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>(
    initial?.env ? Object.entries(initial.env).map(([key, value]) => ({ key, value })) : [{ key: "", value: "" }]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const args = argsStr.split(",").map((s) => s.trim()).filter(Boolean);
    const env: Record<string, string> = {};
    for (const pair of envPairs) { if (pair.key.trim()) env[pair.key.trim()] = pair.value.trim(); }
    onSave({ name, command, args, env, _managed_by: "lfc" });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Server name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., github" className="input-base" required />
        </div>
        <div>
          <label className="label">Command</label>
          <input type="text" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="e.g., npx" className="input-base" required />
        </div>
      </div>
      <div>
        <label className="label">Arguments (comma-separated)</label>
        <input type="text" value={argsStr} onChange={(e) => setArgsStr(e.target.value)} placeholder="e.g., -y, @modelcontextprotocol/server-github" className="input-base" />
      </div>
      <div>
        <label className="label">Environment variables</label>
        {envPairs.map((pair, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input type="text" value={pair.key} onChange={(e) => { const u = [...envPairs]; u[i] = { ...u[i], key: e.target.value }; setEnvPairs(u); }} placeholder="KEY" className="input-base font-mono flex-1" />
            <input type="text" value={pair.value} onChange={(e) => { const u = [...envPairs]; u[i] = { ...u[i], value: e.target.value }; setEnvPairs(u); }} placeholder="value or {{SECRET}}" className="input-base font-mono flex-1" />
            {envPairs.length > 1 && (
              <button type="button" onClick={() => setEnvPairs(envPairs.filter((_, idx) => idx !== i))} className="btn-danger" style={{ padding: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setEnvPairs([...envPairs, { key: "", value: "" }])} className="text-[12px] font-medium cursor-pointer bg-transparent border-none" style={{ color: "var(--color-text-secondary)" }}>
          + Add variable
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">{initial ? "Update" : "Add server"}</button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}
