# Halo is one binary with Bun built in. The installer checks it against the release's checksums.
FROM debian:bookworm-slim

# Empty installs the latest release; `halo init` pins the version that created this project.
ARG HALO_VERSION=
# git: repo/ is a clone of GITHUB_REPO, where approved changes are committed and pushed from.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://halolang.com/install.sh | HALO_VERSION=$HALO_VERSION HALO_INSTALL=/opt/halo HALO_NO_MODIFY_PATH=1 sh
ENV PATH="/opt/halo/bin:$PATH"

# git reads GITHUB_TOKEN from the environment when it talks to github.com, so the token is
# never written to disk (or copied into a sandbox: only repo/'s tracked files are).
RUN git config --system credential.helper '!f() { test "$1" = get && echo username=x-access-token && echo "password=$GITHUB_TOKEN"; }; f' \
 && git config --system user.name "Halo" \
 && git config --system user.email "halo@users.noreply.github.com"

WORKDIR /app
COPY halo.json ./
COPY pipelines ./pipelines

# Paused runs (diffs waiting for review) live in /app/.halo:
# mount a volume there so they survive a redeploy.
VOLUME /app/.halo
EXPOSE 8080

# Check the pipelines at build time, so a broken file fails the deploy, not the first issue.
RUN halo validate --strict pipelines/

# There's no Docker here, so sandboxes are E2B's (E2B_API_KEY) or Daytona's (DAYTONA_API_KEY).
# repo/ is cloned on start; FixIssue fetches before each run.
CMD ["sh", "-c", "test -d repo/.git || git clone --quiet \"https://github.com/$GITHUB_REPO.git\" repo; exec halo serve --host 0.0.0.0 --port 8080"]
