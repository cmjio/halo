// Generated from grammars/Langly.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { LanglyListener } from "./LanglyListener.js";
import { LanglyVisitor } from "./LanglyVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class LanglyParser extends antlr.Parser {
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
    public static readonly WS = 34;
    public static readonly NL = 35;
    public static readonly COMMENT = 36;
    public static readonly FANOUT = 37;
    public static readonly INTERRUPT = 38;
    public static readonly GATE = 39;
    public static readonly LISTEN = 40;
    public static readonly PIPE = 41;
    public static readonly DURATION = 42;
    public static readonly MODEL_REF = 43;
    public static readonly IDENTIFIER = 44;
    public static readonly STRING = 45;
    public static readonly NUMBER = 46;
    public static readonly BOOL = 47;
    public static readonly RULE_program = 0;
    public static readonly RULE_declaration = 1;
    public static readonly RULE_guardrailDecl = 2;
    public static readonly RULE_guardrailRule = 3;
    public static readonly RULE_guardrailArgs = 4;
    public static readonly RULE_guardrailArg = 5;
    public static readonly RULE_dottedId = 6;
    public static readonly RULE_toolDecl = 7;
    public static readonly RULE_toolArgs = 8;
    public static readonly RULE_toolArg = 9;
    public static readonly RULE_memoryDecl = 10;
    public static readonly RULE_memoryArgs = 11;
    public static readonly RULE_memoryArg = 12;
    public static readonly RULE_mindDecl = 13;
    public static readonly RULE_mindModifiers = 14;
    public static readonly RULE_mindModifier = 15;
    public static readonly RULE_equipsList = 16;
    public static readonly RULE_requiresList = 17;
    public static readonly RULE_modelConfig = 18;
    public static readonly RULE_modelId = 19;
    public static readonly RULE_modelParam = 20;
    public static readonly RULE_streamDecl = 21;
    public static readonly RULE_directive = 22;
    public static readonly RULE_directiveName = 23;
    public static readonly RULE_directiveValue = 24;
    public static readonly RULE_directiveArgs = 25;
    public static readonly RULE_paramList = 26;
    public static readonly RULE_param = 27;
    public static readonly RULE_typeRef = 28;
    public static readonly RULE_pipeline = 29;
    public static readonly RULE_pipelineStage = 30;
    public static readonly RULE_condition = 31;
    public static readonly RULE_conditionExpr = 32;
    public static readonly RULE_contextRef = 33;
    public static readonly RULE_contextTail = 34;
    public static readonly RULE_comparisonOp = 35;
    public static readonly RULE_fanoutStages = 36;
    public static readonly RULE_fanoutStage = 37;
    public static readonly RULE_yieldExpr = 38;
    public static readonly RULE_yieldArgs = 39;
    public static readonly RULE_yieldArg = 40;
    public static readonly RULE_yieldArgValue = 41;
    public static readonly RULE_listenExpr = 42;
    public static readonly RULE_listenTarget = 43;
    public static readonly RULE_expression = 44;
    public static readonly RULE_callExpr = 45;
    public static readonly RULE_callArgs = 46;
    public static readonly RULE_callArg = 47;
    public static readonly RULE_namedCallArg = 48;
    public static readonly RULE_callValue = 49;
    public static readonly RULE_callItems = 50;
    public static readonly RULE_value = 51;

    public static readonly literalNames = [
        null, "'guardrail'", "':'", "'&'", "'('", "')'", "','", "'.'", "'tool'", 
        "'memory'", "'mind'", "'['", "']'", "'equips'", "'requires'", "'stream'", 
        "'->'", "'@'", "'timeout'", "'shadow'", "'checkpoint'", "'retry'", 
        "'{'", "'}'", "'=>'", "'context'", "'=='", "'!='", "'>'", "'<'", 
        "'>='", "'<='", "'yield'", "'listen'", null, null, null, "'|*'", 
        "'|!'", "'|?'", "'~>'", "'|>'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, "WS", "NL", "COMMENT", "FANOUT", "INTERRUPT", "GATE", "LISTEN", 
        "PIPE", "DURATION", "MODEL_REF", "IDENTIFIER", "STRING", "NUMBER", 
        "BOOL"
    ];
    public static readonly ruleNames = [
        "program", "declaration", "guardrailDecl", "guardrailRule", "guardrailArgs", 
        "guardrailArg", "dottedId", "toolDecl", "toolArgs", "toolArg", "memoryDecl", 
        "memoryArgs", "memoryArg", "mindDecl", "mindModifiers", "mindModifier", 
        "equipsList", "requiresList", "modelConfig", "modelId", "modelParam", 
        "streamDecl", "directive", "directiveName", "directiveValue", "directiveArgs", 
        "paramList", "param", "typeRef", "pipeline", "pipelineStage", "condition", 
        "conditionExpr", "contextRef", "contextTail", "comparisonOp", "fanoutStages", 
        "fanoutStage", "yieldExpr", "yieldArgs", "yieldArg", "yieldArgValue", 
        "listenExpr", "listenTarget", "expression", "callExpr", "callArgs", 
        "callArg", "namedCallArg", "callValue", "callItems", "value",
    ];

    public get grammarFileName(): string { return "Langly.g4"; }
    public get literalNames(): (string | null)[] { return LanglyParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return LanglyParser.symbolicNames; }
    public get ruleNames(): string[] { return LanglyParser.ruleNames; }
    public get serializedATN(): number[] { return LanglyParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, LanglyParser._ATN, LanglyParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public program(): ProgramContext {
        let localContext = new ProgramContext(this.context, this.state);
        this.enterRule(localContext, 0, LanglyParser.RULE_program);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 107;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 165634) !== 0)) {
                {
                {
                this.state = 104;
                this.declaration();
                }
                }
                this.state = 109;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 110;
            this.match(LanglyParser.EOF);
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
        this.enterRule(localContext, 2, LanglyParser.RULE_declaration);
        try {
            this.state = 117;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 112;
                this.guardrailDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 113;
                this.toolDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 114;
                this.memoryDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 115;
                this.mindDecl();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 116;
                this.streamDecl();
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
    public guardrailDecl(): GuardrailDeclContext {
        let localContext = new GuardrailDeclContext(this.context, this.state);
        this.enterRule(localContext, 4, LanglyParser.RULE_guardrailDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 119;
            this.match(LanglyParser.T__0);
            this.state = 120;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 121;
            this.match(LanglyParser.T__1);
            this.state = 122;
            this.guardrailRule();
            this.state = 127;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 123;
                this.match(LanglyParser.T__2);
                this.state = 124;
                this.guardrailRule();
                }
                }
                this.state = 129;
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
    public guardrailRule(): GuardrailRuleContext {
        let localContext = new GuardrailRuleContext(this.context, this.state);
        this.enterRule(localContext, 6, LanglyParser.RULE_guardrailRule);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 130;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 131;
            this.match(LanglyParser.T__3);
            this.state = 133;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 31) !== 0)) {
                {
                this.state = 132;
                this.guardrailArgs();
                }
            }

            this.state = 135;
            this.match(LanglyParser.T__4);
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
    public guardrailArgs(): GuardrailArgsContext {
        let localContext = new GuardrailArgsContext(this.context, this.state);
        this.enterRule(localContext, 8, LanglyParser.RULE_guardrailArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 137;
            this.guardrailArg();
            this.state = 142;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 138;
                this.match(LanglyParser.T__5);
                this.state = 139;
                this.guardrailArg();
                }
                }
                this.state = 144;
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
    public guardrailArg(): GuardrailArgContext {
        let localContext = new GuardrailArgContext(this.context, this.state);
        this.enterRule(localContext, 10, LanglyParser.RULE_guardrailArg);
        try {
            this.state = 150;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.MODEL_REF:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 145;
                this.match(LanglyParser.MODEL_REF);
                }
                break;
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 146;
                this.dottedId();
                }
                break;
            case LanglyParser.STRING:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 147;
                this.match(LanglyParser.STRING);
                }
                break;
            case LanglyParser.NUMBER:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 148;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case LanglyParser.DURATION:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 149;
                this.match(LanglyParser.DURATION);
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
    public dottedId(): DottedIdContext {
        let localContext = new DottedIdContext(this.context, this.state);
        this.enterRule(localContext, 12, LanglyParser.RULE_dottedId);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 152;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 157;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 7) {
                {
                {
                this.state = 153;
                this.match(LanglyParser.T__6);
                this.state = 154;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 159;
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
    public toolDecl(): ToolDeclContext {
        let localContext = new ToolDeclContext(this.context, this.state);
        this.enterRule(localContext, 14, LanglyParser.RULE_toolDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 160;
            this.match(LanglyParser.T__7);
            this.state = 161;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 162;
            this.match(LanglyParser.T__1);
            this.state = 163;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 164;
            this.match(LanglyParser.T__3);
            this.state = 166;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 29) !== 0)) {
                {
                this.state = 165;
                this.toolArgs();
                }
            }

            this.state = 168;
            this.match(LanglyParser.T__4);
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
    public toolArgs(): ToolArgsContext {
        let localContext = new ToolArgsContext(this.context, this.state);
        this.enterRule(localContext, 16, LanglyParser.RULE_toolArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 170;
            this.toolArg();
            this.state = 175;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 171;
                this.match(LanglyParser.T__5);
                this.state = 172;
                this.toolArg();
                }
                }
                this.state = 177;
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
    public toolArg(): ToolArgContext {
        let localContext = new ToolArgContext(this.context, this.state);
        this.enterRule(localContext, 18, LanglyParser.RULE_toolArg);
        try {
            this.state = 190;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 10, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 178;
                this.match(LanglyParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 179;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 180;
                this.match(LanglyParser.DURATION);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 181;
                this.dottedId();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 182;
                this.match(LanglyParser.IDENTIFIER);
                this.state = 183;
                this.match(LanglyParser.T__1);
                this.state = 188;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case LanglyParser.STRING:
                    {
                    this.state = 184;
                    this.match(LanglyParser.STRING);
                    }
                    break;
                case LanglyParser.NUMBER:
                    {
                    this.state = 185;
                    this.match(LanglyParser.NUMBER);
                    }
                    break;
                case LanglyParser.DURATION:
                    {
                    this.state = 186;
                    this.match(LanglyParser.DURATION);
                    }
                    break;
                case LanglyParser.IDENTIFIER:
                    {
                    this.state = 187;
                    this.dottedId();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
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
    public memoryDecl(): MemoryDeclContext {
        let localContext = new MemoryDeclContext(this.context, this.state);
        this.enterRule(localContext, 20, LanglyParser.RULE_memoryDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 192;
            this.match(LanglyParser.T__8);
            this.state = 193;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 194;
            this.match(LanglyParser.T__1);
            this.state = 195;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 196;
            this.match(LanglyParser.T__3);
            this.state = 198;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 7) !== 0)) {
                {
                this.state = 197;
                this.memoryArgs();
                }
            }

            this.state = 200;
            this.match(LanglyParser.T__4);
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
    public memoryArgs(): MemoryArgsContext {
        let localContext = new MemoryArgsContext(this.context, this.state);
        this.enterRule(localContext, 22, LanglyParser.RULE_memoryArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 202;
            this.memoryArg();
            this.state = 207;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 203;
                this.match(LanglyParser.T__5);
                this.state = 204;
                this.memoryArg();
                }
                }
                this.state = 209;
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
    public memoryArg(): MemoryArgContext {
        let localContext = new MemoryArgContext(this.context, this.state);
        this.enterRule(localContext, 24, LanglyParser.RULE_memoryArg);
        try {
            this.state = 220;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 14, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 210;
                this.match(LanglyParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 211;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 212;
                this.dottedId();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 213;
                this.match(LanglyParser.IDENTIFIER);
                this.state = 214;
                this.match(LanglyParser.T__1);
                this.state = 218;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case LanglyParser.STRING:
                    {
                    this.state = 215;
                    this.match(LanglyParser.STRING);
                    }
                    break;
                case LanglyParser.NUMBER:
                    {
                    this.state = 216;
                    this.match(LanglyParser.NUMBER);
                    }
                    break;
                case LanglyParser.IDENTIFIER:
                    {
                    this.state = 217;
                    this.dottedId();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
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
    public mindDecl(): MindDeclContext {
        let localContext = new MindDeclContext(this.context, this.state);
        this.enterRule(localContext, 26, LanglyParser.RULE_mindDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 225;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 17) {
                {
                {
                this.state = 222;
                this.directive();
                }
                }
                this.state = 227;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 228;
            this.match(LanglyParser.T__9);
            this.state = 229;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 230;
            this.match(LanglyParser.T__10);
            this.state = 231;
            this.modelConfig();
            this.state = 232;
            this.match(LanglyParser.T__11);
            this.state = 234;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13 || _la === 14) {
                {
                this.state = 233;
                this.mindModifiers();
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
    public mindModifiers(): MindModifiersContext {
        let localContext = new MindModifiersContext(this.context, this.state);
        this.enterRule(localContext, 28, LanglyParser.RULE_mindModifiers);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 237;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 236;
                this.mindModifier();
                }
                }
                this.state = 239;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 13 || _la === 14);
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
    public mindModifier(): MindModifierContext {
        let localContext = new MindModifierContext(this.context, this.state);
        this.enterRule(localContext, 30, LanglyParser.RULE_mindModifier);
        try {
            this.state = 245;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.T__12:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 241;
                this.match(LanglyParser.T__12);
                this.state = 242;
                this.equipsList();
                }
                break;
            case LanglyParser.T__13:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 243;
                this.match(LanglyParser.T__13);
                this.state = 244;
                this.requiresList();
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
    public equipsList(): EquipsListContext {
        let localContext = new EquipsListContext(this.context, this.state);
        this.enterRule(localContext, 32, LanglyParser.RULE_equipsList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 247;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 252;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 248;
                this.match(LanglyParser.T__5);
                this.state = 249;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 254;
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
    public requiresList(): RequiresListContext {
        let localContext = new RequiresListContext(this.context, this.state);
        this.enterRule(localContext, 34, LanglyParser.RULE_requiresList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 255;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 260;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 256;
                this.match(LanglyParser.T__5);
                this.state = 257;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 262;
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
    public modelConfig(): ModelConfigContext {
        let localContext = new ModelConfigContext(this.context, this.state);
        this.enterRule(localContext, 36, LanglyParser.RULE_modelConfig);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 263;
            this.modelId();
            this.state = 268;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 264;
                this.match(LanglyParser.T__5);
                this.state = 265;
                this.modelParam();
                }
                }
                this.state = 270;
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
    public modelId(): ModelIdContext {
        let localContext = new ModelIdContext(this.context, this.state);
        this.enterRule(localContext, 38, LanglyParser.RULE_modelId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 271;
            this.match(LanglyParser.MODEL_REF);
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
        this.enterRule(localContext, 40, LanglyParser.RULE_modelParam);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 273;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 274;
            this.match(LanglyParser.T__1);
            this.state = 275;
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
    public streamDecl(): StreamDeclContext {
        let localContext = new StreamDeclContext(this.context, this.state);
        this.enterRule(localContext, 42, LanglyParser.RULE_streamDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 280;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 17) {
                {
                {
                this.state = 277;
                this.directive();
                }
                }
                this.state = 282;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 283;
            this.match(LanglyParser.T__14);
            this.state = 284;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 285;
            this.match(LanglyParser.T__3);
            this.state = 287;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 44) {
                {
                this.state = 286;
                this.paramList();
                }
            }

            this.state = 289;
            this.match(LanglyParser.T__4);
            this.state = 290;
            this.match(LanglyParser.T__15);
            this.state = 291;
            this.typeRef();
            this.state = 292;
            this.match(LanglyParser.T__1);
            this.state = 293;
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
    public directive(): DirectiveContext {
        let localContext = new DirectiveContext(this.context, this.state);
        this.enterRule(localContext, 44, LanglyParser.RULE_directive);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 295;
            this.match(LanglyParser.T__16);
            this.state = 296;
            this.directiveName();
            this.state = 298;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 4) {
                {
                this.state = 297;
                this.directiveValue();
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
    public directiveName(): DirectiveNameContext {
        let localContext = new DirectiveNameContext(this.context, this.state);
        this.enterRule(localContext, 46, LanglyParser.RULE_directiveName);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 300;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 3932160) !== 0))) {
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
    public directiveValue(): DirectiveValueContext {
        let localContext = new DirectiveValueContext(this.context, this.state);
        this.enterRule(localContext, 48, LanglyParser.RULE_directiveValue);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 302;
            this.match(LanglyParser.T__3);
            this.state = 303;
            this.directiveArgs();
            this.state = 304;
            this.match(LanglyParser.T__4);
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
    public directiveArgs(): DirectiveArgsContext {
        let localContext = new DirectiveArgsContext(this.context, this.state);
        this.enterRule(localContext, 50, LanglyParser.RULE_directiveArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 306;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 31) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 311;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 307;
                this.match(LanglyParser.T__5);
                this.state = 308;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 31) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                }
                this.state = 313;
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
    public paramList(): ParamListContext {
        let localContext = new ParamListContext(this.context, this.state);
        this.enterRule(localContext, 52, LanglyParser.RULE_paramList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 314;
            this.param();
            this.state = 319;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 315;
                this.match(LanglyParser.T__5);
                this.state = 316;
                this.param();
                }
                }
                this.state = 321;
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
    public param(): ParamContext {
        let localContext = new ParamContext(this.context, this.state);
        this.enterRule(localContext, 54, LanglyParser.RULE_param);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 322;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 323;
            this.match(LanglyParser.T__1);
            this.state = 324;
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
        this.enterRule(localContext, 56, LanglyParser.RULE_typeRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 326;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 331;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 7) {
                {
                {
                this.state = 327;
                this.match(LanglyParser.T__6);
                this.state = 328;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 333;
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
    public pipeline(): PipelineContext {
        let localContext = new PipelineContext(this.context, this.state);
        this.enterRule(localContext, 58, LanglyParser.RULE_pipeline);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 335;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 334;
                this.pipelineStage();
                }
                }
                this.state = 337;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (((((_la - 25)) & ~0x1F) === 0 && ((1 << (_la - 25)) & 7991297) !== 0));
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
    public pipelineStage(): PipelineStageContext {
        let localContext = new PipelineStageContext(this.context, this.state);
        this.enterRule(localContext, 60, LanglyParser.RULE_pipelineStage);
        try {
            this.state = 353;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.PIPE:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 339;
                this.match(LanglyParser.PIPE);
                this.state = 340;
                this.callExpr();
                }
                break;
            case LanglyParser.GATE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 341;
                this.match(LanglyParser.GATE);
                this.state = 342;
                this.condition();
                }
                break;
            case LanglyParser.INTERRUPT:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 343;
                this.match(LanglyParser.INTERRUPT);
                this.state = 344;
                this.yieldExpr();
                }
                break;
            case LanglyParser.FANOUT:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 345;
                this.match(LanglyParser.FANOUT);
                this.state = 346;
                this.match(LanglyParser.T__21);
                this.state = 347;
                this.fanoutStages();
                this.state = 348;
                this.match(LanglyParser.T__22);
                }
                break;
            case LanglyParser.LISTEN:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 350;
                this.match(LanglyParser.LISTEN);
                this.state = 351;
                this.listenExpr();
                }
                break;
            case LanglyParser.T__24:
            case LanglyParser.IDENTIFIER:
            case LanglyParser.STRING:
            case LanglyParser.NUMBER:
            case LanglyParser.BOOL:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 352;
                this.expression();
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
    public condition(): ConditionContext {
        let localContext = new ConditionContext(this.context, this.state);
        this.enterRule(localContext, 62, LanglyParser.RULE_condition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 355;
            this.match(LanglyParser.T__3);
            this.state = 356;
            this.conditionExpr();
            this.state = 357;
            this.match(LanglyParser.T__4);
            this.state = 359;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 358;
                this.match(LanglyParser.T__23);
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
    public conditionExpr(): ConditionExprContext {
        let localContext = new ConditionExprContext(this.context, this.state);
        this.enterRule(localContext, 64, LanglyParser.RULE_conditionExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 361;
            this.expression();
            this.state = 365;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4227858432) !== 0)) {
                {
                this.state = 362;
                this.comparisonOp();
                this.state = 363;
                this.expression();
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
    public contextRef(): ContextRefContext {
        let localContext = new ContextRefContext(this.context, this.state);
        this.enterRule(localContext, 66, LanglyParser.RULE_contextRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 367;
            this.match(LanglyParser.T__24);
            this.state = 368;
            this.match(LanglyParser.T__6);
            this.state = 369;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 371;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 7) {
                {
                this.state = 370;
                this.contextTail();
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
    public contextTail(): ContextTailContext {
        let localContext = new ContextTailContext(this.context, this.state);
        this.enterRule(localContext, 68, LanglyParser.RULE_contextTail);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 373;
            this.match(LanglyParser.T__6);
            this.state = 375;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 374;
                    this.match(LanglyParser.IDENTIFIER);
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 377;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
            } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
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
    public comparisonOp(): ComparisonOpContext {
        let localContext = new ComparisonOpContext(this.context, this.state);
        this.enterRule(localContext, 70, LanglyParser.RULE_comparisonOp);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 379;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 4227858432) !== 0))) {
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
    public fanoutStages(): FanoutStagesContext {
        let localContext = new FanoutStagesContext(this.context, this.state);
        this.enterRule(localContext, 72, LanglyParser.RULE_fanoutStages);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 381;
            this.fanoutStage();
            this.state = 386;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 382;
                this.match(LanglyParser.T__5);
                this.state = 383;
                this.fanoutStage();
                }
                }
                this.state = 388;
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
    public fanoutStage(): FanoutStageContext {
        let localContext = new FanoutStageContext(this.context, this.state);
        this.enterRule(localContext, 74, LanglyParser.RULE_fanoutStage);
        try {
            this.state = 391;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 35, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 389;
                this.callExpr();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 390;
                this.match(LanglyParser.IDENTIFIER);
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
    public yieldExpr(): YieldExprContext {
        let localContext = new YieldExprContext(this.context, this.state);
        this.enterRule(localContext, 76, LanglyParser.RULE_yieldExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 393;
            this.match(LanglyParser.T__31);
            this.state = 394;
            this.match(LanglyParser.T__3);
            this.state = 396;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 11 || _la === 25 || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 63) !== 0)) {
                {
                this.state = 395;
                this.yieldArgs();
                }
            }

            this.state = 398;
            this.match(LanglyParser.T__4);
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
    public yieldArgs(): YieldArgsContext {
        let localContext = new YieldArgsContext(this.context, this.state);
        this.enterRule(localContext, 78, LanglyParser.RULE_yieldArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 400;
            this.yieldArg();
            this.state = 405;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 401;
                this.match(LanglyParser.T__5);
                this.state = 402;
                this.yieldArg();
                }
                }
                this.state = 407;
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
    public yieldArg(): YieldArgContext {
        let localContext = new YieldArgContext(this.context, this.state);
        this.enterRule(localContext, 80, LanglyParser.RULE_yieldArg);
        try {
            this.state = 412;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 408;
                this.match(LanglyParser.IDENTIFIER);
                this.state = 409;
                this.match(LanglyParser.T__1);
                this.state = 410;
                this.yieldArgValue();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 411;
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
    public yieldArgValue(): YieldArgValueContext {
        let localContext = new YieldArgValueContext(this.context, this.state);
        this.enterRule(localContext, 82, LanglyParser.RULE_yieldArgValue);
        let _la: number;
        try {
            this.state = 426;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 40, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 414;
                this.callValue();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 415;
                this.match(LanglyParser.T__10);
                this.state = 416;
                this.callValue();
                this.state = 421;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 6) {
                    {
                    {
                    this.state = 417;
                    this.match(LanglyParser.T__5);
                    this.state = 418;
                    this.callValue();
                    }
                    }
                    this.state = 423;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 424;
                this.match(LanglyParser.T__11);
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
    public listenExpr(): ListenExprContext {
        let localContext = new ListenExprContext(this.context, this.state);
        this.enterRule(localContext, 84, LanglyParser.RULE_listenExpr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 428;
            this.match(LanglyParser.T__32);
            this.state = 429;
            this.match(LanglyParser.T__3);
            this.state = 430;
            this.listenTarget();
            this.state = 431;
            this.match(LanglyParser.T__4);
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
    public listenTarget(): ListenTargetContext {
        let localContext = new ListenTargetContext(this.context, this.state);
        this.enterRule(localContext, 86, LanglyParser.RULE_listenTarget);
        try {
            this.state = 435;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 433;
                this.dottedId();
                }
                break;
            case LanglyParser.T__24:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 434;
                this.contextRef();
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
    public expression(): ExpressionContext {
        let localContext = new ExpressionContext(this.context, this.state);
        this.enterRule(localContext, 88, LanglyParser.RULE_expression);
        try {
            this.state = 442;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 437;
                this.match(LanglyParser.IDENTIFIER);
                }
                break;
            case LanglyParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 438;
                this.match(LanglyParser.STRING);
                }
                break;
            case LanglyParser.NUMBER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 439;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case LanglyParser.BOOL:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 440;
                this.match(LanglyParser.BOOL);
                }
                break;
            case LanglyParser.T__24:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 441;
                this.contextRef();
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
    public callExpr(): CallExprContext {
        let localContext = new CallExprContext(this.context, this.state);
        this.enterRule(localContext, 90, LanglyParser.RULE_callExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 444;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 445;
            this.match(LanglyParser.T__6);
            this.state = 446;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 447;
            this.match(LanglyParser.T__3);
            this.state = 449;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 11 || _la === 25 || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 63) !== 0)) {
                {
                this.state = 448;
                this.callArgs();
                }
            }

            this.state = 451;
            this.match(LanglyParser.T__4);
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
        this.enterRule(localContext, 92, LanglyParser.RULE_callArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 453;
            this.callArg();
            this.state = 458;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 454;
                this.match(LanglyParser.T__5);
                this.state = 455;
                this.callArg();
                }
                }
                this.state = 460;
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
    public callArg(): CallArgContext {
        let localContext = new CallArgContext(this.context, this.state);
        this.enterRule(localContext, 94, LanglyParser.RULE_callArg);
        try {
            this.state = 463;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 45, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 461;
                this.namedCallArg();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 462;
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
    public namedCallArg(): NamedCallArgContext {
        let localContext = new NamedCallArgContext(this.context, this.state);
        this.enterRule(localContext, 96, LanglyParser.RULE_namedCallArg);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 465;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 466;
            this.match(LanglyParser.T__1);
            this.state = 467;
            this.callValue();
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
        this.enterRule(localContext, 98, LanglyParser.RULE_callValue);
        try {
            this.state = 480;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.STRING:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 469;
                this.match(LanglyParser.STRING);
                }
                break;
            case LanglyParser.NUMBER:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 470;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case LanglyParser.BOOL:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 471;
                this.match(LanglyParser.BOOL);
                }
                break;
            case LanglyParser.DURATION:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 472;
                this.match(LanglyParser.DURATION);
                }
                break;
            case LanglyParser.MODEL_REF:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 473;
                this.match(LanglyParser.MODEL_REF);
                }
                break;
            case LanglyParser.T__24:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 474;
                this.contextRef();
                }
                break;
            case LanglyParser.T__10:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 475;
                this.match(LanglyParser.T__10);
                this.state = 476;
                this.callItems();
                this.state = 477;
                this.match(LanglyParser.T__11);
                }
                break;
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 479;
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
    public callItems(): CallItemsContext {
        let localContext = new CallItemsContext(this.context, this.state);
        this.enterRule(localContext, 100, LanglyParser.RULE_callItems);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 482;
            this.callValue();
            this.state = 487;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 483;
                this.match(LanglyParser.T__5);
                this.state = 484;
                this.callValue();
                }
                }
                this.state = 489;
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
    public value(): ValueContext {
        let localContext = new ValueContext(this.context, this.state);
        this.enterRule(localContext, 102, LanglyParser.RULE_value);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 490;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 43)) & ~0x1F) === 0 && ((1 << (_la - 43)) & 31) !== 0))) {
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

    public static readonly _serializedATN: number[] = [
        4,1,47,493,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,
        7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,
        2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,
        7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,1,0,5,0,106,
        8,0,10,0,12,0,109,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,3,1,118,8,1,1,
        2,1,2,1,2,1,2,1,2,1,2,5,2,126,8,2,10,2,12,2,129,9,2,1,3,1,3,1,3,
        3,3,134,8,3,1,3,1,3,1,4,1,4,1,4,5,4,141,8,4,10,4,12,4,144,9,4,1,
        5,1,5,1,5,1,5,1,5,3,5,151,8,5,1,6,1,6,1,6,5,6,156,8,6,10,6,12,6,
        159,9,6,1,7,1,7,1,7,1,7,1,7,1,7,3,7,167,8,7,1,7,1,7,1,8,1,8,1,8,
        5,8,174,8,8,10,8,12,8,177,9,8,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,
        9,1,9,3,9,189,8,9,3,9,191,8,9,1,10,1,10,1,10,1,10,1,10,1,10,3,10,
        199,8,10,1,10,1,10,1,11,1,11,1,11,5,11,206,8,11,10,11,12,11,209,
        9,11,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,3,12,219,8,12,3,12,
        221,8,12,1,13,5,13,224,8,13,10,13,12,13,227,9,13,1,13,1,13,1,13,
        1,13,1,13,1,13,3,13,235,8,13,1,14,4,14,238,8,14,11,14,12,14,239,
        1,15,1,15,1,15,1,15,3,15,246,8,15,1,16,1,16,1,16,5,16,251,8,16,10,
        16,12,16,254,9,16,1,17,1,17,1,17,5,17,259,8,17,10,17,12,17,262,9,
        17,1,18,1,18,1,18,5,18,267,8,18,10,18,12,18,270,9,18,1,19,1,19,1,
        20,1,20,1,20,1,20,1,21,5,21,279,8,21,10,21,12,21,282,9,21,1,21,1,
        21,1,21,1,21,3,21,288,8,21,1,21,1,21,1,21,1,21,1,21,1,21,1,22,1,
        22,1,22,3,22,299,8,22,1,23,1,23,1,24,1,24,1,24,1,24,1,25,1,25,1,
        25,5,25,310,8,25,10,25,12,25,313,9,25,1,26,1,26,1,26,5,26,318,8,
        26,10,26,12,26,321,9,26,1,27,1,27,1,27,1,27,1,28,1,28,1,28,5,28,
        330,8,28,10,28,12,28,333,9,28,1,29,4,29,336,8,29,11,29,12,29,337,
        1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,
        1,30,3,30,354,8,30,1,31,1,31,1,31,1,31,3,31,360,8,31,1,32,1,32,1,
        32,1,32,3,32,366,8,32,1,33,1,33,1,33,1,33,3,33,372,8,33,1,34,1,34,
        4,34,376,8,34,11,34,12,34,377,1,35,1,35,1,36,1,36,1,36,5,36,385,
        8,36,10,36,12,36,388,9,36,1,37,1,37,3,37,392,8,37,1,38,1,38,1,38,
        3,38,397,8,38,1,38,1,38,1,39,1,39,1,39,5,39,404,8,39,10,39,12,39,
        407,9,39,1,40,1,40,1,40,1,40,3,40,413,8,40,1,41,1,41,1,41,1,41,1,
        41,5,41,420,8,41,10,41,12,41,423,9,41,1,41,1,41,3,41,427,8,41,1,
        42,1,42,1,42,1,42,1,42,1,43,1,43,3,43,436,8,43,1,44,1,44,1,44,1,
        44,1,44,3,44,443,8,44,1,45,1,45,1,45,1,45,1,45,3,45,450,8,45,1,45,
        1,45,1,46,1,46,1,46,5,46,457,8,46,10,46,12,46,460,9,46,1,47,1,47,
        3,47,464,8,47,1,48,1,48,1,48,1,48,1,49,1,49,1,49,1,49,1,49,1,49,
        1,49,1,49,1,49,1,49,1,49,3,49,481,8,49,1,50,1,50,1,50,5,50,486,8,
        50,10,50,12,50,489,9,50,1,51,1,51,1,51,0,0,52,0,2,4,6,8,10,12,14,
        16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,
        60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,
        102,0,4,1,0,18,21,1,0,42,46,1,0,26,31,1,0,43,47,515,0,107,1,0,0,
        0,2,117,1,0,0,0,4,119,1,0,0,0,6,130,1,0,0,0,8,137,1,0,0,0,10,150,
        1,0,0,0,12,152,1,0,0,0,14,160,1,0,0,0,16,170,1,0,0,0,18,190,1,0,
        0,0,20,192,1,0,0,0,22,202,1,0,0,0,24,220,1,0,0,0,26,225,1,0,0,0,
        28,237,1,0,0,0,30,245,1,0,0,0,32,247,1,0,0,0,34,255,1,0,0,0,36,263,
        1,0,0,0,38,271,1,0,0,0,40,273,1,0,0,0,42,280,1,0,0,0,44,295,1,0,
        0,0,46,300,1,0,0,0,48,302,1,0,0,0,50,306,1,0,0,0,52,314,1,0,0,0,
        54,322,1,0,0,0,56,326,1,0,0,0,58,335,1,0,0,0,60,353,1,0,0,0,62,355,
        1,0,0,0,64,361,1,0,0,0,66,367,1,0,0,0,68,373,1,0,0,0,70,379,1,0,
        0,0,72,381,1,0,0,0,74,391,1,0,0,0,76,393,1,0,0,0,78,400,1,0,0,0,
        80,412,1,0,0,0,82,426,1,0,0,0,84,428,1,0,0,0,86,435,1,0,0,0,88,442,
        1,0,0,0,90,444,1,0,0,0,92,453,1,0,0,0,94,463,1,0,0,0,96,465,1,0,
        0,0,98,480,1,0,0,0,100,482,1,0,0,0,102,490,1,0,0,0,104,106,3,2,1,
        0,105,104,1,0,0,0,106,109,1,0,0,0,107,105,1,0,0,0,107,108,1,0,0,
        0,108,110,1,0,0,0,109,107,1,0,0,0,110,111,5,0,0,1,111,1,1,0,0,0,
        112,118,3,4,2,0,113,118,3,14,7,0,114,118,3,20,10,0,115,118,3,26,
        13,0,116,118,3,42,21,0,117,112,1,0,0,0,117,113,1,0,0,0,117,114,1,
        0,0,0,117,115,1,0,0,0,117,116,1,0,0,0,118,3,1,0,0,0,119,120,5,1,
        0,0,120,121,5,44,0,0,121,122,5,2,0,0,122,127,3,6,3,0,123,124,5,3,
        0,0,124,126,3,6,3,0,125,123,1,0,0,0,126,129,1,0,0,0,127,125,1,0,
        0,0,127,128,1,0,0,0,128,5,1,0,0,0,129,127,1,0,0,0,130,131,5,44,0,
        0,131,133,5,4,0,0,132,134,3,8,4,0,133,132,1,0,0,0,133,134,1,0,0,
        0,134,135,1,0,0,0,135,136,5,5,0,0,136,7,1,0,0,0,137,142,3,10,5,0,
        138,139,5,6,0,0,139,141,3,10,5,0,140,138,1,0,0,0,141,144,1,0,0,0,
        142,140,1,0,0,0,142,143,1,0,0,0,143,9,1,0,0,0,144,142,1,0,0,0,145,
        151,5,43,0,0,146,151,3,12,6,0,147,151,5,45,0,0,148,151,5,46,0,0,
        149,151,5,42,0,0,150,145,1,0,0,0,150,146,1,0,0,0,150,147,1,0,0,0,
        150,148,1,0,0,0,150,149,1,0,0,0,151,11,1,0,0,0,152,157,5,44,0,0,
        153,154,5,7,0,0,154,156,5,44,0,0,155,153,1,0,0,0,156,159,1,0,0,0,
        157,155,1,0,0,0,157,158,1,0,0,0,158,13,1,0,0,0,159,157,1,0,0,0,160,
        161,5,8,0,0,161,162,5,44,0,0,162,163,5,2,0,0,163,164,5,44,0,0,164,
        166,5,4,0,0,165,167,3,16,8,0,166,165,1,0,0,0,166,167,1,0,0,0,167,
        168,1,0,0,0,168,169,5,5,0,0,169,15,1,0,0,0,170,175,3,18,9,0,171,
        172,5,6,0,0,172,174,3,18,9,0,173,171,1,0,0,0,174,177,1,0,0,0,175,
        173,1,0,0,0,175,176,1,0,0,0,176,17,1,0,0,0,177,175,1,0,0,0,178,191,
        5,45,0,0,179,191,5,46,0,0,180,191,5,42,0,0,181,191,3,12,6,0,182,
        183,5,44,0,0,183,188,5,2,0,0,184,189,5,45,0,0,185,189,5,46,0,0,186,
        189,5,42,0,0,187,189,3,12,6,0,188,184,1,0,0,0,188,185,1,0,0,0,188,
        186,1,0,0,0,188,187,1,0,0,0,189,191,1,0,0,0,190,178,1,0,0,0,190,
        179,1,0,0,0,190,180,1,0,0,0,190,181,1,0,0,0,190,182,1,0,0,0,191,
        19,1,0,0,0,192,193,5,9,0,0,193,194,5,44,0,0,194,195,5,2,0,0,195,
        196,5,44,0,0,196,198,5,4,0,0,197,199,3,22,11,0,198,197,1,0,0,0,198,
        199,1,0,0,0,199,200,1,0,0,0,200,201,5,5,0,0,201,21,1,0,0,0,202,207,
        3,24,12,0,203,204,5,6,0,0,204,206,3,24,12,0,205,203,1,0,0,0,206,
        209,1,0,0,0,207,205,1,0,0,0,207,208,1,0,0,0,208,23,1,0,0,0,209,207,
        1,0,0,0,210,221,5,45,0,0,211,221,5,46,0,0,212,221,3,12,6,0,213,214,
        5,44,0,0,214,218,5,2,0,0,215,219,5,45,0,0,216,219,5,46,0,0,217,219,
        3,12,6,0,218,215,1,0,0,0,218,216,1,0,0,0,218,217,1,0,0,0,219,221,
        1,0,0,0,220,210,1,0,0,0,220,211,1,0,0,0,220,212,1,0,0,0,220,213,
        1,0,0,0,221,25,1,0,0,0,222,224,3,44,22,0,223,222,1,0,0,0,224,227,
        1,0,0,0,225,223,1,0,0,0,225,226,1,0,0,0,226,228,1,0,0,0,227,225,
        1,0,0,0,228,229,5,10,0,0,229,230,5,44,0,0,230,231,5,11,0,0,231,232,
        3,36,18,0,232,234,5,12,0,0,233,235,3,28,14,0,234,233,1,0,0,0,234,
        235,1,0,0,0,235,27,1,0,0,0,236,238,3,30,15,0,237,236,1,0,0,0,238,
        239,1,0,0,0,239,237,1,0,0,0,239,240,1,0,0,0,240,29,1,0,0,0,241,242,
        5,13,0,0,242,246,3,32,16,0,243,244,5,14,0,0,244,246,3,34,17,0,245,
        241,1,0,0,0,245,243,1,0,0,0,246,31,1,0,0,0,247,252,5,44,0,0,248,
        249,5,6,0,0,249,251,5,44,0,0,250,248,1,0,0,0,251,254,1,0,0,0,252,
        250,1,0,0,0,252,253,1,0,0,0,253,33,1,0,0,0,254,252,1,0,0,0,255,260,
        5,44,0,0,256,257,5,6,0,0,257,259,5,44,0,0,258,256,1,0,0,0,259,262,
        1,0,0,0,260,258,1,0,0,0,260,261,1,0,0,0,261,35,1,0,0,0,262,260,1,
        0,0,0,263,268,3,38,19,0,264,265,5,6,0,0,265,267,3,40,20,0,266,264,
        1,0,0,0,267,270,1,0,0,0,268,266,1,0,0,0,268,269,1,0,0,0,269,37,1,
        0,0,0,270,268,1,0,0,0,271,272,5,43,0,0,272,39,1,0,0,0,273,274,5,
        44,0,0,274,275,5,2,0,0,275,276,3,102,51,0,276,41,1,0,0,0,277,279,
        3,44,22,0,278,277,1,0,0,0,279,282,1,0,0,0,280,278,1,0,0,0,280,281,
        1,0,0,0,281,283,1,0,0,0,282,280,1,0,0,0,283,284,5,15,0,0,284,285,
        5,44,0,0,285,287,5,4,0,0,286,288,3,52,26,0,287,286,1,0,0,0,287,288,
        1,0,0,0,288,289,1,0,0,0,289,290,5,5,0,0,290,291,5,16,0,0,291,292,
        3,56,28,0,292,293,5,2,0,0,293,294,3,58,29,0,294,43,1,0,0,0,295,296,
        5,17,0,0,296,298,3,46,23,0,297,299,3,48,24,0,298,297,1,0,0,0,298,
        299,1,0,0,0,299,45,1,0,0,0,300,301,7,0,0,0,301,47,1,0,0,0,302,303,
        5,4,0,0,303,304,3,50,25,0,304,305,5,5,0,0,305,49,1,0,0,0,306,311,
        7,1,0,0,307,308,5,6,0,0,308,310,7,1,0,0,309,307,1,0,0,0,310,313,
        1,0,0,0,311,309,1,0,0,0,311,312,1,0,0,0,312,51,1,0,0,0,313,311,1,
        0,0,0,314,319,3,54,27,0,315,316,5,6,0,0,316,318,3,54,27,0,317,315,
        1,0,0,0,318,321,1,0,0,0,319,317,1,0,0,0,319,320,1,0,0,0,320,53,1,
        0,0,0,321,319,1,0,0,0,322,323,5,44,0,0,323,324,5,2,0,0,324,325,3,
        56,28,0,325,55,1,0,0,0,326,331,5,44,0,0,327,328,5,7,0,0,328,330,
        5,44,0,0,329,327,1,0,0,0,330,333,1,0,0,0,331,329,1,0,0,0,331,332,
        1,0,0,0,332,57,1,0,0,0,333,331,1,0,0,0,334,336,3,60,30,0,335,334,
        1,0,0,0,336,337,1,0,0,0,337,335,1,0,0,0,337,338,1,0,0,0,338,59,1,
        0,0,0,339,340,5,41,0,0,340,354,3,90,45,0,341,342,5,39,0,0,342,354,
        3,62,31,0,343,344,5,38,0,0,344,354,3,76,38,0,345,346,5,37,0,0,346,
        347,5,22,0,0,347,348,3,72,36,0,348,349,5,23,0,0,349,354,1,0,0,0,
        350,351,5,40,0,0,351,354,3,84,42,0,352,354,3,88,44,0,353,339,1,0,
        0,0,353,341,1,0,0,0,353,343,1,0,0,0,353,345,1,0,0,0,353,350,1,0,
        0,0,353,352,1,0,0,0,354,61,1,0,0,0,355,356,5,4,0,0,356,357,3,64,
        32,0,357,359,5,5,0,0,358,360,5,24,0,0,359,358,1,0,0,0,359,360,1,
        0,0,0,360,63,1,0,0,0,361,365,3,88,44,0,362,363,3,70,35,0,363,364,
        3,88,44,0,364,366,1,0,0,0,365,362,1,0,0,0,365,366,1,0,0,0,366,65,
        1,0,0,0,367,368,5,25,0,0,368,369,5,7,0,0,369,371,5,44,0,0,370,372,
        3,68,34,0,371,370,1,0,0,0,371,372,1,0,0,0,372,67,1,0,0,0,373,375,
        5,7,0,0,374,376,5,44,0,0,375,374,1,0,0,0,376,377,1,0,0,0,377,375,
        1,0,0,0,377,378,1,0,0,0,378,69,1,0,0,0,379,380,7,2,0,0,380,71,1,
        0,0,0,381,386,3,74,37,0,382,383,5,6,0,0,383,385,3,74,37,0,384,382,
        1,0,0,0,385,388,1,0,0,0,386,384,1,0,0,0,386,387,1,0,0,0,387,73,1,
        0,0,0,388,386,1,0,0,0,389,392,3,90,45,0,390,392,5,44,0,0,391,389,
        1,0,0,0,391,390,1,0,0,0,392,75,1,0,0,0,393,394,5,32,0,0,394,396,
        5,4,0,0,395,397,3,78,39,0,396,395,1,0,0,0,396,397,1,0,0,0,397,398,
        1,0,0,0,398,399,5,5,0,0,399,77,1,0,0,0,400,405,3,80,40,0,401,402,
        5,6,0,0,402,404,3,80,40,0,403,401,1,0,0,0,404,407,1,0,0,0,405,403,
        1,0,0,0,405,406,1,0,0,0,406,79,1,0,0,0,407,405,1,0,0,0,408,409,5,
        44,0,0,409,410,5,2,0,0,410,413,3,82,41,0,411,413,3,98,49,0,412,408,
        1,0,0,0,412,411,1,0,0,0,413,81,1,0,0,0,414,427,3,98,49,0,415,416,
        5,11,0,0,416,421,3,98,49,0,417,418,5,6,0,0,418,420,3,98,49,0,419,
        417,1,0,0,0,420,423,1,0,0,0,421,419,1,0,0,0,421,422,1,0,0,0,422,
        424,1,0,0,0,423,421,1,0,0,0,424,425,5,12,0,0,425,427,1,0,0,0,426,
        414,1,0,0,0,426,415,1,0,0,0,427,83,1,0,0,0,428,429,5,33,0,0,429,
        430,5,4,0,0,430,431,3,86,43,0,431,432,5,5,0,0,432,85,1,0,0,0,433,
        436,3,12,6,0,434,436,3,66,33,0,435,433,1,0,0,0,435,434,1,0,0,0,436,
        87,1,0,0,0,437,443,5,44,0,0,438,443,5,45,0,0,439,443,5,46,0,0,440,
        443,5,47,0,0,441,443,3,66,33,0,442,437,1,0,0,0,442,438,1,0,0,0,442,
        439,1,0,0,0,442,440,1,0,0,0,442,441,1,0,0,0,443,89,1,0,0,0,444,445,
        5,44,0,0,445,446,5,7,0,0,446,447,5,44,0,0,447,449,5,4,0,0,448,450,
        3,92,46,0,449,448,1,0,0,0,449,450,1,0,0,0,450,451,1,0,0,0,451,452,
        5,5,0,0,452,91,1,0,0,0,453,458,3,94,47,0,454,455,5,6,0,0,455,457,
        3,94,47,0,456,454,1,0,0,0,457,460,1,0,0,0,458,456,1,0,0,0,458,459,
        1,0,0,0,459,93,1,0,0,0,460,458,1,0,0,0,461,464,3,96,48,0,462,464,
        3,98,49,0,463,461,1,0,0,0,463,462,1,0,0,0,464,95,1,0,0,0,465,466,
        5,44,0,0,466,467,5,2,0,0,467,468,3,98,49,0,468,97,1,0,0,0,469,481,
        5,45,0,0,470,481,5,46,0,0,471,481,5,47,0,0,472,481,5,42,0,0,473,
        481,5,43,0,0,474,481,3,66,33,0,475,476,5,11,0,0,476,477,3,100,50,
        0,477,478,5,12,0,0,478,481,1,0,0,0,479,481,3,12,6,0,480,469,1,0,
        0,0,480,470,1,0,0,0,480,471,1,0,0,0,480,472,1,0,0,0,480,473,1,0,
        0,0,480,474,1,0,0,0,480,475,1,0,0,0,480,479,1,0,0,0,481,99,1,0,0,
        0,482,487,3,98,49,0,483,484,5,6,0,0,484,486,3,98,49,0,485,483,1,
        0,0,0,486,489,1,0,0,0,487,485,1,0,0,0,487,488,1,0,0,0,488,101,1,
        0,0,0,489,487,1,0,0,0,490,491,7,3,0,0,491,103,1,0,0,0,48,107,117,
        127,133,142,150,157,166,175,188,190,198,207,218,220,225,234,239,
        245,252,260,268,280,287,298,311,319,331,337,353,359,365,371,377,
        386,391,396,405,412,421,426,435,442,449,458,463,480,487
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!LanglyParser.__ATN) {
            LanglyParser.__ATN = new antlr.ATNDeserializer().deserialize(LanglyParser._serializedATN);
        }

        return LanglyParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(LanglyParser.literalNames, LanglyParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return LanglyParser.vocabulary;
    }

    private static readonly decisionsToDFA = LanglyParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class ProgramContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(LanglyParser.EOF, 0)!;
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
        return LanglyParser.RULE_program;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterProgram) {
             listener.enterProgram(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitProgram) {
             listener.exitProgram(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
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
    public guardrailDecl(): GuardrailDeclContext | null {
        return this.getRuleContext(0, GuardrailDeclContext);
    }
    public toolDecl(): ToolDeclContext | null {
        return this.getRuleContext(0, ToolDeclContext);
    }
    public memoryDecl(): MemoryDeclContext | null {
        return this.getRuleContext(0, MemoryDeclContext);
    }
    public mindDecl(): MindDeclContext | null {
        return this.getRuleContext(0, MindDeclContext);
    }
    public streamDecl(): StreamDeclContext | null {
        return this.getRuleContext(0, StreamDeclContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_declaration;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterDeclaration) {
             listener.enterDeclaration(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitDeclaration) {
             listener.exitDeclaration(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitDeclaration) {
            return visitor.visitDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GuardrailDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public guardrailRule(): GuardrailRuleContext[];
    public guardrailRule(i: number): GuardrailRuleContext | null;
    public guardrailRule(i?: number): GuardrailRuleContext[] | GuardrailRuleContext | null {
        if (i === undefined) {
            return this.getRuleContexts(GuardrailRuleContext);
        }

        return this.getRuleContext(i, GuardrailRuleContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_guardrailDecl;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterGuardrailDecl) {
             listener.enterGuardrailDecl(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitGuardrailDecl) {
             listener.exitGuardrailDecl(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitGuardrailDecl) {
            return visitor.visitGuardrailDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GuardrailRuleContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public guardrailArgs(): GuardrailArgsContext | null {
        return this.getRuleContext(0, GuardrailArgsContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_guardrailRule;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterGuardrailRule) {
             listener.enterGuardrailRule(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitGuardrailRule) {
             listener.exitGuardrailRule(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitGuardrailRule) {
            return visitor.visitGuardrailRule(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GuardrailArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public guardrailArg(): GuardrailArgContext[];
    public guardrailArg(i: number): GuardrailArgContext | null;
    public guardrailArg(i?: number): GuardrailArgContext[] | GuardrailArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(GuardrailArgContext);
        }

        return this.getRuleContext(i, GuardrailArgContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_guardrailArgs;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterGuardrailArgs) {
             listener.enterGuardrailArgs(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitGuardrailArgs) {
             listener.exitGuardrailArgs(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitGuardrailArgs) {
            return visitor.visitGuardrailArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GuardrailArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.MODEL_REF, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.NUMBER, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.DURATION, 0);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_guardrailArg;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterGuardrailArg) {
             listener.enterGuardrailArg(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitGuardrailArg) {
             listener.exitGuardrailArg(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitGuardrailArg) {
            return visitor.visitGuardrailArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DottedIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_dottedId;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterDottedId) {
             listener.enterDottedId(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitDottedId) {
             listener.exitDottedId(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitDottedId) {
            return visitor.visitDottedId(this);
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
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public toolArgs(): ToolArgsContext | null {
        return this.getRuleContext(0, ToolArgsContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_toolDecl;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterToolDecl) {
             listener.enterToolDecl(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitToolDecl) {
             listener.exitToolDecl(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitToolDecl) {
            return visitor.visitToolDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ToolArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public toolArg(): ToolArgContext[];
    public toolArg(i: number): ToolArgContext | null;
    public toolArg(i?: number): ToolArgContext[] | ToolArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ToolArgContext);
        }

        return this.getRuleContext(i, ToolArgContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_toolArgs;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterToolArgs) {
             listener.enterToolArgs(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitToolArgs) {
             listener.exitToolArgs(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitToolArgs) {
            return visitor.visitToolArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ToolArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.NUMBER, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.DURATION, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.IDENTIFIER, 0);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_toolArg;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterToolArg) {
             listener.enterToolArg(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitToolArg) {
             listener.exitToolArg(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitToolArg) {
            return visitor.visitToolArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemoryDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public memoryArgs(): MemoryArgsContext | null {
        return this.getRuleContext(0, MemoryArgsContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_memoryDecl;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterMemoryDecl) {
             listener.enterMemoryDecl(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitMemoryDecl) {
             listener.exitMemoryDecl(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitMemoryDecl) {
            return visitor.visitMemoryDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemoryArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public memoryArg(): MemoryArgContext[];
    public memoryArg(i: number): MemoryArgContext | null;
    public memoryArg(i?: number): MemoryArgContext[] | MemoryArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MemoryArgContext);
        }

        return this.getRuleContext(i, MemoryArgContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_memoryArgs;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterMemoryArgs) {
             listener.enterMemoryArgs(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitMemoryArgs) {
             listener.exitMemoryArgs(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitMemoryArgs) {
            return visitor.visitMemoryArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemoryArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.NUMBER, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.IDENTIFIER, 0);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_memoryArg;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterMemoryArg) {
             listener.enterMemoryArg(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitMemoryArg) {
             listener.exitMemoryArg(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitMemoryArg) {
            return visitor.visitMemoryArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MindDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public modelConfig(): ModelConfigContext {
        return this.getRuleContext(0, ModelConfigContext)!;
    }
    public directive(): DirectiveContext[];
    public directive(i: number): DirectiveContext | null;
    public directive(i?: number): DirectiveContext[] | DirectiveContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DirectiveContext);
        }

        return this.getRuleContext(i, DirectiveContext);
    }
    public mindModifiers(): MindModifiersContext | null {
        return this.getRuleContext(0, MindModifiersContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_mindDecl;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterMindDecl) {
             listener.enterMindDecl(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitMindDecl) {
             listener.exitMindDecl(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitMindDecl) {
            return visitor.visitMindDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MindModifiersContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public mindModifier(): MindModifierContext[];
    public mindModifier(i: number): MindModifierContext | null;
    public mindModifier(i?: number): MindModifierContext[] | MindModifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MindModifierContext);
        }

        return this.getRuleContext(i, MindModifierContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_mindModifiers;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterMindModifiers) {
             listener.enterMindModifiers(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitMindModifiers) {
             listener.exitMindModifiers(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitMindModifiers) {
            return visitor.visitMindModifiers(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MindModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public equipsList(): EquipsListContext | null {
        return this.getRuleContext(0, EquipsListContext);
    }
    public requiresList(): RequiresListContext | null {
        return this.getRuleContext(0, RequiresListContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_mindModifier;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterMindModifier) {
             listener.enterMindModifier(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitMindModifier) {
             listener.exitMindModifier(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitMindModifier) {
            return visitor.visitMindModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EquipsListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_equipsList;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterEquipsList) {
             listener.enterEquipsList(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitEquipsList) {
             listener.exitEquipsList(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitEquipsList) {
            return visitor.visitEquipsList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RequiresListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_requiresList;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterRequiresList) {
             listener.enterRequiresList(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitRequiresList) {
             listener.exitRequiresList(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitRequiresList) {
            return visitor.visitRequiresList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ModelConfigContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public modelId(): ModelIdContext {
        return this.getRuleContext(0, ModelIdContext)!;
    }
    public modelParam(): ModelParamContext[];
    public modelParam(i: number): ModelParamContext | null;
    public modelParam(i?: number): ModelParamContext[] | ModelParamContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ModelParamContext);
        }

        return this.getRuleContext(i, ModelParamContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_modelConfig;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterModelConfig) {
             listener.enterModelConfig(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitModelConfig) {
             listener.exitModelConfig(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitModelConfig) {
            return visitor.visitModelConfig(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ModelIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public MODEL_REF(): antlr.TerminalNode {
        return this.getToken(LanglyParser.MODEL_REF, 0)!;
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_modelId;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterModelId) {
             listener.enterModelId(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitModelId) {
             listener.exitModelId(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitModelId) {
            return visitor.visitModelId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ModelParamContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public value(): ValueContext {
        return this.getRuleContext(0, ValueContext)!;
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_modelParam;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterModelParam) {
             listener.enterModelParam(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitModelParam) {
             listener.exitModelParam(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitModelParam) {
            return visitor.visitModelParam(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StreamDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public typeRef(): TypeRefContext {
        return this.getRuleContext(0, TypeRefContext)!;
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
    public override get ruleIndex(): number {
        return LanglyParser.RULE_streamDecl;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterStreamDecl) {
             listener.enterStreamDecl(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitStreamDecl) {
             listener.exitStreamDecl(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitStreamDecl) {
            return visitor.visitStreamDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public directiveName(): DirectiveNameContext {
        return this.getRuleContext(0, DirectiveNameContext)!;
    }
    public directiveValue(): DirectiveValueContext | null {
        return this.getRuleContext(0, DirectiveValueContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_directive;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterDirective) {
             listener.enterDirective(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitDirective) {
             listener.exitDirective(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitDirective) {
            return visitor.visitDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectiveNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_directiveName;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterDirectiveName) {
             listener.enterDirectiveName(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitDirectiveName) {
             listener.exitDirectiveName(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitDirectiveName) {
            return visitor.visitDirectiveName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectiveValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public directiveArgs(): DirectiveArgsContext {
        return this.getRuleContext(0, DirectiveArgsContext)!;
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_directiveValue;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterDirectiveValue) {
             listener.enterDirectiveValue(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitDirectiveValue) {
             listener.exitDirectiveValue(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitDirectiveValue) {
            return visitor.visitDirectiveValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectiveArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public NUMBER(): antlr.TerminalNode[];
    public NUMBER(i: number): antlr.TerminalNode | null;
    public NUMBER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.NUMBER);
    	} else {
    		return this.getToken(LanglyParser.NUMBER, i);
    	}
    }
    public STRING(): antlr.TerminalNode[];
    public STRING(i: number): antlr.TerminalNode | null;
    public STRING(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.STRING);
    	} else {
    		return this.getToken(LanglyParser.STRING, i);
    	}
    }
    public MODEL_REF(): antlr.TerminalNode[];
    public MODEL_REF(i: number): antlr.TerminalNode | null;
    public MODEL_REF(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.MODEL_REF);
    	} else {
    		return this.getToken(LanglyParser.MODEL_REF, i);
    	}
    }
    public DURATION(): antlr.TerminalNode[];
    public DURATION(i: number): antlr.TerminalNode | null;
    public DURATION(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.DURATION);
    	} else {
    		return this.getToken(LanglyParser.DURATION, i);
    	}
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_directiveArgs;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterDirectiveArgs) {
             listener.enterDirectiveArgs(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitDirectiveArgs) {
             listener.exitDirectiveArgs(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitDirectiveArgs) {
            return visitor.visitDirectiveArgs(this);
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
        return LanglyParser.RULE_paramList;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterParamList) {
             listener.enterParamList(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitParamList) {
             listener.exitParamList(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
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
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public typeRef(): TypeRefContext {
        return this.getRuleContext(0, TypeRefContext)!;
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_param;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterParam) {
             listener.enterParam(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitParam) {
             listener.exitParam(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
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
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_typeRef;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterTypeRef) {
             listener.enterTypeRef(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitTypeRef) {
             listener.exitTypeRef(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
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
    public pipelineStage(): PipelineStageContext[];
    public pipelineStage(i: number): PipelineStageContext | null;
    public pipelineStage(i?: number): PipelineStageContext[] | PipelineStageContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PipelineStageContext);
        }

        return this.getRuleContext(i, PipelineStageContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_pipeline;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterPipeline) {
             listener.enterPipeline(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitPipeline) {
             listener.exitPipeline(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitPipeline) {
            return visitor.visitPipeline(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PipelineStageContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PIPE(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.PIPE, 0);
    }
    public callExpr(): CallExprContext | null {
        return this.getRuleContext(0, CallExprContext);
    }
    public GATE(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.GATE, 0);
    }
    public condition(): ConditionContext | null {
        return this.getRuleContext(0, ConditionContext);
    }
    public INTERRUPT(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.INTERRUPT, 0);
    }
    public yieldExpr(): YieldExprContext | null {
        return this.getRuleContext(0, YieldExprContext);
    }
    public FANOUT(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.FANOUT, 0);
    }
    public fanoutStages(): FanoutStagesContext | null {
        return this.getRuleContext(0, FanoutStagesContext);
    }
    public LISTEN(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.LISTEN, 0);
    }
    public listenExpr(): ListenExprContext | null {
        return this.getRuleContext(0, ListenExprContext);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_pipelineStage;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterPipelineStage) {
             listener.enterPipelineStage(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitPipelineStage) {
             listener.exitPipelineStage(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitPipelineStage) {
            return visitor.visitPipelineStage(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConditionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public conditionExpr(): ConditionExprContext {
        return this.getRuleContext(0, ConditionExprContext)!;
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_condition;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterCondition) {
             listener.enterCondition(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitCondition) {
             listener.exitCondition(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitCondition) {
            return visitor.visitCondition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConditionExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext[];
    public expression(i: number): ExpressionContext | null;
    public expression(i?: number): ExpressionContext[] | ExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }

        return this.getRuleContext(i, ExpressionContext);
    }
    public comparisonOp(): ComparisonOpContext | null {
        return this.getRuleContext(0, ComparisonOpContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_conditionExpr;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterConditionExpr) {
             listener.enterConditionExpr(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitConditionExpr) {
             listener.exitConditionExpr(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitConditionExpr) {
            return visitor.visitConditionExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ContextRefContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public contextTail(): ContextTailContext | null {
        return this.getRuleContext(0, ContextTailContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_contextRef;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterContextRef) {
             listener.enterContextRef(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitContextRef) {
             listener.exitContextRef(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitContextRef) {
            return visitor.visitContextRef(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ContextTailContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_contextTail;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterContextTail) {
             listener.enterContextTail(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitContextTail) {
             listener.exitContextTail(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitContextTail) {
            return visitor.visitContextTail(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ComparisonOpContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_comparisonOp;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterComparisonOp) {
             listener.enterComparisonOp(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitComparisonOp) {
             listener.exitComparisonOp(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitComparisonOp) {
            return visitor.visitComparisonOp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FanoutStagesContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public fanoutStage(): FanoutStageContext[];
    public fanoutStage(i: number): FanoutStageContext | null;
    public fanoutStage(i?: number): FanoutStageContext[] | FanoutStageContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FanoutStageContext);
        }

        return this.getRuleContext(i, FanoutStageContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_fanoutStages;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterFanoutStages) {
             listener.enterFanoutStages(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitFanoutStages) {
             listener.exitFanoutStages(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitFanoutStages) {
            return visitor.visitFanoutStages(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FanoutStageContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public callExpr(): CallExprContext | null {
        return this.getRuleContext(0, CallExprContext);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.IDENTIFIER, 0);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_fanoutStage;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterFanoutStage) {
             listener.enterFanoutStage(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitFanoutStage) {
             listener.exitFanoutStage(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitFanoutStage) {
            return visitor.visitFanoutStage(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class YieldExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public yieldArgs(): YieldArgsContext | null {
        return this.getRuleContext(0, YieldArgsContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_yieldExpr;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterYieldExpr) {
             listener.enterYieldExpr(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitYieldExpr) {
             listener.exitYieldExpr(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitYieldExpr) {
            return visitor.visitYieldExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class YieldArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public yieldArg(): YieldArgContext[];
    public yieldArg(i: number): YieldArgContext | null;
    public yieldArg(i?: number): YieldArgContext[] | YieldArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(YieldArgContext);
        }

        return this.getRuleContext(i, YieldArgContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_yieldArgs;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterYieldArgs) {
             listener.enterYieldArgs(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitYieldArgs) {
             listener.exitYieldArgs(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitYieldArgs) {
            return visitor.visitYieldArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class YieldArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.IDENTIFIER, 0);
    }
    public yieldArgValue(): YieldArgValueContext | null {
        return this.getRuleContext(0, YieldArgValueContext);
    }
    public callValue(): CallValueContext | null {
        return this.getRuleContext(0, CallValueContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_yieldArg;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterYieldArg) {
             listener.enterYieldArg(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitYieldArg) {
             listener.exitYieldArg(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitYieldArg) {
            return visitor.visitYieldArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class YieldArgValueContext extends antlr.ParserRuleContext {
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
        return LanglyParser.RULE_yieldArgValue;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterYieldArgValue) {
             listener.enterYieldArgValue(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitYieldArgValue) {
             listener.exitYieldArgValue(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitYieldArgValue) {
            return visitor.visitYieldArgValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ListenExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public listenTarget(): ListenTargetContext {
        return this.getRuleContext(0, ListenTargetContext)!;
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_listenExpr;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterListenExpr) {
             listener.enterListenExpr(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitListenExpr) {
             listener.exitListenExpr(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitListenExpr) {
            return visitor.visitListenExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ListenTargetContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public contextRef(): ContextRefContext | null {
        return this.getRuleContext(0, ContextRefContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_listenTarget;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterListenTarget) {
             listener.enterListenTarget(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitListenTarget) {
             listener.exitListenTarget(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitListenTarget) {
            return visitor.visitListenTarget(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.IDENTIFIER, 0);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.NUMBER, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.BOOL, 0);
    }
    public contextRef(): ContextRefContext | null {
        return this.getRuleContext(0, ContextRefContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_expression;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterExpression) {
             listener.enterExpression(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitExpression) {
             listener.exitExpression(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitExpression) {
            return visitor.visitExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode[];
    public IDENTIFIER(i: number): antlr.TerminalNode | null;
    public IDENTIFIER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LanglyParser.IDENTIFIER);
    	} else {
    		return this.getToken(LanglyParser.IDENTIFIER, i);
    	}
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_callExpr;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterCallExpr) {
             listener.enterCallExpr(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitCallExpr) {
             listener.exitCallExpr(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
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
        return LanglyParser.RULE_callArgs;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterCallArgs) {
             listener.enterCallArgs(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitCallArgs) {
             listener.exitCallArgs(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
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
    public namedCallArg(): NamedCallArgContext | null {
        return this.getRuleContext(0, NamedCallArgContext);
    }
    public callValue(): CallValueContext | null {
        return this.getRuleContext(0, CallValueContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_callArg;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterCallArg) {
             listener.enterCallArg(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitCallArg) {
             listener.exitCallArg(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitCallArg) {
            return visitor.visitCallArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NamedCallArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(LanglyParser.IDENTIFIER, 0)!;
    }
    public callValue(): CallValueContext {
        return this.getRuleContext(0, CallValueContext)!;
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_namedCallArg;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterNamedCallArg) {
             listener.enterNamedCallArg(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitNamedCallArg) {
             listener.exitNamedCallArg(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitNamedCallArg) {
            return visitor.visitNamedCallArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.NUMBER, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.BOOL, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.DURATION, 0);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.MODEL_REF, 0);
    }
    public contextRef(): ContextRefContext | null {
        return this.getRuleContext(0, ContextRefContext);
    }
    public callItems(): CallItemsContext | null {
        return this.getRuleContext(0, CallItemsContext);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_callValue;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterCallValue) {
             listener.enterCallValue(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitCallValue) {
             listener.exitCallValue(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitCallValue) {
            return visitor.visitCallValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallItemsContext extends antlr.ParserRuleContext {
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
        return LanglyParser.RULE_callItems;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterCallItems) {
             listener.enterCallItems(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitCallItems) {
             listener.exitCallItems(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitCallItems) {
            return visitor.visitCallItems(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.NUMBER, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.BOOL, 0);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.IDENTIFIER, 0);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.MODEL_REF, 0);
    }
    public override get ruleIndex(): number {
        return LanglyParser.RULE_value;
    }
    public override enterRule(listener: LanglyListener): void {
        if(listener.enterValue) {
             listener.enterValue(this);
        }
    }
    public override exitRule(listener: LanglyListener): void {
        if(listener.exitValue) {
             listener.exitValue(this);
        }
    }
    public override accept<Result>(visitor: LanglyVisitor<Result>): Result | null {
        if (visitor.visitValue) {
            return visitor.visitValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
