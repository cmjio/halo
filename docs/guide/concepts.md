# Core Concepts

Halo is fundamentally different from frameworks like LangChain, AutoGen, or CrewAI. Most AI frameworks treat LLMs as "autonomous objects" that loop endlessly in a black box until they decide they are done. 

Halo treats agents as **functions in a state machine**. 

## The Pipeline (`|>` Operator)

In Halo, data moves linearly through a `pipeline` using the pipe forward operator (`|>`):

```halo
pipeline Summarize(text: String) -> String:
  text
    |> Reader.extract_facts()
    |> Writer.summarize()
```

If an agent fails (e.g. hits a token limit, or fails schema validation), the pipeline halts predictably. There are no infinite recursive loops unless you explicitly code them.

## Agents are Stateless

In Halo, an `agent` is just a configuration block that binds a Model ID (like `gpt-4o`) to a persona (a system prompt) and a set of tools. 

```halo
agent Reviewer [openai/gpt-4o]
  system "You are a strict code reviewer."
  equips GitHubTool, LinearTool
```

Agents do not hold memory across different stages of a pipeline implicitly. If you want an agent to "remember" previous context, you pass it explicitly using the `context` variable or by utilizing native `store` integrations.

## Gates (`|?`) for Control Flow

Instead of writing complex `if/else` statements in Python, Halo uses Pattern Matching Gates (`|?`) for declarative branching.

```halo
pipeline Triage(ticket: Ticket) -> Result:
  // Route to the appropriate agent based on the ticket type
  |? (ticket.type == "bug") =>
    ticket |> Engineer.fix()
    
  |? (ticket.type == "billing") =>
    ticket |> Support.reply()
```

## Human in the Loop (`|! yield` and `~> listen`)

Enterprise workflows cannot be fully autonomous. If an LLM makes a critical decision, a human often needs to approve it. Halo supports this natively using the `|! yield` operator, which acts like a webhook that suspends the pipeline to a persistent database (SQLite or PostgreSQL) until the host application resumes it.

```halo
pipeline TransferMoney(request: Transfer) -> Result:
  |? (request.amount > 10000) =>
    |! yield(action: "ManagerApproval", data: request)
    
  request |> BankTool.execute()
```
