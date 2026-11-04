# Halo is one binary with Bun built in. The installer checks it against the release's checksums.
FROM debian:bookworm-slim

# Empty installs the latest release; `halo init` pins the version that created this project.
ARG HALO_VERSION=
# poppler-utils gives Documents better text from PDF articles.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl poppler-utils \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://halolang.com/install.sh | HALO_VERSION=$HALO_VERSION HALO_INSTALL=/opt/halo HALO_NO_MODIFY_PATH=1 sh
ENV PATH="/opt/halo/bin:$PATH"

WORKDIR /app
COPY halo.json ./
COPY pipelines ./pipelines
COPY knowledge ./knowledge

# Paused runs, the article index, replies and dedupe keys live in /app/.halo:
# mount a volume there so drafts waiting for review survive a redeploy.
VOLUME /app/.halo
EXPOSE 8080

# Check the pipelines at build time, so a broken file fails the deploy, not the first email.
RUN halo validate --strict pipelines/

CMD ["halo", "serve", "--host", "0.0.0.0", "--port", "8080"]
