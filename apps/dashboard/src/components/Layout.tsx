import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import StatusBadge from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/app", label: "Profiles", end: true },
  { to: "/app/artifacts", label: "Artifacts" },
  { to: "/app/submissions", label: "Submissions", badgeKey: "suggestions" as const },
  { to: "/app/fleet", label: "Fleet" },
  { to: "/app/secrets", label: "Secrets" },
  { to: "/app/audit", label: "Audit Log" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [suggestionCount, setSuggestionCount] = useState(0);

  useEffect(() => {
    const loadCount = () => {
      if (!user?.orgId) return;
      api
        .getSuggestionCount(user.orgId)
        .then((data) => setSuggestionCount(data.count))
        .catch(() => {});
    };

    loadCount();
    window.addEventListener("lfc:submissions-changed", loadCount);
    return () => window.removeEventListener("lfc:submissions-changed", loadCount);
  }, [user?.orgId]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r bg-background lg:block">
          <div className="sticky top-0 flex min-h-screen flex-col p-4">
            <Card className="py-0">
              <CardHeader className="gap-2 border-b py-4">
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  LFC
                </div>
                <CardTitle>Artifact control</CardTitle>
                <CardDescription>
                  Profiles, releases, approvals, and device health in one place.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-4">
                <nav className="space-y-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item}
                      className={({ isActive }) =>
                        cn(
                          buttonVariants({
                            variant: isActive ? "secondary" : "ghost",
                            size: "sm",
                          }),
                          "w-full justify-between"
                        )
                      }
                    >
                      <span>{item.label}</span>
                      {"badgeKey" in item && suggestionCount > 0 ? (
                        <StatusBadge
                          tone="info"
                          className="h-5 min-w-5 justify-center px-1.5 tabular-nums"
                        >
                          {suggestionCount}
                        </StatusBadge>
                      ) : null}
                    </NavLink>
                  ))}
                </nav>
              </CardContent>
            </Card>

            <Card className="mt-auto py-0">
              <CardContent className="space-y-3 py-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Signed in</div>
                  <div className="truncate text-sm text-foreground">{user?.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <NavLink
                    to="/app/settings"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Settings
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "cursor-pointer"
                    )}
                  >
                    Sign out
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b bg-background lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  LFC
                </div>
                <div className="truncate text-sm font-medium text-foreground">{user?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <NavLink
                  to="/app/settings"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Settings
                </NavLink>
                <button
                  onClick={handleLogout}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "cursor-pointer"
                  )}
                >
                  Sign out
                </button>
              </div>
            </div>
            <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
              {navItems.map((item) => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={"end" in item}
                    className={cn(
                      buttonVariants({
                        variant: isActive ? "secondary" : "ghost",
                        size: "sm",
                      }),
                      "shrink-0"
                    )}
                  >
                    <span>{item.label}</span>
                    {"badgeKey" in item && suggestionCount > 0 ? (
                      <StatusBadge
                        tone="info"
                        className="ml-1 h-5 min-w-5 justify-center px-1.5 tabular-nums"
                      >
                        {suggestionCount}
                      </StatusBadge>
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
