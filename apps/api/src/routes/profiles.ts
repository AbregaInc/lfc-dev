import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware } from "../auth.js";

const profiles = new Hono<AppEnv>();

profiles.use("*", authMiddleware);

profiles.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };

  const result = await db
    .prepare(
      `SELECT p.id, p.org_id as orgId, p.name, p.description, p.tools, p.created_at as createdAt, p.updated_at as updatedAt,
              (SELECT COUNT(*) FROM profile_configs WHERE profile_id = p.id) as configCount
       FROM profiles p WHERE p.org_id = ? ORDER BY p.created_at`
    )
    .bind(orgId)
    .all<{ id: string; orgId: string; name: string; description: string; tools: string; createdAt: string; updatedAt: string; configCount: number }>();

  const rows = result.results.map((r) => ({
    ...r,
    tools: JSON.parse(r.tools),
  }));

  return c.json({ profiles: rows });
});

profiles.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const { name, description, tools } = await c.req.json();

  if (!name) {
    return c.json({ error: "name is required" }, 400);
  }

  const profileId = crypto.randomUUID();
  await db
    .prepare("INSERT INTO profiles (id, org_id, name, description, tools) VALUES (?, ?, ?, ?, ?)")
    .bind(profileId, orgId, name, description || null, JSON.stringify(tools || []))
    .run();

  // Auto-assign all org members
  const members = (await db.prepare("SELECT id FROM users WHERE org_id = ?").bind(orgId).all<{ id: string }>()).results;
  if (members.length > 0) {
    await db.batch(
      members.map((m) =>
        db.prepare("INSERT OR IGNORE INTO user_profiles (user_id, profile_id) VALUES (?, ?)").bind(m.id, profileId)
      )
    );
  }

  return c.json({
    profile: { id: profileId, orgId, name, description, tools: tools || [] },
  });
});

profiles.get("/:profileId", async (c) => {
  const db = c.env.DB;
  const { profileId } = c.req.param();

  const profile = await db
    .prepare(
      "SELECT id, org_id as orgId, name, description, tools, created_at as createdAt, updated_at as updatedAt FROM profiles WHERE id = ?"
    )
    .bind(profileId)
    .first<{ id: string; orgId: string; name: string; description: string; tools: string; createdAt: string; updatedAt: string }>();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const parsed = { ...profile, tools: JSON.parse(profile.tools) };

  const configs = (
    await db
      .prepare(
        "SELECT id, profile_id as profileId, config_type as configType, content, version, updated_at as updatedAt FROM profile_configs WHERE profile_id = ?"
      )
      .bind(profileId)
      .all()
  ).results;

  return c.json({ profile: parsed, configs });
});

profiles.put("/:profileId", async (c) => {
  const db = c.env.DB;
  const { profileId } = c.req.param();
  const { name, description, tools } = await c.req.json();

  await db
    .prepare(
      "UPDATE profiles SET name = COALESCE(?, name), description = COALESCE(?, description), tools = COALESCE(?, tools), updated_at = datetime('now') WHERE id = ?"
    )
    .bind(name || null, description !== undefined ? description : null, tools ? JSON.stringify(tools) : null, profileId)
    .run();

  return c.json({ ok: true });
});

export default profiles;
