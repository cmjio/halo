-- A counter bumped after every write that changes a package's doc or pages (publish, yank,
-- deprecate, dist-tags, verification). Docs and pages are cached under a key holding it, so a
-- change is seen in every colo at once, not only in the one whose cache the write purged.
ALTER TABLE packages ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
