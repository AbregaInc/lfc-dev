# Artifact Sync Rewrite Plan

## Why this rewrite is necessary

The current system models org rollout as "profiles produce config blobs, clients write files."

That is good enough for:

- inline instructions
- rules
- skills that are just files

It is not good enough for:

- MCP servers that require runtimes or package resolution
- plugins that need installation
- deterministic rollout, health checks, canaries, and rollback
- distinguishing portable artifacts from local one-off hacks

Today:

- the API returns `profile_configs` as raw content blobs in [`packages/shared/src/index.ts`](./packages/shared/src/index.ts)
- `/api/sync` filters those blobs by installed tools and returns them directly in [`apps/api/src/routes/sync.ts`](./apps/api/src/routes/sync.ts)
- the tray and CLI write files locally in [`apps/tray/src-tauri/src/sync.rs`](./apps/tray/src-tauri/src/sync.rs) and [`apps/cli/src/index.ts`](./apps/cli/src/index.ts)
- suggestions are just proposed config blobs that, when approved, overwrite or create `profile_configs` in [`apps/api/src/routes/suggestions.ts`](./apps/api/src/routes/suggestions.ts)

That model cannot answer the hard question: "How do we make User A's discovered MCP or plugin reliably work for User B?"

The rewrite changes the unit of distribution from `config blob` to `artifact release`.

## Product principles

1. The canonical unit is an immutable artifact release, not a mutable command string.
2. Every rollout is desired-state based.
3. Portable and non-portable things are both allowed, but they are not treated the same.
4. Determinism requires pinned versions, digests, managed install paths, and health checks.
5. "Works on my machine" imports are allowed only with an explicit reliability downgrade.
6. Clients should only switch a tool to a new release after install and verification succeed.
7. Rollback is first-class.

## Reliability tiers

Every artifact release gets a reliability tier shown everywhere in the UI and API.

### `managed`

Meaning:

- exact version is pinned
- source is typed
- install method is known
- payload is mirrored or fully reproducible
- runtime requirements are explicit
- health check exists
- rollback is supported

Examples:

- a skill bundle stored as exact files
- an MCP from `@acme/server@1.2.3` with a pinned wrapper install
- a binary download with SHA-256
- a Docker image pinned by digest

### `best_effort`

Meaning:

- source is mostly understood
- client can attempt install or validation
- determinism is weaker because some dependency is external or host-controlled

Examples:

- marketplace plugin with a pinned version but vendor-controlled installer behavior
- an MCP normalized from `uvx` where Python presence is required from the host

### `unreliable`

Meaning:

- client cannot deterministically reproduce the install
- rollout may only write config or reference a raw command/path
- health guarantees are limited or absent
- can still be shared org-wide, but UI must warn about likely machine-to-machine failures

Examples:

- raw `npx some-package`
- local absolute path binaries
- opaque plugin references with no automation path
- interactive shell installers

This replaces "unsupported" as a product outcome. Unsupported internally still exists, but user-facing behavior is "allowed, marked unreliable."

## Target architecture

### Core domain objects

- `Artifact`
  - logical thing users recognize: "Sentry MCP", "Better React Skill", "Foo plugin"
- `ArtifactRelease`
  - immutable release of an artifact with exact source, version, digest, bindings, install strategy, and verification
- `ArtifactSubmission`
  - a user-discovered candidate artifact before approval
- `Profile`
  - remains the assignment container for teams or use cases
- `ProfileArtifactAssignment`
  - "Profile X wants release Y active"
- `Device`
  - one physical machine/client installation
- `DeviceArtifactState`
  - state machine for install, activation, failure, and rollback on a specific device

### Storage

Keep the current Cloudflare shape and add:

- D1 for metadata/state
- R2 for mirrored payloads and uploaded file bundles
- Cloudflare Queues for background normalization, mirroring, and scanning

If infra later moves to AWS, preserve the same boundaries:

- relational metadata store
- object storage
- async worker queue

## Proposed schema

The current schema in [`apps/api/migrations/0001_schema.sql`](./apps/api/migrations/0001_schema.sql) is profile-config centric. Add a new migration family for artifact distribution.

### New tables

- `devices`
  - `id`
  - `org_id`
  - `user_id`
  - `name`
  - `platform`
  - `arch`
  - `client_kind` (`tray`, `cli`)
  - `client_version`
  - `last_seen_at`
  - `status`

- `device_tools`
  - `device_id`
  - `tool`
  - `detected_version`
  - `installed`
  - `last_seen_at`

- `artifacts`
  - `id`
  - `org_id`
  - `slug`
  - `name`
  - `kind` (`skill`, `mcp`, `plugin`, `rule`, `agent`, `instructions`)
  - `created_by_user_id`
  - `created_at`

- `artifact_releases`
  - `id`
  - `artifact_id`
  - `version`
  - `status` (`draft`, `approved`, `deprecated`, `archived`)
  - `reliability_tier` (`managed`, `best_effort`, `unreliable`)
  - `source_type` (`inline_files`, `npm`, `pypi`, `binary`, `docker`, `marketplace`, `raw_command`, `raw_path`)
  - `source_ref`
  - `source_version`
  - `digest`
  - `manifest_json`
  - `install_json`
  - `launch_json`
  - `verify_json`
  - `compatibility_json`
  - `created_by_user_id`
  - `approved_by_user_id`
  - `created_at`
  - `approved_at`

- `artifact_bindings`
  - `id`
  - `artifact_release_id`
  - `tool`
  - `binding_type` (`mcp`, `skill`, `plugin`, `rule`, `agent`, `instructions`)
  - `binding_json`

- `artifact_payloads`
  - `id`
  - `artifact_release_id`
  - `payload_kind` (`file_bundle`, `archive`, `binary`, `metadata`)
  - `storage_key`
  - `size_bytes`
  - `digest`

- `artifact_submissions`
  - `id`
  - `org_id`
  - `user_id`
  - `source_device_id`
  - `status` (`submitted`, `normalized`, `needs_packaging`, `approved`, `denied`)
  - `artifact_kind`
  - `raw_capture_json`
  - `normalized_release_id`
  - `review_notes`
  - `created_at`
  - `updated_at`

- `profiles`
  - keep existing table

- `profile_artifact_assignments`
  - `id`
  - `profile_id`
  - `artifact_release_id`
  - `desired_state` (`active`, `removed`)
  - `rollout_strategy` (`all_at_once`, `canary`, `phased`)
  - `rollout_json`
  - `created_at`
  - `updated_at`

- `device_artifact_states`
  - `id`
  - `device_id`
  - `artifact_release_id`
  - `desired_state`
  - `actual_state`
  - `activation_state`
  - `install_root`
  - `wrapper_path`
  - `previous_release_id`
  - `last_error_code`
  - `last_error_detail`
  - `last_verified_at`
  - `last_transition_at`

- `device_events`
  - `id`
  - `device_id`
  - `artifact_release_id`
  - `event_type`
  - `event_json`
  - `created_at`

- `artifact_health_checks`
  - `id`
  - `device_id`
  - `artifact_release_id`
  - `result` (`pass`, `fail`, `unknown`)
  - `duration_ms`
  - `details_json`
  - `created_at`

### Existing tables to deprecate

Do not delete immediately:

- `profile_configs`
- `suggestions`
- `sync_events`

They should stay readable during migration while new flows dual-write.

## Canonical manifest

Each `artifact_releases.manifest_json` should serialize a strongly typed manifest:

```ts
type ReliabilityTier = "managed" | "best_effort" | "unreliable";

type ArtifactManifest = {
  kind: "skill" | "mcp" | "plugin" | "rule" | "agent" | "instructions";
  reliabilityTier: ReliabilityTier;
  source: {
    type:
      | "inline_files"
      | "npm"
      | "pypi"
      | "binary"
      | "docker"
      | "marketplace"
      | "raw_command"
      | "raw_path";
    ref: string;
    version?: string;
    digest?: string;
    mirroredPayloadKey?: string;
  };
  runtime: {
    kind: "none" | "node" | "python" | "docker" | "native";
    version?: string;
    provisionMode: "managed" | "system";
  };
  install: {
    strategy:
      | "copy_files"
      | "npm_package"
      | "python_package"
      | "download_binary"
      | "pull_image"
      | "write_config_only";
    managedRoot: string;
  };
  launch?: {
    command: string;
    args: string[];
    env: Array<{ name: string; secretRef?: string; required: boolean }>;
  };
  verify?: {
    type: "file_hash" | "exec" | "http" | "none";
    command?: string;
    args?: string[];
    timeoutMs?: number;
    expectedExitCode?: number;
  };
  compatibility: {
    os: string[];
    arch: string[];
    tools: string[];
  };
  bindings: Array<{
    tool: string;
    bindingType: string;
    configTemplate?: string;
    targetPath?: string;
  }>;
};
```

## Sync v2 protocol

The current sync request/response in [`packages/shared/src/index.ts`](./packages/shared/src/index.ts) is config-diff oriented. Replace it with desired state.

### Device registration

`POST /api/devices/register`

Request:

- client kind/version
- machine fingerprint or generated device ID
- user-visible device name
- OS/arch
- detected tools and versions

Response:

- device ID
- server feature flags

### Desired state sync

`POST /api/devices/:deviceId/sync`

Request:

- detected tools
- installed releases
- current `device_artifact_states`
- failed installs since last sync
- health summaries
- inventory snapshot

Response:

- desired assignments for that device
- manifests for new or changed releases
- payload download descriptors
- secret material or secret references
- removals
- rollout gates

### Device reporting

- `POST /api/devices/:deviceId/events`
- `POST /api/devices/:deviceId/health`
- `POST /api/devices/:deviceId/inventory`

## Discovery and suggestion flow

The current suggestion system stores title + content blob and writes directly into `profile_configs`.

Replace it with a two-stage import pipeline.

### Stage 1: local capture

The client discovers a local skill, MCP, rule, or plugin and captures:

- tool
- artifact kind
- local files and checksums
- command, args, env keys
- runtime clues
- path or package clues
- whether the item is already LFC-managed

### Stage 2: normalization

Server worker attempts to normalize the capture:

- raw files -> `inline_files`
- `npx @scope/pkg` -> `npm` if package name and version can be pinned
- `uvx pkg` -> `pypi` or `best_effort` Python package
- local absolute path -> `raw_path` unreliable
- opaque plugin reference -> `marketplace` or `unreliable`

Output:

- a draft `artifact_release`
- reliability tier
- packaging gaps
- reviewer notes

### Stage 3: approval

Admin can:

- approve as-is
- edit metadata
- attach release notes
- downgrade or acknowledge reliability
- assign to one or more profiles
- require canary rollout

### Stage 4: rollout

Assigned profiles emit desired artifact state, not blob content.

## Tool-specific binding model

Bindings are separate from installs.

### Skills, rules, instructions, agents

Install behavior:

- usually no runtime install
- copy exact files to managed directory or target directory
- bind into the tool's expected file path

Managed example:

- artifact payload contains exact markdown or skill directory contents
- client writes files and verifies hashes

### MCP servers

Install behavior:

- install payload into `~/.lfc/artifacts/<releaseId>/`
- create a stable wrapper in `~/.lfc/bin/<slug>`
- tool config points to wrapper path, not raw package manager command

Wrapper responsibilities:

- inject resolved secrets
- set working directory if needed
- exec the real managed binary/package
- emit local telemetry

### Plugins

Install behavior depends on the host tool.

Support only when one of these is true:

- plugin can be installed from exact files
- vendor exposes noninteractive CLI/API installation
- marketplace install can be scripted and version-pinned

Otherwise:

- allow creation as `unreliable`
- sync only the reference/instructions
- do not claim deterministic rollout

## Client rewrite plan

The production client is the tray app in Rust. The CLI should follow the same protocol, but it should not block shipping v2.

### New tray modules

Split [`apps/tray/src-tauri/src/sync.rs`](./apps/tray/src-tauri/src/sync.rs) into:

- `device.rs`
  - registration, device identity, local state root
- `inventory.rs`
  - detect tools, scan local configs, discover unmanaged artifacts
- `protocol.rs`
  - sync v2 request/response types
- `planner.rs`
  - diff desired state against installed state
- `executor.rs`
  - execute install/remove/activate/rollback plans
- `installers/`
  - `inline_files.rs`
  - `npm.rs`
  - `python.rs`
  - `binary.rs`
  - `docker.rs`
  - `write_config_only.rs`
- `bindings/`
  - `mcp.rs`
  - `skills.rs`
  - `rules.rs`
  - `agents.rs`
  - `instructions.rs`
  - `plugins.rs`
- `health.rs`
  - artifact verification and post-activation health checks
- `state_store.rs`
  - local durable state in `~/.lfc/state/`
- `reporting.rs`
  - send install events, health, and inventory

### Local filesystem layout

```text
~/.lfc/
  state/
    device.json
    artifact-states.json
    sync-cursor.json
  artifacts/
    <releaseId>/
      payload/
      env/
      metadata.json
  bin/
    <artifact-slug>
  cache/
  backups/
```

### Client state machine

Per device + artifact release:

- `pending`
- `fetching`
- `installing`
- `staged`
- `verifying`
- `active`
- `failed`
- `rollback_pending`
- `rolled_back`
- `removed`

Rules:

- only bind tool config after `verifying -> active`
- keep prior release until new release is active
- on failure, leave prior config in place when possible
- `unreliable` releases may end at `config_applied_unverified`

### CLI plan

Current CLI in [`apps/cli/src/index.ts`](./apps/cli/src/index.ts) duplicates client logic in TypeScript.

Recommended plan:

- keep existing CLI as `sync v1` during migration
- add a separate `sync v2` path behind a flag
- after tray stabilizes, port the same protocol semantics into CLI
- do not attempt to force identical implementation details across Rust and Node
- do require identical JSON protocol fixtures and golden tests

## API rewrite plan

### New route groups

- `/api/devices`
  - register
  - sync
  - report events
  - report health
  - upload inventory

- `/api/artifacts`
  - create draft
  - get artifact
  - list releases
  - approve release
  - deprecate release

- `/api/submissions`
  - create from local discovery
  - normalize
  - approve
  - deny

- `/api/profiles/:profileId/artifacts`
  - list assignments
  - assign release
  - remove release
  - rollout controls

- `/api/orgs/:orgId/devices`
  - fleet view
  - per-device state
  - failures

### Existing routes to freeze

After v2 is live behind a flag:

- freeze new feature work on `/api/sync`
- freeze `suggestions` as a legacy flow
- keep read-only status for old clients until migration ends

## Dashboard rewrite plan

Current dashboard mental model is "profiles contain config types."

Target mental model:

- profiles contain assigned artifact releases
- artifacts have versions and reliability tiers
- submissions are reviewed and promoted into releases
- fleet view shows per-device rollout state

### New pages or major rewrites

- `Artifacts`
  - catalog view
  - release history
  - reliability badges
  - compatibility

- `Submissions`
  - replaces raw suggestion review
  - shows normalization result and reliability tier
  - allows admin edits before approval

- `Profiles`
  - switch from config blobs to assigned artifacts
  - show rollout strategy per assignment

- `Fleet`
  - replace or extend current team status
  - device-by-device install/health/rollback state
  - filter by failed installs and unreliable artifacts

- `Artifact Detail`
  - source, digests, bindings, required secrets, install history

### Keep from current dashboard

- org/user/profile shell
- audit log
- secret management

## Migration strategy

Use additive migration, not big-bang replacement.

### Phase 0: groundwork

- add new schema and shared v2 types
- add feature flags for v2 client and dashboard
- add device registration

### Phase 1: artifact model without installers

Convert file-only config types first:

- instructions
- rules
- agents
- skills

Migration rule:

- each existing `profile_configs` row becomes a file-based `artifact_release`
- one `profile_artifact_assignment` created per profile/config

This gets the new data model working without runtime install complexity.

### Phase 2: MCP normalization

Build importer that converts current MCP JSON into artifact releases:

- if command pattern is recognized and pinnable, import as `managed` or `best_effort`
- otherwise import as `unreliable` with `write_config_only`

Migration rule:

- existing raw MCP entries remain supported
- normalized MCPs get wrappers and managed installs

### Phase 3: sync v2 in tray

- implement device registration
- implement desired-state sync
- implement file-based artifacts
- implement `write_config_only` unreliable MCPs
- implement activation/rollback state machine

### Phase 4: dashboard cutover

- new artifact catalog
- new submission review
- profile assignment UI
- fleet status

### Phase 5: managed MCP installers

Ship in this order:

- `inline_files`
- `npm`
- `binary`
- `docker`
- `python`

This order reduces complexity while covering the most likely MCP distribution paths.

### Phase 6: CLI v2

- implement protocol parity
- add `doctor`, `plan`, and `events` commands
- keep `sync --dry-run`

### Phase 7: legacy retirement

- stop writing new `profile_configs`
- stop accepting legacy suggestions
- keep read-only migration fallback for a deprecation window
- remove v1 routes and client code after migration reaches threshold

## Handling unreliable artifacts

This is a product and UI requirement, not just a backend enum.

### Unreliable artifact behavior

- allowed to be submitted and approved
- clearly labeled in dashboard and client
- excluded from "deterministic rollout" metrics
- excluded from automatic canary promotion
- may skip install and health phases
- device state shown as:
  - `config_applied_unverified`
  - `failed_prerequisites`
  - `unknown_runtime`

### Required UI copy

Every unreliable artifact should explain why it is unreliable:

- requires system `node` but version unknown
- references local path
- package version not pinned
- vendor plugin install cannot be automated
- network install is required at runtime

## Security and secrets

Current sync resolves secrets server-side and returns them in the sync payload.

For v2:

- keep this initially for migration speed
- move toward per-device secret material only for assigned artifacts
- for MCP wrappers, prefer local secret injection at wrapper launch instead of writing secrets into every tool config file

Longer-term improvement:

- store secret material in OS keychain where possible
- wrapper reads from secure local store

## Testing strategy

### API

- route contract tests for new device/artifact endpoints
- migration tests from `profile_configs` to `artifact_releases`
- normalization tests from raw captures to manifests

### Tray

- unit tests per installer strategy
- unit tests for planner and rollback rules
- integration tests with fixture manifests
- golden tests for generated tool configs

### CLI

- protocol fixture tests
- `sync --dry-run` snapshots

### Cross-client contract

Maintain shared JSON fixtures for:

- desired-state sync responses
- artifact manifests
- expected device event payloads

Both Rust and TypeScript clients must pass the same fixture suite.

## Concrete repo changes

### `packages/shared`

Replace config-centric shared types with:

- device types
- artifact and release types
- sync v2 types
- reliability tier enums

Keep v1 types during migration.

### `apps/api`

Add:

- migrations for artifact/device tables
- artifact routes
- device routes
- normalization worker entry points
- queue consumers for mirroring/scanning

Refactor:

- [`apps/api/src/routes/sync.ts`](./apps/api/src/routes/sync.ts) into legacy v1 only
- [`apps/api/src/routes/suggestions.ts`](./apps/api/src/routes/suggestions.ts) into submission/review flow
- [`apps/api/src/routes/status.ts`](./apps/api/src/routes/status.ts) into fleet/device state based on `device_artifact_states`

### `apps/tray`

Refactor:

- [`apps/tray/src-tauri/src/commands.rs`](./apps/tray/src-tauri/src/commands.rs) to use device registration and sync v2
- split [`apps/tray/src-tauri/src/sync.rs`](./apps/tray/src-tauri/src/sync.rs) into smaller install/binding/state modules

Add:

- local state store
- installers
- wrappers
- health reporting

### `apps/dashboard`

Rewrite:

- profiles page
- suggestions page
- team/fleet page

Add:

- artifacts catalog
- artifact detail
- release approval flow

### `apps/cli`

Add v2 commands:

- `lfc device register`
- `lfc sync-v2`
- `lfc doctor`
- `lfc events`

Retain legacy `sync` until cutover is complete.

## Milestones

### Milestone 1

Artifact data model live, file-based artifacts supported, no runtime installers yet.

Exit criteria:

- instructions/rules/skills/agents can be represented as `artifact_releases`
- tray can sync file-based artifacts via v2
- dashboard can review submissions and assign artifacts

### Milestone 2

MCPs supported in two modes:

- `managed` for normalized installable releases
- `unreliable` for raw command/path fallbacks

Exit criteria:

- tray installs managed npm/binary MCPs into `~/.lfc/artifacts`
- tray can bind wrapper paths into tool configs
- rollback works

### Milestone 3

Fleet visibility and rollout control.

Exit criteria:

- per-device artifact state visible in dashboard
- canary rollout supported
- failed installs can be filtered and rolled back

### Milestone 4

Legacy flow retired.

Exit criteria:

- no new writes to `profile_configs`
- no new writes to legacy `suggestions`
- v1 sync removed from tray

## Recommended implementation order

1. Add new D1 schema, shared types, and feature flags.
2. Build artifact submissions and approval flow in the API.
3. Migrate file-based config types to artifact releases.
4. Implement tray sync v2 for file-based artifacts.
5. Build dashboard artifact/profile/fleet UIs.
6. Add MCP normalization pipeline and unreliable fallback flow.
7. Implement managed MCP installers and wrapper binding.
8. Add fleet events, health reporting, canaries, and rollback tooling.
9. Port CLI to v2.
10. Retire v1 tables and routes.

## Decisions to make before coding

These need explicit product/engineering decisions:

1. Do we keep `profiles` as the primary assignment concept, or move to `groups/channels`?
2. Are we committing to Cloudflare R2 + Queues for payload mirroring and normalization jobs?
3. Which installer strategies are in MVP for managed MCPs:
   - `npm`
   - `binary`
   - `docker`
   - `python`
4. Do we require mirrored payloads for `managed`, or can a pinned public registry source still count as `managed` in MVP?
5. Are plugins in MVP, or do we ship the data model first and keep plugin install as `unreliable` only?

## Recommended answers

1. Keep `profiles` for now to reduce dashboard churn.
2. Use Cloudflare R2 + Queues because the repo is already on Workers/D1.
3. MVP installer strategies should be `inline_files`, `npm`, `binary`, and `write_config_only`.
4. Allow pinned public registry sources to count as `managed` in MVP, but mark whether they are mirrored.
5. Model plugins now, but ship them as `unreliable` unless a vendor-specific automation path exists.
