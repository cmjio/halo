/**
 * `halo init [name]`: scaffold a new Halo project.
 *
 *   name/
 *     main.halo       a starter pipeline (an agent with a system prompt and a policy)
 *     .env.example    the API key variables Halo reads
 *     .gitignore      ignores .env and .halo/ (local runs, telemetry, vectors)
 *     README.md       how to run, test, and validate it
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
\`\`\`
`;

export async function initProject(name: string, log: Pick<Console, "log" | "error"> = console): Promise<number> {
  if (!/^[\w.-]+$/.test(name)) {
    log.error(`Error: "${name}" is not a valid project name (use letters, numbers, ".", "-", "_")`);
    return 1;
  }
  if (existsSync(name)) {
    log.error(`Error: "${name}" already exists`);
    return 1;
  }
  mkdirSync(name, { recursive: true });
  await Bun.write(join(name, "main.halo"), MAIN);
  await Bun.write(join(name, ".env.example"), ENV);
  await Bun.write(join(name, ".gitignore"), GITIGNORE);
  await Bun.write(join(name, "README.md"), readme(name));
  log.log(`Created ${name}/ (main.halo, .env.example, .gitignore, README.md)\n\n  cd ${name}\n  halo test main.halo --arg topic="tide pools"`);
  return 0;
}
