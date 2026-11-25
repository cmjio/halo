import { describe, expect, test } from "bun:test";
import fixerRun from "../site/data/fixer-run.json";
import { runHtml, runSteps } from "../site/src/render";

const providers = {
  Workspace: {
    methods: [
      { name: "read", effect: "read", description: "" },
      { name: "list", effect: "read", description: "" },
      { name: "edit", effect: "write", description: "" },
    ],
  },
};
const run = runSteps({ fixerRun: fixerRun as never, providers });

describe("runSteps", () => {
  test("every recorded call is shown, so the counts add up", () => {
    expect(run.modelCalls).toBe(7);
    expect(run.toolCalls).toBe(9);
    expect(run.modelToolCalls).toBe(8);
    const shown = run.steps.flatMap((s) => s.calls).length;
    expect(shown).toBe(run.toolCalls);
  });

  test("the pipeline's own check after the answer is its own step", () => {
    const last = run.steps.at(-1)!;
    expect(last.who).toBe("pipeline");
    expect(last.calls[0]!.target).toBe("Tests.run");
    expect(last.calls[0]!.args).toContain("tail -40");
    expect(run.steps.at(-2)!.answer).toStartWith("Perfect!");
  });

  test("effects come from the providers, and an edit shows the line it changed", () => {
    const calls = run.steps.flatMap((s) => s.calls);
    expect(calls.find((c) => c.target === "Code.read")!.effect).toBe("read");
    expect(calls.find((c) => c.target === "Tests.run")!.effect).toBe("external");
    const edits = calls.filter((c) => c.target === "Code.edit");
    expect(edits.map((e) => e.effect)).toEqual(["write", "write"]);
    expect(edits[0]!.args).toContain("(xs.length - 1)");
    expect(edits[1]!.args).toContain("sort((a, b) => a - b)");
    expect(run.tally).toBe("2 pass · 0 fail");
  });
});

test("runHtml draws every step, with the run's totals", () => {
  const html = runHtml({ fixerRun: fixerRun as never, providers });
  expect(html.match(/class="step"/g)!.length).toBe(run.steps.length);
  expect(html).toContain('<div class="who">pipeline</div>');
  expect(html).toContain('<span class="effect write">write</span><span class="target">Code.edit</span>');
  expect(html).toContain(`${run.modelCalls} model calls · ${run.toolCalls} tool calls`);
  expect(html).toContain(`<span class="ok">${run.tally}</span>`);
});
