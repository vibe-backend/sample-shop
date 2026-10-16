# vibe-backend sample shop

Sample shopping site built on vibe-backend.

- `frontend/`: static frontend
- `backend/`: backend defined in markdown using the vibe-backend SDK

## License

[MIT](LICENSE)

## CI/CD

- **CI** (`.github/workflows/ci.yml`, on PRs and pushes to `main`): Markdown lint + local link check; lint/test of `frontend/` and `backend/` once they exist (`package.json` + `pnpm-lock.yaml` → `pnpm install --frozen-lockfile` + lint/test on the Node version pinned in `<component>/.nvmrc` (frontend: 22.22.2, also `engines.node`), `Cargo.toml` → fmt/clippy/test); Docker build (no push) for each component that has a `Dockerfile`.
- **Dependency audit** (`.github/workflows/deps.yml`, on PRs, pushes to `main`, weekly and manually): `pnpm audit --prod --audit-level=high` blocks on production dependencies of `frontend/`; a full `pnpm audit` also blocks on high/critical advisories in dev tooling.
- **CD** (`.github/workflows/cd.yml`, on pushes to `main` and `v*` tags): builds and pushes `ghcr.io/vibe-backend/sample-shop-frontend` and `ghcr.io/vibe-backend/sample-shop-backend`. Each is a no-op until `frontend/Dockerfile` / `backend/Dockerfile` is added.
