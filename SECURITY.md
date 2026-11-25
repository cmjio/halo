# Security Policy

## Supported versions

Security fixes go into the latest release on the `latest` channel. Prereleases (`next`) and `nightly` builds get them with their next build. Older versions are not patched; upgrade with `halo upgrade`.

## Reporting a vulnerability

**Please don't report security problems in public issues, discussions or pull requests.**

Report them privately through [GitHub's private vulnerability reporting](https://github.com/cmjio/halo/security/advisories/new). Include what you found, how to reproduce it (a `.halo` file and the command you ran helps), the version (`halo --version`), and the impact you expect.

You should get a reply within a few days. We'll keep you updated while we work on a fix, agree on a disclosure date with you, and credit you in the advisory unless you'd rather we didn't.

## Scope

Things we especially want to hear about:

- A way around a policy (`Block`, `Redact`, `MaxSpend`, tool policies), a gate, or a human approval
- Escaping a sandbox (`Remote`, `sandbox: "docker"`, E2B, Daytona) or reaching hosts it should block
- Leaking API keys or secrets, including into telemetry, recordings or logs
- Unauthenticated access to `halo serve` or Halo Studio
- Problems with the installer, release artifacts, checksums, the npm package, the container image or the package registry

Out of scope: a model doing what a pipeline's own prompt asks of it, `Code(...)` running code you gave it (it is not a sandbox), and problems in third-party services or models.
