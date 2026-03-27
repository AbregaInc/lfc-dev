import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { getSecretMap, listDesiredAssignmentsForUser } from "../data.js";
import { secretRefsForManifest } from "../manifests.js";
import { nowIso, parseJson, toJson } from "../utils.js";
import { logAudit } from "../audit.js";

const devices = new Hono<AppEnv>();

type DetectedToolInput = {
  tool: string;
  detectedVersion?: string;
  installed: boolean;
  details?: Record<string, unknown>;
};

type DeviceStateInput = {
  artifactReleaseId: string;
  desiredState?: string;
  actualState?: string;
  activationState?: string;
  installRoot?: string;
  wrapperPath?: string;
  previousReleaseId?: string;
  lastErrorCode?: string;
  lastErrorDetail?: string;
  inventoryJson?: Record<string, unknown>;
  lastVerifiedAt?: string;
  lastTransitionAt?: string;
};

async function upsertDeviceTools(db: D1Database, deviceId: string, detectedTools: DetectedToolInput[]) {
  const seen = new Set<string>();
  for (const detectedTool of detectedTools) {
    if (!detectedTool.tool) continue;
    seen.add(detectedTool.tool);
    await db
      .prepare(
        `INSERT INTO device_tools
           (device_id, tool, detected_version, installed, details_json, last_seen_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(device_id, tool) DO UPDATE SET
           detected_version = excluded.detected_version,
           installed = excluded.installed,
           details_json = excluded.details_json,
           last_seen_at = datetime('now')`
      )
      .bind(
        deviceId,
        detectedTool.tool,
        detectedTool.detectedVersion || null,
        detectedTool.installed ? 1 : 0,
        toJson(detectedTool.details || null)
      )
      .run();
  }
  if (seen.size === 0) return;
}

devices.use("/devices/*", authMiddleware);
devices.use("/orgs/*/devices*", authMiddleware);

devices.post("/devices/register", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const body = await c.req.json();
  const { deviceId, name, platform, arch, clientKind, clientVersion, detectedTools } = body as {
    deviceId?: string;
    name?: string;
    platform?: string;
    arch?: string;
    clientKind?: string;
    clientVersion?: string;
    detectedTools?: DetectedToolInput[];
  };

  if (!user.orgId) return c.json({ error: "User is not part of an organization" }, 400);
  if (!name || !platform || !arch || !clientKind || !clientVersion) {
    return c.json({ error: "name, platform, arch, clientKind, and clientVersion are required" }, 400);
  }

  const resolvedDeviceId = deviceId || crypto.randomUUID();
  const existing = await db
    .prepare("SELECT id FROM devices WHERE id = ? AND user_id = ?")
    .bind(resolvedDeviceId, user.id)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE devices
         SET name = ?, platform = ?, arch = ?, client_kind = ?, client_version = ?,
             status = 'online', last_seen_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(name, platform, arch, clientKind, clientVersion, resolvedDeviceId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO devices
           (id, org_id, user_id, name, platform, arch, client_kind, client_version, status, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', datetime('now'))`
      )
      .bind(resolvedDeviceId, user.orgId, user.id, name, platform, arch, clientKind, clientVersion)
      .run();
  }

  await upsertDeviceTools(db, resolvedDeviceId, Array.isArray(detectedTools) ? detectedTools : []);

  const device = await db
    .prepare(
      `SELECT id, org_id as orgId, user_id as userId, name, platform, arch,
              client_kind as clientKind, client_version as clientVersion,
              status, last_seen_at as lastSeenAt, created_at as createdAt, updated_at as updatedAt
       FROM devices
       WHERE id = ?`
    )
    .bind(resolvedDeviceId)
    .first();

  await logAudit(db, user.orgId, user.id, "device.registered", "device", resolvedDeviceId, {
    clientKind,
    clientVersion,
  });

  return c.json({
    device,
    featureFlags: {
      artifactSyncV2: true,
      managedInstallers: true,
      unreliableArtifacts: true,
    },
  });
});

devices.post("/devices/:deviceId/sync", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const { deviceId } = c.req.param() as { deviceId: string };

  if (!user.orgId) return c.json({ error: "User is not part of an organization" }, 400);

  const device = await db
    .prepare(
      `SELECT id, org_id as orgId, user_id as userId, name, platform, arch,
              client_kind as clientKind, client_version as clientVersion,
              status, last_seen_at as lastSeenAt, created_at as createdAt, updated_at as updatedAt
       FROM devices
       WHERE id = ? AND user_id = ?`
    )
    .bind(deviceId, user.id)
    .first<any>();

  if (!device) return c.json({ error: "Device not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const detectedTools = (Array.isArray(body.detectedTools) ? body.detectedTools : []) as DetectedToolInput[];
  const states = (Array.isArray(body.states) ? body.states : []) as DeviceStateInput[];
  const inventory = body.inventory ?? null;

  await db
    .prepare("UPDATE devices SET status = 'online', last_seen_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .bind(deviceId)
    .run();

  await upsertDeviceTools(db, deviceId, detectedTools);

  for (const state of states) {
    if (!state || typeof state.artifactReleaseId !== "string") continue;
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO device_artifact_states
           (id, device_id, artifact_release_id, desired_state, actual_state, activation_state, install_root,
            wrapper_path, previous_release_id, last_error_code, last_error_detail, inventory_json, last_verified_at,
            last_transition_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(device_id, artifact_release_id) DO UPDATE SET
           desired_state = excluded.desired_state,
           actual_state = excluded.actual_state,
           activation_state = excluded.activation_state,
           install_root = excluded.install_root,
           wrapper_path = excluded.wrapper_path,
           previous_release_id = excluded.previous_release_id,
           last_error_code = excluded.last_error_code,
           last_error_detail = excluded.last_error_detail,
           inventory_json = excluded.inventory_json,
           last_verified_at = excluded.last_verified_at,
           last_transition_at = excluded.last_transition_at,
           updated_at = datetime('now')`
      )
      .bind(
        id,
        deviceId,
        state.artifactReleaseId,
        typeof state.desiredState === "string" ? state.desiredState : "active",
        typeof state.actualState === "string" ? state.actualState : "pending",
        typeof state.activationState === "string" ? state.activationState : null,
        typeof state.installRoot === "string" ? state.installRoot : null,
        typeof state.wrapperPath === "string" ? state.wrapperPath : null,
        typeof state.previousReleaseId === "string" ? state.previousReleaseId : null,
        typeof state.lastErrorCode === "string" ? state.lastErrorCode : null,
        typeof state.lastErrorDetail === "string" ? state.lastErrorDetail : null,
        toJson(state.inventoryJson || null),
        typeof state.lastVerifiedAt === "string" ? state.lastVerifiedAt : null,
        typeof state.lastTransitionAt === "string" ? state.lastTransitionAt : nowIso()
      )
      .run();
  }

  if (inventory !== null) {
    const inventoryId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO device_inventory (id, device_id, snapshot_json, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(device_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = datetime('now')`
      )
      .bind(inventoryId, deviceId, toJson(inventory))
      .run();
  }

  const installedToolIds = new Set(
    detectedTools
      .filter((tool: DetectedToolInput) => tool && tool.installed)
      .map((tool) => tool.tool)
      .filter((tool: string): tool is string => typeof tool === "string")
  );

  const desiredAssignments = await listDesiredAssignmentsForUser(db, user.id);
  const filteredAssignments = desiredAssignments.filter(({ release }) => {
    const compatibleTools = Array.isArray(release.manifest?.compatibility?.tools)
      ? release.manifest.compatibility.tools
      : [];
    if (compatibleTools.length === 0) return true;
    return compatibleTools.some((tool: string) => installedToolIds.has(tool));
  });

  const secrets = await getSecretMap(
    db,
    user.orgId,
    [...new Set(filteredAssignments.flatMap(({ release }) => secretRefsForManifest(release.manifest)))]
  );

  const assignments = filteredAssignments.map(({ assignment, artifact, release }) => {
    const resolvedSecrets: Record<string, string> = {};
    for (const envField of release.manifest?.launch?.env || []) {
      if (envField.secretRef && secrets[envField.secretRef]) {
        resolvedSecrets[envField.name] = secrets[envField.secretRef];
      }
    }

    return {
      assignmentId: assignment.id,
      profileId: assignment.profileId,
      profileName: assignment.profileName,
      desiredState: assignment.desiredState,
      rolloutStrategy: assignment.rolloutStrategy,
      artifact,
      release,
      resolvedSecrets,
    };
  });

  const desiredReleaseIds = new Set(assignments.map((assignment) => assignment.release.id));
  const removals = states
    .map((state: DeviceStateInput) => state.artifactReleaseId)
    .filter((releaseId: string): releaseId is string => typeof releaseId === "string" && !desiredReleaseIds.has(releaseId));

  await logAudit(db, user.orgId, user.id, "device.synced", "device", deviceId, {
    assignmentCount: assignments.length,
    removalCount: removals.length,
  });

  return c.json({
    device: {
      ...device,
      lastSeenAt: nowIso(),
    },
    assignments,
    removals,
    serverTime: nowIso(),
  });
});

devices.post("/devices/:deviceId/events", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const { deviceId } = c.req.param() as { deviceId: string };
  const body = await c.req.json().catch(() => ({}));
  const events = Array.isArray(body.events) ? body.events : [];

  if (!user.orgId) return c.json({ error: "User is not part of an organization" }, 400);

  for (const event of events) {
    await db
      .prepare(
        `INSERT INTO device_events (id, device_id, artifact_release_id, event_type, event_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        deviceId,
        typeof event.artifactReleaseId === "string" ? event.artifactReleaseId : null,
        typeof event.eventType === "string" ? event.eventType : "unknown",
        toJson(event)
      )
      .run();
  }

  return c.json({ ok: true, count: events.length });
});

devices.post("/devices/:deviceId/health", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const { deviceId } = c.req.param() as { deviceId: string };
  const body = await c.req.json().catch(() => ({}));
  const checks = Array.isArray(body.checks) ? body.checks : [];

  if (!user.orgId) return c.json({ error: "User is not part of an organization" }, 400);

  for (const check of checks) {
    if (typeof check.artifactReleaseId !== "string") continue;
    await db
      .prepare(
        `INSERT INTO artifact_health_checks
           (id, device_id, artifact_release_id, result, duration_ms, details_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        deviceId,
        check.artifactReleaseId,
        typeof check.result === "string" ? check.result : "unknown",
        typeof check.durationMs === "number" ? check.durationMs : null,
        toJson(check.detailsJson || null)
      )
      .run();

    await db
      .prepare(
        `UPDATE device_artifact_states
         SET last_verified_at = ?, actual_state = CASE WHEN ? = 'pass' THEN 'active' ELSE actual_state END, updated_at = datetime('now')
         WHERE device_id = ? AND artifact_release_id = ?`
      )
      .bind(nowIso(), check.result, deviceId, check.artifactReleaseId)
      .run();
  }

  return c.json({ ok: true, count: checks.length });
});

devices.post("/devices/:deviceId/inventory", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const { deviceId } = c.req.param() as { deviceId: string };
  const body = await c.req.json().catch(() => ({}));

  if (!user.orgId) return c.json({ error: "User is not part of an organization" }, 400);

  await db
    .prepare(
      `INSERT INTO device_inventory (id, device_id, snapshot_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(device_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = datetime('now')`
    )
    .bind(crypto.randomUUID(), deviceId, toJson(body.inventory ?? null))
    .run();

  return c.json({ ok: true });
});

devices.get("/orgs/:orgId/devices", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  const deviceRows = (
    await db
      .prepare(
        `SELECT d.id, d.org_id as orgId, d.user_id as userId, d.name, d.platform, d.arch,
                d.client_kind as clientKind, d.client_version as clientVersion, d.status,
                d.last_seen_at as lastSeenAt, d.created_at as createdAt, d.updated_at as updatedAt,
                u.name as userName, u.email as userEmail
         FROM devices d
         JOIN users u ON u.id = d.user_id
         WHERE d.org_id = ?
         ORDER BY d.updated_at DESC`
      )
      .bind(orgId)
      .all<any>()
  ).results;

  const toolRows = (
    await db
      .prepare(
        `SELECT dt.device_id as deviceId, dt.tool, dt.detected_version as detectedVersion, dt.installed,
                dt.details_json as detailsJson, dt.last_seen_at as lastSeenAt
         FROM device_tools dt
         JOIN devices d ON d.id = dt.device_id
         WHERE d.org_id = ?`
      )
      .bind(orgId)
      .all<any>()
  ).results;

  const stateRows = (
    await db
      .prepare(
        `SELECT ds.id, ds.device_id as deviceId, ds.artifact_release_id as artifactReleaseId,
                ds.desired_state as desiredState, ds.actual_state as actualState, ds.activation_state as activationState,
                ds.install_root as installRoot, ds.wrapper_path as wrapperPath, ds.previous_release_id as previousReleaseId,
                ds.last_error_code as lastErrorCode, ds.last_error_detail as lastErrorDetail,
                ds.inventory_json as inventoryJson, ds.last_verified_at as lastVerifiedAt,
                ds.last_transition_at as lastTransitionAt, ds.updated_at as updatedAt,
                a.name as artifactName, a.kind as artifactKind, r.version, r.reliability_tier as reliabilityTier
         FROM device_artifact_states ds
         JOIN artifact_releases r ON r.id = ds.artifact_release_id
         JOIN artifacts a ON a.id = r.artifact_id
         JOIN devices d ON d.id = ds.device_id
         WHERE d.org_id = ?
         ORDER BY ds.updated_at DESC`
      )
      .bind(orgId)
      .all<any>()
  ).results;

  const inventoryRows = (
    await db
      .prepare(
        `SELECT di.device_id as deviceId, di.snapshot_json as snapshotJson, di.updated_at as updatedAt
         FROM device_inventory di
         JOIN devices d ON d.id = di.device_id
         WHERE d.org_id = ?`
      )
      .bind(orgId)
      .all<any>()
  ).results;

  const toolsByDevice = new Map<string, any[]>();
  for (const row of toolRows) {
    const items = toolsByDevice.get(row.deviceId) || [];
    items.push({
      tool: row.tool,
      detectedVersion: row.detectedVersion,
      installed: Boolean(row.installed),
      details: parseJson<Record<string, unknown> | null>(row.detailsJson, null),
      lastSeenAt: row.lastSeenAt,
    });
    toolsByDevice.set(row.deviceId, items);
  }

  const statesByDevice = new Map<string, any[]>();
  for (const row of stateRows) {
    const items = statesByDevice.get(row.deviceId) || [];
    items.push({
      id: row.id,
      artifactReleaseId: row.artifactReleaseId,
      artifactName: row.artifactName,
      artifactKind: row.artifactKind,
      version: row.version,
      reliabilityTier: row.reliabilityTier,
      desiredState: row.desiredState,
      actualState: row.actualState,
      activationState: row.activationState,
      installRoot: row.installRoot,
      wrapperPath: row.wrapperPath,
      previousReleaseId: row.previousReleaseId,
      lastErrorCode: row.lastErrorCode,
      lastErrorDetail: row.lastErrorDetail,
      inventoryJson: parseJson<Record<string, unknown> | null>(row.inventoryJson, null),
      lastVerifiedAt: row.lastVerifiedAt,
      lastTransitionAt: row.lastTransitionAt,
      updatedAt: row.updatedAt,
    });
    statesByDevice.set(row.deviceId, items);
  }

  const inventoryByDevice = new Map<string, any>();
  for (const row of inventoryRows) {
    inventoryByDevice.set(row.deviceId, {
      snapshot: parseJson(row.snapshotJson, null),
      updatedAt: row.updatedAt,
    });
  }

  return c.json({
    devices: deviceRows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      name: row.name,
      platform: row.platform,
      arch: row.arch,
      clientKind: row.clientKind,
      clientVersion: row.clientVersion,
      status: row.status,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      tools: toolsByDevice.get(row.id) || [],
      states: statesByDevice.get(row.id) || [],
      inventory: inventoryByDevice.get(row.id) || null,
    })),
  });
});

export default devices;
