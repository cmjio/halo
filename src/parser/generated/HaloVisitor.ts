// Generated from grammars/Halo.g4 by ANTLR 4.13.1

import { AbstractParseTreeVisitor } from "antlr4ng";


import { ProgramContext } from "./HaloParser.js";
import { DeclarationContext } from "./HaloParser.js";
import { NameContext } from "./HaloParser.js";
import { DottedIdContext } from "./HaloParser.js";
import { PolicyDeclContext } from "./HaloParser.js";
import { PolicyRuleContext } from "./HaloParser.js";
import { ToolDeclContext } from "./HaloParser.js";
import { StoreDeclContext } from "./HaloParser.js";
import { SchemaDeclContext } from "./HaloParser.js";
import { SchemaFieldContext } from "./HaloParser.js";
import { AgentDeclContext } from "./HaloParser.js";
import { ModelRefContext } from "./HaloParser.js";
import { ModelParamContext } from "./HaloParser.js";
import { EquipsModifierContext } from "./HaloParser.js";
import { RequiresModifierContext } from "./HaloParser.js";
import { SystemModifierContext } from "./HaloParser.js";
import { DirectiveContext } from "./HaloParser.js";
import { DirectiveArgContext } from "./HaloParser.js";
import { PipelineDeclContext } from "./HaloParser.js";
import { ParamListContext } from "./HaloParser.js";
import { ParamContext } from "./HaloParser.js";
import { TypeRefContext } from "./HaloParser.js";
import { PipelineContext } from "./HaloParser.js";
import { PipeOpContext } from "./HaloParser.js";
import { GateOpContext } from "./HaloParser.js";
import { BranchOpContext } from "./HaloParser.js";
import { InterruptOpContext } from "./HaloParser.js";
import { FanoutOpContext } from "./HaloParser.js";
import { EachOpContext } from "./HaloParser.js";
import { ListenOpContext } from "./HaloParser.js";
import { LoopOpContext } from "./HaloParser.js";
import { BindingContext } from "./HaloParser.js";
import { CondArmContext } from "./HaloParser.js";
import { ElseArmContext } from "./HaloParser.js";
import { FanoutItemContext } from "./HaloParser.js";
import { CallExprContext } from "./HaloParser.js";
import { CallArgsContext } from "./HaloParser.js";
import { NamedArgContext } from "./HaloParser.js";
import { PositionalArgContext } from "./HaloParser.js";
import { CallValueContext } from "./HaloParser.js";
import { ListValueContext } from "./HaloParser.js";
import { ValueContext } from "./HaloParser.js";
import { LiteralContext } from "./HaloParser.js";
import { ExpressionContext } from "./HaloParser.js";
import { ContextRefContext } from "./HaloParser.js";
import { CondExprContext } from "./HaloParser.js";
import { OrExprContext } from "./HaloParser.js";
import { AndExprContext } from "./HaloParser.js";
import { NegationContext } from "./HaloParser.js";
import { ComparisonExprContext } from "./HaloParser.js";
import { ComparisonContext } from "./HaloParser.js";
import { CompOpContext } from "./HaloParser.js";
import { ParenOperandContext } from "./HaloParser.js";
import { LiteralOperandContext } from "./HaloParser.js";
import { ContextOperandContext } from "./HaloParser.js";
import { RefOperandContext } from "./HaloParser.js";


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
     * Visit a parse tree produced by `HaloParser.name`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitName?: (ctx: NameContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.dottedId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDottedId?: (ctx: DottedIdContext) => Result;
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
     * Visit a parse tree produced by `HaloParser.toolDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitToolDecl?: (ctx: ToolDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.storeDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStoreDecl?: (ctx: StoreDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.schemaDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSchemaDecl?: (ctx: SchemaDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.schemaField`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSchemaField?: (ctx: SchemaFieldContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.agentDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAgentDecl?: (ctx: AgentDeclContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.modelRef`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelRef?: (ctx: ModelRefContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.modelParam`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModelParam?: (ctx: ModelParamContext) => Result;
    /**
     * Visit a parse tree produced by the `equipsModifier`
     * labeled alternative in `HaloParser.agentModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEquipsModifier?: (ctx: EquipsModifierContext) => Result;
    /**
     * Visit a parse tree produced by the `requiresModifier`
     * labeled alternative in `HaloParser.agentModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRequiresModifier?: (ctx: RequiresModifierContext) => Result;
    /**
     * Visit a parse tree produced by the `systemModifier`
     * labeled alternative in `HaloParser.agentModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSystemModifier?: (ctx: SystemModifierContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.directive`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirective?: (ctx: DirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.directiveArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDirectiveArg?: (ctx: DirectiveArgContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.pipelineDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipelineDecl?: (ctx: PipelineDeclContext) => Result;
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
     * Visit a parse tree produced by `HaloParser.pipeline`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipeline?: (ctx: PipelineContext) => Result;
    /**
     * Visit a parse tree produced by the `pipeOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPipeOp?: (ctx: PipeOpContext) => Result;
    /**
     * Visit a parse tree produced by the `gateOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGateOp?: (ctx: GateOpContext) => Result;
    /**
     * Visit a parse tree produced by the `branchOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBranchOp?: (ctx: BranchOpContext) => Result;
    /**
     * Visit a parse tree produced by the `interruptOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInterruptOp?: (ctx: InterruptOpContext) => Result;
    /**
     * Visit a parse tree produced by the `fanoutOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFanoutOp?: (ctx: FanoutOpContext) => Result;
    /**
     * Visit a parse tree produced by the `eachOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEachOp?: (ctx: EachOpContext) => Result;
    /**
     * Visit a parse tree produced by the `listenOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitListenOp?: (ctx: ListenOpContext) => Result;
    /**
     * Visit a parse tree produced by the `loopOp`
     * labeled alternative in `HaloParser.pipelineOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLoopOp?: (ctx: LoopOpContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.binding`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBinding?: (ctx: BindingContext) => Result;
    /**
     * Visit a parse tree produced by the `condArm`
     * labeled alternative in `HaloParser.branchArm`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCondArm?: (ctx: CondArmContext) => Result;
    /**
     * Visit a parse tree produced by the `elseArm`
     * labeled alternative in `HaloParser.branchArm`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitElseArm?: (ctx: ElseArmContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.fanoutItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFanoutItem?: (ctx: FanoutItemContext) => Result;
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
     * Visit a parse tree produced by the `namedArg`
     * labeled alternative in `HaloParser.callArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamedArg?: (ctx: NamedArgContext) => Result;
    /**
     * Visit a parse tree produced by the `positionalArg`
     * labeled alternative in `HaloParser.callArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPositionalArg?: (ctx: PositionalArgContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.callValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallValue?: (ctx: CallValueContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.listValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitListValue?: (ctx: ListValueContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.value`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValue?: (ctx: ValueContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.literal`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteral?: (ctx: LiteralContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.contextRef`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextRef?: (ctx: ContextRefContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.condExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCondExpr?: (ctx: CondExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.orExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOrExpr?: (ctx: OrExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.andExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAndExpr?: (ctx: AndExprContext) => Result;
    /**
     * Visit a parse tree produced by the `negation`
     * labeled alternative in `HaloParser.notExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNegation?: (ctx: NegationContext) => Result;
    /**
     * Visit a parse tree produced by the `comparisonExpr`
     * labeled alternative in `HaloParser.notExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitComparisonExpr?: (ctx: ComparisonExprContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.comparison`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitComparison?: (ctx: ComparisonContext) => Result;
    /**
     * Visit a parse tree produced by `HaloParser.compOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCompOp?: (ctx: CompOpContext) => Result;
    /**
     * Visit a parse tree produced by the `parenOperand`
     * labeled alternative in `HaloParser.operand`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParenOperand?: (ctx: ParenOperandContext) => Result;
    /**
     * Visit a parse tree produced by the `literalOperand`
     * labeled alternative in `HaloParser.operand`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralOperand?: (ctx: LiteralOperandContext) => Result;
    /**
     * Visit a parse tree produced by the `contextOperand`
     * labeled alternative in `HaloParser.operand`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextOperand?: (ctx: ContextOperandContext) => Result;
    /**
     * Visit a parse tree produced by the `refOperand`
     * labeled alternative in `HaloParser.operand`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRefOperand?: (ctx: RefOperandContext) => Result;
}

