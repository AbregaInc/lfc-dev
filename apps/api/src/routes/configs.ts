import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { logAudit } from "../audit.js";

const configs = new Hono<AppEnv>();

configs.use("*", authMiddleware);

configs.get("/", async (c) => {
  const db = c.env.DB;
  const { profileId } = c.req.param() as { profileId: string };

  const rows = (
    await db
      .prepare(
        "SELECT id, profile_id as profileId, config_type as configType, content, version, updated_at as updatedAt FROM profile_configs WHERE profile_id = ?"
      )
      .bind(profileId)
      .all()
  ).results;

  return c.json({ configs: rows });
});

configs.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId, profileId } = c.req.param() as { orgId: string; profileId: string };
  const user = getUser(c);
  const { configType, content } = await c.req.json();

  if (!configType || content === undefined) {
    return c.json({ error: "configType and content are required" }, 400);
  }

  const existing = await db
    .prepare("SELECT id, version FROM profile_configs WHERE profile_id = ? AND config_type = ?")
    .bind(profileId, configType)
    .first<{ id: string; version: number }>();

  if (existing) {
    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    await db
      .prepare("UPDATE profile_configs SET content = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?")
      .bind(contentStr, existing.id)
      .run();

    await logAudit(db, orgId, user.id, "config.updated", "config", existing.id, { configType, profileId });

    return c.json({
      config: { id: existing.id, profileId, configType, content: contentStr, version: existing.version + 1 },
    });
  }

  const configId = crypto.randomUUID();
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);

  await db
    .prepare("INSERT INTO profile_configs (id, profile_id, config_type, content, version) VALUES (?, ?, ?, ?, 1)")
    .bind(configId, profileId, configType, contentStr)
    .run();

  await logAudit(db, orgId, user.id, "config.created", "config", configId, { configType, profileId });

  return c.json({
    config: { id: configId, profileId, configType, content: contentStr, version: 1 },
  });
});

configs.delete("/:configId", async (c) => {
  const db = c.env.DB;
  const { orgId, configId } = c.req.param() as { orgId: string; configId: string };
  const user = getUser(c);
  await db.prepare("DELETE FROM profile_configs WHERE id = ?").bind(configId).run();
  await logAudit(db, orgId, user.id, "config.deleted", "config", configId, null);
  return c.json({ ok: true });
});

export default configs;
