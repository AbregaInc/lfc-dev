import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { deriveReleaseFields, normalizeSubmissionCapture, type ArtifactManifest } from "../manifests.js";
import { parseJson, slugify, toJson } from "../utils.js";
import { logAudit } from "../audit.js";
import { getArtifactForOrg } from "../data.js";

const submissions = new Hono<AppEnv>();

submissions.use("*", authMiddleware);

submissions.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const status = c.req.query("status");
  const user = getUser(c);

  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  const query = status
    ? db.prepare(
        `SELECT s.id, s.org_id as orgId, s.user_id as userId, s.source_device_id as sourceDeviceId,
                s.title, s.description, s.status, s.artifact_kind as artifactKind, s.source_tool as sourceTool,
                s.reliability_tier as reliabilityTier, s.raw_capture_json as rawCaptureJson,
                s.normalized_release_id as normalizedReleaseId, s.review_notes as reviewNotes,
                s.created_at as createdAt, s.updated_at as updatedAt,
                u.name as userName, u.email as userEmail
         FROM artifact_submissions s
         JOIN users u ON u.id = s.user_id
         WHERE s.org_id = ? AND s.status = ?
         ORDER BY s.created_at DESC`
      ).bind(orgId, status)
    : db.prepare(
        `SELECT s.id, s.org_id as orgId, s.user_id as userId, s.source_device_id as sourceDeviceId,
                s.title, s.description, s.status, s.artifact_kind as artifactKind, s.source_tool as sourceTool,
                s.reliability_tier as reliabilityTier, s.raw_capture_json as rawCaptureJson,
                s.normalized_release_id as normalizedReleaseId, s.review_notes as reviewNotes,
                s.created_at as createdAt, s.updated_at as updatedAt,
                u.name as userName, u.email as userEmail
         FROM artifact_submissions s
         JOIN users u ON u.id = s.user_id
         WHERE s.org_id = ?
         ORDER BY s.created_at DESC`
      ).bind(orgId);

  const rows = (await query.all()).results as Array<{
    id: string;
    orgId: string;
    userId: string;
    sourceDeviceId: string | null;
    title: string;
    description: string | null;
    status: string;
    artifactKind: string;
    sourceTool: string | null;
    reliabilityTier: string | null;
    rawCaptureJson: string;
    normalizedReleaseId: string | null;
    reviewNotes: string | null;
    createdAt: string;
    updatedAt: string;
    userName: string;
    userEmail: string;
  }>;

  const submissionsWithPreview = rows.map((row) => {
    const rawCapture = parseJson<Record<string, unknown>>(row.rawCaptureJson, {});
    const preview = normalizeSubmissionCapture(rawCapture);
    return {
      ...row,
      rawCapture,
      normalizedPreview: preview,
    };
  });

  return c.json({ submissions: submissionsWithPreview });
});

submissions.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);
  const body = await c.req.json();

  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  // Legacy suggestion compatibility from the tray.
  const legacyCapture =
    body.capture ||
    (body.configType
      ? {
          kind:
            body.configType === "skills"
              ? "skill"
              : body.configType === "agents"
                ? "agent"
                : body.configType === "rules"
                  ? "rule"
                  : body.configType === "instructions"
                    ? "instructions"
                    : "mcp",
          name: body.title || "Imported Artifact",
          tool: body.sourceTool || "claude-code",
          content: body.content,
        }
      : null);

  if (!legacyCapture) {
    return c.json({ error: "capture is required" }, 400);
  }

  const capture = typeof legacyCapture === "object" && legacyCapture ? (legacyCapture as Record<string, unknown>) : {};
  const normalized = normalizeSubmissionCapture(capture);
  const submissionId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO artifact_submissions
         (id, org_id, user_id, source_device_id, title, description, status, artifact_kind, source_tool, reliability_tier, raw_capture_json, review_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      submissionId,
      orgId,
      user.id,
      typeof body.sourceDeviceId === "string" ? body.sourceDeviceId : null,
      typeof body.title === "string" && body.title ? body.title : normalized.name,
      typeof body.description === "string" ? body.description : null,
      normalized.status,
      normalized.kind,
      typeof capture.tool === "string" ? capture.tool : typeof capture.sourceTool === "string" ? capture.sourceTool : null,
      normalized.reliabilityTier,
      toJson(capture),
      normalized.notes.join(" ")
    )
    .run();

  await logAudit(db, orgId, user.id, "submission.created", "submission", submissionId, {
    title: typeof body.title === "string" && body.title ? body.title : normalized.name,
    artifactKind: normalized.kind,
    reliabilityTier: normalized.reliabilityTier,
  });

  return c.json({
    submission: {
      id: submissionId,
      title: typeof body.title === "string" && body.title ? body.title : normalized.name,
      description: typeof body.description === "string" ? body.description : null,
      status: normalized.status,
      artifactKind: normalized.kind,
      reliabilityTier: normalized.reliabilityTier,
      rawCapture: capture,
      normalizedPreview: normalized,
    },
  });
});

submissions.post("/:submissionId/normalize", async (c) => {
  const db = c.env.DB;
  const { orgId, submissionId } = c.req.param() as { orgId: string; submissionId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  const row = await db
    .prepare("SELECT raw_capture_json as rawCaptureJson FROM artifact_submissions WHERE id = ? AND org_id = ?")
    .bind(submissionId, orgId)
    .first<{ rawCaptureJson: string }>();

  if (!row) return c.json({ error: "Submission not found" }, 404);

  const normalized = normalizeSubmissionCapture(parseJson<Record<string, unknown>>(row.rawCaptureJson, {}));

  await db
    .prepare("UPDATE artifact_submissions SET status = ?, reliability_tier = ?, review_notes = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(normalized.status, normalized.reliabilityTier, normalized.notes.join(" "), submissionId)
    .run();

  return c.json({ normalizedPreview: normalized });
});

submissions.post("/:submissionId/approve", async (c) => {
  const db = c.env.DB;
  const { orgId, submissionId } = c.req.param() as { orgId: string; submissionId: string };
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can approve submissions" }, 403);
  }

  const submission = await db
    .prepare(
      `SELECT id, title, description, status, artifact_kind as artifactKind, raw_capture_json as rawCaptureJson
       FROM artifact_submissions
       WHERE id = ? AND org_id = ?`
    )
    .bind(submissionId, orgId)
    .first<{ id: string; title: string; description: string | null; status: string; artifactKind: string; rawCaptureJson: string }>();

  if (!submission) return c.json({ error: "Submission not found" }, 404);
  if (submission.status === "approved") return c.json({ error: "Submission already approved" }, 400);

  const normalized = normalizeSubmissionCapture(parseJson<Record<string, unknown>>(submission.rawCaptureJson, {}));
  const manifest = (body.manifest as ArtifactManifest | undefined) || normalized.manifest;
  const artifactName = typeof body.artifactName === "string" && body.artifactName ? body.artifactName : normalized.name;
  const artifactDescription =
    typeof body.description === "string" ? body.description : submission.description || null;
  const version = typeof body.version === "string" && body.version ? body.version : "1.0.0";
  const slug = typeof body.slug === "string" && body.slug ? slugify(body.slug) : slugify(artifactName);
  const profileIds = Array.isArray(body.profileIds)
    ? body.profileIds.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const rolloutStrategy = typeof body.rolloutStrategy === "string" ? body.rolloutStrategy : "all_at_once";

  const existingSlug = await db
    .prepare("SELECT id FROM artifacts WHERE org_id = ? AND slug = ?")
    .bind(orgId, slug)
    .first<{ id: string }>();
  if (existingSlug) {
    return c.json({ error: "Artifact slug already exists" }, 409);
  }

  const artifactId = crypto.randomUUID();
  const releaseId = crypto.randomUUID();
  const fields = deriveReleaseFields(manifest);

  await db.batch([
    db
      .prepare(
        `INSERT INTO artifacts
           (id, org_id, slug, name, description, kind, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(artifactId, orgId, slug, artifactName, artifactDescription, normalized.kind, user.id),
    db
      .prepare(
        `INSERT INTO artifact_releases
           (id, artifact_id, version, status, reliability_tier, source_type, source_ref, source_version, digest,
            manifest_json, runtime_json, install_json, launch_json, verify_json, compatibility_json, payload_json,
            created_by_user_id, approved_by_user_id, approved_at, review_notes)
         VALUES (?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        releaseId,
        artifactId,
        version,
        fields.reliabilityTier,
        fields.sourceType,
        fields.sourceRef,
        fields.sourceVersion,
        fields.digest,
        toJson(manifest),
        toJson(manifest.runtime),
        toJson(manifest.install),
        toJson(manifest.launch || null),
        toJson(manifest.verify || null),
        toJson(manifest.compatibility),
        toJson(manifest.payload || null),
        user.id,
        user.id,
        new Date().toISOString(),
        normalized.notes.join(" ")
      ),
    db
      .prepare(
        `UPDATE artifact_submissions
         SET status = 'approved', reliability_tier = ?, normalized_release_id = ?, review_notes = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(fields.reliabilityTier, releaseId, normalized.notes.join(" "), submissionId),
  ]);

  for (const binding of manifest.bindings || []) {
    await db
      .prepare(
        `INSERT INTO artifact_bindings
           (id, artifact_release_id, tool, binding_type, binding_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), releaseId, binding.tool, binding.bindingType, toJson(binding))
      .run();
  }

  for (const profileId of profileIds) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO profile_artifact_assignments
           (id, profile_id, artifact_release_id, desired_state, rollout_strategy, rollout_json, updated_at)
         VALUES (
           COALESCE((SELECT id FROM profile_artifact_assignments WHERE profile_id = ? AND artifact_release_id = ?), ?),
           ?, ?, 'active', ?, ?, datetime('now')
         )`
      )
      .bind(profileId, releaseId, crypto.randomUUID(), profileId, releaseId, rolloutStrategy, toJson(body.rolloutJson || null))
      .run();
  }

  await logAudit(db, orgId, user.id, "submission.approved", "submission", submissionId, {
    artifactId,
    releaseId,
    profileIds,
  });

  return c.json({ artifact: await getArtifactForOrg(db, orgId, artifactId) });
});

submissions.post("/:submissionId/deny", async (c) => {
  const db = c.env.DB;
  const { orgId, submissionId } = c.req.param() as { orgId: string; submissionId: string };
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can deny submissions" }, 403);
  }

  await db
    .prepare(
      `UPDATE artifact_submissions
       SET status = 'denied', review_notes = ?, updated_at = datetime('now')
       WHERE id = ? AND org_id = ?`
    )
    .bind(typeof body.reviewNotes === "string" ? body.reviewNotes : null, submissionId, orgId)
    .run();

  await logAudit(db, orgId, user.id, "submission.denied", "submission", submissionId, {
    reviewNotes: typeof body.reviewNotes === "string" ? body.reviewNotes : null,
  });

  return c.json({ ok: true });
});

export default submissions;
