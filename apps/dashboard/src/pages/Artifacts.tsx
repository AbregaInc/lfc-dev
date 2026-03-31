import { useEffect, useState } from "react";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ToolToggleButton from "@/components/ToolToggleButton";
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
import {
  bindingScopeDescription,
  bindingScopeLabel,
  compatibleToolsForBindingType,
  manifestBindingBadges,
  reliabilityTone,
  resolveBindingScope,
} from "@/lib/dashboard";

import { useAuth } from "../lib/auth";

const KIND_OPTIONS: api.ArtifactKind[] = ["instructions", "skill", "agent", "rule"];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bindingTypeForKind(kind: api.ArtifactKind) {
  return kind === "instructions" ? "instructions" : kind;
}

function defaultToolsForKind(kind: api.ArtifactKind) {
  return compatibleToolsForBindingType(bindingTypeForKind(kind)).map((tool) => tool.value);
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
    tools: defaultToolsForKind("instructions"),
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

    const bindingType = bindingTypeForKind(form.kind);
    if (form.tools.length === 0) {
      setError("Select at least one compatible tool.");
      return;
    }

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
        tools: form.tools,
      },
      bindings: form.tools.map((tool) => ({
        tool,
        bindingType,
        scope: resolveBindingScope(tool, bindingType),
      })),
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
        tools: defaultToolsForKind("instructions"),
        content: "",
        profileId: profiles[0]?.id || "",
      });
      setMessage("Artifact created");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create artifact");
    }
  };

  const bindingType = bindingTypeForKind(form.kind);
  const compatibleToolOptions = compatibleToolsForBindingType(bindingType);
  const selectedTools = compatibleToolOptions.filter((tool) => form.tools.includes(tool.value));

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
            <div className="mb-4 rounded-xl border border-dashed bg-muted/15 px-4 py-3">
              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    This artifact will be published to {selectedTools.length} binding
                    {selectedTools.length === 1 ? "" : "s"}.
                  </div>
                  <p className="text-sm text-muted-foreground">
                    One release can target multiple compatible tools. Each binding keeps its own
                    user-global or project-wide scope.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTools.map((tool) => {
                    const bindingScope = resolveBindingScope(tool.value, bindingType);
                    return (
                      <StatusBadge key={tool.value} tone={bindingScope === "project" ? "info" : "warning"}>
                        {tool.label} · {bindingScopeLabel(bindingScope)}
                      </StatusBadge>
                    );
                  })}
                  {selectedTools.length === 0 ? (
                    <StatusBadge tone="danger">No bindings selected</StatusBadge>
                  ) : null}
                </div>
              </div>
            </div>

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
                    onValueChange={(value) => {
                      const nextKind = value as api.ArtifactKind;
                      const nextCompatibleTools = defaultToolsForKind(nextKind);
                      setForm((current) => ({
                        ...current,
                        kind: nextKind,
                        tools: current.tools.filter((tool) => nextCompatibleTools.includes(tool)).length
                          ? current.tools.filter((tool) => nextCompatibleTools.includes(tool))
                          : nextCompatibleTools,
                      }))
                    }}
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
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Target tools</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select every compatible tool that should receive this artifact when assigned.
                    </p>
                  </div>
                  {compatibleToolOptions.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          tools:
                            current.tools.length === compatibleToolOptions.length
                              ? [compatibleToolOptions[0].value]
                              : compatibleToolOptions.map((tool) => tool.value),
                        }))
                      }
                    >
                      {form.tools.length === compatibleToolOptions.length ? "Keep one" : "Select all"}
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {compatibleToolOptions.map((tool) => {
                    const selected = form.tools.includes(tool.value);
                    const scope = resolveBindingScope(tool.value, bindingType);
                    return (
                      <ToolToggleButton
                        key={tool.value}
                        label={`${tool.label} · ${bindingScopeLabel(scope)}`}
                        selected={selected}
                        onClick={() =>
                          setForm((current) => {
                            const alreadySelected = current.tools.includes(tool.value);
                            const nextTools = alreadySelected
                              ? current.tools.filter((value) => value !== tool.value)
                              : [...current.tools, tool.value];
                            return { ...current, tools: nextTools };
                          })
                        }
                      />
                    );
                  })}
                </div>

                {selectedTools.length > 0 ? (
                  <div className="rounded-xl border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                    {selectedTools.map((tool) => (
                      <div key={tool.value}>
                        <span className="font-medium text-foreground">{tool.label}</span>:{" "}
                        {bindingScopeDescription(
                          tool.value,
                          bindingType,
                          resolveBindingScope(tool.value, bindingType)
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
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
                      {manifestBindingBadges(release?.manifest).map((badge) => (
                        <StatusBadge key={badge} tone="neutral">
                          {badge}
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
