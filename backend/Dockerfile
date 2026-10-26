# syntax=docker/dockerfile:1.7
# Dev/demo image, not for production: manifest is development-signed.
# Production signing: https://github.com/vibe-backend/sdk/issues/309
FROM debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS download
ARG VIBE_VERSION=v1.0.0-rc.8
ARG TARGETARCH
RUN set -eu; \
    apt-get update; apt-get install -y --no-install-recommends ca-certificates curl; \
    rm -rf /var/lib/apt/lists/*; \
    case "$TARGETARCH" in amd64) T=x86_64-unknown-linux-gnu ;; arm64) T=aarch64-unknown-linux-gnu ;; *) exit 1 ;; esac; \
    mkdir -p /dist; \
    for name in SHA256SUMS "vibe-sdk-$T.tar.gz" "vibe-runtime-$T.tar.gz"; do \
      curl -fsSL --proto '=https' --tlsv1.2 "https://github.com/vibe-backend/sdk/releases/download/$VIBE_VERSION/$name" -o "/dist/$name"; \
    done

# Local testing before publication: replace this stage using --build-context assets=<dir>
# containing the same three files. Not used in CI or the README main path.
FROM scratch AS assets
COPY --from=download /dist/ /

FROM debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS verify
ARG TARGETARCH
# Pinned digest of the v1.0.0-rc.8 SHA256SUMS; update it together with VIBE_VERSION.
ARG VIBE_SHA256SUMS_SHA256=65d8076674cd402eee21a23040aa59880990787a8f783091d952706ff56a0fef
COPY --from=assets / /dist/
RUN set -eu; \
    case "$TARGETARCH" in amd64) T=x86_64-unknown-linux-gnu ;; arm64) T=aarch64-unknown-linux-gnu ;; *) exit 1 ;; esac; \
    cd /dist; \
    printf "%s  SHA256SUMS\n" "$VIBE_SHA256SUMS_SHA256" | sha256sum -c -; \
    mkdir -p /opt/vibe/bin; \
    for kind in sdk runtime; do \
      name="vibe-$kind-$T.tar.gz"; binary=vibe; \
      if [ "$kind" = runtime ]; then binary=vibe-runtime; fi; \
      awk -v name="$name" '{ field=$2; sub(/^\*/, "", field); if (field == name) print }' SHA256SUMS > /tmp/checksum; \
      [ "$(wc -l < /tmp/checksum)" -eq 1 ]; \
      sha256sum -c /tmp/checksum; \
      tar -tzf "$name" > /tmp/entries; \
      [ "$(wc -l < /tmp/entries)" -eq 1 ]; \
      [ "$(cat /tmp/entries)" = "$binary" ]; \
      tar -xzf "$name" -C /opt/vibe/bin; chmod 0755 "/opt/vibe/bin/$binary"; \
    done

FROM debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=verify /opt/vibe/bin/vibe /usr/local/bin/vibe
WORKDIR /src
COPY api/ ./api/
COPY models/ ./models/
COPY slugs.example.json ./
# vibe build secret-scans the project and needs its .gitignore.
COPY .gitignore ./
# Keyless test build with the fake provider. No AI key.
ARG VIBE_LLM=fake
RUN set -eu; \
    case "$VIBE_LLM" in \
      fake) LLM_PROVIDER=fake vibe build -o /out/manifest.json ;; \
      *) printf '%s\n' 'VIBE_LLM must be fake' >&2; exit 1 ;; \
    esac; \
    mkdir -p /out/.vibe; cp .vibe/signing.pub /out/.vibe/signing.pub; \
    test -z "$(find /out -name signing.key -print)"; \
    test "$(find /out -type f | wc -l)" -eq 2

FROM debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f
LABEL org.opencontainers.image.source="https://github.com/vibe-backend/sample-shop" \
      org.opencontainers.image.description="Dev/demo test build, not for production; development-signed manifest (sdk#309)"
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin vibe
COPY --from=verify /opt/vibe/bin/vibe-runtime /usr/local/bin/vibe-runtime
COPY --from=build /out/manifest.json /app/manifest.json
COPY --from=build /out/.vibe/signing.pub /app/.vibe/signing.pub
# vibe-runtime --artifact /app reads /app/slugs.example.json with the in-memory database (dev slug may write).
COPY slugs.example.json /app/slugs.example.json
ENV VIBE_ENV=development VIBE_DB=memory
ENV VIBE_ALLOW_TEST_BUILD=1
USER 10001
EXPOSE 8080
CMD ["/bin/sh","-c","exec vibe-runtime --artifact /app --addr 0.0.0.0:8080 --allow-test-build"]
