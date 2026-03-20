import { useState, useEffect } from "react";

interface LocalConfig {
  configType: string;
  name: string;
  preview: string;
  content: string;
}

interface Suggestion {
  id: string;
  title: string;
  configType: string;
  status: string;
  createdAt: string;
}

interface Profile {
  id: string;
  name: string;
}

export default function Suggest({
  onBack,
  onDetectConfigs,
  onSubmitSuggestion,
  onGetSuggestions,
  onFetchProfiles,
}: {
  onBack: () => void;
  onDetectConfigs: () => Promise<LocalConfig[]>;
  onSubmitSuggestion: (profileId: string, configType: string, title: string, description: string, content: string) => Promise<void>;
  onGetSuggestions: () => Promise<Suggestion[]>;
  onFetchProfiles: () => Promise<Profile[]>;
}) {
  const [localConfigs, setLocalConfigs] = useState<LocalConfig[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<LocalConfig | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [profileId, setProfileId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualContent, setManualContent] = useState("");
  const [manualConfigType, setManualConfigType] = useState("mcp");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [configs, pastSuggestions, profs] = await Promise.all([
        onDetectConfigs(),
        onGetSuggestions(),
        onFetchProfiles(),
      ]);
      setLocalConfigs(configs);
      setSuggestions(pastSuggestions);
      setProfiles(profs);
      if (profs.length > 0) setProfileId(profs[0].id);
    } catch (e: any) {
      setError(typeof e === "string" ? e : e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggest = (config: LocalConfig) => {
    setSelectedConfig(config);
    setTitle(config.name);
    setDescription("");
    setShowForm(true);
    setManualMode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setSubmitting(true);
    setError("");
    try {
      const configType = manualMode ? manualConfigType : selectedConfig!.configType;
      const content = manualMode ? manualContent : selectedConfig!.content;
      await onSubmitSuggestion(profileId, configType, title, description, content);
      setShowForm(false);
      setSelectedConfig(null);
      // Reload suggestions
      const updated = await onGetSuggestions();
      setSuggestions(updated);
    } catch (e: any) {
      setError(typeof e === "string" ? e : e.message || "Failed to submit suggestion");
    } finally {
      setSubmitting(false);
    }
  };

  const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
    mcp: { bg: "var(--color-info-subtle, #e0f2fe)", fg: "var(--color-info, #0284c7)" },
    skills: { bg: "var(--color-warning-subtle, #fef3c7)", fg: "var(--color-warning, #d97706)" },
    instructions: { bg: "var(--color-success-subtle)", fg: "var(--color-success)" },
  };

  const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "var(--color-warning-subtle, #fef3c7)", fg: "var(--color-warning, #d97706)" },
    approved: { bg: "var(--color-success-subtle)", fg: "var(--color-success)" },
    denied: { bg: "var(--color-danger-subtle)", fg: "var(--color-danger)" },
  };

  // Suggestion form view
  if (showForm && (selectedConfig || manualMode)) {
    return (
      <div className="h-screen flex flex-col" style={{ background: "var(--color-surface)" }}>
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-2.5 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <button onClick={() => { setShowForm(false); setManualMode(false); }} className="btn-ghost" style={{ padding: "4px 6px" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </button>
          <div className="text-[14px] font-semibold">{manualMode ? "New suggestion" : "Suggest to team"}</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 px-5 py-4 space-y-3.5 overflow-auto">
          {error && (
            <div
              className="p-2.5 rounded-lg text-[12px]"
              style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
            >
              {error}
            </div>
          )}

          {manualMode ? (
            <div>
              <label className="label">Config type</label>
              <select
                value={manualConfigType}
                onChange={(e) => setManualConfigType(e.target.value)}
                className="input-base"
              >
                <option value="mcp">MCP Server</option>
                <option value="instructions">Instructions</option>
                <option value="skills">Skill</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Config</label>
              <div className="flex items-center gap-2">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                  style={{
                    background: TYPE_COLORS[selectedConfig!.configType]?.bg || "#f3f4f6",
                    color: TYPE_COLORS[selectedConfig!.configType]?.fg || "#6b7280",
                  }}
                >
                  {selectedConfig!.configType}
                </span>
                <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                  {selectedConfig!.name}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-base"
              style={{ minHeight: "60px", resize: "vertical" }}
              placeholder="Why is this useful for the team?"
              required
            />
          </div>

          <div>
            <label className="label">Target profile</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="input-base"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {manualMode ? (
            <div>
              <label className="label">Content</label>
              <textarea
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                className="input-base font-mono"
                style={{ minHeight: "80px", resize: "vertical", fontSize: "11px" }}
                placeholder={manualConfigType === "mcp" ? '{"command": "npx", "args": ["-y", "@example/mcp-server"]}' : "Paste your config content here..."}
                required
              />
            </div>
          ) : (
            <div
              className="p-2.5 rounded-lg text-[11px] font-mono overflow-auto"
              style={{
                background: "var(--color-surface-secondary, #f9fafb)",
                color: "var(--color-text-secondary)",
                maxHeight: "80px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {selectedConfig!.preview}
            </div>
          )}
        </form>

        {/* Footer */}
        <div
          className="px-4 py-3 flex gap-2 shrink-0"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
            {submitting ? "Submitting..." : "Submit suggestion"}
          </button>
          <button onClick={() => { setShowForm(false); setManualMode(false); }} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-surface)" }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <button onClick={onBack} className="btn-ghost" style={{ padding: "4px 6px" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>
        <div className="text-[14px] font-semibold">Suggest to team</div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 space-y-3 overflow-auto">
        {loading && (
          <div className="text-[12px] text-center py-4" style={{ color: "var(--color-text-tertiary)" }}>
            Scanning local configs...
          </div>
        )}

        {error && !loading && (
          <div
            className="p-2.5 rounded-lg text-[12px]"
            style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
          >
            {error}
          </div>
        )}

        {/* Local configs that can be suggested */}
        {!loading && localConfigs.length > 0 && (
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="section-title">Local configs</div>
              <button
                onClick={() => {
                  setSelectedConfig(null);
                  setTitle("");
                  setDescription("");
                  setManualContent("");
                  setManualMode(true);
                  setShowForm(true);
                }}
                className="btn-ghost"
                style={{ fontSize: "11px", padding: "2px 6px" }}
              >
                + Manual
              </button>
            </div>
            <div className="space-y-2.5">
              {localConfigs.map((config, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5"
                  style={{ borderBottom: i < localConfigs.length - 1 ? "1px solid var(--color-border)" : "none", paddingBottom: i < localConfigs.length - 1 ? "10px" : "0" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0"
                        style={{
                          background: TYPE_COLORS[config.configType]?.bg || "#f3f4f6",
                          color: TYPE_COLORS[config.configType]?.fg || "#6b7280",
                        }}
                      >
                        {config.configType}
                      </span>
                      <span className="text-[12px] font-medium truncate">{config.name}</span>
                    </div>
                    <div
                      className="text-[11px] truncate"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {config.preview}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSuggest(config)}
                    className="btn-primary shrink-0"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    Suggest
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && localConfigs.length === 0 && !error && (
          <div className="card p-3.5">
            <div className="section-title mb-1.5">Local configs</div>
            <div className="text-[12px] mb-2" style={{ color: "var(--color-text-tertiary)" }}>
              {!(window as any).__TAURI__
                ? "Local config detection requires the native app. You can still suggest manually."
                : "No local configs detected to suggest."}
            </div>
            <button
              onClick={() => {
                setSelectedConfig({
                  configType: "mcp",
                  name: "",
                  preview: "",
                  content: "",
                });
                setTitle("");
                setDescription("");
                setShowForm(true);
                setManualMode(true);
              }}
              className="btn-secondary"
              style={{ fontSize: "11px", padding: "4px 10px" }}
            >
              + Suggest manually
            </button>
          </div>
        )}

        {/* Past suggestions */}
        {!loading && (
          <div className="card p-3.5">
            <div className="section-title mb-2.5">Your suggestions</div>
            {suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0"
                      style={{
                        background: TYPE_COLORS[s.configType]?.bg || "#f3f4f6",
                        color: TYPE_COLORS[s.configType]?.fg || "#6b7280",
                      }}
                    >
                      {s.configType}
                    </span>
                    <span className="text-[12px] flex-1 truncate">{s.title}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize shrink-0"
                      style={{
                        background: STATUS_COLORS[s.status]?.bg || "#f3f4f6",
                        color: STATUS_COLORS[s.status]?.fg || "#6b7280",
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                No suggestions yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
