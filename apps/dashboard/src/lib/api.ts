const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

// ─── Auth ────────────────────────────────────────────────────────────

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

// ─── Orgs ────────────────────────────────────────────────────────────

export async function createOrg(name: string, slug: string) {
  return request<{ org: any }>("/api/orgs", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
}

export async function getOrg(orgId: string) {
  return request<{ org: any }>(`/api/orgs/${orgId}`);
}

// ─── Profiles ────────────────────────────────────────────────────────

export async function listProfiles(orgId: string) {
  return request<{ profiles: any[] }>(`/api/orgs/${orgId}/profiles`);
}

export async function createProfile(orgId: string, data: { name: string; description?: string; tools: string[] }) {
  return request<{ profile: any }>(`/api/orgs/${orgId}/profiles`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProfile(orgId: string, profileId: string) {
  return request<{ profile: any; configs: any[] }>(`/api/orgs/${orgId}/profiles/${profileId}`);
}

export async function updateProfile(orgId: string, profileId: string, data: any) {
  return request<{ ok: boolean }>(`/api/orgs/${orgId}/profiles/${profileId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── Configs ─────────────────────────────────────────────────────────

export async function listConfigs(orgId: string, profileId: string) {
  return request<{ configs: any[] }>(`/api/orgs/${orgId}/profiles/${profileId}/configs`);
}

export async function upsertConfig(orgId: string, profileId: string, configType: string, content: string) {
  return request<{ config: any }>(`/api/orgs/${orgId}/profiles/${profileId}/configs`, {
    method: "POST",
    body: JSON.stringify({ configType, content }),
  });
}

export async function deleteConfig(orgId: string, profileId: string, configId: string) {
  return request<{ ok: boolean }>(`/api/orgs/${orgId}/profiles/${profileId}/configs/${configId}`, {
    method: "DELETE",
  });
}

// ─── Secrets ─────────────────────────────────────────────────────────

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

// ─── Users ───────────────────────────────────────────────────────────

export async function listUsers(orgId: string) {
  return request<{ users: any[] }>(`/api/orgs/${orgId}/users`);
}

// ─── Invites ─────────────────────────────────────────────────────────

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

// ─── Suggestions ────────────────────────────────────────────────────

export async function getSuggestions(orgId: string, status?: string) {
  const params = status ? `?status=${status}` : "";
  return request<{ suggestions: any[] }>(`/api/orgs/${orgId}/suggestions${params}`);
}

export async function getSuggestionCount(orgId: string) {
  return request<{ count: number }>(`/api/orgs/${orgId}/suggestions/count`);
}

export async function createSuggestion(orgId: string, data: any) {
  return request<{ suggestion: any }>(`/api/orgs/${orgId}/suggestions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approveSuggestion(orgId: string, suggestionId: string, data?: any) {
  return request<{ ok: boolean }>(`/api/orgs/${orgId}/suggestions/${suggestionId}/approve`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

export async function denySuggestion(orgId: string, suggestionId: string, note?: string) {
  return request<{ ok: boolean }>(`/api/orgs/${orgId}/suggestions/${suggestionId}/deny`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

// ─── Audit ──────────────────────────────────────────────────────────

export async function getAuditLog(orgId: string, limit = 50, offset = 0) {
  return request<{ entries: any[]; total: number }>(`/api/orgs/${orgId}/audit?limit=${limit}&offset=${offset}`);
}

// ─── Status ─────────────────────────────────────────────────────────

export async function getSyncStatus(orgId: string) {
  return request<{ members: any[] }>(`/api/orgs/${orgId}/status`);
}

// ─── Inventory ─────────────────────────────────────────────────────

export async function getInventory(orgId: string) {
  return request<{ members: any[]; inventory: any[] }>(`/api/orgs/${orgId}/inventory`);
}
