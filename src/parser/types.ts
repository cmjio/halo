// ── AST type definitions ──

export interface Directive {
  name: string;
  value: string;
}

export interface PolicyRule {
  name: string;
  args: string[];
}

export interface PolicyDeclaration {
  name: string;
  rules: PolicyRule[];
  rawRules?: string[];  // string representation for quick lookup
}

export interface ToolDeclaration {
  name: string;
  provider: string;
  args: string[];
  namedArgs?: Record<string, string>;
}

export interface StoreDeclaration {
  name: string;
  provider: string;
  args: string[];
  namedArgs?: Record<string, string>;
}

export interface Agent {
  name: string;
  modelId: string;
  params: Record<string, string>;
  equips?: string[];
  requires?: string[];
  directives?: Directive[];
  system?: string;
}

export interface PipelineParam {
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
  | ListenStage
  | LoopStage;

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

export interface LoopStage {
  kind: "loop";
  target: string;
  condition: string;
}

export interface PipelineDeclaration {
  name: string;
  params: PipelineParam[];
  returnType: string;
  pipeline: PipelineStage[];
  directives: Directive[];
}

export interface SchemaField {
  name: string;
  type: string;
}

export interface SchemaDeclaration {
  name: string;
  fields: SchemaField[];
}

export interface ParseResult {
  policies: PolicyDeclaration[];
  tools: ToolDeclaration[];
  stores: StoreDeclaration[];
  agents: Agent[];
  pipelines: PipelineDeclaration[];
  schemas: SchemaDeclaration[];
  errors: string[];
}
