import { describe, expect, test } from "bun:test";
import fixerRun from "../site/data/fixer-run.json";
import { HOME, answerHtml, haloHtml, homeMarkdown, inline, planHtml, planSummary } from "../site/src/home";
import { runSteps } from "../site/src/render";

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

describe("plan", () => {
  const text = `Plan for Research

  1      Researcher.investigate [anthropic/claude-sonnet-4-5] ≤ $2.5597
         may call Web.fetch: read
         may call Notes.write: write · needs approval (Bounds)
         may call Notes.edit: write
         chooses its own calls, up to 15 steps

Acts on the world without asking: nothing
Needs a person's approval: Notes.write
Worst-case model cost: $2.5597, but MaxSpend stops the run at $0.50
Spend limit: Researcher stops once the run has spent $0.50 (policy Screened)`;

  test("tags each tool line by effect and counts them", () => {
    const { html, counts } = planHtml(text);
    expect(counts).toEqual({ read: 1, write: 2, approval: 1 });
    expect(html).toContain('data-e="write approval"');
    expect(html.match(/class="cl"/g)!.length).toBe(text.split("\n").length);
  });

  test("reads the summary lines", () => {
    expect(planSummary(text)).toEqual({ acts: "nothing", approval: "Notes.write", worst: "$2.5597", limit: "MaxSpend stops the run at $0.50" });
  });
});

test("inline Markdown is escaped first", () => {
  expect(inline("`<x>` and [a](/b) **c**")).toBe('<code>&lt;x&gt;</code> and <a href="/b">a</a> <b>c</b>');
  expect(answerHtml("## Summary\n\n1. **mean**")).toBe("<b>Summary</b>\n\n1. <b>mean</b>");
});

test("halo source keeps its {{placeholders}} and one block per line", () => {
  const html = haloHtml('pipeline P(x: String) -> Result:\n  x\n    |> A.b("Hi {{x}}")');
  expect(html.match(/class="cl"/g)!.length).toBe(3);
  expect(html).toContain('<span class="i">{{x}}</span>');
  expect(html).toContain("--ind:4");
});

test("the home page as Markdown has its words and absolute links", () => {
  const md = homeMarkdown(
    {
      version: "1.0.0",
      examples: [{ file: "hello.halo", verb: "test", source: "agent A [m/x]", output: "$ halo test hello.halo\nok" }],
      plan: { cmd: "halo plan r.halo", text: "Plan for R" },
      run,
    },
    "https://halolang.com",
  );
  expect(md).toStartWith(`**${HOME.title}.** ${HOME.lede}`);
  expect(md).toContain("curl -fsSL https://halolang.com/install.sh | sh");
  expect(md).toContain("9 tool calls (8 asked for by the model, 1 by the pipeline)");
  expect(md).toContain("8. the pipeline checks for itself");
  expect(md).toContain("[Quickstart](https://halolang.com/guide/quickstart)");
  expect(md).toContain("[installing](https://halolang.com/#install)");
  expect(md).not.toMatch(/\]\(\//);
});
