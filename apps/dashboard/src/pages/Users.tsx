import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (user?.orgId) {
      api.listUsers(user.orgId).then((data) => setUsers(data.users));
    }
  }, [user]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Team</h1>
        <p className="page-subtitle">Members of your organization</p>
      </div>

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
