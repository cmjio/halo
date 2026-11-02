// Generated from grammars/Halo.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { HaloVisitor } from "./HaloVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class HaloParser extends antlr.Parser {
    public static readonly T__0 = 1;
    public static readonly T__1 = 2;
    public static readonly T__2 = 3;
    public static readonly T__3 = 4;
    public static readonly T__4 = 5;
    public static readonly T__5 = 6;
    public static readonly T__6 = 7;
    public static readonly T__7 = 8;
    public static readonly T__8 = 9;
    public static readonly T__9 = 10;
    public static readonly T__10 = 11;
    public static readonly T__11 = 12;
    public static readonly T__12 = 13;
    public static readonly T__13 = 14;
    public static readonly T__14 = 15;
    public static readonly T__15 = 16;
    public static readonly T__16 = 17;
    public static readonly T__17 = 18;
    public static readonly T__18 = 19;
    public static readonly T__19 = 20;
    public static readonly T__20 = 21;
    public static readonly T__21 = 22;
    public static readonly T__22 = 23;
    public static readonly T__23 = 24;
    public static readonly T__24 = 25;
    public static readonly T__25 = 26;
    public static readonly T__26 = 27;
    public static readonly T__27 = 28;
    public static readonly T__28 = 29;
    public static readonly T__29 = 30;
    public static readonly T__30 = 31;
    public static readonly T__31 = 32;
    public static readonly T__32 = 33;
    public static readonly T__33 = 34;
    public static readonly T__34 = 35;
    public static readonly T__35 = 36;
    public static readonly T__36 = 37;
    public static readonly T__37 = 38;
    public static readonly T__38 = 39;
    public static readonly WS = 40;
    public static readonly NL = 41;
    public static readonly LINE_COMMENT = 42;
    public static readonly BLOCK_COMMENT = 43;
    public static readonly LOOP = 44;
    public static readonly FANOUT = 45;
    public static readonly INTERRUPT = 46;
    public static readonly GATE = 47;
    public static readonly LISTEN = 48;
    public static readonly PIPE = 49;
    public static readonly BOOL = 50;
    public static readonly NULL = 51;
    public static readonly DURATION = 52;
    public static readonly NUMBER = 53;
    public static readonly MODEL_REF = 54;
    public static readonly IDENTIFIER = 55;
    public static readonly TRIPLE_STRING = 56;
    public static readonly STRING = 57;
    public static readonly RULE_program = 0;
    public static readonly RULE_declaration = 1;
    public static readonly RULE_name = 2;
    public static readonly RULE_dottedId = 3;
    public static readonly RULE_pathPart = 4;
    public static readonly RULE_policyDecl = 5;
    public static readonly RULE_policyRule = 6;
    public static readonly RULE_toolDecl = 7;
    public static readonly RULE_storeDecl = 8;
    public static readonly RULE_schemaDecl = 9;
    public static readonly RULE_schemaField = 10;
    public static readonly RULE_agentDecl = 11;
    public static readonly RULE_modelRef = 12;
    public static readonly RULE_modelParam = 13;
    public static readonly RULE_agentModifier = 14;
    public static readonly RULE_directive = 15;
    public static readonly RULE_directiveArg = 16;
    public static readonly RULE_pipelineDecl = 17;
    public static readonly RULE_paramList = 18;
    public static readonly RULE_param = 19;
    public static readonly RULE_typeRef = 20;
    public static readonly RULE_pipeline = 21;
    public static readonly RULE_pipelineOp = 22;
    public static readonly RULE_binding = 23;
    public static readonly RULE_branchArm = 24;
    public static readonly RULE_fanoutItem = 25;
    public static readonly RULE_callExpr = 26;
    public static readonly RULE_callArgs = 27;
    public static readonly RULE_callArg = 28;
    public static readonly RULE_callValue = 29;
    public static readonly RULE_listValue = 30;
    public static readonly RULE_value = 31;
    public static readonly RULE_literal = 32;
    public static readonly RULE_expression = 33;
    public static readonly RULE_contextRef = 34;
    public static readonly RULE_condExpr = 35;
    public static readonly RULE_orExpr = 36;
    public static readonly RULE_andExpr = 37;
    public static readonly RULE_notExpr = 38;
    public static readonly RULE_comparison = 39;
    public static readonly RULE_compOp = 40;
    public static readonly RULE_operand = 41;

    public static readonly literalNames = [
        null, "'policy'", "'tool'", "'store'", "'schema'", "'agent'", "'pipeline'", 
        "'equips'", "'requires'", "'system'", "'context'", "'yield'", "'listen'", 
        "'loop'", "'as'", "'each'", "'in'", "'else'", "'.'", "':'", "'&'", 
        "'('", "')'", "'{'", "','", "'}'", "'['", "']'", "'@'", "'->'", 
        "'<'", "'>'", "'=>'", "'||'", "'&&'", "'!'", "'=='", "'!='", "'>='", 
        "'<='", null, null, null, null, "'|<>'", "'|*'", "'|!'", "'|?'", 
        "'~>'", "'|>'", null, "'null'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, "WS", "NL", "LINE_COMMENT", 
        "BLOCK_COMMENT", "LOOP", "FANOUT", "INTERRUPT", "GATE", "LISTEN", 
        "PIPE", "BOOL", "NULL", "DURATION", "NUMBER", "MODEL_REF", "IDENTIFIER", 
        "TRIPLE_STRING", "STRING"
    ];
    public static readonly ruleNames = [
        "program", "declaration", "name", "dottedId", "pathPart", "policyDecl", 
        "policyRule", "toolDecl", "storeDecl", "schemaDecl", "schemaField", 
        "agentDecl", "modelRef", "modelParam", "agentModifier", "directive", 
        "directiveArg", "pipelineDecl", "paramList", "param", "typeRef", 
        "pipeline", "pipelineOp", "binding", "branchArm", "fanoutItem", 
        "callExpr", "callArgs", "callArg", "callValue", "listValue", "value", 
        "literal", "expression", "contextRef", "condExpr", "orExpr", "andExpr", 
        "notExpr", "comparison", "compOp", "operand",
    ];

    public get grammarFileName(): string { return "Halo.g4"; }
    public get literalNames(): (string | null)[] { return HaloParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return HaloParser.symbolicNames; }
    public get ruleNames(): string[] { return HaloParser.ruleNames; }
    public get serializedATN(): number[] { return HaloParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, HaloParser._ATN, HaloParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public program(): ProgramContext {
        let localContext = new ProgramContext(this.context, this.state);
        this.enterRule(localContext, 0, HaloParser.RULE_program);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 87;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 268435582) !== 0)) {
                {
                {
                this.state = 84;
                this.declaration();
                }
                }
                this.state = 89;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 90;
            this.match(HaloParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declaration(): DeclarationContext {
        let localContext = new DeclarationContext(this.context, this.state);
        this.enterRule(localContext, 2, HaloParser.RULE_declaration);
        try {
            this.state = 98;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 92;
                this.policyDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 93;
                this.toolDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 94;
                this.storeDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 95;
                this.schemaDecl();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 96;
                this.agentDecl();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 97;
                this.pipelineDecl();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public name(): NameContext {
        let localContext = new NameContext(this.context, this.state);
        this.enterRule(localContext, 4, HaloParser.RULE_name);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 100;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 262142) !== 0) || _la === 55)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public dottedId(): DottedIdContext {
        let localContext = new DottedIdContext(this.context, this.state);
        this.enterRule(localContext, 6, HaloParser.RULE_dottedId);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 102;
            this.match(HaloParser.IDENTIFIER);
            this.state = 107;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 18) {
                {
                {
                this.state = 103;
                this.match(HaloParser.T__17);
                this.state = 104;
                this.pathPart();
                }
                }
                this.state = 109;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pathPart(): PathPartContext {
        let localContext = new PathPartContext(this.context, this.state);
        this.enterRule(localContext, 8, HaloParser.RULE_pathPart);
        try {
            this.state = 112;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__0:
            case HaloParser.T__1:
            case HaloParser.T__2:
            case HaloParser.T__3:
            case HaloParser.T__4:
            case HaloParser.T__5:
            case HaloParser.T__6:
            case HaloParser.T__7:
            case HaloParser.T__8:
            case HaloParser.T__9:
            case HaloParser.T__10:
            case HaloParser.T__11:
            case HaloParser.T__12:
            case HaloParser.T__13:
            case HaloParser.T__14:
            case HaloParser.T__15:
            case HaloParser.T__16:
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 110;
                this.name();
                }
                break;
            case HaloParser.NUMBER:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 111;
                this.match(HaloParser.NUMBER);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public policyDecl(): PolicyDeclContext {
        let localContext = new PolicyDeclContext(this.context, this.state);
        this.enterRule(localContext, 10, HaloParser.RULE_policyDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 114;
            this.match(HaloParser.T__0);
            this.state = 115;
            this.match(HaloParser.IDENTIFIER);
            this.state = 116;
            this.match(HaloParser.T__18);
            this.state = 117;
            this.policyRule();
            this.state = 122;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 20) {
                {
                {
                this.state = 118;
                this.match(HaloParser.T__19);
                this.state = 119;
                this.policyRule();
                }
                }
                this.state = 124;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public policyRule(): PolicyRuleContext {
        let localContext = new PolicyRuleContext(this.context, this.state);
        this.enterRule(localContext, 12, HaloParser.RULE_policyRule);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 125;
            this.match(HaloParser.IDENTIFIER);
            this.state = 126;
            this.match(HaloParser.T__20);
            this.state = 128;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 127;
                this.callArgs();
                }
            }

            this.state = 130;
            this.match(HaloParser.T__21);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public toolDecl(): ToolDeclContext {
        let localContext = new ToolDeclContext(this.context, this.state);
        this.enterRule(localContext, 14, HaloParser.RULE_toolDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 132;
            this.match(HaloParser.T__1);
            this.state = 133;
            this.match(HaloParser.IDENTIFIER);
            this.state = 134;
            this.match(HaloParser.T__18);
            this.state = 135;
            this.match(HaloParser.IDENTIFIER);
            this.state = 136;
            this.match(HaloParser.T__20);
            this.state = 138;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 137;
                this.callArgs();
                }
            }

            this.state = 140;
            this.match(HaloParser.T__21);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public storeDecl(): StoreDeclContext {
        let localContext = new StoreDeclContext(this.context, this.state);
        this.enterRule(localContext, 16, HaloParser.RULE_storeDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 142;
            this.match(HaloParser.T__2);
            this.state = 143;
            this.match(HaloParser.IDENTIFIER);
            this.state = 144;
            this.match(HaloParser.T__18);
            this.state = 145;
            this.match(HaloParser.IDENTIFIER);
            this.state = 146;
            this.match(HaloParser.T__20);
            this.state = 148;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 147;
                this.callArgs();
                }
            }

            this.state = 150;
            this.match(HaloParser.T__21);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public schemaDecl(): SchemaDeclContext {
        let localContext = new SchemaDeclContext(this.context, this.state);
        this.enterRule(localContext, 18, HaloParser.RULE_schemaDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 152;
            this.match(HaloParser.T__3);
            this.state = 153;
            this.match(HaloParser.IDENTIFIER);
            this.state = 154;
            this.match(HaloParser.T__22);
            this.state = 161;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 262142) !== 0) || _la === 55) {
                {
                {
                this.state = 155;
                this.schemaField();
                this.state = 157;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 156;
                    this.match(HaloParser.T__23);
                    }
                }

                }
                }
                this.state = 163;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 164;
            this.match(HaloParser.T__24);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public schemaField(): SchemaFieldContext {
        let localContext = new SchemaFieldContext(this.context, this.state);
        this.enterRule(localContext, 20, HaloParser.RULE_schemaField);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 166;
            this.name();
            this.state = 167;
            this.match(HaloParser.T__18);
            this.state = 168;
            this.typeRef();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public agentDecl(): AgentDeclContext {
        let localContext = new AgentDeclContext(this.context, this.state);
        this.enterRule(localContext, 22, HaloParser.RULE_agentDecl);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 173;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 28) {
                {
                {
                this.state = 170;
                this.directive();
                }
                }
                this.state = 175;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 176;
            this.match(HaloParser.T__4);
            this.state = 177;
            this.match(HaloParser.IDENTIFIER);
            this.state = 178;
            this.match(HaloParser.T__25);
            this.state = 179;
            this.modelRef();
            this.state = 184;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 11, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 180;
                    this.match(HaloParser.T__23);
                    this.state = 181;
                    this.modelParam();
                    }
                    }
                }
                this.state = 186;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 11, this.context);
            }
            this.state = 188;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 187;
                this.match(HaloParser.T__23);
                }
            }

            this.state = 190;
            this.match(HaloParser.T__26);
            this.state = 194;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 896) !== 0)) {
                {
                {
                this.state = 191;
                this.agentModifier();
                }
                }
                this.state = 196;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public modelRef(): ModelRefContext {
        let localContext = new ModelRefContext(this.context, this.state);
        this.enterRule(localContext, 24, HaloParser.RULE_modelRef);
        try {
            this.state = 200;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 197;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 198;
                this.match(HaloParser.STRING);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 199;
                this.dottedId();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public modelParam(): ModelParamContext {
        let localContext = new ModelParamContext(this.context, this.state);
        this.enterRule(localContext, 26, HaloParser.RULE_modelParam);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 202;
            this.name();
            this.state = 203;
            this.match(HaloParser.T__18);
            this.state = 204;
            this.value();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public agentModifier(): AgentModifierContext {
        let localContext = new AgentModifierContext(this.context, this.state);
        this.enterRule(localContext, 28, HaloParser.RULE_agentModifier);
        let _la: number;
        try {
            this.state = 226;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__6:
                localContext = new EquipsModifierContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 206;
                this.match(HaloParser.T__6);
                this.state = 207;
                this.match(HaloParser.IDENTIFIER);
                this.state = 212;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24) {
                    {
                    {
                    this.state = 208;
                    this.match(HaloParser.T__23);
                    this.state = 209;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 214;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__7:
                localContext = new RequiresModifierContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 215;
                this.match(HaloParser.T__7);
                this.state = 216;
                this.match(HaloParser.IDENTIFIER);
                this.state = 221;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24) {
                    {
                    {
                    this.state = 217;
                    this.match(HaloParser.T__23);
                    this.state = 218;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 223;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__8:
                localContext = new SystemModifierContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 224;
                this.match(HaloParser.T__8);
                this.state = 225;
                _la = this.tokenStream.LA(1);
                if(!(_la === 56 || _la === 57)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public directive(): DirectiveContext {
        let localContext = new DirectiveContext(this.context, this.state);
        this.enterRule(localContext, 30, HaloParser.RULE_directive);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 228;
            this.match(HaloParser.T__27);
            this.state = 229;
            this.name();
            this.state = 242;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21) {
                {
                this.state = 230;
                this.match(HaloParser.T__20);
                this.state = 239;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                    {
                    this.state = 231;
                    this.directiveArg();
                    this.state = 236;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 24) {
                        {
                        {
                        this.state = 232;
                        this.match(HaloParser.T__23);
                        this.state = 233;
                        this.directiveArg();
                        }
                        }
                        this.state = 238;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                this.state = 241;
                this.match(HaloParser.T__21);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public directiveArg(): DirectiveArgContext {
        let localContext = new DirectiveArgContext(this.context, this.state);
        this.enterRule(localContext, 32, HaloParser.RULE_directiveArg);
        try {
            this.state = 247;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.BOOL:
            case HaloParser.NULL:
            case HaloParser.DURATION:
            case HaloParser.NUMBER:
            case HaloParser.TRIPLE_STRING:
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 244;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 245;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 246;
                this.dottedId();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pipelineDecl(): PipelineDeclContext {
        let localContext = new PipelineDeclContext(this.context, this.state);
        this.enterRule(localContext, 34, HaloParser.RULE_pipelineDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 252;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 28) {
                {
                {
                this.state = 249;
                this.directive();
                }
                }
                this.state = 254;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 255;
            this.match(HaloParser.T__5);
            this.state = 256;
            this.match(HaloParser.IDENTIFIER);
            this.state = 257;
            this.match(HaloParser.T__20);
            this.state = 259;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 55) {
                {
                this.state = 258;
                this.paramList();
                }
            }

            this.state = 261;
            this.match(HaloParser.T__21);
            this.state = 264;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 29) {
                {
                this.state = 262;
                this.match(HaloParser.T__28);
                this.state = 263;
                this.typeRef();
                }
            }

            this.state = 266;
            this.match(HaloParser.T__18);
            this.state = 267;
            this.pipeline();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public paramList(): ParamListContext {
        let localContext = new ParamListContext(this.context, this.state);
        this.enterRule(localContext, 36, HaloParser.RULE_paramList);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 269;
            this.param();
            this.state = 274;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 25, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 270;
                    this.match(HaloParser.T__23);
                    this.state = 271;
                    this.param();
                    }
                    }
                }
                this.state = 276;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 25, this.context);
            }
            this.state = 278;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 277;
                this.match(HaloParser.T__23);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public param(): ParamContext {
        let localContext = new ParamContext(this.context, this.state);
        this.enterRule(localContext, 38, HaloParser.RULE_param);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 280;
            this.match(HaloParser.IDENTIFIER);
            this.state = 281;
            this.match(HaloParser.T__18);
            this.state = 282;
            this.typeRef();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public typeRef(): TypeRefContext {
        let localContext = new TypeRefContext(this.context, this.state);
        this.enterRule(localContext, 40, HaloParser.RULE_typeRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 284;
            this.dottedId();
            this.state = 296;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 30) {
                {
                this.state = 285;
                this.match(HaloParser.T__29);
                this.state = 286;
                this.typeRef();
                this.state = 291;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24) {
                    {
                    {
                    this.state = 287;
                    this.match(HaloParser.T__23);
                    this.state = 288;
                    this.typeRef();
                    }
                    }
                    this.state = 293;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 294;
                this.match(HaloParser.T__30);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pipeline(): PipelineContext {
        let localContext = new PipelineContext(this.context, this.state);
        this.enterRule(localContext, 42, HaloParser.RULE_pipeline);
        let _la: number;
        try {
            this.state = 310;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__9:
            case HaloParser.BOOL:
            case HaloParser.NULL:
            case HaloParser.DURATION:
            case HaloParser.NUMBER:
            case HaloParser.IDENTIFIER:
            case HaloParser.TRIPLE_STRING:
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 298;
                this.expression();
                this.state = 302;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 63) !== 0)) {
                    {
                    {
                    this.state = 299;
                    this.pipelineOp();
                    }
                    }
                    this.state = 304;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.LOOP:
            case HaloParser.FANOUT:
            case HaloParser.INTERRUPT:
            case HaloParser.GATE:
            case HaloParser.LISTEN:
            case HaloParser.PIPE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 306;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 305;
                    this.pipelineOp();
                    }
                    }
                    this.state = 308;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 63) !== 0));
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pipelineOp(): PipelineOpContext {
        let localContext = new PipelineOpContext(this.context, this.state);
        this.enterRule(localContext, 44, HaloParser.RULE_pipelineOp);
        let _la: number;
        try {
            let alternative: number;
            this.state = 406;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 47, this.context) ) {
            case 1:
                localContext = new PipeOpContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 312;
                this.match(HaloParser.PIPE);
                this.state = 313;
                this.callExpr();
                this.state = 315;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 314;
                    this.binding();
                    }
                }

                }
                break;
            case 2:
                localContext = new GateOpContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 317;
                this.match(HaloParser.GATE);
                this.state = 318;
                this.match(HaloParser.T__20);
                this.state = 319;
                this.condExpr();
                this.state = 320;
                this.match(HaloParser.T__21);
                this.state = 322;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 32) {
                    {
                    this.state = 321;
                    this.match(HaloParser.T__31);
                    }
                }

                }
                break;
            case 3:
                localContext = new BranchOpContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 324;
                this.match(HaloParser.GATE);
                this.state = 325;
                this.match(HaloParser.T__22);
                this.state = 326;
                this.branchArm();
                this.state = 331;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 34, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 327;
                        this.match(HaloParser.T__23);
                        this.state = 328;
                        this.branchArm();
                        }
                        }
                    }
                    this.state = 333;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 34, this.context);
                }
                this.state = 335;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 334;
                    this.match(HaloParser.T__23);
                    }
                }

                this.state = 337;
                this.match(HaloParser.T__24);
                this.state = 339;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 338;
                    this.binding();
                    }
                }

                }
                break;
            case 4:
                localContext = new InterruptOpContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 341;
                this.match(HaloParser.INTERRUPT);
                this.state = 342;
                this.match(HaloParser.T__10);
                this.state = 343;
                this.match(HaloParser.T__20);
                this.state = 345;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                    {
                    this.state = 344;
                    this.callArgs();
                    }
                }

                this.state = 347;
                this.match(HaloParser.T__21);
                this.state = 349;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 348;
                    this.binding();
                    }
                }

                }
                break;
            case 5:
                localContext = new FanoutOpContext(localContext);
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 351;
                this.match(HaloParser.FANOUT);
                this.state = 352;
                this.match(HaloParser.T__22);
                this.state = 353;
                this.fanoutItem();
                this.state = 358;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 39, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 354;
                        this.match(HaloParser.T__23);
                        this.state = 355;
                        this.fanoutItem();
                        }
                        }
                    }
                    this.state = 360;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 39, this.context);
                }
                this.state = 362;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 361;
                    this.match(HaloParser.T__23);
                    }
                }

                this.state = 364;
                this.match(HaloParser.T__24);
                this.state = 366;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 365;
                    this.binding();
                    }
                }

                }
                break;
            case 6:
                localContext = new EachOpContext(localContext);
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 368;
                this.match(HaloParser.FANOUT);
                this.state = 369;
                this.match(HaloParser.T__14);
                this.state = 370;
                this.match(HaloParser.T__20);
                this.state = 371;
                this.match(HaloParser.IDENTIFIER);
                this.state = 372;
                this.match(HaloParser.T__15);
                this.state = 373;
                this.callValue();
                this.state = 376;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 374;
                    this.match(HaloParser.T__23);
                    this.state = 375;
                    this.callArgs();
                    }
                }

                this.state = 378;
                this.match(HaloParser.T__21);
                this.state = 379;
                this.match(HaloParser.T__31);
                this.state = 380;
                this.callExpr();
                this.state = 382;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 381;
                    this.binding();
                    }
                }

                }
                break;
            case 7:
                localContext = new ListenOpContext(localContext);
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 384;
                this.match(HaloParser.LISTEN);
                this.state = 385;
                this.match(HaloParser.T__11);
                this.state = 386;
                this.match(HaloParser.T__20);
                this.state = 387;
                this.callValue();
                this.state = 388;
                this.match(HaloParser.T__21);
                this.state = 390;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 389;
                    this.binding();
                    }
                }

                }
                break;
            case 8:
                localContext = new LoopOpContext(localContext);
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 392;
                this.match(HaloParser.LOOP);
                this.state = 393;
                this.match(HaloParser.T__12);
                this.state = 394;
                this.match(HaloParser.T__20);
                this.state = 395;
                this.match(HaloParser.IDENTIFIER);
                this.state = 396;
                this.match(HaloParser.T__23);
                this.state = 397;
                _la = this.tokenStream.LA(1);
                if(!(_la === 56 || _la === 57)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 400;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 398;
                    this.match(HaloParser.T__23);
                    this.state = 399;
                    this.callArgs();
                    }
                }

                this.state = 402;
                this.match(HaloParser.T__21);
                this.state = 404;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 403;
                    this.binding();
                    }
                }

                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public binding(): BindingContext {
        let localContext = new BindingContext(this.context, this.state);
        this.enterRule(localContext, 46, HaloParser.RULE_binding);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 408;
            this.match(HaloParser.T__13);
            this.state = 409;
            this.name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public branchArm(): BranchArmContext {
        let localContext = new BranchArmContext(this.context, this.state);
        this.enterRule(localContext, 48, HaloParser.RULE_branchArm);
        try {
            this.state = 420;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__20:
                localContext = new CondArmContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 411;
                this.match(HaloParser.T__20);
                this.state = 412;
                this.condExpr();
                this.state = 413;
                this.match(HaloParser.T__21);
                this.state = 414;
                this.match(HaloParser.T__31);
                this.state = 415;
                this.callExpr();
                }
                break;
            case HaloParser.T__16:
                localContext = new ElseArmContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 417;
                this.match(HaloParser.T__16);
                this.state = 418;
                this.match(HaloParser.T__31);
                this.state = 419;
                this.callExpr();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fanoutItem(): FanoutItemContext {
        let localContext = new FanoutItemContext(this.context, this.state);
        this.enterRule(localContext, 50, HaloParser.RULE_fanoutItem);
        let _la: number;
        try {
            this.state = 430;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 51, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 422;
                this.callExpr();
                this.state = 424;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 423;
                    this.binding();
                    }
                }

                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 426;
                this.match(HaloParser.IDENTIFIER);
                this.state = 428;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 427;
                    this.binding();
                    }
                }

                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public callExpr(): CallExprContext {
        let localContext = new CallExprContext(this.context, this.state);
        this.enterRule(localContext, 52, HaloParser.RULE_callExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 432;
            this.match(HaloParser.IDENTIFIER);
            this.state = 435;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 18) {
                {
                this.state = 433;
                this.match(HaloParser.T__17);
                this.state = 434;
                this.name();
                }
            }

            this.state = 437;
            this.match(HaloParser.T__20);
            this.state = 439;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 438;
                this.callArgs();
                }
            }

            this.state = 441;
            this.match(HaloParser.T__21);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public callArgs(): CallArgsContext {
        let localContext = new CallArgsContext(this.context, this.state);
        this.enterRule(localContext, 54, HaloParser.RULE_callArgs);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 443;
            this.callArg();
            this.state = 448;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 54, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 444;
                    this.match(HaloParser.T__23);
                    this.state = 445;
                    this.callArg();
                    }
                    }
                }
                this.state = 450;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 54, this.context);
            }
            this.state = 452;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 451;
                this.match(HaloParser.T__23);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public callArg(): CallArgContext {
        let localContext = new CallArgContext(this.context, this.state);
        this.enterRule(localContext, 56, HaloParser.RULE_callArg);
        try {
            this.state = 459;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 56, this.context) ) {
            case 1:
                localContext = new NamedArgContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 454;
                this.name();
                this.state = 455;
                this.match(HaloParser.T__18);
                this.state = 456;
                this.callValue();
                }
                break;
            case 2:
                localContext = new PositionalArgContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 458;
                this.callValue();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public callValue(): CallValueContext {
        let localContext = new CallValueContext(this.context, this.state);
        this.enterRule(localContext, 58, HaloParser.RULE_callValue);
        try {
            this.state = 466;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.BOOL:
            case HaloParser.NULL:
            case HaloParser.DURATION:
            case HaloParser.NUMBER:
            case HaloParser.TRIPLE_STRING:
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 461;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 462;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 463;
                this.contextRef();
                }
                break;
            case HaloParser.T__25:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 464;
                this.listValue();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 465;
                this.dottedId();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public listValue(): ListValueContext {
        let localContext = new ListValueContext(this.context, this.state);
        this.enterRule(localContext, 60, HaloParser.RULE_listValue);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 468;
            this.match(HaloParser.T__25);
            this.state = 480;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 26 || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 469;
                this.callValue();
                this.state = 474;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 58, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 470;
                        this.match(HaloParser.T__23);
                        this.state = 471;
                        this.callValue();
                        }
                        }
                    }
                    this.state = 476;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 58, this.context);
                }
                this.state = 478;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 477;
                    this.match(HaloParser.T__23);
                    }
                }

                }
            }

            this.state = 482;
            this.match(HaloParser.T__26);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public value(): ValueContext {
        let localContext = new ValueContext(this.context, this.state);
        this.enterRule(localContext, 62, HaloParser.RULE_value);
        try {
            this.state = 487;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.BOOL:
            case HaloParser.NULL:
            case HaloParser.DURATION:
            case HaloParser.NUMBER:
            case HaloParser.TRIPLE_STRING:
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 484;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 485;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 486;
                this.dottedId();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public literal(): LiteralContext {
        let localContext = new LiteralContext(this.context, this.state);
        this.enterRule(localContext, 64, HaloParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 489;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 207) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expression(): ExpressionContext {
        let localContext = new ExpressionContext(this.context, this.state);
        this.enterRule(localContext, 66, HaloParser.RULE_expression);
        try {
            this.state = 494;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.BOOL:
            case HaloParser.NULL:
            case HaloParser.DURATION:
            case HaloParser.NUMBER:
            case HaloParser.TRIPLE_STRING:
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 491;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 492;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 493;
                this.dottedId();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public contextRef(): ContextRefContext {
        let localContext = new ContextRefContext(this.context, this.state);
        this.enterRule(localContext, 68, HaloParser.RULE_contextRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 496;
            this.match(HaloParser.T__9);
            this.state = 501;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 18) {
                {
                {
                this.state = 497;
                this.match(HaloParser.T__17);
                this.state = 498;
                this.pathPart();
                }
                }
                this.state = 503;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public condExpr(): CondExprContext {
        let localContext = new CondExprContext(this.context, this.state);
        this.enterRule(localContext, 70, HaloParser.RULE_condExpr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 504;
            this.orExpr();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public orExpr(): OrExprContext {
        let localContext = new OrExprContext(this.context, this.state);
        this.enterRule(localContext, 72, HaloParser.RULE_orExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 506;
            this.andExpr();
            this.state = 511;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 33) {
                {
                {
                this.state = 507;
                this.match(HaloParser.T__32);
                this.state = 508;
                this.andExpr();
                }
                }
                this.state = 513;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public andExpr(): AndExprContext {
        let localContext = new AndExprContext(this.context, this.state);
        this.enterRule(localContext, 74, HaloParser.RULE_andExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 514;
            this.notExpr();
            this.state = 519;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 34) {
                {
                {
                this.state = 515;
                this.match(HaloParser.T__33);
                this.state = 516;
                this.notExpr();
                }
                }
                this.state = 521;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public notExpr(): NotExprContext {
        let localContext = new NotExprContext(this.context, this.state);
        this.enterRule(localContext, 76, HaloParser.RULE_notExpr);
        try {
            this.state = 525;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__34:
                localContext = new NegationContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 522;
                this.match(HaloParser.T__34);
                this.state = 523;
                this.notExpr();
                }
                break;
            case HaloParser.T__9:
            case HaloParser.T__20:
            case HaloParser.BOOL:
            case HaloParser.NULL:
            case HaloParser.DURATION:
            case HaloParser.NUMBER:
            case HaloParser.IDENTIFIER:
            case HaloParser.TRIPLE_STRING:
            case HaloParser.STRING:
                localContext = new ComparisonExprContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 524;
                this.comparison();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public comparison(): ComparisonContext {
        let localContext = new ComparisonContext(this.context, this.state);
        this.enterRule(localContext, 78, HaloParser.RULE_comparison);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 527;
            this.operand();
            this.state = 531;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & 963) !== 0)) {
                {
                this.state = 528;
                this.compOp();
                this.state = 529;
                this.operand();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public compOp(): CompOpContext {
        let localContext = new CompOpContext(this.context, this.state);
        this.enterRule(localContext, 80, HaloParser.RULE_compOp);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 533;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & 963) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public operand(): OperandContext {
        let localContext = new OperandContext(this.context, this.state);
        this.enterRule(localContext, 82, HaloParser.RULE_operand);
        try {
            this.state = 542;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__20:
                localContext = new ParenOperandContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 535;
                this.match(HaloParser.T__20);
                this.state = 536;
                this.orExpr();
                this.state = 537;
                this.match(HaloParser.T__21);
                }
                break;
            case HaloParser.BOOL:
            case HaloParser.NULL:
            case HaloParser.DURATION:
            case HaloParser.NUMBER:
            case HaloParser.TRIPLE_STRING:
            case HaloParser.STRING:
                localContext = new LiteralOperandContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 539;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                localContext = new ContextOperandContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 540;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                localContext = new RefOperandContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 541;
                this.dottedId();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public static readonly _serializedATN: number[] = [
        4,1,57,545,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,
        7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,
        2,40,7,40,2,41,7,41,1,0,5,0,86,8,0,10,0,12,0,89,9,0,1,0,1,0,1,1,
        1,1,1,1,1,1,1,1,1,1,3,1,99,8,1,1,2,1,2,1,3,1,3,1,3,5,3,106,8,3,10,
        3,12,3,109,9,3,1,4,1,4,3,4,113,8,4,1,5,1,5,1,5,1,5,1,5,1,5,5,5,121,
        8,5,10,5,12,5,124,9,5,1,6,1,6,1,6,3,6,129,8,6,1,6,1,6,1,7,1,7,1,
        7,1,7,1,7,1,7,3,7,139,8,7,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,3,8,149,
        8,8,1,8,1,8,1,9,1,9,1,9,1,9,1,9,3,9,158,8,9,5,9,160,8,9,10,9,12,
        9,163,9,9,1,9,1,9,1,10,1,10,1,10,1,10,1,11,5,11,172,8,11,10,11,12,
        11,175,9,11,1,11,1,11,1,11,1,11,1,11,1,11,5,11,183,8,11,10,11,12,
        11,186,9,11,1,11,3,11,189,8,11,1,11,1,11,5,11,193,8,11,10,11,12,
        11,196,9,11,1,12,1,12,1,12,3,12,201,8,12,1,13,1,13,1,13,1,13,1,14,
        1,14,1,14,1,14,5,14,211,8,14,10,14,12,14,214,9,14,1,14,1,14,1,14,
        1,14,5,14,220,8,14,10,14,12,14,223,9,14,1,14,1,14,3,14,227,8,14,
        1,15,1,15,1,15,1,15,1,15,1,15,5,15,235,8,15,10,15,12,15,238,9,15,
        3,15,240,8,15,1,15,3,15,243,8,15,1,16,1,16,1,16,3,16,248,8,16,1,
        17,5,17,251,8,17,10,17,12,17,254,9,17,1,17,1,17,1,17,1,17,3,17,260,
        8,17,1,17,1,17,1,17,3,17,265,8,17,1,17,1,17,1,17,1,18,1,18,1,18,
        5,18,273,8,18,10,18,12,18,276,9,18,1,18,3,18,279,8,18,1,19,1,19,
        1,19,1,19,1,20,1,20,1,20,1,20,1,20,5,20,290,8,20,10,20,12,20,293,
        9,20,1,20,1,20,3,20,297,8,20,1,21,1,21,5,21,301,8,21,10,21,12,21,
        304,9,21,1,21,4,21,307,8,21,11,21,12,21,308,3,21,311,8,21,1,22,1,
        22,1,22,3,22,316,8,22,1,22,1,22,1,22,1,22,1,22,3,22,323,8,22,1,22,
        1,22,1,22,1,22,1,22,5,22,330,8,22,10,22,12,22,333,9,22,1,22,3,22,
        336,8,22,1,22,1,22,3,22,340,8,22,1,22,1,22,1,22,1,22,3,22,346,8,
        22,1,22,1,22,3,22,350,8,22,1,22,1,22,1,22,1,22,1,22,5,22,357,8,22,
        10,22,12,22,360,9,22,1,22,3,22,363,8,22,1,22,1,22,3,22,367,8,22,
        1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,3,22,377,8,22,1,22,1,22,
        1,22,1,22,3,22,383,8,22,1,22,1,22,1,22,1,22,1,22,1,22,3,22,391,8,
        22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,3,22,401,8,22,1,22,1,
        22,3,22,405,8,22,3,22,407,8,22,1,23,1,23,1,23,1,24,1,24,1,24,1,24,
        1,24,1,24,1,24,1,24,1,24,3,24,421,8,24,1,25,1,25,3,25,425,8,25,1,
        25,1,25,3,25,429,8,25,3,25,431,8,25,1,26,1,26,1,26,3,26,436,8,26,
        1,26,1,26,3,26,440,8,26,1,26,1,26,1,27,1,27,1,27,5,27,447,8,27,10,
        27,12,27,450,9,27,1,27,3,27,453,8,27,1,28,1,28,1,28,1,28,1,28,3,
        28,460,8,28,1,29,1,29,1,29,1,29,1,29,3,29,467,8,29,1,30,1,30,1,30,
        1,30,5,30,473,8,30,10,30,12,30,476,9,30,1,30,3,30,479,8,30,3,30,
        481,8,30,1,30,1,30,1,31,1,31,1,31,3,31,488,8,31,1,32,1,32,1,33,1,
        33,1,33,3,33,495,8,33,1,34,1,34,1,34,5,34,500,8,34,10,34,12,34,503,
        9,34,1,35,1,35,1,36,1,36,1,36,5,36,510,8,36,10,36,12,36,513,9,36,
        1,37,1,37,1,37,5,37,518,8,37,10,37,12,37,521,9,37,1,38,1,38,1,38,
        3,38,526,8,38,1,39,1,39,1,39,1,39,3,39,532,8,39,1,40,1,40,1,41,1,
        41,1,41,1,41,1,41,1,41,1,41,3,41,543,8,41,1,41,0,0,42,0,2,4,6,8,
        10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,
        54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,0,4,2,0,1,17,55,55,
        1,0,56,57,2,0,50,53,56,57,2,0,30,31,36,39,591,0,87,1,0,0,0,2,98,
        1,0,0,0,4,100,1,0,0,0,6,102,1,0,0,0,8,112,1,0,0,0,10,114,1,0,0,0,
        12,125,1,0,0,0,14,132,1,0,0,0,16,142,1,0,0,0,18,152,1,0,0,0,20,166,
        1,0,0,0,22,173,1,0,0,0,24,200,1,0,0,0,26,202,1,0,0,0,28,226,1,0,
        0,0,30,228,1,0,0,0,32,247,1,0,0,0,34,252,1,0,0,0,36,269,1,0,0,0,
        38,280,1,0,0,0,40,284,1,0,0,0,42,310,1,0,0,0,44,406,1,0,0,0,46,408,
        1,0,0,0,48,420,1,0,0,0,50,430,1,0,0,0,52,432,1,0,0,0,54,443,1,0,
        0,0,56,459,1,0,0,0,58,466,1,0,0,0,60,468,1,0,0,0,62,487,1,0,0,0,
        64,489,1,0,0,0,66,494,1,0,0,0,68,496,1,0,0,0,70,504,1,0,0,0,72,506,
        1,0,0,0,74,514,1,0,0,0,76,525,1,0,0,0,78,527,1,0,0,0,80,533,1,0,
        0,0,82,542,1,0,0,0,84,86,3,2,1,0,85,84,1,0,0,0,86,89,1,0,0,0,87,
        85,1,0,0,0,87,88,1,0,0,0,88,90,1,0,0,0,89,87,1,0,0,0,90,91,5,0,0,
        1,91,1,1,0,0,0,92,99,3,10,5,0,93,99,3,14,7,0,94,99,3,16,8,0,95,99,
        3,18,9,0,96,99,3,22,11,0,97,99,3,34,17,0,98,92,1,0,0,0,98,93,1,0,
        0,0,98,94,1,0,0,0,98,95,1,0,0,0,98,96,1,0,0,0,98,97,1,0,0,0,99,3,
        1,0,0,0,100,101,7,0,0,0,101,5,1,0,0,0,102,107,5,55,0,0,103,104,5,
        18,0,0,104,106,3,8,4,0,105,103,1,0,0,0,106,109,1,0,0,0,107,105,1,
        0,0,0,107,108,1,0,0,0,108,7,1,0,0,0,109,107,1,0,0,0,110,113,3,4,
        2,0,111,113,5,53,0,0,112,110,1,0,0,0,112,111,1,0,0,0,113,9,1,0,0,
        0,114,115,5,1,0,0,115,116,5,55,0,0,116,117,5,19,0,0,117,122,3,12,
        6,0,118,119,5,20,0,0,119,121,3,12,6,0,120,118,1,0,0,0,121,124,1,
        0,0,0,122,120,1,0,0,0,122,123,1,0,0,0,123,11,1,0,0,0,124,122,1,0,
        0,0,125,126,5,55,0,0,126,128,5,21,0,0,127,129,3,54,27,0,128,127,
        1,0,0,0,128,129,1,0,0,0,129,130,1,0,0,0,130,131,5,22,0,0,131,13,
        1,0,0,0,132,133,5,2,0,0,133,134,5,55,0,0,134,135,5,19,0,0,135,136,
        5,55,0,0,136,138,5,21,0,0,137,139,3,54,27,0,138,137,1,0,0,0,138,
        139,1,0,0,0,139,140,1,0,0,0,140,141,5,22,0,0,141,15,1,0,0,0,142,
        143,5,3,0,0,143,144,5,55,0,0,144,145,5,19,0,0,145,146,5,55,0,0,146,
        148,5,21,0,0,147,149,3,54,27,0,148,147,1,0,0,0,148,149,1,0,0,0,149,
        150,1,0,0,0,150,151,5,22,0,0,151,17,1,0,0,0,152,153,5,4,0,0,153,
        154,5,55,0,0,154,161,5,23,0,0,155,157,3,20,10,0,156,158,5,24,0,0,
        157,156,1,0,0,0,157,158,1,0,0,0,158,160,1,0,0,0,159,155,1,0,0,0,
        160,163,1,0,0,0,161,159,1,0,0,0,161,162,1,0,0,0,162,164,1,0,0,0,
        163,161,1,0,0,0,164,165,5,25,0,0,165,19,1,0,0,0,166,167,3,4,2,0,
        167,168,5,19,0,0,168,169,3,40,20,0,169,21,1,0,0,0,170,172,3,30,15,
        0,171,170,1,0,0,0,172,175,1,0,0,0,173,171,1,0,0,0,173,174,1,0,0,
        0,174,176,1,0,0,0,175,173,1,0,0,0,176,177,5,5,0,0,177,178,5,55,0,
        0,178,179,5,26,0,0,179,184,3,24,12,0,180,181,5,24,0,0,181,183,3,
        26,13,0,182,180,1,0,0,0,183,186,1,0,0,0,184,182,1,0,0,0,184,185,
        1,0,0,0,185,188,1,0,0,0,186,184,1,0,0,0,187,189,5,24,0,0,188,187,
        1,0,0,0,188,189,1,0,0,0,189,190,1,0,0,0,190,194,5,27,0,0,191,193,
        3,28,14,0,192,191,1,0,0,0,193,196,1,0,0,0,194,192,1,0,0,0,194,195,
        1,0,0,0,195,23,1,0,0,0,196,194,1,0,0,0,197,201,5,54,0,0,198,201,
        5,57,0,0,199,201,3,6,3,0,200,197,1,0,0,0,200,198,1,0,0,0,200,199,
        1,0,0,0,201,25,1,0,0,0,202,203,3,4,2,0,203,204,5,19,0,0,204,205,
        3,62,31,0,205,27,1,0,0,0,206,207,5,7,0,0,207,212,5,55,0,0,208,209,
        5,24,0,0,209,211,5,55,0,0,210,208,1,0,0,0,211,214,1,0,0,0,212,210,
        1,0,0,0,212,213,1,0,0,0,213,227,1,0,0,0,214,212,1,0,0,0,215,216,
        5,8,0,0,216,221,5,55,0,0,217,218,5,24,0,0,218,220,5,55,0,0,219,217,
        1,0,0,0,220,223,1,0,0,0,221,219,1,0,0,0,221,222,1,0,0,0,222,227,
        1,0,0,0,223,221,1,0,0,0,224,225,5,9,0,0,225,227,7,1,0,0,226,206,
        1,0,0,0,226,215,1,0,0,0,226,224,1,0,0,0,227,29,1,0,0,0,228,229,5,
        28,0,0,229,242,3,4,2,0,230,239,5,21,0,0,231,236,3,32,16,0,232,233,
        5,24,0,0,233,235,3,32,16,0,234,232,1,0,0,0,235,238,1,0,0,0,236,234,
        1,0,0,0,236,237,1,0,0,0,237,240,1,0,0,0,238,236,1,0,0,0,239,231,
        1,0,0,0,239,240,1,0,0,0,240,241,1,0,0,0,241,243,5,22,0,0,242,230,
        1,0,0,0,242,243,1,0,0,0,243,31,1,0,0,0,244,248,3,64,32,0,245,248,
        5,54,0,0,246,248,3,6,3,0,247,244,1,0,0,0,247,245,1,0,0,0,247,246,
        1,0,0,0,248,33,1,0,0,0,249,251,3,30,15,0,250,249,1,0,0,0,251,254,
        1,0,0,0,252,250,1,0,0,0,252,253,1,0,0,0,253,255,1,0,0,0,254,252,
        1,0,0,0,255,256,5,6,0,0,256,257,5,55,0,0,257,259,5,21,0,0,258,260,
        3,36,18,0,259,258,1,0,0,0,259,260,1,0,0,0,260,261,1,0,0,0,261,264,
        5,22,0,0,262,263,5,29,0,0,263,265,3,40,20,0,264,262,1,0,0,0,264,
        265,1,0,0,0,265,266,1,0,0,0,266,267,5,19,0,0,267,268,3,42,21,0,268,
        35,1,0,0,0,269,274,3,38,19,0,270,271,5,24,0,0,271,273,3,38,19,0,
        272,270,1,0,0,0,273,276,1,0,0,0,274,272,1,0,0,0,274,275,1,0,0,0,
        275,278,1,0,0,0,276,274,1,0,0,0,277,279,5,24,0,0,278,277,1,0,0,0,
        278,279,1,0,0,0,279,37,1,0,0,0,280,281,5,55,0,0,281,282,5,19,0,0,
        282,283,3,40,20,0,283,39,1,0,0,0,284,296,3,6,3,0,285,286,5,30,0,
        0,286,291,3,40,20,0,287,288,5,24,0,0,288,290,3,40,20,0,289,287,1,
        0,0,0,290,293,1,0,0,0,291,289,1,0,0,0,291,292,1,0,0,0,292,294,1,
        0,0,0,293,291,1,0,0,0,294,295,5,31,0,0,295,297,1,0,0,0,296,285,1,
        0,0,0,296,297,1,0,0,0,297,41,1,0,0,0,298,302,3,66,33,0,299,301,3,
        44,22,0,300,299,1,0,0,0,301,304,1,0,0,0,302,300,1,0,0,0,302,303,
        1,0,0,0,303,311,1,0,0,0,304,302,1,0,0,0,305,307,3,44,22,0,306,305,
        1,0,0,0,307,308,1,0,0,0,308,306,1,0,0,0,308,309,1,0,0,0,309,311,
        1,0,0,0,310,298,1,0,0,0,310,306,1,0,0,0,311,43,1,0,0,0,312,313,5,
        49,0,0,313,315,3,52,26,0,314,316,3,46,23,0,315,314,1,0,0,0,315,316,
        1,0,0,0,316,407,1,0,0,0,317,318,5,47,0,0,318,319,5,21,0,0,319,320,
        3,70,35,0,320,322,5,22,0,0,321,323,5,32,0,0,322,321,1,0,0,0,322,
        323,1,0,0,0,323,407,1,0,0,0,324,325,5,47,0,0,325,326,5,23,0,0,326,
        331,3,48,24,0,327,328,5,24,0,0,328,330,3,48,24,0,329,327,1,0,0,0,
        330,333,1,0,0,0,331,329,1,0,0,0,331,332,1,0,0,0,332,335,1,0,0,0,
        333,331,1,0,0,0,334,336,5,24,0,0,335,334,1,0,0,0,335,336,1,0,0,0,
        336,337,1,0,0,0,337,339,5,25,0,0,338,340,3,46,23,0,339,338,1,0,0,
        0,339,340,1,0,0,0,340,407,1,0,0,0,341,342,5,46,0,0,342,343,5,11,
        0,0,343,345,5,21,0,0,344,346,3,54,27,0,345,344,1,0,0,0,345,346,1,
        0,0,0,346,347,1,0,0,0,347,349,5,22,0,0,348,350,3,46,23,0,349,348,
        1,0,0,0,349,350,1,0,0,0,350,407,1,0,0,0,351,352,5,45,0,0,352,353,
        5,23,0,0,353,358,3,50,25,0,354,355,5,24,0,0,355,357,3,50,25,0,356,
        354,1,0,0,0,357,360,1,0,0,0,358,356,1,0,0,0,358,359,1,0,0,0,359,
        362,1,0,0,0,360,358,1,0,0,0,361,363,5,24,0,0,362,361,1,0,0,0,362,
        363,1,0,0,0,363,364,1,0,0,0,364,366,5,25,0,0,365,367,3,46,23,0,366,
        365,1,0,0,0,366,367,1,0,0,0,367,407,1,0,0,0,368,369,5,45,0,0,369,
        370,5,15,0,0,370,371,5,21,0,0,371,372,5,55,0,0,372,373,5,16,0,0,
        373,376,3,58,29,0,374,375,5,24,0,0,375,377,3,54,27,0,376,374,1,0,
        0,0,376,377,1,0,0,0,377,378,1,0,0,0,378,379,5,22,0,0,379,380,5,32,
        0,0,380,382,3,52,26,0,381,383,3,46,23,0,382,381,1,0,0,0,382,383,
        1,0,0,0,383,407,1,0,0,0,384,385,5,48,0,0,385,386,5,12,0,0,386,387,
        5,21,0,0,387,388,3,58,29,0,388,390,5,22,0,0,389,391,3,46,23,0,390,
        389,1,0,0,0,390,391,1,0,0,0,391,407,1,0,0,0,392,393,5,44,0,0,393,
        394,5,13,0,0,394,395,5,21,0,0,395,396,5,55,0,0,396,397,5,24,0,0,
        397,400,7,1,0,0,398,399,5,24,0,0,399,401,3,54,27,0,400,398,1,0,0,
        0,400,401,1,0,0,0,401,402,1,0,0,0,402,404,5,22,0,0,403,405,3,46,
        23,0,404,403,1,0,0,0,404,405,1,0,0,0,405,407,1,0,0,0,406,312,1,0,
        0,0,406,317,1,0,0,0,406,324,1,0,0,0,406,341,1,0,0,0,406,351,1,0,
        0,0,406,368,1,0,0,0,406,384,1,0,0,0,406,392,1,0,0,0,407,45,1,0,0,
        0,408,409,5,14,0,0,409,410,3,4,2,0,410,47,1,0,0,0,411,412,5,21,0,
        0,412,413,3,70,35,0,413,414,5,22,0,0,414,415,5,32,0,0,415,416,3,
        52,26,0,416,421,1,0,0,0,417,418,5,17,0,0,418,419,5,32,0,0,419,421,
        3,52,26,0,420,411,1,0,0,0,420,417,1,0,0,0,421,49,1,0,0,0,422,424,
        3,52,26,0,423,425,3,46,23,0,424,423,1,0,0,0,424,425,1,0,0,0,425,
        431,1,0,0,0,426,428,5,55,0,0,427,429,3,46,23,0,428,427,1,0,0,0,428,
        429,1,0,0,0,429,431,1,0,0,0,430,422,1,0,0,0,430,426,1,0,0,0,431,
        51,1,0,0,0,432,435,5,55,0,0,433,434,5,18,0,0,434,436,3,4,2,0,435,
        433,1,0,0,0,435,436,1,0,0,0,436,437,1,0,0,0,437,439,5,21,0,0,438,
        440,3,54,27,0,439,438,1,0,0,0,439,440,1,0,0,0,440,441,1,0,0,0,441,
        442,5,22,0,0,442,53,1,0,0,0,443,448,3,56,28,0,444,445,5,24,0,0,445,
        447,3,56,28,0,446,444,1,0,0,0,447,450,1,0,0,0,448,446,1,0,0,0,448,
        449,1,0,0,0,449,452,1,0,0,0,450,448,1,0,0,0,451,453,5,24,0,0,452,
        451,1,0,0,0,452,453,1,0,0,0,453,55,1,0,0,0,454,455,3,4,2,0,455,456,
        5,19,0,0,456,457,3,58,29,0,457,460,1,0,0,0,458,460,3,58,29,0,459,
        454,1,0,0,0,459,458,1,0,0,0,460,57,1,0,0,0,461,467,3,64,32,0,462,
        467,5,54,0,0,463,467,3,68,34,0,464,467,3,60,30,0,465,467,3,6,3,0,
        466,461,1,0,0,0,466,462,1,0,0,0,466,463,1,0,0,0,466,464,1,0,0,0,
        466,465,1,0,0,0,467,59,1,0,0,0,468,480,5,26,0,0,469,474,3,58,29,
        0,470,471,5,24,0,0,471,473,3,58,29,0,472,470,1,0,0,0,473,476,1,0,
        0,0,474,472,1,0,0,0,474,475,1,0,0,0,475,478,1,0,0,0,476,474,1,0,
        0,0,477,479,5,24,0,0,478,477,1,0,0,0,478,479,1,0,0,0,479,481,1,0,
        0,0,480,469,1,0,0,0,480,481,1,0,0,0,481,482,1,0,0,0,482,483,5,27,
        0,0,483,61,1,0,0,0,484,488,3,64,32,0,485,488,5,54,0,0,486,488,3,
        6,3,0,487,484,1,0,0,0,487,485,1,0,0,0,487,486,1,0,0,0,488,63,1,0,
        0,0,489,490,7,2,0,0,490,65,1,0,0,0,491,495,3,64,32,0,492,495,3,68,
        34,0,493,495,3,6,3,0,494,491,1,0,0,0,494,492,1,0,0,0,494,493,1,0,
        0,0,495,67,1,0,0,0,496,501,5,10,0,0,497,498,5,18,0,0,498,500,3,8,
        4,0,499,497,1,0,0,0,500,503,1,0,0,0,501,499,1,0,0,0,501,502,1,0,
        0,0,502,69,1,0,0,0,503,501,1,0,0,0,504,505,3,72,36,0,505,71,1,0,
        0,0,506,511,3,74,37,0,507,508,5,33,0,0,508,510,3,74,37,0,509,507,
        1,0,0,0,510,513,1,0,0,0,511,509,1,0,0,0,511,512,1,0,0,0,512,73,1,
        0,0,0,513,511,1,0,0,0,514,519,3,76,38,0,515,516,5,34,0,0,516,518,
        3,76,38,0,517,515,1,0,0,0,518,521,1,0,0,0,519,517,1,0,0,0,519,520,
        1,0,0,0,520,75,1,0,0,0,521,519,1,0,0,0,522,523,5,35,0,0,523,526,
        3,76,38,0,524,526,3,78,39,0,525,522,1,0,0,0,525,524,1,0,0,0,526,
        77,1,0,0,0,527,531,3,82,41,0,528,529,3,80,40,0,529,530,3,82,41,0,
        530,532,1,0,0,0,531,528,1,0,0,0,531,532,1,0,0,0,532,79,1,0,0,0,533,
        534,7,3,0,0,534,81,1,0,0,0,535,536,5,21,0,0,536,537,3,72,36,0,537,
        538,5,22,0,0,538,543,1,0,0,0,539,543,3,64,32,0,540,543,3,68,34,0,
        541,543,3,6,3,0,542,535,1,0,0,0,542,539,1,0,0,0,542,540,1,0,0,0,
        542,541,1,0,0,0,543,83,1,0,0,0,69,87,98,107,112,122,128,138,148,
        157,161,173,184,188,194,200,212,221,226,236,239,242,247,252,259,
        264,274,278,291,296,302,308,310,315,322,331,335,339,345,349,358,
        362,366,376,382,390,400,404,406,420,424,428,430,435,439,448,452,
        459,466,474,478,480,487,494,501,511,519,525,531,542
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!HaloParser.__ATN) {
            HaloParser.__ATN = new antlr.ATNDeserializer().deserialize(HaloParser._serializedATN);
        }

        return HaloParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(HaloParser.literalNames, HaloParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return HaloParser.vocabulary;
    }

    private static readonly decisionsToDFA = HaloParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class ProgramContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(HaloParser.EOF, 0)!;
    }
    public declaration(): DeclarationContext[];
    public declaration(i: number): DeclarationContext | null;
    public declaration(i?: number): DeclarationContext[] | DeclarationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DeclarationContext);
        }

        return this.getRuleContext(i, DeclarationContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_program;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitProgram) {
            return visitor.visitProgram(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public policyDecl(): PolicyDeclContext | null {
        return this.getRuleContext(0, PolicyDeclContext);
    }
    public toolDecl(): ToolDeclContext | null {
        return this.getRuleContext(0, ToolDeclContext);
    }
    public storeDecl(): StoreDeclContext | null {
        return this.getRuleContext(0, StoreDeclContext);
    }
    public schemaDecl(): SchemaDeclContext | null {
        return this.getRuleContext(0, SchemaDeclContext);
    }
    public agentDecl(): AgentDeclContext | null {
        return this.getRuleContext(0, AgentDeclContext);
    }
    public pipelineDecl(): PipelineDeclContext | null {
        return this.getRuleContext(0, PipelineDeclContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_declaration;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitDeclaration) {
            return visitor.visitDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_name;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitName) {
            return visitor.visitName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DottedIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public pathPart(): PathPartContext[];
    public pathPart(i: number): PathPartContext | null;
    public pathPart(i?: number): PathPartContext[] | PathPartContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PathPartContext);
        }

        return this.getRuleContext(i, PathPartContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_dottedId;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitDottedId) {
            return visitor.visitDottedId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PathPartContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public name(): NameContext | null {
        return this.getRuleContext(0, NameContext);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_pathPart;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPathPart) {
            return visitor.visitPathPart(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PolicyDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public policyRule(): PolicyRuleContext[];
    public policyRule(i: number): PolicyRuleContext | null;
    public policyRule(i?: number): PolicyRuleContext[] | PolicyRuleContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PolicyRuleContext);
        }

        return this.getRuleContext(i, PolicyRuleContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_policyDecl;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPolicyDecl) {
            return visitor.visitPolicyDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PolicyRuleContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_policyRule;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPolicyRule) {
            return visitor.visitPolicyRule(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ToolDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_toolDecl;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitToolDecl) {
            return visitor.visitToolDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StoreDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_storeDecl;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitStoreDecl) {
            return visitor.visitStoreDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SchemaDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public schemaField(): SchemaFieldContext[];
    public schemaField(i: number): SchemaFieldContext | null;
    public schemaField(i?: number): SchemaFieldContext[] | SchemaFieldContext | null {
        if (i === undefined) {
            return this.getRuleContexts(SchemaFieldContext);
        }

        return this.getRuleContext(i, SchemaFieldContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_schemaDecl;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitSchemaDecl) {
            return visitor.visitSchemaDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SchemaFieldContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public name(): NameContext {
        return this.getRuleContext(0, NameContext)!;
    }
    public typeRef(): TypeRefContext {
        return this.getRuleContext(0, TypeRefContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_schemaField;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitSchemaField) {
            return visitor.visitSchemaField(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AgentDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public modelRef(): ModelRefContext {
        return this.getRuleContext(0, ModelRefContext)!;
    }
    public directive(): DirectiveContext[];
    public directive(i: number): DirectiveContext | null;
    public directive(i?: number): DirectiveContext[] | DirectiveContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DirectiveContext);
        }

        return this.getRuleContext(i, DirectiveContext);
    }
    public modelParam(): ModelParamContext[];
    public modelParam(i: number): ModelParamContext | null;
    public modelParam(i?: number): ModelParamContext[] | ModelParamContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ModelParamContext);
        }

        return this.getRuleContext(i, ModelParamContext);
    }
    public agentModifier(): AgentModifierContext[];
    public agentModifier(i: number): AgentModifierContext | null;
    public agentModifier(i?: number): AgentModifierContext[] | AgentModifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AgentModifierContext);
        }

        return this.getRuleContext(i, AgentModifierContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_agentDecl;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitAgentDecl) {
            return visitor.visitAgentDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ModelRefContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.MODEL_REF, 0);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_modelRef;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitModelRef) {
            return visitor.visitModelRef(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ModelParamContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public name(): NameContext {
        return this.getRuleContext(0, NameContext)!;
    }
    public value(): ValueContext {
        return this.getRuleContext(0, ValueContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_modelParam;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitModelParam) {
            return visitor.visitModelParam(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AgentModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_agentModifier;
    }
    public override copyFrom(ctx: AgentModifierContext): void {
        super.copyFrom(ctx);
    }
}
export class RequiresModifierContext extends AgentModifierContext {
    public constructor(ctx: AgentModifierContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitRequiresModifier) {
            return visitor.visitRequiresModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class SystemModifierContext extends AgentModifierContext {
    public constructor(ctx: AgentModifierContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public TRIPLE_STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.TRIPLE_STRING, 0);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitSystemModifier) {
            return visitor.visitSystemModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class EquipsModifierContext extends AgentModifierContext {
    public constructor(ctx: AgentModifierContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitEquipsModifier) {
            return visitor.visitEquipsModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public name(): NameContext {
        return this.getRuleContext(0, NameContext)!;
    }
    public directiveArg(): DirectiveArgContext[];
    public directiveArg(i: number): DirectiveArgContext | null;
    public directiveArg(i?: number): DirectiveArgContext[] | DirectiveArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DirectiveArgContext);
        }

        return this.getRuleContext(i, DirectiveArgContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_directive;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitDirective) {
            return visitor.visitDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectiveArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal(): LiteralContext | null {
        return this.getRuleContext(0, LiteralContext);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.MODEL_REF, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_directiveArg;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitDirectiveArg) {
            return visitor.visitDirectiveArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PipelineDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public pipeline(): PipelineContext {
        return this.getRuleContext(0, PipelineContext)!;
    }
    public directive(): DirectiveContext[];
    public directive(i: number): DirectiveContext | null;
    public directive(i?: number): DirectiveContext[] | DirectiveContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DirectiveContext);
        }

        return this.getRuleContext(i, DirectiveContext);
    }
    public paramList(): ParamListContext | null {
        return this.getRuleContext(0, ParamListContext);
    }
    public typeRef(): TypeRefContext | null {
        return this.getRuleContext(0, TypeRefContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_pipelineDecl;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPipelineDecl) {
            return visitor.visitPipelineDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParamListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public param(): ParamContext[];
    public param(i: number): ParamContext | null;
    public param(i?: number): ParamContext[] | ParamContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ParamContext);
        }

        return this.getRuleContext(i, ParamContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_paramList;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitParamList) {
            return visitor.visitParamList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParamContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public typeRef(): TypeRefContext {
        return this.getRuleContext(0, TypeRefContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_param;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitParam) {
            return visitor.visitParam(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeRefContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public dottedId(): DottedIdContext {
        return this.getRuleContext(0, DottedIdContext)!;
    }
    public typeRef(): TypeRefContext[];
    public typeRef(i: number): TypeRefContext | null;
    public typeRef(i?: number): TypeRefContext[] | TypeRefContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeRefContext);
        }

        return this.getRuleContext(i, TypeRefContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_typeRef;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitTypeRef) {
            return visitor.visitTypeRef(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PipelineContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public pipelineOp(): PipelineOpContext[];
    public pipelineOp(i: number): PipelineOpContext | null;
    public pipelineOp(i?: number): PipelineOpContext[] | PipelineOpContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PipelineOpContext);
        }

        return this.getRuleContext(i, PipelineOpContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_pipeline;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPipeline) {
            return visitor.visitPipeline(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PipelineOpContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_pipelineOp;
    }
    public override copyFrom(ctx: PipelineOpContext): void {
        super.copyFrom(ctx);
    }
}
export class FanoutOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public FANOUT(): antlr.TerminalNode {
        return this.getToken(HaloParser.FANOUT, 0)!;
    }
    public fanoutItem(): FanoutItemContext[];
    public fanoutItem(i: number): FanoutItemContext | null;
    public fanoutItem(i?: number): FanoutItemContext[] | FanoutItemContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FanoutItemContext);
        }

        return this.getRuleContext(i, FanoutItemContext);
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitFanoutOp) {
            return visitor.visitFanoutOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ListenOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LISTEN(): antlr.TerminalNode {
        return this.getToken(HaloParser.LISTEN, 0)!;
    }
    public callValue(): CallValueContext {
        return this.getRuleContext(0, CallValueContext)!;
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitListenOp) {
            return visitor.visitListenOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class PipeOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public PIPE(): antlr.TerminalNode {
        return this.getToken(HaloParser.PIPE, 0)!;
    }
    public callExpr(): CallExprContext {
        return this.getRuleContext(0, CallExprContext)!;
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPipeOp) {
            return visitor.visitPipeOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class GateOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public GATE(): antlr.TerminalNode {
        return this.getToken(HaloParser.GATE, 0)!;
    }
    public condExpr(): CondExprContext {
        return this.getRuleContext(0, CondExprContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitGateOp) {
            return visitor.visitGateOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class EachOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public FANOUT(): antlr.TerminalNode {
        return this.getToken(HaloParser.FANOUT, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public callValue(): CallValueContext {
        return this.getRuleContext(0, CallValueContext)!;
    }
    public callExpr(): CallExprContext {
        return this.getRuleContext(0, CallExprContext)!;
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitEachOp) {
            return visitor.visitEachOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class InterruptOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public INTERRUPT(): antlr.TerminalNode {
        return this.getToken(HaloParser.INTERRUPT, 0)!;
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitInterruptOp) {
            return visitor.visitInterruptOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class LoopOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LOOP(): antlr.TerminalNode {
        return this.getToken(HaloParser.LOOP, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public TRIPLE_STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.TRIPLE_STRING, 0);
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitLoopOp) {
            return visitor.visitLoopOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class BranchOpContext extends PipelineOpContext {
    public constructor(ctx: PipelineOpContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public GATE(): antlr.TerminalNode {
        return this.getToken(HaloParser.GATE, 0)!;
    }
    public branchArm(): BranchArmContext[];
    public branchArm(i: number): BranchArmContext | null;
    public branchArm(i?: number): BranchArmContext[] | BranchArmContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BranchArmContext);
        }

        return this.getRuleContext(i, BranchArmContext);
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitBranchOp) {
            return visitor.visitBranchOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BindingContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public name(): NameContext {
        return this.getRuleContext(0, NameContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_binding;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitBinding) {
            return visitor.visitBinding(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BranchArmContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_branchArm;
    }
    public override copyFrom(ctx: BranchArmContext): void {
        super.copyFrom(ctx);
    }
}
export class CondArmContext extends BranchArmContext {
    public constructor(ctx: BranchArmContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public condExpr(): CondExprContext {
        return this.getRuleContext(0, CondExprContext)!;
    }
    public callExpr(): CallExprContext {
        return this.getRuleContext(0, CallExprContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitCondArm) {
            return visitor.visitCondArm(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ElseArmContext extends BranchArmContext {
    public constructor(ctx: BranchArmContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public callExpr(): CallExprContext {
        return this.getRuleContext(0, CallExprContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitElseArm) {
            return visitor.visitElseArm(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FanoutItemContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public callExpr(): CallExprContext | null {
        return this.getRuleContext(0, CallExprContext);
    }
    public binding(): BindingContext | null {
        return this.getRuleContext(0, BindingContext);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.IDENTIFIER, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_fanoutItem;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitFanoutItem) {
            return visitor.visitFanoutItem(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public name(): NameContext | null {
        return this.getRuleContext(0, NameContext);
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_callExpr;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitCallExpr) {
            return visitor.visitCallExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public callArg(): CallArgContext[];
    public callArg(i: number): CallArgContext | null;
    public callArg(i?: number): CallArgContext[] | CallArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(CallArgContext);
        }

        return this.getRuleContext(i, CallArgContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_callArgs;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitCallArgs) {
            return visitor.visitCallArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_callArg;
    }
    public override copyFrom(ctx: CallArgContext): void {
        super.copyFrom(ctx);
    }
}
export class NamedArgContext extends CallArgContext {
    public constructor(ctx: CallArgContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public name(): NameContext {
        return this.getRuleContext(0, NameContext)!;
    }
    public callValue(): CallValueContext {
        return this.getRuleContext(0, CallValueContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitNamedArg) {
            return visitor.visitNamedArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class PositionalArgContext extends CallArgContext {
    public constructor(ctx: CallArgContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public callValue(): CallValueContext {
        return this.getRuleContext(0, CallValueContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPositionalArg) {
            return visitor.visitPositionalArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal(): LiteralContext | null {
        return this.getRuleContext(0, LiteralContext);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.MODEL_REF, 0);
    }
    public contextRef(): ContextRefContext | null {
        return this.getRuleContext(0, ContextRefContext);
    }
    public listValue(): ListValueContext | null {
        return this.getRuleContext(0, ListValueContext);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_callValue;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitCallValue) {
            return visitor.visitCallValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ListValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public callValue(): CallValueContext[];
    public callValue(i: number): CallValueContext | null;
    public callValue(i?: number): CallValueContext[] | CallValueContext | null {
        if (i === undefined) {
            return this.getRuleContexts(CallValueContext);
        }

        return this.getRuleContext(i, CallValueContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_listValue;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitListValue) {
            return visitor.visitListValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal(): LiteralContext | null {
        return this.getRuleContext(0, LiteralContext);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.MODEL_REF, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_value;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitValue) {
            return visitor.visitValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public TRIPLE_STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.TRIPLE_STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.DURATION, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.BOOL, 0);
    }
    public NULL(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NULL, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_literal;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitLiteral) {
            return visitor.visitLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal(): LiteralContext | null {
        return this.getRuleContext(0, LiteralContext);
    }
    public contextRef(): ContextRefContext | null {
        return this.getRuleContext(0, ContextRefContext);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_expression;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitExpression) {
            return visitor.visitExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ContextRefContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public pathPart(): PathPartContext[];
    public pathPart(i: number): PathPartContext | null;
    public pathPart(i?: number): PathPartContext[] | PathPartContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PathPartContext);
        }

        return this.getRuleContext(i, PathPartContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_contextRef;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitContextRef) {
            return visitor.visitContextRef(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CondExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public orExpr(): OrExprContext {
        return this.getRuleContext(0, OrExprContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_condExpr;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitCondExpr) {
            return visitor.visitCondExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OrExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public andExpr(): AndExprContext[];
    public andExpr(i: number): AndExprContext | null;
    public andExpr(i?: number): AndExprContext[] | AndExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AndExprContext);
        }

        return this.getRuleContext(i, AndExprContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_orExpr;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitOrExpr) {
            return visitor.visitOrExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AndExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public notExpr(): NotExprContext[];
    public notExpr(i: number): NotExprContext | null;
    public notExpr(i?: number): NotExprContext[] | NotExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(NotExprContext);
        }

        return this.getRuleContext(i, NotExprContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_andExpr;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitAndExpr) {
            return visitor.visitAndExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NotExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_notExpr;
    }
    public override copyFrom(ctx: NotExprContext): void {
        super.copyFrom(ctx);
    }
}
export class NegationContext extends NotExprContext {
    public constructor(ctx: NotExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public notExpr(): NotExprContext {
        return this.getRuleContext(0, NotExprContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitNegation) {
            return visitor.visitNegation(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ComparisonExprContext extends NotExprContext {
    public constructor(ctx: NotExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public comparison(): ComparisonContext {
        return this.getRuleContext(0, ComparisonContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitComparisonExpr) {
            return visitor.visitComparisonExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ComparisonContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public operand(): OperandContext[];
    public operand(i: number): OperandContext | null;
    public operand(i?: number): OperandContext[] | OperandContext | null {
        if (i === undefined) {
            return this.getRuleContexts(OperandContext);
        }

        return this.getRuleContext(i, OperandContext);
    }
    public compOp(): CompOpContext | null {
        return this.getRuleContext(0, CompOpContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_comparison;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitComparison) {
            return visitor.visitComparison(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CompOpContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_compOp;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitCompOp) {
            return visitor.visitCompOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OperandContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_operand;
    }
    public override copyFrom(ctx: OperandContext): void {
        super.copyFrom(ctx);
    }
}
export class LiteralOperandContext extends OperandContext {
    public constructor(ctx: OperandContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public literal(): LiteralContext {
        return this.getRuleContext(0, LiteralContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitLiteralOperand) {
            return visitor.visitLiteralOperand(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ParenOperandContext extends OperandContext {
    public constructor(ctx: OperandContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public orExpr(): OrExprContext {
        return this.getRuleContext(0, OrExprContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitParenOperand) {
            return visitor.visitParenOperand(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class ContextOperandContext extends OperandContext {
    public constructor(ctx: OperandContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public contextRef(): ContextRefContext {
        return this.getRuleContext(0, ContextRefContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitContextOperand) {
            return visitor.visitContextOperand(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class RefOperandContext extends OperandContext {
    public constructor(ctx: OperandContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public dottedId(): DottedIdContext {
        return this.getRuleContext(0, DottedIdContext)!;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitRefOperand) {
            return visitor.visitRefOperand(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
