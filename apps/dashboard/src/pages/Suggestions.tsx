import { useEffect, useMemo, useState } from "react";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/lib/api";
import { reliabilityTone, submissionStatusTone, timeAgo } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

import { useAuth } from "../lib/auth";

type Tab = "open" | "approved" | "denied" | "all";

export default function Suggestions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<api.Submission[]>([]);
  const [profiles, setProfiles] = useState<api.Profile[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, string[]>>({});
  const [denyNotes, setDenyNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.orgId) return;
    void loadData();
  }, [user?.orgId]);

  const loadData = async () => {
    if (!user?.orgId) return;
    setLoading(true);

    try {
      const [submissionsData, profilesData] = await Promise.all([
        api.listSubmissions(user.orgId),
        api.listProfiles(user.orgId),
      ]);
      setSubmissions(submissionsData.submissions);
      setProfiles(profilesData.profiles);

      const firstProfileId = profilesData.profiles[0]?.id;
      if (firstProfileId) {
        setSelectedProfiles((current) => {
          const next = { ...current };
          for (const submission of submissionsData.submissions) {
            if (!next[submission.id]) next[submission.id] = [firstProfileId];
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const openCount = useMemo(
    () =>
      submissions.filter(
        (submission) => submission.status !== "approved" && submission.status !== "denied"
      ).length,
    [submissions]
  );

  const filtered = useMemo(() => {
    if (activeTab === "all") return submissions;
    if (activeTab === "open") {
      return submissions.filter(
        (submission) => submission.status !== "approved" && submission.status !== "denied"
      );
    }
    return submissions.filter((submission) => submission.status === activeTab);
  }, [activeTab, submissions]);

  const toggleProfile = (submissionId: string, profileId: string) => {
    setSelectedProfiles((current) => {
      const values = current[submissionId] || [];
      const next = values.includes(profileId)
        ? values.filter((value) => value !== profileId)
        : [...values, profileId];
      return { ...current, [submissionId]: next };
    });
  };

  const handleApprove = async (submission: api.Submission) => {
    if (!user?.orgId) return;
    setBusyId(submission.id);

    try {
      await api.approveSubmission(user.orgId, submission.id, {
        profileIds: selectedProfiles[submission.id] || [],
        artifactName: submission.normalizedPreview?.name || submission.title,
        description: submission.description || undefined,
        version: "1.0.0",
      });
      await loadData();
      window.dispatchEvent(new Event("lfc:submissions-changed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeny = async (submissionId: string) => {
    if (!user?.orgId) return;
    setBusyId(submissionId);

    try {
      await api.denySubmission(user.orgId, submissionId, denyNotes[submissionId]);
      await loadData();
      window.dispatchEvent(new Event("lfc:submissions-changed"));
    } finally {
      setBusyId(null);
    }
  };

  const tabs = [
    { id: "open" as const, label: "Open", count: openCount },
    { id: "approved" as const, label: "Approved" },
    { id: "denied" as const, label: "Denied" },
    { id: "all" as const, label: "All" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submissions"
        subtitle="Review artifacts discovered by teammates, normalize them, and promote the ones that should become releases."
        action={openCount > 0 ? <StatusBadge tone="info">{openCount} open</StatusBadge> : null}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab((value as Tab) || "open")}
      >
        <TabsList className="w-full justify-start">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="px-3">
              {tab.label}
              {tab.count ? (
                <StatusBadge tone="info" className="ml-1">
                  {tab.count}
                </StatusBadge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <EmptyState title="Loading submissions..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No submissions in this view"
          description="When teammates share new artifacts, they will appear here for review."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((submission) => {
            const expanded = expandedId === submission.id;
            const isOpen =
              submission.status !== "approved" && submission.status !== "denied";

            return (
              <Card key={submission.id} className="py-0">
                <CardContent className="space-y-4 py-5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : submission.id)}
                    className="flex w-full cursor-pointer items-start justify-between gap-4 text-left"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-medium text-foreground">
                          {submission.title}
                        </div>
                        <StatusBadge tone="neutral">{submission.artifactKind}</StatusBadge>
                        <StatusBadge tone={reliabilityTone(submission.reliabilityTier)}>
                          {submission.reliabilityTier}
                        </StatusBadge>
                        <StatusBadge tone={submissionStatusTone(submission.status)}>
                          {submission.status}
                        </StatusBadge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {(submission.userName || submission.userEmail || "Unknown user") +
                          " · " +
                          (submission.sourceTool ||
                            submission.rawCapture.tool?.toString() ||
                            "unknown tool") +
                          " · " +
                          timeAgo(submission.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {expanded ? "Hide" : "Review"}
                    </div>
                  </button>

                  {expanded ? (
                    <div className="space-y-4 border-t pt-4">
                      {submission.description ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {submission.description}
                        </p>
                      ) : null}

                      {submission.normalizedPreview?.notes?.length ? (
                        <Card className="bg-muted/30 py-0">
                          <CardHeader className="border-b py-4">
                            <CardTitle>Normalization notes</CardTitle>
                            <CardDescription>
                              Why this artifact was marked managed, best-effort, or unreliable.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 py-4">
                            {submission.normalizedPreview.notes.map((note, index) => (
                              <div key={index} className="text-sm text-muted-foreground">
                                {note}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ) : null}

                      <Card className="bg-muted/30 py-0">
                        <CardHeader className="border-b py-4">
                          <CardTitle>Resolved manifest</CardTitle>
                          <CardDescription>
                            This is the exact payload that would be published if approved.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="py-4">
                          <pre className="max-h-80 overflow-auto rounded-lg border bg-background p-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap break-words">
                            {JSON.stringify(
                              submission.normalizedPreview?.manifest || submission.rawCapture,
                              null,
                              2
                            )}
                          </pre>
                        </CardContent>
                      </Card>

                      {user?.role === "admin" && isOpen ? (
                        <Card className="bg-muted/30 py-0">
                          <CardHeader className="border-b py-4">
                            <CardTitle>Approval targets</CardTitle>
                            <CardDescription>
                              Pick the profiles that should receive this artifact on approval.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4 py-4">
                            {profiles.length === 0 ? (
                              <div className="text-sm text-muted-foreground">
                                Create a profile before approving this artifact.
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {profiles.map((profile) => {
                                  const selected = (
                                    selectedProfiles[submission.id] || []
                                  ).includes(profile.id);

                                  return (
                                    <button
                                      key={profile.id}
                                      type="button"
                                      onClick={() => toggleProfile(submission.id, profile.id)}
                                      className={cn(
                                        buttonVariants({
                                          variant: selected ? "secondary" : "outline",
                                          size: "sm",
                                        }),
                                        "cursor-pointer"
                                      )}
                                    >
                                      {profile.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div className="space-y-3">
                              <Textarea
                                value={denyNotes[submission.id] || ""}
                                onChange={(event) =>
                                  setDenyNotes((current) => ({
                                    ...current,
                                    [submission.id]: event.target.value,
                                  }))
                                }
                                className="min-h-24"
                                placeholder="Optional denial note or review comment"
                              />

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  disabled={busyId === submission.id || profiles.length === 0}
                                  onClick={() => void handleApprove(submission)}
                                >
                                  {busyId === submission.id
                                    ? "Applying..."
                                    : "Approve and publish"}
                                </Button>
                                <Button
                                  variant="destructive"
                                  disabled={busyId === submission.id}
                                  onClick={() => void handleDeny(submission.id)}
                                >
                                  Deny
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
