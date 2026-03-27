import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { listAssignmentsForProfile } from "../data.js";
import { toJson } from "../utils.js";
import { logAudit } from "../audit.js";

const profileArtifacts = new Hono<AppEnv>();

profileArtifacts.use("*", authMiddleware);

profileArtifacts.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId, profileId } = c.req.param() as { orgId: string; profileId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  return c.json({ assignments: await listAssignmentsForProfile(db, profileId) });
});

profileArtifacts.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId, profileId } = c.req.param() as { orgId: string; profileId: string };
  const user = getUser(c);

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can assign artifacts" }, 403);
  }

  const { artifactReleaseId, desiredState, rolloutStrategy, rolloutJson } = await c.req.json();
  if (!artifactReleaseId) {
    return c.json({ error: "artifactReleaseId is required" }, 400);
  }

  const release = await db
    .prepare(
      `SELECT r.id
       FROM artifact_releases r
       JOIN artifacts a ON a.id = r.artifact_id
       WHERE r.id = ? AND a.org_id = ?`
    )
    .bind(artifactReleaseId, orgId)
    .first<{ id: string }>();

  if (!release) {
    return c.json({ error: "Artifact release not found" }, 404);
  }

  const existing = await db
    .prepare("SELECT id FROM profile_artifact_assignments WHERE profile_id = ? AND artifact_release_id = ?")
    .bind(profileId, artifactReleaseId)
    .first<{ id: string }>();

  const assignmentId = existing?.id || crypto.randomUUID();

  if (existing) {
    await db
      .prepare(
        `UPDATE profile_artifact_assignments
         SET desired_state = ?, rollout_strategy = ?, rollout_json = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(desiredState || "active", rolloutStrategy || "all_at_once", toJson(rolloutJson || null), assignmentId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO profile_artifact_assignments
           (id, profile_id, artifact_release_id, desired_state, rollout_strategy, rollout_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        assignmentId,
        profileId,
        artifactReleaseId,
        desiredState || "active",
        rolloutStrategy || "all_at_once",
        toJson(rolloutJson || null)
      )
      .run();
  }

  await logAudit(db, orgId, user.id, "profile.assignment.updated", "profile", profileId, {
    artifactReleaseId,
    desiredState: desiredState || "active",
    rolloutStrategy: rolloutStrategy || "all_at_once",
  });

  return c.json({ assignments: await listAssignmentsForProfile(db, profileId) });
});

profileArtifacts.delete("/:assignmentId", async (c) => {
  const db = c.env.DB;
  const { orgId, profileId, assignmentId } = c.req.param() as { orgId: string; profileId: string; assignmentId: string };
  const user = getUser(c);

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can remove assignments" }, 403);
  }

  await db
    .prepare("DELETE FROM profile_artifact_assignments WHERE id = ? AND profile_id = ?")
    .bind(assignmentId, profileId)
    .run();

  await logAudit(db, orgId, user.id, "profile.assignment.deleted", "profile", profileId, {
    assignmentId,
  });

  return c.json({ assignments: await listAssignmentsForProfile(db, profileId) });
});

export default profileArtifacts;
