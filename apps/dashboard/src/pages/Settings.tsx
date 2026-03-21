import { useState } from "react";
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Update your profile and password</p>
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

      <div className="card p-5">
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
    </div>
  );
}
