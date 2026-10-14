# vibe-backend sample shop

Sample shopping site built on vibe-backend.

- `frontend/`: static frontend
- `backend/`: backend defined in markdown using the vibe-backend SDK

## License

[MIT](LICENSE)

## CI/CD

- **CI** (`.github/workflows/ci.yml`, on PRs and pushes to `main`): Markdown lint + local link check; lint/test of `frontend/` and `backend/` once they exist (`package.json` → npm lint/test, `Cargo.toml` → fmt/clippy/test); Docker build (no push) for each component that has a `Dockerfile`.
- **CD** (`.github/workflows/cd.yml`, on pushes to `main` and `v*` tags): builds and pushes `ghcr.io/vibe-backend/sample-shop-frontend` and `ghcr.io/vibe-backend/sample-shop-backend`. Each is a no-op until `frontend/Dockerfile` / `backend/Dockerfile` is added.
