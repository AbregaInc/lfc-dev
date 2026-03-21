import { useState } from "react";
import { API_URL } from "../config";

export default function Settings({
  syncInterval: initialInterval,
  onSave,
  onBack,
}: {
  syncInterval: number;
  onSave: (apiUrl: string, syncInterval: number) => void;
  onBack: () => void;
}) {
  const [syncInterval, setSyncInterval] = useState(initialInterval);

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
        <div className="text-[14px] font-semibold">Settings</div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 space-y-4">
        <div>
          <label className="label">Sync interval</label>
          <select
            value={syncInterval}
            onChange={(e) => setSyncInterval(Number(e.target.value))}
            className="input-base"
          >
            <option value={30}>Every 30 seconds</option>
            <option value={60}>Every 1 minute</option>
            <option value={300}>Every 5 minutes</option>
            <option value={900}>Every 15 minutes</option>
          </select>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 flex gap-2 shrink-0"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <button onClick={() => onSave(API_URL, syncInterval)} className="btn-primary flex-1">
          Save
        </button>
        <button onClick={onBack} className="btn-secondary flex-1">
          Cancel
        </button>
      </div>
    </div>
  );
}
