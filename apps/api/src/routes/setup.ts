import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { AppEnv } from "../env.js";

const setup = new Hono<AppEnv>();

// POST /api/admin/setup — One-time initialization. Only works when DB is empty.
setup.post("/setup", async (c) => {
  const db = c.env.DB;

  const orgCount = await db.prepare("SELECT COUNT(*) as count FROM orgs").first<{ count: number }>();
  if (orgCount && orgCount.count > 0) {
    return c.json({ error: "Database already initialized" }, 409);
  }

  const password = crypto.randomUUID().slice(0, 16);
  const hash = await bcrypt.hash(password, 10);

  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const profileId = crypto.randomUUID();

  await db.batch([
    db.prepare("INSERT INTO orgs (id, name, slug) VALUES (?, ?, ?)").bind(orgId, "Abrega Inc", "abrega"),
    db
      .prepare("INSERT INTO users (id, email, password_hash, name, org_id, role) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(userId, "boris@abrega.com", hash, "Abrega Inc", orgId, "admin"),
    db
      .prepare("INSERT INTO profiles (id, org_id, name, description, tools) VALUES (?, ?, ?, ?, ?)")
      .bind(profileId, orgId, "Global", "Default profile for all team members", JSON.stringify(["claude-desktop", "claude-code", "cursor", "codex"])),
    db.prepare("INSERT INTO user_profiles (user_id, profile_id) VALUES (?, ?)").bind(userId, profileId),
  ]);

  return c.json({
    message: "Setup complete. Save this password — it is only shown once.",
    email: "boris@abrega.com",
    password,
    orgId,
  });
});

export default setup;
