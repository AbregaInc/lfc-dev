import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { authMiddleware, getUser } from "../auth.js";
import { getArtifactForOrg, listArtifactsForOrg } from "../data.js";
import { deriveReleaseFields, type ArtifactManifest } from "../manifests.js";
import { slugify, toJson } from "../utils.js";
import { logAudit } from "../audit.js";

const artifacts = new Hono<AppEnv>();

artifacts.use("*", authMiddleware);

artifacts.get("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  return c.json({ artifacts: await listArtifactsForOrg(db, orgId) });
});

artifacts.post("/", async (c) => {
  const db = c.env.DB;
  const { orgId } = c.req.param() as { orgId: string };
  const user = getUser(c);

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can create artifacts" }, 403);
  }

  const body = await c.req.json();
  const name = typeof body.name === "string" ? body.name : "";
  const description = typeof body.description === "string" ? body.description : null;
  const kind = typeof body.kind === "string" ? body.kind : "skill";
  const version = typeof body.version === "string" && body.version ? body.version : "1.0.0";
  const manifest = body.manifest as ArtifactManifest | undefined;
  const approve = Boolean(body.approve);

  if (!name || !manifest) {
    return c.json({ error: "name and manifest are required" }, 400);
  }

  const slug = typeof body.slug === "string" && body.slug ? slugify(body.slug) : slugify(name);
  const existing = await db
    .prepare("SELECT id FROM artifacts WHERE org_id = ? AND slug = ?")
    .bind(orgId, slug)
    .first<{ id: string }>();

  if (existing) {
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
      .bind(artifactId, orgId, slug, name, description, kind, user.id),
    db
      .prepare(
        `INSERT INTO artifact_releases
           (id, artifact_id, version, status, reliability_tier, source_type, source_ref, source_version, digest,
            manifest_json, runtime_json, install_json, launch_json, verify_json, compatibility_json, payload_json,
            created_by_user_id, approved_by_user_id, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        releaseId,
        artifactId,
        version,
        approve ? "approved" : "draft",
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
        approve ? user.id : null,
        approve ? new Date().toISOString() : null
      ),
  ]);

  for (const binding of manifest.bindings || []) {
    await db
      .prepare(
        `INSERT INTO artifact_bindings
           (id, artifact_release_id, tool, binding_type, binding_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        releaseId,
        binding.tool,
        binding.bindingType,
        toJson(binding)
      )
      .run();
  }

  await logAudit(db, orgId, user.id, "artifact.created", "artifact", artifactId, {
    name,
    kind,
    version,
    status: approve ? "approved" : "draft",
  });

  return c.json({ artifact: await getArtifactForOrg(db, orgId, artifactId) });
});

artifacts.get("/:artifactId", async (c) => {
  const db = c.env.DB;
  const { orgId, artifactId } = c.req.param() as { orgId: string; artifactId: string };
  const user = getUser(c);

  if (user.orgId !== orgId) return c.json({ error: "Forbidden" }, 403);

  const artifact = await getArtifactForOrg(db, orgId, artifactId);
  if (!artifact) return c.json({ error: "Artifact not found" }, 404);

  const profileAssignments = (
    await db
      .prepare(
        `SELECT pa.id, pa.profile_id as profileId, pa.artifact_release_id as artifactReleaseId,
                pa.desired_state as desiredState, pa.rollout_strategy as rolloutStrategy,
                p.name as profileName
         FROM profile_artifact_assignments pa
         JOIN profiles p ON p.id = pa.profile_id
         JOIN artifact_releases r ON r.id = pa.artifact_release_id
         WHERE r.artifact_id = ?`
      )
      .bind(artifactId)
      .all<{ id: string; profileId: string; artifactReleaseId: string; desiredState: string; rolloutStrategy: string; profileName: string }>()
  ).results;

  return c.json({ artifact: { ...artifact, profileAssignments } });
});

artifacts.post("/:artifactId/releases", async (c) => {
  const db = c.env.DB;
  const { orgId, artifactId } = c.req.param() as { orgId: string; artifactId: string };
  const user = getUser(c);
  const body = await c.req.json();

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can create releases" }, 403);
  }

  const artifact = await getArtifactForOrg(db, orgId, artifactId);
  if (!artifact) return c.json({ error: "Artifact not found" }, 404);

  const version = typeof body.version === "string" && body.version ? body.version : "";
  const manifest = body.manifest as ArtifactManifest | undefined;
  const approve = Boolean(body.approve);
  if (!version || !manifest) {
    return c.json({ error: "version and manifest are required" }, 400);
  }

  const fields = deriveReleaseFields(manifest);
  const releaseId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO artifact_releases
         (id, artifact_id, version, status, reliability_tier, source_type, source_ref, source_version, digest,
          manifest_json, runtime_json, install_json, launch_json, verify_json, compatibility_json, payload_json,
          created_by_user_id, approved_by_user_id, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      releaseId,
      artifactId,
      version,
      approve ? "approved" : "draft",
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
      approve ? user.id : null,
      approve ? new Date().toISOString() : null
    )
    .run();

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

  await logAudit(db, orgId, user.id, "artifact.release.created", "artifact_release", releaseId, {
    artifactId,
    version,
    status: approve ? "approved" : "draft",
  });

  return c.json({ artifact: await getArtifactForOrg(db, orgId, artifactId) });
});

artifacts.post("/releases/:releaseId/approve", async (c) => {
  const db = c.env.DB;
  const { orgId, releaseId } = c.req.param() as { orgId: string; releaseId: string };
  const user = getUser(c);

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can approve releases" }, 403);
  }

  const release = await db
    .prepare(
      `SELECT r.id, a.id as artifactId
       FROM artifact_releases r
       JOIN artifacts a ON a.id = r.artifact_id
       WHERE r.id = ? AND a.org_id = ?`
    )
    .bind(releaseId, orgId)
    .first<{ id: string; artifactId: string }>();

  if (!release) return c.json({ error: "Release not found" }, 404);

  await db
    .prepare("UPDATE artifact_releases SET status = 'approved', approved_by_user_id = ?, approved_at = datetime('now') WHERE id = ?")
    .bind(user.id, releaseId)
    .run();

  await logAudit(db, orgId, user.id, "artifact.release.approved", "artifact_release", releaseId, null);

  return c.json({ artifact: await getArtifactForOrg(db, orgId, release.artifactId) });
});

artifacts.post("/releases/:releaseId/deprecate", async (c) => {
  const db = c.env.DB;
  const { orgId, releaseId } = c.req.param() as { orgId: string; releaseId: string };
  const user = getUser(c);

  if (user.orgId !== orgId || user.role !== "admin") {
    return c.json({ error: "Only org admins can deprecate releases" }, 403);
  }

  const release = await db
    .prepare(
      `SELECT r.id, a.id as artifactId
       FROM artifact_releases r
       JOIN artifacts a ON a.id = r.artifact_id
       WHERE r.id = ? AND a.org_id = ?`
    )
    .bind(releaseId, orgId)
    .first<{ id: string; artifactId: string }>();

  if (!release) return c.json({ error: "Release not found" }, 404);

  await db
    .prepare("UPDATE artifact_releases SET status = 'deprecated' WHERE id = ?")
    .bind(releaseId)
    .run();

  await logAudit(db, orgId, user.id, "artifact.release.deprecated", "artifact_release", releaseId, null);

  return c.json({ artifact: await getArtifactForOrg(db, orgId, release.artifactId) });
});

export default artifacts;
