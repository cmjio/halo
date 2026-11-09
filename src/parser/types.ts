// ── AST type definitions ──

/** Source position (1-based line, 0-based column). */
export interface Loc {
  line: number;
  column: number;
}

/** A typed value as written in source. */
export type Value =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number; raw: string }
  | { kind: "bool"; value: boolean }
  | { kind: "null" }
  | { kind: "duration"; ms: number; raw: string }
  | { kind: "model"; value: string }
  /** A bare or dotted name: `lang`, `Env.DB_URI`, `SlackDev` */
  | { kind: "ref"; path: string[] }
  /** `context.data.user.name` → path ["data", "user", "name"] */
  | { kind: "context"; path: string[] }
  | { kind: "list"; items: Value[] };

/** A call argument, positional (no name) or named. */
export interface Arg {
  name?: string;
  value: Value;
}

export interface Directive {
  name: string;
  /** Arguments rendered as text, comma-separated (e.g. "3, 2s"). */
  value: string;
  /** Each argument on its own, strings without their quotes (e.g. `@expect`'s conditions, which can hold commas). */
  args?: string[];
}

export interface PolicyRule {
  name: string;
  args: string[];
}

export interface PolicyDeclaration {
  name: string;
  rules: PolicyRule[];
  /** Rules rendered as text, e.g. "Redact(PII)". */
  rawRules?: string[];
  loc?: Loc;
}

export interface SchemaField {
  name: string;
  /** Type as written: `String`, `Number`, `Boolean`, `Array`, `Array<String>`, or another schema's name. */
  type: string;
}

export interface SchemaDeclaration {
  name: string;
  fields: SchemaField[];
  loc?: Loc;
}

export interface ToolDeclaration {
  name: string;
  provider: string;
  /** Positional args rendered as text. */
  args: string[];
  /** Named args rendered as text. */
  namedArgs: Record<string, string>;
  /** All args, typed, in source order. */
  argList: Arg[];
  loc?: Loc;
}

export type StoreDeclaration = ToolDeclaration;

export interface Agent {
  name: string;
  modelId: string;
  params: Record<string, string>;
  equips?: string[];
  requires?: string[];
  directives?: Directive[];
  /** System prompt from the `system "..."` modifier. */
  system?: string;
  loc?: Loc;
}

export interface PipelineParam {
  name: string;
  type: string;
}

// ── Gate conditions ──

export type CompareOp = "==" | "!=" | ">" | "<" | ">=" | "<=";

export type CondExpr =
  | { kind: "or"; terms: CondExpr[] }
  | { kind: "and"; terms: CondExpr[] }
  | { kind: "not"; expr: CondExpr }
  | { kind: "compare"; op: CompareOp; left: CondExpr; right: CondExpr }
  | { kind: "value"; value: Value };

// ── Pipeline stages ──

export type PipelineStage =
  | ExpressionStage
  | CallStage
  | GateStage
  | InterruptStage
  | FanOutStage
  | BranchStage
  | EachStage
  | ListenStage
  | LoopStage;

export interface ExpressionStage {
  kind: "expression";
  value: string;
  expr: Value;
  loc?: Loc;
}

export interface CallStage {
  kind: "call";
  callee: string;
  /** Method name; empty for a direct pipeline call like `Other(x)`. */
  method: string;
  args: string[];
  namedArgs: Record<string, string>;
  argList: Arg[];
  /** `as name` binding: stores the result at `context.data.<bind>`. */
  bind?: string;
  /** True for a bare agent name inside a fan-out block (`|* { A, B }`). */
  implicit?: boolean;
  loc?: Loc;
}

export interface GateStage {
  kind: "gate";
  /** Condition source text, without the surrounding parentheses. */
  condition: string;
  expr: CondExpr;
  loc?: Loc;
}

export interface InterruptStage {
  kind: "interrupt";
  callee: "yield";
  args: string[];
  argList: Arg[];
  bind?: string;
  loc?: Loc;
}

export interface FanOutStage {
  kind: "fanout";
  stages: CallStage[];
  bind?: string;
  loc?: Loc;
}

export interface BranchArm {
  /** Condition source text; absent for the `else` arm. */
  condition?: string;
  expr?: CondExpr;
  call: CallStage;
}

/** `|? { (cond) => Call(), ..., else => Call() }`: runs the first arm whose condition holds. */
export interface BranchStage {
  kind: "branch";
  arms: BranchArm[];
  bind?: string;
  loc?: Loc;
}

/** `|* each(item in list) => Call()`: runs the call once per item, in parallel. */
export interface EachStage {
  kind: "each";
  /** Loop variable, bound to the item under `context.data.<item>` for each call. */
  item: string;
  list: Value;
  /** Options such as `concurrency: 2`. */
  options: Arg[];
  call: CallStage;
  bind?: string;
  loc?: Loc;
}

export interface ListenStage {
  kind: "listen";
  target: string;
  targetValue: Value;
  bind?: string;
  loc?: Loc;
}

/**
 * `|<> loop(Agent, "condition")`: while the condition holds, ask the agent to
 * fix the current value and re-run the stages since the loop's start.
 */
export interface LoopStage {
  kind: "loop";
  /** The agent asked to retry. */
  target: string;
  /** Condition source text, as written in the string. */
  condition: string;
  expr?: CondExpr;
  /** Syntax errors in the condition string, if any. */
  conditionErrors?: string[];
  /** Options such as `max: 3`. */
  options: Arg[];
  bind?: string;
  loc?: Loc;
}

export interface PipelineDeclaration {
  name: string;
  params: PipelineParam[];
  returnType: string;
  pipeline: PipelineStage[];
  directives: Directive[];
  loc?: Loc;
}

export interface ParseResult {
  policies: PolicyDeclaration[];
  tools: ToolDeclaration[];
  stores: StoreDeclaration[];
  schemas: SchemaDeclaration[];
  agents: Agent[];
  pipelines: PipelineDeclaration[];
  errors: string[];
}
