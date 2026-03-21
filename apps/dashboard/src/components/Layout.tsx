import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import * as api from "../lib/api";

const navItems = [
  { to: "/app", label: "Overview", end: true },
  { to: "/app/profiles", label: "Profiles" },
  { to: "/app/secrets", label: "Secrets" },
  { to: "/app/inventory", label: "Inventory" },
  { to: "/app/suggestions", label: "Suggestions", badgeKey: "suggestions" as const },
  { to: "/app/status", label: "Team Status" },
  { to: "/app/audit", label: "Audit Log" },
  { to: "/app/users", label: "Team" },
  { to: "/app/invite", label: "Invite" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [suggestionCount, setSuggestionCount] = useState(0);

  useEffect(() => {
    if (user?.orgId) {
      api.getSuggestionCount(user.orgId)
        .then((data) => setSuggestionCount(data.count))
        .catch(() => {});
    }
  }, [user?.orgId]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen" style={{ background: "var(--color-surface-sunken)" }}>
      {/* Sidebar */}
      <aside
        className="w-[200px] flex flex-col shrink-0"
        style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}
      >
        {/* Brand */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-bold tracking-tight"
              style={{ color: "var(--color-accent-text)" }}
            >
              LFC
            </span>
            <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
              v0.1
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-px">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-[6px] rounded text-[13px] transition-colors ${
                  isActive
                    ? "text-[var(--color-text-primary)] bg-[var(--color-surface-overlay)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                }`
              }
            >
              <span>{item.label}</span>
              {"badgeKey" in item && suggestionCount > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 rounded leading-[16px] tabular-nums"
                  style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent-text)" }}
                >
                  {suggestionCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>
            {user?.email}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <NavLink
              to="/app/settings"
              className="text-[11px]"
              style={{ color: "var(--color-text-tertiary)", textDecoration: "none" }}
            >
              Settings
            </NavLink>
            <span className="text-[11px]" style={{ color: "var(--color-border)" }}>·</span>
            <button
              onClick={handleLogout}
              className="text-[11px] cursor-pointer border-none bg-transparent p-0"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[880px] mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
