import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (user?.orgId) {
      api.listUsers(user.orgId).then((data) => setUsers(data.users));
    }
  }, [user]);

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

  const isAdmin = user?.role === "admin";

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Team</h1>
        <p className="page-subtitle">Members of your organization</p>
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

      {/* Members table */}
      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>No users yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Name</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Email</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Role</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
                        style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}
                      >
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className="badge"
                      style={{
                        background: u.role === "admin" ? "#faf5ff" : "var(--color-surface-sunken)",
                        color: u.role === "admin" ? "#7c3aed" : "var(--color-text-tertiary)",
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                    {new Date(u.createdAt).toLocaleDateString()}
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
