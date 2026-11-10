/**
 * The playground's challenges: small puzzles, each a starting file, a goal, a hint, and a
 * check that runs on every keystroke against Halo's real parser, validator, and planner.
 *
 * They're grouped into tracks that build on each other: the basics, how a run flows,
 * keeping it safe, making it reliable, and a finale that puts it all together.
 *
 * Every challenge also carries a solution, and test/playground.test.ts proves that the
 * starter fails its check and the solution passes, so no puzzle is impossible.
 */

import type { Diagnostic } from "../../src/parser/validate.ts";
import type { Agent, CallStage, ParseResult, PipelineDeclaration, PipelineStage, PolicyRule } from "../../src/parser/types.ts";
import type { Plan } from "../../src/plan.ts";
import type { IconName } from "./icons.ts";

export interface CheckInput {
  source: string;
  ast: ParseResult;
  problems: Diagnostic[];
  /** A plan for every pipeline that could be planned. */
  plans: Plan[];
}

/** The tracks, in the order they're played. */
export const TRACKS = ["Basics", "Flow", "Safety", "Reliability", "Finale"] as const;
export type Track = (typeof TRACKS)[number];

export interface Challenge {
  id: string;
  track: Track;
  icon: IconName;
  title: string;
  /** What to do, in a sentence. */
  goal: string;
  /** A nudge for when someone is stuck. */
  hint: string;
  starter: string;
  solution: string;
  check(input: CheckInput): boolean;
}

// ── Helpers the checks share ──

const clean = (i: CheckInput) => i.ast.errors.length === 0 && !i.problems.some((d) => d.severity === "error");
const stages = (i: CheckInput): PipelineStage[] => i.ast.pipelines.flatMap((p) => p.pipeline);
const has = (i: CheckInput, kind: PipelineStage["kind"]) => stages(i).some((s) => s.kind === kind);
const pipeline = (i: CheckInput, name: string): PipelineDeclaration | undefined => i.ast.pipelines.find((p) => p.name === name);

/** Every call a stage makes: a pipe, each arm of a branch, each call in a fan-out, the call in an each. */
const callsIn = (s: PipelineStage): CallStage[] =>
  s.kind === "call" ? [s] : s.kind === "fanout" ? s.stages : s.kind === "branch" ? s.arms.map((a) => a.call) : s.kind === "each" ? [s.call] : [];
const calls = (i: CheckInput) => stages(i).flatMap(callsIn);

/** The agents a pipeline actually calls. */
const calledAgents = (i: CheckInput): Agent[] => {
  const names = new Set(calls(i).map((c) => c.callee));
  return i.ast.agents.filter((a) => names.has(a.name));
};
/** Every policy rule an agent requires. */
const rulesOf = (i: CheckInput, a: Agent): PolicyRule[] => (a.requires ?? []).flatMap((p) => i.ast.policies.find((x) => x.name === p)?.rules ?? []);
const hasRule = (i: CheckInput, a: Agent, name: string, arg?: string) => rulesOf(i, a).some((r) => r.name === name && (arg === undefined || r.args.includes(arg)));
/** Redact(PII), or Redact of both emails and phone numbers. */
const redactsPII = (i: CheckInput, a: Agent) => hasRule(i, a, "Redact", "PII") || (hasRule(i, a, "Redact", "Email") && hasRule(i, a, "Redact", "Phone"));
/** A directive on any agent or pipeline. */
const directives = (i: CheckInput) => [...i.ast.agents, ...i.ast.pipelines].flatMap((x) => x.directives ?? []);

export const CHALLENGES: Challenge[] = [
  // ── Basics: agents, pipes, and names ──
  {
    id: "typo",
    track: "Basics",
    icon: "bug",
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
    id: "bind",
    track: "Basics",
    icon: "tag",
    title: "Name it, use it",
    goal: "The writer's prompt reads {{outline}}, but nothing has that name yet. Name the planner's result so the warning goes away.",
    hint: "End a stage with `as name` to keep its result: `|> Planner.prompt(\"...\") as outline`. Later stages can then read `{{outline}}`.",
    starter: `agent Planner [anthropic/claude-haiku-4-5]
agent Writer [anthropic/claude-sonnet-4-5]

pipeline Article(topic: String) -> Result:
  topic
    |> Planner.prompt("Outline an article about {{topic}} in five bullets.")
    |> Writer.prompt("Write the article about {{topic}}, following this outline: {{outline}}")
`,
    solution: `agent Planner [anthropic/claude-haiku-4-5]
agent Writer [anthropic/claude-sonnet-4-5]

pipeline Article(topic: String) -> Result:
  topic
    |> Planner.prompt("Outline an article about {{topic}} in five bullets.") as outline
    |> Writer.prompt("Write the article about {{topic}}, following this outline: {{outline}}")
`,
    check: (i) => clean(i) && i.problems.length === 0 && calls(i).some((c) => c.bind === "outline"),
  },
  {
    id: "voice",
    track: "Basics",
    icon: "speakerphone",
    title: "Give it a voice",
    goal: "Give the agent a system prompt so every answer comes out sounding like a pirate, whatever the task.",
    hint: "Put `system \"You are a pirate. Answer everything in a pirate's voice.\"` on the line under the agent.",
    starter: `agent Forecaster [anthropic/claude-haiku-4-5, temp: 0.8]

pipeline Weather(city: String) -> Result:
  city
    |> Forecaster.prompt("Give a one-line weather forecast for {{city}}.")
    |> System.Print()
`,
    solution: `agent Forecaster [anthropic/claude-haiku-4-5, temp: 0.8]
  system "You are a pirate. Answer everything in a pirate's voice."

pipeline Weather(city: String) -> Result:
  city
    |> Forecaster.prompt("Give a one-line weather forecast for {{city}}.")
    |> System.Print()
`,
    check: (i) => clean(i) && calledAgents(i).some((a) => /pirate/i.test(a.system ?? a.params.system ?? "")),
  },
  {
    id: "team",
    track: "Basics",
    icon: "palette",
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

  // ── Flow: gates, branches, parallel work, loops, and composing pipelines ──
  {
    id: "gate",
    track: "Flow",
    icon: "traffic-lights",
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
    id: "parallel",
    track: "Flow",
    icon: "bolt",
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
    id: "route",
    track: "Flow",
    icon: "arrows-split",
    title: "Pick a path",
    goal: "Send bug reports to Engineer, billing questions to Billing, and everything else to Support.",
    hint: "A branch runs the first arm whose condition holds: `|? { (kind == \"bug\") => Engineer.fix(ticket), (kind == \"billing\") => Billing.reply(ticket), else => Support.reply(ticket) }`.",
    starter: `agent Engineer [anthropic/claude-sonnet-4-5]
agent Billing [anthropic/claude-haiku-4-5]
agent Support [anthropic/claude-haiku-4-5]

pipeline Triage(ticket: String, kind: String) -> Result:
  ticket
    |> Support.reply("Answer this ticket: {{ticket}}")
`,
    solution: `agent Engineer [anthropic/claude-sonnet-4-5]
agent Billing [anthropic/claude-haiku-4-5]
agent Support [anthropic/claude-haiku-4-5]

pipeline Triage(ticket: String, kind: String) -> Result:
  ticket
    |? {
         (kind == "bug") => Engineer.fix(ticket),
         (kind == "billing") => Billing.reply(ticket),
         else => Support.reply(ticket),
       } as answer
`,
    check: (i) =>
      clean(i) &&
      stages(i).some((s) => {
        if (s.kind !== "branch") return false;
        const who = new Set(s.arms.map((a) => a.call.callee));
        return ["Engineer", "Billing", "Support"].every((n) => who.has(n)) && s.arms.some((a) => a.condition === undefined);
      }),
  },
  {
    id: "each",
    track: "Flow",
    icon: "list-check",
    title: "One for every item",
    goal: "Summarize each review on its own, two at a time, instead of cramming them all into one prompt.",
    hint: "`|* each(review in reviews, concurrency: 2) => Summarizer.prompt(\"Summarize in one line: {{review}}\")` calls once per item.",
    starter: `agent Summarizer [anthropic/claude-haiku-4-5]

pipeline Digest(reviews: List) -> Result:
  reviews
    |> Summarizer.prompt("Summarize these reviews, one line each: {{reviews}}")
    |> System.Print()
`,
    solution: `agent Summarizer [anthropic/claude-haiku-4-5]

pipeline Digest(reviews: List) -> Result:
  reviews
    |* each(review in reviews, concurrency: 2) => Summarizer.prompt("Summarize in one line: {{review}}") as summaries
    |> System.Print()
`,
    check: (i) =>
      clean(i) &&
      stages(i).some((s) => s.kind === "each" && s.options.some((o) => o.name === "concurrency" && o.value.kind === "number" && o.value.value === 2)),
  },
  {
    id: "loop",
    track: "Flow",
    icon: "repeat",
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
    id: "compose",
    track: "Flow",
    icon: "stack-2",
    title: "Build with blocks",
    goal: "Blog posts go out unedited. Finish the Blog pipeline by running the Polish pipeline on the draft.",
    hint: "A pipeline calls another like a function: `|> Polish(context.current)`. Its stages run, and its result flows on.",
    starter: `agent Writer [anthropic/claude-sonnet-4-5]
agent Editor [anthropic/claude-haiku-4-5]

pipeline Polish(text: String) -> Result:
  text
    |> Editor.prompt("Fix the grammar in: {{text}}")
    |> Editor.prompt("Cut anything that repeats itself: {{context.current}}")

pipeline Blog(topic: String) -> Result:
  topic
    |> Writer.prompt("Write a short blog post about {{topic}}.")
`,
    solution: `agent Writer [anthropic/claude-sonnet-4-5]
agent Editor [anthropic/claude-haiku-4-5]

pipeline Polish(text: String) -> Result:
  text
    |> Editor.prompt("Fix the grammar in: {{text}}")
    |> Editor.prompt("Cut anything that repeats itself: {{context.current}}")

pipeline Blog(topic: String) -> Result:
  topic
    |> Writer.prompt("Write a short blog post about {{topic}}.") as draft
    |> Polish(draft)
`,
    check: (i) => clean(i) && !!pipeline(i, "Polish") && (pipeline(i, "Blog")?.pipeline.flatMap(callsIn).some((c) => c.callee === "Polish" && !c.method) ?? false),
  },
  {
    id: "listen",
    track: "Flow",
    icon: "thumb-up",
    title: "Wait for the thumbs-up",
    goal: "Don't publish the release until someone reacts on Slack, and only go ahead if the reaction is rocket.",
    hint: "After the post, `~> listen(Slack.Reaction) as reaction` waits for the event. Then gate on it: `|? (context.data.reaction.reaction == \"rocket\")`.",
    starter: `tool Chat : Slack(Env.SLACK_BOT_TOKEN, channel: "#releases")

pipeline Release(version: String) -> Result:
  version
    |> Chat.post(text: "Ready to ship {{version}}? React with :rocket: to go.")
    |> System.Publish(version)
`,
    solution: `tool Chat : Slack(Env.SLACK_BOT_TOKEN, channel: "#releases")

pipeline Release(version: String) -> Result:
  version
    |> Chat.post(text: "Ready to ship {{version}}? React with :rocket: to go.")
    ~> listen(Slack.Reaction) as reaction
    |? (context.data.reaction.reaction == "rocket")
    |> System.Publish(version)
`,
    check: (i) =>
      clean(i) &&
      i.ast.pipelines.some((p) => {
        const at = p.pipeline.findIndex((s) => s.kind === "listen");
        return at >= 0 && p.pipeline.slice(at + 1).some((s) => s.kind === "gate");
      }),
  },

  // ── Safety: spend, people, private data, and what tools can do ──
  {
    id: "budget",
    track: "Safety",
    icon: "cash-banknote",
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
    track: "Safety",
    icon: "hand-stop",
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
    id: "redact",
    track: "Safety",
    icon: "eye-off",
    title: "Keep it private",
    goal: "Customer emails are full of phone numbers and addresses. Scrub personal details before the model ever sees them.",
    hint: "Declare `policy Private : Redact(PII)` and add `requires Private` to the agent. Matches become `[REDACTED:PII]`.",
    starter: `agent Helper [anthropic/claude-haiku-4-5]

pipeline Reply(email: String) -> Result:
  email
    |> Helper.prompt("Draft a polite reply to this customer email: {{email}}")
`,
    solution: `policy Private : Redact(PII)

agent Helper [anthropic/claude-haiku-4-5]
  requires Private

pipeline Reply(email: String) -> Result:
  email
    |> Helper.prompt("Draft a polite reply to this customer email: {{email}}")
`,
    check: (i) => clean(i) && calledAgents(i).length > 0 && calledAgents(i).every((a) => redactsPII(i, a)),
  },
  {
    id: "injection",
    track: "Safety",
    icon: "shield-lock",
    title: "Don't take orders from strangers",
    goal: "Web pages can hide lines like \"ignore your instructions\". Make the agent refuse any prompt or answer that tries it.",
    hint: "`policy Guard : Block(PromptInjection)`, then `requires Guard` on the agent.",
    starter: `agent Reader [anthropic/claude-haiku-4-5]

pipeline Summarize(page: String) -> Result:
  page
    |> Reader.prompt("Summarize this web page in three bullets: {{page}}")
`,
    solution: `policy Guard : Block(PromptInjection)

agent Reader [anthropic/claude-haiku-4-5]
  requires Guard

pipeline Summarize(page: String) -> Result:
  page
    |> Reader.prompt("Summarize this web page in three bullets: {{page}}")
`,
    check: (i) => clean(i) && calledAgents(i).length > 0 && calledAgents(i).every((a) => hasRule(i, a, "Block", "PromptInjection")),
  },
  {
    id: "readonly",
    track: "Safety",
    icon: "key",
    title: "Look, don't touch",
    goal: "The triager only needs to read issues, but as written it could open PRs and post comments. Get the plan's \"acts on the world without asking\" list down to nothing.",
    hint: "Open the plan tab to see what it may call. `policy ReadOnly : AllowEffects(read)` with `requires ReadOnly` hides every method that writes or reaches out.",
    starter: `tool Repo : GitHub(Env.GITHUB_TOKEN, repo: "acme/app")

agent Triager [anthropic/claude-sonnet-4-5]
  equips Repo

pipeline Triage(question: String) -> Result:
  question
    |> Triager.prompt("Read the open issues and answer: {{question}}", tools: [Repo])
`,
    solution: `tool Repo : GitHub(Env.GITHUB_TOKEN, repo: "acme/app")

policy ReadOnly : AllowEffects(read)

agent Triager [anthropic/claude-sonnet-4-5]
  equips Repo
  requires ReadOnly

pipeline Triage(question: String) -> Result:
  question
    |> Triager.prompt("Read the open issues and answer: {{question}}", tools: [Repo])
`,
    check: (i) => {
      if (!clean(i)) return false;
      const steps = i.plans.flatMap((p) => p.steps);
      // The agent must still be able to read: hiding every tool isn't the answer.
      const reads = steps.some((s) => s.kind === "agent-tools" && s.effects.some((e) => e.effect === "read"));
      return reads && !steps.some((s) => s.effects.some((e) => e.effect === "external" && !e.approval));
    },
  },

  // ── Reliability: answers in the right shape, and runs that survive hiccups ──
  {
    id: "json",
    track: "Reliability",
    icon: "braces",
    title: "Speak JSON",
    goal: "Make sure the extractor's answer is real JSON, and when it isn't, ask the model to fix it (up to 2 times) instead of failing.",
    hint: "`policy JsonOnly : Require(JSON)` with `requires JsonOnly` checks the answer. `@correct(2)` above the agent asks it to try again.",
    starter: `agent Extractor [anthropic/claude-haiku-4-5]

pipeline Contact(text: String) -> Result:
  text
    |> Extractor.prompt("""Pull out the name and email as {"name": ..., "email": ...}: {{text}}""")
`,
    solution: `policy JsonOnly : Require(JSON)

@correct(2)
agent Extractor [anthropic/claude-haiku-4-5]
  requires JsonOnly

pipeline Contact(text: String) -> Result:
  text
    |> Extractor.prompt("""Pull out the name and email as {"name": ..., "email": ...}: {{text}}""")
`,
    check: (i) =>
      clean(i) &&
      calledAgents(i).length > 0 &&
      calledAgents(i).every((a) => hasRule(i, a, "Require", "JSON") || hasRule(i, a, "Enforce", "JSON")) &&
      directives(i).some((d) => d.name === "correct" && Number(d.args?.[0] ?? d.value) >= 1),
  },
  {
    id: "retry",
    track: "Reliability",
    icon: "refresh",
    title: "Shrug off a hiccup",
    goal: "The model's API sometimes times out or rate-limits. Retry up to 3 times, 2 seconds apart, and give each call at most 30 seconds.",
    hint: "Directives go on the line above: `@retry(3, 2s)` and `@timeout(30s)` above the agent.",
    starter: `agent Forecaster [anthropic/claude-haiku-4-5]

pipeline Forecast(city: String) -> Result:
  city
    |> Forecaster.prompt("Write tomorrow's forecast for {{city}}.")
`,
    solution: `@retry(3, 2s)
@timeout(30s)
agent Forecaster [anthropic/claude-haiku-4-5]

pipeline Forecast(city: String) -> Result:
  city
    |> Forecaster.prompt("Write tomorrow's forecast for {{city}}.")
`,
    check: (i) => {
      if (!clean(i)) return false;
      const d = directives(i);
      const retry = d.find((x) => x.name === "retry");
      return !!retry && Number((retry.args?.[0] ?? retry.value).split(",")[0]) === 3 && d.some((x) => x.name === "timeout");
    },
  },
  {
    id: "schema",
    track: "Reliability",
    icon: "forms",
    title: "Shape the answer",
    goal: "Declare a Ticket schema with a title and a priority, and make the pipeline return it so its output is checked against that shape.",
    hint: "`schema Ticket { title: String, priority: String }`, then change `-> Result` to `-> Ticket`.",
    starter: `agent Triager [anthropic/claude-haiku-4-5]

pipeline Label(issue: String) -> Result:
  issue
    |> Triager.prompt("""Label this issue. Reply as {"title": ..., "priority": "low" or "high"}: {{issue}}""")
`,
    solution: `schema Ticket { title: String, priority: String }

agent Triager [anthropic/claude-haiku-4-5]

pipeline Label(issue: String) -> Ticket:
  issue
    |> Triager.prompt("""Label this issue. Reply as {"title": ..., "priority": "low" or "high"}: {{issue}}""")
`,
    check: (i) =>
      clean(i) &&
      i.ast.pipelines.some((p) => {
        const s = i.ast.schemas.find((x) => x.name === p.returnType);
        const fields = new Set(s?.fields.map((f) => f.name));
        return fields.has("title") && fields.has("priority");
      }),
  },
  {
    id: "expect",
    track: "Reliability",
    icon: "checklist",
    title: "Set the bar",
    goal: "Add a hard check that the grade's score is between 0 and 100, so halo test catches a grader that goes off the scale.",
    hint: "Above the pipeline: `@expect(\"output.score >= 0\", \"output.score <= 100\")`. No model is involved, so it's a real check.",
    starter: `agent Grader [anthropic/claude-haiku-4-5]

pipeline Grade(essay: String) -> Result:
  essay
    |> Grader.prompt("""Grade this essay. Reply as {"score": <0-100>, "feedback": "..."}: {{essay}}""")
`,
    solution: `agent Grader [anthropic/claude-haiku-4-5]

@expect("output.score >= 0", "output.score <= 100")
pipeline Grade(essay: String) -> Result:
  essay
    |> Grader.prompt("""Grade this essay. Reply as {"score": <0-100>, "feedback": "..."}: {{essay}}""")
`,
    check: (i) => {
      if (!clean(i)) return false;
      const conds = i.ast.pipelines.flatMap((p) => p.directives.filter((d) => d.name === "expect").flatMap((d) => d.args ?? [d.value])).join(" && ");
      return /output\.score\s*>=?\s*0\b/.test(conds) && /output\.score\s*<=?\s*100\b/.test(conds);
    },
  },

  // ── Finale: everything so far, together ──
  {
    id: "bughunt",
    track: "Finale",
    icon: "search",
    title: "Bug hunt",
    goal: "Four bugs, one file. Clear every error in the problems tab without deleting any stage.",
    hint: "Read each problem and jump to its line. Look for misspelled names: a tool, a policy, an agent the loop retries, and a System method.",
    starter: `policy Budget : MaxSpend(0.20)

tool Search : REST("api.search.example.com")

agent Researcher [anthropic/claude-sonnet-4-5]
  equips Serch
  requires Budgt

agent Writer [anthropic/claude-haiku-4-5]

pipeline Brief(topic: String) -> Result:
  topic
    |> Researcher.prompt("Find three facts about {{topic}}.", tool: Search) as facts
    |> Writer.prompt("Write a short brief from these facts: {{facts}}") as brief
    |<> loop(Writter, "context.data.brief.length > 500", max: 2)
    |> System.Prnt()
`,
    solution: `policy Budget : MaxSpend(0.20)

tool Search : REST("api.search.example.com")

agent Researcher [anthropic/claude-sonnet-4-5]
  equips Search
  requires Budget

agent Writer [anthropic/claude-haiku-4-5]

pipeline Brief(topic: String) -> Result:
  topic
    |> Researcher.prompt("Find three facts about {{topic}}.", tool: Search) as facts
    |> Writer.prompt("Write a short brief from these facts: {{facts}}") as brief
    |<> loop(Writer, "context.data.brief.length > 500", max: 2)
    |> System.Print()
`,
    check: (i) => clean(i) && has(i, "loop") && calls(i).some((c) => c.callee === "Researcher") && calls(i).some((c) => c.callee === "System"),
  },
  {
    id: "ship",
    track: "Finale",
    icon: "rocket",
    title: "Ready for production",
    goal: "Before this support bot goes live: cap the run at 25 cents, scrub personal details from what the model sees, and get a person's yes before any email is sent.",
    hint: "Three things you've done before: a `MaxSpend(0.25)` and `Redact(PII)` policy the agent requires, then `|! yield(...) as ok` and `|? (context.data.ok.approved == true)` before `Mail.send`.",
    starter: `tool Mail : Email(Env.RESEND_API_KEY, from: "support@example.com")

agent Support [anthropic/claude-sonnet-4-5]

pipeline Respond(email: String, customer: String) -> Result:
  email
    |> Support.reply("Write a helpful reply to this email: {{email}}") as reply
    |> Mail.send(to: "{{customer}}", subject: "Re: your question", body: "{{reply}}")
`,
    solution: `tool Mail : Email(Env.RESEND_API_KEY, from: "support@example.com")

policy Live : MaxSpend(0.25) & Redact(PII)

agent Support [anthropic/claude-sonnet-4-5]
  requires Live

pipeline Respond(email: String, customer: String) -> Result:
  email
    |> Support.reply("Write a helpful reply to this email: {{email}}") as reply
    |! yield(msg: "Send this reply?", [context.data.reply]) as ok
    |? (context.data.ok.approved == true)
    |> Mail.send(to: "{{customer}}", subject: "Re: your question", body: "{{reply}}")
`,
    check: (i) => {
      if (!clean(i) || !i.plans.length || !i.plans.every((p) => p.cappedAt !== undefined && p.cappedAt <= 0.25)) return false;
      if (!calledAgents(i).length || !calledAgents(i).every((a) => redactsPII(i, a))) return false;
      // Every email is sent only after a person was asked and a gate checked their answer.
      return i.ast.pipelines.every((p) => {
        const send = p.pipeline.findIndex((s) => callsIn(s).some((c) => c.callee === "Mail"));
        if (send < 0) return true;
        const ask = p.pipeline.findIndex((s) => s.kind === "interrupt");
        return ask >= 0 && ask < send && p.pipeline.slice(ask + 1, send).some((s) => s.kind === "gate");
      }) && calls(i).some((c) => c.callee === "Mail");
    },
  },
];
