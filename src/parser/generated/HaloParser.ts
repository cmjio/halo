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
    public static readonly RULE_policyDecl = 4;
    public static readonly RULE_policyRule = 5;
    public static readonly RULE_toolDecl = 6;
    public static readonly RULE_storeDecl = 7;
    public static readonly RULE_schemaDecl = 8;
    public static readonly RULE_schemaField = 9;
    public static readonly RULE_agentDecl = 10;
    public static readonly RULE_modelRef = 11;
    public static readonly RULE_modelParam = 12;
    public static readonly RULE_agentModifier = 13;
    public static readonly RULE_directive = 14;
    public static readonly RULE_directiveArg = 15;
    public static readonly RULE_pipelineDecl = 16;
    public static readonly RULE_paramList = 17;
    public static readonly RULE_param = 18;
    public static readonly RULE_typeRef = 19;
    public static readonly RULE_pipeline = 20;
    public static readonly RULE_pipelineOp = 21;
    public static readonly RULE_binding = 22;
    public static readonly RULE_branchArm = 23;
    public static readonly RULE_fanoutItem = 24;
    public static readonly RULE_callExpr = 25;
    public static readonly RULE_callArgs = 26;
    public static readonly RULE_callArg = 27;
    public static readonly RULE_callValue = 28;
    public static readonly RULE_listValue = 29;
    public static readonly RULE_value = 30;
    public static readonly RULE_literal = 31;
    public static readonly RULE_expression = 32;
    public static readonly RULE_contextRef = 33;
    public static readonly RULE_condExpr = 34;
    public static readonly RULE_orExpr = 35;
    public static readonly RULE_andExpr = 36;
    public static readonly RULE_notExpr = 37;
    public static readonly RULE_comparison = 38;
    public static readonly RULE_compOp = 39;
    public static readonly RULE_operand = 40;

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
        "program", "declaration", "name", "dottedId", "policyDecl", "policyRule", 
        "toolDecl", "storeDecl", "schemaDecl", "schemaField", "agentDecl", 
        "modelRef", "modelParam", "agentModifier", "directive", "directiveArg", 
        "pipelineDecl", "paramList", "param", "typeRef", "pipeline", "pipelineOp", 
        "binding", "branchArm", "fanoutItem", "callExpr", "callArgs", "callArg", 
        "callValue", "listValue", "value", "literal", "expression", "contextRef", 
        "condExpr", "orExpr", "andExpr", "notExpr", "comparison", "compOp", 
        "operand",
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
            this.state = 85;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 268435582) !== 0)) {
                {
                {
                this.state = 82;
                this.declaration();
                }
                }
                this.state = 87;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 88;
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
            this.state = 96;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 90;
                this.policyDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 91;
                this.toolDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 92;
                this.storeDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 93;
                this.schemaDecl();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 94;
                this.agentDecl();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 95;
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
            this.state = 98;
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
            this.state = 100;
            this.match(HaloParser.IDENTIFIER);
            this.state = 105;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 18) {
                {
                {
                this.state = 101;
                this.match(HaloParser.T__17);
                this.state = 102;
                this.name();
                }
                }
                this.state = 107;
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
    public policyDecl(): PolicyDeclContext {
        let localContext = new PolicyDeclContext(this.context, this.state);
        this.enterRule(localContext, 8, HaloParser.RULE_policyDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 108;
            this.match(HaloParser.T__0);
            this.state = 109;
            this.match(HaloParser.IDENTIFIER);
            this.state = 110;
            this.match(HaloParser.T__18);
            this.state = 111;
            this.policyRule();
            this.state = 116;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 20) {
                {
                {
                this.state = 112;
                this.match(HaloParser.T__19);
                this.state = 113;
                this.policyRule();
                }
                }
                this.state = 118;
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
        this.enterRule(localContext, 10, HaloParser.RULE_policyRule);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 119;
            this.match(HaloParser.IDENTIFIER);
            this.state = 120;
            this.match(HaloParser.T__20);
            this.state = 122;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 121;
                this.callArgs();
                }
            }

            this.state = 124;
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
        this.enterRule(localContext, 12, HaloParser.RULE_toolDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 126;
            this.match(HaloParser.T__1);
            this.state = 127;
            this.match(HaloParser.IDENTIFIER);
            this.state = 128;
            this.match(HaloParser.T__18);
            this.state = 129;
            this.match(HaloParser.IDENTIFIER);
            this.state = 130;
            this.match(HaloParser.T__20);
            this.state = 132;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 131;
                this.callArgs();
                }
            }

            this.state = 134;
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
        this.enterRule(localContext, 14, HaloParser.RULE_storeDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 136;
            this.match(HaloParser.T__2);
            this.state = 137;
            this.match(HaloParser.IDENTIFIER);
            this.state = 138;
            this.match(HaloParser.T__18);
            this.state = 139;
            this.match(HaloParser.IDENTIFIER);
            this.state = 140;
            this.match(HaloParser.T__20);
            this.state = 142;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 141;
                this.callArgs();
                }
            }

            this.state = 144;
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
        this.enterRule(localContext, 16, HaloParser.RULE_schemaDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 146;
            this.match(HaloParser.T__3);
            this.state = 147;
            this.match(HaloParser.IDENTIFIER);
            this.state = 148;
            this.match(HaloParser.T__22);
            this.state = 155;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 262142) !== 0) || _la === 55) {
                {
                {
                this.state = 149;
                this.schemaField();
                this.state = 151;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 150;
                    this.match(HaloParser.T__23);
                    }
                }

                }
                }
                this.state = 157;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 158;
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
        this.enterRule(localContext, 18, HaloParser.RULE_schemaField);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 160;
            this.name();
            this.state = 161;
            this.match(HaloParser.T__18);
            this.state = 162;
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
        this.enterRule(localContext, 20, HaloParser.RULE_agentDecl);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 167;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 28) {
                {
                {
                this.state = 164;
                this.directive();
                }
                }
                this.state = 169;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 170;
            this.match(HaloParser.T__4);
            this.state = 171;
            this.match(HaloParser.IDENTIFIER);
            this.state = 172;
            this.match(HaloParser.T__25);
            this.state = 173;
            this.modelRef();
            this.state = 178;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 174;
                    this.match(HaloParser.T__23);
                    this.state = 175;
                    this.modelParam();
                    }
                    }
                }
                this.state = 180;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
            }
            this.state = 182;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 181;
                this.match(HaloParser.T__23);
                }
            }

            this.state = 184;
            this.match(HaloParser.T__26);
            this.state = 188;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 896) !== 0)) {
                {
                {
                this.state = 185;
                this.agentModifier();
                }
                }
                this.state = 190;
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
        this.enterRule(localContext, 22, HaloParser.RULE_modelRef);
        try {
            this.state = 194;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 191;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 192;
                this.match(HaloParser.STRING);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 193;
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
        this.enterRule(localContext, 24, HaloParser.RULE_modelParam);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 196;
            this.name();
            this.state = 197;
            this.match(HaloParser.T__18);
            this.state = 198;
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
        this.enterRule(localContext, 26, HaloParser.RULE_agentModifier);
        let _la: number;
        try {
            this.state = 220;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__6:
                localContext = new EquipsModifierContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 200;
                this.match(HaloParser.T__6);
                this.state = 201;
                this.match(HaloParser.IDENTIFIER);
                this.state = 206;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24) {
                    {
                    {
                    this.state = 202;
                    this.match(HaloParser.T__23);
                    this.state = 203;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 208;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__7:
                localContext = new RequiresModifierContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 209;
                this.match(HaloParser.T__7);
                this.state = 210;
                this.match(HaloParser.IDENTIFIER);
                this.state = 215;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24) {
                    {
                    {
                    this.state = 211;
                    this.match(HaloParser.T__23);
                    this.state = 212;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 217;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__8:
                localContext = new SystemModifierContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 218;
                this.match(HaloParser.T__8);
                this.state = 219;
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
        this.enterRule(localContext, 28, HaloParser.RULE_directive);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 222;
            this.match(HaloParser.T__27);
            this.state = 223;
            this.name();
            this.state = 236;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21) {
                {
                this.state = 224;
                this.match(HaloParser.T__20);
                this.state = 233;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                    {
                    this.state = 225;
                    this.directiveArg();
                    this.state = 230;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 24) {
                        {
                        {
                        this.state = 226;
                        this.match(HaloParser.T__23);
                        this.state = 227;
                        this.directiveArg();
                        }
                        }
                        this.state = 232;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                this.state = 235;
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
        this.enterRule(localContext, 30, HaloParser.RULE_directiveArg);
        try {
            this.state = 241;
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
                this.state = 238;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 239;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 240;
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
        this.enterRule(localContext, 32, HaloParser.RULE_pipelineDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 246;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 28) {
                {
                {
                this.state = 243;
                this.directive();
                }
                }
                this.state = 248;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 249;
            this.match(HaloParser.T__5);
            this.state = 250;
            this.match(HaloParser.IDENTIFIER);
            this.state = 251;
            this.match(HaloParser.T__20);
            this.state = 253;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 55) {
                {
                this.state = 252;
                this.paramList();
                }
            }

            this.state = 255;
            this.match(HaloParser.T__21);
            this.state = 258;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 29) {
                {
                this.state = 256;
                this.match(HaloParser.T__28);
                this.state = 257;
                this.typeRef();
                }
            }

            this.state = 260;
            this.match(HaloParser.T__18);
            this.state = 261;
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
        this.enterRule(localContext, 34, HaloParser.RULE_paramList);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 263;
            this.param();
            this.state = 268;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 24, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 264;
                    this.match(HaloParser.T__23);
                    this.state = 265;
                    this.param();
                    }
                    }
                }
                this.state = 270;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 24, this.context);
            }
            this.state = 272;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 271;
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
        this.enterRule(localContext, 36, HaloParser.RULE_param);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 274;
            this.match(HaloParser.IDENTIFIER);
            this.state = 275;
            this.match(HaloParser.T__18);
            this.state = 276;
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
        this.enterRule(localContext, 38, HaloParser.RULE_typeRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 278;
            this.dottedId();
            this.state = 290;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 30) {
                {
                this.state = 279;
                this.match(HaloParser.T__29);
                this.state = 280;
                this.typeRef();
                this.state = 285;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24) {
                    {
                    {
                    this.state = 281;
                    this.match(HaloParser.T__23);
                    this.state = 282;
                    this.typeRef();
                    }
                    }
                    this.state = 287;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 288;
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
        this.enterRule(localContext, 40, HaloParser.RULE_pipeline);
        let _la: number;
        try {
            this.state = 304;
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
                this.state = 292;
                this.expression();
                this.state = 296;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 63) !== 0)) {
                    {
                    {
                    this.state = 293;
                    this.pipelineOp();
                    }
                    }
                    this.state = 298;
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
                this.state = 300;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 299;
                    this.pipelineOp();
                    }
                    }
                    this.state = 302;
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
        this.enterRule(localContext, 42, HaloParser.RULE_pipelineOp);
        let _la: number;
        try {
            let alternative: number;
            this.state = 400;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 46, this.context) ) {
            case 1:
                localContext = new PipeOpContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 306;
                this.match(HaloParser.PIPE);
                this.state = 307;
                this.callExpr();
                this.state = 309;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 308;
                    this.binding();
                    }
                }

                }
                break;
            case 2:
                localContext = new GateOpContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 311;
                this.match(HaloParser.GATE);
                this.state = 312;
                this.match(HaloParser.T__20);
                this.state = 313;
                this.condExpr();
                this.state = 314;
                this.match(HaloParser.T__21);
                this.state = 316;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 32) {
                    {
                    this.state = 315;
                    this.match(HaloParser.T__31);
                    }
                }

                }
                break;
            case 3:
                localContext = new BranchOpContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 318;
                this.match(HaloParser.GATE);
                this.state = 319;
                this.match(HaloParser.T__22);
                this.state = 320;
                this.branchArm();
                this.state = 325;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 321;
                        this.match(HaloParser.T__23);
                        this.state = 322;
                        this.branchArm();
                        }
                        }
                    }
                    this.state = 327;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
                }
                this.state = 329;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 328;
                    this.match(HaloParser.T__23);
                    }
                }

                this.state = 331;
                this.match(HaloParser.T__24);
                this.state = 333;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 332;
                    this.binding();
                    }
                }

                }
                break;
            case 4:
                localContext = new InterruptOpContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 335;
                this.match(HaloParser.INTERRUPT);
                this.state = 336;
                this.match(HaloParser.T__10);
                this.state = 337;
                this.match(HaloParser.T__20);
                this.state = 339;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                    {
                    this.state = 338;
                    this.callArgs();
                    }
                }

                this.state = 341;
                this.match(HaloParser.T__21);
                this.state = 343;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 342;
                    this.binding();
                    }
                }

                }
                break;
            case 5:
                localContext = new FanoutOpContext(localContext);
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 345;
                this.match(HaloParser.FANOUT);
                this.state = 346;
                this.match(HaloParser.T__22);
                this.state = 347;
                this.fanoutItem();
                this.state = 352;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 38, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 348;
                        this.match(HaloParser.T__23);
                        this.state = 349;
                        this.fanoutItem();
                        }
                        }
                    }
                    this.state = 354;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 38, this.context);
                }
                this.state = 356;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 355;
                    this.match(HaloParser.T__23);
                    }
                }

                this.state = 358;
                this.match(HaloParser.T__24);
                this.state = 360;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 359;
                    this.binding();
                    }
                }

                }
                break;
            case 6:
                localContext = new EachOpContext(localContext);
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 362;
                this.match(HaloParser.FANOUT);
                this.state = 363;
                this.match(HaloParser.T__14);
                this.state = 364;
                this.match(HaloParser.T__20);
                this.state = 365;
                this.match(HaloParser.IDENTIFIER);
                this.state = 366;
                this.match(HaloParser.T__15);
                this.state = 367;
                this.callValue();
                this.state = 370;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 368;
                    this.match(HaloParser.T__23);
                    this.state = 369;
                    this.callArgs();
                    }
                }

                this.state = 372;
                this.match(HaloParser.T__21);
                this.state = 373;
                this.match(HaloParser.T__31);
                this.state = 374;
                this.callExpr();
                this.state = 376;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 375;
                    this.binding();
                    }
                }

                }
                break;
            case 7:
                localContext = new ListenOpContext(localContext);
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 378;
                this.match(HaloParser.LISTEN);
                this.state = 379;
                this.match(HaloParser.T__11);
                this.state = 380;
                this.match(HaloParser.T__20);
                this.state = 381;
                this.callValue();
                this.state = 382;
                this.match(HaloParser.T__21);
                this.state = 384;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 383;
                    this.binding();
                    }
                }

                }
                break;
            case 8:
                localContext = new LoopOpContext(localContext);
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 386;
                this.match(HaloParser.LOOP);
                this.state = 387;
                this.match(HaloParser.T__12);
                this.state = 388;
                this.match(HaloParser.T__20);
                this.state = 389;
                this.match(HaloParser.IDENTIFIER);
                this.state = 390;
                this.match(HaloParser.T__23);
                this.state = 391;
                _la = this.tokenStream.LA(1);
                if(!(_la === 56 || _la === 57)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 394;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 392;
                    this.match(HaloParser.T__23);
                    this.state = 393;
                    this.callArgs();
                    }
                }

                this.state = 396;
                this.match(HaloParser.T__21);
                this.state = 398;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 397;
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
        this.enterRule(localContext, 44, HaloParser.RULE_binding);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 402;
            this.match(HaloParser.T__13);
            this.state = 403;
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
        this.enterRule(localContext, 46, HaloParser.RULE_branchArm);
        try {
            this.state = 414;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__20:
                localContext = new CondArmContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 405;
                this.match(HaloParser.T__20);
                this.state = 406;
                this.condExpr();
                this.state = 407;
                this.match(HaloParser.T__21);
                this.state = 408;
                this.match(HaloParser.T__31);
                this.state = 409;
                this.callExpr();
                }
                break;
            case HaloParser.T__16:
                localContext = new ElseArmContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 411;
                this.match(HaloParser.T__16);
                this.state = 412;
                this.match(HaloParser.T__31);
                this.state = 413;
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
        this.enterRule(localContext, 48, HaloParser.RULE_fanoutItem);
        let _la: number;
        try {
            this.state = 424;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 50, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 416;
                this.callExpr();
                this.state = 418;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 417;
                    this.binding();
                    }
                }

                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 420;
                this.match(HaloParser.IDENTIFIER);
                this.state = 422;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 421;
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
        this.enterRule(localContext, 50, HaloParser.RULE_callExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 426;
            this.match(HaloParser.IDENTIFIER);
            this.state = 429;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 18) {
                {
                this.state = 427;
                this.match(HaloParser.T__17);
                this.state = 428;
                this.name();
                }
            }

            this.state = 431;
            this.match(HaloParser.T__20);
            this.state = 433;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 67371006) !== 0) || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 432;
                this.callArgs();
                }
            }

            this.state = 435;
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
        this.enterRule(localContext, 52, HaloParser.RULE_callArgs);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 437;
            this.callArg();
            this.state = 442;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 53, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 438;
                    this.match(HaloParser.T__23);
                    this.state = 439;
                    this.callArg();
                    }
                    }
                }
                this.state = 444;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 53, this.context);
            }
            this.state = 446;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 445;
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
        this.enterRule(localContext, 54, HaloParser.RULE_callArg);
        try {
            this.state = 453;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 55, this.context) ) {
            case 1:
                localContext = new NamedArgContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 448;
                this.name();
                this.state = 449;
                this.match(HaloParser.T__18);
                this.state = 450;
                this.callValue();
                }
                break;
            case 2:
                localContext = new PositionalArgContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 452;
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
        this.enterRule(localContext, 56, HaloParser.RULE_callValue);
        try {
            this.state = 460;
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
                this.state = 455;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 456;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 457;
                this.contextRef();
                }
                break;
            case HaloParser.T__25:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 458;
                this.listValue();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 459;
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
        this.enterRule(localContext, 58, HaloParser.RULE_listValue);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 462;
            this.match(HaloParser.T__25);
            this.state = 474;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 26 || ((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & 255) !== 0)) {
                {
                this.state = 463;
                this.callValue();
                this.state = 468;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 57, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 464;
                        this.match(HaloParser.T__23);
                        this.state = 465;
                        this.callValue();
                        }
                        }
                    }
                    this.state = 470;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 57, this.context);
                }
                this.state = 472;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 24) {
                    {
                    this.state = 471;
                    this.match(HaloParser.T__23);
                    }
                }

                }
            }

            this.state = 476;
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
        this.enterRule(localContext, 60, HaloParser.RULE_value);
        try {
            this.state = 481;
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
                this.state = 478;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 479;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 480;
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
        this.enterRule(localContext, 62, HaloParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 483;
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
        this.enterRule(localContext, 64, HaloParser.RULE_expression);
        try {
            this.state = 488;
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
                this.state = 485;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 486;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 487;
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
        this.enterRule(localContext, 66, HaloParser.RULE_contextRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 490;
            this.match(HaloParser.T__9);
            this.state = 495;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 18) {
                {
                {
                this.state = 491;
                this.match(HaloParser.T__17);
                this.state = 492;
                this.name();
                }
                }
                this.state = 497;
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
        this.enterRule(localContext, 68, HaloParser.RULE_condExpr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 498;
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
        this.enterRule(localContext, 70, HaloParser.RULE_orExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 500;
            this.andExpr();
            this.state = 505;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 33) {
                {
                {
                this.state = 501;
                this.match(HaloParser.T__32);
                this.state = 502;
                this.andExpr();
                }
                }
                this.state = 507;
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
        this.enterRule(localContext, 72, HaloParser.RULE_andExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 508;
            this.notExpr();
            this.state = 513;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 34) {
                {
                {
                this.state = 509;
                this.match(HaloParser.T__33);
                this.state = 510;
                this.notExpr();
                }
                }
                this.state = 515;
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
        this.enterRule(localContext, 74, HaloParser.RULE_notExpr);
        try {
            this.state = 519;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__34:
                localContext = new NegationContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 516;
                this.match(HaloParser.T__34);
                this.state = 517;
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
                this.state = 518;
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
        this.enterRule(localContext, 76, HaloParser.RULE_comparison);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 521;
            this.operand();
            this.state = 525;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & 963) !== 0)) {
                {
                this.state = 522;
                this.compOp();
                this.state = 523;
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
        this.enterRule(localContext, 78, HaloParser.RULE_compOp);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 527;
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
        this.enterRule(localContext, 80, HaloParser.RULE_operand);
        try {
            this.state = 536;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__20:
                localContext = new ParenOperandContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 529;
                this.match(HaloParser.T__20);
                this.state = 530;
                this.orExpr();
                this.state = 531;
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
                this.state = 533;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                localContext = new ContextOperandContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 534;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                localContext = new RefOperandContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 535;
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
        4,1,57,539,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,
        7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,
        2,40,7,40,1,0,5,0,84,8,0,10,0,12,0,87,9,0,1,0,1,0,1,1,1,1,1,1,1,
        1,1,1,1,1,3,1,97,8,1,1,2,1,2,1,3,1,3,1,3,5,3,104,8,3,10,3,12,3,107,
        9,3,1,4,1,4,1,4,1,4,1,4,1,4,5,4,115,8,4,10,4,12,4,118,9,4,1,5,1,
        5,1,5,3,5,123,8,5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,3,6,133,8,6,1,
        6,1,6,1,7,1,7,1,7,1,7,1,7,1,7,3,7,143,8,7,1,7,1,7,1,8,1,8,1,8,1,
        8,1,8,3,8,152,8,8,5,8,154,8,8,10,8,12,8,157,9,8,1,8,1,8,1,9,1,9,
        1,9,1,9,1,10,5,10,166,8,10,10,10,12,10,169,9,10,1,10,1,10,1,10,1,
        10,1,10,1,10,5,10,177,8,10,10,10,12,10,180,9,10,1,10,3,10,183,8,
        10,1,10,1,10,5,10,187,8,10,10,10,12,10,190,9,10,1,11,1,11,1,11,3,
        11,195,8,11,1,12,1,12,1,12,1,12,1,13,1,13,1,13,1,13,5,13,205,8,13,
        10,13,12,13,208,9,13,1,13,1,13,1,13,1,13,5,13,214,8,13,10,13,12,
        13,217,9,13,1,13,1,13,3,13,221,8,13,1,14,1,14,1,14,1,14,1,14,1,14,
        5,14,229,8,14,10,14,12,14,232,9,14,3,14,234,8,14,1,14,3,14,237,8,
        14,1,15,1,15,1,15,3,15,242,8,15,1,16,5,16,245,8,16,10,16,12,16,248,
        9,16,1,16,1,16,1,16,1,16,3,16,254,8,16,1,16,1,16,1,16,3,16,259,8,
        16,1,16,1,16,1,16,1,17,1,17,1,17,5,17,267,8,17,10,17,12,17,270,9,
        17,1,17,3,17,273,8,17,1,18,1,18,1,18,1,18,1,19,1,19,1,19,1,19,1,
        19,5,19,284,8,19,10,19,12,19,287,9,19,1,19,1,19,3,19,291,8,19,1,
        20,1,20,5,20,295,8,20,10,20,12,20,298,9,20,1,20,4,20,301,8,20,11,
        20,12,20,302,3,20,305,8,20,1,21,1,21,1,21,3,21,310,8,21,1,21,1,21,
        1,21,1,21,1,21,3,21,317,8,21,1,21,1,21,1,21,1,21,1,21,5,21,324,8,
        21,10,21,12,21,327,9,21,1,21,3,21,330,8,21,1,21,1,21,3,21,334,8,
        21,1,21,1,21,1,21,1,21,3,21,340,8,21,1,21,1,21,3,21,344,8,21,1,21,
        1,21,1,21,1,21,1,21,5,21,351,8,21,10,21,12,21,354,9,21,1,21,3,21,
        357,8,21,1,21,1,21,3,21,361,8,21,1,21,1,21,1,21,1,21,1,21,1,21,1,
        21,1,21,3,21,371,8,21,1,21,1,21,1,21,1,21,3,21,377,8,21,1,21,1,21,
        1,21,1,21,1,21,1,21,3,21,385,8,21,1,21,1,21,1,21,1,21,1,21,1,21,
        1,21,1,21,3,21,395,8,21,1,21,1,21,3,21,399,8,21,3,21,401,8,21,1,
        22,1,22,1,22,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,3,23,415,
        8,23,1,24,1,24,3,24,419,8,24,1,24,1,24,3,24,423,8,24,3,24,425,8,
        24,1,25,1,25,1,25,3,25,430,8,25,1,25,1,25,3,25,434,8,25,1,25,1,25,
        1,26,1,26,1,26,5,26,441,8,26,10,26,12,26,444,9,26,1,26,3,26,447,
        8,26,1,27,1,27,1,27,1,27,1,27,3,27,454,8,27,1,28,1,28,1,28,1,28,
        1,28,3,28,461,8,28,1,29,1,29,1,29,1,29,5,29,467,8,29,10,29,12,29,
        470,9,29,1,29,3,29,473,8,29,3,29,475,8,29,1,29,1,29,1,30,1,30,1,
        30,3,30,482,8,30,1,31,1,31,1,32,1,32,1,32,3,32,489,8,32,1,33,1,33,
        1,33,5,33,494,8,33,10,33,12,33,497,9,33,1,34,1,34,1,35,1,35,1,35,
        5,35,504,8,35,10,35,12,35,507,9,35,1,36,1,36,1,36,5,36,512,8,36,
        10,36,12,36,515,9,36,1,37,1,37,1,37,3,37,520,8,37,1,38,1,38,1,38,
        1,38,3,38,526,8,38,1,39,1,39,1,40,1,40,1,40,1,40,1,40,1,40,1,40,
        3,40,537,8,40,1,40,0,0,41,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,
        30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,
        74,76,78,80,0,4,2,0,1,17,55,55,1,0,56,57,2,0,50,53,56,57,2,0,30,
        31,36,39,585,0,85,1,0,0,0,2,96,1,0,0,0,4,98,1,0,0,0,6,100,1,0,0,
        0,8,108,1,0,0,0,10,119,1,0,0,0,12,126,1,0,0,0,14,136,1,0,0,0,16,
        146,1,0,0,0,18,160,1,0,0,0,20,167,1,0,0,0,22,194,1,0,0,0,24,196,
        1,0,0,0,26,220,1,0,0,0,28,222,1,0,0,0,30,241,1,0,0,0,32,246,1,0,
        0,0,34,263,1,0,0,0,36,274,1,0,0,0,38,278,1,0,0,0,40,304,1,0,0,0,
        42,400,1,0,0,0,44,402,1,0,0,0,46,414,1,0,0,0,48,424,1,0,0,0,50,426,
        1,0,0,0,52,437,1,0,0,0,54,453,1,0,0,0,56,460,1,0,0,0,58,462,1,0,
        0,0,60,481,1,0,0,0,62,483,1,0,0,0,64,488,1,0,0,0,66,490,1,0,0,0,
        68,498,1,0,0,0,70,500,1,0,0,0,72,508,1,0,0,0,74,519,1,0,0,0,76,521,
        1,0,0,0,78,527,1,0,0,0,80,536,1,0,0,0,82,84,3,2,1,0,83,82,1,0,0,
        0,84,87,1,0,0,0,85,83,1,0,0,0,85,86,1,0,0,0,86,88,1,0,0,0,87,85,
        1,0,0,0,88,89,5,0,0,1,89,1,1,0,0,0,90,97,3,8,4,0,91,97,3,12,6,0,
        92,97,3,14,7,0,93,97,3,16,8,0,94,97,3,20,10,0,95,97,3,32,16,0,96,
        90,1,0,0,0,96,91,1,0,0,0,96,92,1,0,0,0,96,93,1,0,0,0,96,94,1,0,0,
        0,96,95,1,0,0,0,97,3,1,0,0,0,98,99,7,0,0,0,99,5,1,0,0,0,100,105,
        5,55,0,0,101,102,5,18,0,0,102,104,3,4,2,0,103,101,1,0,0,0,104,107,
        1,0,0,0,105,103,1,0,0,0,105,106,1,0,0,0,106,7,1,0,0,0,107,105,1,
        0,0,0,108,109,5,1,0,0,109,110,5,55,0,0,110,111,5,19,0,0,111,116,
        3,10,5,0,112,113,5,20,0,0,113,115,3,10,5,0,114,112,1,0,0,0,115,118,
        1,0,0,0,116,114,1,0,0,0,116,117,1,0,0,0,117,9,1,0,0,0,118,116,1,
        0,0,0,119,120,5,55,0,0,120,122,5,21,0,0,121,123,3,52,26,0,122,121,
        1,0,0,0,122,123,1,0,0,0,123,124,1,0,0,0,124,125,5,22,0,0,125,11,
        1,0,0,0,126,127,5,2,0,0,127,128,5,55,0,0,128,129,5,19,0,0,129,130,
        5,55,0,0,130,132,5,21,0,0,131,133,3,52,26,0,132,131,1,0,0,0,132,
        133,1,0,0,0,133,134,1,0,0,0,134,135,5,22,0,0,135,13,1,0,0,0,136,
        137,5,3,0,0,137,138,5,55,0,0,138,139,5,19,0,0,139,140,5,55,0,0,140,
        142,5,21,0,0,141,143,3,52,26,0,142,141,1,0,0,0,142,143,1,0,0,0,143,
        144,1,0,0,0,144,145,5,22,0,0,145,15,1,0,0,0,146,147,5,4,0,0,147,
        148,5,55,0,0,148,155,5,23,0,0,149,151,3,18,9,0,150,152,5,24,0,0,
        151,150,1,0,0,0,151,152,1,0,0,0,152,154,1,0,0,0,153,149,1,0,0,0,
        154,157,1,0,0,0,155,153,1,0,0,0,155,156,1,0,0,0,156,158,1,0,0,0,
        157,155,1,0,0,0,158,159,5,25,0,0,159,17,1,0,0,0,160,161,3,4,2,0,
        161,162,5,19,0,0,162,163,3,38,19,0,163,19,1,0,0,0,164,166,3,28,14,
        0,165,164,1,0,0,0,166,169,1,0,0,0,167,165,1,0,0,0,167,168,1,0,0,
        0,168,170,1,0,0,0,169,167,1,0,0,0,170,171,5,5,0,0,171,172,5,55,0,
        0,172,173,5,26,0,0,173,178,3,22,11,0,174,175,5,24,0,0,175,177,3,
        24,12,0,176,174,1,0,0,0,177,180,1,0,0,0,178,176,1,0,0,0,178,179,
        1,0,0,0,179,182,1,0,0,0,180,178,1,0,0,0,181,183,5,24,0,0,182,181,
        1,0,0,0,182,183,1,0,0,0,183,184,1,0,0,0,184,188,5,27,0,0,185,187,
        3,26,13,0,186,185,1,0,0,0,187,190,1,0,0,0,188,186,1,0,0,0,188,189,
        1,0,0,0,189,21,1,0,0,0,190,188,1,0,0,0,191,195,5,54,0,0,192,195,
        5,57,0,0,193,195,3,6,3,0,194,191,1,0,0,0,194,192,1,0,0,0,194,193,
        1,0,0,0,195,23,1,0,0,0,196,197,3,4,2,0,197,198,5,19,0,0,198,199,
        3,60,30,0,199,25,1,0,0,0,200,201,5,7,0,0,201,206,5,55,0,0,202,203,
        5,24,0,0,203,205,5,55,0,0,204,202,1,0,0,0,205,208,1,0,0,0,206,204,
        1,0,0,0,206,207,1,0,0,0,207,221,1,0,0,0,208,206,1,0,0,0,209,210,
        5,8,0,0,210,215,5,55,0,0,211,212,5,24,0,0,212,214,5,55,0,0,213,211,
        1,0,0,0,214,217,1,0,0,0,215,213,1,0,0,0,215,216,1,0,0,0,216,221,
        1,0,0,0,217,215,1,0,0,0,218,219,5,9,0,0,219,221,7,1,0,0,220,200,
        1,0,0,0,220,209,1,0,0,0,220,218,1,0,0,0,221,27,1,0,0,0,222,223,5,
        28,0,0,223,236,3,4,2,0,224,233,5,21,0,0,225,230,3,30,15,0,226,227,
        5,24,0,0,227,229,3,30,15,0,228,226,1,0,0,0,229,232,1,0,0,0,230,228,
        1,0,0,0,230,231,1,0,0,0,231,234,1,0,0,0,232,230,1,0,0,0,233,225,
        1,0,0,0,233,234,1,0,0,0,234,235,1,0,0,0,235,237,5,22,0,0,236,224,
        1,0,0,0,236,237,1,0,0,0,237,29,1,0,0,0,238,242,3,62,31,0,239,242,
        5,54,0,0,240,242,3,6,3,0,241,238,1,0,0,0,241,239,1,0,0,0,241,240,
        1,0,0,0,242,31,1,0,0,0,243,245,3,28,14,0,244,243,1,0,0,0,245,248,
        1,0,0,0,246,244,1,0,0,0,246,247,1,0,0,0,247,249,1,0,0,0,248,246,
        1,0,0,0,249,250,5,6,0,0,250,251,5,55,0,0,251,253,5,21,0,0,252,254,
        3,34,17,0,253,252,1,0,0,0,253,254,1,0,0,0,254,255,1,0,0,0,255,258,
        5,22,0,0,256,257,5,29,0,0,257,259,3,38,19,0,258,256,1,0,0,0,258,
        259,1,0,0,0,259,260,1,0,0,0,260,261,5,19,0,0,261,262,3,40,20,0,262,
        33,1,0,0,0,263,268,3,36,18,0,264,265,5,24,0,0,265,267,3,36,18,0,
        266,264,1,0,0,0,267,270,1,0,0,0,268,266,1,0,0,0,268,269,1,0,0,0,
        269,272,1,0,0,0,270,268,1,0,0,0,271,273,5,24,0,0,272,271,1,0,0,0,
        272,273,1,0,0,0,273,35,1,0,0,0,274,275,5,55,0,0,275,276,5,19,0,0,
        276,277,3,38,19,0,277,37,1,0,0,0,278,290,3,6,3,0,279,280,5,30,0,
        0,280,285,3,38,19,0,281,282,5,24,0,0,282,284,3,38,19,0,283,281,1,
        0,0,0,284,287,1,0,0,0,285,283,1,0,0,0,285,286,1,0,0,0,286,288,1,
        0,0,0,287,285,1,0,0,0,288,289,5,31,0,0,289,291,1,0,0,0,290,279,1,
        0,0,0,290,291,1,0,0,0,291,39,1,0,0,0,292,296,3,64,32,0,293,295,3,
        42,21,0,294,293,1,0,0,0,295,298,1,0,0,0,296,294,1,0,0,0,296,297,
        1,0,0,0,297,305,1,0,0,0,298,296,1,0,0,0,299,301,3,42,21,0,300,299,
        1,0,0,0,301,302,1,0,0,0,302,300,1,0,0,0,302,303,1,0,0,0,303,305,
        1,0,0,0,304,292,1,0,0,0,304,300,1,0,0,0,305,41,1,0,0,0,306,307,5,
        49,0,0,307,309,3,50,25,0,308,310,3,44,22,0,309,308,1,0,0,0,309,310,
        1,0,0,0,310,401,1,0,0,0,311,312,5,47,0,0,312,313,5,21,0,0,313,314,
        3,68,34,0,314,316,5,22,0,0,315,317,5,32,0,0,316,315,1,0,0,0,316,
        317,1,0,0,0,317,401,1,0,0,0,318,319,5,47,0,0,319,320,5,23,0,0,320,
        325,3,46,23,0,321,322,5,24,0,0,322,324,3,46,23,0,323,321,1,0,0,0,
        324,327,1,0,0,0,325,323,1,0,0,0,325,326,1,0,0,0,326,329,1,0,0,0,
        327,325,1,0,0,0,328,330,5,24,0,0,329,328,1,0,0,0,329,330,1,0,0,0,
        330,331,1,0,0,0,331,333,5,25,0,0,332,334,3,44,22,0,333,332,1,0,0,
        0,333,334,1,0,0,0,334,401,1,0,0,0,335,336,5,46,0,0,336,337,5,11,
        0,0,337,339,5,21,0,0,338,340,3,52,26,0,339,338,1,0,0,0,339,340,1,
        0,0,0,340,341,1,0,0,0,341,343,5,22,0,0,342,344,3,44,22,0,343,342,
        1,0,0,0,343,344,1,0,0,0,344,401,1,0,0,0,345,346,5,45,0,0,346,347,
        5,23,0,0,347,352,3,48,24,0,348,349,5,24,0,0,349,351,3,48,24,0,350,
        348,1,0,0,0,351,354,1,0,0,0,352,350,1,0,0,0,352,353,1,0,0,0,353,
        356,1,0,0,0,354,352,1,0,0,0,355,357,5,24,0,0,356,355,1,0,0,0,356,
        357,1,0,0,0,357,358,1,0,0,0,358,360,5,25,0,0,359,361,3,44,22,0,360,
        359,1,0,0,0,360,361,1,0,0,0,361,401,1,0,0,0,362,363,5,45,0,0,363,
        364,5,15,0,0,364,365,5,21,0,0,365,366,5,55,0,0,366,367,5,16,0,0,
        367,370,3,56,28,0,368,369,5,24,0,0,369,371,3,52,26,0,370,368,1,0,
        0,0,370,371,1,0,0,0,371,372,1,0,0,0,372,373,5,22,0,0,373,374,5,32,
        0,0,374,376,3,50,25,0,375,377,3,44,22,0,376,375,1,0,0,0,376,377,
        1,0,0,0,377,401,1,0,0,0,378,379,5,48,0,0,379,380,5,12,0,0,380,381,
        5,21,0,0,381,382,3,56,28,0,382,384,5,22,0,0,383,385,3,44,22,0,384,
        383,1,0,0,0,384,385,1,0,0,0,385,401,1,0,0,0,386,387,5,44,0,0,387,
        388,5,13,0,0,388,389,5,21,0,0,389,390,5,55,0,0,390,391,5,24,0,0,
        391,394,7,1,0,0,392,393,5,24,0,0,393,395,3,52,26,0,394,392,1,0,0,
        0,394,395,1,0,0,0,395,396,1,0,0,0,396,398,5,22,0,0,397,399,3,44,
        22,0,398,397,1,0,0,0,398,399,1,0,0,0,399,401,1,0,0,0,400,306,1,0,
        0,0,400,311,1,0,0,0,400,318,1,0,0,0,400,335,1,0,0,0,400,345,1,0,
        0,0,400,362,1,0,0,0,400,378,1,0,0,0,400,386,1,0,0,0,401,43,1,0,0,
        0,402,403,5,14,0,0,403,404,3,4,2,0,404,45,1,0,0,0,405,406,5,21,0,
        0,406,407,3,68,34,0,407,408,5,22,0,0,408,409,5,32,0,0,409,410,3,
        50,25,0,410,415,1,0,0,0,411,412,5,17,0,0,412,413,5,32,0,0,413,415,
        3,50,25,0,414,405,1,0,0,0,414,411,1,0,0,0,415,47,1,0,0,0,416,418,
        3,50,25,0,417,419,3,44,22,0,418,417,1,0,0,0,418,419,1,0,0,0,419,
        425,1,0,0,0,420,422,5,55,0,0,421,423,3,44,22,0,422,421,1,0,0,0,422,
        423,1,0,0,0,423,425,1,0,0,0,424,416,1,0,0,0,424,420,1,0,0,0,425,
        49,1,0,0,0,426,429,5,55,0,0,427,428,5,18,0,0,428,430,3,4,2,0,429,
        427,1,0,0,0,429,430,1,0,0,0,430,431,1,0,0,0,431,433,5,21,0,0,432,
        434,3,52,26,0,433,432,1,0,0,0,433,434,1,0,0,0,434,435,1,0,0,0,435,
        436,5,22,0,0,436,51,1,0,0,0,437,442,3,54,27,0,438,439,5,24,0,0,439,
        441,3,54,27,0,440,438,1,0,0,0,441,444,1,0,0,0,442,440,1,0,0,0,442,
        443,1,0,0,0,443,446,1,0,0,0,444,442,1,0,0,0,445,447,5,24,0,0,446,
        445,1,0,0,0,446,447,1,0,0,0,447,53,1,0,0,0,448,449,3,4,2,0,449,450,
        5,19,0,0,450,451,3,56,28,0,451,454,1,0,0,0,452,454,3,56,28,0,453,
        448,1,0,0,0,453,452,1,0,0,0,454,55,1,0,0,0,455,461,3,62,31,0,456,
        461,5,54,0,0,457,461,3,66,33,0,458,461,3,58,29,0,459,461,3,6,3,0,
        460,455,1,0,0,0,460,456,1,0,0,0,460,457,1,0,0,0,460,458,1,0,0,0,
        460,459,1,0,0,0,461,57,1,0,0,0,462,474,5,26,0,0,463,468,3,56,28,
        0,464,465,5,24,0,0,465,467,3,56,28,0,466,464,1,0,0,0,467,470,1,0,
        0,0,468,466,1,0,0,0,468,469,1,0,0,0,469,472,1,0,0,0,470,468,1,0,
        0,0,471,473,5,24,0,0,472,471,1,0,0,0,472,473,1,0,0,0,473,475,1,0,
        0,0,474,463,1,0,0,0,474,475,1,0,0,0,475,476,1,0,0,0,476,477,5,27,
        0,0,477,59,1,0,0,0,478,482,3,62,31,0,479,482,5,54,0,0,480,482,3,
        6,3,0,481,478,1,0,0,0,481,479,1,0,0,0,481,480,1,0,0,0,482,61,1,0,
        0,0,483,484,7,2,0,0,484,63,1,0,0,0,485,489,3,62,31,0,486,489,3,66,
        33,0,487,489,3,6,3,0,488,485,1,0,0,0,488,486,1,0,0,0,488,487,1,0,
        0,0,489,65,1,0,0,0,490,495,5,10,0,0,491,492,5,18,0,0,492,494,3,4,
        2,0,493,491,1,0,0,0,494,497,1,0,0,0,495,493,1,0,0,0,495,496,1,0,
        0,0,496,67,1,0,0,0,497,495,1,0,0,0,498,499,3,70,35,0,499,69,1,0,
        0,0,500,505,3,72,36,0,501,502,5,33,0,0,502,504,3,72,36,0,503,501,
        1,0,0,0,504,507,1,0,0,0,505,503,1,0,0,0,505,506,1,0,0,0,506,71,1,
        0,0,0,507,505,1,0,0,0,508,513,3,74,37,0,509,510,5,34,0,0,510,512,
        3,74,37,0,511,509,1,0,0,0,512,515,1,0,0,0,513,511,1,0,0,0,513,514,
        1,0,0,0,514,73,1,0,0,0,515,513,1,0,0,0,516,517,5,35,0,0,517,520,
        3,74,37,0,518,520,3,76,38,0,519,516,1,0,0,0,519,518,1,0,0,0,520,
        75,1,0,0,0,521,525,3,80,40,0,522,523,3,78,39,0,523,524,3,80,40,0,
        524,526,1,0,0,0,525,522,1,0,0,0,525,526,1,0,0,0,526,77,1,0,0,0,527,
        528,7,3,0,0,528,79,1,0,0,0,529,530,5,21,0,0,530,531,3,70,35,0,531,
        532,5,22,0,0,532,537,1,0,0,0,533,537,3,62,31,0,534,537,3,66,33,0,
        535,537,3,6,3,0,536,529,1,0,0,0,536,533,1,0,0,0,536,534,1,0,0,0,
        536,535,1,0,0,0,537,81,1,0,0,0,68,85,96,105,116,122,132,142,151,
        155,167,178,182,188,194,206,215,220,230,233,236,241,246,253,258,
        268,272,285,290,296,302,304,309,316,325,329,333,339,343,352,356,
        360,370,376,384,394,398,400,414,418,422,424,429,433,442,446,453,
        460,468,472,474,481,488,495,505,513,519,525,536
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
    public name(): NameContext[];
    public name(i: number): NameContext | null;
    public name(i?: number): NameContext[] | NameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(NameContext);
        }

        return this.getRuleContext(i, NameContext);
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
    public name(): NameContext[];
    public name(i: number): NameContext | null;
    public name(i?: number): NameContext[] | NameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(NameContext);
        }

        return this.getRuleContext(i, NameContext);
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
