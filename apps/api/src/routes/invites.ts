import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { logAudit } from "../audit.js";

const invites = new Hono<AppEnv>();

// Create invite (requires auth, must be admin of the org)
invites.post("/:orgId/invites", authMiddleware, async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can create invites" }, 403);
  }

  const code = `${orgId.slice(0, 8)}-${Date.now().toString(36)}`;
  const inviteId = crypto.randomUUID();

  await db.prepare("INSERT INTO invites (id, org_id, code) VALUES (?, ?, ?)").bind(inviteId, orgId, code).run();

  await logAudit(db, orgId, user.id, "user.invited", "invite", inviteId, { code });

  return c.json({ invite: { id: inviteId, orgId, code } });
});

// Accept invite (requires auth)
invites.post("/invites/:code", authMiddleware, async (c) => {
  const db = c.env.DB;
  const { code } = c.req.param();
  const user = getUser(c);

  const invite = await db
    .prepare("SELECT id, org_id as orgId FROM invites WHERE code = ?")
    .bind(code)
    .first<{ id: string; orgId: string }>();

  if (!invite) {
    return c.json({ error: "Invalid invite code" }, 404);
  }

  if (user.orgId && user.orgId !== invite.orgId) {
    const currentOrg = await db.prepare("SELECT name FROM orgs WHERE id = ?").bind(user.orgId).first<{ name: string }>();
    return c.json(
      {
        error: `You already belong to "${currentOrg?.name || "another org"}". Leave that org first, or ask your admin to add you.`,
        code: "ALREADY_IN_ORG",
        currentOrgId: user.orgId,
        currentOrgName: currentOrg?.name,
      },
      409
    );
  }

  // Add user to org
  await db.prepare("UPDATE users SET org_id = ?, role = 'member' WHERE id = ?").bind(invite.orgId, user.id).run();

  // Assign user to all org profiles
  const orgProfiles = (await db.prepare("SELECT id FROM profiles WHERE org_id = ?").bind(invite.orgId).all<{ id: string }>()).results;
  if (orgProfiles.length > 0) {
    await db.batch(
      orgProfiles.map((p) =>
        db.prepare("INSERT OR IGNORE INTO user_profiles (user_id, profile_id) VALUES (?, ?)").bind(user.id, p.id)
      )
    );
  }

  const org = await db.prepare("SELECT id, name, slug FROM orgs WHERE id = ?").bind(invite.orgId).first();

  await logAudit(db, invite.orgId, user.id, "user.joined", "user", user.id, { inviteCode: code });

  return c.json({ org });
});

// Get invite info (public)
invites.get("/invites/:code", async (c) => {
  const db = c.env.DB;
  const { code } = c.req.param();

  const invite = await db
    .prepare(
      `SELECT i.id, i.org_id as orgId, i.code, o.name as orgName
       FROM invites i JOIN orgs o ON i.org_id = o.id
       WHERE i.code = ?`
    )
    .bind(code)
    .first<{ id: string; orgId: string; code: string; orgName: string }>();

  if (!invite) {
    return c.json({ error: "Invalid invite code" }, 404);
  }

  return c.json({ invite });
});

export default invites;
