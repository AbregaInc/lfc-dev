import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ profiles: 0, users: 0, secrets: 0 });
  const [orgName, setOrgName] = useState("");
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", slug: "" });
  const [error, setError] = useState("");

  // If the user registered and we detected existing orgs for their domain
  const [suggestedOrgs, setSuggestedOrgs] = useState<{ orgId: string; orgName: string; memberCount: number }[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);

  useEffect(() => {
    if (user?.orgId) {
      loadStats();
    } else {
      // Check sessionStorage for org suggestions from registration
      const suggestion = sessionStorage.getItem("lfc_suggested_orgs");
      if (suggestion) {
        setSuggestedOrgs(JSON.parse(suggestion));
        sessionStorage.removeItem("lfc_suggested_orgs");
      }
      setShowCreateOrg(true);
    }
  }, [user]);

  const loadStats = async () => {
    if (!user?.orgId) return;
    try {
      const [profilesData, usersData, secretsData, orgData] = await Promise.all([
        api.listProfiles(user.orgId),
        api.listUsers(user.orgId),
        api.listSecrets(user.orgId),
        api.getOrg(user.orgId),
      ]);
      setStats({
        profiles: profilesData.profiles.length,
        users: usersData.users.length,
        secrets: secretsData.secrets.length,
      });
      setOrgName(orgData.org.name);
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.createOrg(newOrg.name, newOrg.slug);
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setJoiningByCode(true);
    try {
      await api.acceptInvite(inviteCode.trim());
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoiningByCode(false);
    }
  };

  if (showCreateOrg) {
    return (
      <div className="max-w-[460px] mx-auto pt-12">
        <h1 className="page-title">Get started</h1>
        <p className="page-subtitle mb-8">Join an existing organization or create a new one.</p>

        {/* Suggested orgs from email domain match */}
        {suggestedOrgs.length > 0 && (
          <div
            className="card p-5 mb-6"
            style={{ borderColor: "var(--color-accent)", background: "var(--color-accent-subtle)" }}
          >
            <div className="text-[14px] font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
              {suggestedOrgs.length === 1
                ? "Your team may already be on LFC"
                : `${suggestedOrgs.length} teams from your company are on LFC`}
            </div>
            <div className="text-[13px] mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Ask your admin for an invite link to join an existing org.
            </div>
            <div className="mt-3 space-y-1.5">
              {suggestedOrgs.map((org) => (
                <div
                  key={org.orgId}
                  className="flex items-center justify-between px-3 py-2 rounded-md"
                  style={{ background: "rgba(255,255,255,0.6)" }}
                >
                  <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {org.orgName}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Join with invite code */}
        <div className="card p-5 mb-4">
          <div className="text-[15px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
            Join with invite code
          </div>
          <div className="text-[13px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>
            Got an invite link from your team admin? Paste the code here.
          </div>
          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="e.g., acme-invite-2024"
              className="input-base flex-1 font-mono"
              required
            />
            <button type="submit" disabled={joiningByCode} className="btn-primary shrink-0">
              {joiningByCode ? "Joining..." : "Join"}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          <span className="text-[12px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>OR</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
        </div>

        {/* Create new org */}
        <div className="card p-5">
          <div className="text-[15px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
            Create a new organization
          </div>
          <div className="text-[13px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>
            You'll be the admin. Invite your team after setup.
          </div>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px]" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}>
                {error}
              </div>
            )}
            <div>
              <label className="label">Organization name</label>
              <input type="text" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} placeholder="Acme Corp" className="input-base" required />
            </div>
            <div>
              <label className="label">URL slug</label>
              <input type="text" value={newOrg.slug} onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="acme" className="input-base font-mono" required />
            </div>
            <button type="submit" className="btn-primary w-full">
              Create organization
            </button>
          </form>
        </div>
      </div>
    );
  }

  const statItems = [
    { label: "Profiles", value: stats.profiles, to: "/app/profiles" },
    { label: "Team members", value: stats.users, to: "/app/users" },
    { label: "Secrets", value: stats.secrets, to: "/app/secrets" },
  ];

  const GITHUB_RELEASE = "https://github.com/AbregaInc/lfc-dev/releases/latest";

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">{orgName}</h1>
        <p className="page-subtitle">AI tool configuration management</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {statItems.map((stat) => (
          <Link key={stat.label} to={stat.to} className="card p-5 group hover:border-[var(--color-text-tertiary)] transition-colors">
            <div className="text-[28px] font-semibold tabular-nums" style={{ letterSpacing: "-0.03em", color: "var(--color-text-primary)" }}>
              {stat.value}
            </div>
            <div className="text-[13px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
              {stat.label}
            </div>
          </Link>
        ))}
      </div>

      {/* Download / connect prompt */}
      <div className="card p-5 mb-6">
        <div className="section-title mb-1">Connect the desktop app</div>
        <p className="text-[13px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>
          Download and sign in with your account to start syncing configs automatically.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={GITHUB_RELEASE}
            className="btn-primary text-[13px]"
            style={{ textDecoration: "none" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download for macOS
          </a>
          <a
            href={GITHUB_RELEASE}
            className="btn-secondary text-[13px]"
            style={{ textDecoration: "none" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download for Windows
          </a>
          <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            or install via CLI:
          </span>
          <code
            className="text-[12px] px-2 py-1 rounded"
            style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}
          >
            npm i -g lfc-cli
          </code>
        </div>
      </div>

      <div className="card p-5">
        <div className="section-title mb-4">Quick actions</div>
        <div className="flex gap-3">
          <Link to="/app/profiles" className="btn-primary">Manage profiles</Link>
          <Link to="/app/invite" className="btn-secondary">Invite users</Link>
          <Link to="/app/secrets" className="btn-secondary">Manage secrets</Link>
        </div>
      </div>
    </div>
  );
}
