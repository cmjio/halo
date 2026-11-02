// Generated from grammars/Halo.g4 by ANTLR 4.13.1

import { AbstractParseTreeVisitor } from "antlr4ng";


import { ProgramContext } from "./HaloParser.js";
import { DeclarationContext } from "./HaloParser.js";
import { PolicyDeclContext } from "./HaloParser.js";
import { PolicyRuleContext } from "./HaloParser.js";
import { PolicyArgsContext } from "./HaloParser.js";
import { PolicyArgContext } from "./HaloParser.js";
import { IdOrKeywordContext } from "./HaloParser.js";
import { DottedIdContext } from "./HaloParser.js";
import { SchemaDeclContext } from "./HaloParser.js";
import { SchemaFieldsContext } from "./HaloParser.js";
import { SchemaFieldContext } from "./HaloParser.js";
import { ToolDeclContext } from "./HaloParser.js";
import { ToolArgsContext } from "./HaloParser.js";
import { ToolArgContext } from "./HaloParser.js";
import { StoreDeclContext } from "./HaloParser.js";
import { StoreArgsContext } from "./HaloParser.js";
import { StoreArgContext } from "./HaloParser.js";
import { AgentDeclContext } from "./HaloParser.js";
import { AgentModifiersContext } from "./HaloParser.js";
import { AgentModifierContext } from "./HaloParser.js";
import { StringLiteralContext } from "./HaloParser.js";
import { EquipsListContext } from "./HaloParser.js";
import { RequiresListContext } from "./HaloParser.js";
import { ModelConfigContext } from "./HaloParser.js";
import { ModelIdContext } from "./HaloParser.js";
import { ModelParamContext } from "./HaloParser.js";
import { PipelineDeclContext } from "./HaloParser.js";
import { DirectiveContext } from "./HaloParser.js";
import { DirectiveNameContext } from "./HaloParser.js";
import { DirectiveValueContext } from "./HaloParser.js";
import { DirectiveArgsContext } from "./HaloParser.js";
import { ParamListContext } from "./HaloParser.js";
import { ParamContext } from "./HaloParser.js";
import { TypeRefContext } from "./HaloParser.js";
import { TypeNameContext } from "./HaloParser.js";
import { PipelineContext } from "./HaloParser.js";
import { PipelineStageContext } from "./HaloParser.js";
import { ConditionContext } from "./HaloParser.js";
import { ConditionExprContext } from "./HaloParser.js";
import { ComparisonOpContext } from "./HaloParser.js";
import { FanoutStagesContext } from "./HaloParser.js";
import { FanoutStageContext } from "./HaloParser.js";
import { YieldExprContext } from "./HaloParser.js";
import { YieldArgsContext } from "./HaloParser.js";
import { YieldArgContext } from "./HaloParser.js";
import { YieldArgValueContext } from "./HaloParser.js";
import { ListenExprContext } from "./HaloParser.js";
import { ListenTargetContext } from "./HaloParser.js";
import { LoopExprContext } from "./HaloParser.js";
import { ExpressionContext } from "./HaloParser.js";
import { CallExprContext } from "./HaloParser.js";
import { CallArgsContext } from "./HaloParser.js";
import { CallArgContext } from "./HaloParser.js";
import { CallValueContext } from "./HaloParser.js";
import { CallItemsContext } from "./HaloParser.js";
import { ValueContext } from "./HaloParser.js";
import { ContextRefContext } from "./HaloParser.js";
import { ContextTailContext } from "./HaloParser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `HaloParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class HaloVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `HaloParser.program`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitProgram?: (ctx: ProgramContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.declaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclaration?: (ctx: DeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.policyDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPolicyDecl?: (ctx: PolicyDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.policyRule`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPolicyRule?: (ctx: PolicyRuleContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.policyArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPolicyArgs?: (ctx: PolicyArgsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.policyArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPolicyArg?: (ctx: PolicyArgContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.idOrKeyword`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIdOrKeyword?: (ctx: IdOrKeywordContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.dottedId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDottedId?: (ctx: DottedIdContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.schemaDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSchemaDecl?: (ctx: SchemaDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.schemaFields`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSchemaFields?: (ctx: SchemaFieldsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.schemaField`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSchemaField?: (ctx: SchemaFieldContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.toolDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitToolDecl?: (ctx: ToolDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.toolArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitToolArgs?: (ctx: ToolArgsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.toolArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitToolArg?: (ctx: ToolArgContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.storeDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStoreDecl?: (ctx: StoreDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.storeArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStoreArgs?: (ctx: StoreArgsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.storeArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStoreArg?: (ctx: StoreArgContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.agentDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAgentDecl?: (ctx: AgentDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.agentModifiers`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAgentModifiers?: (ctx: AgentModifiersContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.agentModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAgentModifier?: (ctx: AgentModifierContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.stringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStringLiteral?: (ctx: StringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.equipsList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEquipsList?: (ctx: EquipsListContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.requiresList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequiresList?: (ctx: RequiresListContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.modelConfig`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelConfig?: (ctx: ModelConfigContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.modelId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelId?: (ctx: ModelIdContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.modelParam`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelParam?: (ctx: ModelParamContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.pipelineDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipelineDecl?: (ctx: PipelineDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.directive`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirective?: (ctx: DirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.directiveName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirectiveName?: (ctx: DirectiveNameContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.directiveValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirectiveValue?: (ctx: DirectiveValueContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.directiveArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirectiveArgs?: (ctx: DirectiveArgsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.paramList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParamList?: (ctx: ParamListContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.param`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParam?: (ctx: ParamContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.typeRef`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeRef?: (ctx: TypeRefContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.typeName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeName?: (ctx: TypeNameContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.pipeline`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipeline?: (ctx: PipelineContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.pipelineStage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipelineStage?: (ctx: PipelineStageContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.condition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCondition?: (ctx: ConditionContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.conditionExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConditionExpr?: (ctx: ConditionExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.comparisonOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitComparisonOp?: (ctx: ComparisonOpContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.fanoutStages`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFanoutStages?: (ctx: FanoutStagesContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.fanoutStage`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFanoutStage?: (ctx: FanoutStageContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.yieldExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldExpr?: (ctx: YieldExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.yieldArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldArgs?: (ctx: YieldArgsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.yieldArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldArg?: (ctx: YieldArgContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.yieldArgValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitYieldArgValue?: (ctx: YieldArgValueContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.listenExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitListenExpr?: (ctx: ListenExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.listenTarget`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitListenTarget?: (ctx: ListenTargetContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.loopExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLoopExpr?: (ctx: LoopExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.callExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallExpr?: (ctx: CallExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.callArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallArgs?: (ctx: CallArgsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.callArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallArg?: (ctx: CallArgContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.callValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallValue?: (ctx: CallValueContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.callItems`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallItems?: (ctx: CallItemsContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.value`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValue?: (ctx: ValueContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.contextRef`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextRef?: (ctx: ContextRefContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.contextTail`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextTail?: (ctx: ContextTailContext) => Result;
}

