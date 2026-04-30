// ── AST type definitions ──

export interface Directive {
  name: string;
  value: string;
}

export interface GuardrailRule {
  name: string;
  args: string[];
}

export interface GuardrailDeclaration {
  name: string;
  rules: GuardrailRule[];
  rawRules?: string[];  // string representation for quick lookup
}

export interface ToolDeclaration {
  name: string;
  provider: string;
  args: string[];
}

export interface MemoryDeclaration {
  name: string;
  provider: string;
  args: string[];
}

export interface Mind {
  name: string;
  modelId: string;
  params: Record<string, string>;
  equips?: string[];
  requires?: string[];
  directives?: Directive[];
}

export interface StreamParam {
  name: string;
  type: string;
}

// Pipeline stage types
export type PipelineStage =
  | ExpressionStage
  | CallStage
  | GateStage
  | InterruptStage
  | FanOutStage
  | ListenStage;

export interface ExpressionStage {
  kind: "expression";
  value: string;
}

export interface CallStage {
  kind: "call";
  callee: string;
  method: string;
  args: string[];
  namedArgs: Record<string, string>;
}

export interface GateStage {
  kind: "gate";
  condition: string;
}

export interface InterruptStage {
  kind: "interrupt";
  callee: string;  // "yield"
  args: string[];
}

export interface FanOutStage {
  kind: "fanout";
  stages: PipelineStage[];
}

export interface ListenStage {
  kind: "listen";
  target: string;
}

export interface StreamDeclaration {
  name: string;
  params: StreamParam[];
  returnType: string;
  pipeline: PipelineStage[];
  directives: Directive[];
}

export interface ParseResult {
  guardrails: GuardrailDeclaration[];
  tools: ToolDeclaration[];
  memories: MemoryDeclaration[];
  minds: Mind[];
  streams: StreamDeclaration[];
  errors: string[];
}
