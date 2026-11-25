/**
 * Blueprints: complete, deployable Halo apps that `halo init <name> --template <blueprint>`
 * writes out. Each lives in `blueprints/<name>/` in the repo (where it is tested) and is
 * bundled into the CLI here as text, so the standalone binary carries it.
 */

// .json and .toml files are imported as text too; TypeScript only knows their parsed types.
import siReadme from "../../blueprints/support-inbox/README.md" with { type: "text" };
import siHaloJson from "../../blueprints/support-inbox/halo.json" with { type: "text" };
import siEnv from "../../blueprints/support-inbox/.env.example" with { type: "text" };
import siGitignore from "../../blueprints/support-inbox/.gitignore" with { type: "text" };
import siDockerfile from "../../blueprints/support-inbox/Dockerfile" with { type: "text" };
import siFly from "../../blueprints/support-inbox/fly.toml" with { type: "text" };
import siPipeline from "../../blueprints/support-inbox/pipelines/support.halo" with { type: "text" };
import siBilling from "../../blueprints/support-inbox/knowledge/billing.md" with { type: "text" };
import siExport from "../../blueprints/support-inbox/knowledge/exporting-data.md" with { type: "text" };
import siInvite from "../../blueprints/support-inbox/knowledge/inviting-teammates.md" with { type: "text" };
import siPassword from "../../blueprints/support-inbox/knowledge/password-reset.md" with { type: "text" };
import siEmail from "../../blueprints/support-inbox/samples/email.json" with { type: "text" };
import siInjection from "../../blueprints/support-inbox/samples/email-injection.json" with { type: "text" };
import siMocks from "../../blueprints/support-inbox/samples/mocks.json" with { type: "text" };

import fiReadme from "../../blueprints/fix-issue/README.md" with { type: "text" };
import fiHaloJson from "../../blueprints/fix-issue/halo.json" with { type: "text" };
import fiEnv from "../../blueprints/fix-issue/.env.example" with { type: "text" };
import fiGitignore from "../../blueprints/fix-issue/.gitignore" with { type: "text" };
import fiDockerfile from "../../blueprints/fix-issue/Dockerfile" with { type: "text" };
import fiFly from "../../blueprints/fix-issue/fly.toml" with { type: "text" };
import fiPipeline from "../../blueprints/fix-issue/pipelines/fix.halo" with { type: "text" };
import fiIssue from "../../blueprints/fix-issue/samples/issue-labeled.json" with { type: "text" };
import fiMocks from "../../blueprints/fix-issue/samples/mocks.json" with { type: "text" };
import fiMocksReject from "../../blueprints/fix-issue/samples/mocks-reject.json" with { type: "text" };

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
      "README.md": text(siReadme),
      "halo.json": text(siHaloJson),
      ".env.example": text(siEnv),
      ".gitignore": text(siGitignore),
      Dockerfile: text(siDockerfile),
      "fly.toml": text(siFly),
      "pipelines/support.halo": text(siPipeline),
      "knowledge/billing.md": text(siBilling),
      "knowledge/exporting-data.md": text(siExport),
      "knowledge/inviting-teammates.md": text(siInvite),
      "knowledge/password-reset.md": text(siPassword),
      "samples/email.json": text(siEmail),
      "samples/email-injection.json": text(siInjection),
      "samples/mocks.json": text(siMocks),
    },
  },
  "fix-issue": {
    name: "fix-issue",
    description: "A GitHub issue → a coding agent fixes it in a sandbox and runs the tests → a person approves the diff → a pull request",
    next: [
      "halo test pipelines/fix.halo -p FixIssue --arg number=42 --mocks samples/mocks.json",
      "halo test pipelines/fix.halo -p FixIssue --arg number=42 --mocks samples/mocks-reject.json",
    ],
    files: {
      "README.md": text(fiReadme),
      "halo.json": text(fiHaloJson),
      ".env.example": text(fiEnv),
      ".gitignore": text(fiGitignore),
      Dockerfile: text(fiDockerfile),
      "fly.toml": text(fiFly),
      "pipelines/fix.halo": text(fiPipeline),
      "samples/issue-labeled.json": text(fiIssue),
      "samples/mocks.json": text(fiMocks),
      "samples/mocks-reject.json": text(fiMocksReject),
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
    if (path === "fly.toml") c = c.replaceAll(blueprint.name, app);
    out[path] = c;
  }
  return out;
}
