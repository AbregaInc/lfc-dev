import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";

const orgs = new Hono<AppEnv>();

orgs.use("*", authMiddleware);

orgs.post("/", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const { name, slug } = await c.req.json();

  if (!name || !slug) {
    return c.json({ error: "name and slug are required" }, 400);
  }

  const existing = await db.prepare("SELECT id FROM orgs WHERE slug = ?").bind(slug).first();
  if (existing) {
    return c.json({ error: "Slug already taken" }, 409);
  }

  const orgId = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO orgs (id, name, slug) VALUES (?, ?, ?)").bind(orgId, name, slug),
    db.prepare("UPDATE users SET org_id = ?, role = 'admin' WHERE id = ?").bind(orgId, user.id),
  ]);

  return c.json({ org: { id: orgId, name, slug } });
});

orgs.put("/:orgId", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param();
  const user = getUser(c);

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can update organization settings" }, 403);
  }

  const { name, slug } = await c.req.json();
  const updates: string[] = [];
  const values: any[] = [];

  if (name) {
    updates.push("name = ?");
    values.push(name);
  }
  if (slug) {
    const existing = await db.prepare("SELECT id FROM orgs WHERE slug = ? AND id != ?").bind(slug, orgId).first();
    if (existing) {
      return c.json({ error: "Slug already taken" }, 409);
    }
    updates.push("slug = ?");
    values.push(slug);
  }

  if (updates.length === 0) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  values.push(orgId);
  await db.prepare(`UPDATE orgs SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  const org = await db.prepare("SELECT id, name, slug, created_at as createdAt FROM orgs WHERE id = ?").bind(orgId).first();
  return c.json({ org });
});

orgs.get("/:orgId", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param();
  const org = await db
    .prepare("SELECT id, name, slug, created_at as createdAt FROM orgs WHERE id = ?")
    .bind(orgId)
    .first();

  if (!org) {
    return c.json({ error: "Org not found" }, 404);
  }

  return c.json({ org });
});

export default orgs;
