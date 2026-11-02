# Pipe Operators

Halo eliminates imperative boilerplate (like `if/else`, `try/catch`, and `await Promise.all`) by replacing it with 5 reactive Pipe Operators.

## 1. Push (`|>`)

The standard progression operator. It passes the current state of the pipeline forward into a node.

```halo
context |> System.Print()
```

## 2. Gate (`|?`)

The conditional branch. It evaluates an expression against the current context. If the expression evaluates to `true`, the pipeline continues to the next node. If `false`, the pipeline halts execution safely (returning the current context).

**Syntax:** `|? (expression) =>`

```halo
|? (context.data.score > 90) =>
  |> Agent.process()
```

## 3. Interrupt (`|!`)

The human-in-the-loop mechanism. It immediately suspends the AST execution and freezes memory state, waiting for external input. Usually used with the built-in `yield` function.

```halo
|! yield(channel: "UI", message: "Review this!")
```

## 4. Fan-Out (`|*`)

The parallel execution block. It clones the context, runs all sub-nodes concurrently, and merges the resulting context states back together upon completion.

**Syntax:** `|* { node1, node2 }`

```halo
|* { AgentA.run(), AgentB.run() }
```

## 5. Listen (`~>`)

The asynchronous event listener. Suspends the pipeline indefinitely until a specific system event is emitted to the runtime.

```halo
~> listen(System.WebhookReceived)
```
