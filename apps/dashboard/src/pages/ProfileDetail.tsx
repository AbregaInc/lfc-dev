import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

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
import * as api from "@/lib/api";
import { manifestBindingBadges, reliabilityTone, TOOL_OPTIONS } from "@/lib/dashboard";

import { useAuth } from "../lib/auth";

export default function ProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<api.Profile | null>(null);
  const [assignments, setAssignments] = useState<api.ProfileAssignment[]>([]);
  const [artifacts, setArtifacts] = useState<api.Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.orgId || !id) return;
    void loadData();
  }, [user?.orgId, id]);

  const loadData = async () => {
    if (!user?.orgId || !id) return;
    setLoading(true);

    try {
      const [profileData, artifactsData] = await Promise.all([
        api.getProfile(user.orgId, id),
        api.listArtifacts(user.orgId),
      ]);
      setProfile(profileData.profile);
      setAssignments(profileData.assignments);
      setArtifacts(artifactsData.artifacts);
    } catch (err: any) {
      setMessage(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const assignedReleaseIds = useMemo(
    () => new Set(assignments.map((item) => item.release.id)),
    [assignments]
  );

  const availableArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.approvedRelease),
    [artifacts]
  );

  const updateTools = async (tools: string[]) => {
    if (!user?.orgId || !id || !profile) return;
    await api.updateProfile(user.orgId, id, { tools });
    setProfile({ ...profile, tools });
  };

  const assignArtifact = async (artifact: api.Artifact) => {
    if (!user?.orgId || !id || !artifact.approvedRelease) return;
    setSaving(true);
    setMessage("");

    try {
      const result = await api.assignProfileArtifact(user.orgId, id, {
        artifactReleaseId: artifact.approvedRelease.id,
        desiredState: "active",
        rolloutStrategy: "all_at_once",
      });
      setAssignments(result.assignments);
      setMessage(`Assigned ${artifact.name}`);
    } catch (err: any) {
      setMessage(err.message || "Failed to assign artifact");
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!user?.orgId || !id) return;
    setSaving(true);
    setMessage("");

    try {
      const result = await api.removeProfileArtifactAssignment(user.orgId, id, assignmentId);
      setAssignments(result.assignments);
      setMessage("Assignment removed");
    } catch (err: any) {
      setMessage(err.message || "Failed to remove assignment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <EmptyState title="Loading profile..." />;
  }

  if (!profile) {
    return <EmptyState title="Profile not found" />;
  }

  const messageTone = message.toLowerCase().includes("failed") ? "destructive" : "default";

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.name}
        subtitle={profile.description || "Define which tools this profile targets and what releases it receives."}
        action={
          <Button variant="outline" onClick={() => void loadData()}>
            Refresh
          </Button>
        }
      />

      {message ? (
        <Alert
          variant={messageTone === "destructive" ? "destructive" : "default"}
          className={
            messageTone === "destructive"
              ? undefined
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }
        >
          <AlertDescription
            className={messageTone === "destructive" ? undefined : "text-emerald-700"}
          >
            {message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="py-0">
        <CardHeader className="border-b py-5">
          <CardTitle>Target tools</CardTitle>
          <CardDescription>
            Only devices with these tools installed will receive compatible artifacts for this
            profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {TOOL_OPTIONS.map((tool) => {
              const selected = profile.tools.includes(tool.value);
              return (
                <ToolToggleButton
                  key={tool.value}
                  label={tool.label}
                  selected={selected}
                  onClick={() => {
                    const nextTools = selected
                      ? profile.tools.filter((value) => value !== tool.value)
                      : [...profile.tools, tool.value];
                    void updateTools(nextTools);
                  }}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Assigned artifacts
            </h2>
            <p className="text-sm text-muted-foreground">
              {assignments.length} active assignment{assignments.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <EmptyState
            title="No artifacts assigned yet"
            description="Assign an approved artifact below to start pushing content to this profile."
          />
        ) : (
          <div className="grid gap-4">
            {assignments.map((item) => (
              <Card key={item.assignment.id} className="py-0">
                <CardContent className="space-y-4 py-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-medium text-foreground">
                          {item.artifact.name}
                        </div>
                        <StatusBadge tone="neutral">{item.artifact.kind}</StatusBadge>
                        <StatusBadge tone={reliabilityTone(item.release.reliabilityTier)}>
                          {item.release.reliabilityTier}
                        </StatusBadge>
                      </div>
                      <div className="text-sm font-mono text-muted-foreground">
                        v{item.release.version} · {item.release.sourceType} ·{" "}
                        {item.release.sourceRef}
                      </div>
                      {manifestBindingBadges(item.release.manifest).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {manifestBindingBadges(item.release.manifest).map((badge) => (
                            <StatusBadge key={badge} tone="neutral">
                              {badge}
                            </StatusBadge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      variant="destructive"
                      disabled={saving}
                      onClick={() => void removeAssignment(item.assignment.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Available approved artifacts
            </h2>
            <p className="text-sm text-muted-foreground">
              Only approved releases can be assigned to this profile.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadData()}>
            Refresh
          </Button>
        </div>

        {availableArtifacts.length === 0 ? (
          <EmptyState
            title="No approved artifacts yet"
            description="Approve a submission or create an artifact first."
          />
        ) : (
          <div className="grid gap-4">
            {availableArtifacts.map((artifact) => {
              const release = artifact.approvedRelease!;
              const assigned = assignedReleaseIds.has(release.id);

              return (
                <Card key={artifact.id} className="py-0">
                  <CardContent className="space-y-4 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-medium text-foreground">
                            {artifact.name}
                          </div>
                          <StatusBadge tone="neutral">{artifact.kind}</StatusBadge>
                          <StatusBadge tone={reliabilityTone(release.reliabilityTier)}>
                            {release.reliabilityTier}
                          </StatusBadge>
                        </div>
                        {artifact.description ? (
                          <p className="text-sm text-muted-foreground">
                            {artifact.description}
                          </p>
                        ) : null}
                        <div className="text-sm font-mono text-muted-foreground">
                          v{release.version} · {release.sourceType} · {release.sourceRef}
                        </div>
                        {manifestBindingBadges(release.manifest).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {manifestBindingBadges(release.manifest).map((badge) => (
                              <StatusBadge key={badge} tone="neutral">
                                {badge}
                              </StatusBadge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        variant={assigned ? "outline" : "default"}
                        disabled={assigned || saving}
                        onClick={() => void assignArtifact(artifact)}
                      >
                        {assigned ? "Assigned" : "Assign"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
