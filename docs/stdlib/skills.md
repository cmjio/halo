# Skills

A skill is a set of instructions for one kind of task (reviewing code, writing release notes, triaging bugs) that an agent loads when it needs it. Skills keep system prompts short: an agent carries a one-line description of each skill and reads the full instructions only for the task in front of it. Halo ships seven, and reads your own from a folder.

There are two ways to use them:

| Written | What happens |
|---|---|
| `skills: "code-review, house-style"` in the agent's brackets, or `skills: ["a", "b"]` on a call | Those skills' instructions are added to the system prompt, every time |
| `tool Kit : Skills("./skills")`, equipped, with `tools: [Kit]` on a call | The agent sees every skill's name and description, and loads the ones it needs with `Kit.load` |

```halo
tool Kit : Skills("./skills")

agent Notes [anthropic/claude-haiku-4-5, skills: "release-notes, house-style"]

agent Helper [anthropic/claude-sonnet-4-5]
  equips Kit

pipeline Release(commits: String) -> Result:
  commits |> Notes.write()

pipeline Anything(task: String) -> Result:
  task |> Helper.work(tools: [Kit])
```

`skills:` on a call replaces the agent's list for that call; `skills: "none"` turns them off. A skill that can't be found fails the call with `UNKNOWN_SKILL`, naming the skills there are.

## Built-in skills

| Skill | For |
|---|---|
| `code-review` | Finding bugs and security problems in a diff; answers JSON `{ verdict, summary, findings: [{ file, line, severity, issue, fix }] }` |
| `write-tests` | Adding focused tests in the project's existing framework and style |
| `web-research` | Answering a question from sources, with a URL for every claim |
| `data-extraction` | Pulling fields out of documents as strict JSON, `null` when absent |
| `release-notes` | Turning commits or PRs into user-facing notes, breaking changes first |
| `incident-postmortem` | A blameless postmortem: impact, timeline, root cause, action items |
| `bug-triage` | Classifying an issue: kind, severity, duplicate, what's missing; answers JSON |

`halo skills` lists every skill a project can use (yours first), and `halo skills code-review` prints one. Several [agent presets](./agent-presets.md) come with a built-in skill already loaded.

## Writing a skill

A skill is a folder with a `SKILL.md`, the same layout as Agent Skills, so skills written for other agents work here too:

```
skills/
  house-style/
    SKILL.md
    words.md          # supporting files, read with Kit.read
```

```markdown
---
name: house-style
description: Write in our house style - British spelling, no jargon, sentence-case headings. Use for anything customers will read.
---

# House style

- British spelling (colour, organise).
- ...
```

- `description` is what an agent reads to decide whether to load the skill, so say what it's for and when to use it.
- `name` defaults to the folder's name. A single `<name>.md` file with the same frontmatter is a skill too.
- Supporting files in the folder are listed in `load`'s result and read with `Kit.read(name, path)`; paths can't leave the folder, and symlinks out of it aren't followed.
- A skill of yours with the same name as a built-in one replaces it.

## The `Skills` tool

```halo
tool Kit : Skills("./skills")                     // your skills, then the built-in ones
tool Kit : Skills("./skills", builtin: false)     // only yours
tool Kit : Skills()                               // ./skills, then the built-in ones
```

| Method | Arguments | Returns |
|---|---|---|
| `list` | | `[{ name, description, source }]` |
| `load` | `name` | `{ name, description, instructions, files }` |
| `read` | `name`, `path` | `{ name, path, content }` |

All three only read. When an agent is offered the tool, `load`'s description lists every skill with its description, and its `name` argument is limited to those names. An agent that equips a `Skills` tool also looks up its `skills:` there; one that doesn't uses `./skills` and the built-in skills.
