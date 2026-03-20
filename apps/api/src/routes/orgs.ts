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
