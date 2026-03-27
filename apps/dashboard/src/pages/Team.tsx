import { useEffect, useMemo, useState } from "react";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { type StatusTone } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Device, FleetMemberStatus } from "@/lib/api";
import * as api from "@/lib/api";
import {
  machineDisplayName,
  machineKey,
  normalizeArch,
  normalizePlatform,
  releaseStateTone,
  timeAgo,
} from "@/lib/dashboard";

import { useAuth } from "../lib/auth";

type MachineGroup = {
  id: string;
  displayName: string;
  userName: string;
  userEmail: string;
  platform: string;
  arch: string;
  lastSeenAt: string | null;
  devices: Device[];
  tools: string[];
  clientLabels: string[];
  failedStates: number;
};

const duplicateMergeWindowMs = 12 * 60 * 60 * 1000;

function memberStatus(member: FleetMemberStatus): { tone: StatusTone; label: string } {
  if (member.deviceCount === 0) return { tone: "neutral", label: "No device" };
  if (member.failedStates > 0) return { tone: "danger", label: "Needs attention" };
  if (member.upToDate) return { tone: "success", label: "Healthy" };
  return { tone: "warning", label: "Pending" };
}

function canonicalRegistrationSignature(device: Device): string {
  const installedTools = installedToolNames(device).join(",");

  return [
    device.userId,
    device.clientKind,
    device.clientVersion,
    normalizePlatform(device.platform),
    normalizeArch(device.arch),
    installedTools,
  ].join("::");
}

function shouldMergeDuplicateRegistration(current: Device, candidate: Device): boolean {
  const currentSeen = current.lastSeenAt ? new Date(current.lastSeenAt).getTime() : 0;
  const candidateSeen = candidate.lastSeenAt ? new Date(candidate.lastSeenAt).getTime() : 0;
  return Math.abs(currentSeen - candidateSeen) <= duplicateMergeWindowMs;
}

function installedToolNames(device: Device): string[] {
  return device.tools
    .filter((tool) => tool.installed)
    .map((tool) => tool.tool)
    .sort();
}

function likelySameMachine(group: MachineGroup, device: Device): boolean {
  if (group.userEmail !== device.userEmail) return false;
  if (group.platform !== normalizePlatform(device.platform)) return false;
  if (group.arch !== normalizeArch(device.arch)) return false;

  const groupSeen = group.lastSeenAt ? new Date(group.lastSeenAt).getTime() : 0;
  const deviceSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
  if (Math.abs(groupSeen - deviceSeen) > duplicateMergeWindowMs) return false;

  const sameClient = group.devices.some((entry) => entry.clientKind === device.clientKind);
  if (!sameClient) return false;

  const groupTools = new Set(group.devices.flatMap((entry) => installedToolNames(entry)));
  const deviceTools = installedToolNames(device);
  return deviceTools.some((tool) => groupTools.has(tool));
}

function buildMachineGroups(devices: Device[]): MachineGroup[] {
  const sorted = [...devices].sort((left, right) => {
    const leftSeen = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : 0;
    const rightSeen = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : 0;
    return rightSeen - leftSeen;
  });

  const latestBySignature = new Map<string, Device>();
  const groups = new Map<string, MachineGroup>();

  for (const device of sorted) {
    const signature = canonicalRegistrationSignature(device);
    const canonicalDevice = latestBySignature.get(signature);

    let key = machineKey(device);
    if (canonicalDevice && shouldMergeDuplicateRegistration(canonicalDevice, device)) {
      key = machineKey(canonicalDevice);
    } else {
      const likelyGroup = Array.from(groups.values()).find((group) =>
        likelySameMachine(group, device)
      );
      if (likelyGroup) {
        key = likelyGroup.id;
      }
      latestBySignature.set(signature, device);
    }

    const existing = groups.get(key);
    if (existing) {
      existing.devices.push(device);
      existing.lastSeenAt =
        compareDate(device.lastSeenAt, existing.lastSeenAt) > 0
          ? device.lastSeenAt
          : existing.lastSeenAt;
      continue;
    }

    groups.set(key, {
      id: key,
      displayName: machineDisplayName(device),
      userName: device.userName,
      userEmail: device.userEmail,
      platform: normalizePlatform(device.platform),
      arch: normalizeArch(device.arch),
      lastSeenAt: device.lastSeenAt,
      devices: [device],
      tools: [],
      clientLabels: [],
      failedStates: 0,
    });
  }

  return Array.from(groups.values())
    .map((group) => {
      const tools = new Set<string>();
      const clientLabels = new Set<string>();
      let failedStates = 0;

      for (const device of group.devices) {
        clientLabels.add(`${device.clientKind} ${device.clientVersion}`);
        for (const tool of installedToolNames(device)) tools.add(tool);
        failedStates += device.states.filter((state) =>
          state.actualState.startsWith("failed")
        ).length;
      }

      group.devices.sort((left, right) => compareDate(right.lastSeenAt, left.lastSeenAt));
      return {
        ...group,
        tools: [...tools].sort(),
        clientLabels: [...clientLabels],
        failedStates,
      };
    })
    .sort((left, right) => compareDate(right.lastSeenAt, left.lastSeenAt));
}

function compareDate(left?: string | null, right?: string | null): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime - rightTime;
}

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState<api.FleetMemberStatus[]>([]);
  const [devices, setDevices] = useState<api.Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [expandedMachine, setExpandedMachine] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user?.orgId) return;
    void loadAll();
  }, [user?.orgId]);

  const loadAll = async () => {
    if (!user?.orgId) return;
    setLoading(true);

    try {
      const [statusData, devicesData] = await Promise.all([
        api.getSyncStatus(user.orgId),
        api.listDevices(user.orgId),
      ]);
      setMembers(statusData.members);
      setDevices(devicesData.devices);
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async () => {
    if (!user?.orgId) return;
    setInviteLoading(true);

    try {
      const data = await api.createInvite(user.orgId);
      setInviteCode(data.invite.code);
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const copyToClipboard = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const machineGroups = useMemo(() => buildMachineGroups(devices), [devices]);

  const summary = useMemo(() => {
    const failedMachines = machineGroups.filter((machine) => machine.failedStates > 0).length;
    const healthyMembers = members.filter((member) => member.upToDate).length;
    return {
      machineCount: machineGroups.length,
      registrationCount: devices.length,
      failedMachines,
      healthyMembers,
    };
  }, [devices.length, machineGroups, members]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet"
        subtitle="Track rollout health across people, machines, and the client registrations running on them."
        action={
          <Button variant="outline" onClick={() => void loadAll()}>
            Refresh
          </Button>
        }
      />

      {isAdmin ? (
        <Card className="py-0">
          <CardHeader className="border-b py-5">
            <CardTitle>Invite members</CardTitle>
            <CardDescription>
              Generate a join link for new teammates. They will create an account and attach
              their devices after first sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-5">
            <div className="flex flex-wrap gap-2">
              <Button onClick={generateInvite} disabled={inviteLoading}>
                {inviteLoading ? "Generating..." : "Generate invite link"}
              </Button>
              {inviteUrl ? (
                <Button variant="outline" onClick={copyToClipboard}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              ) : null}
            </div>

            {inviteUrl ? (
              <Input value={inviteUrl} readOnly className="font-mono text-sm" />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="py-0">
          <CardContent className="py-5">
            <div className="text-sm text-muted-foreground">Machines</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {summary.machineCount}
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="py-5">
            <div className="text-sm text-muted-foreground">Client registrations</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {summary.registrationCount}
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="py-5">
            <div className="text-sm text-muted-foreground">Healthy members</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {summary.healthyMembers}
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="py-5">
            <div className="text-sm text-muted-foreground">Machines with failures</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {summary.failedMachines}
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <EmptyState title="Loading fleet..." />
      ) : (
        <>
          <Card className="py-0">
            <CardHeader className="border-b py-5">
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Member status is based on the latest device sync and artifact verification state.
              </CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Artifact states</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No members yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const status = memberStatus(member);
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium text-foreground">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </TableCell>
                        <TableCell>{member.role}</TableCell>
                        <TableCell>
                          {member.deviceCount} · {timeAgo(member.lastSyncAt)}
                        </TableCell>
                        <TableCell>
                          {member.healthyStates} healthy / {member.failedStates} failed
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Machines
              </h2>
              <p className="text-sm text-muted-foreground">
                Multiple client registrations from the same machine are collapsed together here.
              </p>
            </div>

            {machineGroups.length === 0 ? (
              <EmptyState
                title="No machines registered"
                description="Run the CLI or tray client and sync once to register a device."
              />
            ) : (
              machineGroups.map((machine) => (
                <Card key={machine.id} className="py-0">
                  <CardContent className="space-y-4 py-5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMachine(
                          expandedMachine === machine.id ? null : machine.id
                        )
                      }
                      className="flex w-full cursor-pointer items-start justify-between gap-4 text-left"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-medium text-foreground">
                            {machine.displayName}
                          </div>
                          {machine.failedStates > 0 ? (
                            <StatusBadge tone="danger">Needs attention</StatusBadge>
                          ) : (
                            <StatusBadge tone="success">Healthy</StatusBadge>
                          )}
                          {machine.devices.length > 1 ? (
                            <StatusBadge tone="info">
                              {machine.devices.length} registrations collapsed
                            </StatusBadge>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {machine.userEmail} · {machine.clientLabels.join(", ")} ·{" "}
                          {machine.platform}/{machine.arch}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {machine.tools.length > 0 ? (
                            machine.tools.map((tool) => (
                              <StatusBadge key={tool} tone="neutral">
                                {tool}
                              </StatusBadge>
                            ))
                          ) : (
                            <StatusBadge tone="warning">
                              No compatible tools detected
                            </StatusBadge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Seen {timeAgo(machine.lastSeenAt)}
                      </div>
                    </button>

                    {expandedMachine === machine.id ? (
                      <div className="space-y-4 border-t pt-4">
                        {machine.devices.map((device) => (
                          <Card key={device.id} className="bg-muted/30 py-0">
                            <CardContent className="space-y-4 py-4">
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-foreground">
                                    {device.clientKind} {device.clientVersion}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {device.name} · {device.platform}/{device.arch}
                                  </div>
                                </div>
                                <StatusBadge tone="neutral">
                                  Seen {timeAgo(device.lastSeenAt)}
                                </StatusBadge>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {device.tools.filter((tool) => tool.installed).length > 0 ? (
                                  device.tools
                                    .filter((tool) => tool.installed)
                                    .map((tool) => (
                                      <StatusBadge key={tool.tool} tone="neutral">
                                        {tool.tool}
                                      </StatusBadge>
                                    ))
                                ) : (
                                  <StatusBadge tone="warning">
                                    No compatible tools detected
                                  </StatusBadge>
                                )}
                              </div>

                              {device.states.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                  No artifact states reported yet.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {device.states.map((state) => {
                                    const status = releaseStateTone(state.actualState);
                                    return (
                                      <div
                                        key={state.id}
                                        className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-start md:justify-between"
                                      >
                                        <div className="space-y-1">
                                          <div className="text-sm font-medium text-foreground">
                                            {state.artifactName}
                                          </div>
                                          <div className="text-sm font-mono text-muted-foreground">
                                            {state.artifactKind} · v{state.version} ·{" "}
                                            {state.reliabilityTier}
                                          </div>
                                          {state.lastErrorDetail ? (
                                            <div className="text-sm text-red-700">
                                              {state.lastErrorDetail}
                                            </div>
                                          ) : null}
                                        </div>
                                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
