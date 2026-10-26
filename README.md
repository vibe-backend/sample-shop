# vibe-backend sample shop

Sample shopping site built on vibe-backend.

- `frontend/`: static frontend (mock data until a full shop contract exists)
- `backend/`: minimal memory-mode API described in markdown, built with the vibe-backend SDK `v1.0.0-rc.8`

Anyone can call these routes. The SDK default route prefix is `/api` and the default slug is `dev`, so URLs need no slug. There is no Postgres provider. Data lives in memory and is lost when the runtime restarts.

- `GET /api/web/v1/shop` returns HTTP 200 and `{"shop":"sample-shop","status":"open","currency":"HKD"}`.
- `GET /api/web/v1/counter` returns `{"value": n}`, starting at zero.
- `POST /api/web/v1/increment-counter` adds one and returns `{"value": n}`.

`backend/` holds `api/`, `models/`, `slugs.example.json`, `Dockerfile`, and `.gitignore`. CI and Docker build with `LLM_PROVIDER=fake` (image build arg `VIBE_LLM=fake`). The signed release workflow builds with a live LLM.

## Backend

Install SDK `v1.0.0-rc.8` with `curl`, `tar`, and an authenticated GitHub CLI (`gh auth login`). The installer verifies checksums and GitHub attestations.

```sh
curl -fsSL https://raw.githubusercontent.com/vibe-backend/sdk/v1.0.0-rc.8/scripts/vibe-install.sh -o vibe-install.sh
sh vibe-install.sh install --version v1.0.0-rc.8
export PATH="$HOME/.local/bin:$PATH"
cd backend
LLM_PROVIDER=fake vibe build --check
LLM_PROVIDER=fake vibe build
```

Do not commit locks (`*.lock.md`), `.vibe/` (keys and cache), `manifest.json`, or optional local recordings under `fixtures/llm/`.

From the repository root:

```sh
docker build -t sample-shop:test backend
docker run --rm -p 8080:8080 sample-shop:test
curl http://127.0.0.1:8080/api/web/v1/shop
curl http://127.0.0.1:8080/api/web/v1/counter
curl -X POST http://127.0.0.1:8080/api/web/v1/increment-counter
```

Docker builds with the fake provider. The image has no AI key and no recorded answers.

This image is a dev/demo test build and must **not** run with `VIBE_ENV=production`: production refuses the in-memory store. The manifest is development-signed; production signing is tracked in [sdk#309](https://github.com/vibe-backend/sdk/issues/309).

The Dockerfile pins `VIBE_VERSION=v1.0.0-rc.8`, the Debian base digest, and the v1.0.0-rc.8 `SHA256SUMS` digest (`VIBE_SHA256SUMS_SHA256`):
`65d8076674cd402eee21a23040aa59880990787a8f783091d952706ff56a0fef`.
Update the version and digest together. The runtime image contains the manifest, public signing key, slug settings, and runtime. It runs as UID 10001 and sets `VIBE_ENV=development`, `VIBE_DB=memory`, and `VIBE_ALLOW_TEST_BUILD=1` with `--allow-test-build`. It contains no signing private key or AI settings.

## Signed releases

A maintainer pushes a `v*` tag, then a reviewer approves the `release` environment in GitHub Actions. `.github/workflows/release.yml` calls the SDK `v1.0.0-rc.8` reusable workflow. That workflow builds the manifest from the `.md` sources with the configured live model (`llm-provider: openai`, `llm-api-style: chat`). It signs without stored keys using GitHub OIDC and Sigstore, attests the manifest, and publishes `manifest.json` plus its signature bundle on the GitHub Release. Pull requests use `LLM_PROVIDER=fake` and never sign anything.

Maintainers set repository variables `VIBE_LLM_BASE_URL` and `VIBE_LLM_MODEL`, plus the `release` environment secret `VIBE_LLM_API_KEY`, in GitHub settings. Use a public AI endpoint; the SDK workflow refuses private hosts. The variables must be repository variables because the caller cannot read environment-scoped variables. Keep the SDK workflow tag equal to the runtime version.

Deployers download the manifest and bundle into `dist/`, check the manifest digest against the workflow output, and use the SDK `v1.0.0-rc.8` runtime with `cosign` on `PATH`:

```sh
VIBE_ENV=development VIBE_RELEASE_VERSION=<version without v> vibe-runtime verify --artifact dist \
  --expect-identity 'https://github.com/vibe-backend/sample-shop/.github/workflows/release.yml@refs/tags/v*' \
  --expect-issuer https://token.actions.githubusercontent.com \
  --expect-repository-id 1418463724
```

The identity is this repository's release workflow at a `v*` tag. The issuer is GitHub Actions. The repository id is this repository's numeric id, `1418463724`.

From `dist/`, also check the attestation against the release tag and commit, then deploy those same files without rebuilding:

```sh
gh attestation verify manifest.json --repo vibe-backend/sample-shop \
  --signer-workflow vibe-backend/sdk/.github/workflows/vibe-project-release.yml \
  --source-ref refs/tags/v<version> --source-digest <commit> --deny-self-hosted-runners
```

This sample stores data in memory, so a signed release is still a demo and must not run with `VIBE_ENV=production`.

## License

[MIT](LICENSE)

## CI/CD

- **CI** (`.github/workflows/ci.yml`, on PRs and pushes to `main`): Markdown lint and a local link check. `frontend/` lint and test run when `frontend/package.json` and `frontend/pnpm-lock.yaml` exist (`pnpm install --frozen-lockfile` on the Node version pinned in `frontend/.nvmrc`, currently 22.22.2, also `engines.node`). A Rust component is formatted, linted, and tested when its `Cargo.toml` exists. Docker build (no push) runs for each component that has a `Dockerfile`. The `backend` job installs SDK `v1.0.0-rc.8`, runs `LLM_PROVIDER=fake vibe build --check` and `LLM_PROVIDER=fake vibe build` (generated locks go to the job summary), builds `sample-shop:ci`, smoke-tests `GET /api/web/v1/shop`, `GET /api/web/v1/counter`, and `POST /api/web/v1/increment-counter` (including 50 concurrent writes with values 2..51 from a second client), and scans every image layer, history entry, environment variable, and the UID (`10001`) for signing keys, `.env`, `llm_api_key`, and `LLM_*` settings.
- **Dependency audit** (`.github/workflows/deps.yml`, on PRs, pushes to `main`, weekly, and manually): `pnpm audit --prod --audit-level=high` blocks on production dependencies of `frontend/`; a full `pnpm audit` also blocks on high or critical advisories in dev tooling.
- **CD** (`.github/workflows/cd.yml`, on pushes to `main` and `v*` tags): builds and pushes `ghcr.io/vibe-backend/sample-shop-frontend` and `ghcr.io/vibe-backend/sample-shop-backend`. The frontend image stays a no-op until `frontend/Dockerfile` is added. The backend image is the dev/demo test build from `backend/Dockerfile`.
- **Release** (`.github/workflows/release.yml`, on `v*` tags): checks repository variables, then runs the signed SDK release workflow described above. Dependabot tracks `backend/Dockerfile` via the `/backend` Docker ecosystem entry in `.github/dependabot.yml`.
