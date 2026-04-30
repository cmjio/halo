// Generated from grammars/Langly.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { LanglyListener } from "./LanglyListener.js";
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
    public static readonly RULE_callValue = 48;
    public static readonly RULE_callItems = 49;
    public static readonly RULE_value = 50;

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
        "callArg", "callValue", "callItems", "value",
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
            this.state = 105;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 165634) !== 0)) {
                {
                {
                this.state = 102;
                this.declaration();
                }
                }
                this.state = 107;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 108;
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
            this.state = 115;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 110;
                this.guardrailDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 111;
                this.toolDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 112;
                this.memoryDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 113;
                this.mindDecl();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 114;
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
            this.state = 117;
            this.match(LanglyParser.T__0);
            this.state = 118;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 119;
            this.match(LanglyParser.T__1);
            this.state = 120;
            this.guardrailRule();
            this.state = 125;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 121;
                this.match(LanglyParser.T__2);
                this.state = 122;
                this.guardrailRule();
                }
                }
                this.state = 127;
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
            this.state = 128;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 129;
            this.match(LanglyParser.T__3);
            this.state = 131;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 31) !== 0)) {
                {
                this.state = 130;
                this.guardrailArgs();
                }
            }

            this.state = 133;
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
            this.state = 135;
            this.guardrailArg();
            this.state = 140;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 136;
                this.match(LanglyParser.T__5);
                this.state = 137;
                this.guardrailArg();
                }
                }
                this.state = 142;
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
            this.state = 148;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.MODEL_REF:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 143;
                this.match(LanglyParser.MODEL_REF);
                }
                break;
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 144;
                this.dottedId();
                }
                break;
            case LanglyParser.STRING:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 145;
                this.match(LanglyParser.STRING);
                }
                break;
            case LanglyParser.NUMBER:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 146;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case LanglyParser.DURATION:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 147;
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
            this.state = 150;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 155;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 7) {
                {
                {
                this.state = 151;
                this.match(LanglyParser.T__6);
                this.state = 152;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 157;
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
            this.state = 158;
            this.match(LanglyParser.T__7);
            this.state = 159;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 160;
            this.match(LanglyParser.T__1);
            this.state = 161;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 162;
            this.match(LanglyParser.T__3);
            this.state = 164;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 29) !== 0)) {
                {
                this.state = 163;
                this.toolArgs();
                }
            }

            this.state = 166;
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
            this.state = 168;
            this.toolArg();
            this.state = 173;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 169;
                this.match(LanglyParser.T__5);
                this.state = 170;
                this.toolArg();
                }
                }
                this.state = 175;
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
            this.state = 188;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 10, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 176;
                this.match(LanglyParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 177;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 178;
                this.match(LanglyParser.DURATION);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 179;
                this.dottedId();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 180;
                this.match(LanglyParser.IDENTIFIER);
                this.state = 181;
                this.match(LanglyParser.T__1);
                this.state = 186;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case LanglyParser.STRING:
                    {
                    this.state = 182;
                    this.match(LanglyParser.STRING);
                    }
                    break;
                case LanglyParser.NUMBER:
                    {
                    this.state = 183;
                    this.match(LanglyParser.NUMBER);
                    }
                    break;
                case LanglyParser.DURATION:
                    {
                    this.state = 184;
                    this.match(LanglyParser.DURATION);
                    }
                    break;
                case LanglyParser.IDENTIFIER:
                    {
                    this.state = 185;
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
            this.state = 190;
            this.match(LanglyParser.T__8);
            this.state = 191;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 192;
            this.match(LanglyParser.T__1);
            this.state = 193;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 194;
            this.match(LanglyParser.T__3);
            this.state = 196;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 7) !== 0)) {
                {
                this.state = 195;
                this.memoryArgs();
                }
            }

            this.state = 198;
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
            this.state = 200;
            this.memoryArg();
            this.state = 205;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 201;
                this.match(LanglyParser.T__5);
                this.state = 202;
                this.memoryArg();
                }
                }
                this.state = 207;
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
            this.state = 218;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 14, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 208;
                this.match(LanglyParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 209;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 210;
                this.dottedId();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 211;
                this.match(LanglyParser.IDENTIFIER);
                this.state = 212;
                this.match(LanglyParser.T__1);
                this.state = 216;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case LanglyParser.STRING:
                    {
                    this.state = 213;
                    this.match(LanglyParser.STRING);
                    }
                    break;
                case LanglyParser.NUMBER:
                    {
                    this.state = 214;
                    this.match(LanglyParser.NUMBER);
                    }
                    break;
                case LanglyParser.IDENTIFIER:
                    {
                    this.state = 215;
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
            this.state = 223;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 17) {
                {
                {
                this.state = 220;
                this.directive();
                }
                }
                this.state = 225;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 226;
            this.match(LanglyParser.T__9);
            this.state = 227;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 228;
            this.match(LanglyParser.T__10);
            this.state = 229;
            this.modelConfig();
            this.state = 230;
            this.match(LanglyParser.T__11);
            this.state = 232;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13 || _la === 14) {
                {
                this.state = 231;
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
            this.state = 235;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 234;
                this.mindModifier();
                }
                }
                this.state = 237;
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
            this.state = 243;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.T__12:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 239;
                this.match(LanglyParser.T__12);
                this.state = 240;
                this.equipsList();
                }
                break;
            case LanglyParser.T__13:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 241;
                this.match(LanglyParser.T__13);
                this.state = 242;
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
            this.state = 245;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 250;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 246;
                this.match(LanglyParser.T__5);
                this.state = 247;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 252;
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
            this.state = 253;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 258;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 254;
                this.match(LanglyParser.T__5);
                this.state = 255;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 260;
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
            this.state = 261;
            this.modelId();
            this.state = 266;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 262;
                this.match(LanglyParser.T__5);
                this.state = 263;
                this.modelParam();
                }
                }
                this.state = 268;
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
            this.state = 269;
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
            this.state = 271;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 272;
            this.match(LanglyParser.T__1);
            this.state = 273;
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
            this.state = 278;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 17) {
                {
                {
                this.state = 275;
                this.directive();
                }
                }
                this.state = 280;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 281;
            this.match(LanglyParser.T__14);
            this.state = 282;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 283;
            this.match(LanglyParser.T__3);
            this.state = 285;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 44) {
                {
                this.state = 284;
                this.paramList();
                }
            }

            this.state = 287;
            this.match(LanglyParser.T__4);
            this.state = 288;
            this.match(LanglyParser.T__15);
            this.state = 289;
            this.typeRef();
            this.state = 290;
            this.match(LanglyParser.T__1);
            this.state = 291;
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
            this.state = 293;
            this.match(LanglyParser.T__16);
            this.state = 294;
            this.directiveName();
            this.state = 296;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 4) {
                {
                this.state = 295;
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
            this.state = 298;
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
            this.state = 300;
            this.match(LanglyParser.T__3);
            this.state = 301;
            this.directiveArgs();
            this.state = 302;
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
            this.state = 304;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 31) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 309;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 305;
                this.match(LanglyParser.T__5);
                this.state = 306;
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
                this.state = 311;
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
            this.state = 312;
            this.param();
            this.state = 317;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 313;
                this.match(LanglyParser.T__5);
                this.state = 314;
                this.param();
                }
                }
                this.state = 319;
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
            this.state = 320;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 321;
            this.match(LanglyParser.T__1);
            this.state = 322;
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
            this.state = 324;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 329;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 7) {
                {
                {
                this.state = 325;
                this.match(LanglyParser.T__6);
                this.state = 326;
                this.match(LanglyParser.IDENTIFIER);
                }
                }
                this.state = 331;
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
            this.state = 333;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 332;
                this.pipelineStage();
                }
                }
                this.state = 335;
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
            this.state = 351;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.PIPE:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 337;
                this.match(LanglyParser.PIPE);
                this.state = 338;
                this.callExpr();
                }
                break;
            case LanglyParser.GATE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 339;
                this.match(LanglyParser.GATE);
                this.state = 340;
                this.condition();
                }
                break;
            case LanglyParser.INTERRUPT:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 341;
                this.match(LanglyParser.INTERRUPT);
                this.state = 342;
                this.yieldExpr();
                }
                break;
            case LanglyParser.FANOUT:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 343;
                this.match(LanglyParser.FANOUT);
                this.state = 344;
                this.match(LanglyParser.T__21);
                this.state = 345;
                this.fanoutStages();
                this.state = 346;
                this.match(LanglyParser.T__22);
                }
                break;
            case LanglyParser.LISTEN:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 348;
                this.match(LanglyParser.LISTEN);
                this.state = 349;
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
                this.state = 350;
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
            this.state = 353;
            this.match(LanglyParser.T__3);
            this.state = 354;
            this.conditionExpr();
            this.state = 355;
            this.match(LanglyParser.T__4);
            this.state = 357;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 356;
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
            this.state = 359;
            this.expression();
            this.state = 363;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4227858432) !== 0)) {
                {
                this.state = 360;
                this.comparisonOp();
                this.state = 361;
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
            this.state = 365;
            this.match(LanglyParser.T__24);
            this.state = 366;
            this.match(LanglyParser.T__6);
            this.state = 367;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 369;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 7) {
                {
                this.state = 368;
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
            this.state = 371;
            this.match(LanglyParser.T__6);
            this.state = 373;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 372;
                    this.match(LanglyParser.IDENTIFIER);
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 375;
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
            this.state = 377;
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
            this.state = 379;
            this.fanoutStage();
            this.state = 384;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 380;
                this.match(LanglyParser.T__5);
                this.state = 381;
                this.fanoutStage();
                }
                }
                this.state = 386;
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
            this.state = 389;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 35, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 387;
                this.callExpr();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 388;
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
            this.state = 391;
            this.match(LanglyParser.T__31);
            this.state = 392;
            this.match(LanglyParser.T__3);
            this.state = 394;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 11 || _la === 25 || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 63) !== 0)) {
                {
                this.state = 393;
                this.yieldArgs();
                }
            }

            this.state = 396;
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
            this.state = 398;
            this.yieldArg();
            this.state = 403;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 399;
                this.match(LanglyParser.T__5);
                this.state = 400;
                this.yieldArg();
                }
                }
                this.state = 405;
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
            this.state = 410;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 406;
                this.match(LanglyParser.IDENTIFIER);
                this.state = 407;
                this.match(LanglyParser.T__1);
                this.state = 408;
                this.yieldArgValue();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 409;
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
            this.state = 424;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 40, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 412;
                this.callValue();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 413;
                this.match(LanglyParser.T__10);
                this.state = 414;
                this.callValue();
                this.state = 419;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 6) {
                    {
                    {
                    this.state = 415;
                    this.match(LanglyParser.T__5);
                    this.state = 416;
                    this.callValue();
                    }
                    }
                    this.state = 421;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 422;
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
            this.state = 426;
            this.match(LanglyParser.T__32);
            this.state = 427;
            this.match(LanglyParser.T__3);
            this.state = 428;
            this.listenTarget();
            this.state = 429;
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
            this.state = 433;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 431;
                this.dottedId();
                }
                break;
            case LanglyParser.T__24:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 432;
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
            this.state = 440;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 435;
                this.match(LanglyParser.IDENTIFIER);
                }
                break;
            case LanglyParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 436;
                this.match(LanglyParser.STRING);
                }
                break;
            case LanglyParser.NUMBER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 437;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case LanglyParser.BOOL:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 438;
                this.match(LanglyParser.BOOL);
                }
                break;
            case LanglyParser.T__24:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 439;
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
            this.state = 442;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 443;
            this.match(LanglyParser.T__6);
            this.state = 444;
            this.match(LanglyParser.IDENTIFIER);
            this.state = 445;
            this.match(LanglyParser.T__3);
            this.state = 447;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 11 || _la === 25 || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 63) !== 0)) {
                {
                this.state = 446;
                this.callArgs();
                }
            }

            this.state = 449;
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
            this.state = 451;
            this.callArg();
            this.state = 456;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 452;
                this.match(LanglyParser.T__5);
                this.state = 453;
                this.callArg();
                }
                }
                this.state = 458;
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
                this.state = 459;
                this.match(LanglyParser.IDENTIFIER);
                this.state = 460;
                this.match(LanglyParser.T__1);
                this.state = 461;
                this.callValue();
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
    public callValue(): CallValueContext {
        let localContext = new CallValueContext(this.context, this.state);
        this.enterRule(localContext, 96, LanglyParser.RULE_callValue);
        try {
            this.state = 476;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LanglyParser.STRING:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 465;
                this.match(LanglyParser.STRING);
                }
                break;
            case LanglyParser.NUMBER:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 466;
                this.match(LanglyParser.NUMBER);
                }
                break;
            case LanglyParser.BOOL:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 467;
                this.match(LanglyParser.BOOL);
                }
                break;
            case LanglyParser.DURATION:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 468;
                this.match(LanglyParser.DURATION);
                }
                break;
            case LanglyParser.MODEL_REF:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 469;
                this.match(LanglyParser.MODEL_REF);
                }
                break;
            case LanglyParser.T__24:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 470;
                this.contextRef();
                }
                break;
            case LanglyParser.T__10:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 471;
                this.match(LanglyParser.T__10);
                this.state = 472;
                this.callItems();
                this.state = 473;
                this.match(LanglyParser.T__11);
                }
                break;
            case LanglyParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 475;
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
        this.enterRule(localContext, 98, LanglyParser.RULE_callItems);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 478;
            this.callValue();
            this.state = 483;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 479;
                this.match(LanglyParser.T__5);
                this.state = 480;
                this.callValue();
                }
                }
                this.state = 485;
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
        this.enterRule(localContext, 100, LanglyParser.RULE_value);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 486;
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
        4,1,47,489,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,
        7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,
        2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,
        7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,1,0,5,0,104,8,0,10,
        0,12,0,107,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,3,1,116,8,1,1,2,1,2,1,
        2,1,2,1,2,1,2,5,2,124,8,2,10,2,12,2,127,9,2,1,3,1,3,1,3,3,3,132,
        8,3,1,3,1,3,1,4,1,4,1,4,5,4,139,8,4,10,4,12,4,142,9,4,1,5,1,5,1,
        5,1,5,1,5,3,5,149,8,5,1,6,1,6,1,6,5,6,154,8,6,10,6,12,6,157,9,6,
        1,7,1,7,1,7,1,7,1,7,1,7,3,7,165,8,7,1,7,1,7,1,8,1,8,1,8,5,8,172,
        8,8,10,8,12,8,175,9,8,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,3,
        9,187,8,9,3,9,189,8,9,1,10,1,10,1,10,1,10,1,10,1,10,3,10,197,8,10,
        1,10,1,10,1,11,1,11,1,11,5,11,204,8,11,10,11,12,11,207,9,11,1,12,
        1,12,1,12,1,12,1,12,1,12,1,12,1,12,3,12,217,8,12,3,12,219,8,12,1,
        13,5,13,222,8,13,10,13,12,13,225,9,13,1,13,1,13,1,13,1,13,1,13,1,
        13,3,13,233,8,13,1,14,4,14,236,8,14,11,14,12,14,237,1,15,1,15,1,
        15,1,15,3,15,244,8,15,1,16,1,16,1,16,5,16,249,8,16,10,16,12,16,252,
        9,16,1,17,1,17,1,17,5,17,257,8,17,10,17,12,17,260,9,17,1,18,1,18,
        1,18,5,18,265,8,18,10,18,12,18,268,9,18,1,19,1,19,1,20,1,20,1,20,
        1,20,1,21,5,21,277,8,21,10,21,12,21,280,9,21,1,21,1,21,1,21,1,21,
        3,21,286,8,21,1,21,1,21,1,21,1,21,1,21,1,21,1,22,1,22,1,22,3,22,
        297,8,22,1,23,1,23,1,24,1,24,1,24,1,24,1,25,1,25,1,25,5,25,308,8,
        25,10,25,12,25,311,9,25,1,26,1,26,1,26,5,26,316,8,26,10,26,12,26,
        319,9,26,1,27,1,27,1,27,1,27,1,28,1,28,1,28,5,28,328,8,28,10,28,
        12,28,331,9,28,1,29,4,29,334,8,29,11,29,12,29,335,1,30,1,30,1,30,
        1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,3,30,352,
        8,30,1,31,1,31,1,31,1,31,3,31,358,8,31,1,32,1,32,1,32,1,32,3,32,
        364,8,32,1,33,1,33,1,33,1,33,3,33,370,8,33,1,34,1,34,4,34,374,8,
        34,11,34,12,34,375,1,35,1,35,1,36,1,36,1,36,5,36,383,8,36,10,36,
        12,36,386,9,36,1,37,1,37,3,37,390,8,37,1,38,1,38,1,38,3,38,395,8,
        38,1,38,1,38,1,39,1,39,1,39,5,39,402,8,39,10,39,12,39,405,9,39,1,
        40,1,40,1,40,1,40,3,40,411,8,40,1,41,1,41,1,41,1,41,1,41,5,41,418,
        8,41,10,41,12,41,421,9,41,1,41,1,41,3,41,425,8,41,1,42,1,42,1,42,
        1,42,1,42,1,43,1,43,3,43,434,8,43,1,44,1,44,1,44,1,44,1,44,3,44,
        441,8,44,1,45,1,45,1,45,1,45,1,45,3,45,448,8,45,1,45,1,45,1,46,1,
        46,1,46,5,46,455,8,46,10,46,12,46,458,9,46,1,47,1,47,1,47,1,47,3,
        47,464,8,47,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,
        48,3,48,477,8,48,1,49,1,49,1,49,5,49,482,8,49,10,49,12,49,485,9,
        49,1,50,1,50,1,50,0,0,51,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,
        30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,
        74,76,78,80,82,84,86,88,90,92,94,96,98,100,0,4,1,0,18,21,1,0,42,
        46,1,0,26,31,1,0,43,47,512,0,105,1,0,0,0,2,115,1,0,0,0,4,117,1,0,
        0,0,6,128,1,0,0,0,8,135,1,0,0,0,10,148,1,0,0,0,12,150,1,0,0,0,14,
        158,1,0,0,0,16,168,1,0,0,0,18,188,1,0,0,0,20,190,1,0,0,0,22,200,
        1,0,0,0,24,218,1,0,0,0,26,223,1,0,0,0,28,235,1,0,0,0,30,243,1,0,
        0,0,32,245,1,0,0,0,34,253,1,0,0,0,36,261,1,0,0,0,38,269,1,0,0,0,
        40,271,1,0,0,0,42,278,1,0,0,0,44,293,1,0,0,0,46,298,1,0,0,0,48,300,
        1,0,0,0,50,304,1,0,0,0,52,312,1,0,0,0,54,320,1,0,0,0,56,324,1,0,
        0,0,58,333,1,0,0,0,60,351,1,0,0,0,62,353,1,0,0,0,64,359,1,0,0,0,
        66,365,1,0,0,0,68,371,1,0,0,0,70,377,1,0,0,0,72,379,1,0,0,0,74,389,
        1,0,0,0,76,391,1,0,0,0,78,398,1,0,0,0,80,410,1,0,0,0,82,424,1,0,
        0,0,84,426,1,0,0,0,86,433,1,0,0,0,88,440,1,0,0,0,90,442,1,0,0,0,
        92,451,1,0,0,0,94,463,1,0,0,0,96,476,1,0,0,0,98,478,1,0,0,0,100,
        486,1,0,0,0,102,104,3,2,1,0,103,102,1,0,0,0,104,107,1,0,0,0,105,
        103,1,0,0,0,105,106,1,0,0,0,106,108,1,0,0,0,107,105,1,0,0,0,108,
        109,5,0,0,1,109,1,1,0,0,0,110,116,3,4,2,0,111,116,3,14,7,0,112,116,
        3,20,10,0,113,116,3,26,13,0,114,116,3,42,21,0,115,110,1,0,0,0,115,
        111,1,0,0,0,115,112,1,0,0,0,115,113,1,0,0,0,115,114,1,0,0,0,116,
        3,1,0,0,0,117,118,5,1,0,0,118,119,5,44,0,0,119,120,5,2,0,0,120,125,
        3,6,3,0,121,122,5,3,0,0,122,124,3,6,3,0,123,121,1,0,0,0,124,127,
        1,0,0,0,125,123,1,0,0,0,125,126,1,0,0,0,126,5,1,0,0,0,127,125,1,
        0,0,0,128,129,5,44,0,0,129,131,5,4,0,0,130,132,3,8,4,0,131,130,1,
        0,0,0,131,132,1,0,0,0,132,133,1,0,0,0,133,134,5,5,0,0,134,7,1,0,
        0,0,135,140,3,10,5,0,136,137,5,6,0,0,137,139,3,10,5,0,138,136,1,
        0,0,0,139,142,1,0,0,0,140,138,1,0,0,0,140,141,1,0,0,0,141,9,1,0,
        0,0,142,140,1,0,0,0,143,149,5,43,0,0,144,149,3,12,6,0,145,149,5,
        45,0,0,146,149,5,46,0,0,147,149,5,42,0,0,148,143,1,0,0,0,148,144,
        1,0,0,0,148,145,1,0,0,0,148,146,1,0,0,0,148,147,1,0,0,0,149,11,1,
        0,0,0,150,155,5,44,0,0,151,152,5,7,0,0,152,154,5,44,0,0,153,151,
        1,0,0,0,154,157,1,0,0,0,155,153,1,0,0,0,155,156,1,0,0,0,156,13,1,
        0,0,0,157,155,1,0,0,0,158,159,5,8,0,0,159,160,5,44,0,0,160,161,5,
        2,0,0,161,162,5,44,0,0,162,164,5,4,0,0,163,165,3,16,8,0,164,163,
        1,0,0,0,164,165,1,0,0,0,165,166,1,0,0,0,166,167,5,5,0,0,167,15,1,
        0,0,0,168,173,3,18,9,0,169,170,5,6,0,0,170,172,3,18,9,0,171,169,
        1,0,0,0,172,175,1,0,0,0,173,171,1,0,0,0,173,174,1,0,0,0,174,17,1,
        0,0,0,175,173,1,0,0,0,176,189,5,45,0,0,177,189,5,46,0,0,178,189,
        5,42,0,0,179,189,3,12,6,0,180,181,5,44,0,0,181,186,5,2,0,0,182,187,
        5,45,0,0,183,187,5,46,0,0,184,187,5,42,0,0,185,187,3,12,6,0,186,
        182,1,0,0,0,186,183,1,0,0,0,186,184,1,0,0,0,186,185,1,0,0,0,187,
        189,1,0,0,0,188,176,1,0,0,0,188,177,1,0,0,0,188,178,1,0,0,0,188,
        179,1,0,0,0,188,180,1,0,0,0,189,19,1,0,0,0,190,191,5,9,0,0,191,192,
        5,44,0,0,192,193,5,2,0,0,193,194,5,44,0,0,194,196,5,4,0,0,195,197,
        3,22,11,0,196,195,1,0,0,0,196,197,1,0,0,0,197,198,1,0,0,0,198,199,
        5,5,0,0,199,21,1,0,0,0,200,205,3,24,12,0,201,202,5,6,0,0,202,204,
        3,24,12,0,203,201,1,0,0,0,204,207,1,0,0,0,205,203,1,0,0,0,205,206,
        1,0,0,0,206,23,1,0,0,0,207,205,1,0,0,0,208,219,5,45,0,0,209,219,
        5,46,0,0,210,219,3,12,6,0,211,212,5,44,0,0,212,216,5,2,0,0,213,217,
        5,45,0,0,214,217,5,46,0,0,215,217,3,12,6,0,216,213,1,0,0,0,216,214,
        1,0,0,0,216,215,1,0,0,0,217,219,1,0,0,0,218,208,1,0,0,0,218,209,
        1,0,0,0,218,210,1,0,0,0,218,211,1,0,0,0,219,25,1,0,0,0,220,222,3,
        44,22,0,221,220,1,0,0,0,222,225,1,0,0,0,223,221,1,0,0,0,223,224,
        1,0,0,0,224,226,1,0,0,0,225,223,1,0,0,0,226,227,5,10,0,0,227,228,
        5,44,0,0,228,229,5,11,0,0,229,230,3,36,18,0,230,232,5,12,0,0,231,
        233,3,28,14,0,232,231,1,0,0,0,232,233,1,0,0,0,233,27,1,0,0,0,234,
        236,3,30,15,0,235,234,1,0,0,0,236,237,1,0,0,0,237,235,1,0,0,0,237,
        238,1,0,0,0,238,29,1,0,0,0,239,240,5,13,0,0,240,244,3,32,16,0,241,
        242,5,14,0,0,242,244,3,34,17,0,243,239,1,0,0,0,243,241,1,0,0,0,244,
        31,1,0,0,0,245,250,5,44,0,0,246,247,5,6,0,0,247,249,5,44,0,0,248,
        246,1,0,0,0,249,252,1,0,0,0,250,248,1,0,0,0,250,251,1,0,0,0,251,
        33,1,0,0,0,252,250,1,0,0,0,253,258,5,44,0,0,254,255,5,6,0,0,255,
        257,5,44,0,0,256,254,1,0,0,0,257,260,1,0,0,0,258,256,1,0,0,0,258,
        259,1,0,0,0,259,35,1,0,0,0,260,258,1,0,0,0,261,266,3,38,19,0,262,
        263,5,6,0,0,263,265,3,40,20,0,264,262,1,0,0,0,265,268,1,0,0,0,266,
        264,1,0,0,0,266,267,1,0,0,0,267,37,1,0,0,0,268,266,1,0,0,0,269,270,
        5,43,0,0,270,39,1,0,0,0,271,272,5,44,0,0,272,273,5,2,0,0,273,274,
        3,100,50,0,274,41,1,0,0,0,275,277,3,44,22,0,276,275,1,0,0,0,277,
        280,1,0,0,0,278,276,1,0,0,0,278,279,1,0,0,0,279,281,1,0,0,0,280,
        278,1,0,0,0,281,282,5,15,0,0,282,283,5,44,0,0,283,285,5,4,0,0,284,
        286,3,52,26,0,285,284,1,0,0,0,285,286,1,0,0,0,286,287,1,0,0,0,287,
        288,5,5,0,0,288,289,5,16,0,0,289,290,3,56,28,0,290,291,5,2,0,0,291,
        292,3,58,29,0,292,43,1,0,0,0,293,294,5,17,0,0,294,296,3,46,23,0,
        295,297,3,48,24,0,296,295,1,0,0,0,296,297,1,0,0,0,297,45,1,0,0,0,
        298,299,7,0,0,0,299,47,1,0,0,0,300,301,5,4,0,0,301,302,3,50,25,0,
        302,303,5,5,0,0,303,49,1,0,0,0,304,309,7,1,0,0,305,306,5,6,0,0,306,
        308,7,1,0,0,307,305,1,0,0,0,308,311,1,0,0,0,309,307,1,0,0,0,309,
        310,1,0,0,0,310,51,1,0,0,0,311,309,1,0,0,0,312,317,3,54,27,0,313,
        314,5,6,0,0,314,316,3,54,27,0,315,313,1,0,0,0,316,319,1,0,0,0,317,
        315,1,0,0,0,317,318,1,0,0,0,318,53,1,0,0,0,319,317,1,0,0,0,320,321,
        5,44,0,0,321,322,5,2,0,0,322,323,3,56,28,0,323,55,1,0,0,0,324,329,
        5,44,0,0,325,326,5,7,0,0,326,328,5,44,0,0,327,325,1,0,0,0,328,331,
        1,0,0,0,329,327,1,0,0,0,329,330,1,0,0,0,330,57,1,0,0,0,331,329,1,
        0,0,0,332,334,3,60,30,0,333,332,1,0,0,0,334,335,1,0,0,0,335,333,
        1,0,0,0,335,336,1,0,0,0,336,59,1,0,0,0,337,338,5,41,0,0,338,352,
        3,90,45,0,339,340,5,39,0,0,340,352,3,62,31,0,341,342,5,38,0,0,342,
        352,3,76,38,0,343,344,5,37,0,0,344,345,5,22,0,0,345,346,3,72,36,
        0,346,347,5,23,0,0,347,352,1,0,0,0,348,349,5,40,0,0,349,352,3,84,
        42,0,350,352,3,88,44,0,351,337,1,0,0,0,351,339,1,0,0,0,351,341,1,
        0,0,0,351,343,1,0,0,0,351,348,1,0,0,0,351,350,1,0,0,0,352,61,1,0,
        0,0,353,354,5,4,0,0,354,355,3,64,32,0,355,357,5,5,0,0,356,358,5,
        24,0,0,357,356,1,0,0,0,357,358,1,0,0,0,358,63,1,0,0,0,359,363,3,
        88,44,0,360,361,3,70,35,0,361,362,3,88,44,0,362,364,1,0,0,0,363,
        360,1,0,0,0,363,364,1,0,0,0,364,65,1,0,0,0,365,366,5,25,0,0,366,
        367,5,7,0,0,367,369,5,44,0,0,368,370,3,68,34,0,369,368,1,0,0,0,369,
        370,1,0,0,0,370,67,1,0,0,0,371,373,5,7,0,0,372,374,5,44,0,0,373,
        372,1,0,0,0,374,375,1,0,0,0,375,373,1,0,0,0,375,376,1,0,0,0,376,
        69,1,0,0,0,377,378,7,2,0,0,378,71,1,0,0,0,379,384,3,74,37,0,380,
        381,5,6,0,0,381,383,3,74,37,0,382,380,1,0,0,0,383,386,1,0,0,0,384,
        382,1,0,0,0,384,385,1,0,0,0,385,73,1,0,0,0,386,384,1,0,0,0,387,390,
        3,90,45,0,388,390,5,44,0,0,389,387,1,0,0,0,389,388,1,0,0,0,390,75,
        1,0,0,0,391,392,5,32,0,0,392,394,5,4,0,0,393,395,3,78,39,0,394,393,
        1,0,0,0,394,395,1,0,0,0,395,396,1,0,0,0,396,397,5,5,0,0,397,77,1,
        0,0,0,398,403,3,80,40,0,399,400,5,6,0,0,400,402,3,80,40,0,401,399,
        1,0,0,0,402,405,1,0,0,0,403,401,1,0,0,0,403,404,1,0,0,0,404,79,1,
        0,0,0,405,403,1,0,0,0,406,407,5,44,0,0,407,408,5,2,0,0,408,411,3,
        82,41,0,409,411,3,96,48,0,410,406,1,0,0,0,410,409,1,0,0,0,411,81,
        1,0,0,0,412,425,3,96,48,0,413,414,5,11,0,0,414,419,3,96,48,0,415,
        416,5,6,0,0,416,418,3,96,48,0,417,415,1,0,0,0,418,421,1,0,0,0,419,
        417,1,0,0,0,419,420,1,0,0,0,420,422,1,0,0,0,421,419,1,0,0,0,422,
        423,5,12,0,0,423,425,1,0,0,0,424,412,1,0,0,0,424,413,1,0,0,0,425,
        83,1,0,0,0,426,427,5,33,0,0,427,428,5,4,0,0,428,429,3,86,43,0,429,
        430,5,5,0,0,430,85,1,0,0,0,431,434,3,12,6,0,432,434,3,66,33,0,433,
        431,1,0,0,0,433,432,1,0,0,0,434,87,1,0,0,0,435,441,5,44,0,0,436,
        441,5,45,0,0,437,441,5,46,0,0,438,441,5,47,0,0,439,441,3,66,33,0,
        440,435,1,0,0,0,440,436,1,0,0,0,440,437,1,0,0,0,440,438,1,0,0,0,
        440,439,1,0,0,0,441,89,1,0,0,0,442,443,5,44,0,0,443,444,5,7,0,0,
        444,445,5,44,0,0,445,447,5,4,0,0,446,448,3,92,46,0,447,446,1,0,0,
        0,447,448,1,0,0,0,448,449,1,0,0,0,449,450,5,5,0,0,450,91,1,0,0,0,
        451,456,3,94,47,0,452,453,5,6,0,0,453,455,3,94,47,0,454,452,1,0,
        0,0,455,458,1,0,0,0,456,454,1,0,0,0,456,457,1,0,0,0,457,93,1,0,0,
        0,458,456,1,0,0,0,459,460,5,44,0,0,460,461,5,2,0,0,461,464,3,96,
        48,0,462,464,3,96,48,0,463,459,1,0,0,0,463,462,1,0,0,0,464,95,1,
        0,0,0,465,477,5,45,0,0,466,477,5,46,0,0,467,477,5,47,0,0,468,477,
        5,42,0,0,469,477,5,43,0,0,470,477,3,66,33,0,471,472,5,11,0,0,472,
        473,3,98,49,0,473,474,5,12,0,0,474,477,1,0,0,0,475,477,3,12,6,0,
        476,465,1,0,0,0,476,466,1,0,0,0,476,467,1,0,0,0,476,468,1,0,0,0,
        476,469,1,0,0,0,476,470,1,0,0,0,476,471,1,0,0,0,476,475,1,0,0,0,
        477,97,1,0,0,0,478,483,3,96,48,0,479,480,5,6,0,0,480,482,3,96,48,
        0,481,479,1,0,0,0,482,485,1,0,0,0,483,481,1,0,0,0,483,484,1,0,0,
        0,484,99,1,0,0,0,485,483,1,0,0,0,486,487,7,3,0,0,487,101,1,0,0,0,
        48,105,115,125,131,140,148,155,164,173,186,188,196,205,216,218,223,
        232,237,243,250,258,266,278,285,296,309,317,329,335,351,357,363,
        369,375,384,389,394,403,410,419,424,433,440,447,456,463,476,483
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
}


export class CallArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(LanglyParser.IDENTIFIER, 0);
    }
    public callValue(): CallValueContext {
        return this.getRuleContext(0, CallValueContext)!;
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
}
