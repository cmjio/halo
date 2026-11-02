// Generated from grammars/Halo.g4 by ANTLR 4.13.1

import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


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
 * This interface defines a complete listener for a parse tree produced by
 * `HaloParser`.
 */
export class HaloListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `HaloParser.program`.
     * @param ctx the parse tree
     */
    enterProgram?: (ctx: ProgramContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.program`.
     * @param ctx the parse tree
     */
    exitProgram?: (ctx: ProgramContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.declaration`.
     * @param ctx the parse tree
     */
    enterDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.declaration`.
     * @param ctx the parse tree
     */
    exitDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.policyDecl`.
     * @param ctx the parse tree
     */
    enterPolicyDecl?: (ctx: PolicyDeclContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.policyDecl`.
     * @param ctx the parse tree
     */
    exitPolicyDecl?: (ctx: PolicyDeclContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.policyRule`.
     * @param ctx the parse tree
     */
    enterPolicyRule?: (ctx: PolicyRuleContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.policyRule`.
     * @param ctx the parse tree
     */
    exitPolicyRule?: (ctx: PolicyRuleContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.policyArgs`.
     * @param ctx the parse tree
     */
    enterPolicyArgs?: (ctx: PolicyArgsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.policyArgs`.
     * @param ctx the parse tree
     */
    exitPolicyArgs?: (ctx: PolicyArgsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.policyArg`.
     * @param ctx the parse tree
     */
    enterPolicyArg?: (ctx: PolicyArgContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.policyArg`.
     * @param ctx the parse tree
     */
    exitPolicyArg?: (ctx: PolicyArgContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.idOrKeyword`.
     * @param ctx the parse tree
     */
    enterIdOrKeyword?: (ctx: IdOrKeywordContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.idOrKeyword`.
     * @param ctx the parse tree
     */
    exitIdOrKeyword?: (ctx: IdOrKeywordContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.dottedId`.
     * @param ctx the parse tree
     */
    enterDottedId?: (ctx: DottedIdContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.dottedId`.
     * @param ctx the parse tree
     */
    exitDottedId?: (ctx: DottedIdContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.schemaDecl`.
     * @param ctx the parse tree
     */
    enterSchemaDecl?: (ctx: SchemaDeclContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.schemaDecl`.
     * @param ctx the parse tree
     */
    exitSchemaDecl?: (ctx: SchemaDeclContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.schemaFields`.
     * @param ctx the parse tree
     */
    enterSchemaFields?: (ctx: SchemaFieldsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.schemaFields`.
     * @param ctx the parse tree
     */
    exitSchemaFields?: (ctx: SchemaFieldsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.schemaField`.
     * @param ctx the parse tree
     */
    enterSchemaField?: (ctx: SchemaFieldContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.schemaField`.
     * @param ctx the parse tree
     */
    exitSchemaField?: (ctx: SchemaFieldContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.toolDecl`.
     * @param ctx the parse tree
     */
    enterToolDecl?: (ctx: ToolDeclContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.toolDecl`.
     * @param ctx the parse tree
     */
    exitToolDecl?: (ctx: ToolDeclContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.toolArgs`.
     * @param ctx the parse tree
     */
    enterToolArgs?: (ctx: ToolArgsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.toolArgs`.
     * @param ctx the parse tree
     */
    exitToolArgs?: (ctx: ToolArgsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.toolArg`.
     * @param ctx the parse tree
     */
    enterToolArg?: (ctx: ToolArgContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.toolArg`.
     * @param ctx the parse tree
     */
    exitToolArg?: (ctx: ToolArgContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.storeDecl`.
     * @param ctx the parse tree
     */
    enterStoreDecl?: (ctx: StoreDeclContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.storeDecl`.
     * @param ctx the parse tree
     */
    exitStoreDecl?: (ctx: StoreDeclContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.storeArgs`.
     * @param ctx the parse tree
     */
    enterStoreArgs?: (ctx: StoreArgsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.storeArgs`.
     * @param ctx the parse tree
     */
    exitStoreArgs?: (ctx: StoreArgsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.storeArg`.
     * @param ctx the parse tree
     */
    enterStoreArg?: (ctx: StoreArgContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.storeArg`.
     * @param ctx the parse tree
     */
    exitStoreArg?: (ctx: StoreArgContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.agentDecl`.
     * @param ctx the parse tree
     */
    enterAgentDecl?: (ctx: AgentDeclContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.agentDecl`.
     * @param ctx the parse tree
     */
    exitAgentDecl?: (ctx: AgentDeclContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.agentModifiers`.
     * @param ctx the parse tree
     */
    enterAgentModifiers?: (ctx: AgentModifiersContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.agentModifiers`.
     * @param ctx the parse tree
     */
    exitAgentModifiers?: (ctx: AgentModifiersContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.agentModifier`.
     * @param ctx the parse tree
     */
    enterAgentModifier?: (ctx: AgentModifierContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.agentModifier`.
     * @param ctx the parse tree
     */
    exitAgentModifier?: (ctx: AgentModifierContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.stringLiteral`.
     * @param ctx the parse tree
     */
    enterStringLiteral?: (ctx: StringLiteralContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.stringLiteral`.
     * @param ctx the parse tree
     */
    exitStringLiteral?: (ctx: StringLiteralContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.equipsList`.
     * @param ctx the parse tree
     */
    enterEquipsList?: (ctx: EquipsListContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.equipsList`.
     * @param ctx the parse tree
     */
    exitEquipsList?: (ctx: EquipsListContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.requiresList`.
     * @param ctx the parse tree
     */
    enterRequiresList?: (ctx: RequiresListContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.requiresList`.
     * @param ctx the parse tree
     */
    exitRequiresList?: (ctx: RequiresListContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.modelConfig`.
     * @param ctx the parse tree
     */
    enterModelConfig?: (ctx: ModelConfigContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.modelConfig`.
     * @param ctx the parse tree
     */
    exitModelConfig?: (ctx: ModelConfigContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.modelId`.
     * @param ctx the parse tree
     */
    enterModelId?: (ctx: ModelIdContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.modelId`.
     * @param ctx the parse tree
     */
    exitModelId?: (ctx: ModelIdContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.modelParam`.
     * @param ctx the parse tree
     */
    enterModelParam?: (ctx: ModelParamContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.modelParam`.
     * @param ctx the parse tree
     */
    exitModelParam?: (ctx: ModelParamContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.pipelineDecl`.
     * @param ctx the parse tree
     */
    enterPipelineDecl?: (ctx: PipelineDeclContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.pipelineDecl`.
     * @param ctx the parse tree
     */
    exitPipelineDecl?: (ctx: PipelineDeclContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.directive`.
     * @param ctx the parse tree
     */
    enterDirective?: (ctx: DirectiveContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.directive`.
     * @param ctx the parse tree
     */
    exitDirective?: (ctx: DirectiveContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.directiveName`.
     * @param ctx the parse tree
     */
    enterDirectiveName?: (ctx: DirectiveNameContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.directiveName`.
     * @param ctx the parse tree
     */
    exitDirectiveName?: (ctx: DirectiveNameContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.directiveValue`.
     * @param ctx the parse tree
     */
    enterDirectiveValue?: (ctx: DirectiveValueContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.directiveValue`.
     * @param ctx the parse tree
     */
    exitDirectiveValue?: (ctx: DirectiveValueContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.directiveArgs`.
     * @param ctx the parse tree
     */
    enterDirectiveArgs?: (ctx: DirectiveArgsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.directiveArgs`.
     * @param ctx the parse tree
     */
    exitDirectiveArgs?: (ctx: DirectiveArgsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.paramList`.
     * @param ctx the parse tree
     */
    enterParamList?: (ctx: ParamListContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.paramList`.
     * @param ctx the parse tree
     */
    exitParamList?: (ctx: ParamListContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.param`.
     * @param ctx the parse tree
     */
    enterParam?: (ctx: ParamContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.param`.
     * @param ctx the parse tree
     */
    exitParam?: (ctx: ParamContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.typeRef`.
     * @param ctx the parse tree
     */
    enterTypeRef?: (ctx: TypeRefContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.typeRef`.
     * @param ctx the parse tree
     */
    exitTypeRef?: (ctx: TypeRefContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.typeName`.
     * @param ctx the parse tree
     */
    enterTypeName?: (ctx: TypeNameContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.typeName`.
     * @param ctx the parse tree
     */
    exitTypeName?: (ctx: TypeNameContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.pipeline`.
     * @param ctx the parse tree
     */
    enterPipeline?: (ctx: PipelineContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.pipeline`.
     * @param ctx the parse tree
     */
    exitPipeline?: (ctx: PipelineContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.pipelineStage`.
     * @param ctx the parse tree
     */
    enterPipelineStage?: (ctx: PipelineStageContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.pipelineStage`.
     * @param ctx the parse tree
     */
    exitPipelineStage?: (ctx: PipelineStageContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.condition`.
     * @param ctx the parse tree
     */
    enterCondition?: (ctx: ConditionContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.condition`.
     * @param ctx the parse tree
     */
    exitCondition?: (ctx: ConditionContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.conditionExpr`.
     * @param ctx the parse tree
     */
    enterConditionExpr?: (ctx: ConditionExprContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.conditionExpr`.
     * @param ctx the parse tree
     */
    exitConditionExpr?: (ctx: ConditionExprContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.comparisonOp`.
     * @param ctx the parse tree
     */
    enterComparisonOp?: (ctx: ComparisonOpContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.comparisonOp`.
     * @param ctx the parse tree
     */
    exitComparisonOp?: (ctx: ComparisonOpContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.fanoutStages`.
     * @param ctx the parse tree
     */
    enterFanoutStages?: (ctx: FanoutStagesContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.fanoutStages`.
     * @param ctx the parse tree
     */
    exitFanoutStages?: (ctx: FanoutStagesContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.fanoutStage`.
     * @param ctx the parse tree
     */
    enterFanoutStage?: (ctx: FanoutStageContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.fanoutStage`.
     * @param ctx the parse tree
     */
    exitFanoutStage?: (ctx: FanoutStageContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.yieldExpr`.
     * @param ctx the parse tree
     */
    enterYieldExpr?: (ctx: YieldExprContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.yieldExpr`.
     * @param ctx the parse tree
     */
    exitYieldExpr?: (ctx: YieldExprContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.yieldArgs`.
     * @param ctx the parse tree
     */
    enterYieldArgs?: (ctx: YieldArgsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.yieldArgs`.
     * @param ctx the parse tree
     */
    exitYieldArgs?: (ctx: YieldArgsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.yieldArg`.
     * @param ctx the parse tree
     */
    enterYieldArg?: (ctx: YieldArgContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.yieldArg`.
     * @param ctx the parse tree
     */
    exitYieldArg?: (ctx: YieldArgContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.yieldArgValue`.
     * @param ctx the parse tree
     */
    enterYieldArgValue?: (ctx: YieldArgValueContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.yieldArgValue`.
     * @param ctx the parse tree
     */
    exitYieldArgValue?: (ctx: YieldArgValueContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.listenExpr`.
     * @param ctx the parse tree
     */
    enterListenExpr?: (ctx: ListenExprContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.listenExpr`.
     * @param ctx the parse tree
     */
    exitListenExpr?: (ctx: ListenExprContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.listenTarget`.
     * @param ctx the parse tree
     */
    enterListenTarget?: (ctx: ListenTargetContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.listenTarget`.
     * @param ctx the parse tree
     */
    exitListenTarget?: (ctx: ListenTargetContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.loopExpr`.
     * @param ctx the parse tree
     */
    enterLoopExpr?: (ctx: LoopExprContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.loopExpr`.
     * @param ctx the parse tree
     */
    exitLoopExpr?: (ctx: LoopExprContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.expression`.
     * @param ctx the parse tree
     */
    enterExpression?: (ctx: ExpressionContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.expression`.
     * @param ctx the parse tree
     */
    exitExpression?: (ctx: ExpressionContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.callExpr`.
     * @param ctx the parse tree
     */
    enterCallExpr?: (ctx: CallExprContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.callExpr`.
     * @param ctx the parse tree
     */
    exitCallExpr?: (ctx: CallExprContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.callArgs`.
     * @param ctx the parse tree
     */
    enterCallArgs?: (ctx: CallArgsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.callArgs`.
     * @param ctx the parse tree
     */
    exitCallArgs?: (ctx: CallArgsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.callArg`.
     * @param ctx the parse tree
     */
    enterCallArg?: (ctx: CallArgContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.callArg`.
     * @param ctx the parse tree
     */
    exitCallArg?: (ctx: CallArgContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.callValue`.
     * @param ctx the parse tree
     */
    enterCallValue?: (ctx: CallValueContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.callValue`.
     * @param ctx the parse tree
     */
    exitCallValue?: (ctx: CallValueContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.callItems`.
     * @param ctx the parse tree
     */
    enterCallItems?: (ctx: CallItemsContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.callItems`.
     * @param ctx the parse tree
     */
    exitCallItems?: (ctx: CallItemsContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.value`.
     * @param ctx the parse tree
     */
    enterValue?: (ctx: ValueContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.value`.
     * @param ctx the parse tree
     */
    exitValue?: (ctx: ValueContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.contextRef`.
     * @param ctx the parse tree
     */
    enterContextRef?: (ctx: ContextRefContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.contextRef`.
     * @param ctx the parse tree
     */
    exitContextRef?: (ctx: ContextRefContext) => void;
    /**
     * Enter a parse tree produced by `HaloParser.contextTail`.
     * @param ctx the parse tree
     */
    enterContextTail?: (ctx: ContextTailContext) => void;
    /**
     * Exit a parse tree produced by `HaloParser.contextTail`.
     * @param ctx the parse tree
     */
    exitContextTail?: (ctx: ContextTailContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

