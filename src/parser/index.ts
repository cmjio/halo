import {
  BaseErrorListener,
  CharStream,
  CommonTokenStream,
  type ATNSimulator,
  type ParserRuleContext,
  type RecognitionException,
  type Recognizer,
  type Token,
} from "antlr4ng";
import { HaloLexer } from "./generated/HaloLexer.js";
import {
  HaloParser,
  type AndExprContext,
  type CallArgsContext,
  type CallExprContext,
  type CallValueContext,
  type ComparisonContext,
  type ContextRefContext,
  type CondExprContext,
  type DirectiveContext,
  type DottedIdContext,
  type PathPartContext,
  type ExpressionContext,
  type PolicyDeclContext,
  type LiteralContext,
  type AgentDeclContext,
  type NotExprContext,
  type OperandContext,
  type OrExprContext,
  type PipelineOpContext,
  type PipelineDeclContext,
  type ToolDeclContext,
  type StoreDeclContext,
  type SchemaDeclContext,
  type TypeRefContext,
  type ValueContext,
  type BindingContext,
  EquipsModifierContext,
  RequiresModifierContext,
  SystemModifierContext,
  LoopOpContext,
  PipeOpContext,
  GateOpContext,
  InterruptOpContext,
  FanoutOpContext,
  BranchOpContext,
  EachOpContext,
  ElseArmContext,
  CondArmContext,
  ListenOpContext,
  NamedArgContext,
  NegationContext,
  ParenOperandContext,
  LiteralOperandContext,
  ContextOperandContext,
  RefOperandContext,
} from "./generated/HaloParser.js";
import type {
  Arg,
  CallStage,
  CompareOp,
  CondExpr,
  Agent,
  Directive,
  PolicyDeclaration,
  Loc,
  ParseResult,
  PipelineDeclaration,
  PipelineStage,
  SchemaDeclaration,
  ToolDeclaration,
  Value,
} from "./types.js";

export type * from "./types.js";
export { validate, producedKeys, type Diagnostic, type ValidateOptions } from "./validate.js";
export { parseDuration } from "./builtins.js";
import { parseDuration } from "./builtins.js";

class CollectingErrorListener extends BaseErrorListener {
  errors: string[] = [];

  override syntaxError<S extends Token, T extends ATNSimulator>(
    _recognizer: Recognizer<T>,
    offendingSymbol: S | null,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: RecognitionException | null,
  ): void {
    const near = offendingSymbol?.text;
    const suffix = near != null && near !== "<EOF>" ? ` near "${near}"` : "";
    this.errors.push(`[${line}:${charPositionInLine}] ${msg}${suffix}`);
  }
}

function makeParser(source: string) {
  const input = CharStream.fromString(source);
  const lexer = new HaloLexer(input);
  const listener = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener);
  const parser = new HaloParser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(listener);
  return { input, parser, listener };
}

const empty = (errors: string[]): ParseResult => ({ policies: [], tools: [], stores: [], schemas: [], agents: [], pipelines: [], errors });

export function parse(source: string): ParseResult {
  try {
    return parseProgram(source);
  } catch (err) {
    // Deeply nested input overflows the recursive-descent parser's stack.
    if (err instanceof RangeError) return empty(["The program is nested too deeply to parse (too many brackets inside one another)"]);
    throw err;
  }
}

function parseProgram(source: string): ParseResult {
  const { input, parser, listener } = makeParser(source);
  const program = parser.program();
  if (listener.errors.length > 0) return empty(listener.errors);

  const result = empty([]);
  const walker = new Walker(input);
  for (const decl of program.declaration()) {
    const p = decl.policyDecl();
    const t = decl.toolDecl();
    const st = decl.storeDecl();
    const sc = decl.schemaDecl();
    const a = decl.agentDecl();
    const pl = decl.pipelineDecl();
    if (p) result.policies.push(walker.policy(p));
    else if (t) result.tools.push(walker.tool(t));
    else if (st) result.stores.push(walker.tool(st));
    else if (sc) result.schemas.push(walker.schema(sc));
    else if (a) result.agents.push(walker.agent(a));
    else if (pl) result.pipelines.push(walker.pipeline(pl));
  }
  return result;
}

/** Parse a condition written as a string, e.g. a loop's `"context.data.x.exitCode != 0"`. */
export function parseCondition(text: string): { expr?: CondExpr; errors: string[] } {
  try {
    return parseConditionText(text);
  } catch (err) {
    if (err instanceof RangeError) return { errors: ["the condition is nested too deeply"] };
    throw err;
  }
}

function parseConditionText(text: string): { expr?: CondExpr; errors: string[] } {
  const { input, parser, listener } = makeParser(text);
  const ctx = parser.condExpr();
  if (!listener.errors.length && parser.getCurrentToken().type !== HaloParser.EOF) listener.errors.push(`unexpected "${parser.getCurrentToken().text}"`);
  if (listener.errors.length) return { errors: listener.errors };
  return { expr: new Walker(input).condition(ctx), errors: [] };
}

// ── Tree walker ──

class Walker {
  constructor(private input: CharStream) {}

  private loc(ctx: ParserRuleContext): Loc {
    return { line: ctx.start?.line ?? 0, column: ctx.start?.column ?? 0 };
  }

  /** Original source text for a rule (preserves spacing). */
  private sourceText(ctx: ParserRuleContext): string {
    if (!ctx.start || !ctx.stop) return ctx.getText();
    return this.input.getTextFromRange(ctx.start.start, ctx.stop.stop);
  }

  policy(ctx: PolicyDeclContext): PolicyDeclaration {
    const rules = ctx.policyRule().map((r) => ({
      name: r.IDENTIFIER().getText(),
      args: this.args(r.callArgs()).map((a) => (a.name ? `${a.name}: ${render(a.value)}` : render(a.value))),
    }));
    return {
      name: ctx.IDENTIFIER().getText(),
      rules,
      rawRules: rules.map((r) => `${r.name}(${r.args.join(", ")})`),
      loc: this.loc(ctx),
    };
  }

  schema(ctx: SchemaDeclContext): SchemaDeclaration {
    return {
      name: ctx.IDENTIFIER().getText(),
      fields: ctx.schemaField().map((f) => ({ name: f.name().getText(), type: typeText(f.typeRef()) })),
      loc: this.loc(ctx),
    };
  }

  tool(ctx: ToolDeclContext | StoreDeclContext): ToolDeclaration {
    const ids = ctx.IDENTIFIER();
    const argList = this.args(ctx.callArgs());
    return {
      name: ids[0]!.getText(),
      provider: ids[1]!.getText(),
      ...renderArgs(argList),
      argList,
      loc: this.loc(ctx),
    };
  }

  agent(ctx: AgentDeclContext): Agent {
    const params: Record<string, string> = {};
    for (const p of ctx.modelParam()) params[p.name().getText()] = render(this.value(p.value()));

    const ref = ctx.modelRef();
    const str = ref.STRING();
    const modelId = str ? unquote(str.getText()) : ref.getText();

    const agent: Agent = { name: ctx.IDENTIFIER().getText(), modelId, params, directives: this.directives(ctx.directive()), loc: this.loc(ctx) };
    for (const mod of ctx.agentModifier()) {
      if (mod instanceof EquipsModifierContext) {
        agent.equips = [...(agent.equips ?? []), ...mod.IDENTIFIER().map((i) => i.getText())];
      } else if (mod instanceof RequiresModifierContext) {
        agent.requires = [...(agent.requires ?? []), ...mod.IDENTIFIER().map((i) => i.getText())];
      } else if (mod instanceof SystemModifierContext) {
        const triple = mod.TRIPLE_STRING();
        agent.system = triple ? dedent(triple.getText().slice(3, -3)) : unquote(mod.STRING()!.getText());
      }
    }
    return agent;
  }

  private directives(list: DirectiveContext[]): Directive[] {
    return list.map((d) => ({
      name: d.name().getText(),
      value: d
        .directiveArg()
        .map((a) => {
          const lit = a.literal();
          if (lit) return render(this.literal(lit));
          return a.getText();
        })
        .join(", "),
    }));
  }

  pipeline(ctx: PipelineDeclContext): PipelineDeclaration {
    const pipelineCtx = ctx.pipeline();
    const pipeline: PipelineStage[] = [];
    const head = pipelineCtx.expression();
    if (head) {
      const expr = this.expression(head);
      pipeline.push({ kind: "expression", value: render(expr), expr, loc: this.loc(head) });
    }
    for (const op of pipelineCtx.pipelineOp()) pipeline.push(this.pipelineOp(op));

    return {
      name: ctx.IDENTIFIER().getText(),
      params: (ctx.paramList()?.param() ?? []).map((p) => ({ name: p.IDENTIFIER().getText(), type: typeText(p.typeRef()) })),
      returnType: ctx.typeRef() ? typeText(ctx.typeRef()!) : "",
      pipeline,
      directives: this.directives(ctx.directive()),
      loc: this.loc(ctx),
    };
  }

  private pipelineOp(ctx: PipelineOpContext): PipelineStage {
    const loc = this.loc(ctx);
    if (ctx instanceof PipeOpContext) {
      return { ...this.call(ctx.callExpr()), bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof GateOpContext) {
      return { kind: "gate", condition: this.sourceText(ctx.condExpr()), expr: this.orExpr(ctx.condExpr().orExpr()), loc };
    }
    if (ctx instanceof InterruptOpContext) {
      const argList = this.args(ctx.callArgs());
      return { kind: "interrupt", callee: "yield", args: argList.map((a) => (a.name ? `${a.name}: ${render(a.value)}` : render(a.value))), argList, bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof FanoutOpContext) {
      const stages = ctx.fanoutItem().map((item): CallStage => {
        const call = item.callExpr();
        const bind = bindName(item.binding());
        if (call) return { ...this.call(call), bind };
        return { kind: "call", callee: item.IDENTIFIER()!.getText(), method: "prompt", args: [], namedArgs: {}, argList: [], bind, implicit: true, loc: this.loc(item) };
      });
      return { kind: "fanout", stages, bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof BranchOpContext) {
      const arms = ctx.branchArm().map((arm) => {
        if (arm instanceof CondArmContext) {
          return { condition: this.sourceText(arm.condExpr()), expr: this.orExpr(arm.condExpr().orExpr()), call: this.call(arm.callExpr()) };
        }
        return { call: this.call((arm as ElseArmContext).callExpr()) };
      });
      return { kind: "branch", arms, bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof EachOpContext) {
      return {
        kind: "each",
        item: ctx.IDENTIFIER().getText(),
        list: this.callValue(ctx.callValue()),
        options: this.args(ctx.callArgs()),
        call: this.call(ctx.callExpr()),
        bind: bindName(ctx.binding()),
        loc,
      };
    }
    if (ctx instanceof LoopOpContext) {
      const raw = (ctx.STRING() ?? ctx.TRIPLE_STRING())!.getText();
      const condition = raw.startsWith('"""') ? raw.slice(3, -3).trim() : unquote(raw);
      const parsed = parseCondition(condition);
      return {
        kind: "loop",
        target: ctx.IDENTIFIER().getText(),
        condition,
        expr: parsed.expr,
        conditionErrors: parsed.errors.length ? parsed.errors : undefined,
        options: this.args(ctx.callArgs()),
        bind: bindName(ctx.binding()),
        loc,
      };
    }
    if (ctx instanceof ListenOpContext) {
      const targetValue = this.callValue(ctx.callValue());
      return { kind: "listen", target: render(targetValue), targetValue, bind: bindName(ctx.binding()), loc };
    }
    throw new Error(`Unhandled pipeline operator: ${ctx.getText()}`);
  }

  private call(ctx: CallExprContext): CallStage {
    const argList = this.args(ctx.callArgs());
    return {
      kind: "call",
      callee: ctx.IDENTIFIER().getText(),
      method: ctx.name()?.getText() ?? "",
      ...renderArgs(argList),
      argList,
      loc: this.loc(ctx),
    };
  }

  private args(ctx: CallArgsContext | null): Arg[] {
    if (!ctx) return [];
    return ctx.callArg().map((a) =>
      a instanceof NamedArgContext
        ? { name: a.name().getText(), value: this.callValue(a.callValue()) }
        : { value: this.callValue((a as any).callValue() as CallValueContext) },
    );
  }

  private callValue(ctx: CallValueContext): Value {
    const lit = ctx.literal();
    if (lit) return this.literal(lit);
    const model = ctx.MODEL_REF();
    if (model) return { kind: "model", value: model.getText() };
    const cref = ctx.contextRef();
    if (cref) return this.contextRef(cref);
    const list = ctx.listValue();
    if (list) return { kind: "list", items: list.callValue().map((v) => this.callValue(v)) };
    return this.dotted(ctx.dottedId()!);
  }

  private value(ctx: ValueContext): Value {
    const lit = ctx.literal();
    if (lit) return this.literal(lit);
    const model = ctx.MODEL_REF();
    if (model) return { kind: "model", value: model.getText() };
    return this.dotted(ctx.dottedId()!);
  }

  private expression(ctx: ExpressionContext): Value {
    const lit = ctx.literal();
    if (lit) return this.literal(lit);
    const cref = ctx.contextRef();
    if (cref) return this.contextRef(cref);
    return this.dotted(ctx.dottedId()!);
  }

  private literal(ctx: LiteralContext): Value {
    const text = ctx.getText();
    if (ctx.STRING()) return { kind: "string", value: unquote(text) };
    if (ctx.TRIPLE_STRING()) return { kind: "string", value: dedent(text.slice(3, -3)) };
    if (ctx.NUMBER()) return { kind: "number", value: Number(text), raw: text };
    if (ctx.DURATION()) return { kind: "duration", ms: parseDuration(text), raw: text };
    if (ctx.BOOL()) return { kind: "bool", value: text === "true" };
    return { kind: "null" };
  }

  private dotted(ctx: DottedIdContext): Value {
    return { kind: "ref", path: [ctx.IDENTIFIER().getText(), ...pathParts(ctx.pathPart())] };
  }

  private contextRef(ctx: ContextRefContext): Value {
    return { kind: "context", path: pathParts(ctx.pathPart()) };
  }

  // ── Conditions ──

  condition(ctx: CondExprContext): CondExpr {
    return this.orExpr(ctx.orExpr());
  }

  private orExpr(ctx: OrExprContext): CondExpr {
    const terms = ctx.andExpr().map((a) => this.andExpr(a));
    return terms.length === 1 ? terms[0]! : { kind: "or", terms };
  }

  private andExpr(ctx: AndExprContext): CondExpr {
    const terms = ctx.notExpr().map((n) => this.notExpr(n));
    return terms.length === 1 ? terms[0]! : { kind: "and", terms };
  }

  private notExpr(ctx: NotExprContext): CondExpr {
    if (ctx instanceof NegationContext) return { kind: "not", expr: this.notExpr(ctx.notExpr()) };
    return this.comparison((ctx as any).comparison() as ComparisonContext);
  }

  private comparison(ctx: ComparisonContext): CondExpr {
    const [l, r] = ctx.operand();
    const left = this.operand(l!);
    if (!r) return left;
    return { kind: "compare", op: ctx.compOp()!.getText() as CompareOp, left, right: this.operand(r) };
  }

  private operand(ctx: OperandContext): CondExpr {
    if (ctx instanceof ParenOperandContext) return this.orExpr(ctx.orExpr());
    if (ctx instanceof LiteralOperandContext) return { kind: "value", value: this.literal(ctx.literal()) };
    if (ctx instanceof ContextOperandContext) return { kind: "value", value: this.contextRef(ctx.contextRef()) };
    return { kind: "value", value: this.dotted((ctx as RefOperandContext).dottedId()) };
  }
}

// ── Helpers ──

function bindName(ctx: BindingContext | null): string | undefined {
  return ctx?.name().getText();
}

/** Render a value back to its textual (string-compatible) form. */
export function render(v: Value): string {
  switch (v.kind) {
    case "string": return v.value;
    case "number": return v.raw;
    case "bool": return String(v.value);
    case "null": return "null";
    case "duration": return v.raw;
    case "model": return v.value;
    case "ref": return v.path.join(".");
    case "context": return ["context", ...v.path].join(".");
    case "list": return `[${v.items.map(render).join(", ")}]`;
  }
}

function renderArgs(argList: Arg[]): { args: string[]; namedArgs: Record<string, string> } {
  const args: string[] = [];
  const namedArgs: Record<string, string> = {};
  for (const a of argList) {
    if (a.name) namedArgs[a.name] = render(a.value);
    else args.push(render(a.value));
  }
  return { args, namedArgs };
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", "0": "\0" };

function unquote(s: string): string {
  return s.slice(1, -1).replace(/\\(.)/g, (_, c: string) => ESCAPES[c] ?? c);
}

/** Strip common leading indentation from a triple-quoted string. */
function dedent(s: string): string {
  const lines = s.replace(/^[ \t]*\r?\n/, "").replace(/\r?\n[ \t]*$/, "").split(/\r?\n/);
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)![0].length));
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join("\n");
}

/** Type text with normalized spacing: `Array<String>`, `Map<String, Number>`. */
function typeText(ctx: TypeRefContext): string {
  const base = ctx.dottedId().getText();
  const args = ctx.typeRef();
  return args.length ? `${base}<${args.map(typeText).join(", ")}>` : base;
}

/** Path segments as text. The lexer reads `items.0.1` as `items` `.` `0.1`, so split numbers on dots. */
function pathParts(parts: PathPartContext[]): string[] {
  return parts.flatMap((p) => (p.NUMBER() ? p.getText().split(".") : [p.getText()]));
}
