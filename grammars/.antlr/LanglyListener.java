// Generated from /Users/cmj/projects/oneshots/langly/grammars/Langly.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link LanglyParser}.
 */
public interface LanglyListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by {@link LanglyParser#program}.
	 * @param ctx the parse tree
	 */
	void enterProgram(LanglyParser.ProgramContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#program}.
	 * @param ctx the parse tree
	 */
	void exitProgram(LanglyParser.ProgramContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#declaration}.
	 * @param ctx the parse tree
	 */
	void enterDeclaration(LanglyParser.DeclarationContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#declaration}.
	 * @param ctx the parse tree
	 */
	void exitDeclaration(LanglyParser.DeclarationContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#guardrailDecl}.
	 * @param ctx the parse tree
	 */
	void enterGuardrailDecl(LanglyParser.GuardrailDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#guardrailDecl}.
	 * @param ctx the parse tree
	 */
	void exitGuardrailDecl(LanglyParser.GuardrailDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#guardrailRule}.
	 * @param ctx the parse tree
	 */
	void enterGuardrailRule(LanglyParser.GuardrailRuleContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#guardrailRule}.
	 * @param ctx the parse tree
	 */
	void exitGuardrailRule(LanglyParser.GuardrailRuleContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#guardrailArgs}.
	 * @param ctx the parse tree
	 */
	void enterGuardrailArgs(LanglyParser.GuardrailArgsContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#guardrailArgs}.
	 * @param ctx the parse tree
	 */
	void exitGuardrailArgs(LanglyParser.GuardrailArgsContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#guardrailArg}.
	 * @param ctx the parse tree
	 */
	void enterGuardrailArg(LanglyParser.GuardrailArgContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#guardrailArg}.
	 * @param ctx the parse tree
	 */
	void exitGuardrailArg(LanglyParser.GuardrailArgContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#dottedId}.
	 * @param ctx the parse tree
	 */
	void enterDottedId(LanglyParser.DottedIdContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#dottedId}.
	 * @param ctx the parse tree
	 */
	void exitDottedId(LanglyParser.DottedIdContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#toolDecl}.
	 * @param ctx the parse tree
	 */
	void enterToolDecl(LanglyParser.ToolDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#toolDecl}.
	 * @param ctx the parse tree
	 */
	void exitToolDecl(LanglyParser.ToolDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#toolArgs}.
	 * @param ctx the parse tree
	 */
	void enterToolArgs(LanglyParser.ToolArgsContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#toolArgs}.
	 * @param ctx the parse tree
	 */
	void exitToolArgs(LanglyParser.ToolArgsContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#toolArg}.
	 * @param ctx the parse tree
	 */
	void enterToolArg(LanglyParser.ToolArgContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#toolArg}.
	 * @param ctx the parse tree
	 */
	void exitToolArg(LanglyParser.ToolArgContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#memoryDecl}.
	 * @param ctx the parse tree
	 */
	void enterMemoryDecl(LanglyParser.MemoryDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#memoryDecl}.
	 * @param ctx the parse tree
	 */
	void exitMemoryDecl(LanglyParser.MemoryDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#memoryArgs}.
	 * @param ctx the parse tree
	 */
	void enterMemoryArgs(LanglyParser.MemoryArgsContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#memoryArgs}.
	 * @param ctx the parse tree
	 */
	void exitMemoryArgs(LanglyParser.MemoryArgsContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#memoryArg}.
	 * @param ctx the parse tree
	 */
	void enterMemoryArg(LanglyParser.MemoryArgContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#memoryArg}.
	 * @param ctx the parse tree
	 */
	void exitMemoryArg(LanglyParser.MemoryArgContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#mindDecl}.
	 * @param ctx the parse tree
	 */
	void enterMindDecl(LanglyParser.MindDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#mindDecl}.
	 * @param ctx the parse tree
	 */
	void exitMindDecl(LanglyParser.MindDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#mindModifiers}.
	 * @param ctx the parse tree
	 */
	void enterMindModifiers(LanglyParser.MindModifiersContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#mindModifiers}.
	 * @param ctx the parse tree
	 */
	void exitMindModifiers(LanglyParser.MindModifiersContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#mindModifier}.
	 * @param ctx the parse tree
	 */
	void enterMindModifier(LanglyParser.MindModifierContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#mindModifier}.
	 * @param ctx the parse tree
	 */
	void exitMindModifier(LanglyParser.MindModifierContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#equipsList}.
	 * @param ctx the parse tree
	 */
	void enterEquipsList(LanglyParser.EquipsListContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#equipsList}.
	 * @param ctx the parse tree
	 */
	void exitEquipsList(LanglyParser.EquipsListContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#requiresList}.
	 * @param ctx the parse tree
	 */
	void enterRequiresList(LanglyParser.RequiresListContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#requiresList}.
	 * @param ctx the parse tree
	 */
	void exitRequiresList(LanglyParser.RequiresListContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#modelConfig}.
	 * @param ctx the parse tree
	 */
	void enterModelConfig(LanglyParser.ModelConfigContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#modelConfig}.
	 * @param ctx the parse tree
	 */
	void exitModelConfig(LanglyParser.ModelConfigContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#modelId}.
	 * @param ctx the parse tree
	 */
	void enterModelId(LanglyParser.ModelIdContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#modelId}.
	 * @param ctx the parse tree
	 */
	void exitModelId(LanglyParser.ModelIdContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#modelParam}.
	 * @param ctx the parse tree
	 */
	void enterModelParam(LanglyParser.ModelParamContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#modelParam}.
	 * @param ctx the parse tree
	 */
	void exitModelParam(LanglyParser.ModelParamContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#streamDecl}.
	 * @param ctx the parse tree
	 */
	void enterStreamDecl(LanglyParser.StreamDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#streamDecl}.
	 * @param ctx the parse tree
	 */
	void exitStreamDecl(LanglyParser.StreamDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#directive}.
	 * @param ctx the parse tree
	 */
	void enterDirective(LanglyParser.DirectiveContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#directive}.
	 * @param ctx the parse tree
	 */
	void exitDirective(LanglyParser.DirectiveContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#directiveName}.
	 * @param ctx the parse tree
	 */
	void enterDirectiveName(LanglyParser.DirectiveNameContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#directiveName}.
	 * @param ctx the parse tree
	 */
	void exitDirectiveName(LanglyParser.DirectiveNameContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#directiveValue}.
	 * @param ctx the parse tree
	 */
	void enterDirectiveValue(LanglyParser.DirectiveValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#directiveValue}.
	 * @param ctx the parse tree
	 */
	void exitDirectiveValue(LanglyParser.DirectiveValueContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#directiveArgs}.
	 * @param ctx the parse tree
	 */
	void enterDirectiveArgs(LanglyParser.DirectiveArgsContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#directiveArgs}.
	 * @param ctx the parse tree
	 */
	void exitDirectiveArgs(LanglyParser.DirectiveArgsContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#paramList}.
	 * @param ctx the parse tree
	 */
	void enterParamList(LanglyParser.ParamListContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#paramList}.
	 * @param ctx the parse tree
	 */
	void exitParamList(LanglyParser.ParamListContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#param}.
	 * @param ctx the parse tree
	 */
	void enterParam(LanglyParser.ParamContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#param}.
	 * @param ctx the parse tree
	 */
	void exitParam(LanglyParser.ParamContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#typeRef}.
	 * @param ctx the parse tree
	 */
	void enterTypeRef(LanglyParser.TypeRefContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#typeRef}.
	 * @param ctx the parse tree
	 */
	void exitTypeRef(LanglyParser.TypeRefContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#pipeline}.
	 * @param ctx the parse tree
	 */
	void enterPipeline(LanglyParser.PipelineContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#pipeline}.
	 * @param ctx the parse tree
	 */
	void exitPipeline(LanglyParser.PipelineContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#pipelineStage}.
	 * @param ctx the parse tree
	 */
	void enterPipelineStage(LanglyParser.PipelineStageContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#pipelineStage}.
	 * @param ctx the parse tree
	 */
	void exitPipelineStage(LanglyParser.PipelineStageContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#condition}.
	 * @param ctx the parse tree
	 */
	void enterCondition(LanglyParser.ConditionContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#condition}.
	 * @param ctx the parse tree
	 */
	void exitCondition(LanglyParser.ConditionContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#conditionExpr}.
	 * @param ctx the parse tree
	 */
	void enterConditionExpr(LanglyParser.ConditionExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#conditionExpr}.
	 * @param ctx the parse tree
	 */
	void exitConditionExpr(LanglyParser.ConditionExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#comparisonOp}.
	 * @param ctx the parse tree
	 */
	void enterComparisonOp(LanglyParser.ComparisonOpContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#comparisonOp}.
	 * @param ctx the parse tree
	 */
	void exitComparisonOp(LanglyParser.ComparisonOpContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#fanoutStages}.
	 * @param ctx the parse tree
	 */
	void enterFanoutStages(LanglyParser.FanoutStagesContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#fanoutStages}.
	 * @param ctx the parse tree
	 */
	void exitFanoutStages(LanglyParser.FanoutStagesContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#fanoutStage}.
	 * @param ctx the parse tree
	 */
	void enterFanoutStage(LanglyParser.FanoutStageContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#fanoutStage}.
	 * @param ctx the parse tree
	 */
	void exitFanoutStage(LanglyParser.FanoutStageContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#yieldExpr}.
	 * @param ctx the parse tree
	 */
	void enterYieldExpr(LanglyParser.YieldExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#yieldExpr}.
	 * @param ctx the parse tree
	 */
	void exitYieldExpr(LanglyParser.YieldExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#yieldArgs}.
	 * @param ctx the parse tree
	 */
	void enterYieldArgs(LanglyParser.YieldArgsContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#yieldArgs}.
	 * @param ctx the parse tree
	 */
	void exitYieldArgs(LanglyParser.YieldArgsContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#yieldArg}.
	 * @param ctx the parse tree
	 */
	void enterYieldArg(LanglyParser.YieldArgContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#yieldArg}.
	 * @param ctx the parse tree
	 */
	void exitYieldArg(LanglyParser.YieldArgContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#yieldArgValue}.
	 * @param ctx the parse tree
	 */
	void enterYieldArgValue(LanglyParser.YieldArgValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#yieldArgValue}.
	 * @param ctx the parse tree
	 */
	void exitYieldArgValue(LanglyParser.YieldArgValueContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#listenExpr}.
	 * @param ctx the parse tree
	 */
	void enterListenExpr(LanglyParser.ListenExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#listenExpr}.
	 * @param ctx the parse tree
	 */
	void exitListenExpr(LanglyParser.ListenExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#listenTarget}.
	 * @param ctx the parse tree
	 */
	void enterListenTarget(LanglyParser.ListenTargetContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#listenTarget}.
	 * @param ctx the parse tree
	 */
	void exitListenTarget(LanglyParser.ListenTargetContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterExpression(LanglyParser.ExpressionContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitExpression(LanglyParser.ExpressionContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#callExpr}.
	 * @param ctx the parse tree
	 */
	void enterCallExpr(LanglyParser.CallExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#callExpr}.
	 * @param ctx the parse tree
	 */
	void exitCallExpr(LanglyParser.CallExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#callArgs}.
	 * @param ctx the parse tree
	 */
	void enterCallArgs(LanglyParser.CallArgsContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#callArgs}.
	 * @param ctx the parse tree
	 */
	void exitCallArgs(LanglyParser.CallArgsContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#callArg}.
	 * @param ctx the parse tree
	 */
	void enterCallArg(LanglyParser.CallArgContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#callArg}.
	 * @param ctx the parse tree
	 */
	void exitCallArg(LanglyParser.CallArgContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#callValue}.
	 * @param ctx the parse tree
	 */
	void enterCallValue(LanglyParser.CallValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#callValue}.
	 * @param ctx the parse tree
	 */
	void exitCallValue(LanglyParser.CallValueContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#callItems}.
	 * @param ctx the parse tree
	 */
	void enterCallItems(LanglyParser.CallItemsContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#callItems}.
	 * @param ctx the parse tree
	 */
	void exitCallItems(LanglyParser.CallItemsContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#value}.
	 * @param ctx the parse tree
	 */
	void enterValue(LanglyParser.ValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#value}.
	 * @param ctx the parse tree
	 */
	void exitValue(LanglyParser.ValueContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#contextRef}.
	 * @param ctx the parse tree
	 */
	void enterContextRef(LanglyParser.ContextRefContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#contextRef}.
	 * @param ctx the parse tree
	 */
	void exitContextRef(LanglyParser.ContextRefContext ctx);
	/**
	 * Enter a parse tree produced by {@link LanglyParser#contextTail}.
	 * @param ctx the parse tree
	 */
	void enterContextTail(LanglyParser.ContextTailContext ctx);
	/**
	 * Exit a parse tree produced by {@link LanglyParser#contextTail}.
	 * @param ctx the parse tree
	 */
	void exitContextTail(LanglyParser.ContextTailContext ctx);
}