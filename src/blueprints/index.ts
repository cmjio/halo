/**
 * Blueprints: complete, deployable Halo apps that `halo init <name> --template <blueprint>`
 * writes out. Each lives in `blueprints/<name>/` in the repo (where it is tested) and is
 * bundled into the CLI here as text, so the standalone binary carries it.
 */

// .json and .toml files are imported as text too; TypeScript only knows their parsed types.
// test/blueprints.test.ts checks that each list matches its folder exactly.
// support-inbox
import si0 from "../../blueprints/support-inbox/.env.example" with { type: "text" };
import si1 from "../../blueprints/support-inbox/.gitignore" with { type: "text" };
import si2 from "../../blueprints/support-inbox/Dockerfile" with { type: "text" };
import si3 from "../../blueprints/support-inbox/README.md" with { type: "text" };
import si4 from "../../blueprints/support-inbox/fly.toml" with { type: "text" };
import si5 from "../../blueprints/support-inbox/halo.json" with { type: "text" };
import si6 from "../../blueprints/support-inbox/knowledge/billing.md" with { type: "text" };
import si7 from "../../blueprints/support-inbox/knowledge/exporting-data.md" with { type: "text" };
import si8 from "../../blueprints/support-inbox/knowledge/inviting-teammates.md" with { type: "text" };
import si9 from "../../blueprints/support-inbox/knowledge/password-reset.md" with { type: "text" };
import si10 from "../../blueprints/support-inbox/pipelines/support.halo" with { type: "text" };
import si11 from "../../blueprints/support-inbox/samples/email-injection.json" with { type: "text" };
import si12 from "../../blueprints/support-inbox/samples/email.json" with { type: "text" };
import si13 from "../../blueprints/support-inbox/samples/mocks.json" with { type: "text" };
// github-triage
import gt0 from "../../blueprints/github-triage/.env.example" with { type: "text" };
import gt1 from "../../blueprints/github-triage/.gitignore" with { type: "text" };
import gt2 from "../../blueprints/github-triage/Dockerfile" with { type: "text" };
import gt3 from "../../blueprints/github-triage/README.md" with { type: "text" };
import gt4 from "../../blueprints/github-triage/fly.toml" with { type: "text" };
import gt5 from "../../blueprints/github-triage/halo.json" with { type: "text" };
import gt6 from "../../blueprints/github-triage/pipelines/triage.halo" with { type: "text" };
import gt7 from "../../blueprints/github-triage/samples/issue-opened.json" with { type: "text" };
import gt8 from "../../blueprints/github-triage/samples/mocks.json" with { type: "text" };
// incident-responder
import ir0 from "../../blueprints/incident-responder/.env.example" with { type: "text" };
import ir1 from "../../blueprints/incident-responder/.gitignore" with { type: "text" };
import ir2 from "../../blueprints/incident-responder/Dockerfile" with { type: "text" };
import ir3 from "../../blueprints/incident-responder/README.md" with { type: "text" };
import ir4 from "../../blueprints/incident-responder/fly.toml" with { type: "text" };
import ir5 from "../../blueprints/incident-responder/halo.json" with { type: "text" };
import ir6 from "../../blueprints/incident-responder/pipelines/incidents.halo" with { type: "text" };
import ir7 from "../../blueprints/incident-responder/samples/mocks.json" with { type: "text" };
import ir8 from "../../blueprints/incident-responder/samples/sentry-issue.json" with { type: "text" };
// customer-chat
import cc0 from "../../blueprints/customer-chat/.env.example" with { type: "text" };
import cc1 from "../../blueprints/customer-chat/.gitignore" with { type: "text" };
import cc2 from "../../blueprints/customer-chat/Dockerfile" with { type: "text" };
import cc3 from "../../blueprints/customer-chat/README.md" with { type: "text" };
import cc4 from "../../blueprints/customer-chat/db/schema.sql" with { type: "text" };
import cc5 from "../../blueprints/customer-chat/fly.toml" with { type: "text" };
import cc6 from "../../blueprints/customer-chat/halo.json" with { type: "text" };
import cc7 from "../../blueprints/customer-chat/pipelines/chat.halo" with { type: "text" };
import cc8 from "../../blueprints/customer-chat/policies/store-policies.md" with { type: "text" };
import cc9 from "../../blueprints/customer-chat/samples/message.json" with { type: "text" };
import cc10 from "../../blueprints/customer-chat/samples/mocks.json" with { type: "text" };
import cc11 from "../../blueprints/customer-chat/samples/refund.json" with { type: "text" };
// web-monitor
import wm0 from "../../blueprints/web-monitor/.env.example" with { type: "text" };
import wm1 from "../../blueprints/web-monitor/.gitignore" with { type: "text" };
import wm2 from "../../blueprints/web-monitor/Dockerfile" with { type: "text" };
import wm3 from "../../blueprints/web-monitor/README.md" with { type: "text" };
import wm4 from "../../blueprints/web-monitor/fly.toml" with { type: "text" };
import wm5 from "../../blueprints/web-monitor/halo.json" with { type: "text" };
import wm6 from "../../blueprints/web-monitor/pipelines/monitor.halo" with { type: "text" };
import wm7 from "../../blueprints/web-monitor/samples/mocks.json" with { type: "text" };
import wm8 from "../../blueprints/web-monitor/samples/sources.json" with { type: "text" };
// cloudflare-email
import ce0 from "../../blueprints/cloudflare-email/.dev.vars.example" with { type: "text" };
import ce1 from "../../blueprints/cloudflare-email/.env.example" with { type: "text" };
import ce2 from "../../blueprints/cloudflare-email/.gitignore" with { type: "text" };
import ce3 from "../../blueprints/cloudflare-email/Dockerfile" with { type: "text" };
import ce4 from "../../blueprints/cloudflare-email/README.md" with { type: "text" };
import ce5 from "../../blueprints/cloudflare-email/halo.json" with { type: "text" };
import ce6 from "../../blueprints/cloudflare-email/knowledge/billing.md" with { type: "text" };
import ce7 from "../../blueprints/cloudflare-email/knowledge/exporting-data.md" with { type: "text" };
import ce8 from "../../blueprints/cloudflare-email/knowledge/inviting-teammates.md" with { type: "text" };
import ce9 from "../../blueprints/cloudflare-email/knowledge/password-reset.md" with { type: "text" };
import ce10 from "../../blueprints/cloudflare-email/package.json" with { type: "text" };
import ce11 from "../../blueprints/cloudflare-email/pipelines/email.halo" with { type: "text" };
import ce12 from "../../blueprints/cloudflare-email/samples/email.json" with { type: "text" };
import ce13 from "../../blueprints/cloudflare-email/samples/mocks.json" with { type: "text" };
import ce14 from "../../blueprints/cloudflare-email/tsconfig.json" with { type: "text" };
// @ts-expect-error: inbox.ts has no default export, but imported as text it is all default.
import ce15 from "../../blueprints/cloudflare-email/worker/inbox.ts" with { type: "text" };
import ce16 from "../../blueprints/cloudflare-email/worker/index.ts" with { type: "text" };
import ce17 from "../../blueprints/cloudflare-email/wrangler.jsonc" with { type: "text" };

export interface Blueprint {
  name: string;
  description: string;
  /** The commands to suggest after `halo init`, run inside the new folder. */
  next: string[];
  /** Relative path → file contents. */
  files: Record<string, string>;
}

const text = (v: unknown) => v as string;

export const BLUEPRINTS: Record<string, Blueprint> = {
  "support-inbox": {
    name: "support-inbox",
    description: "Customer email → triage → a reply drafted from your help articles → human approval → sent with Resend",
    next: [
      "halo test pipelines/support.halo -p IndexKnowledge --mocks samples/mocks.json",
      "halo test pipelines/support.halo -p HandleEmail --body samples/email.json --mocks samples/mocks.json",
    ],
    files: {
      ".env.example": text(si0),
      ".gitignore": text(si1),
      Dockerfile: text(si2),
      "README.md": text(si3),
      "fly.toml": text(si4),
      "halo.json": text(si5),
      "knowledge/billing.md": text(si6),
      "knowledge/exporting-data.md": text(si7),
      "knowledge/inviting-teammates.md": text(si8),
      "knowledge/password-reset.md": text(si9),
      "pipelines/support.halo": text(si10),
      "samples/email-injection.json": text(si11),
      "samples/email.json": text(si12),
      "samples/mocks.json": text(si13),
    },
  },
  "github-triage": {
    name: "github-triage",
    description: "New GitHub issues → labeled → a comment for duplicates or missing details, after approval → a weekly Slack summary",
    next: [
      "halo test pipelines/triage.halo -p TriageIssue --body samples/issue-opened.json --mocks samples/mocks.json",
      "halo test pipelines/triage.halo -p WeeklyReport --arg repo=acme/api --mocks samples/mocks.json",
    ],
    files: {
      ".env.example": text(gt0),
      ".gitignore": text(gt1),
      Dockerfile: text(gt2),
      "README.md": text(gt3),
      "fly.toml": text(gt4),
      "halo.json": text(gt5),
      "pipelines/triage.halo": text(gt6),
      "samples/issue-opened.json": text(gt7),
      "samples/mocks.json": text(gt8),
    },
  },
  "incident-responder": {
    name: "incident-responder",
    description: "New Sentry errors → stack trace, recent commits and past incidents → likely cause → a Linear issue and a Slack summary",
    next: [
      "halo test pipelines/incidents.halo -p HandleAlert --body samples/sentry-issue.json --arg org=acme --arg repo=acme/api --mocks samples/mocks.json",
    ],
    files: {
      ".env.example": text(ir0),
      ".gitignore": text(ir1),
      Dockerfile: text(ir2),
      "README.md": text(ir3),
      "fly.toml": text(ir4),
      "halo.json": text(ir5),
      "pipelines/incidents.halo": text(ir6),
      "samples/mocks.json": text(ir7),
      "samples/sentry-issue.json": text(ir8),
    },
  },
  "customer-chat": {
    name: "customer-chat",
    description: "A chat assistant for your site: per-customer memory, their orders from Postgres, your policies, and hand-off to Slack",
    next: [
      "halo test pipelines/chat.halo -p Chat --body samples/message.json --mocks samples/mocks.json",
    ],
    files: {
      ".env.example": text(cc0),
      ".gitignore": text(cc1),
      Dockerfile: text(cc2),
      "README.md": text(cc3),
      "db/schema.sql": text(cc4),
      "fly.toml": text(cc5),
      "halo.json": text(cc6),
      "pipelines/chat.halo": text(cc7),
      "policies/store-policies.md": text(cc8),
      "samples/message.json": text(cc9),
      "samples/mocks.json": text(cc10),
      "samples/refund.json": text(cc11),
    },
  },
  "web-monitor": {
    name: "web-monitor",
    description: "Watched web pages → changes that matter → one email digest every weekday morning",
    next: [
      // Then README.md walks through a change and the digest.
      "halo test pipelines/monitor.halo -p CheckAll --body samples/sources.json --mocks samples/mocks.json",
    ],
    files: {
      ".env.example": text(wm0),
      ".gitignore": text(wm1),
      Dockerfile: text(wm2),
      "README.md": text(wm3),
      "fly.toml": text(wm4),
      "halo.json": text(wm5),
      "pipelines/monitor.halo": text(wm6),
      "samples/mocks.json": text(wm7),
      "samples/sources.json": text(wm8),
    },
  },
  "cloudflare-email": {
    name: "cloudflare-email",
    description: "Email to your domain → a Cloudflare Worker → Halo in a Container drafts a reply → a person approves → sent by Cloudflare",
    next: [
      "halo test pipelines/email.halo -p DraftReply --body samples/email.json --mocks samples/mocks.json",
    ],
    files: {
      ".dev.vars.example": text(ce0),
      ".env.example": text(ce1),
      ".gitignore": text(ce2),
      Dockerfile: text(ce3),
      "README.md": text(ce4),
      "halo.json": text(ce5),
      "knowledge/billing.md": text(ce6),
      "knowledge/exporting-data.md": text(ce7),
      "knowledge/inviting-teammates.md": text(ce8),
      "knowledge/password-reset.md": text(ce9),
      "package.json": text(ce10),
      "pipelines/email.halo": text(ce11),
      "samples/email.json": text(ce12),
      "samples/mocks.json": text(ce13),
      "tsconfig.json": text(ce14),
      "worker/inbox.ts": text(ce15),
      "worker/index.ts": text(ce16),
      "wrangler.jsonc": text(ce17),
    },
  },
};

/** A project's files from a blueprint, with the project's name and this CLI's version filled in. */
export function blueprintFiles(blueprint: Blueprint, project: string, version: string): Record<string, string> {
  // Hosting platforms want lowercase letters, digits and dashes in an app name.
  const app = project.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || blueprint.name;
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(blueprint.files)) {
    let c = content;
    if (path === "Dockerfile") c = c.replace(/^ARG HALO_VERSION=.*$/m, `ARG HALO_VERSION=${version}`);
    // The app name: Fly.io's, and the Worker's (which is also in its workers.dev URL).
    if (path === "fly.toml" || path === "wrangler.jsonc" || path === "package.json") c = c.replaceAll(blueprint.name, app);
    out[path] = c;
  }
  return out;
}
