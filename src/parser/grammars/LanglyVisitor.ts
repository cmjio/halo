// Generated from grammars/Langly.g4 by ANTLR 4.13.1

import { AbstractParseTreeVisitor } from "antlr4ng";


import { ProgramContext } from "./LanglyParser.js";
import { DeclarationContext } from "./LanglyParser.js";
import { GuardrailDeclContext } from "./LanglyParser.js";
import { GuardrailRuleContext } from "./LanglyParser.js";
import { GuardrailArgsContext } from "./LanglyParser.js";
import { GuardrailArgContext } from "./LanglyParser.js";
import { DottedIdContext } from "./LanglyParser.js";
import { ToolDeclContext } from "./LanglyParser.js";
import { ToolArgsContext } from "./LanglyParser.js";
import { ToolArgContext } from "./LanglyParser.js";
import { MemoryDeclContext } from "./LanglyParser.js";
import { MemoryArgsContext } from "./LanglyParser.js";
import { MemoryArgContext } from "./LanglyParser.js";
import { MindDeclContext } from "./LanglyParser.js";
import { MindModifiersContext } from "./LanglyParser.js";
import { MindModifierContext } from "./LanglyParser.js";
import { EquipsListContext } from "./LanglyParser.js";
import { RequiresListContext } from "./LanglyParser.js";
import { ModelConfigContext } from "./LanglyParser.js";
import { ModelIdContext } from "./LanglyParser.js";
import { ModelParamContext } from "./LanglyParser.js";
import { StreamDeclContext } from "./LanglyParser.js";
import { DirectiveContext } from "./LanglyParser.js";
import { DirectiveNameContext } from "./LanglyParser.js";
import { DirectiveValueContext } from "./LanglyParser.js";
import { DirectiveArgsContext } from "./LanglyParser.js";
import { ParamListContext } from "./LanglyParser.js";
import { ParamContext } from "./LanglyParser.js";
import { TypeRefContext } from "./LanglyParser.js";
import { PipelineContext } from "./LanglyParser.js";
import { PipelineStageContext } from "./LanglyParser.js";
import { ConditionContext } from "./LanglyParser.js";
import { ConditionExprContext } from "./LanglyParser.js";
import { ContextRefContext } from "./LanglyParser.js";
import { ContextTailContext } from "./LanglyParser.js";
import { ComparisonOpContext } from "./LanglyParser.js";
import { FanoutStagesContext } from "./LanglyParser.js";
import { FanoutStageContext } from "./LanglyParser.js";
import { YieldExprContext } from "./LanglyParser.js";
import { YieldArgsContext } from "./LanglyParser.js";
import { YieldArgContext } from "./LanglyParser.js";
import { YieldArgValueContext } from "./LanglyParser.js";
import { ListenExprContext } from "./LanglyParser.js";
import { ListenTargetContext } from "./LanglyParser.js";
import { ExpressionContext } from "./LanglyParser.js";
import { CallExprContext } from "./LanglyParser.js";
import { CallArgsContext } from "./LanglyParser.js";
import { CallArgContext } from "./LanglyParser.js";
import { NamedCallArgContext } from "./LanglyParser.js";
import { CallValueContext } from "./LanglyParser.js";
import { CallItemsContext } from "./LanglyParser.js";
import { ValueContext } from "./LanglyParser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `LanglyParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class LanglyVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `LanglyParser.program`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitProgram?: (ctx: ProgramContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.declaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclaration?: (ctx: DeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.guardrailDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardrailDecl?: (ctx: GuardrailDeclContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.guardrailRule`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardrailRule?: (ctx: GuardrailRuleContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.guardrailArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardrailArgs?: (ctx: GuardrailArgsContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.guardrailArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGuardrailArg?: (ctx: GuardrailArgContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.dottedId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDottedId?: (ctx: DottedIdContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.toolDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitToolDecl?: (ctx: ToolDeclContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.toolArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitToolArgs?: (ctx: ToolArgsContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.toolArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitToolArg?: (ctx: ToolArgContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.memoryDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemoryDecl?: (ctx: MemoryDeclContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.memoryArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemoryArgs?: (ctx: MemoryArgsContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.memoryArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemoryArg?: (ctx: MemoryArgContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.mindDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMindDecl?: (ctx: MindDeclContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.mindModifiers`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMindModifiers?: (ctx: MindModifiersContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.mindModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMindModifier?: (ctx: MindModifierContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.equipsList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEquipsList?: (ctx: EquipsListContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.requiresList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequiresList?: (ctx: RequiresListContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.modelConfig`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelConfig?: (ctx: ModelConfigContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.modelId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelId?: (ctx: ModelIdContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.modelParam`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelParam?: (ctx: ModelParamContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.streamDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStreamDecl?: (ctx: StreamDeclContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.directive`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirective?: (ctx: DirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.directiveName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirectiveName?: (ctx: DirectiveNameContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.directiveValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirectiveValue?: (ctx: DirectiveValueContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.directiveArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirectiveArgs?: (ctx: DirectiveArgsContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.paramList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParamList?: (ctx: ParamListContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.param`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParam?: (ctx: ParamContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.typeRef`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeRef?: (ctx: TypeRefContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.pipeline`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipeline?: (ctx: PipelineContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.pipelineStage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipelineStage?: (ctx: PipelineStageContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.condition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCondition?: (ctx: ConditionContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.conditionExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConditionExpr?: (ctx: ConditionExprContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.contextRef`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextRef?: (ctx: ContextRefContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.contextTail`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextTail?: (ctx: ContextTailContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.comparisonOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitComparisonOp?: (ctx: ComparisonOpContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.fanoutStages`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFanoutStages?: (ctx: FanoutStagesContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.fanoutStage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFanoutStage?: (ctx: FanoutStageContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.yieldExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldExpr?: (ctx: YieldExprContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.yieldArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldArgs?: (ctx: YieldArgsContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.yieldArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldArg?: (ctx: YieldArgContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.yieldArgValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldArgValue?: (ctx: YieldArgValueContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.listenExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitListenExpr?: (ctx: ListenExprContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.listenTarget`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitListenTarget?: (ctx: ListenTargetContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.callExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallExpr?: (ctx: CallExprContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.callArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallArgs?: (ctx: CallArgsContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.callArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallArg?: (ctx: CallArgContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.namedCallArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamedCallArg?: (ctx: NamedCallArgContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.callValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallValue?: (ctx: CallValueContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.callItems`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallItems?: (ctx: CallItemsContext) => Result;
    /**
     * Visit a parse tree produced by `LanglyParser.value`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValue?: (ctx: ValueContext) => Result;
}

