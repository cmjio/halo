import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime, SuspendedRun } from "../src/runtime/runtime.js";

describe("Langly Persistence Engine (Signal Architecture)", () => {
  test("Yield operator suspends execution and returns SuspendedRun", async () => {
    const src = `
      agent M [mock/model]
      pipeline YieldDemo(x: String) -> Result:
        x
          |> M.prompt("Step 1: {{context.input.x}}")
          |! yield("Wait for approval")
          |> M.prompt("Step 2: {{context.current}}")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    rt.mockAll({
      "M.prompt": "Drafted text",
    });

    const result = await rt.execute("YieldDemo", { x: "Start" });
    
    expect(result).toBeInstanceOf(SuspendedRun);
    const runId = (result as SuspendedRun).runId;

    // A generic yield doesn't have a strict target event (it's internal),
    // so any signal name might pass, or we use a generic "resume" signal
    const finalResult = await rt.signal(runId, "resume", "Approved draft");
    expect(finalResult).toBe("Drafted text"); 
  });

  test("Listen operator requires exact event signal to resume", async () => {
    const src = `
      pipeline ListenDemo(x: String) -> Result:
        x
          ~> listen(Slack.Interaction)
          |> System.Print()
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);

    const result = await rt.execute("ListenDemo", { x: "Start" });
    expect(result).toBeInstanceOf(SuspendedRun);
    const runId = (result as SuspendedRun).runId;

    // Sending the wrong signal should throw an error
    expect(rt.signal(runId, "Email.Received", "Fake payload")).rejects.toThrow("Expected signal 'Slack.Interaction' but received 'Email.Received'");

    // Sending the correct signal should resume
    const finalResult = await rt.signal(runId, "Slack.Interaction", "Webhook Triggered");
    expect(finalResult).toBe("Webhook Triggered");
  });

  test("Slack Aware Connector automatically embeds runId", async () => {
    const src = `
      tool SlackApproval : Slack("mock-token")
      pipeline SlackDemo(topic: String) -> Result:
        topic |> SlackApproval.execute(channel: "#approvals", text: "Please review: {{context.input.topic}}")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);

    // We can just spy on the result of the tool to see what it sent
    const result = await rt.execute("SlackDemo", { topic: "Hello" });
    // Since it's mocked, we expect the output to return the intercepted payload
    const payload = result as any;
    expect(payload.channel).toBe("#approvals");
    expect(payload.text).toBe("Please review: Hello");
    // The aware connector should have automatically appended the runId
    expect(payload.langlyRunId).toBeDefined();
  });
});
