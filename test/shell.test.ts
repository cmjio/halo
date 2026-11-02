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
    expect(kinds("printf %s $'{{a}}' \"`echo {{b}}`\" # {{c}}\necho {{d}}")).toEqual(["ansi", "backtick", "comment", "word"]);
    expect(kinds("echo $(( {{a}} )) ${s:{{b}}} ${a[{{c}}]} ${v:-{{d}}} $[ {{e}} ]")).toEqual(["arith", "arith", "arith", "word", "arith"]);
    expect(kinds("let n={{a}}; declare -i m={{b}}; declare n={{c}}")).toEqual(["arith", "arith", "word"]);
    expect(kinds(`if [[ "{{a}}" -eq 1 && {{b}} == x ]]; then (( {{c}} )); fi`)).toEqual(["arith", "word", "arith"]);
  });

  test("a heredoc's end marker is read like bash reads it", () => {
    const docs = (cmd: string) => [...placeholderSpots(cmd).values()].map((s) => (s.kind === "heredoc" ? `${s.delimiter}:${s.expands}` : s.kind));
    expect(docs('cat <<E"O"F\n{{a}}\nEOF\n{{b}}')).toEqual(["EOF:false", "word"]);
    expect(docs("cat <<\\EOF\n{{a}}\nEOF")).toEqual(["EOF:false"]);
    expect(docs("cat <<END-X\n{{a}}\nEND-X")).toEqual(["END-X:true"]);
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
    "ANSI-C quotes": `"""printf %s $'{{x}}'"""`,
    "${v:-...}": `"""printf %s \${v:-{{x}}}"""`,
    '"${v:-\'...\'}"': `"""printf %s "\${v:-'{{x}}'}" """`,
    "here-string": `"""cat <<< {{x}}"""`,
    "[[ == ]]": `"""[[ {{x}} == zzz ]] || printf %s {{x}}"""`,
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

  const refusals: Array<[string, string, string]> = [
    ["backticks", '"""echo `echo {{x}}`"""', "use $(...) instead"],
    ["a comment, with a line break", '"""echo hi # {{x}}\necho done"""', "can't hold a line break"],
    ["a partly quoted heredoc marker", '"""cat <<E"O"F\n{{x}}\nEOF"""', 'its end marker "EOF"'],
    ["a backslash-quoted heredoc marker", '"""cat <<\\EOF\n{{x}}\nEOF"""', 'its end marker "EOF"'],
    ["a heredoc marker with a dash", '"""cat <<END-X\n{{x}}\nEND-X"""', 'its end marker "END-X"'],
    ["$((...))", '"""echo $(( {{x}} + 1 ))"""', "whole number or a name"],
    ["((...))", '"""(( {{x}} > 1 )); echo ok"""', "whole number or a name"],
    ["[[ -eq ]], even quoted", '"""[[ "{{x}}" -eq 1 ]]; echo ok"""', "whole number or a name"],
    ["let", '"""let "n={{x}}"; echo ok"""', "whole number or a name"],
    ["declare -i", '"""declare -i n={{x}}"""', "whole number or a name"],
    ["an array subscript", '"""a=(1); echo ${a[{{x}}]}"""', "whole number or a name"],
    ["a substring offset", '"""s=abc; echo ${s:{{x}}}"""', "whole number or a name"],
    ["$[...]", '"""echo $[ {{x}} ]"""', "whole number or a name"],
  ];
  const hostile: Record<string, string> = {
    "a comment, with a line break": `a\ntouch ${dir}/pwned #`,
    "a partly quoted heredoc marker": `a\nEOF\ntouch ${dir}/pwned\ncat <<EOF`,
    "a backslash-quoted heredoc marker": `a\nEOF\ntouch ${dir}/pwned #`,
    "a heredoc marker with a dash": `a\nEND-X\ntouch ${dir}/pwned\ncat <<END-X`,
  };
  for (const [name, command, error] of refusals) {
    test(`a hostile value in ${name} is refused`, async () => {
      const r = new HaloRuntime({ logger: { log() {}, warn() {} } }).load(parse(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: ${command})`));
      await expect(r.run("P", { x: hostile[name] ?? `a[$(touch ${dir}/pwned)]` })).rejects.toThrow(error);
      expect(readdirSync(dir)).toEqual([]);
    });
  }

  test("numbers still work in arithmetic, and text in $'...'", async () => {
    const run = async (command: string, x: string) => {
      const r = new HaloRuntime({ logger: { log() {}, warn() {} } }).load(parse(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: ${command})`));
      return ((await r.run("P", { x })).output as { stdout: string }).stdout;
    };
    expect(await run('"""echo $(( {{x}} + 1 ))"""', "41")).toBe("42");
    expect(await run('"""[[ {{x}} -eq 3 ]] && echo yes"""', "3")).toBe("yes");
    expect(await run(`"""printf %s $'{{x}}'"""`, `it's \\n "q" $(x)`)).toBe(`it's \\n "q" $(x)`);
  });

  test("a placeholder right after a backslash is refused", async () => {
    const r = new HaloRuntime({ logger: { log() {}, warn() {} } }).load(parse(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: """printf %s \\{{x}}""")`));
    await expect(r.run("P", { x: payloads[0]! })).rejects.toThrow("right after a backslash");
    expect(existsSync(`${dir}/pwned`)).toBe(false);
  });
});
