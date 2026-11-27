// Browsers declared headless: false (a wallet needs a window a person can use) stay out of sight in tests.
process.env.HALO_TEST_HEADLESS = "1";
// Trust lives in the user's config folder; tests use a file of their own and never touch it.
if (!process.env.HALO_TRUST_FILE) {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  process.env.HALO_TRUST_FILE = join(mkdtempSync(join(tmpdir(), "halo-trust-")), "trust.json");
}
