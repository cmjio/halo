// Generated from grammars/Langly.g4 by ANTLR 4.13.1

import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


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
import { CallValueContext } from "./LanglyParser.js";
import { CallItemsContext } from "./LanglyParser.js";
import { ValueContext } from "./LanglyParser.js";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `LanglyParser`.
 */
export class LanglyListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `LanglyParser.program`.
     * @param ctx the parse tree
     */
    enterProgram?: (ctx: ProgramContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.program`.
     * @param ctx the parse tree
     */
    exitProgram?: (ctx: ProgramContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.declaration`.
     * @param ctx the parse tree
     */
    enterDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.declaration`.
     * @param ctx the parse tree
     */
    exitDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.guardrailDecl`.
     * @param ctx the parse tree
     */
    enterGuardrailDecl?: (ctx: GuardrailDeclContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.guardrailDecl`.
     * @param ctx the parse tree
     */
    exitGuardrailDecl?: (ctx: GuardrailDeclContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.guardrailRule`.
     * @param ctx the parse tree
     */
    enterGuardrailRule?: (ctx: GuardrailRuleContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.guardrailRule`.
     * @param ctx the parse tree
     */
    exitGuardrailRule?: (ctx: GuardrailRuleContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.guardrailArgs`.
     * @param ctx the parse tree
     */
    enterGuardrailArgs?: (ctx: GuardrailArgsContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.guardrailArgs`.
     * @param ctx the parse tree
     */
    exitGuardrailArgs?: (ctx: GuardrailArgsContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.guardrailArg`.
     * @param ctx the parse tree
     */
    enterGuardrailArg?: (ctx: GuardrailArgContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.guardrailArg`.
     * @param ctx the parse tree
     */
    exitGuardrailArg?: (ctx: GuardrailArgContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.dottedId`.
     * @param ctx the parse tree
     */
    enterDottedId?: (ctx: DottedIdContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.dottedId`.
     * @param ctx the parse tree
     */
    exitDottedId?: (ctx: DottedIdContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.toolDecl`.
     * @param ctx the parse tree
     */
    enterToolDecl?: (ctx: ToolDeclContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.toolDecl`.
     * @param ctx the parse tree
     */
    exitToolDecl?: (ctx: ToolDeclContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.toolArgs`.
     * @param ctx the parse tree
     */
    enterToolArgs?: (ctx: ToolArgsContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.toolArgs`.
     * @param ctx the parse tree
     */
    exitToolArgs?: (ctx: ToolArgsContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.toolArg`.
     * @param ctx the parse tree
     */
    enterToolArg?: (ctx: ToolArgContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.toolArg`.
     * @param ctx the parse tree
     */
    exitToolArg?: (ctx: ToolArgContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.memoryDecl`.
     * @param ctx the parse tree
     */
    enterMemoryDecl?: (ctx: MemoryDeclContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.memoryDecl`.
     * @param ctx the parse tree
     */
    exitMemoryDecl?: (ctx: MemoryDeclContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.memoryArgs`.
     * @param ctx the parse tree
     */
    enterMemoryArgs?: (ctx: MemoryArgsContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.memoryArgs`.
     * @param ctx the parse tree
     */
    exitMemoryArgs?: (ctx: MemoryArgsContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.memoryArg`.
     * @param ctx the parse tree
     */
    enterMemoryArg?: (ctx: MemoryArgContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.memoryArg`.
     * @param ctx the parse tree
     */
    exitMemoryArg?: (ctx: MemoryArgContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.mindDecl`.
     * @param ctx the parse tree
     */
    enterMindDecl?: (ctx: MindDeclContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.mindDecl`.
     * @param ctx the parse tree
     */
    exitMindDecl?: (ctx: MindDeclContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.mindModifiers`.
     * @param ctx the parse tree
     */
    enterMindModifiers?: (ctx: MindModifiersContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.mindModifiers`.
     * @param ctx the parse tree
     */
    exitMindModifiers?: (ctx: MindModifiersContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.mindModifier`.
     * @param ctx the parse tree
     */
    enterMindModifier?: (ctx: MindModifierContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.mindModifier`.
     * @param ctx the parse tree
     */
    exitMindModifier?: (ctx: MindModifierContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.equipsList`.
     * @param ctx the parse tree
     */
    enterEquipsList?: (ctx: EquipsListContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.equipsList`.
     * @param ctx the parse tree
     */
    exitEquipsList?: (ctx: EquipsListContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.requiresList`.
     * @param ctx the parse tree
     */
    enterRequiresList?: (ctx: RequiresListContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.requiresList`.
     * @param ctx the parse tree
     */
    exitRequiresList?: (ctx: RequiresListContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.modelConfig`.
     * @param ctx the parse tree
     */
    enterModelConfig?: (ctx: ModelConfigContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.modelConfig`.
     * @param ctx the parse tree
     */
    exitModelConfig?: (ctx: ModelConfigContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.modelId`.
     * @param ctx the parse tree
     */
    enterModelId?: (ctx: ModelIdContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.modelId`.
     * @param ctx the parse tree
     */
    exitModelId?: (ctx: ModelIdContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.modelParam`.
     * @param ctx the parse tree
     */
    enterModelParam?: (ctx: ModelParamContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.modelParam`.
     * @param ctx the parse tree
     */
    exitModelParam?: (ctx: ModelParamContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.streamDecl`.
     * @param ctx the parse tree
     */
    enterStreamDecl?: (ctx: StreamDeclContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.streamDecl`.
     * @param ctx the parse tree
     */
    exitStreamDecl?: (ctx: StreamDeclContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.directive`.
     * @param ctx the parse tree
     */
    enterDirective?: (ctx: DirectiveContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.directive`.
     * @param ctx the parse tree
     */
    exitDirective?: (ctx: DirectiveContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.directiveName`.
     * @param ctx the parse tree
     */
    enterDirectiveName?: (ctx: DirectiveNameContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.directiveName`.
     * @param ctx the parse tree
     */
    exitDirectiveName?: (ctx: DirectiveNameContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.directiveValue`.
     * @param ctx the parse tree
     */
    enterDirectiveValue?: (ctx: DirectiveValueContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.directiveValue`.
     * @param ctx the parse tree
     */
    exitDirectiveValue?: (ctx: DirectiveValueContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.directiveArgs`.
     * @param ctx the parse tree
     */
    enterDirectiveArgs?: (ctx: DirectiveArgsContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.directiveArgs`.
     * @param ctx the parse tree
     */
    exitDirectiveArgs?: (ctx: DirectiveArgsContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.paramList`.
     * @param ctx the parse tree
     */
    enterParamList?: (ctx: ParamListContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.paramList`.
     * @param ctx the parse tree
     */
    exitParamList?: (ctx: ParamListContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.param`.
     * @param ctx the parse tree
     */
    enterParam?: (ctx: ParamContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.param`.
     * @param ctx the parse tree
     */
    exitParam?: (ctx: ParamContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.typeRef`.
     * @param ctx the parse tree
     */
    enterTypeRef?: (ctx: TypeRefContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.typeRef`.
     * @param ctx the parse tree
     */
    exitTypeRef?: (ctx: TypeRefContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.pipeline`.
     * @param ctx the parse tree
     */
    enterPipeline?: (ctx: PipelineContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.pipeline`.
     * @param ctx the parse tree
     */
    exitPipeline?: (ctx: PipelineContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.pipelineStage`.
     * @param ctx the parse tree
     */
    enterPipelineStage?: (ctx: PipelineStageContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.pipelineStage`.
     * @param ctx the parse tree
     */
    exitPipelineStage?: (ctx: PipelineStageContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.condition`.
     * @param ctx the parse tree
     */
    enterCondition?: (ctx: ConditionContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.condition`.
     * @param ctx the parse tree
     */
    exitCondition?: (ctx: ConditionContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.conditionExpr`.
     * @param ctx the parse tree
     */
    enterConditionExpr?: (ctx: ConditionExprContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.conditionExpr`.
     * @param ctx the parse tree
     */
    exitConditionExpr?: (ctx: ConditionExprContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.contextRef`.
     * @param ctx the parse tree
     */
    enterContextRef?: (ctx: ContextRefContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.contextRef`.
     * @param ctx the parse tree
     */
    exitContextRef?: (ctx: ContextRefContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.contextTail`.
     * @param ctx the parse tree
     */
    enterContextTail?: (ctx: ContextTailContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.contextTail`.
     * @param ctx the parse tree
     */
    exitContextTail?: (ctx: ContextTailContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.comparisonOp`.
     * @param ctx the parse tree
     */
    enterComparisonOp?: (ctx: ComparisonOpContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.comparisonOp`.
     * @param ctx the parse tree
     */
    exitComparisonOp?: (ctx: ComparisonOpContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.fanoutStages`.
     * @param ctx the parse tree
     */
    enterFanoutStages?: (ctx: FanoutStagesContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.fanoutStages`.
     * @param ctx the parse tree
     */
    exitFanoutStages?: (ctx: FanoutStagesContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.fanoutStage`.
     * @param ctx the parse tree
     */
    enterFanoutStage?: (ctx: FanoutStageContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.fanoutStage`.
     * @param ctx the parse tree
     */
    exitFanoutStage?: (ctx: FanoutStageContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.yieldExpr`.
     * @param ctx the parse tree
     */
    enterYieldExpr?: (ctx: YieldExprContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.yieldExpr`.
     * @param ctx the parse tree
     */
    exitYieldExpr?: (ctx: YieldExprContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.yieldArgs`.
     * @param ctx the parse tree
     */
    enterYieldArgs?: (ctx: YieldArgsContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.yieldArgs`.
     * @param ctx the parse tree
     */
    exitYieldArgs?: (ctx: YieldArgsContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.yieldArg`.
     * @param ctx the parse tree
     */
    enterYieldArg?: (ctx: YieldArgContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.yieldArg`.
     * @param ctx the parse tree
     */
    exitYieldArg?: (ctx: YieldArgContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.yieldArgValue`.
     * @param ctx the parse tree
     */
    enterYieldArgValue?: (ctx: YieldArgValueContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.yieldArgValue`.
     * @param ctx the parse tree
     */
    exitYieldArgValue?: (ctx: YieldArgValueContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.listenExpr`.
     * @param ctx the parse tree
     */
    enterListenExpr?: (ctx: ListenExprContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.listenExpr`.
     * @param ctx the parse tree
     */
    exitListenExpr?: (ctx: ListenExprContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.listenTarget`.
     * @param ctx the parse tree
     */
    enterListenTarget?: (ctx: ListenTargetContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.listenTarget`.
     * @param ctx the parse tree
     */
    exitListenTarget?: (ctx: ListenTargetContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.expression`.
     * @param ctx the parse tree
     */
    enterExpression?: (ctx: ExpressionContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.expression`.
     * @param ctx the parse tree
     */
    exitExpression?: (ctx: ExpressionContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.callExpr`.
     * @param ctx the parse tree
     */
    enterCallExpr?: (ctx: CallExprContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.callExpr`.
     * @param ctx the parse tree
     */
    exitCallExpr?: (ctx: CallExprContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.callArgs`.
     * @param ctx the parse tree
     */
    enterCallArgs?: (ctx: CallArgsContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.callArgs`.
     * @param ctx the parse tree
     */
    exitCallArgs?: (ctx: CallArgsContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.callArg`.
     * @param ctx the parse tree
     */
    enterCallArg?: (ctx: CallArgContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.callArg`.
     * @param ctx the parse tree
     */
    exitCallArg?: (ctx: CallArgContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.callValue`.
     * @param ctx the parse tree
     */
    enterCallValue?: (ctx: CallValueContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.callValue`.
     * @param ctx the parse tree
     */
    exitCallValue?: (ctx: CallValueContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.callItems`.
     * @param ctx the parse tree
     */
    enterCallItems?: (ctx: CallItemsContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.callItems`.
     * @param ctx the parse tree
     */
    exitCallItems?: (ctx: CallItemsContext) => void;
    /**
     * Enter a parse tree produced by `LanglyParser.value`.
     * @param ctx the parse tree
     */
    enterValue?: (ctx: ValueContext) => void;
    /**
     * Exit a parse tree produced by `LanglyParser.value`.
     * @param ctx the parse tree
     */
    exitValue?: (ctx: ValueContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

