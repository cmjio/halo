import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { currentProject, projectFiles, pullProject, pulledVersion, pushProject, ProjectError } from "../src/serve/project";
import { FolderStateStore } from "../src/serve/state-mirror";

const root = resolve(`${import.meta.dir}/..`);
const tmp = mkdtempSync(join(tmpdir(), "halo-project-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const dir = (name = "d-") => mkdtempSync(join(tmp, name));

const FLOW = (word: string) => `agent Writer [openai/gpt-4o]

pipeline Hello(name: String) -> Result:
  name |> Writer.greet("Say ${word} to {{name}}")
`;

function project(word = "hello") {
  const d = dir("proj-");
  writeFileSync(join(d, "flow.halo"), FLOW(word));
  writeFileSync(join(d, "halo.json"), JSON.stringify({ mocks: "mocks.json" }));
  writeFileSync(join(d, "mocks.json"), JSON.stringify({ "Writer.greet": `${word}, world` }));
  writeFileSync(join(d, ".env"), "OPENAI_API_KEY=sk-secret");
  mkdirSync(join(d, ".halo", "packages", "@acme", "tool"), { recursive: true });
  writeFileSync(join(d, ".halo", "packages", "@acme", "tool", "halo.json"), "{}");
  writeFileSync(join(d, ".halo", "telemetry.db"), "state, not project");
  mkdirSync(join(d, "node_modules", "x"), { recursive: true });
  writeFileSync(join(d, "node_modules", "x", "index.js"), "");
  mkdirSync(join(d, "prompts"));
  writeFileSync(join(d, "prompts", "tone.md"), "Be kind.");
  return d;
}

describe("a pushed project", () => {
  test("carries the project's files and installed packages, and never secrets or state", () => {
    expect(projectFiles(project())).toEqual([".halo/packages/@acme/tool/halo.json", "flow.halo", "halo.json", "mocks.json", "prompts/tone.md"]);
  });

  test("push then pull gives a folder that holds the same files", async () => {
    const store = new FolderStateStore(dir("store-"));
    const pushed = await pushProject(project(), store, "1.4.0");
    expect(pushed).toMatchObject({ files: 5, uploaded: 5, changed: true });
    expect((await currentProject(store))?.version).toBe(pushed.version);

    const app = dir("app-");
    const pulled = await pullProject(store, app);
    expect(pulled).toMatchObject({ version: pushed.version, files: 5, written: 5, removed: 0 });
    expect(readFileSync(join(app, "prompts", "tone.md"), "utf8")).toBe("Be kind.");
    expect(existsSync(join(app, ".halo", "packages", "@acme", "tool", "halo.json"))).toBe(true);
    expect(existsSync(join(app, ".env"))).toBe(false);
    expect(pulledVersion(app)).toBe(pushed.version);
    // Pulling again writes nothing.
    expect((await pullProject(store, app)).written).toBe(0);
  });

  test("the same files are the same version; a change uploads only what changed and removes what was dropped", async () => {
    const store = new FolderStateStore(dir("store-"));
    const src = project();
    const first = await pushProject(src, store, "1.4.0");
    expect(await pushProject(src, store, "1.4.0")).toMatchObject({ version: first.version, uploaded: 0, changed: false });
    const app = dir("app-");
    await pullProject(store, app);
    writeFileSync(join(app, "local-notes.txt"), "the server's own");

    writeFileSync(join(src, "flow.halo"), FLOW("goodbye"));
    rmSync(join(src, "prompts", "tone.md"));
    const second = await pushProject(src, store, "1.4.0");
    expect(second.version).not.toBe(first.version);
    expect(second).toMatchObject({ uploaded: 1, changed: true });
    expect(await pullProject(store, app)).toMatchObject({ version: second.version, written: 1, removed: 1 });
    expect(readFileSync(join(app, "flow.halo"), "utf8")).toContain("goodbye");
    expect(existsSync(join(app, "prompts", "tone.md"))).toBe(false);
    // A file the pull never wrote is not its to remove.
    expect(existsSync(join(app, "local-notes.txt"))).toBe(true);
    // The earlier version is still there to go back to.
    expect((await pullProject(store, app, first.version)).version).toBe(first.version);
    expect(readFileSync(join(app, "prompts", "tone.md"), "utf8")).toBe("Be kind.");
  });

  test("old versions are pruned, with the files only they used", async () => {
    const store = new FolderStateStore(dir("store-"));
    const src = project();
    const versions: string[] = [];
    for (const word of ["a", "b", "c", "d"]) {
      writeFileSync(join(src, "flow.halo"), FLOW(word));
      versions.push((await pushProject(src, store, "1.4.0", { keep: 2 })).version);
      await Bun.sleep(3);
    }
    const keys = await store.list();
    expect(keys.filter((k) => k.startsWith("project/versions/")).sort()).toEqual(versions.slice(-2).map((v) => `project/versions/${v}.json`).sort());
    // Four files never changed, and two versions of flow.halo are kept.
    expect(keys.filter((k) => k.startsWith("project/blobs/"))).toHaveLength(6);
  });

  test("it says so when nothing was pushed, or when a version is damaged", async () => {
    const store = new FolderStateStore(dir("store-"));
    await expect(pullProject(store, dir())).rejects.toThrow(/Nothing has been pushed/);
    await expect(pushProject(dir(), store, "1.4.0")).rejects.toThrow(ProjectError);
    const pushed = await pushProject(project(), store, "1.4.0");
    const blob = (await store.list()).find((k) => k.startsWith("project/blobs/"))!;
    await store.put(blob, new TextEncoder().encode("tampered"));
    await expect(pullProject(store, dir(), pushed.version)).rejects.toThrow(/missing or damaged/);
  });

  test("a manifest can't write outside the folder", async () => {
    const store = new FolderStateStore(dir("store-"));
    const pushed = await pushProject(project(), store, "1.4.0");
    const key = `project/versions/${pushed.version}.json`;
    const manifest = JSON.parse(new TextDecoder().decode((await store.get(key))!));
    manifest.files["../escape.txt"] = manifest.files["flow.halo"];
    await store.put(key, new TextEncoder().encode(JSON.stringify(manifest)));
    await expect(pullProject(store, dir())).rejects.toThrow(/not a path inside a project/);
  });
});

describe("halo push and halo serve with a project store", () => {
  const env = { ...Bun.env, NO_COLOR: "1", HALO_PROJECT_POLL: "1s", HALO_SERVE_TOKEN: "" };
  const halo = (cwd: string, ...args: string[]) => {
    const p = Bun.spawnSync(["bun", join(root, "index.ts"), ...args], { cwd, env });
    return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
  };

  test("push refuses a project that doesn't validate", () => {
    const src = project();
    writeFileSync(join(src, "flow.halo"), `pipeline P(x: String) -> Result:\n  x |> Ghost.go()\n`);
    const r = halo(src, "push", "--to", dir("store-"));
    expect(r.code).toBe(1);
    expect(r.err).toContain("Not pushed: 1 error(s)");
  });

  test("a server with no project of its own runs what was pushed, and switches when a new version arrives", async () => {
    const store = dir("store-");
    const src = project("hello");
    const first = halo(src, "push", "--to", store);
    expect(first.code).toBe(0);
    expect(first.out).toMatch(/Pushed version [0-9a-f]{12} to /);

    const app = dir("app-");
    const proc = Bun.spawn(["bun", join(root, "index.ts"), "serve", "--port", "0", "--no-studio", "--mocks", "mocks.json", "--project", store], { cwd: app, stdout: "pipe", stderr: "pipe", env });
    const lines: string[] = [];
    const reader = (async () => {
      const decoder = new TextDecoder();
      for await (const chunk of proc.stdout) lines.push(decoder.decode(chunk));
    })();
    const errors: string[] = [];
    void (async () => {
      const decoder = new TextDecoder();
      for await (const chunk of proc.stderr) errors.push(decoder.decode(chunk));
    })();
    const waitFor = async (what: RegExp, from = 0) => {
      for (let i = 0; i < 400; i++) {
        const m = lines.join("").slice(from).match(what);
        if (m) return m;
        await Bun.sleep(25);
      }
      throw new Error(`Never saw ${what} in:\n${lines.join("")}\n${errors.join("")}`);
    };
    const run = async (url: string) => (await (await fetch(`${url}/api/pipelines/Hello/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ args: { name: "ada" }, wait: true }) })).json()) as { output: string };
    try {
      const url = (await waitFor(/pipeline\(s\) at (http:\/\/\S+)/))[1]!;
      const v1 = (await (await fetch(`${url}/healthz`)).json()) as { project: string };
      expect(v1.project).toMatch(/^[0-9a-f]{12}$/);
      expect((await run(url)).output).toBe("hello, world");

      // A new version: no container, no image, just a push.
      writeFileSync(join(src, "mocks.json"), JSON.stringify({ "Writer.greet": "goodbye, world" }));
      const mark = lines.join("").length;
      expect(halo(src, "push", "--to", store).code).toBe(0);
      const url2 = (await waitFor(/pipeline\(s\) at (http:\/\/\S+)/, mark))[1]!;
      const v2 = (await (await fetch(`${url2}/healthz`)).json()) as { project: string };
      expect(v2.project).not.toBe(v1.project);
      expect((await run(url2)).output).toBe("goodbye, world");

      // A version that doesn't start is refused, and the last good one keeps serving.
      writeFileSync(join(src, "flow.halo"), `pipeline Hello(name: String) -> Result:\n  name |> Ghost.go()\n`);
      const mark2 = lines.join("").length;
      expect(halo(src, "push", "--force", "--to", store).code).toBe(0);
      const url3 = (await waitFor(/pipeline\(s\) at (http:\/\/\S+)/, mark2))[1]!;
      expect(errors.join("")).toMatch(/does not start, so [0-9a-f]{12} keeps running/);
      expect(((await (await fetch(`${url3}/healthz`)).json()) as { project: string }).project).toBe(v2.project);
      expect((await run(url3)).output).toBe("goodbye, world");
    } finally {
      proc.kill("SIGTERM");
      await proc.exited;
      await reader;
    }
  }, 60_000);
});
