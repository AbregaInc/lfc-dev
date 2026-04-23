# Contributing

## Development

```bash
pnpm install
pnpm lint
pnpm build
cargo check --manifest-path apps/tray/src-tauri/Cargo.toml
```

Use `pnpm dev` for the dashboard and API during local development.

## Pull Requests

- Keep pull requests focused. Split workflow changes from product changes when possible.
- Do not add `pull_request_target`, secret-bearing PR workflows, or unpinned third-party GitHub Actions.
- Pin every GitHub Action to a full commit SHA.
- Treat changes under `.github/workflows/**`, `apps/api/src/routes/**`, and `apps/tray/src-tauri/**` as security-sensitive.
- Do not commit credentials, private keys, `.env` files, or production tokens.

## Releases

- Publish the CLI with a `cli-vX.Y.Z` tag.
- Release the tray app with a `tray-vX.Y.Z` tag.
- Production deployments are expected to run from `main`.

## Security Reporting

If you believe you have found a security issue, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
