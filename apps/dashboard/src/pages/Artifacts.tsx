import { useEffect, useState } from "react";

import EmptyState from "@/components/EmptyState";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/lib/api";
import { reliabilityTone, TOOL_LABELS, TOOL_OPTIONS } from "@/lib/dashboard";

import { useAuth } from "../lib/auth";

const KIND_OPTIONS: api.ArtifactKind[] = ["instructions", "skill", "agent", "rule"];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Artifacts() {
  const { user } = useAuth();
  const [artifacts, setArtifacts] = useState<api.Artifact[]>([]);
  const [profiles, setProfiles] = useState<api.Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    kind: "instructions" as api.ArtifactKind,
    tool: "claude-code",
    content: "",
    profileId: "",
  });

  useEffect(() => {
    if (!user?.orgId) return;
    void loadAll();
  }, [user?.orgId]);

  const loadAll = async () => {
    if (!user?.orgId) return;
    setLoading(true);

    try {
      const [artifactsData, profilesData] = await Promise.all([
        api.listArtifacts(user.orgId),
        api.listProfiles(user.orgId),
      ]);
      setArtifacts(artifactsData.artifacts);
      setProfiles(profilesData.profiles);

      if (!form.profileId && profilesData.profiles[0]) {
        setForm((current) => ({ ...current, profileId: profilesData.profiles[0].id }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.orgId) return;
    setError("");
    setMessage("");

    const bindingType = form.kind === "instructions" ? "instructions" : form.kind;
    const manifest: api.ArtifactManifest = {
      kind: form.kind,
      reliabilityTier: "managed",
      source: {
        type: "inline_files",
        ref: `inline:${slugify(form.name) || "artifact"}`,
      },
      runtime: {
        kind: "none",
        provisionMode: "managed",
      },
      install: {
        strategy: "copy_files",
        managedRoot: "~/.lfc/artifacts",
      },
      verify: {
        type: "none",
      },
      payload: {
        files: [
          {
            path: `${bindingType}.md`,
            content: form.content,
          },
        ],
      },
      compatibility: {
        os: ["darwin", "linux", "windows"],
        arch: ["x64", "arm64"],
        tools: [form.tool],
      },
      bindings: [
        {
          tool: form.tool,
          bindingType,
        },
      ],
    };

    try {
      const created = await api.createArtifact(user.orgId, {
        name: form.name,
        description: form.description || undefined,
        kind: form.kind,
        version: "1.0.0",
        approve: true,
        manifest,
      });

      if (form.profileId && created.artifact.approvedRelease) {
        await api.assignProfileArtifact(user.orgId, form.profileId, {
          artifactReleaseId: created.artifact.approvedRelease.id,
          desiredState: "active",
          rolloutStrategy: "all_at_once",
        });
      }

      setShowCreate(false);
      setForm({
        name: "",
        description: "",
        kind: "instructions",
        tool: "claude-code",
        content: "",
        profileId: profiles[0]?.id || "",
      });
      setMessage("Artifact created");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create artifact");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Artifacts"
        subtitle="Immutable releases that can be assigned across profiles and pushed onto compatible devices."
        action={
          <Button onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Close" : "New inline artifact"}
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <AlertDescription className="text-emerald-700">{message}</AlertDescription>
        </Alert>
      ) : null}

      {showCreate ? (
        <Card className="py-0">
          <CardHeader className="border-b py-5">
            <CardTitle>Create inline artifact</CardTitle>
            <CardDescription>
              Use this for instructions, skills, agents, and rules that can be stored as
              managed files.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="artifact-name">Name</Label>
                <Input
                  id="artifact-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="mt-2"
                  placeholder="Team instructions"
                  required
                />
              </div>

              <div>
                <Label htmlFor="artifact-description">Description</Label>
                <Input
                  id="artifact-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="mt-2"
                  placeholder="Optional"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Kind</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        kind: value as api.ArtifactKind,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Choose a kind" />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {kind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tool</Label>
                  <Select
                    value={form.tool}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        tool: value || current.tool,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Choose a tool" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOL_OPTIONS.filter((tool) => tool.value !== "claude-desktop").map(
                        (tool) => (
                          <SelectItem key={tool.value} value={tool.value}>
                            {tool.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Assign to profile</Label>
                  <Select
                    value={form.profileId || "__none__"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        profileId: !value || value === "__none__" ? "" : value,
                      }))
                    }
                  >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Create without assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Create without assignment</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="artifact-content">Content</Label>
                <Textarea
                  id="artifact-content"
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content: event.target.value }))
                  }
                  className="mt-2 min-h-56 font-mono text-sm"
                  placeholder="Write the artifact content..."
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit">Create artifact</Button>
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

      {loading ? (
        <EmptyState title="Loading artifacts..." />
      ) : artifacts.length === 0 ? (
        <EmptyState
          title="No artifacts yet"
          description="Create an inline artifact or approve a submission to build your first release."
          action={<Button onClick={() => setShowCreate(true)}>Create artifact</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {artifacts.map((artifact) => {
            const release = artifact.approvedRelease;

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
                        {release ? (
                          <StatusBadge tone={reliabilityTone(release.reliabilityTier)}>
                            {release.reliabilityTier}
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">No approved release</StatusBadge>
                        )}
                      </div>
                      {artifact.description ? (
                        <p className="text-sm text-muted-foreground">{artifact.description}</p>
                      ) : null}
                      {release ? (
                        <div className="text-sm font-mono text-muted-foreground">
                          v{release.version} · {release.sourceType} · {release.sourceRef}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(release?.manifest.compatibility.tools || []).map((tool) => (
                        <StatusBadge key={tool} tone="neutral">
                          {TOOL_LABELS[tool] || tool}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>

                  {artifact.profileAssignments?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {artifact.profileAssignments.map((assignment) => (
                        <StatusBadge key={assignment.id} tone="info">
                          {assignment.profileName}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Not assigned to any profile yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
