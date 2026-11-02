/**
 * Code: run a short JavaScript, TypeScript or Python snippet in its own process.
 *
 *   tool Calc : Code("python", timeout_ms: 10000)
 *     run(code, input?)  →  { stdout, stderr, exitCode, result, timedOut }
 *
 * The snippet is the body of a function that receives `input` (the call's
 * `input:`, or the flowing value, passed as JSON on stdin). Whatever it
 * `return`s is sent back, JSON-encoded, as `result`; print() / console.log()
 * output shows up in `stdout`. In JS/TS the body is async, so `await` works,
 * and modules are loaded with `await import("...")` (a static `import` can't
 * sit inside a function).
 *
 *   Calc.run(code: "return sum(input)", input: [1, 2, 3])     → result: 6
 *
 * What this is: a separate process, started in a fresh temporary folder (removed
 * afterwards) with an empty environment (only PATH, plus HOME/TMPDIR pointing at
 * that folder), so API keys and other secrets in Halo's environment aren't
 * visible to it, and it's killed when it runs past `timeout_ms`.
 * What this is NOT: a security sandbox. The snippet runs as the same user, and
 * can still read and write files elsewhere, use the network, and start other
 * programs (which a timeout kill may not reach). Only run code you'd run
 * yourself, or put Halo itself in a container.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { HaloError } from "../errors.js";
import type { ToolProvider } from "../tools.js";
import { need, unknownMethod } from "./common.js";

/** Most stdout / stderr kept per run (characters). */
const MAX_OUTPUT = 200_000;
const MAX_CODE = 200_000;
const DEFAULT_TIMEOUT_MS = 10_000;

type Lang = "js" | "ts" | "python";

const LANGS: Record<string, Lang> = { js: "js", javascript: "js", ts: "ts", typescript: "ts", python: "python", py: "python" };

function bunPath(): string {
  // Under `bun`, reuse this executable; a compiled Halo binary isn't bun, so look it up on PATH.
  return /^bun(\.exe)?$/i.test(basename(process.execPath)) ? process.execPath : (Bun.which("bun") ?? "bun");
}

function jsWrapper(code: string, marker: string): string {
  return `const input = JSON.parse((await Bun.stdin.text()) || "null");
const __halo_result = await (async (input) => {
${code}
})(input);
if (__halo_result !== undefined) process.stdout.write("\\n" + ${JSON.stringify(marker)} + JSON.stringify(__halo_result) + "\\n");
`;
}

/**
 * The snippet is parsed on its own (Python's parser allows a bare `return`; only
 * the compiler rejects it), then its statements become the body of a function,
 * so line numbers in tracebacks still match the snippet.
 */
function pythonWrapper(marker: string): string {
  return `import ast, json, sys
__src = open("snippet.py", encoding="utf-8").read()
__tree = ast.parse(__src, "snippet.py")
__fn = ast.parse("def __halo_main(input):\\n    pass").body[0]
__fn.body = __tree.body or [ast.Pass()]
__mod = ast.Module(body=[__fn], type_ignores=[])
ast.fix_missing_locations(__mod)
__ns = {"__name__": "__main__"}
exec(compile(__mod, "snippet.py", "exec"), __ns)
__raw = sys.stdin.read()
__result = __ns["__halo_main"](json.loads(__raw) if __raw.strip() else None)
if __result is not None:
    sys.stdout.write("\\n" + ${JSON.stringify(marker)} + json.dumps(__result, default=str) + "\\n")
`;
}

/** Read a stream to text, keeping at most MAX_OUTPUT characters (the rest is drained and dropped). */
async function capped(stream: ReadableStream<Uint8Array>): Promise<{ text: string; truncated: boolean }> {
  const decoder = new TextDecoder();
  let text = "";
  let truncated = false;
  for await (const chunk of stream) {
    if (truncated) continue;
    text += decoder.decode(chunk, { stream: true });
    if (text.length > MAX_OUTPUT) {
      text = text.slice(0, MAX_OUTPUT);
      truncated = true;
    }
  }
  if (!truncated) text += decoder.decode();
  return { text, truncated };
}

export const codeRunner: ToolProvider = async (call) => {
  if (!["run", "execute", "eval"].includes(call.method)) unknownMethod(call, ["run"]);
  const langName = String(call.config(0) ?? call.config("lang") ?? "js").toLowerCase();
  const lang = LANGS[langName];
  if (!lang) throw new HaloError(`Tool "${call.tool.name}": unknown language "${langName}" (use js, ts or python)`, { code: "TOOL_CONFIG" });
  const code = need(call, "code:", call.named.code ?? call.positional[0]);
  if (code.length > MAX_CODE) throw new HaloError(`${call.tool.name}.run: code is over ${MAX_CODE} characters`, { code: "TOOL_ARGUMENT" });
  // run(code: "...", input: x), run("...", x), or x |> run(code: "...").
  const input = call.named.input !== undefined ? call.named.input : call.named.code !== undefined ? call.positional[0] : call.positional[1];
  const timeoutMs = Number(call.named.timeout_ms ?? call.config("timeout_ms") ?? DEFAULT_TIMEOUT_MS);
  const marker = `__HALO_RESULT_${crypto.randomUUID().replace(/-/g, "")}__`;

  const dir = mkdtempSync(join(tmpdir(), "halo-code-"));
  try {
    let cmd: string[];
    if (lang === "python") {
      await Bun.write(join(dir, "snippet.py"), code);
      await Bun.write(join(dir, "main.py"), pythonWrapper(marker));
      // -I: isolated mode (ignores PYTHON* variables and the user's site-packages path additions).
      cmd = [Bun.which("python3", { PATH: process.env.PATH ?? "" }) ?? "python3", "-I", "main.py"];
    } else {
      const file = lang === "ts" ? "main.ts" : "main.js";
      await Bun.write(join(dir, file), jsWrapper(code, marker));
      cmd = [bunPath(), "run", "--no-install", file];
    }
    await Bun.write(join(dir, "input.json"), input === undefined ? "" : JSON.stringify(input));

    const proc = Bun.spawn(cmd, {
      cwd: dir,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: dir, TMPDIR: dir, PYTHONDONTWRITEBYTECODE: "1", NO_COLOR: "1" },
      stdin: Bun.file(join(dir, "input.json")),
      stdout: "pipe",
      stderr: "pipe",
    });
    let timedOut = false;
    const kill = () => proc.kill("SIGKILL");
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    call.signal.addEventListener("abort", kill, { once: true });
    try {
      const [out, err, exitCode] = await Promise.all([capped(proc.stdout), capped(proc.stderr), proc.exited]);
      // The result travels on its own marker line; take the last one and remove it from stdout.
      let result: unknown = null;
      let stdout = out.text;
      const at = stdout.lastIndexOf(`\n${marker}`);
      if (at >= 0) {
        const end = stdout.indexOf("\n", at + 1);
        const line = stdout.slice(at + 1 + marker.length, end < 0 ? undefined : end);
        try {
          result = JSON.parse(line);
        } catch {}
        stdout = stdout.slice(0, at) + (end < 0 ? "" : stdout.slice(end + 1));
      }
      return {
        stdout: stdout.trimEnd(),
        stderr: err.text.trimEnd(),
        exitCode: timedOut ? null : exitCode,
        result,
        timedOut,
        ...(out.truncated || err.truncated ? { truncated: true } : {}),
      };
    } finally {
      clearTimeout(timer);
      call.signal.removeEventListener("abort", kill);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
