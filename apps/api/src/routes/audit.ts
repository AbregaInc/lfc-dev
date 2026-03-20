import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware } from "../auth.js";

const audit = new Hono<AppEnv>();

audit.use("*", authMiddleware);

audit.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const rows = (
    await db
      .prepare(
        `SELECT a.id, a.orgId, a.userId, a.action, a.resourceType, a.resourceId, a.details, a.createdAt,
                u.name as userName, u.email as userEmail
         FROM audit_log a LEFT JOIN users u ON a.userId = u.id
         WHERE a.orgId = ? ORDER BY a.createdAt DESC LIMIT ? OFFSET ?`
      )
      .bind(orgId, limit, offset)
      .all()
  ).results;

  const total = await db
    .prepare("SELECT COUNT(*) as count FROM audit_log WHERE orgId = ?")
    .bind(orgId)
    .first<{ count: number }>();

  return c.json({ entries: rows, total: total?.count ?? 0, limit, offset });
});

export default audit;
