import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime } from "../src/runtime/runtime";
import { placeholderSpots, quoteFor } from "../src/runtime/shell";

const kinds = (cmd: string) => [...placeholderSpots(cmd).values()].map((s) => s.kind);

describe("placeholderSpots", () => {
  test("finds where each placeholder sits", () => {
    expect(kinds(`echo {{a}} '{{b}}' "{{c}}" "$(cat {{d}})" \\{{e}}`)).toEqual(["word", "single", "double", "word", "escaped"]);
    expect(kinds(`echo "it's '{{a}}'" 'say "{{b}}"'`)).toEqual(["double", "single"]);
    expect(kinds("cat <<EOF\n{{a}} $(echo {{b}})\nEOF\necho {{c}}")).toEqual(["heredoc", "word", "word"]);
    expect(kinds("cat <<-'EOF'\n\t{{a}}\n\tEOF\n{{b}}")).toEqual(["heredoc", "word"]);
    expect(kinds("cat <<< {{a}}")).toEqual(["word"]);
  });

  test("a value can't end a heredoc early", () => {
    expect(() => quoteFor({ kind: "heredoc", delimiter: "EOF", expands: true }, "a\nEOF\nrm x")).toThrow('contains its end marker "EOF"');
  });
});

describe("Bash placeholders hold hostile values as data", () => {
  const dir = mkdtempSync(join(tmpdir(), "halo-shell-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const payloads = [
    `$(touch ${dir}/pwned)`,
    "`touch " + dir + "/pwned`",
    `'; touch ${dir}/pwned; '`,
    `"; touch ${dir}/pwned; "`,
    `\\$(touch ${dir}/pwned)`,
    `a\ntouch ${dir}/pwned`,
  ];
  // Triple-quoted Halo strings keep backslashes as written, so these are what the shell sees.
  const commands: Record<string, string> = {
    bare: `"""printf %s {{x}}"""`,
    single: `"""printf %s '{{x}}'"""`,
    double: `"""printf %s "{{x}}" """`,
    "double, mixed": `"""printf %s "it's: {{x}}" """`,
    "inside $(...)": `"""printf %s "$(printf %s {{x}})" """`,
    heredoc: `"""cat <<EOF\n{{x}}\nEOF"""`,
    "quoted heredoc": `"""cat <<'EOF'\n{{x}}\nEOF"""`,
  };

  for (const [name, command] of Object.entries(commands)) {
    test(name, async () => {
      const r = new HaloRuntime({ logger: { log() {}, warn() {} } }).load(parse(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: ${command})`));
      for (const x of payloads) {
        const { output } = await r.run("P", { x });
        expect(readdirSync(dir)).toEqual([]);
        const stdout = (output as { stdout: string }).stdout;
        expect(stdout).toContain(x.trimEnd().split("\n").at(-1)!);
      }
    });
  }

  test("a placeholder right after a backslash is refused", async () => {
    const r = new HaloRuntime({ logger: { log() {}, warn() {} } }).load(parse(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: """printf %s \\{{x}}""")`));
    await expect(r.run("P", { x: payloads[0]! })).rejects.toThrow("right after a backslash");
    expect(existsSync(`${dir}/pwned`)).toBe(false);
  });
});
