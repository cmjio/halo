# Halo is one binary with Bun built in. The installer checks it against the release's checksums.
FROM debian:bookworm-slim

# Empty installs the latest release; `halo init` pins the version that created this project.
ARG HALO_VERSION=
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://halolang.com/install.sh | HALO_VERSION=$HALO_VERSION HALO_INSTALL=/opt/halo HALO_NO_MODIFY_PATH=1 sh
ENV PATH="/opt/halo/bin:$PATH"

WORKDIR /app
COPY halo.json ./
COPY pipelines ./pipelines

# The last reading of each page and the changes waiting for the digest live in
# /app/.halo: mount a volume there so a redeploy doesn't count every page as new.
VOLUME /app/.halo
EXPOSE 8080

# Check the pipelines at build time, so a broken file fails the deploy, not the first run.
RUN halo validate --strict pipelines/

CMD ["halo", "serve", "--host", "0.0.0.0", "--port", "8080"]
