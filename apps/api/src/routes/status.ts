import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware } from "../auth.js";

const status = new Hono<AppEnv>();

status.use("*", authMiddleware);

status.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };

  const members = (
    await db
      .prepare("SELECT id, email, name, role FROM users WHERE org_id = ?")
      .bind(orgId)
      .all<{ id: string; email: string; name: string; role: string }>()
  ).results;

  const currentVersions = (
    await db
      .prepare(
        `SELECT pc.profile_id as profileId, pc.config_type as configType, pc.version
         FROM profile_configs pc JOIN profiles p ON pc.profile_id = p.id
         WHERE p.org_id = ?`
      )
      .bind(orgId)
      .all<{ profileId: string; configType: string; version: number }>()
  ).results;

  const currentVersionMap: Record<string, number> = {};
  for (const cv of currentVersions) {
    currentVersionMap[`${cv.profileId}:${cv.configType}`] = cv.version;
  }

  const result = [];
  for (const member of members) {
    const syncEvent = await db
      .prepare(
        `SELECT id, userId, installedTools, configVersions, syncedAt
         FROM sync_events WHERE orgId = ? AND userId = ?
         ORDER BY syncedAt DESC LIMIT 1`
      )
      .bind(orgId, member.id)
      .first<{ id: string; userId: string; installedTools: string | null; configVersions: string | null; syncedAt: string }>();

    let upToDate = false;
    let installedTools: string[] = [];
    let configVersions: Record<string, number> = {};

    if (syncEvent) {
      installedTools = syncEvent.installedTools ? JSON.parse(syncEvent.installedTools) : [];
      configVersions = syncEvent.configVersions ? JSON.parse(syncEvent.configVersions) : {};

      upToDate = true;
      for (const [key, version] of Object.entries(currentVersionMap)) {
        if (configVersions[key] !== version) {
          upToDate = false;
          break;
        }
      }
    }

    result.push({
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      lastSyncAt: syncEvent?.syncedAt || null,
      installedTools,
      configVersions,
      upToDate,
    });
  }

  return c.json({ members: result });
});

export default status;
