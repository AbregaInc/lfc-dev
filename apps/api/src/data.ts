import type { ArtifactManifest } from "./manifests.js";
import { parseJson } from "./utils.js";

type ArtifactRow = {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type ReleaseRow = {
  id: string;
  artifactId: string;
  version: string;
  status: string;
  reliabilityTier: string;
  sourceType: string;
  sourceRef: string;
  sourceVersion: string | null;
  digest: string | null;
  manifestJson: string;
  reviewNotes: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  createdAt: string;
  approvedAt: string | null;
};

type AssignmentRow = {
  id: string;
  profileId: string;
  artifactReleaseId: string;
  desiredState: string;
  rolloutStrategy: string;
  rolloutJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export function hydrateArtifact(row: ArtifactRow) {
  return {
    id: row.id,
    orgId: row.orgId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    kind: row.kind,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function hydrateRelease(row: ReleaseRow) {
  return {
    id: row.id,
    artifactId: row.artifactId,
    version: row.version,
    status: row.status,
    reliabilityTier: row.reliabilityTier,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    sourceVersion: row.sourceVersion,
    digest: row.digest,
    manifest: parseJson<ArtifactManifest>(row.manifestJson, {
      kind: "skill",
      reliabilityTier: "managed",
      source: { type: "inline_files", ref: row.sourceRef, version: row.sourceVersion ?? undefined, digest: row.digest ?? undefined },
      runtime: { kind: "none", provisionMode: "managed" },
      install: { strategy: "copy_files", managedRoot: "~/.lfc/artifacts" },
      compatibility: { os: ["darwin"], arch: ["arm64"], tools: [] },
      bindings: [],
    }),
    reviewNotes: row.reviewNotes,
    createdByUserId: row.createdByUserId,
    approvedByUserId: row.approvedByUserId,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
  };
}

export function hydrateAssignment(row: AssignmentRow) {
  return {
    id: row.id,
    profileId: row.profileId,
    artifactReleaseId: row.artifactReleaseId,
    desiredState: row.desiredState,
    rolloutStrategy: row.rolloutStrategy,
    rolloutJson: parseJson<Record<string, unknown> | null>(row.rolloutJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getSecretMap(db: D1Database, orgId: string, refs?: string[]) {
  if (refs && refs.length === 0) return {};
  const rows = (
    await db
      .prepare("SELECT name, value_encrypted as value FROM secrets WHERE org_id = ?")
      .bind(orgId)
      .all<{ name: string; value: string }>()
  ).results;

  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!refs || refs.includes(row.name)) {
      map[row.name] = row.value;
    }
  }
  return map;
}

export async function listArtifactsForOrg(db: D1Database, orgId: string) {
  const artifactRows = (
    await db
      .prepare(
        `SELECT a.id, a.org_id as orgId, a.slug, a.name, a.description, a.kind,
                a.created_by_user_id as createdByUserId, a.created_at as createdAt, a.updated_at as updatedAt
         FROM artifacts a
         WHERE a.org_id = ?
         ORDER BY a.updated_at DESC, a.created_at DESC`
      )
      .bind(orgId)
      .all<ArtifactRow>()
  ).results;

  const releaseRows = (
    await db
      .prepare(
        `SELECT r.id, r.artifact_id as artifactId, r.version, r.status,
                r.reliability_tier as reliabilityTier, r.source_type as sourceType,
                r.source_ref as sourceRef, r.source_version as sourceVersion, r.digest,
                r.manifest_json as manifestJson, r.review_notes as reviewNotes,
                r.created_by_user_id as createdByUserId, r.approved_by_user_id as approvedByUserId,
                r.created_at as createdAt, r.approved_at as approvedAt
         FROM artifact_releases r
         JOIN artifacts a ON a.id = r.artifact_id
         WHERE a.org_id = ?
         ORDER BY r.created_at DESC`
      )
      .bind(orgId)
      .all<ReleaseRow>()
  ).results;

  const releasesByArtifact = new Map<string, ReturnType<typeof hydrateRelease>[]>();
  for (const row of releaseRows) {
    const release = hydrateRelease(row);
    const releases = releasesByArtifact.get(row.artifactId) || [];
    releases.push(release);
    releasesByArtifact.set(row.artifactId, releases);
  }

  return artifactRows.map((row) => {
    const artifact = hydrateArtifact(row);
    const releases = releasesByArtifact.get(row.id) || [];
    const approvedRelease =
      releases.find((release) => release.status === "approved") ||
      releases[0] ||
      null;
    return {
      ...artifact,
      releases,
      approvedRelease,
    };
  });
}

export async function getArtifactForOrg(db: D1Database, orgId: string, artifactId: string) {
  const artifacts = await listArtifactsForOrg(db, orgId);
  return artifacts.find((artifact) => artifact.id === artifactId) || null;
}

export async function listAssignmentsForProfile(db: D1Database, profileId: string) {
  const rows = (
    await db
      .prepare(
        `SELECT pa.id, pa.profile_id as profileId, pa.artifact_release_id as artifactReleaseId,
                pa.desired_state as desiredState, pa.rollout_strategy as rolloutStrategy,
                pa.rollout_json as rolloutJson, pa.created_at as createdAt, pa.updated_at as updatedAt,
                a.id as artifactId, a.org_id as orgId, a.slug, a.name, a.description, a.kind,
                a.created_by_user_id as createdByUserId, a.created_at as artifactCreatedAt, a.updated_at as artifactUpdatedAt,
                r.version, r.status, r.reliability_tier as reliabilityTier, r.source_type as sourceType,
                r.source_ref as sourceRef, r.source_version as sourceVersion, r.digest,
                r.manifest_json as manifestJson, r.review_notes as reviewNotes,
                r.created_by_user_id as releaseCreatedByUserId, r.approved_by_user_id as approvedByUserId,
                r.created_at as releaseCreatedAt, r.approved_at as approvedAt
         FROM profile_artifact_assignments pa
         JOIN artifact_releases r ON r.id = pa.artifact_release_id
         JOIN artifacts a ON a.id = r.artifact_id
         WHERE pa.profile_id = ?
         ORDER BY pa.created_at DESC`
      )
      .bind(profileId)
      .all<
        AssignmentRow &
          ArtifactRow & {
            artifactId: string;
            artifactCreatedAt: string;
            artifactUpdatedAt: string;
            version: string;
            status: string;
            reliabilityTier: string;
            sourceType: string;
            sourceRef: string;
            sourceVersion: string | null;
            digest: string | null;
            manifestJson: string;
            reviewNotes: string | null;
            releaseCreatedByUserId: string;
            approvedByUserId: string | null;
            releaseCreatedAt: string;
            approvedAt: string | null;
          }
      >()
  ).results;

  return rows.map((row) => ({
    assignment: hydrateAssignment(row),
    artifact: hydrateArtifact({
      id: row.artifactId,
      orgId: row.orgId,
      slug: row.slug,
      name: row.name,
      description: row.description,
      kind: row.kind,
      createdByUserId: row.createdByUserId,
      createdAt: row.artifactCreatedAt,
      updatedAt: row.artifactUpdatedAt,
    }),
    release: hydrateRelease({
      id: row.artifactReleaseId,
      artifactId: row.artifactId,
      version: row.version,
      status: row.status,
      reliabilityTier: row.reliabilityTier,
      sourceType: row.sourceType,
      sourceRef: row.sourceRef,
      sourceVersion: row.sourceVersion,
      digest: row.digest,
      manifestJson: row.manifestJson,
      reviewNotes: row.reviewNotes,
      createdByUserId: row.releaseCreatedByUserId,
      approvedByUserId: row.approvedByUserId,
      createdAt: row.releaseCreatedAt,
      approvedAt: row.approvedAt,
    }),
  }));
}

export async function listDesiredAssignmentsForUser(db: D1Database, userId: string) {
  const rows = (
    await db
      .prepare(
        `SELECT pa.id as assignmentId, pa.desired_state as desiredState, pa.rollout_strategy as rolloutStrategy,
                pa.rollout_json as rolloutJson, p.id as profileId, p.name as profileName,
                a.id as artifactId, a.org_id as orgId, a.slug, a.name, a.description, a.kind,
                a.created_by_user_id as artifactCreatedByUserId, a.created_at as artifactCreatedAt, a.updated_at as artifactUpdatedAt,
                r.id as artifactReleaseId, r.version, r.status, r.reliability_tier as reliabilityTier,
                r.source_type as sourceType, r.source_ref as sourceRef, r.source_version as sourceVersion, r.digest,
                r.manifest_json as manifestJson, r.review_notes as reviewNotes,
                r.created_by_user_id as releaseCreatedByUserId, r.approved_by_user_id as approvedByUserId,
                r.created_at as releaseCreatedAt, r.approved_at as approvedAt
         FROM user_profiles up
         JOIN profiles p ON p.id = up.profile_id
         JOIN profile_artifact_assignments pa ON pa.profile_id = p.id
         JOIN artifact_releases r ON r.id = pa.artifact_release_id
         JOIN artifacts a ON a.id = r.artifact_id
         WHERE up.user_id = ? AND r.status = 'approved'
         ORDER BY p.created_at, pa.created_at`
      )
      .bind(userId)
      .all<{
        assignmentId: string;
        desiredState: string;
        rolloutStrategy: string;
        rolloutJson: string | null;
        profileId: string;
        profileName: string;
        artifactId: string;
        orgId: string;
        slug: string;
        name: string;
        description: string | null;
        kind: string;
        artifactCreatedByUserId: string;
        artifactCreatedAt: string;
        artifactUpdatedAt: string;
        artifactReleaseId: string;
        version: string;
        status: string;
        reliabilityTier: string;
        sourceType: string;
        sourceRef: string;
        sourceVersion: string | null;
        digest: string | null;
        manifestJson: string;
        reviewNotes: string | null;
        releaseCreatedByUserId: string;
        approvedByUserId: string | null;
        releaseCreatedAt: string;
        approvedAt: string | null;
      }>()
  ).results;

  const deduped = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!deduped.has(row.artifactReleaseId)) deduped.set(row.artifactReleaseId, row);
  }

  return [...deduped.values()].map((row) => ({
    assignment: {
      id: row.assignmentId,
      profileId: row.profileId,
      artifactReleaseId: row.artifactReleaseId,
      desiredState: row.desiredState,
      rolloutStrategy: row.rolloutStrategy,
      rolloutJson: parseJson<Record<string, unknown> | null>(row.rolloutJson, null),
      profileName: row.profileName,
    },
    artifact: hydrateArtifact({
      id: row.artifactId,
      orgId: row.orgId,
      slug: row.slug,
      name: row.name,
      description: row.description,
      kind: row.kind,
      createdByUserId: row.artifactCreatedByUserId,
      createdAt: row.artifactCreatedAt,
      updatedAt: row.artifactUpdatedAt,
    }),
    release: hydrateRelease({
      id: row.artifactReleaseId,
      artifactId: row.artifactId,
      version: row.version,
      status: row.status,
      reliabilityTier: row.reliabilityTier,
      sourceType: row.sourceType,
      sourceRef: row.sourceRef,
      sourceVersion: row.sourceVersion,
      digest: row.digest,
      manifestJson: row.manifestJson,
      reviewNotes: row.reviewNotes,
      createdByUserId: row.releaseCreatedByUserId,
      approvedByUserId: row.approvedByUserId,
      createdAt: row.releaseCreatedAt,
      approvedAt: row.approvedAt,
    }),
  }));
}
