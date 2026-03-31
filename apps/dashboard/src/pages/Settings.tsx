import { useEffect, useState } from "react";

import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/api";

import { useAuth } from "../lib/auth";

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
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgLoaded, setOrgLoaded] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin || !user?.orgId) return;

    api.getOrg(user.orgId).then((data) => {
      setOrgName(data.org.name);
      setOrgSlug(data.org.slug);
      setOrgLoaded(true);
    });
  }, [isAdmin, user?.orgId]);

  const handleProfile = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handlePassword = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handleOrg = async (event: React.FormEvent) => {
    event.preventDefault();
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
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle={`Manage your account${isAdmin ? " and organization" : ""}.`}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <AlertDescription className="text-emerald-700">{success}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="py-0">
        <CardHeader className="border-b py-5">
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and sign-in email.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <form onSubmit={handleProfile} className="max-w-md space-y-4">
            <div>
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2"
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="border-b py-5">
          <CardTitle>Change password</CardTitle>
          <CardDescription>Passwords must be at least 8 characters long.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <form onSubmit={handlePassword} className="max-w-md space-y-4">
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-2"
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2"
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin && orgLoaded ? (
        <Card className="py-0">
          <CardHeader className="border-b py-5">
            <div className="flex items-center gap-2">
              <CardTitle>Organization</CardTitle>
              <StatusBadge tone="info">Admin</StatusBadge>
            </div>
            <CardDescription>
              Update the organization name and canonical slug used in URLs.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <form onSubmit={handleOrg} className="max-w-md space-y-4">
              <div>
                <Label htmlFor="org-settings-name">Organization name</Label>
                <Input
                  id="org-settings-name"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="org-settings-slug">URL slug</Label>
                <Input
                  id="org-settings-slug"
                  value={orgSlug}
                  onChange={(event) =>
                    setOrgSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  className="mt-2 font-mono"
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save organization"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
