import { CharStream, CommonTokenStream, BaseErrorListener } from "antlr4ng";
import { HaloLexer } from "./grammars/HaloLexer.js";
import { HaloParser, ProgramContext, DeclarationContext, AgentDeclContext, PipelineDeclContext, PolicyDeclContext, ToolDeclContext, StoreDeclContext, SchemaDeclContext, DirectiveContext, ParamListContext, PipelineContext, PipelineStageContext, CallExprContext, ConditionContext, FanoutStagesContext, ExpressionContext, ListenExprContext, LoopExprContext, YieldExprContext } from "./grammars/HaloParser.js";
import { HaloVisitor } from "./grammars/HaloVisitor.js";
import type { ParseResult, Agent, PipelineDeclaration, PolicyDeclaration, ToolDeclaration, StoreDeclaration, SchemaDeclaration, Directive, PipelineStage, ExpressionStage, CallStage, GateStage, InterruptStage, FanOutStage, ListenStage, LoopStage, PipelineParam } from "./types.js";
import { ParseError } from "../errors.js";

class CollectingErrorListener extends BaseErrorListener {
  errors: string[] = [];
  override syntaxError(recognizer: any, offendingSymbol: any, line: number, charPositionInLine: number, msg: string, e: any): void {
    const symbol = offendingSymbol as { text?: string };
    const tokenText = symbol?.text ?? "<missing>";
    this.errors.push(`[${line}:${charPositionInLine}] ${msg} near "${tokenText}"`);
  }
}

class HaloAstBuilder extends HaloVisitor<any> {
  result: ParseResult = {
    agents: [],
    pipelines: [],
    policies: [],
    tools: [],
    stores: [],
    schemas: [],
    errors: []
  };

  override visitProgram = (ctx: ProgramContext) => {
    if (ctx.declaration()) {
      for (const decl of ctx.declaration()) {
        this.visitDeclaration(decl);
      }
    }
    return this.result;
  };

  override visitDeclaration = (ctx: DeclarationContext) => {
    if (ctx.agentDecl()) this.result.agents.push(this.visitAgentDecl(ctx.agentDecl()!));
    else if (ctx.pipelineDecl()) this.result.pipelines.push(this.visitPipelineDecl(ctx.pipelineDecl()!));
    else if (ctx.policyDecl()) this.result.policies.push(this.visitPolicyDecl(ctx.policyDecl()!));
    else if (ctx.toolDecl()) this.result.tools.push(this.visitToolDecl(ctx.toolDecl()!));
    else if (ctx.storeDecl()) this.result.stores.push(this.visitStoreDecl(ctx.storeDecl()!));
    else if (ctx.schemaDecl()) this.result.schemas.push(this.visitSchemaDecl(ctx.schemaDecl()!));
  };

  override visitSchemaDecl = (ctx: SchemaDeclContext): SchemaDeclaration => {
    const name = ctx.IDENTIFIER().getText();
    const fieldsCtx = ctx.schemaFields();
    const fields = fieldsCtx ? fieldsCtx.schemaField().map(f => ({
      name: f.IDENTIFIER().getText(),
      type: f.typeRef().getText()
    })) : [];
    return { name, fields };
  };

  override visitPolicyDecl = (ctx: PolicyDeclContext): PolicyDeclaration => {
    const name = ctx.IDENTIFIER().getText();
    const rules = ctx.policyRule().map(r => {
      const ruleName = r.IDENTIFIER().getText();
      const argsCtx = r.policyArgs();
      const args = argsCtx ? argsCtx.policyArg().map(a => a.getText().replace(/^["']|["']$/g, "")) : [];
      return { name: ruleName, args };
    });
    return { name, rules };
  };

  override visitToolDecl = (ctx: ToolDeclContext): ToolDeclaration => {
    const name = ctx.IDENTIFIER(0)!.getText();
    const provider = ctx.IDENTIFIER(1)!.getText();
    const argsCtx = ctx.toolArgs();
    const args = argsCtx ? argsCtx.toolArg().map(a => a.getText().replace(/^["']|["']$/g, "")) : [];
    return { name, provider, args };
  };

  override visitStoreDecl = (ctx: StoreDeclContext): StoreDeclaration => {
    const name = ctx.IDENTIFIER(0)!.getText();
    const provider = ctx.IDENTIFIER(1)!.getText();
    const argsCtx = ctx.storeArgs();
    const args = argsCtx ? argsCtx.storeArg().map(a => a.getText().replace(/^["']|["']$/g, "")) : [];
    return { name, provider, args };
  };

  override visitAgentDecl = (ctx: AgentDeclContext): Agent => {
    const name = ctx.IDENTIFIER().getText();
    const directives = ctx.directive().map(d => this.visitDirective(d));
    
    const configCtx = ctx.modelConfig();
    const modelId = configCtx.modelId().getText();
    const params: Record<string, string> = {};
    for (const p of configCtx.modelParam()) {
      params[p.IDENTIFIER().getText()] = p.value().getText();
    }

    let equips: string[] = [];
    let requires: string[] = [];
    let system: string | undefined;
    
    const mods = ctx.agentModifiers();
    if (mods) {
      for (const m of mods.agentModifier()) {
        if (m.equipsList()) equips.push(...m.equipsList()!.IDENTIFIER().map(id => id.getText()));
        if (m.requiresList()) requires.push(...m.requiresList()!.IDENTIFIER().map(id => id.getText()));
        if (m.stringLiteral()) {
          const raw = m.stringLiteral()!.getText();
          // Strip triple-quote or single/double-quote delimiters
          system = raw.replace(/^"""|"""$/g, '').replace(/^["']|["']$/g, '').trim();
        }
      }
    }

    return { name, modelId, params, equips, requires, directives, system };
  };


  override visitDirective = (ctx: DirectiveContext): Directive => {
    const name = ctx.directiveName().getText();
    const valueCtx = ctx.directiveValue();
    let value = "";
    if (valueCtx) {
      const argsCtx = valueCtx.directiveArgs();
      if (argsCtx) {
        value = argsCtx.getText();
      }
    }
    return { name, value };
  };

  override visitPipelineDecl = (ctx: PipelineDeclContext): PipelineDeclaration => {
    const name = ctx.IDENTIFIER().getText();
    const directives = ctx.directive().map(d => this.visitDirective(d));
    
    const paramsCtx = ctx.paramList();
    const params: PipelineParam[] = paramsCtx ? paramsCtx.param().map(p => ({
      name: p.IDENTIFIER().getText(),
      type: p.typeRef().getText()
    })) : [];

    const returnType = ctx.typeRef().getText();
    
    const pipelineCtx = ctx.pipeline();
    const pipeline: PipelineStage[] = [];
    for (const st of pipelineCtx.pipelineStage()) {
      pipeline.push(this.visitPipelineStage(st));
    }

    return { name, params, returnType, pipeline, directives };
  };

  override visitPipelineStage = (ctx: PipelineStageContext): PipelineStage => {
    if (ctx.PIPE() && ctx.callExpr()) {
      return this.visitCallExpr(ctx.callExpr()!);
    } else if (ctx.GATE() && ctx.condition()) {
      return this.visitCondition(ctx.condition()!);
    } else if (ctx.FANOUT() && ctx.fanoutStages()) {
      return this.visitFanoutStages(ctx.fanoutStages()!);
    } else if (ctx.INTERRUPT() && ctx.yieldExpr()) {
      return this.visitYieldExpr(ctx.yieldExpr()!);
    } else if (ctx.LISTEN() && ctx.listenExpr()) {
      return this.visitListenExpr(ctx.listenExpr()!);
    } else if (ctx.LOOP() && ctx.loopExpr()) {
      return this.visitLoopExpr(ctx.loopExpr()!);
    } else if (ctx.expression()) {
      return this.visitExpression(ctx.expression()!);
    }
    throw new ParseError("Unknown pipeline stage");
  };

  override visitCallExpr = (ctx: CallExprContext): CallStage => {
    const callee = ctx.IDENTIFIER(0)!.getText();
    const method = ctx.IDENTIFIER(1)!.getText();
    const argsCtx = ctx.callArgs();
    const args: string[] = [];
    const namedArgs: Record<string, string> = {};
    
    if (argsCtx) {
      for (const arg of argsCtx.callArg()) {
        if (arg.idOrKeyword()) {
          namedArgs[arg.idOrKeyword()!.getText()] = arg.callValue().getText().replace(/^["']|["']$/g, "");
        } else {
          args.push(arg.callValue().getText().replace(/^["']|["']$/g, ""));
        }
      }
    }

    return { kind: "call", callee, method, args, namedArgs };
  };

  override visitCondition = (ctx: ConditionContext): GateStage => {
    return { kind: "gate", condition: ctx.conditionExpr().getText() };
  };

  override visitFanoutStages = (ctx: FanoutStagesContext): FanOutStage => {
    const stages: PipelineStage[] = [];
    for (const fs of ctx.fanoutStage()) {
      if (fs.callExpr()) {
        stages.push(this.visitCallExpr(fs.callExpr()!));
      } else if (fs.IDENTIFIER()) {
        stages.push({ kind: "expression", value: fs.IDENTIFIER()!.getText() });
      }
    }
    return { kind: "fanout", stages };
  };

  override visitYieldExpr = (ctx: YieldExprContext): InterruptStage => {
    const argsCtx = ctx.yieldArgs();
    const args: string[] = argsCtx ? argsCtx.yieldArg().map(a => a.getText()) : [];
    return { kind: "interrupt", callee: "yield", args };
  };

  override visitListenExpr = (ctx: ListenExprContext): ListenStage => {
    return { kind: "listen", target: ctx.listenTarget().getText() };
  };

  override visitLoopExpr = (ctx: LoopExprContext): LoopStage => {
    return { 
      kind: "loop", 
      target: ctx.IDENTIFIER()!.getText(), 
      condition: ctx.STRING()!.getText().replace(/^["']|["']$/g, "") 
    };
  };

  override visitExpression = (ctx: ExpressionContext): ExpressionStage => {
    return { kind: "expression", value: ctx.getText() };
  };
}

export function parse(source: string): ParseResult {
  const chars = CharStream.fromString(source);
  const lexer = new HaloLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new HaloParser(tokens);

  const errorListener = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(errorListener);
  parser.removeErrorListeners();
  parser.addErrorListener(errorListener);

  const tree = parser.program();
  
  if (errorListener.errors.length > 0) {
    return {
      agents: [],
      pipelines: [],
      policies: [],
      tools: [],
      stores: [],
      schemas: [],
      errors: errorListener.errors
    };
  }

  const builder = new HaloAstBuilder();
  const ast = builder.visitProgram(tree);
  ast.errors = errorListener.errors;
  return ast;
}

export * from './types.js';
