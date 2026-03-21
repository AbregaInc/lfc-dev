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

  const isDev = c.env.DEV_SEED === "true";
  const email = isDev ? "admin@acme.com" : "boris@abrega.com";
  const orgName = isDev ? "Acme Corp" : "Abrega Inc";
  const orgSlug = isDev ? "acme" : "abrega";
  const password = isDev ? "password123" : crypto.randomUUID().slice(0, 16);
  const hash = await bcrypt.hash(password, 10);

  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const profileId = crypto.randomUUID();

  await db.batch([
    db.prepare("INSERT INTO orgs (id, name, slug) VALUES (?, ?, ?)").bind(orgId, orgName, orgSlug),
    db
      .prepare("INSERT INTO users (id, email, password_hash, name, org_id, role) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(userId, email, hash, orgName, orgId, "admin"),
    db
      .prepare("INSERT INTO profiles (id, org_id, name, description, tools) VALUES (?, ?, ?, ?, ?)")
      .bind(profileId, orgId, "Global", "Default profile for all team members", JSON.stringify(["claude-desktop", "claude-code", "cursor", "codex"])),
    db.prepare("INSERT INTO user_profiles (user_id, profile_id) VALUES (?, ?)").bind(userId, profileId),
  ]);

  return c.json({
    message: isDev
      ? "Dev setup complete. Login pre-filled on the dashboard."
      : "Setup complete. Save this password — it is only shown once.",
    email,
    password,
    orgId,
  });
});

export default setup;
