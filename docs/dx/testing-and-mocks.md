# Testing & Mocks (TDD)

Writing tests for AI agents has historically been a nightmare. LLMs are non-deterministic, and running test suites costs real money.

Halo solves this by providing a first-class testing framework built directly into the CLI.

## The `halo test` Command

You do not need Jest or Mocha to test Halo pipelines. You write tests natively in a `.test.halo` file.

```halo
// support.test.halo

import { ProcessTicket } from "./support.halo"

test "It handles refund requests" {
  // 1. Arrange
  let input = { ticket: "I want a refund for my order." }
  
  // 2. Act
  let result = ProcessTicket(input)
  
  // 3. Assert
  assert(result.action == "IssueRefund")
  assert(result.confidence > 0.9)
}
```

Run the tests using the CLI:
```bash
halo test
```

## Mocking LLMs and Tools

To avoid spending $5 on OpenAI API credits every time your CI/CD pipeline runs, you can use the `--mock` flag.

```bash
halo test --mock
```

When running in mock mode, the Halo Runtime intercepts all agent executions. Instead of calling the actual LLM, it looks for a `mocks.json` file in your root directory and returns the deterministic response mapped to that node.

```json
{
  "ProcessTicket": {
    "SupportAgent.analyze": {
      "action": "IssueRefund",
      "confidence": 0.95
    }
  }
}
```

## Policy Testing

Because Policies are evaluated deterministically at the runtime boundary, you can test them in isolation without any LLM invocations.

```halo
test "MaxSpend policy throws correctly" {
  let ctx = mockContext(meta: { cost: 6.00 })
  assertThrows(QA_Budget.evaluate(ctx), "PolicyViolation")
}
```
