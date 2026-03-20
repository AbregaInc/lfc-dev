import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Secrets() {
  const { user } = useAuth();
  const [secrets, setSecrets] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { loadSecrets(); }, []);

  const loadSecrets = async () => {
    if (!user?.orgId) return;
    const data = await api.listSecrets(user.orgId);
    setSecrets(data.secrets);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user?.orgId) return;
    try {
      await api.createSecret(user.orgId, newName, newValue);
      setNewName(""); setNewValue(""); setShowAdd(false);
      loadSecrets();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (secretId: string) => {
    if (!user?.orgId) return;
    if (!confirm("Delete this secret? Any configs referencing it will stop working.")) return;
    await api.deleteSecret(user.orgId, secretId);
    loadSecrets();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Secrets</h1>
          <p className="page-subtitle">
            API keys and tokens. Reference in MCP configs as <code className="font-mono text-[12px] px-1 py-0.5 rounded" style={{ background: "var(--color-surface-sunken)" }}>{"{{SECRET_NAME}}"}</code>
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">Add secret</button>
      </div>

      {showAdd && (
        <div className="card p-5 mb-6">
          <div className="text-[15px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>New secret</div>
          <form onSubmit={handleAdd} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px]" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}>{error}</div>
            )}
            <div>
              <label className="label">Name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} placeholder="e.g., GITHUB_TOKEN" className="input-base font-mono" required />
            </div>
            <div>
              <label className="label">Value</label>
              <input type="password" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="The secret value" className="input-base font-mono" required />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary">Save secret</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {secrets.length === 0 ? (
          <div className="p-12 text-center text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>No secrets yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Name</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Value</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Created</th>
                <th className="text-right px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((secret, i) => (
                <tr key={secret.id} style={{ borderBottom: i < secrets.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                  <td className="px-5 py-3.5 font-mono text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{secret.name}</td>
                  <td className="px-5 py-3.5 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
                    <span className="font-mono tracking-widest">{"*".repeat(12)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                    {new Date(secret.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => handleDelete(secret.id)} className="btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
