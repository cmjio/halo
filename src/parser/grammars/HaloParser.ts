// Generated from grammars/Halo.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { HaloListener } from "./HaloListener.js";
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
    public static readonly WS = 38;
    public static readonly NL = 39;
    public static readonly COMMENT = 40;
    public static readonly LOOP = 41;
    public static readonly FANOUT = 42;
    public static readonly INTERRUPT = 43;
    public static readonly GATE = 44;
    public static readonly LISTEN = 45;
    public static readonly PIPE = 46;
    public static readonly DURATION = 47;
    public static readonly IDENTIFIER = 48;
    public static readonly MODEL_REF = 49;
    public static readonly TRIPLE_STRING = 50;
    public static readonly STRING = 51;
    public static readonly NUMBER = 52;
    public static readonly BOOL = 53;
    public static readonly RULE_program = 0;
    public static readonly RULE_declaration = 1;
    public static readonly RULE_policyDecl = 2;
    public static readonly RULE_policyRule = 3;
    public static readonly RULE_policyArgs = 4;
    public static readonly RULE_policyArg = 5;
    public static readonly RULE_idOrKeyword = 6;
    public static readonly RULE_dottedId = 7;
    public static readonly RULE_schemaDecl = 8;
    public static readonly RULE_schemaFields = 9;
    public static readonly RULE_schemaField = 10;
    public static readonly RULE_toolDecl = 11;
    public static readonly RULE_toolArgs = 12;
    public static readonly RULE_toolArg = 13;
    public static readonly RULE_storeDecl = 14;
    public static readonly RULE_storeArgs = 15;
    public static readonly RULE_storeArg = 16;
    public static readonly RULE_agentDecl = 17;
    public static readonly RULE_agentModifiers = 18;
    public static readonly RULE_agentModifier = 19;
    public static readonly RULE_stringLiteral = 20;
    public static readonly RULE_equipsList = 21;
    public static readonly RULE_requiresList = 22;
    public static readonly RULE_modelConfig = 23;
    public static readonly RULE_modelId = 24;
    public static readonly RULE_modelParam = 25;
    public static readonly RULE_pipelineDecl = 26;
    public static readonly RULE_directive = 27;
    public static readonly RULE_directiveName = 28;
    public static readonly RULE_directiveValue = 29;
    public static readonly RULE_directiveArgs = 30;
    public static readonly RULE_paramList = 31;
    public static readonly RULE_param = 32;
    public static readonly RULE_typeRef = 33;
    public static readonly RULE_typeName = 34;
    public static readonly RULE_pipeline = 35;
    public static readonly RULE_pipelineStage = 36;
    public static readonly RULE_condition = 37;
    public static readonly RULE_conditionExpr = 38;
    public static readonly RULE_comparisonOp = 39;
    public static readonly RULE_fanoutStages = 40;
    public static readonly RULE_fanoutStage = 41;
    public static readonly RULE_yieldExpr = 42;
    public static readonly RULE_yieldArgs = 43;
    public static readonly RULE_yieldArg = 44;
    public static readonly RULE_yieldArgValue = 45;
    public static readonly RULE_listenExpr = 46;
    public static readonly RULE_listenTarget = 47;
    public static readonly RULE_loopExpr = 48;
    public static readonly RULE_expression = 49;
    public static readonly RULE_callExpr = 50;
    public static readonly RULE_callArgs = 51;
    public static readonly RULE_callArg = 52;
    public static readonly RULE_callValue = 53;
    public static readonly RULE_callItems = 54;
    public static readonly RULE_value = 55;
    public static readonly RULE_contextRef = 56;
    public static readonly RULE_contextTail = 57;

    public static readonly literalNames = [
        null, "'policy'", "':'", "'&'", "'('", "')'", "','", "'tool'", "'agent'", 
        "'store'", "'pipeline'", "'schema'", "'equips'", "'requires'", "'system'", 
        "'listen'", "'yield'", "'context'", "'timeout'", "'shadow'", "'checkpoint'", 
        "'retry'", "'correct'", "'.'", "'{'", "'}'", "'['", "']'", "'->'", 
        "'@'", "'<'", "'>'", "'=>'", "'=='", "'!='", "'>='", "'<='", "'loop'", 
        null, null, null, "'|<>'", "'|*'", "'|!'", "'|?'", "'~>'", "'|>'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, "WS", "NL", "COMMENT", "LOOP", "FANOUT", 
        "INTERRUPT", "GATE", "LISTEN", "PIPE", "DURATION", "IDENTIFIER", 
        "MODEL_REF", "TRIPLE_STRING", "STRING", "NUMBER", "BOOL"
    ];
    public static readonly ruleNames = [
        "program", "declaration", "policyDecl", "policyRule", "policyArgs", 
        "policyArg", "idOrKeyword", "dottedId", "schemaDecl", "schemaFields", 
        "schemaField", "toolDecl", "toolArgs", "toolArg", "storeDecl", "storeArgs", 
        "storeArg", "agentDecl", "agentModifiers", "agentModifier", "stringLiteral", 
        "equipsList", "requiresList", "modelConfig", "modelId", "modelParam", 
        "pipelineDecl", "directive", "directiveName", "directiveValue", 
        "directiveArgs", "paramList", "param", "typeRef", "typeName", "pipeline", 
        "pipelineStage", "condition", "conditionExpr", "comparisonOp", "fanoutStages", 
        "fanoutStage", "yieldExpr", "yieldArgs", "yieldArg", "yieldArgValue", 
        "listenExpr", "listenTarget", "loopExpr", "expression", "callExpr", 
        "callArgs", "callArg", "callValue", "callItems", "value", "contextRef", 
        "contextTail",
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
            this.state = 119;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 536874882) !== 0)) {
                {
                {
                this.state = 116;
                this.declaration();
                }
                }
                this.state = 121;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 122;
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
            this.state = 130;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 124;
                this.policyDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 125;
                this.toolDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 126;
                this.storeDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 127;
                this.agentDecl();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 128;
                this.pipelineDecl();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 129;
                this.schemaDecl();
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
    public policyDecl(): PolicyDeclContext {
        let localContext = new PolicyDeclContext(this.context, this.state);
        this.enterRule(localContext, 4, HaloParser.RULE_policyDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 132;
            this.match(HaloParser.T__0);
            this.state = 133;
            this.match(HaloParser.IDENTIFIER);
            this.state = 134;
            this.match(HaloParser.T__1);
            this.state = 135;
            this.policyRule();
            this.state = 140;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 136;
                this.match(HaloParser.T__2);
                this.state = 137;
                this.policyRule();
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
    public policyRule(): PolicyRuleContext {
        let localContext = new PolicyRuleContext(this.context, this.state);
        this.enterRule(localContext, 6, HaloParser.RULE_policyRule);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 143;
            this.match(HaloParser.IDENTIFIER);
            this.state = 144;
            this.match(HaloParser.T__3);
            this.state = 146;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 8388482) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 55) !== 0)) {
                {
                this.state = 145;
                this.policyArgs();
                }
            }

            this.state = 148;
            this.match(HaloParser.T__4);
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
    public policyArgs(): PolicyArgsContext {
        let localContext = new PolicyArgsContext(this.context, this.state);
        this.enterRule(localContext, 8, HaloParser.RULE_policyArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 150;
            this.policyArg();
            this.state = 155;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 151;
                this.match(HaloParser.T__5);
                this.state = 152;
                this.policyArg();
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
    public policyArg(): PolicyArgContext {
        let localContext = new PolicyArgContext(this.context, this.state);
        this.enterRule(localContext, 10, HaloParser.RULE_policyArg);
        try {
            this.state = 164;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 5, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 158;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 159;
                this.dottedId();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 160;
                this.match(HaloParser.IDENTIFIER);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 161;
                this.match(HaloParser.STRING);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 162;
                this.match(HaloParser.NUMBER);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 163;
                this.match(HaloParser.DURATION);
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
    public idOrKeyword(): IdOrKeywordContext {
        let localContext = new IdOrKeywordContext(this.context, this.state);
        this.enterRule(localContext, 12, HaloParser.RULE_idOrKeyword);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 166;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 8388482) !== 0) || _la === 48)) {
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
        this.enterRule(localContext, 14, HaloParser.RULE_dottedId);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 168;
            this.idOrKeyword();
            this.state = 173;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 23) {
                {
                {
                this.state = 169;
                this.match(HaloParser.T__22);
                this.state = 170;
                this.idOrKeyword();
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
    public schemaDecl(): SchemaDeclContext {
        let localContext = new SchemaDeclContext(this.context, this.state);
        this.enterRule(localContext, 16, HaloParser.RULE_schemaDecl);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 176;
            this.match(HaloParser.T__10);
            this.state = 177;
            this.match(HaloParser.IDENTIFIER);
            this.state = 178;
            this.match(HaloParser.T__23);
            this.state = 179;
            this.schemaFields();
            this.state = 180;
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
    public schemaFields(): SchemaFieldsContext {
        let localContext = new SchemaFieldsContext(this.context, this.state);
        this.enterRule(localContext, 18, HaloParser.RULE_schemaFields);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 185;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 48) {
                {
                {
                this.state = 182;
                this.schemaField();
                }
                }
                this.state = 187;
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
    public schemaField(): SchemaFieldContext {
        let localContext = new SchemaFieldContext(this.context, this.state);
        this.enterRule(localContext, 20, HaloParser.RULE_schemaField);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 188;
            this.match(HaloParser.IDENTIFIER);
            this.state = 189;
            this.match(HaloParser.T__1);
            this.state = 190;
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
    public toolDecl(): ToolDeclContext {
        let localContext = new ToolDeclContext(this.context, this.state);
        this.enterRule(localContext, 22, HaloParser.RULE_toolDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 192;
            this.match(HaloParser.T__6);
            this.state = 193;
            this.match(HaloParser.IDENTIFIER);
            this.state = 194;
            this.match(HaloParser.T__1);
            this.state = 195;
            this.match(HaloParser.IDENTIFIER);
            this.state = 196;
            this.match(HaloParser.T__3);
            this.state = 198;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 8388482) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 51) !== 0)) {
                {
                this.state = 197;
                this.toolArgs();
                }
            }

            this.state = 200;
            this.match(HaloParser.T__4);
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
        this.enterRule(localContext, 24, HaloParser.RULE_toolArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 202;
            this.toolArg();
            this.state = 207;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 203;
                this.match(HaloParser.T__5);
                this.state = 204;
                this.toolArg();
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
    public toolArg(): ToolArgContext {
        let localContext = new ToolArgContext(this.context, this.state);
        this.enterRule(localContext, 26, HaloParser.RULE_toolArg);
        try {
            this.state = 222;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 11, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 210;
                this.match(HaloParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 211;
                this.match(HaloParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 212;
                this.match(HaloParser.DURATION);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 213;
                this.dottedId();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 214;
                this.idOrKeyword();
                this.state = 215;
                this.match(HaloParser.T__1);
                this.state = 220;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case HaloParser.STRING:
                    {
                    this.state = 216;
                    this.match(HaloParser.STRING);
                    }
                    break;
                case HaloParser.NUMBER:
                    {
                    this.state = 217;
                    this.match(HaloParser.NUMBER);
                    }
                    break;
                case HaloParser.DURATION:
                    {
                    this.state = 218;
                    this.match(HaloParser.DURATION);
                    }
                    break;
                case HaloParser.T__0:
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
                case HaloParser.T__17:
                case HaloParser.T__18:
                case HaloParser.T__19:
                case HaloParser.T__20:
                case HaloParser.T__21:
                case HaloParser.IDENTIFIER:
                    {
                    this.state = 219;
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
    public storeDecl(): StoreDeclContext {
        let localContext = new StoreDeclContext(this.context, this.state);
        this.enterRule(localContext, 28, HaloParser.RULE_storeDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 224;
            this.match(HaloParser.T__8);
            this.state = 225;
            this.match(HaloParser.IDENTIFIER);
            this.state = 226;
            this.match(HaloParser.T__1);
            this.state = 227;
            this.match(HaloParser.IDENTIFIER);
            this.state = 228;
            this.match(HaloParser.T__3);
            this.state = 230;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 8388482) !== 0) || ((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 25) !== 0)) {
                {
                this.state = 229;
                this.storeArgs();
                }
            }

            this.state = 232;
            this.match(HaloParser.T__4);
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
    public storeArgs(): StoreArgsContext {
        let localContext = new StoreArgsContext(this.context, this.state);
        this.enterRule(localContext, 30, HaloParser.RULE_storeArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 234;
            this.storeArg();
            this.state = 239;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 235;
                this.match(HaloParser.T__5);
                this.state = 236;
                this.storeArg();
                }
                }
                this.state = 241;
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
    public storeArg(): StoreArgContext {
        let localContext = new StoreArgContext(this.context, this.state);
        this.enterRule(localContext, 32, HaloParser.RULE_storeArg);
        try {
            this.state = 252;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 15, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 242;
                this.match(HaloParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 243;
                this.match(HaloParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 244;
                this.dottedId();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 245;
                this.idOrKeyword();
                this.state = 246;
                this.match(HaloParser.T__1);
                this.state = 250;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case HaloParser.STRING:
                    {
                    this.state = 247;
                    this.match(HaloParser.STRING);
                    }
                    break;
                case HaloParser.NUMBER:
                    {
                    this.state = 248;
                    this.match(HaloParser.NUMBER);
                    }
                    break;
                case HaloParser.T__0:
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
                case HaloParser.T__17:
                case HaloParser.T__18:
                case HaloParser.T__19:
                case HaloParser.T__20:
                case HaloParser.T__21:
                case HaloParser.IDENTIFIER:
                    {
                    this.state = 249;
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
    public agentDecl(): AgentDeclContext {
        let localContext = new AgentDeclContext(this.context, this.state);
        this.enterRule(localContext, 34, HaloParser.RULE_agentDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 257;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 29) {
                {
                {
                this.state = 254;
                this.directive();
                }
                }
                this.state = 259;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 260;
            this.match(HaloParser.T__7);
            this.state = 261;
            this.match(HaloParser.IDENTIFIER);
            this.state = 262;
            this.match(HaloParser.T__25);
            this.state = 263;
            this.modelConfig();
            this.state = 264;
            this.match(HaloParser.T__26);
            this.state = 266;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 28672) !== 0)) {
                {
                this.state = 265;
                this.agentModifiers();
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
    public agentModifiers(): AgentModifiersContext {
        let localContext = new AgentModifiersContext(this.context, this.state);
        this.enterRule(localContext, 36, HaloParser.RULE_agentModifiers);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 269;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 268;
                this.agentModifier();
                }
                }
                this.state = 271;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 28672) !== 0));
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
        this.enterRule(localContext, 38, HaloParser.RULE_agentModifier);
        try {
            this.state = 279;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__11:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 273;
                this.match(HaloParser.T__11);
                this.state = 274;
                this.equipsList();
                }
                break;
            case HaloParser.T__12:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 275;
                this.match(HaloParser.T__12);
                this.state = 276;
                this.requiresList();
                }
                break;
            case HaloParser.T__13:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 277;
                this.match(HaloParser.T__13);
                this.state = 278;
                this.stringLiteral();
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
    public stringLiteral(): StringLiteralContext {
        let localContext = new StringLiteralContext(this.context, this.state);
        this.enterRule(localContext, 40, HaloParser.RULE_stringLiteral);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 281;
            _la = this.tokenStream.LA(1);
            if(!(_la === 50 || _la === 51)) {
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
    public equipsList(): EquipsListContext {
        let localContext = new EquipsListContext(this.context, this.state);
        this.enterRule(localContext, 42, HaloParser.RULE_equipsList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 283;
            this.match(HaloParser.IDENTIFIER);
            this.state = 288;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 284;
                this.match(HaloParser.T__5);
                this.state = 285;
                this.match(HaloParser.IDENTIFIER);
                }
                }
                this.state = 290;
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
        this.enterRule(localContext, 44, HaloParser.RULE_requiresList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 291;
            this.match(HaloParser.IDENTIFIER);
            this.state = 296;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 292;
                this.match(HaloParser.T__5);
                this.state = 293;
                this.match(HaloParser.IDENTIFIER);
                }
                }
                this.state = 298;
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
        this.enterRule(localContext, 46, HaloParser.RULE_modelConfig);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 299;
            this.modelId();
            this.state = 304;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 300;
                this.match(HaloParser.T__5);
                this.state = 301;
                this.modelParam();
                }
                }
                this.state = 306;
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
        this.enterRule(localContext, 48, HaloParser.RULE_modelId);
        try {
            this.state = 310;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 23, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 307;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 308;
                this.dottedId();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 309;
                this.match(HaloParser.IDENTIFIER);
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
    public modelParam(): ModelParamContext {
        let localContext = new ModelParamContext(this.context, this.state);
        this.enterRule(localContext, 50, HaloParser.RULE_modelParam);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 312;
            this.match(HaloParser.IDENTIFIER);
            this.state = 313;
            this.match(HaloParser.T__1);
            this.state = 314;
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
    public pipelineDecl(): PipelineDeclContext {
        let localContext = new PipelineDeclContext(this.context, this.state);
        this.enterRule(localContext, 52, HaloParser.RULE_pipelineDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 319;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 29) {
                {
                {
                this.state = 316;
                this.directive();
                }
                }
                this.state = 321;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 322;
            this.match(HaloParser.T__9);
            this.state = 323;
            this.match(HaloParser.IDENTIFIER);
            this.state = 324;
            this.match(HaloParser.T__3);
            this.state = 326;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 48) {
                {
                this.state = 325;
                this.paramList();
                }
            }

            this.state = 328;
            this.match(HaloParser.T__4);
            this.state = 329;
            this.match(HaloParser.T__27);
            this.state = 330;
            this.typeRef();
            this.state = 331;
            this.match(HaloParser.T__1);
            this.state = 332;
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
        this.enterRule(localContext, 54, HaloParser.RULE_directive);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 334;
            this.match(HaloParser.T__28);
            this.state = 335;
            this.directiveName();
            this.state = 337;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 4) {
                {
                this.state = 336;
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
        this.enterRule(localContext, 56, HaloParser.RULE_directiveName);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 339;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 8126464) !== 0))) {
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
        this.enterRule(localContext, 58, HaloParser.RULE_directiveValue);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 341;
            this.match(HaloParser.T__3);
            this.state = 342;
            this.directiveArgs();
            this.state = 343;
            this.match(HaloParser.T__4);
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
        this.enterRule(localContext, 60, HaloParser.RULE_directiveArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 345;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 55) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 350;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 346;
                this.match(HaloParser.T__5);
                this.state = 347;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 55) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                }
                this.state = 352;
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
        this.enterRule(localContext, 62, HaloParser.RULE_paramList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 353;
            this.param();
            this.state = 358;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 354;
                this.match(HaloParser.T__5);
                this.state = 355;
                this.param();
                }
                }
                this.state = 360;
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
        this.enterRule(localContext, 64, HaloParser.RULE_param);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 361;
            this.match(HaloParser.IDENTIFIER);
            this.state = 362;
            this.match(HaloParser.T__1);
            this.state = 363;
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
        this.enterRule(localContext, 66, HaloParser.RULE_typeRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 365;
            this.typeName();
            this.state = 370;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 30) {
                {
                this.state = 366;
                this.match(HaloParser.T__29);
                this.state = 367;
                this.typeName();
                this.state = 368;
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
    public typeName(): TypeNameContext {
        let localContext = new TypeNameContext(this.context, this.state);
        this.enterRule(localContext, 68, HaloParser.RULE_typeName);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 372;
            this.idOrKeyword();
            this.state = 377;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 23) {
                {
                {
                this.state = 373;
                this.match(HaloParser.T__22);
                this.state = 374;
                this.idOrKeyword();
                }
                }
                this.state = 379;
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
        this.enterRule(localContext, 70, HaloParser.RULE_pipeline);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 381;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 380;
                this.pipelineStage();
                }
                }
                this.state = 383;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 17 || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & 7359) !== 0));
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
        this.enterRule(localContext, 72, HaloParser.RULE_pipelineStage);
        try {
            this.state = 401;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.PIPE:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 385;
                this.match(HaloParser.PIPE);
                this.state = 386;
                this.callExpr();
                }
                break;
            case HaloParser.GATE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 387;
                this.match(HaloParser.GATE);
                this.state = 388;
                this.condition();
                }
                break;
            case HaloParser.INTERRUPT:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 389;
                this.match(HaloParser.INTERRUPT);
                this.state = 390;
                this.yieldExpr();
                }
                break;
            case HaloParser.FANOUT:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 391;
                this.match(HaloParser.FANOUT);
                this.state = 392;
                this.match(HaloParser.T__23);
                this.state = 393;
                this.fanoutStages();
                this.state = 394;
                this.match(HaloParser.T__24);
                }
                break;
            case HaloParser.LISTEN:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 396;
                this.match(HaloParser.LISTEN);
                this.state = 397;
                this.listenExpr();
                }
                break;
            case HaloParser.LOOP:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 398;
                this.match(HaloParser.LOOP);
                this.state = 399;
                this.loopExpr();
                }
                break;
            case HaloParser.T__16:
            case HaloParser.IDENTIFIER:
            case HaloParser.STRING:
            case HaloParser.NUMBER:
            case HaloParser.BOOL:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 400;
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
        this.enterRule(localContext, 74, HaloParser.RULE_condition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 403;
            this.match(HaloParser.T__3);
            this.state = 404;
            this.conditionExpr();
            this.state = 405;
            this.match(HaloParser.T__4);
            this.state = 407;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 32) {
                {
                this.state = 406;
                this.match(HaloParser.T__31);
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
        this.enterRule(localContext, 76, HaloParser.RULE_conditionExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 409;
            this.expression();
            this.state = 413;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & 123) !== 0)) {
                {
                this.state = 410;
                this.comparisonOp();
                this.state = 411;
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
    public comparisonOp(): ComparisonOpContext {
        let localContext = new ComparisonOpContext(this.context, this.state);
        this.enterRule(localContext, 78, HaloParser.RULE_comparisonOp);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 415;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & 123) !== 0))) {
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
        this.enterRule(localContext, 80, HaloParser.RULE_fanoutStages);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 417;
            this.fanoutStage();
            this.state = 422;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 418;
                this.match(HaloParser.T__5);
                this.state = 419;
                this.fanoutStage();
                }
                }
                this.state = 424;
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
        this.enterRule(localContext, 82, HaloParser.RULE_fanoutStage);
        try {
            this.state = 427;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 36, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 425;
                this.callExpr();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 426;
                this.match(HaloParser.IDENTIFIER);
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
        this.enterRule(localContext, 84, HaloParser.RULE_yieldExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 429;
            this.match(HaloParser.T__15);
            this.state = 430;
            this.match(HaloParser.T__3);
            this.state = 432;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 75497346) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 119) !== 0)) {
                {
                this.state = 431;
                this.yieldArgs();
                }
            }

            this.state = 434;
            this.match(HaloParser.T__4);
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
        this.enterRule(localContext, 86, HaloParser.RULE_yieldArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 436;
            this.yieldArg();
            this.state = 441;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 437;
                this.match(HaloParser.T__5);
                this.state = 438;
                this.yieldArg();
                }
                }
                this.state = 443;
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
        this.enterRule(localContext, 88, HaloParser.RULE_yieldArg);
        try {
            this.state = 449;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 39, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 444;
                this.idOrKeyword();
                this.state = 445;
                this.match(HaloParser.T__1);
                this.state = 446;
                this.yieldArgValue();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 448;
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
        this.enterRule(localContext, 90, HaloParser.RULE_yieldArgValue);
        let _la: number;
        try {
            this.state = 463;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 41, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 451;
                this.callValue();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 452;
                this.match(HaloParser.T__25);
                this.state = 453;
                this.callValue();
                this.state = 458;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 6) {
                    {
                    {
                    this.state = 454;
                    this.match(HaloParser.T__5);
                    this.state = 455;
                    this.callValue();
                    }
                    }
                    this.state = 460;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 461;
                this.match(HaloParser.T__26);
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
        this.enterRule(localContext, 92, HaloParser.RULE_listenExpr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 465;
            this.match(HaloParser.T__14);
            this.state = 466;
            this.match(HaloParser.T__3);
            this.state = 467;
            this.listenTarget();
            this.state = 468;
            this.match(HaloParser.T__4);
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
        this.enterRule(localContext, 94, HaloParser.RULE_listenTarget);
        try {
            this.state = 472;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 42, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 470;
                this.dottedId();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 471;
                this.contextRef();
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
    public loopExpr(): LoopExprContext {
        let localContext = new LoopExprContext(this.context, this.state);
        this.enterRule(localContext, 96, HaloParser.RULE_loopExpr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 474;
            this.match(HaloParser.T__36);
            this.state = 475;
            this.match(HaloParser.T__3);
            this.state = 476;
            this.match(HaloParser.IDENTIFIER);
            this.state = 477;
            this.match(HaloParser.T__5);
            this.state = 478;
            this.match(HaloParser.STRING);
            this.state = 479;
            this.match(HaloParser.T__4);
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
        this.enterRule(localContext, 98, HaloParser.RULE_expression);
        try {
            this.state = 486;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 481;
                this.match(HaloParser.IDENTIFIER);
                }
                break;
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 482;
                this.match(HaloParser.STRING);
                }
                break;
            case HaloParser.NUMBER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 483;
                this.match(HaloParser.NUMBER);
                }
                break;
            case HaloParser.BOOL:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 484;
                this.match(HaloParser.BOOL);
                }
                break;
            case HaloParser.T__16:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 485;
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
        this.enterRule(localContext, 100, HaloParser.RULE_callExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 488;
            this.match(HaloParser.IDENTIFIER);
            this.state = 489;
            this.match(HaloParser.T__22);
            this.state = 490;
            this.match(HaloParser.IDENTIFIER);
            this.state = 491;
            this.match(HaloParser.T__3);
            this.state = 493;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 75497346) !== 0) || ((((_la - 47)) & ~0x1F) === 0 && ((1 << (_la - 47)) & 119) !== 0)) {
                {
                this.state = 492;
                this.callArgs();
                }
            }

            this.state = 495;
            this.match(HaloParser.T__4);
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
        this.enterRule(localContext, 102, HaloParser.RULE_callArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 497;
            this.callArg();
            this.state = 502;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 498;
                this.match(HaloParser.T__5);
                this.state = 499;
                this.callArg();
                }
                }
                this.state = 504;
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
        this.enterRule(localContext, 104, HaloParser.RULE_callArg);
        try {
            this.state = 510;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 46, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 505;
                this.idOrKeyword();
                this.state = 506;
                this.match(HaloParser.T__1);
                this.state = 507;
                this.callValue();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 509;
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
        this.enterRule(localContext, 106, HaloParser.RULE_callValue);
        try {
            this.state = 523;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 47, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 512;
                this.match(HaloParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 513;
                this.match(HaloParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 514;
                this.match(HaloParser.BOOL);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 515;
                this.match(HaloParser.DURATION);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 516;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 517;
                this.contextRef();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 518;
                this.match(HaloParser.T__25);
                this.state = 519;
                this.callItems();
                this.state = 520;
                this.match(HaloParser.T__26);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 522;
                this.dottedId();
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
    public callItems(): CallItemsContext {
        let localContext = new CallItemsContext(this.context, this.state);
        this.enterRule(localContext, 108, HaloParser.RULE_callItems);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 525;
            this.callValue();
            this.state = 530;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 6) {
                {
                {
                this.state = 526;
                this.match(HaloParser.T__5);
                this.state = 527;
                this.callValue();
                }
                }
                this.state = 532;
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
        this.enterRule(localContext, 110, HaloParser.RULE_value);
        try {
            this.state = 539;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 49, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 533;
                this.match(HaloParser.STRING);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 534;
                this.match(HaloParser.NUMBER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 535;
                this.match(HaloParser.BOOL);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 536;
                this.idOrKeyword();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 537;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 538;
                this.dottedId();
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
    public contextRef(): ContextRefContext {
        let localContext = new ContextRefContext(this.context, this.state);
        this.enterRule(localContext, 112, HaloParser.RULE_contextRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 541;
            this.match(HaloParser.T__16);
            this.state = 542;
            this.match(HaloParser.T__22);
            this.state = 543;
            this.match(HaloParser.IDENTIFIER);
            this.state = 545;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 23) {
                {
                this.state = 544;
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
        this.enterRule(localContext, 114, HaloParser.RULE_contextTail);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 549;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 547;
                this.match(HaloParser.T__22);
                this.state = 548;
                this.match(HaloParser.IDENTIFIER);
                }
                }
                this.state = 551;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 23);
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
        4,1,53,554,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,
        7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,
        2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,
        7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,52,
        2,53,7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,1,0,5,0,118,8,
        0,10,0,12,0,121,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,3,1,131,8,1,
        1,2,1,2,1,2,1,2,1,2,1,2,5,2,139,8,2,10,2,12,2,142,9,2,1,3,1,3,1,
        3,3,3,147,8,3,1,3,1,3,1,4,1,4,1,4,5,4,154,8,4,10,4,12,4,157,9,4,
        1,5,1,5,1,5,1,5,1,5,1,5,3,5,165,8,5,1,6,1,6,1,7,1,7,1,7,5,7,172,
        8,7,10,7,12,7,175,9,7,1,8,1,8,1,8,1,8,1,8,1,8,1,9,5,9,184,8,9,10,
        9,12,9,187,9,9,1,10,1,10,1,10,1,10,1,11,1,11,1,11,1,11,1,11,1,11,
        3,11,199,8,11,1,11,1,11,1,12,1,12,1,12,5,12,206,8,12,10,12,12,12,
        209,9,12,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,3,13,
        221,8,13,3,13,223,8,13,1,14,1,14,1,14,1,14,1,14,1,14,3,14,231,8,
        14,1,14,1,14,1,15,1,15,1,15,5,15,238,8,15,10,15,12,15,241,9,15,1,
        16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,3,16,251,8,16,3,16,253,8,16,
        1,17,5,17,256,8,17,10,17,12,17,259,9,17,1,17,1,17,1,17,1,17,1,17,
        1,17,3,17,267,8,17,1,18,4,18,270,8,18,11,18,12,18,271,1,19,1,19,
        1,19,1,19,1,19,1,19,3,19,280,8,19,1,20,1,20,1,21,1,21,1,21,5,21,
        287,8,21,10,21,12,21,290,9,21,1,22,1,22,1,22,5,22,295,8,22,10,22,
        12,22,298,9,22,1,23,1,23,1,23,5,23,303,8,23,10,23,12,23,306,9,23,
        1,24,1,24,1,24,3,24,311,8,24,1,25,1,25,1,25,1,25,1,26,5,26,318,8,
        26,10,26,12,26,321,9,26,1,26,1,26,1,26,1,26,3,26,327,8,26,1,26,1,
        26,1,26,1,26,1,26,1,26,1,27,1,27,1,27,3,27,338,8,27,1,28,1,28,1,
        29,1,29,1,29,1,29,1,30,1,30,1,30,5,30,349,8,30,10,30,12,30,352,9,
        30,1,31,1,31,1,31,5,31,357,8,31,10,31,12,31,360,9,31,1,32,1,32,1,
        32,1,32,1,33,1,33,1,33,1,33,1,33,3,33,371,8,33,1,34,1,34,1,34,5,
        34,376,8,34,10,34,12,34,379,9,34,1,35,4,35,382,8,35,11,35,12,35,
        383,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,
        1,36,1,36,1,36,1,36,3,36,402,8,36,1,37,1,37,1,37,1,37,3,37,408,8,
        37,1,38,1,38,1,38,1,38,3,38,414,8,38,1,39,1,39,1,40,1,40,1,40,5,
        40,421,8,40,10,40,12,40,424,9,40,1,41,1,41,3,41,428,8,41,1,42,1,
        42,1,42,3,42,433,8,42,1,42,1,42,1,43,1,43,1,43,5,43,440,8,43,10,
        43,12,43,443,9,43,1,44,1,44,1,44,1,44,1,44,3,44,450,8,44,1,45,1,
        45,1,45,1,45,1,45,5,45,457,8,45,10,45,12,45,460,9,45,1,45,1,45,3,
        45,464,8,45,1,46,1,46,1,46,1,46,1,46,1,47,1,47,3,47,473,8,47,1,48,
        1,48,1,48,1,48,1,48,1,48,1,48,1,49,1,49,1,49,1,49,1,49,3,49,487,
        8,49,1,50,1,50,1,50,1,50,1,50,3,50,494,8,50,1,50,1,50,1,51,1,51,
        1,51,5,51,501,8,51,10,51,12,51,504,9,51,1,52,1,52,1,52,1,52,1,52,
        3,52,511,8,52,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,
        1,53,3,53,524,8,53,1,54,1,54,1,54,5,54,529,8,54,10,54,12,54,532,
        9,54,1,55,1,55,1,55,1,55,1,55,1,55,3,55,540,8,55,1,56,1,56,1,56,
        1,56,3,56,546,8,56,1,57,1,57,4,57,550,8,57,11,57,12,57,551,1,57,
        0,0,58,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,
        42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,
        86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,0,5,3,0,1,1,
        7,22,48,48,1,0,50,51,1,0,18,22,2,0,47,49,51,52,2,0,30,31,33,36,583,
        0,119,1,0,0,0,2,130,1,0,0,0,4,132,1,0,0,0,6,143,1,0,0,0,8,150,1,
        0,0,0,10,164,1,0,0,0,12,166,1,0,0,0,14,168,1,0,0,0,16,176,1,0,0,
        0,18,185,1,0,0,0,20,188,1,0,0,0,22,192,1,0,0,0,24,202,1,0,0,0,26,
        222,1,0,0,0,28,224,1,0,0,0,30,234,1,0,0,0,32,252,1,0,0,0,34,257,
        1,0,0,0,36,269,1,0,0,0,38,279,1,0,0,0,40,281,1,0,0,0,42,283,1,0,
        0,0,44,291,1,0,0,0,46,299,1,0,0,0,48,310,1,0,0,0,50,312,1,0,0,0,
        52,319,1,0,0,0,54,334,1,0,0,0,56,339,1,0,0,0,58,341,1,0,0,0,60,345,
        1,0,0,0,62,353,1,0,0,0,64,361,1,0,0,0,66,365,1,0,0,0,68,372,1,0,
        0,0,70,381,1,0,0,0,72,401,1,0,0,0,74,403,1,0,0,0,76,409,1,0,0,0,
        78,415,1,0,0,0,80,417,1,0,0,0,82,427,1,0,0,0,84,429,1,0,0,0,86,436,
        1,0,0,0,88,449,1,0,0,0,90,463,1,0,0,0,92,465,1,0,0,0,94,472,1,0,
        0,0,96,474,1,0,0,0,98,486,1,0,0,0,100,488,1,0,0,0,102,497,1,0,0,
        0,104,510,1,0,0,0,106,523,1,0,0,0,108,525,1,0,0,0,110,539,1,0,0,
        0,112,541,1,0,0,0,114,549,1,0,0,0,116,118,3,2,1,0,117,116,1,0,0,
        0,118,121,1,0,0,0,119,117,1,0,0,0,119,120,1,0,0,0,120,122,1,0,0,
        0,121,119,1,0,0,0,122,123,5,0,0,1,123,1,1,0,0,0,124,131,3,4,2,0,
        125,131,3,22,11,0,126,131,3,28,14,0,127,131,3,34,17,0,128,131,3,
        52,26,0,129,131,3,16,8,0,130,124,1,0,0,0,130,125,1,0,0,0,130,126,
        1,0,0,0,130,127,1,0,0,0,130,128,1,0,0,0,130,129,1,0,0,0,131,3,1,
        0,0,0,132,133,5,1,0,0,133,134,5,48,0,0,134,135,5,2,0,0,135,140,3,
        6,3,0,136,137,5,3,0,0,137,139,3,6,3,0,138,136,1,0,0,0,139,142,1,
        0,0,0,140,138,1,0,0,0,140,141,1,0,0,0,141,5,1,0,0,0,142,140,1,0,
        0,0,143,144,5,48,0,0,144,146,5,4,0,0,145,147,3,8,4,0,146,145,1,0,
        0,0,146,147,1,0,0,0,147,148,1,0,0,0,148,149,5,5,0,0,149,7,1,0,0,
        0,150,155,3,10,5,0,151,152,5,6,0,0,152,154,3,10,5,0,153,151,1,0,
        0,0,154,157,1,0,0,0,155,153,1,0,0,0,155,156,1,0,0,0,156,9,1,0,0,
        0,157,155,1,0,0,0,158,165,5,49,0,0,159,165,3,14,7,0,160,165,5,48,
        0,0,161,165,5,51,0,0,162,165,5,52,0,0,163,165,5,47,0,0,164,158,1,
        0,0,0,164,159,1,0,0,0,164,160,1,0,0,0,164,161,1,0,0,0,164,162,1,
        0,0,0,164,163,1,0,0,0,165,11,1,0,0,0,166,167,7,0,0,0,167,13,1,0,
        0,0,168,173,3,12,6,0,169,170,5,23,0,0,170,172,3,12,6,0,171,169,1,
        0,0,0,172,175,1,0,0,0,173,171,1,0,0,0,173,174,1,0,0,0,174,15,1,0,
        0,0,175,173,1,0,0,0,176,177,5,11,0,0,177,178,5,48,0,0,178,179,5,
        24,0,0,179,180,3,18,9,0,180,181,5,25,0,0,181,17,1,0,0,0,182,184,
        3,20,10,0,183,182,1,0,0,0,184,187,1,0,0,0,185,183,1,0,0,0,185,186,
        1,0,0,0,186,19,1,0,0,0,187,185,1,0,0,0,188,189,5,48,0,0,189,190,
        5,2,0,0,190,191,3,66,33,0,191,21,1,0,0,0,192,193,5,7,0,0,193,194,
        5,48,0,0,194,195,5,2,0,0,195,196,5,48,0,0,196,198,5,4,0,0,197,199,
        3,24,12,0,198,197,1,0,0,0,198,199,1,0,0,0,199,200,1,0,0,0,200,201,
        5,5,0,0,201,23,1,0,0,0,202,207,3,26,13,0,203,204,5,6,0,0,204,206,
        3,26,13,0,205,203,1,0,0,0,206,209,1,0,0,0,207,205,1,0,0,0,207,208,
        1,0,0,0,208,25,1,0,0,0,209,207,1,0,0,0,210,223,5,51,0,0,211,223,
        5,52,0,0,212,223,5,47,0,0,213,223,3,14,7,0,214,215,3,12,6,0,215,
        220,5,2,0,0,216,221,5,51,0,0,217,221,5,52,0,0,218,221,5,47,0,0,219,
        221,3,14,7,0,220,216,1,0,0,0,220,217,1,0,0,0,220,218,1,0,0,0,220,
        219,1,0,0,0,221,223,1,0,0,0,222,210,1,0,0,0,222,211,1,0,0,0,222,
        212,1,0,0,0,222,213,1,0,0,0,222,214,1,0,0,0,223,27,1,0,0,0,224,225,
        5,9,0,0,225,226,5,48,0,0,226,227,5,2,0,0,227,228,5,48,0,0,228,230,
        5,4,0,0,229,231,3,30,15,0,230,229,1,0,0,0,230,231,1,0,0,0,231,232,
        1,0,0,0,232,233,5,5,0,0,233,29,1,0,0,0,234,239,3,32,16,0,235,236,
        5,6,0,0,236,238,3,32,16,0,237,235,1,0,0,0,238,241,1,0,0,0,239,237,
        1,0,0,0,239,240,1,0,0,0,240,31,1,0,0,0,241,239,1,0,0,0,242,253,5,
        51,0,0,243,253,5,52,0,0,244,253,3,14,7,0,245,246,3,12,6,0,246,250,
        5,2,0,0,247,251,5,51,0,0,248,251,5,52,0,0,249,251,3,14,7,0,250,247,
        1,0,0,0,250,248,1,0,0,0,250,249,1,0,0,0,251,253,1,0,0,0,252,242,
        1,0,0,0,252,243,1,0,0,0,252,244,1,0,0,0,252,245,1,0,0,0,253,33,1,
        0,0,0,254,256,3,54,27,0,255,254,1,0,0,0,256,259,1,0,0,0,257,255,
        1,0,0,0,257,258,1,0,0,0,258,260,1,0,0,0,259,257,1,0,0,0,260,261,
        5,8,0,0,261,262,5,48,0,0,262,263,5,26,0,0,263,264,3,46,23,0,264,
        266,5,27,0,0,265,267,3,36,18,0,266,265,1,0,0,0,266,267,1,0,0,0,267,
        35,1,0,0,0,268,270,3,38,19,0,269,268,1,0,0,0,270,271,1,0,0,0,271,
        269,1,0,0,0,271,272,1,0,0,0,272,37,1,0,0,0,273,274,5,12,0,0,274,
        280,3,42,21,0,275,276,5,13,0,0,276,280,3,44,22,0,277,278,5,14,0,
        0,278,280,3,40,20,0,279,273,1,0,0,0,279,275,1,0,0,0,279,277,1,0,
        0,0,280,39,1,0,0,0,281,282,7,1,0,0,282,41,1,0,0,0,283,288,5,48,0,
        0,284,285,5,6,0,0,285,287,5,48,0,0,286,284,1,0,0,0,287,290,1,0,0,
        0,288,286,1,0,0,0,288,289,1,0,0,0,289,43,1,0,0,0,290,288,1,0,0,0,
        291,296,5,48,0,0,292,293,5,6,0,0,293,295,5,48,0,0,294,292,1,0,0,
        0,295,298,1,0,0,0,296,294,1,0,0,0,296,297,1,0,0,0,297,45,1,0,0,0,
        298,296,1,0,0,0,299,304,3,48,24,0,300,301,5,6,0,0,301,303,3,50,25,
        0,302,300,1,0,0,0,303,306,1,0,0,0,304,302,1,0,0,0,304,305,1,0,0,
        0,305,47,1,0,0,0,306,304,1,0,0,0,307,311,5,49,0,0,308,311,3,14,7,
        0,309,311,5,48,0,0,310,307,1,0,0,0,310,308,1,0,0,0,310,309,1,0,0,
        0,311,49,1,0,0,0,312,313,5,48,0,0,313,314,5,2,0,0,314,315,3,110,
        55,0,315,51,1,0,0,0,316,318,3,54,27,0,317,316,1,0,0,0,318,321,1,
        0,0,0,319,317,1,0,0,0,319,320,1,0,0,0,320,322,1,0,0,0,321,319,1,
        0,0,0,322,323,5,10,0,0,323,324,5,48,0,0,324,326,5,4,0,0,325,327,
        3,62,31,0,326,325,1,0,0,0,326,327,1,0,0,0,327,328,1,0,0,0,328,329,
        5,5,0,0,329,330,5,28,0,0,330,331,3,66,33,0,331,332,5,2,0,0,332,333,
        3,70,35,0,333,53,1,0,0,0,334,335,5,29,0,0,335,337,3,56,28,0,336,
        338,3,58,29,0,337,336,1,0,0,0,337,338,1,0,0,0,338,55,1,0,0,0,339,
        340,7,2,0,0,340,57,1,0,0,0,341,342,5,4,0,0,342,343,3,60,30,0,343,
        344,5,5,0,0,344,59,1,0,0,0,345,350,7,3,0,0,346,347,5,6,0,0,347,349,
        7,3,0,0,348,346,1,0,0,0,349,352,1,0,0,0,350,348,1,0,0,0,350,351,
        1,0,0,0,351,61,1,0,0,0,352,350,1,0,0,0,353,358,3,64,32,0,354,355,
        5,6,0,0,355,357,3,64,32,0,356,354,1,0,0,0,357,360,1,0,0,0,358,356,
        1,0,0,0,358,359,1,0,0,0,359,63,1,0,0,0,360,358,1,0,0,0,361,362,5,
        48,0,0,362,363,5,2,0,0,363,364,3,66,33,0,364,65,1,0,0,0,365,370,
        3,68,34,0,366,367,5,30,0,0,367,368,3,68,34,0,368,369,5,31,0,0,369,
        371,1,0,0,0,370,366,1,0,0,0,370,371,1,0,0,0,371,67,1,0,0,0,372,377,
        3,12,6,0,373,374,5,23,0,0,374,376,3,12,6,0,375,373,1,0,0,0,376,379,
        1,0,0,0,377,375,1,0,0,0,377,378,1,0,0,0,378,69,1,0,0,0,379,377,1,
        0,0,0,380,382,3,72,36,0,381,380,1,0,0,0,382,383,1,0,0,0,383,381,
        1,0,0,0,383,384,1,0,0,0,384,71,1,0,0,0,385,386,5,46,0,0,386,402,
        3,100,50,0,387,388,5,44,0,0,388,402,3,74,37,0,389,390,5,43,0,0,390,
        402,3,84,42,0,391,392,5,42,0,0,392,393,5,24,0,0,393,394,3,80,40,
        0,394,395,5,25,0,0,395,402,1,0,0,0,396,397,5,45,0,0,397,402,3,92,
        46,0,398,399,5,41,0,0,399,402,3,96,48,0,400,402,3,98,49,0,401,385,
        1,0,0,0,401,387,1,0,0,0,401,389,1,0,0,0,401,391,1,0,0,0,401,396,
        1,0,0,0,401,398,1,0,0,0,401,400,1,0,0,0,402,73,1,0,0,0,403,404,5,
        4,0,0,404,405,3,76,38,0,405,407,5,5,0,0,406,408,5,32,0,0,407,406,
        1,0,0,0,407,408,1,0,0,0,408,75,1,0,0,0,409,413,3,98,49,0,410,411,
        3,78,39,0,411,412,3,98,49,0,412,414,1,0,0,0,413,410,1,0,0,0,413,
        414,1,0,0,0,414,77,1,0,0,0,415,416,7,4,0,0,416,79,1,0,0,0,417,422,
        3,82,41,0,418,419,5,6,0,0,419,421,3,82,41,0,420,418,1,0,0,0,421,
        424,1,0,0,0,422,420,1,0,0,0,422,423,1,0,0,0,423,81,1,0,0,0,424,422,
        1,0,0,0,425,428,3,100,50,0,426,428,5,48,0,0,427,425,1,0,0,0,427,
        426,1,0,0,0,428,83,1,0,0,0,429,430,5,16,0,0,430,432,5,4,0,0,431,
        433,3,86,43,0,432,431,1,0,0,0,432,433,1,0,0,0,433,434,1,0,0,0,434,
        435,5,5,0,0,435,85,1,0,0,0,436,441,3,88,44,0,437,438,5,6,0,0,438,
        440,3,88,44,0,439,437,1,0,0,0,440,443,1,0,0,0,441,439,1,0,0,0,441,
        442,1,0,0,0,442,87,1,0,0,0,443,441,1,0,0,0,444,445,3,12,6,0,445,
        446,5,2,0,0,446,447,3,90,45,0,447,450,1,0,0,0,448,450,3,106,53,0,
        449,444,1,0,0,0,449,448,1,0,0,0,450,89,1,0,0,0,451,464,3,106,53,
        0,452,453,5,26,0,0,453,458,3,106,53,0,454,455,5,6,0,0,455,457,3,
        106,53,0,456,454,1,0,0,0,457,460,1,0,0,0,458,456,1,0,0,0,458,459,
        1,0,0,0,459,461,1,0,0,0,460,458,1,0,0,0,461,462,5,27,0,0,462,464,
        1,0,0,0,463,451,1,0,0,0,463,452,1,0,0,0,464,91,1,0,0,0,465,466,5,
        15,0,0,466,467,5,4,0,0,467,468,3,94,47,0,468,469,5,5,0,0,469,93,
        1,0,0,0,470,473,3,14,7,0,471,473,3,112,56,0,472,470,1,0,0,0,472,
        471,1,0,0,0,473,95,1,0,0,0,474,475,5,37,0,0,475,476,5,4,0,0,476,
        477,5,48,0,0,477,478,5,6,0,0,478,479,5,51,0,0,479,480,5,5,0,0,480,
        97,1,0,0,0,481,487,5,48,0,0,482,487,5,51,0,0,483,487,5,52,0,0,484,
        487,5,53,0,0,485,487,3,112,56,0,486,481,1,0,0,0,486,482,1,0,0,0,
        486,483,1,0,0,0,486,484,1,0,0,0,486,485,1,0,0,0,487,99,1,0,0,0,488,
        489,5,48,0,0,489,490,5,23,0,0,490,491,5,48,0,0,491,493,5,4,0,0,492,
        494,3,102,51,0,493,492,1,0,0,0,493,494,1,0,0,0,494,495,1,0,0,0,495,
        496,5,5,0,0,496,101,1,0,0,0,497,502,3,104,52,0,498,499,5,6,0,0,499,
        501,3,104,52,0,500,498,1,0,0,0,501,504,1,0,0,0,502,500,1,0,0,0,502,
        503,1,0,0,0,503,103,1,0,0,0,504,502,1,0,0,0,505,506,3,12,6,0,506,
        507,5,2,0,0,507,508,3,106,53,0,508,511,1,0,0,0,509,511,3,106,53,
        0,510,505,1,0,0,0,510,509,1,0,0,0,511,105,1,0,0,0,512,524,5,51,0,
        0,513,524,5,52,0,0,514,524,5,53,0,0,515,524,5,47,0,0,516,524,5,49,
        0,0,517,524,3,112,56,0,518,519,5,26,0,0,519,520,3,108,54,0,520,521,
        5,27,0,0,521,524,1,0,0,0,522,524,3,14,7,0,523,512,1,0,0,0,523,513,
        1,0,0,0,523,514,1,0,0,0,523,515,1,0,0,0,523,516,1,0,0,0,523,517,
        1,0,0,0,523,518,1,0,0,0,523,522,1,0,0,0,524,107,1,0,0,0,525,530,
        3,106,53,0,526,527,5,6,0,0,527,529,3,106,53,0,528,526,1,0,0,0,529,
        532,1,0,0,0,530,528,1,0,0,0,530,531,1,0,0,0,531,109,1,0,0,0,532,
        530,1,0,0,0,533,540,5,51,0,0,534,540,5,52,0,0,535,540,5,53,0,0,536,
        540,3,12,6,0,537,540,5,49,0,0,538,540,3,14,7,0,539,533,1,0,0,0,539,
        534,1,0,0,0,539,535,1,0,0,0,539,536,1,0,0,0,539,537,1,0,0,0,539,
        538,1,0,0,0,540,111,1,0,0,0,541,542,5,17,0,0,542,543,5,23,0,0,543,
        545,5,48,0,0,544,546,3,114,57,0,545,544,1,0,0,0,545,546,1,0,0,0,
        546,113,1,0,0,0,547,548,5,23,0,0,548,550,5,48,0,0,549,547,1,0,0,
        0,550,551,1,0,0,0,551,549,1,0,0,0,551,552,1,0,0,0,552,115,1,0,0,
        0,52,119,130,140,146,155,164,173,185,198,207,220,222,230,239,250,
        252,257,266,271,279,288,296,304,310,319,326,337,350,358,370,377,
        383,401,407,413,422,427,432,441,449,458,463,472,486,493,502,510,
        523,530,539,545,551
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
    public override enterRule(listener: HaloListener): void {
        if(listener.enterProgram) {
             listener.enterProgram(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitProgram) {
             listener.exitProgram(this);
        }
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
    public agentDecl(): AgentDeclContext | null {
        return this.getRuleContext(0, AgentDeclContext);
    }
    public pipelineDecl(): PipelineDeclContext | null {
        return this.getRuleContext(0, PipelineDeclContext);
    }
    public schemaDecl(): SchemaDeclContext | null {
        return this.getRuleContext(0, SchemaDeclContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_declaration;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterDeclaration) {
             listener.enterDeclaration(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitDeclaration) {
             listener.exitDeclaration(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitDeclaration) {
            return visitor.visitDeclaration(this);
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
    public override enterRule(listener: HaloListener): void {
        if(listener.enterPolicyDecl) {
             listener.enterPolicyDecl(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitPolicyDecl) {
             listener.exitPolicyDecl(this);
        }
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
    public policyArgs(): PolicyArgsContext | null {
        return this.getRuleContext(0, PolicyArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_policyRule;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterPolicyRule) {
             listener.enterPolicyRule(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitPolicyRule) {
             listener.exitPolicyRule(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPolicyRule) {
            return visitor.visitPolicyRule(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PolicyArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public policyArg(): PolicyArgContext[];
    public policyArg(i: number): PolicyArgContext | null;
    public policyArg(i?: number): PolicyArgContext[] | PolicyArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PolicyArgContext);
        }

        return this.getRuleContext(i, PolicyArgContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_policyArgs;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterPolicyArgs) {
             listener.enterPolicyArgs(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitPolicyArgs) {
             listener.exitPolicyArgs(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPolicyArgs) {
            return visitor.visitPolicyArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PolicyArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.MODEL_REF, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.IDENTIFIER, 0);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.DURATION, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_policyArg;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterPolicyArg) {
             listener.enterPolicyArg(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitPolicyArg) {
             listener.exitPolicyArg(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPolicyArg) {
            return visitor.visitPolicyArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IdOrKeywordContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_idOrKeyword;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterIdOrKeyword) {
             listener.enterIdOrKeyword(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitIdOrKeyword) {
             listener.exitIdOrKeyword(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitIdOrKeyword) {
            return visitor.visitIdOrKeyword(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DottedIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public idOrKeyword(): IdOrKeywordContext[];
    public idOrKeyword(i: number): IdOrKeywordContext | null;
    public idOrKeyword(i?: number): IdOrKeywordContext[] | IdOrKeywordContext | null {
        if (i === undefined) {
            return this.getRuleContexts(IdOrKeywordContext);
        }

        return this.getRuleContext(i, IdOrKeywordContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_dottedId;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterDottedId) {
             listener.enterDottedId(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitDottedId) {
             listener.exitDottedId(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitDottedId) {
            return visitor.visitDottedId(this);
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
    public schemaFields(): SchemaFieldsContext {
        return this.getRuleContext(0, SchemaFieldsContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_schemaDecl;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterSchemaDecl) {
             listener.enterSchemaDecl(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitSchemaDecl) {
             listener.exitSchemaDecl(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitSchemaDecl) {
            return visitor.visitSchemaDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SchemaFieldsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
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
        return HaloParser.RULE_schemaFields;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterSchemaFields) {
             listener.enterSchemaFields(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitSchemaFields) {
             listener.exitSchemaFields(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitSchemaFields) {
            return visitor.visitSchemaFields(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SchemaFieldContext extends antlr.ParserRuleContext {
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
        return HaloParser.RULE_schemaField;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterSchemaField) {
             listener.enterSchemaField(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitSchemaField) {
             listener.exitSchemaField(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitSchemaField) {
            return visitor.visitSchemaField(this);
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
    public toolArgs(): ToolArgsContext | null {
        return this.getRuleContext(0, ToolArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_toolDecl;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterToolDecl) {
             listener.enterToolDecl(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitToolDecl) {
             listener.exitToolDecl(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_toolArgs;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterToolArgs) {
             listener.enterToolArgs(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitToolArgs) {
             listener.exitToolArgs(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return this.getToken(HaloParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.DURATION, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public idOrKeyword(): IdOrKeywordContext | null {
        return this.getRuleContext(0, IdOrKeywordContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_toolArg;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterToolArg) {
             listener.enterToolArg(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitToolArg) {
             listener.exitToolArg(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitToolArg) {
            return visitor.visitToolArg(this);
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
    public storeArgs(): StoreArgsContext | null {
        return this.getRuleContext(0, StoreArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_storeDecl;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterStoreDecl) {
             listener.enterStoreDecl(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitStoreDecl) {
             listener.exitStoreDecl(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitStoreDecl) {
            return visitor.visitStoreDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StoreArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public storeArg(): StoreArgContext[];
    public storeArg(i: number): StoreArgContext | null;
    public storeArg(i?: number): StoreArgContext[] | StoreArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StoreArgContext);
        }

        return this.getRuleContext(i, StoreArgContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_storeArgs;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterStoreArgs) {
             listener.enterStoreArgs(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitStoreArgs) {
             listener.exitStoreArgs(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitStoreArgs) {
            return visitor.visitStoreArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StoreArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public idOrKeyword(): IdOrKeywordContext | null {
        return this.getRuleContext(0, IdOrKeywordContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_storeArg;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterStoreArg) {
             listener.enterStoreArg(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitStoreArg) {
             listener.exitStoreArg(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitStoreArg) {
            return visitor.visitStoreArg(this);
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
    public agentModifiers(): AgentModifiersContext | null {
        return this.getRuleContext(0, AgentModifiersContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_agentDecl;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterAgentDecl) {
             listener.enterAgentDecl(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitAgentDecl) {
             listener.exitAgentDecl(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitAgentDecl) {
            return visitor.visitAgentDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AgentModifiersContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
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
        return HaloParser.RULE_agentModifiers;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterAgentModifiers) {
             listener.enterAgentModifiers(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitAgentModifiers) {
             listener.exitAgentModifiers(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitAgentModifiers) {
            return visitor.visitAgentModifiers(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AgentModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public equipsList(): EquipsListContext | null {
        return this.getRuleContext(0, EquipsListContext);
    }
    public requiresList(): RequiresListContext | null {
        return this.getRuleContext(0, RequiresListContext);
    }
    public stringLiteral(): StringLiteralContext | null {
        return this.getRuleContext(0, StringLiteralContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_agentModifier;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterAgentModifier) {
             listener.enterAgentModifier(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitAgentModifier) {
             listener.exitAgentModifier(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitAgentModifier) {
            return visitor.visitAgentModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StringLiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public TRIPLE_STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.TRIPLE_STRING, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_stringLiteral;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterStringLiteral) {
             listener.enterStringLiteral(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitStringLiteral) {
             listener.exitStringLiteral(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitStringLiteral) {
            return visitor.visitStringLiteral(this);
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
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_equipsList;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterEquipsList) {
             listener.enterEquipsList(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitEquipsList) {
             listener.exitEquipsList(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_requiresList;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterRequiresList) {
             listener.enterRequiresList(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitRequiresList) {
             listener.exitRequiresList(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_modelConfig;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterModelConfig) {
             listener.enterModelConfig(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitModelConfig) {
             listener.exitModelConfig(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.MODEL_REF, 0);
    }
    public dottedId(): DottedIdContext | null {
        return this.getRuleContext(0, DottedIdContext);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.IDENTIFIER, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_modelId;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterModelId) {
             listener.enterModelId(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitModelId) {
             listener.exitModelId(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public value(): ValueContext {
        return this.getRuleContext(0, ValueContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_modelParam;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterModelParam) {
             listener.enterModelParam(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitModelParam) {
             listener.exitModelParam(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitModelParam) {
            return visitor.visitModelParam(this);
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
        return HaloParser.RULE_pipelineDecl;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterPipelineDecl) {
             listener.enterPipelineDecl(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitPipelineDecl) {
             listener.exitPipelineDecl(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitPipelineDecl) {
            return visitor.visitPipelineDecl(this);
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
        return HaloParser.RULE_directive;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterDirective) {
             listener.enterDirective(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitDirective) {
             listener.exitDirective(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_directiveName;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterDirectiveName) {
             listener.enterDirectiveName(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitDirectiveName) {
             listener.exitDirectiveName(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_directiveValue;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterDirectiveValue) {
             listener.enterDirectiveValue(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitDirectiveValue) {
             listener.exitDirectiveValue(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public NUMBER(): antlr.TerminalNode[];
    public NUMBER(i: number): antlr.TerminalNode | null;
    public NUMBER(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.NUMBER);
    	} else {
    		return this.getToken(HaloParser.NUMBER, i);
    	}
    }
    public STRING(): antlr.TerminalNode[];
    public STRING(i: number): antlr.TerminalNode | null;
    public STRING(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.STRING);
    	} else {
    		return this.getToken(HaloParser.STRING, i);
    	}
    }
    public MODEL_REF(): antlr.TerminalNode[];
    public MODEL_REF(i: number): antlr.TerminalNode | null;
    public MODEL_REF(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.MODEL_REF);
    	} else {
    		return this.getToken(HaloParser.MODEL_REF, i);
    	}
    }
    public DURATION(): antlr.TerminalNode[];
    public DURATION(i: number): antlr.TerminalNode | null;
    public DURATION(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(HaloParser.DURATION);
    	} else {
    		return this.getToken(HaloParser.DURATION, i);
    	}
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_directiveArgs;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterDirectiveArgs) {
             listener.enterDirectiveArgs(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitDirectiveArgs) {
             listener.exitDirectiveArgs(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_paramList;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterParamList) {
             listener.enterParamList(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitParamList) {
             listener.exitParamList(this);
        }
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
    public override enterRule(listener: HaloListener): void {
        if(listener.enterParam) {
             listener.enterParam(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitParam) {
             listener.exitParam(this);
        }
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
    public typeName(): TypeNameContext[];
    public typeName(i: number): TypeNameContext | null;
    public typeName(i?: number): TypeNameContext[] | TypeNameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeNameContext);
        }

        return this.getRuleContext(i, TypeNameContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_typeRef;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterTypeRef) {
             listener.enterTypeRef(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitTypeRef) {
             listener.exitTypeRef(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitTypeRef) {
            return visitor.visitTypeRef(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public idOrKeyword(): IdOrKeywordContext[];
    public idOrKeyword(i: number): IdOrKeywordContext | null;
    public idOrKeyword(i?: number): IdOrKeywordContext[] | IdOrKeywordContext | null {
        if (i === undefined) {
            return this.getRuleContexts(IdOrKeywordContext);
        }

        return this.getRuleContext(i, IdOrKeywordContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_typeName;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterTypeName) {
             listener.enterTypeName(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitTypeName) {
             listener.exitTypeName(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitTypeName) {
            return visitor.visitTypeName(this);
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
        return HaloParser.RULE_pipeline;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterPipeline) {
             listener.enterPipeline(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitPipeline) {
             listener.exitPipeline(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return this.getToken(HaloParser.PIPE, 0);
    }
    public callExpr(): CallExprContext | null {
        return this.getRuleContext(0, CallExprContext);
    }
    public GATE(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.GATE, 0);
    }
    public condition(): ConditionContext | null {
        return this.getRuleContext(0, ConditionContext);
    }
    public INTERRUPT(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.INTERRUPT, 0);
    }
    public yieldExpr(): YieldExprContext | null {
        return this.getRuleContext(0, YieldExprContext);
    }
    public FANOUT(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.FANOUT, 0);
    }
    public fanoutStages(): FanoutStagesContext | null {
        return this.getRuleContext(0, FanoutStagesContext);
    }
    public LISTEN(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.LISTEN, 0);
    }
    public listenExpr(): ListenExprContext | null {
        return this.getRuleContext(0, ListenExprContext);
    }
    public LOOP(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.LOOP, 0);
    }
    public loopExpr(): LoopExprContext | null {
        return this.getRuleContext(0, LoopExprContext);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_pipelineStage;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterPipelineStage) {
             listener.enterPipelineStage(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitPipelineStage) {
             listener.exitPipelineStage(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_condition;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterCondition) {
             listener.enterCondition(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitCondition) {
             listener.exitCondition(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_conditionExpr;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterConditionExpr) {
             listener.enterConditionExpr(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitConditionExpr) {
             listener.exitConditionExpr(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitConditionExpr) {
            return visitor.visitConditionExpr(this);
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
        return HaloParser.RULE_comparisonOp;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterComparisonOp) {
             listener.enterComparisonOp(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitComparisonOp) {
             listener.exitComparisonOp(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_fanoutStages;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterFanoutStages) {
             listener.enterFanoutStages(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitFanoutStages) {
             listener.exitFanoutStages(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return this.getToken(HaloParser.IDENTIFIER, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_fanoutStage;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterFanoutStage) {
             listener.enterFanoutStage(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitFanoutStage) {
             listener.exitFanoutStage(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_yieldExpr;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterYieldExpr) {
             listener.enterYieldExpr(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitYieldExpr) {
             listener.exitYieldExpr(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_yieldArgs;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterYieldArgs) {
             listener.enterYieldArgs(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitYieldArgs) {
             listener.exitYieldArgs(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
    public idOrKeyword(): IdOrKeywordContext | null {
        return this.getRuleContext(0, IdOrKeywordContext);
    }
    public yieldArgValue(): YieldArgValueContext | null {
        return this.getRuleContext(0, YieldArgValueContext);
    }
    public callValue(): CallValueContext | null {
        return this.getRuleContext(0, CallValueContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_yieldArg;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterYieldArg) {
             listener.enterYieldArg(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitYieldArg) {
             listener.exitYieldArg(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_yieldArgValue;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterYieldArgValue) {
             listener.enterYieldArgValue(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitYieldArgValue) {
             listener.exitYieldArgValue(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_listenExpr;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterListenExpr) {
             listener.enterListenExpr(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitListenExpr) {
             listener.exitListenExpr(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_listenTarget;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterListenTarget) {
             listener.enterListenTarget(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitListenTarget) {
             listener.exitListenTarget(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitListenTarget) {
            return visitor.visitListenTarget(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LoopExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode {
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public STRING(): antlr.TerminalNode {
        return this.getToken(HaloParser.STRING, 0)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_loopExpr;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterLoopExpr) {
             listener.enterLoopExpr(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitLoopExpr) {
             listener.exitLoopExpr(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitLoopExpr) {
            return visitor.visitLoopExpr(this);
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
        return this.getToken(HaloParser.IDENTIFIER, 0);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.BOOL, 0);
    }
    public contextRef(): ContextRefContext | null {
        return this.getRuleContext(0, ContextRefContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_expression;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterExpression) {
             listener.enterExpression(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitExpression) {
             listener.exitExpression(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public callArgs(): CallArgsContext | null {
        return this.getRuleContext(0, CallArgsContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_callExpr;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterCallExpr) {
             listener.enterCallExpr(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitCallExpr) {
             listener.exitCallExpr(this);
        }
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
    public override enterRule(listener: HaloListener): void {
        if(listener.enterCallArgs) {
             listener.enterCallArgs(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitCallArgs) {
             listener.exitCallArgs(this);
        }
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
    public idOrKeyword(): IdOrKeywordContext | null {
        return this.getRuleContext(0, IdOrKeywordContext);
    }
    public callValue(): CallValueContext {
        return this.getRuleContext(0, CallValueContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_callArg;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterCallArg) {
             listener.enterCallArg(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitCallArg) {
             listener.exitCallArg(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitCallArg) {
            return visitor.visitCallArg(this);
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
        return this.getToken(HaloParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.BOOL, 0);
    }
    public DURATION(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.DURATION, 0);
    }
    public MODEL_REF(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.MODEL_REF, 0);
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
        return HaloParser.RULE_callValue;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterCallValue) {
             listener.enterCallValue(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitCallValue) {
             listener.exitCallValue(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return HaloParser.RULE_callItems;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterCallItems) {
             listener.enterCallItems(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitCallItems) {
             listener.exitCallItems(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
        return this.getToken(HaloParser.STRING, 0);
    }
    public NUMBER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.NUMBER, 0);
    }
    public BOOL(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.BOOL, 0);
    }
    public idOrKeyword(): IdOrKeywordContext | null {
        return this.getRuleContext(0, IdOrKeywordContext);
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
    public override enterRule(listener: HaloListener): void {
        if(listener.enterValue) {
             listener.enterValue(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitValue) {
             listener.exitValue(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitValue) {
            return visitor.visitValue(this);
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
        return this.getToken(HaloParser.IDENTIFIER, 0)!;
    }
    public contextTail(): ContextTailContext | null {
        return this.getRuleContext(0, ContextTailContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_contextRef;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterContextRef) {
             listener.enterContextRef(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitContextRef) {
             listener.exitContextRef(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
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
    		return this.getTokens(HaloParser.IDENTIFIER);
    	} else {
    		return this.getToken(HaloParser.IDENTIFIER, i);
    	}
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_contextTail;
    }
    public override enterRule(listener: HaloListener): void {
        if(listener.enterContextTail) {
             listener.enterContextTail(this);
        }
    }
    public override exitRule(listener: HaloListener): void {
        if(listener.exitContextTail) {
             listener.exitContextTail(this);
        }
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitContextTail) {
            return visitor.visitContextTail(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
