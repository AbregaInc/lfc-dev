import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { listAssignmentsForProfile } from "../data.js";

const profiles = new Hono<AppEnv>();

profiles.use("*", authMiddleware);

profiles.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await db
    .prepare(
      `SELECT p.id, p.org_id as orgId, p.name, p.description, p.tools,
              p.created_at as createdAt, p.updated_at as updatedAt,
              (SELECT COUNT(*) FROM profile_artifact_assignments pa WHERE pa.profile_id = p.id) as assignmentCount
       FROM profiles p
       WHERE p.org_id = ?
       ORDER BY p.created_at`
    )
    .bind(orgId)
    .all<{ id: string; orgId: string; name: string; description: string | null; tools: string; createdAt: string; updatedAt: string; assignmentCount: number }>();

  return c.json({
    profiles: result.results.map((row) => ({
      ...row,
      tools: JSON.parse(row.tools),
    })),
  });
});

profiles.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);
  const { name, description, tools } = await c.req.json();

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can create profiles" }, 403);
  }

  if (!name) {
    return c.json({ error: "name is required" }, 400);
  }

  const profileId = crypto.randomUUID();
  await db
    .prepare("INSERT INTO profiles (id, org_id, name, description, tools) VALUES (?, ?, ?, ?, ?)")
    .bind(profileId, orgId, name, description || null, JSON.stringify(Array.isArray(tools) ? tools : []))
    .run();

  const members = (await db.prepare("SELECT id FROM users WHERE org_id = ?").bind(orgId).all<{ id: string }>()).results;
  if (members.length > 0) {
    await db.batch(
      members.map((member) =>
        db.prepare("INSERT OR IGNORE INTO user_profiles (user_id, profile_id) VALUES (?, ?)").bind(member.id, profileId)
      )
    );
  }

  return c.json({
    profile: {
      id: profileId,
      orgId,
      name,
      description: description || null,
      tools: Array.isArray(tools) ? tools : [],
    },
  });
});

profiles.get("/:profileId", async (c) => {
  const db = c.env.DB;
  const { orgId, profileId } = c.req.param() as { orgId: string; profileId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const profile = await db
    .prepare(
      `SELECT id, org_id as orgId, name, description, tools,
              created_at as createdAt, updated_at as updatedAt
       FROM profiles
       WHERE id = ? AND org_id = ?`
    )
    .bind(profileId, orgId)
    .first<{ id: string; orgId: string; name: string; description: string | null; tools: string; createdAt: string; updatedAt: string }>();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const assignments = await listAssignmentsForProfile(db, profileId);

  return c.json({
    profile: {
      ...profile,
      tools: JSON.parse(profile.tools),
    },
    assignments,
  });
});

profiles.put("/:profileId", async (c) => {
  const db = c.env.DB;
  const { orgId, profileId } = c.req.param() as { orgId: string; profileId: string };
  const user = getUser(c);
  const { name, description, tools } = await c.req.json();

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can update profiles" }, 403);
  }

  await db
    .prepare(
      `UPDATE profiles
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           tools = COALESCE(?, tools),
           updated_at = datetime('now')
       WHERE id = ? AND org_id = ?`
    )
    .bind(name || null, description !== undefined ? description : null, tools ? JSON.stringify(tools) : null, profileId, orgId)
    .run();

  return c.json({ ok: true });
});

export default profiles;
