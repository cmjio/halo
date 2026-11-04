# The Halo half of the app. `wrangler deploy` builds this image and runs it as a Cloudflare
# Container (see wrangler.jsonc); it works the same under plain Docker for local testing.
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

# Check the pipelines, then build the article index into the image. A container's disk is
# wiped whenever it sleeps, so the index has to ship with it (this needs no API key).
# Change an article, redeploy, and the new image has the new index.
RUN halo validate --strict pipelines/ \
 && halo run pipelines/email.halo -p IndexKnowledge \
 && rm -rf .halo/recordings .halo/telemetry.db*

EXPOSE 8080
# HALO_SERVE_TOKEN comes from the Worker (wrangler.jsonc passes it in); only the Worker calls this.
CMD ["halo", "serve", "--host", "0.0.0.0", "--port", "8080"]
