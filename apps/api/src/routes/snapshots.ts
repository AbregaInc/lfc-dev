import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { logAudit } from "../audit.js";

const app = new Hono<AppEnv>();
app.use("*", authMiddleware);

// POST /api/snapshots — Upload user's tool inventory snapshot
app.post("/", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  if (!user.orgId) return c.json({ error: "No org" }, 400);

  const body = await c.req.json();
  const { tools } = body;

  if (!tools || !Array.isArray(tools)) {
    return c.json({ error: "Missing tools array" }, 400);
  }

  const snapshot = JSON.stringify(tools);

  const existing = await db.prepare("SELECT id FROM user_snapshots WHERE userId = ?").bind(user.id).first<{ id: string }>();

  if (existing) {
    await db
      .prepare("UPDATE user_snapshots SET snapshot = ?, updatedAt = datetime('now') WHERE id = ?")
      .bind(snapshot, existing.id)
      .run();
  } else {
    await db
      .prepare("INSERT INTO user_snapshots (id, orgId, userId, snapshot) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), user.orgId, user.id, snapshot)
      .run();
  }

  await logAudit(db, user.orgId, user.id, "snapshot.uploaded", "user", user.id, {
    toolCount: tools.filter((t: { installed: boolean }) => t.installed).length,
  });

  return c.json({ ok: true });
});

// GET /api/orgs/:orgId/inventory — Admin view
app.get("/", async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const orgId = c.req.param("orgId");
  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  const rows = (
    await db
      .prepare(
        `SELECT s.userId, s.snapshot, s.updatedAt, u.name, u.email
         FROM user_snapshots s JOIN users u ON u.id = s.userId
         WHERE s.orgId = ? ORDER BY s.updatedAt DESC`
      )
      .bind(orgId)
      .all<{ userId: string; snapshot: string; updatedAt: string; name: string; email: string }>()
  ).results;

  const members = rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    updatedAt: row.updatedAt,
    tools: JSON.parse(row.snapshot),
  }));

  const inventory: Record<
    string,
    { type: string; name: string; users: string[]; command?: string; args?: string[]; managed: boolean }
  > = {};

  for (const member of members) {
    for (const tool of member.tools) {
      if (!tool.installed) continue;

      for (const mcp of tool.mcpServers || []) {
        const key = `mcp:${mcp.name}`;
        if (!inventory[key]) {
          inventory[key] = { type: "mcp", name: mcp.name, users: [], command: mcp.command, args: mcp.args, managed: mcp.managed };
        }
        if (!inventory[key].users.includes(member.email)) inventory[key].users.push(member.email);
      }

      for (const skill of tool.skills || []) {
        const key = `skill:${skill.name}`;
        if (!inventory[key]) inventory[key] = { type: "skill", name: skill.name, users: [], managed: skill.managed };
        if (!inventory[key].users.includes(member.email)) inventory[key].users.push(member.email);
      }

      for (const rule of tool.rules || []) {
        const key = `rule:${rule.name}`;
        if (!inventory[key]) inventory[key] = { type: "rule", name: rule.name, users: [], managed: rule.managed };
        if (!inventory[key].users.includes(member.email)) inventory[key].users.push(member.email);
      }

      for (const agent of tool.agents || []) {
        const key = `agent:${agent.name}`;
        if (!inventory[key]) inventory[key] = { type: "agent", name: agent.name, users: [], managed: agent.managed };
        if (!inventory[key].users.includes(member.email)) inventory[key].users.push(member.email);
      }
    }
  }

  return c.json({
    members,
    inventory: Object.values(inventory).sort((a, b) => b.users.length - a.users.length),
  });
});

export default app;
