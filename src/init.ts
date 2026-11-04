/**
 * `halo init [name]`: scaffold a new Halo project.
 *
 *   name/
 *     main.halo       a starter pipeline (an agent with a system prompt and a policy)
 *     .env.example    the API key variables Halo reads
 *     .gitignore      ignores .env and .halo/ (local runs, telemetry, vectors)
 *     README.md       how to run, test, and validate it
 *
 * `halo init [name] --template <blueprint>` writes a complete, deployable app instead
 * (see src/blueprints and blueprints/ in the repo).
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { BLUEPRINTS, blueprintFiles } from "./blueprints/index.js";
import pkg from "../package.json" with { type: "json" };

const MAIN = `// A starter pipeline. Run it with: halo run main.halo --arg topic="tide pools"
// (or offline with: halo test main.halo --arg topic="tide pools")

policy Safe   : Block(PromptInjection) & Redact(APIKey)
policy Budget : MaxSpend(0.25)

agent Writer [anthropic/claude-haiku-4-5, temp: 0.4]
  system """
    You write short, friendly explanations for curious people.
  """
  requires Safe, Budget

pipeline Explain(topic: String) -> Result:
  topic
    |> Writer.explain("Explain {{topic}} in three sentences.") as explanation
    |? (context.data.explanation != null)
    |> System.Print()
`;

const ENV = `# Halo reads the key for each model's provider; set the ones you use.
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
# Used for any provider without its own key:
HALO_API_KEY=
`;

const GITIGNORE = `.env
.halo/
node_modules/
`;

const readme = (name: string) => `# ${name}

A Halo project.

\`\`\`bash
cp .env.example .env              # then add your API key
halo validate .                   # check the pipeline
halo test main.halo --arg topic="tide pools"   # run offline, every call mocked
halo run main.halo --arg topic="tide pools"    # run for real
halo serve                        # an API, schedules, approvals, and Studio at http://127.0.0.1:8080
\`\`\`
`;

/** The blueprints `--template` accepts, one per line, for help and errors. */
export function listTemplates(): string {
  const width = Math.max(...Object.keys(BLUEPRINTS).map((n) => n.length)) + 2;
  return Object.values(BLUEPRINTS)
    .map((b) => `  ${b.name.padEnd(width)}${b.description}`)
    .join("\n");
}

export async function initProject(name: string, log: Pick<Console, "log" | "error"> = console, template?: string): Promise<number> {
  if (!/^[\w.-]+$/.test(name)) {
    log.error(`Error: "${name}" is not a valid project name (use letters, numbers, ".", "-", "_")`);
    return 1;
  }
  const blueprint = template === undefined ? undefined : BLUEPRINTS[template];
  if (template !== undefined && !blueprint) {
    log.error(`Error: no template "${template}". Templates:\n${listTemplates()}`);
    return 1;
  }
  if (existsSync(name)) {
    log.error(`Error: "${name}" already exists`);
    return 1;
  }
  if (blueprint) {
    const files = blueprintFiles(blueprint, name, pkg.version);
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(name, path)), { recursive: true });
      await Bun.write(join(name, path), content);
    }
    log.log(
      `Created ${name}/ from the ${blueprint.name} blueprint (${Object.keys(files).length} files). Try it offline:\n\n  cd ${name}\n${blueprint.next.map((c) => `  ${c}`).join("\n")}\n\nThen read README.md to run it for real and deploy it.`,
    );
    return 0;
  }
  mkdirSync(name, { recursive: true });
  await Bun.write(join(name, "main.halo"), MAIN);
  await Bun.write(join(name, ".env.example"), ENV);
  await Bun.write(join(name, ".gitignore"), GITIGNORE);
  await Bun.write(join(name, "README.md"), readme(name));
  log.log(`Created ${name}/ (main.halo, .env.example, .gitignore, README.md)\n\n  cd ${name}\n  halo test main.halo --arg topic="tide pools"`);
  return 0;
}
