/**
 * The playground's challenges: small puzzles, each a starting file, a goal, a hint, and a
 * check that runs on every keystroke against Halo's real parser, validator, and planner.
 *
 * Every challenge also carries a solution, and test/playground.test.ts proves that the
 * starter fails its check and the solution passes, so no puzzle is impossible.
 */

import type { Diagnostic } from "../../src/parser/validate.ts";
import type { ParseResult, PipelineStage } from "../../src/parser/types.ts";
import type { Plan } from "../../src/plan.ts";

export interface CheckInput {
  source: string;
  ast: ParseResult;
  problems: Diagnostic[];
  /** A plan for every pipeline that could be planned. */
  plans: Plan[];
}

export interface Challenge {
  id: string;
  emoji: string;
  title: string;
  /** What to do, in a sentence. */
  goal: string;
  /** A nudge for when someone is stuck. */
  hint: string;
  starter: string;
  solution: string;
  check(input: CheckInput): boolean;
}

const clean = (i: CheckInput) => i.ast.errors.length === 0 && !i.problems.some((d) => d.severity === "error");
const stages = (i: CheckInput): PipelineStage[] => i.ast.pipelines.flatMap((p) => p.pipeline);
const has = (i: CheckInput, kind: PipelineStage["kind"]) => stages(i).some((s) => s.kind === kind);

export const CHALLENGES: Challenge[] = [
  {
    id: "typo",
    emoji: "🐛",
    title: "Squash the bug",
    goal: "This pipeline calls an agent that doesn't exist. Make the problems tab go green.",
    hint: "Look at the problems tab, then compare the agent's name with the one the pipeline calls.",
    starter: `agent Greeter [anthropic/claude-haiku-4-5, temp: 0.7]

pipeline Hello(name: String) -> Result:
  name
    |> Greter.prompt("Write a one-line greeting for {{name}}.")
    |> System.Print()
`,
    solution: `agent Greeter [anthropic/claude-haiku-4-5, temp: 0.7]

pipeline Hello(name: String) -> Result:
  name
    |> Greeter.prompt("Write a one-line greeting for {{name}}.")
    |> System.Print()
`,
    check: (i) => clean(i) && i.ast.pipelines.length > 0,
  },
  {
    id: "budget",
    emoji: "💸",
    title: "Put a price on it",
    goal: "Cap what this run can spend at 10 cents or less, so the plan's worst-case cost has a ceiling.",
    hint: "Declare `policy Budget : MaxSpend(0.10)`, then add `requires Budget` to the agent.",
    starter: `agent Writer [anthropic/claude-sonnet-4-5]

pipeline Poem(topic: String) -> Result:
  topic
    |> Writer.prompt("Write a short poem about {{topic}}.")
    |> System.Print()
`,
    solution: `policy Budget : MaxSpend(0.10)

agent Writer [anthropic/claude-sonnet-4-5]
  requires Budget

pipeline Poem(topic: String) -> Result:
  topic
    |> Writer.prompt("Write a short poem about {{topic}}.")
    |> System.Print()
`,
    check: (i) => clean(i) && i.plans.length > 0 && i.plans.every((p) => p.cappedAt !== undefined && p.cappedAt <= 0.1),
  },
  {
    id: "approve",
    emoji: "✋",
    title: "Ask before you post",
    goal: "This bot posts to Slack on its own. Make it wait for a person's yes first.",
    hint: "Add `|! yield(msg: \"Post this?\", [context.current]) as ok` before the post, and a gate `|? (context.data.ok.approved == true)` after it.",
    starter: `tool Chat : Slack(Env.SLACK_BOT_TOKEN)

agent Writer [anthropic/claude-haiku-4-5]

pipeline Announce(news: String) -> Result:
  news
    |> Writer.prompt("Turn this into a cheerful team announcement: {{news}}")
    |> Chat.post(channel: "#general", text: "{{context.current}}")
`,
    solution: `tool Chat : Slack(Env.SLACK_BOT_TOKEN)

agent Writer [anthropic/claude-haiku-4-5]

pipeline Announce(news: String) -> Result:
  news
    |> Writer.prompt("Turn this into a cheerful team announcement: {{news}}") as draft
    |! yield(msg: "Post this?", [context.data.draft]) as ok
    |? (context.data.ok.approved == true)
    |> Chat.post(channel: "#general", text: "{{draft}}")
`,
    check: (i) => clean(i) && i.plans.some((p) => p.steps.some((s) => s.kind === "human" || s.effects.some((e) => e.approval))),
  },
  {
    id: "parallel",
    emoji: "⚡",
    title: "Two things at once",
    goal: "Ask for a haiku and a limerick at the same time, instead of one after the other.",
    hint: "A fan-out runs calls in parallel: `|* { Poet.prompt(\"a haiku\"), Poet.prompt(\"a limerick\") }`.",
    starter: `agent Poet [anthropic/claude-haiku-4-5, temp: 0.9]

pipeline Poems(topic: String) -> Result:
  topic
    |> Poet.prompt("Write a haiku about {{topic}}.")
    |> System.Print()
`,
    solution: `agent Poet [anthropic/claude-haiku-4-5, temp: 0.9]

pipeline Poems(topic: String) -> Result:
  topic
    |* { Poet.prompt("Write a haiku about {{topic}}."), Poet.prompt("Write a limerick about {{topic}}.") }
    |> System.Print()
`,
    check: (i) => clean(i) && (has(i, "fanout") || has(i, "each")),
  },
  {
    id: "gate",
    emoji: "🚦",
    title: "Only when it matters",
    goal: "Translate the greeting only when the language isn't English.",
    hint: "A gate skips the rest of the pipeline when its condition is false: `|? (lang != \"en\")`.",
    starter: `agent Greeter [anthropic/claude-haiku-4-5]
agent Translator [anthropic/claude-haiku-4-5]

pipeline Hello(name: String, lang: String) -> Result:
  name
    |> Greeter.prompt("Write a one-line greeting for {{name}}.")
    |> Translator.prompt("Translate this into {{lang}}: {{context.current}}")
`,
    solution: `agent Greeter [anthropic/claude-haiku-4-5]
agent Translator [anthropic/claude-haiku-4-5]

pipeline Hello(name: String, lang: String) -> Result:
  name
    |> Greeter.prompt("Write a one-line greeting for {{name}}.")
    |? (lang != "en")
    |> Translator.prompt("Translate this into {{lang}}: {{context.current}}")
`,
    check: (i) => clean(i) && (has(i, "gate") || has(i, "branch")),
  },
  {
    id: "loop",
    emoji: "🔁",
    title: "Try, try again",
    goal: "If the joke is longer than 200 characters, send it back to the comedian, up to 3 times.",
    hint: "Bind the joke with `as joke`, then add `|<> loop(Comedian, \"context.data.joke.length > 200\", max: 3)`.",
    starter: `agent Comedian [anthropic/claude-haiku-4-5, temp: 1.0]

pipeline Joke(topic: String) -> Result:
  topic
    |> Comedian.prompt("Tell a short joke about {{topic}}.") as joke
    |> System.Print()
`,
    solution: `agent Comedian [anthropic/claude-haiku-4-5, temp: 1.0]

pipeline Joke(topic: String) -> Result:
  topic
    |> Comedian.prompt("Tell a short joke about {{topic}}.") as joke
    |<> loop(Comedian, "context.data.joke.length > 200", max: 3)
    |> System.Print()
`,
    check: (i) => clean(i) && has(i, "loop"),
  },
  {
    id: "team",
    emoji: "🎨",
    title: "Blank canvas",
    goal: "Write a pipeline from scratch where two different agents each do a step.",
    hint: "Declare two agents, then call both: `|> Writer.prompt(...)` then `|> Editor.prompt(...)`. The examples menu is full of ideas.",
    starter: `// Your pipeline here. Two agents, each doing a step.
`,
    solution: `agent Writer [anthropic/claude-haiku-4-5]
agent Editor [anthropic/claude-sonnet-4-5]

pipeline Story(idea: String) -> Result:
  idea
    |> Writer.prompt("Write a 100-word story about {{idea}}.")
    |> Editor.prompt("Tighten this story and give it a title: {{context.current}}")
`,
    check: (i) => clean(i) && i.plans.some((p) => new Set(p.steps.map((s) => s.agent).filter(Boolean)).size >= 2),
  },
];
