import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ToolToggleButton from "@/components/ToolToggleButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import * as api from "@/lib/api";
import { TOOL_LABELS, TOOL_OPTIONS } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

import { useAuth } from "../lib/auth";

export default function Profiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<api.Profile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: "",
    description: "",
    tools: [] as string[],
  });
  const [error, setError] = useState("");

  const [newOrg, setNewOrg] = useState({ name: "", slug: "" });
  const [suggestedOrgs, setSuggestedOrgs] = useState<
    { orgId: string; orgName: string; memberCount: number }[]
  >([]);
  const [inviteCode, setInviteCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);

  useEffect(() => {
    if (user?.orgId) {
      void loadProfiles();
      return;
    }

    const suggestion = sessionStorage.getItem("lfc_suggested_orgs");
    if (!suggestion) return;
    setSuggestedOrgs(JSON.parse(suggestion));
    sessionStorage.removeItem("lfc_suggested_orgs");
  }, [user]);

  const loadProfiles = async () => {
    if (!user?.orgId) return;
    const data = await api.listProfiles(user.orgId);
    setProfiles(data.profiles);
  };

  const handleCreateOrg = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      await api.createOrg(newOrg.name, newOrg.slug);
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoinByCode = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!user?.orgId) return;

    try {
      await api.createProfile(user.orgId, newProfile);
      setShowCreate(false);
      setNewProfile({ name: "", description: "", tools: [] });
      await loadProfiles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTool = (tool: string) => {
    setNewProfile((current) => ({
      ...current,
      tools: current.tools.includes(tool)
        ? current.tools.filter((value) => value !== tool)
        : [...current.tools, tool],
    }));
  };

  if (!user?.orgId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pt-8">
        <PageHeader
          title="Get started"
          subtitle="Join an existing organization with an invite code, or create a new one to start managing shared artifacts."
        />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {suggestedOrgs.length > 0 ? (
          <Card className="py-0">
            <CardHeader className="border-b py-5">
              <CardTitle>
                {suggestedOrgs.length === 1
                  ? "Your team may already be on LFC"
                  : `${suggestedOrgs.length} teams from your company are already here`}
              </CardTitle>
              <CardDescription>
                Ask an admin for an invite link if you should join one of these workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 py-5">
              {suggestedOrgs.map((org) => (
                <div
                  key={org.orgId}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
                >
                  <div className="text-sm font-medium text-foreground">{org.orgName}</div>
                  <div className="text-sm text-muted-foreground">
                    {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="py-0">
          <CardHeader className="border-b py-5">
            <CardTitle>Join with invite code</CardTitle>
            <CardDescription>
              Paste the code from your team&apos;s invite link to attach your account to an
              existing organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <form onSubmit={handleJoinByCode} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="acme-invite-2024"
                className="font-mono"
                required
              />
              <Button type="submit" disabled={joiningByCode}>
                {joiningByCode ? "Joining..." : "Join"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            or
          </span>
          <Separator className="flex-1" />
        </div>

        <Card className="py-0">
          <CardHeader className="border-b py-5">
            <CardTitle>Create a new organization</CardTitle>
            <CardDescription>
              You&apos;ll be the first admin and can invite the rest of the team after setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  value={newOrg.name}
                  onChange={(event) =>
                    setNewOrg((current) => ({ ...current, name: event.target.value }))
                  }
                  className="mt-2"
                  placeholder="Acme Corp"
                  required
                />
              </div>
              <div>
                <Label htmlFor="org-slug">URL slug</Label>
                <Input
                  id="org-slug"
                  value={newOrg.slug}
                  onChange={(event) =>
                    setNewOrg((current) => ({
                      ...current,
                      slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  className="mt-2 font-mono"
                  placeholder="acme"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Create organization
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        subtitle="Profiles are assignment targets. Give each team the artifacts and tools they should receive."
        action={<Button onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Close" : "New profile"}</Button>}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {showCreate ? (
        <Card className="py-0">
          <CardHeader className="border-b py-5">
            <CardTitle>Create profile</CardTitle>
            <CardDescription>
              Define a target group and the tools that should receive its assigned artifacts.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={newProfile.name}
                  onChange={(event) =>
                    setNewProfile((current) => ({ ...current, name: event.target.value }))
                  }
                  className="mt-2"
                  placeholder="Backend team"
                  required
                />
              </div>

              <div>
                <Label htmlFor="profile-description">Description</Label>
                <Input
                  id="profile-description"
                  value={newProfile.description}
                  onChange={(event) =>
                    setNewProfile((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-2"
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-3">
                <Label>Target tools</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TOOL_OPTIONS.map((tool) => {
                    const selected = newProfile.tools.includes(tool.value);
                    return (
                      <ToolToggleButton
                        key={tool.value}
                        label={tool.label}
                        selected={selected}
                        onClick={() => toggleTool(tool.value)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit">Create</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {profiles.length === 0 ? (
        <EmptyState
          title="No profiles yet"
          description="Create a profile first, then assign approved artifacts to it."
          action={<Button onClick={() => setShowCreate(true)}>Create profile</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <Link
              key={profile.id}
              to={`/app/profiles/${profile.id}`}
              className="group block"
            >
              <Card className="py-0 transition-colors group-hover:bg-muted/20">
                <CardContent className="space-y-4 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-base font-medium text-foreground">{profile.name}</div>
                      {profile.description ? (
                        <div className="text-sm text-muted-foreground">
                          {profile.description}
                        </div>
                      ) : null}
                    </div>
                    <StatusBadge tone="neutral">
                      {profile.assignmentCount || 0} assignment
                      {profile.assignmentCount === 1 ? "" : "s"}
                    </StatusBadge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {profile.tools.length > 0 ? (
                      profile.tools.map((tool) => (
                        <StatusBadge key={tool} tone="neutral">
                          {TOOL_LABELS[tool] || tool}
                        </StatusBadge>
                      ))
                    ) : (
                      <StatusBadge tone="warning">No target tools selected</StatusBadge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Need an invite link? Use{" "}
        <Link
          to="/app/fleet"
          className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-0")}
        >
          Fleet
        </Link>{" "}
        to generate one for new teammates.
      </div>
    </div>
  );
}
