import { test, expect, describe, afterAll, afterEach } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, validate } from "../src/parser/index";
import { HaloRuntime } from "../src/runtime/runtime";

// Escaping a {{placeholder}} is for the outer bash. These commands hand the value to
// something that reads it again (a second shell, eval, ssh) or reads a leading "-" as
// an option; each was shown to run code or clobber a file before the fix.

const dir = mkdtempSync(join(tmpdir(), "halo-reparse-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => {
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true });
});

const PWN = join(dir, "PWN");
const source = (command: string) => `tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: """${command} """)`; // the space: a triple-quoted string can't end in "
const run = async (command: string, x: string) => {
  const r = new HaloRuntime({ logger: { log() {}, warn() {} } }).load(parse(source(command)));
  return (await r.run("P", { x })).output as { stdout: string; stderr: string; exitCode: number };
};
const warnings = (command: string) =>
  validate(parse(source(command)))
    .filter((d) => d.severity === "warning")
    .map((d) => d.message);

describe("a value a second shell would parse is refused", () => {
  const cases: Array<[string, string, string, string]> = [
    ["bash -c '...'", "bash -c 'echo deploying {{x}}'", `v1; touch ${PWN}`, "second shell runs (bash -c)"],
    ['sh -c "..."', 'sh -c "echo deploying {{x}}"', `$(touch ${PWN})`, "second shell runs (sh -c)"],
    ["a variable into eval", 'msg={{x}}; eval "echo $msg"', `x; touch ${PWN}`, "stored in $msg, and eval runs $msg"],
    ["eval", "eval echo {{x}}", `x; touch ${PWN}`, "argument of eval"],
    ["sudo ... sh -c", "sudo -n sh -c 'echo {{x}}'", `x; touch ${PWN}`, "(sh -c)"],
    ["env ... sh -c", "env A=1 sh -c 'echo {{x}}'", `x; touch ${PWN}`, "(sh -c)"],
    ["xargs sh -c", "echo a | xargs sh -c 'echo {{x}}'", `x; touch ${PWN}`, "(sh -c)"],
    ["find -exec sh -c", `find ${dir} -maxdepth 0 -exec sh -c 'echo {{x}}' \\;`, `x; touch ${PWN}`, "(sh -c)"],
    ["bash -lc", "bash -lc 'echo {{x}}'", `x; touch ${PWN}`, "(bash -c)"],
    ["docker exec ... sh -c", "docker exec box sh -c 'echo {{x}}'", `x; touch ${PWN}`, "(sh -c)"],
    ["kubectl exec -- sh -c", "kubectl exec pod -- sh -c 'echo {{x}}'", `x; touch ${PWN}`, "(sh -c)"],
    ["a variable into bash -c", 'v={{x}}; bash -c "echo $v"', `x; touch ${PWN}`, "stored in $v"],
    ["ssh's remote command", "ssh -p 22 example.invalid ls {{x}}", `x; touch ${PWN}`, "command ssh runs on the remote host"],
    ["a heredoc bash reads as its script", "bash <<EOF\necho {{x}}\nEOF", `x; touch ${PWN}`, "second shell reads on stdin"],
  ];
  for (const [name, command, x, error] of cases) {
    test(name, async () => {
      await expect(run(command, x)).rejects.toThrow(error);
      expect(readdirSync(dir)).toEqual([]);
    });
  }

  test("even a harmless value, so a command works or fails the same whatever the value", async () => {
    await expect(run("bash -c 'echo {{x}}'", "hello")).rejects.toThrow("pass it as an argument instead: bash -c '... \"$1\"' _ {{x}}");
  });

  test("halo validate warns about each", () => {
    for (const [, command] of cases) expect(warnings(command).join("\n")).toContain("as shell code");
  });

  test("halo validate warns when a command with a placeholder uses eval at all", () => {
    expect(warnings('eval "$(direnv export bash)"; ls -- {{x}}').join("\n")).toContain("uses eval");
    expect(warnings('read -r v < {{x}}; eval "$v"').join("\n")).toContain("uses eval");
    expect(warnings("echo {{x}}")).toEqual([]);
  });
});

describe("a value that would be read as an option is refused", () => {
  test("git log --oneline {{x}} with --output=FILE", async () => {
    const target = join(dir, "CLOBBERED");
    writeFileSync(target, "keep");
    await expect(run("git log --oneline {{x}}", `--output=${target}`)).rejects.toThrow("which git would read as an option; put -- before it to end the options (git log --oneline -- {{x}})");
    expect(await Bun.file(target).text()).toBe("keep");
  });

  test("quoting it doesn't help, so a quoted whole word is refused too", async () => {
    await expect(run('ls "{{x}}"', "-la")).rejects.toThrow("ls would read as an option");
    await expect(run("ls '{{x}}'", "-la")).rejects.toThrow("ls would read as an option");
    await expect(run("cat {{x}}.txt", "--help")).rejects.toThrow("cat would read as an option");
  });

  test("inside $(...) too", async () => {
    await expect(run("echo $(basename {{x}})", "--help")).rejects.toThrow("basename would read as an option");
  });

  test("after --, or not at the start of a word, it is data", async () => {
    const out = await run("ls -d -- {{x}}", "-no-such-file");
    expect(out.exitCode).not.toBe(0);
    expect(out.stderr).toContain("-no-such-file");
    expect((await run("printf %s --label={{x}}", "-x")).stdout).toBe("--label=-x");
    expect((await run('printf %s "note: {{x}}"', "-rf")).stdout).toBe("note: -rf");
  });

  test("echo, printf's arguments and [[ ]] take it as data", async () => {
    expect((await run("echo {{x}}", "-5 degrees")).stdout).toBe("-5 degrees");
    expect((await run("printf '%s' {{x}}", "-n")).stdout).toBe("-n");
    expect((await run('[[ {{x}} == -n ]] && echo same', "-n")).stdout).toBe("same");
  });

  test("a value that has a dash later on is fine", async () => {
    writeFileSync(join(dir, "a-b.txt"), "1\n2\n");
    expect((await run("wc -l < {{x}}", join(dir, "a-b.txt"))).stdout.trim()).toBe("2");
    expect((await run("wc -l {{x}}", join(dir, "a-b.txt"))).stdout).toContain("2");
  });
});

describe("a heredoc inside $(...) is escaped like a top-level one", () => {
  test("$(...) in the value doesn't run", async () => {
    const command = 'out=$(cat <<EOF\nnote: {{x}}\nEOF\n)\nprintf %s "$out"';
    const x = `$(touch ${PWN})`;
    expect((await run(command, x)).stdout).toBe(`note: ${x}`);
    expect(readdirSync(dir)).toEqual([]);
  });

  test("and the value can't end it early", async () => {
    await expect(run("out=$(cat <<EOF\n{{x}}\nEOF\n)", `a\nEOF\n)\ntouch ${PWN}\nx=$(cat <<EOF`)).rejects.toThrow('contains its end marker "EOF"');
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("the ways to hand a value to a second shell still work", () => {
  const x = `it's "q" $(touch ${PWN}); \`touch ${PWN}\``;

  test("as an argument after bash -c's string", async () => {
    expect((await run("bash -c 'printf %s \"$1\"' _ {{x}}", x)).stdout).toBe(x);
    expect((await run("bash -c 'printf %s \"$1\"' _ {{x}}", "-starts-with-dash")).stdout).toBe("-starts-with-dash");
    expect(readdirSync(dir)).toEqual([]);
  });

  test("as an argument to a script bash reads on stdin", async () => {
    expect((await run("bash -s -- {{x}} <<'EOF'\nprintf %s \"$1\"\nEOF", x)).stdout).toBe(x);
    expect(readdirSync(dir)).toEqual([]);
  });

  test("as an exported variable the inner shell expands as data", async () => {
    expect((await run("export V={{x}}; bash -c 'printf %s \"$V\"'", x)).stdout).toBe(x);
    expect(readdirSync(dir)).toEqual([]);
  });

  test("halo validate doesn't warn about those", () => {
    expect(warnings("bash -c 'printf %s \"$1\"' _ {{x}}")).toEqual([]);
    expect(warnings("export V={{x}}; bash -c 'printf %s \"$V\"'")).toEqual([]);
  });
});
