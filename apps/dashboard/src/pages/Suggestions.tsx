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

const CONFIG_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  mcp: { bg: "#eff6ff", color: "#2563eb" },
  instructions: { bg: "#f0fdf4", color: "#16a34a" },
  skills: { bg: "#faf5ff", color: "#7c3aed" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fffbeb", color: "#d97706" },
  approved: { bg: "#f0fdf4", color: "#16a34a" },
  denied: { bg: "#fef2f2", color: "#dc2626" },
};

export default function Suggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadSuggestions();
  }, [activeTab]);

  const loadSuggestions = async () => {
    if (!user?.orgId) return;
    setLoading(true);
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const data = await api.getSuggestions(user.orgId, status);
      setSuggestions(data.suggestions);
      const countData = await api.getSuggestionCount(user.orgId);
      setPendingCount(countData.count);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestion: any) => {
    if (approvingId === suggestion.id) {
      // Submit the approval with edited content
      if (!user?.orgId) return;
      try {
        await api.approveSuggestion(user.orgId, suggestion.id, { content: editContent });
        setApprovingId(null);
        setEditContent("");
        loadSuggestions();
      } catch {}
    } else {
      // Open the edit view
      setApprovingId(suggestion.id);
      setEditContent(suggestion.content || "");
      setDenyingId(null);
    }
  };

  const handleDeny = async (suggestionId: string) => {
    if (!user?.orgId) return;
    try {
      await api.denySuggestion(user.orgId, suggestionId, denyNote);
      setDenyingId(null);
      setDenyNote("");
      loadSuggestions();
    } catch {}
  };

  const tabs = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "approved", label: "Approved" },
    { id: "denied", label: "Denied" },
  ];

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Suggestions</h1>
          {pendingCount > 0 && (
            <span
              className="badge"
              style={{ background: "#fffbeb", color: "#d97706" }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="page-subtitle">Review config suggestions from your team</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "var(--color-surface-sunken)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 px-4 py-2 rounded-md text-[13px] font-medium transition-all cursor-pointer border-none flex items-center justify-center gap-2"
            style={{
              background: activeTab === tab.id ? "var(--color-surface)" : "transparent",
              color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              boxShadow: activeTab === tab.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "#fffbeb", color: "#d97706", minWidth: "18px", textAlign: "center" }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</div>
      ) : suggestions.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>
            No suggestions yet. Team members can suggest configs from the tray app.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => {
            const isExpanded = expandedId === s.id;
            const typeStyle = CONFIG_TYPE_COLORS[s.configType] || { bg: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" };
            const statusStyle = STATUS_COLORS[s.status] || { bg: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" };

            return (
              <div key={s.id} className="card">
                {/* Header row */}
                <div
                  className="p-4 cursor-pointer flex items-center justify-between gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {s.title}
                      </span>
                      <span
                        className="badge"
                        style={{ background: typeStyle.bg, color: typeStyle.color }}
                      >
                        {(s.configType || "").toUpperCase()}
                      </span>
                      <span
                        className="badge"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-[12px] flex items-center gap-2" style={{ color: "var(--color-text-tertiary)" }}>
                      <span>{s.submitterName || "Unknown"}</span>
                      <span style={{ opacity: 0.4 }}>-</span>
                      <span>{s.profileName || "Global"}</span>
                      <span style={{ opacity: 0.4 }}>-</span>
                      <span>{timeAgo(s.createdAt)}</span>
                    </div>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: "var(--color-text-tertiary)",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 150ms",
                    }}
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                    <div className="pt-4">
                      {s.description && (
                        <p className="text-[13px] mb-4" style={{ color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
                          {s.description}
                        </p>
                      )}

                      {/* Proposed content */}
                      <div className="mb-4">
                        <div className="section-title mb-2">Proposed content</div>
                        {approvingId === s.id ? (
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="input-base font-mono resize-y"
                            style={{ minHeight: "160px", fontSize: "12px", lineHeight: "1.6" }}
                          />
                        ) : (
                          <pre
                            className="p-3 rounded-lg text-[12px] font-mono overflow-auto"
                            style={{
                              background: "var(--color-surface-sunken)",
                              color: "var(--color-text-secondary)",
                              lineHeight: "1.6",
                              maxHeight: "300px",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {s.content}
                          </pre>
                        )}
                      </div>

                      {/* Diff view if available */}
                      {s.diff && (
                        <div className="mb-4">
                          <div className="section-title mb-2">Diff</div>
                          <pre
                            className="p-3 rounded-lg text-[12px] font-mono overflow-auto"
                            style={{
                              background: "var(--color-surface-sunken)",
                              color: "var(--color-text-secondary)",
                              lineHeight: "1.6",
                              maxHeight: "300px",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {s.diff}
                          </pre>
                        </div>
                      )}

                      {/* Deny reason input */}
                      {denyingId === s.id && (
                        <div className="mb-4">
                          <label className="label">Reason for denial</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={denyNote}
                              onChange={(e) => setDenyNote(e.target.value)}
                              placeholder="Optional reason..."
                              className="input-base flex-1"
                              autoFocus
                            />
                            <button onClick={() => handleDeny(s.id)} className="btn-primary">
                              Confirm deny
                            </button>
                            <button onClick={() => { setDenyingId(null); setDenyNote(""); }} className="btn-secondary">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Actions for pending */}
                      {s.status === "pending" && denyingId !== s.id && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleApprove(s)}
                            className="btn-primary"
                          >
                            {approvingId === s.id ? "Confirm approval" : "Approve"}
                          </button>
                          {approvingId === s.id && (
                            <button
                              onClick={() => { setApprovingId(null); setEditContent(""); }}
                              className="btn-secondary"
                            >
                              Cancel edit
                            </button>
                          )}
                          {approvingId !== s.id && (
                            <button
                              onClick={() => { setDenyingId(s.id); setDenyNote(""); setApprovingId(null); }}
                              className="btn-secondary"
                              style={{ color: "var(--color-danger)" }}
                            >
                              Deny
                            </button>
                          )}
                        </div>
                      )}

                      {/* Show denial note if denied */}
                      {s.status === "denied" && s.denyNote && (
                        <div
                          className="p-3 rounded-lg text-[13px]"
                          style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
                        >
                          <span className="font-medium">Denial reason:</span> {s.denyNote}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
