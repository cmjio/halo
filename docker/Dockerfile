# The official Halo image: ghcr.io/cmjio/halo
#
# Serve a folder of pipelines without writing a Dockerfile:
#
#   docker run -p 8080:8080 -v "$PWD:/app" \
#     -e HALO_SERVE_TOKEN=... -e ANTHROPIC_API_KEY=... ghcr.io/cmjio/halo
#
# Or build on it (Render, Railway, Cloud Run, Fly and other hosts that run images):
#
#   FROM ghcr.io/cmjio/halo:0.5
#   COPY --chown=halo . .
#
# Any halo command works: docker run --rm -v "$PWD:/app" ghcr.io/cmjio/halo test main.halo
#
# The release workflow builds it from the release's Linux binaries, one per architecture,
# laid out as <context>/amd64/halo and <context>/arm64/halo (see .github/workflows/release.yml).
FROM debian:bookworm-slim

ARG TARGETARCH
# ca-certificates for HTTPS to model providers; git for the Git tool; poppler's pdftotext
# for Documents to read PDFs properly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git poppler-utils \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 halo \
 && mkdir /app && chown halo:halo /app

COPY --chmod=755 ${TARGETARCH}/halo /usr/local/bin/halo

# PORT makes halo serve listen on every interface, which needs HALO_SERVE_TOKEN (it refuses
# to start without one). Hosting platforms replace PORT with their own.
ENV PORT=8080 \
    HALO_INSTALLED_BY=docker \
    NO_COLOR=1
WORKDIR /app
USER halo
EXPOSE 8080

# Paused runs, telemetry, stores and recordings are kept in /app/.halo: mount a volume there
# (or the whole project at /app) so runs waiting for approval survive a restart.
ENTRYPOINT ["halo"]
CMD ["serve"]
