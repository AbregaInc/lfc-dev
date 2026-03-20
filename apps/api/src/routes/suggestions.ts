import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { logAudit } from "../audit.js";

const suggestions = new Hono<AppEnv>();

suggestions.use("*", authMiddleware);

suggestions.get("/count", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };

  const result = await db
    .prepare("SELECT COUNT(*) as count FROM suggestions WHERE orgId = ? AND status = 'pending'")
    .bind(orgId)
    .first<{ count: number }>();

  return c.json({ count: result?.count ?? 0 });
});

suggestions.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const status = c.req.query("status");

  const query = status
    ? db.prepare(
        `SELECT s.id, s.orgId, s.profileId, s.userId, s.configType, s.title, s.description,
                s.content, s.diff, s.status, s.reviewedBy, s.reviewNote,
                s.createdAt, s.updatedAt, u.name as userName, u.email as userEmail
         FROM suggestions s LEFT JOIN users u ON s.userId = u.id
         WHERE s.orgId = ? AND s.status = ? ORDER BY s.createdAt DESC`
      ).bind(orgId, status)
    : db.prepare(
        `SELECT s.id, s.orgId, s.profileId, s.userId, s.configType, s.title, s.description,
                s.content, s.diff, s.status, s.reviewedBy, s.reviewNote,
                s.createdAt, s.updatedAt, u.name as userName, u.email as userEmail
         FROM suggestions s LEFT JOIN users u ON s.userId = u.id
         WHERE s.orgId = ? ORDER BY s.createdAt DESC`
      ).bind(orgId);

  const rows = (await query.all()).results;
  return c.json({ suggestions: rows });
});

suggestions.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);
  const { profileId, configType, title, description, content, diff } = await c.req.json();

  if (!profileId || !configType || !title || content === undefined) {
    return c.json({ error: "profileId, configType, title, and content are required" }, 400);
  }

  const id = crypto.randomUUID();
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);

  await db
    .prepare(
      `INSERT INTO suggestions (id, orgId, profileId, userId, configType, title, description, content, diff, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .bind(id, orgId, profileId, user.id, configType, title, description || null, contentStr, diff || null)
    .run();

  await logAudit(db, orgId, user.id, "suggestion.created", "suggestion", id, { title, configType, profileId });

  return c.json({
    suggestion: { id, orgId, profileId, userId: user.id, configType, title, description, content: contentStr, diff, status: "pending" },
  });
});

suggestions.get("/:suggestionId", async (c) => {
  const db = c.env.DB;
  const { orgId, suggestionId } = c.req.param() as { orgId: string; suggestionId: string };

  const suggestion = await db
    .prepare(
      `SELECT s.id, s.orgId, s.profileId, s.userId, s.configType, s.title, s.description,
              s.content, s.diff, s.status, s.reviewedBy, s.reviewNote,
              s.createdAt, s.updatedAt, u.name as userName, u.email as userEmail
       FROM suggestions s LEFT JOIN users u ON s.userId = u.id
       WHERE s.id = ? AND s.orgId = ?`
    )
    .bind(suggestionId, orgId)
    .first();

  if (!suggestion) {
    return c.json({ error: "Suggestion not found" }, 404);
  }

  return c.json({ suggestion });
});

suggestions.post("/:suggestionId/approve", async (c) => {
  const db = c.env.DB;
  const { orgId, suggestionId } = c.req.param() as { orgId: string; suggestionId: string };
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));
  const { content: editedContent, reviewNote } = body as { content?: string; reviewNote?: string };

  const suggestion = await db
    .prepare("SELECT * FROM suggestions WHERE id = ? AND orgId = ?")
    .bind(suggestionId, orgId)
    .first<Record<string, unknown>>();

  if (!suggestion) {
    return c.json({ error: "Suggestion not found" }, 404);
  }

  if (suggestion.status !== "pending") {
    return c.json({ error: "Suggestion has already been reviewed" }, 400);
  }

  const finalContent =
    editedContent !== undefined
      ? typeof editedContent === "string"
        ? editedContent
        : JSON.stringify(editedContent)
      : (suggestion.content as string);

  // Update suggestion status
  await db
    .prepare("UPDATE suggestions SET status = 'approved', reviewedBy = ?, reviewNote = ?, updatedAt = datetime('now') WHERE id = ?")
    .bind(user.id, reviewNote || null, suggestionId)
    .run();

  // Create or update the config
  const existing = await db
    .prepare("SELECT id, version FROM profile_configs WHERE profile_id = ? AND config_type = ?")
    .bind(suggestion.profileId as string, suggestion.configType as string)
    .first<{ id: string; version: number }>();

  if (existing) {
    await db
      .prepare("UPDATE profile_configs SET content = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?")
      .bind(finalContent, existing.id)
      .run();
  } else {
    const configId = crypto.randomUUID();
    await db
      .prepare("INSERT INTO profile_configs (id, profile_id, config_type, content, version) VALUES (?, ?, ?, ?, 1)")
      .bind(configId, suggestion.profileId as string, suggestion.configType as string, finalContent)
      .run();
  }

  await logAudit(db, orgId, user.id, "suggestion.approved", "suggestion", suggestionId, {
    title: suggestion.title,
    configType: suggestion.configType,
    profileId: suggestion.profileId,
  });

  return c.json({ ok: true, status: "approved" });
});

suggestions.post("/:suggestionId/deny", async (c) => {
  const db = c.env.DB;
  const { orgId, suggestionId } = c.req.param() as { orgId: string; suggestionId: string };
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));
  const { reviewNote } = body as { reviewNote?: string };

  const suggestion = await db
    .prepare("SELECT * FROM suggestions WHERE id = ? AND orgId = ?")
    .bind(suggestionId, orgId)
    .first<Record<string, unknown>>();

  if (!suggestion) {
    return c.json({ error: "Suggestion not found" }, 404);
  }

  if (suggestion.status !== "pending") {
    return c.json({ error: "Suggestion has already been reviewed" }, 400);
  }

  await db
    .prepare("UPDATE suggestions SET status = 'denied', reviewedBy = ?, reviewNote = ?, updatedAt = datetime('now') WHERE id = ?")
    .bind(user.id, reviewNote || null, suggestionId)
    .run();

  await logAudit(db, orgId, user.id, "suggestion.denied", "suggestion", suggestionId, {
    title: suggestion.title,
    reviewNote,
  });

  return c.json({ ok: true, status: "denied" });
});

export default suggestions;
