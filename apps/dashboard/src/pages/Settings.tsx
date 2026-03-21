import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Settings() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Org settings (admin only)
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgLoaded, setOrgLoaded] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin && user?.orgId) {
      api.getOrg(user.orgId).then((data) => {
        setOrgName(data.org.name);
        setOrgSlug(data.org.slug);
        setOrgLoaded(true);
      });
    }
  }, [isAdmin, user?.orgId]);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const data: { name?: string; email?: string } = {};
      if (name !== user?.name) data.name = name;
      if (email !== user?.email) data.email = email;
      if (!data.name && !data.email) {
        setSuccess("No changes to save.");
        setSaving(false);
        return;
      }
      await api.updateMe(data);
      setSuccess("Profile updated. Changes take effect on next login.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await api.updateMe({ currentPassword, newPassword });
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.orgId) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.updateOrg(user.orgId, { name: orgName, slug: orgSlug });
      setSuccess("Organization updated.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account{isAdmin ? " and organization" : ""}</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-[13px] mb-4" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg text-[13px] mb-4" style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}>
          {success}
        </div>
      )}

      <div className="card p-5 mb-6">
        <div className="section-title mb-4">Profile</div>
        <form onSubmit={handleProfile} className="space-y-4 max-w-[400px]">
          <div>
            <label className="label">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-base" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" required />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>

      <div className="card p-5 mb-6">
        <div className="section-title mb-4">Change password</div>
        <form onSubmit={handlePassword} className="space-y-4 max-w-[400px]">
          <div>
            <label className="label">Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-base" required />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-base" placeholder="At least 8 characters" required />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-base" required />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>

      {/* Org settings — admin only */}
      {isAdmin && orgLoaded && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="section-title">Organization</div>
            <span
              className="badge"
              style={{ background: "#faf5ff", color: "#7c3aed" }}
            >
              admin
            </span>
          </div>
          <form onSubmit={handleOrg} className="space-y-4 max-w-[400px]">
            <div>
              <label className="label">Organization name</label>
              <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="input-base" required />
            </div>
            <div>
              <label className="label">URL slug</label>
              <input
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="input-base font-mono"
                required
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save organization"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
