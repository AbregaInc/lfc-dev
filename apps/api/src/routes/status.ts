import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";

const status = new Hono<AppEnv>();

status.use("*", authMiddleware);

status.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const members = (
    await db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role,
                MAX(d.last_seen_at) as lastSyncAt,
                COUNT(DISTINCT d.id) as deviceCount,
                SUM(CASE WHEN ds.actual_state = 'failed' THEN 1 ELSE 0 END) as failedStates,
                SUM(CASE WHEN ds.actual_state IN ('active', 'config_applied_unverified') THEN 1 ELSE 0 END) as healthyStates
         FROM users u
         LEFT JOIN devices d ON d.user_id = u.id
         LEFT JOIN device_artifact_states ds ON ds.device_id = d.id
         WHERE u.org_id = ?
         GROUP BY u.id, u.email, u.name, u.role
         ORDER BY u.created_at`
      )
      .bind(orgId)
      .all<{ id: string; email: string; name: string; role: string; lastSyncAt: string | null; deviceCount: number; failedStates: number | null; healthyStates: number | null }>()
  ).results;

  return c.json({
    members: members.map((member) => ({
      ...member,
      deviceCount: Number(member.deviceCount || 0),
      failedStates: Number(member.failedStates || 0),
      healthyStates: Number(member.healthyStates || 0),
      upToDate: Number(member.failedStates || 0) === 0 && Number(member.deviceCount || 0) > 0,
    })),
  });
});

export default status;
