import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";

const users = new Hono<AppEnv>();

users.use("*", authMiddleware);

users.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = (
    await db
      .prepare("SELECT id, email, name, role, created_at as createdAt FROM users WHERE org_id = ? ORDER BY created_at")
      .bind(orgId)
      .all()
  ).results;

  return c.json({ users: rows });
});

export default users;
