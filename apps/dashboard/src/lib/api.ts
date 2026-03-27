const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8787";

export type ArtifactKind = "instructions" | "rule" | "agent" | "skill" | "mcp" | "plugin";
export type ReliabilityTier = "managed" | "best_effort" | "unreliable";

export interface Profile {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  tools: string[];
  assignmentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArtifactManifest {
  kind: ArtifactKind;
  reliabilityTier: ReliabilityTier;
  source: {
    type: string;
    ref: string;
    version?: string;
    digest?: string;
  };
  runtime: {
    kind: string;
    version?: string;
    provisionMode: string;
  };
  install: {
    strategy: string;
    managedRoot: string;
    wrapperName?: string;
  };
  launch?: {
    command: string;
    args: string[];
    env: Array<{ name: string; required: boolean; secretRef?: string; defaultValue?: string }>;
  };
  verify?: {
    type: string;
    command?: string;
    args?: string[];
    url?: string;
    timeoutMs?: number;
    expectedExitCode?: number;
  };
  payload?: {
    files?: Array<{ path: string; content: string; executable?: boolean; sha256?: string }>;
    downloadUrl?: string;
    archiveUrl?: string;
    checksum?: string;
    image?: string;
  };
  compatibility: {
    os: string[];
    arch: string[];
    tools: string[];
  };
  bindings: Array<{
    tool: string;
    bindingType: string;
    targetPath?: string;
    configTemplate?: string;
    configJson?: Record<string, unknown>;
  }>;
}

export interface ArtifactRelease {
  id: string;
  artifactId: string;
  version: string;
  status: string;
  reliabilityTier: ReliabilityTier;
  sourceType: string;
  sourceRef: string;
  sourceVersion?: string | null;
  digest?: string | null;
  manifest: ArtifactManifest;
  reviewNotes?: string | null;
  createdAt?: string;
  approvedAt?: string | null;
}

export interface Artifact {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  description: string | null;
  kind: ArtifactKind;
  releases: ArtifactRelease[];
  approvedRelease?: ArtifactRelease | null;
  profileAssignments?: Array<{
    id: string;
    profileId: string;
    profileName: string;
    artifactReleaseId: string;
    desiredState: string;
    rolloutStrategy: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileAssignment {
  assignment: {
    id: string;
    profileId: string;
    artifactReleaseId: string;
    desiredState: string;
    rolloutStrategy: string;
    rolloutJson?: Record<string, unknown> | null;
    createdAt?: string;
    updatedAt?: string;
  };
  artifact: Artifact;
  release: ArtifactRelease;
}

export interface Submission {
  id: string;
  title: string;
  description: string | null;
  status: string;
  artifactKind: ArtifactKind;
  sourceTool?: string | null;
  reliabilityTier: ReliabilityTier;
  rawCapture: Record<string, unknown>;
  normalizedPreview?: {
    manifest: ArtifactManifest;
    reliabilityTier: ReliabilityTier;
    status: string;
    notes: string[];
    name: string;
    kind: ArtifactKind;
  };
  normalizedReleaseId?: string | null;
  reviewNotes?: string | null;
  userName?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FleetMemberStatus {
  id: string;
  email: string;
  name: string;
  role: string;
  lastSyncAt: string | null;
  deviceCount: number;
  failedStates: number;
  healthyStates: number;
  upToDate: boolean;
}

export interface DeviceState {
  id: string;
  artifactReleaseId: string;
  artifactName: string;
  artifactKind: string;
  version: string;
  reliabilityTier: string;
  desiredState: string;
  actualState: string;
  activationState?: string | null;
  installRoot?: string | null;
  wrapperPath?: string | null;
  previousReleaseId?: string | null;
  lastErrorCode?: string | null;
  lastErrorDetail?: string | null;
  inventoryJson?: Record<string, unknown> | null;
  lastVerifiedAt?: string | null;
  lastTransitionAt?: string | null;
  updatedAt?: string | null;
}

export interface Device {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  platform: string;
  arch: string;
  clientKind: string;
  clientVersion: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  tools: Array<{
    tool: string;
    detectedVersion?: string | null;
    installed: boolean;
    details?: Record<string, unknown> | null;
    lastSeenAt?: string | null;
  }>;
  states: DeviceState[];
  inventory?: {
    snapshot: unknown;
    updatedAt: string;
  } | null;
}

function getToken(): string | null {
  return localStorage.getItem("lfc_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("lfc_token");
    localStorage.removeItem("lfc_user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data as T;
}

export async function login(email: string, password: string) {
  const data = await request<{ token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("lfc_token", data.token);
  localStorage.setItem("lfc_user", JSON.stringify(data.user));
  return data;
}

export async function register(name: string, email: string, password: string) {
  const data = await request<{ token: string; user: any; existingOrgs?: { orgId: string; orgName: string; memberCount: number }[] }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  localStorage.setItem("lfc_token", data.token);
  localStorage.setItem("lfc_user", JSON.stringify(data.user));
  return data;
}

export async function getMe() {
  return request<{ user: any }>("/api/auth/me");
}

export async function updateMe(data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) {
  return request<{ user: any }>("/api/auth/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createOrg(name: string, slug: string) {
  return request<{ org: any }>("/api/orgs", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
}

export async function getOrg(orgId: string) {
  return request<{ org: any }>(`/api/orgs/${orgId}`);
}

export async function updateOrg(orgId: string, data: { name?: string; slug?: string }) {
  return request<{ org: any }>(`/api/orgs/${orgId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function listProfiles(orgId: string) {
  return request<{ profiles: Profile[] }>(`/api/orgs/${orgId}/profiles`);
}

export async function createProfile(orgId: string, data: { name: string; description?: string; tools: string[] }) {
  return request<{ profile: Profile }>(`/api/orgs/${orgId}/profiles`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProfile(orgId: string, profileId: string) {
  return request<{ profile: Profile; assignments: ProfileAssignment[] }>(`/api/orgs/${orgId}/profiles/${profileId}`);
}

export async function updateProfile(orgId: string, profileId: string, data: Partial<Profile>) {
  return request<{ ok: boolean }>(`/api/orgs/${orgId}/profiles/${profileId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function listArtifacts(orgId: string) {
  return request<{ artifacts: Artifact[] }>(`/api/orgs/${orgId}/artifacts`);
}

export async function getArtifact(orgId: string, artifactId: string) {
  return request<{ artifact: Artifact }>(`/api/orgs/${orgId}/artifacts/${artifactId}`);
}

export async function createArtifact(
  orgId: string,
  data: {
    name: string;
    description?: string;
    slug?: string;
    kind: ArtifactKind;
    version: string;
    manifest: ArtifactManifest;
    approve?: boolean;
  }
) {
  return request<{ artifact: Artifact }>(`/api/orgs/${orgId}/artifacts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createArtifactRelease(
  orgId: string,
  artifactId: string,
  data: { version: string; manifest: ArtifactManifest; approve?: boolean }
) {
  return request<{ artifact: Artifact }>(`/api/orgs/${orgId}/artifacts/${artifactId}/releases`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approveArtifactRelease(orgId: string, releaseId: string) {
  return request<{ artifact: Artifact }>(`/api/orgs/${orgId}/artifacts/releases/${releaseId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function deprecateArtifactRelease(orgId: string, releaseId: string) {
  return request<{ artifact: Artifact }>(`/api/orgs/${orgId}/artifacts/releases/${releaseId}/deprecate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listProfileArtifacts(orgId: string, profileId: string) {
  return request<{ assignments: ProfileAssignment[] }>(`/api/orgs/${orgId}/profiles/${profileId}/artifacts`);
}

export async function assignProfileArtifact(
  orgId: string,
  profileId: string,
  data: {
    artifactReleaseId: string;
    desiredState?: string;
    rolloutStrategy?: string;
    rolloutJson?: Record<string, unknown> | null;
  }
) {
  return request<{ assignments: ProfileAssignment[] }>(`/api/orgs/${orgId}/profiles/${profileId}/artifacts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeProfileArtifactAssignment(orgId: string, profileId: string, assignmentId: string) {
  return request<{ assignments: ProfileAssignment[] }>(`/api/orgs/${orgId}/profiles/${profileId}/artifacts/${assignmentId}`, {
    method: "DELETE",
  });
}

export async function listSecrets(orgId: string) {
  return request<{ secrets: any[] }>(`/api/orgs/${orgId}/secrets`);
}

export async function createSecret(orgId: string, name: string, value: string) {
  return request<{ secret: any }>(`/api/orgs/${orgId}/secrets`, {
    method: "POST",
    body: JSON.stringify({ name, value }),
  });
}

export async function deleteSecret(orgId: string, secretId: string) {
  return request<{ ok: boolean }>(`/api/orgs/${orgId}/secrets/${secretId}`, {
    method: "DELETE",
  });
}

export async function listUsers(orgId: string) {
  return request<{ users: any[] }>(`/api/orgs/${orgId}/users`);
}

export async function createInvite(orgId: string) {
  return request<{ invite: any }>(`/api/orgs/${orgId}/invites`, {
    method: "POST",
  });
}

export async function getInvite(code: string) {
  return request<{ invite: any }>(`/api/invites/${code}`);
}

export async function acceptInvite(code: string) {
  return request<{ org: any }>(`/api/invites/${code}`, {
    method: "POST",
  });
}

export async function listSubmissions(orgId: string, status?: string) {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<{ submissions: Submission[] }>(`/api/orgs/${orgId}/submissions${params}`);
}

export async function normalizeSubmission(orgId: string, submissionId: string) {
  return request<{ normalizedPreview: Submission["normalizedPreview"] }>(`/api/orgs/${orgId}/submissions/${submissionId}/normalize`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function approveSubmission(
  orgId: string,
  submissionId: string,
  data: {
    artifactName?: string;
    description?: string;
    slug?: string;
    version?: string;
    manifest?: ArtifactManifest;
    profileIds?: string[];
    rolloutStrategy?: string;
    rolloutJson?: Record<string, unknown> | null;
  }
) {
  return request<{ artifact: Artifact }>(`/api/orgs/${orgId}/submissions/${submissionId}/approve`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function denySubmission(orgId: string, submissionId: string, reviewNotes?: string) {
  return request<{ ok: boolean }>(`/api/orgs/${orgId}/submissions/${submissionId}/deny`, {
    method: "POST",
    body: JSON.stringify({ reviewNotes }),
  });
}

export async function getSuggestionCount(orgId: string) {
  const data = await listSubmissions(orgId);
  return {
    count: data.submissions.filter((submission) => submission.status !== "approved" && submission.status !== "denied").length,
  };
}

export async function getSuggestions(orgId: string, status?: string) {
  return listSubmissions(orgId, status);
}

export async function createSuggestion(orgId: string, data: any) {
  return request<{ submission: Submission }>(`/api/orgs/${orgId}/submissions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approveSuggestion(orgId: string, suggestionId: string, data?: any) {
  return approveSubmission(orgId, suggestionId, data || {});
}

export async function denySuggestion(orgId: string, suggestionId: string, note?: string) {
  return denySubmission(orgId, suggestionId, note);
}

export async function getAuditLog(orgId: string, limit = 50, offset = 0) {
  return request<{ entries: any[]; total: number }>(`/api/orgs/${orgId}/audit?limit=${limit}&offset=${offset}`);
}

export async function getSyncStatus(orgId: string) {
  return request<{ members: FleetMemberStatus[] }>(`/api/orgs/${orgId}/status`);
}

export async function listDevices(orgId: string) {
  return request<{ devices: Device[] }>(`/api/orgs/${orgId}/devices`);
}
