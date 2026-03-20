import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { logAudit } from "../audit.js";

const secrets = new Hono<AppEnv>();

secrets.use("*", authMiddleware);

secrets.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };

  const rows = (
    await db
      .prepare("SELECT id, org_id as orgId, name, created_at as createdAt, updated_at as updatedAt FROM secrets WHERE org_id = ?")
      .bind(orgId)
      .all()
  ).results;

  return c.json({ secrets: rows });
});

secrets.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const { name, value } = await c.req.json();

  if (!name || !value) {
    return c.json({ error: "name and value are required" }, 400);
  }

  const user = getUser(c);

  const existing = await db
    .prepare("SELECT id FROM secrets WHERE org_id = ? AND name = ?")
    .bind(orgId, name)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare("UPDATE secrets SET value_encrypted = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(value, existing.id)
      .run();
    await logAudit(db, orgId, user.id, "secret.created", "secret", existing.id, { name });
    return c.json({ secret: { id: existing.id, orgId, name } });
  }

  const secretId = crypto.randomUUID();
  await db
    .prepare("INSERT INTO secrets (id, org_id, name, value_encrypted) VALUES (?, ?, ?, ?)")
    .bind(secretId, orgId, name, value)
    .run();

  await logAudit(db, orgId, user.id, "secret.created", "secret", secretId, { name });

  return c.json({ secret: { id: secretId, orgId, name } });
});

secrets.delete("/:secretId", async (c) => {
  const db = c.env.DB;
  const { orgId, secretId } = c.req.param() as { orgId: string; secretId: string };
  const user = getUser(c);
  await db.prepare("DELETE FROM secrets WHERE id = ?").bind(secretId).run();
  await logAudit(db, orgId, user.id, "secret.deleted", "secret", secretId, null);
  return c.json({ ok: true });
});

export default secrets;
