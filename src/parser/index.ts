import { CharStream, CommonTokenStream, type ANTLRErrorListener, type Recognizer, type Token, type RecognitionException } from "antlr4ng";
import { LanglyLexer } from "./LanglyLexer.js";
import { LanglyParser } from "./LanglyParser.js";
import type {
  ParseResult,
  Mind,
  StreamDeclaration,
  PipelineStage,
  Directive,
  GuardrailDeclaration,
  ToolDeclaration,
  MemoryDeclaration,
} from "./types.js";

/** Extract text from a TerminalNode or context. */
function tok(node: unknown): string {
  if (node == null) return "";
  const n: any = node;
  if (typeof n.getText === "function") { const t = n.getText(); if (t != null) return String(t); }
  if (n.getSymbol && typeof n.getSymbol === "function") { const s = n.getSymbol(); if (s?.text) return String(s.text); }
  if (n.text != null) return String(n.text);
  return "";
}

/** Extract all token texts from a context (e.g. for directive values). */
function ctxText(ctx: unknown): string {
  return ((ctx as any)?.text) ?? "";
}

/** Walk children of a context, collecting non-paren text tokens. */
function innerText(ctx: unknown): string {
  if (!ctx) return "";
  const c = ctx as any;
  if (c.children) {
    const parts: string[] = [];
    for (const child of c.children) {
      const t = tok(child);
      if (t !== "(" && t !== ")") parts.push(t);
    }
    // Join with commas but clean up excessive whitespace
    return parts.join(", ").replace(/\s*,\s*/g, ", ").trim();
  }
  return tok(ctx);
}

class CollectingErrorListener {
  errors: string[] = [];
  syntaxError(
    _recognizer: any,
    offendingSymbol: any,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: any,
  ): void {
    const t = offendingSymbol?.text;
    const tokenText = t ?? offendingSymbol?.text ?? "<missing>";
    this.errors.push(`[${line}:${charPositionInLine}] ${msg} near "${tokenText}"`);
  }
  reportAmbiguity(..._args: any[]): void {}
  reportAttemptingFullContext(..._args: any[]): void {}
  reportContextSensitivity(..._args: any[]): void {}
}

export function parse(source: string): ParseResult {
  const input = CharStream.fromString(source);
  const lexer = new LanglyLexer(input);
  lexer.removeErrorListeners();
  const tokens = new CommonTokenStream(lexer);
  const parser = new LanglyParser(tokens);

  const listener = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(listener);

  const ctx = parser.program();

  if (listener.errors.length > 0) {
    return { guardrails: [], tools: [], memories: [], minds: [], streams: [], errors: listener.errors };
  }

  return walkProgram(ctx);
}

// ── Walk Program ──

function walkProgram(ctx: unknown): ParseResult {
  const guardrails: GuardrailDeclaration[] = [];
  const tools: ToolDeclaration[] = [];
  const memories: MemoryDeclaration[] = [];
  const minds: Mind[] = [];
  const streams: StreamDeclaration[] = [];
  const a = ctx as any;
  const decls = a.declaration?.() ?? [];

  for (const decl of decls) {
    const dc = decl as any;
    if (dc.guardrailDecl?.()) guardrails.push(walkGuardrail(dc.guardrailDecl()));
    if (dc.toolDecl?.()) tools.push(walkTool(dc.toolDecl()));
    if (dc.memoryDecl?.()) memories.push(walkMemory(dc.memoryDecl()));
    if (dc.mindDecl?.()) minds.push(walkMind(dc.mindDecl()));
    if (dc.streamDecl?.()) streams.push(walkStream(dc.streamDecl()));
  }

  return { guardrails, tools, memories, minds, streams, errors: [] };
}

// ── Guardrail ──

function walkGuardrail(ctx: unknown): GuardrailDeclaration {
  const c = ctx as any;
  const ids = c.IDENTIFIER?.();
  const name = tok(Array.isArray(ids) ? ids[0] : ids);
  const rules: GuardrailRule[] = [];
  for (const r of c.guardrailRule?.() ?? []) {
    rules.push(walkGuardrailRule(r));
  }
  return { name, rules };
}

function walkGuardrailRule(ctx: unknown): GuardrailRule {
  const c = ctx as any;
  const name = tok(c.IDENTIFIER?.());
  const args: string[] = [];
  for (const a of c.guardrailArgs?.()?.guardrailArg?.() ?? []) {
    args.push(extractValueRaw(a));
  }
  return { name, args };
}

// ── Tool ──

function walkTool(ctx: unknown): ToolDeclaration {
  const c = ctx as any;
  const ids = c.IDENTIFIER?.() ?? [];
  const name = tok(ids[0]);
  const provider = tok(ids[1]);
  const args: string[] = [];
  for (const a of c.toolArgs?.()?.toolArg?.() ?? []) {
    args.push(extractValueRaw(a));
  }
  return { name, provider, args };
}

// ── Memory ──

function walkMemory(ctx: unknown): MemoryDeclaration {
  const c = ctx as any;
  const ids = c.IDENTIFIER?.() ?? [];
  const name = tok(ids[0]);
  const provider = tok(ids[1]);
  const args: string[] = [];
  for (const a of c.memoryArgs?.()?.memoryArg?.() ?? []) {
    args.push(extractValueRaw(a));
  }
  return { name, provider, args };
}

// ── Mind ──

function walkMind(ctx: unknown): Mind {
  const c = ctx as any;
  const name = extractNameKeyword(c, "mind");
  const mc = c.modelConfig?.();
  const modelId = tok(mc?.modelId?.()?.MODEL_REF?.());
  const params: Record<string, string> = {};
  for (const p of mc?.modelParam?.() ?? []) {
    const key = tok(p.IDENTIFIER?.());
    params[key] = extractValue(p.value());
  }

  const directives = walkDirectives(c.directive?.() ?? []);

  let equips: string[] | undefined;
  let requires: string[] | undefined;
  const mmCtx = c.mindModifiers?.();
  if (mmCtx) {
    for (const mod of mmCtx.mindModifier?.() ?? []) {
      if (mod.equipsList?.()) equips = extractAllIdentifiers(mod.equipsList());
      if (mod.requiresList?.()) requires = extractAllIdentifiers(mod.requiresList());
    }
  }

  return { name, modelId, params, equips, requires, directives };
}

function extractNameKeyword(ctx: unknown, keyword: string): string {
  const children = (ctx as any)?.children ?? [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const txt = tok(child);
    if (txt === keyword && i + 1 < children.length) return tok(children[i + 1]);
  }
  return "";
}

function extractAllIdentifiers(ctx: unknown): string[] {
  return ((ctx as any)?.IDENTIFIER?.() ?? []).map(tok).filter(Boolean);
}

// ── Directives ──

function walkDirectives(directives: any[]): Directive[] {
  return directives.map((d: any) => ({
    name: tok(d.directiveName?.()),
    value: innerText(d.directiveValue?.()),
  }));
}

// ── Stream ──

function walkStream(ctx: unknown): StreamDeclaration {
  const c = ctx as any;
  const name = extractNameKeyword(c, "stream");
  const returnType = tok(c.typeRef?.()?.contextRef?.()) || textOfDottedId(c.typeRef?.());
  const params: StreamDeclaration["params"] = [];
  const pl = c.paramList?.();
  if (pl) {
    for (const p of pl.param?.() ?? []) {
      params.push({
        name: tok(p.IDENTIFIER?.()),
        type: tok(p.typeRef?.()) || textOfDottedId(p.typeRef?.()),
      });
    }
  }
  const pipeline = walkPipeline(c.pipeline());
  const directives = walkDirectives(c.directive?.() ?? []);
  return { name, params, returnType, pipeline, directives };
}

// ── Pipeline ──

function walkPipeline(ctx: unknown): PipelineStage[] {
  const c = ctx as any;
  const stages: PipelineStage[] = [];

  // pipelineStage+ — each stage is one of: expression, PIPE callExpr, GATE condition,
  // INTERRUPT yieldExpr, FANOUT {…}, LISTEN listenExpr
  for (const ps of c.pipelineStage?.() ?? []) {
    const psc = ps as any;

    // expression
    const expr = psc.expression?.();
    if (expr) {
      stages.push({ kind: "expression", value: walkExpressionText(expr) });
      continue;
    }

    // PIPE callExpr
    const call = psc.callExpr?.();
    if (call) {
      stages.push(walkCall(call));
      continue;
    }

    // GATE condition
    const cond = psc.condition?.();
    if (cond) {
      stages.push({ kind: "gate", condition: innerText(cond) });
      continue;
    }

    // INTERRUPT yieldExpr
    const yld = psc.yieldExpr?.();
    if (yld) {
      const args: string[] = [];
      for (const a of yld.yieldArgs?.()?.yieldArg?.() ?? []) {
        args.push(extractValueRaw(a));
      }
      stages.push({ kind: "interrupt", callee: "yield", args });
      continue;
    }

    // FANOUT
    const fanout = psc.fanoutStages?.();
    if (fanout) {
      const inner: PipelineStage[] = [];
      for (const fs of fanout.fanoutStage?.() ?? []) {
        const fc = fs as any;
        const fcall = fc.callExpr?.();
        if (fcall) {
          inner.push(walkCall(fcall));
        } else {
          inner.push({ kind: "expression", value: tok(fc.IDENTIFIER?.()) });
        }
      }
      stages.push({ kind: "fanout", stages: inner });
      continue;
    }

    // LISTEN
    const lsn = psc.listenExpr?.();
    if (lsn) {
      stages.push({ kind: "listen", target: tok((lsn as any).listenTarget?.()) });
      continue;
    }
  }

  return stages;
}

// ── Helpers ──

function walkExpressionText(ctx: unknown): string {
  const c = ctx as any;
  if (c.contextRef?.()) return tok(c.contextRef());
  if (c.IDENTIFIER?.()) return tok(c.IDENTIFIER());
  if (c.STRING?.()) return stripQuotes(tok(c.STRING()));
  if (c.NUMBER?.()) return tok(c.NUMBER());
  if (c.BOOL?.()) return tok(c.BOOL());
  return "";
}

function walkCall(ctx: unknown): PipelineStage {
  const c = ctx as any;
  const ids = c.IDENTIFIER?.() ?? [];
  // In ANTLR, callExpr has exactly 2 IDENTIFIERs: callee.method
  const callee = tok(ids[0]);
  const method = tok(ids[1]);
  const args: string[] = [];
  const namedArgs: Record<string, string> = {};
  const ca = c.callArgs?.();
  if (ca) {
    for (const arg of ca.callArg?.() ?? []) {
      const ac = arg as any;
      // Check if this is a namedCallArg (has IDENTIFIER followed by ':' and callValue)
      const namedCallArg = ac.namedCallArg?.();
      if (namedCallArg) {
        // Extract key from namedCallArg
        const key = tok(namedCallArg.IDENTIFIER?.());
        // Extract value from namedCallArg's callValue
        const value = extractCallValue(namedCallArg.callValue?.());
        namedArgs[key] = value;
      } else {
        // Positional arg
        args.push(extractCallArg(arg));
      }
    }
  }
  return { kind: "call", callee, method, args, namedArgs };
}

function extractCallArg(ctx: unknown): string {
  const c = ctx as any;
  // callArg either has a callValue child (positional) or is a named arg
  if (c.callValue?.()) return extractCallValue(c.callValue());
  return extractValueRaw(ctx);
}

function extractCallValue(ctx: unknown): string {
  const c = ctx as any;
  if (c.STRING?.()) return stripQuotes(tok(c.STRING()));
  if (c.NUMBER?.()) return tok(c.NUMBER());
  if (c.BOOL?.()) return tok(c.BOOL());
  if (c.dottedId?.()) return textOfDottedId(c.dottedId());
  if (c.contextRef?.()) return extractContextRef(c.contextRef());
  if (c.callItems?.()) {
    const items = c.callItems()
      .callValue?.()
      .map((cv: any) => extractCallValue(cv)) ?? [];
    return `[${items.join(", ")}]`;
  }
  return extractValueRaw(ctx);
}

function extractValue(ctx: unknown): string {
  return extractValueRaw(ctx);
}

function extractValueRaw(ctx: unknown): string {
  const c = ctx as any;
  if (c.MODEL_REF?.()) return tok(c.MODEL_REF());
  if (c.STRING?.()) return stripQuotes(tok(c.STRING()));
  if (c.NUMBER?.()) return tok(c.NUMBER());
  if (c.BOOL?.()) return tok(c.BOOL());
  if (c.dottedId?.()) return tok(c.dottedId());
  if (c.contextRef?.()) return tok(c.contextRef());
  if (c.IDENTIFIER?.()) return tok(Array.isArray(c.IDENTIFIER()) ? c.IDENTIFIER().map(tok).join(".") : c.IDENTIFIER());
  if (c.yieldArg?.()) {
    // For yield args with named params (key: value), just return full text
    return tok(ctx);
  }
  return tok(ctx);
}

/** Extract full dotted-id text (e.g. "Env.DB_URI"). */
function textOfDottedId(ctx: unknown): string {
  const c = ctx as any;
  const ids = c.IDENTIFIER?.() ?? [];
  return ids.map(tok).join(".");
}

/** Extract full context reference (e.g. "context.data.user.name"). */
function extractContextRef(ctx: unknown): string {
  const c = ctx as any;
  const parts = ["context"];
  parts.push(tok(c.IDENTIFIER?.()));
  const tail = c.contextTail?.();
  if (tail) {
    const ids = tail.IDENTIFIER?.() ?? [];
    for (const id of ids) parts.push(tok(id));
  }
  return parts.join(".");
}

function stripQuotes(s: string): string {
  if (!s || s.length < 2) return s;
  return s.slice(1, -1).replace(/\\(.)/g, "$1");
}
