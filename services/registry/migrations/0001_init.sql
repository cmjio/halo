-- The Halo registry's metadata (D1). Package files live in R2 (halo-packages).
-- Timestamps are ISO 8601 strings (UTC). JSON columns hold the shapes in src/registry/contract.ts.

-- People, signed in through GitHub. `login` is the GitHub login, lowercased.
CREATE TABLE users (
  id          INTEGER PRIMARY KEY,
  github_id   INTEGER NOT NULL UNIQUE,
  login       TEXT    NOT NULL UNIQUE,
  name        TEXT,
  created_at  TEXT    NOT NULL
);

-- API tokens. Only the sha256 of the secret is stored; the secret is shown once, at creation.
CREATE TABLE tokens (
  id            TEXT    PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  token_hash    TEXT    NOT NULL UNIQUE,
  read_only     INTEGER NOT NULL DEFAULT 0,
  scopes        TEXT,                          -- JSON array of "@scope", or NULL for every scope
  created_at    TEXT    NOT NULL,
  last_used_at  TEXT
);
CREATE INDEX tokens_user ON tokens(user_id);

-- Scopes (`@acme`): a user's own, or an organisation's. A verified domain earns a badge.
CREATE TABLE scopes (
  id               INTEGER PRIMARY KEY,
  name             TEXT    NOT NULL UNIQUE,    -- "@acme"
  kind             TEXT    NOT NULL CHECK (kind IN ('user', 'org')),
  verified_domain  TEXT,
  verified_at      TEXT,
  created_at       TEXT    NOT NULL
);

CREATE TABLE scope_members (
  scope_id  INTEGER NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT    NOT NULL CHECK (role IN ('owner', 'publisher')),
  PRIMARY KEY (scope_id, user_id)
);
CREATE INDEX scope_members_user ON scope_members(user_id);

-- A pending or past domain check: the TXT record `_halo.<domain>` must contain `value`.
CREATE TABLE scope_verifications (
  scope_id    INTEGER NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  domain      TEXT    NOT NULL,
  value       TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (scope_id, domain)
);

-- Packages. The descriptive columns follow the `latest` version.
CREATE TABLE packages (
  id           INTEGER PRIMARY KEY,
  scope_id     INTEGER NOT NULL REFERENCES scopes(id),
  name         TEXT    NOT NULL UNIQUE,        -- "@acme/support-kit"
  description  TEXT    NOT NULL,
  keywords     TEXT    NOT NULL DEFAULT '[]',  -- JSON array
  license      TEXT,
  repository   TEXT,
  homepage     TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);
CREATE INDEX packages_scope ON packages(scope_id);
CREATE INDEX packages_updated ON packages(updated_at);

-- Published versions. Never deleted; yanking hides a version from resolution only.
CREATE TABLE versions (
  id            INTEGER PRIMARY KEY,
  package_id    INTEGER NOT NULL REFERENCES packages(id),
  version       TEXT    NOT NULL,
  manifest      TEXT    NOT NULL,              -- the package's halo.json (JSON)
  readme        TEXT    NOT NULL,
  exports       TEXT    NOT NULL,              -- PackageExports (JSON), computed by the server
  permissions   TEXT    NOT NULL,              -- PackagePermissions (JSON), computed by the server
  models        TEXT    NOT NULL DEFAULT '{}', -- model slots (JSON)
  dependencies  TEXT    NOT NULL DEFAULT '{}', -- name -> range (JSON)
  halo          TEXT,                          -- supported Halo range
  sha256        TEXT    NOT NULL,
  size          INTEGER NOT NULL,
  published_by  INTEGER REFERENCES users(id),
  published_at  TEXT    NOT NULL,
  yanked        TEXT,                          -- the reason, when yanked
  deprecated    TEXT,                          -- the message, when deprecated
  hosted        TEXT,                          -- { endpoint, auth, pipelines, interfaces } (JSON), when hosted
  UNIQUE (package_id, version)
);

CREATE TABLE dist_tags (
  package_id  INTEGER NOT NULL REFERENCES packages(id),
  tag         TEXT    NOT NULL,
  version     TEXT    NOT NULL,
  PRIMARY KEY (package_id, tag)
);

CREATE TABLE downloads_daily (
  package_id  INTEGER NOT NULL REFERENCES packages(id),
  version     TEXT    NOT NULL,
  day         TEXT    NOT NULL,                -- YYYY-MM-DD
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (package_id, version, day)
);

-- GitHub device-flow logins in progress. `id` is the sha256 of GitHub's device code.
CREATE TABLE device_codes (
  id          TEXT    PRIMARY KEY,
  user_code   TEXT    NOT NULL,
  interval    INTEGER NOT NULL,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);

-- Search over each package's latest version. rowid = packages.id; kept up to date by the
-- Worker in the same batch that publishes (explicit upkeep rather than triggers, because the
-- README lives on the version row).
CREATE VIRTUAL TABLE packages_fts USING fts5(
  name,
  description,
  keywords,
  readme,
  tokenize = 'unicode61 remove_diacritics 2'
);
