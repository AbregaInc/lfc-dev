# LFC

LFC is a monorepo for managing and syncing AI tool configuration across a team.

## Apps

- `apps/api`: Cloudflare Worker API and D1 migrations
- `apps/dashboard`: React dashboard for org, profile, secret, and audit management
- `apps/cli`: published `lfc` CLI package
- `apps/tray`: Tauri desktop tray app for sync and inventory scanning
- `packages/shared`: shared TypeScript types

## Local Development

Requirements:

- Node.js `22`
- `pnpm` `10`
- Rust toolchain for the tray app

Common commands:

```bash
pnpm install
pnpm dev
pnpm lint
cargo check --manifest-path apps/tray/src-tauri/Cargo.toml
```

The API uses Cloudflare Wrangler. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` for local development and set your own secrets.

## Release Conventions

- CLI publishes are triggered by tags named `cli-v*`
- Tray releases are triggered by tags named `tray-v*`
- Production deploys run from `main` and are expected to use the `production`, `npm`, and `release` GitHub environments

## Security-Sensitive Areas

Changes in these paths should receive extra maintainer review:

- `.github/workflows/**`
- `apps/api/src/routes/**`
- `apps/tray/src-tauri/**`

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening a pull request.
