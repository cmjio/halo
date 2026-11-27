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
    public static readonly T__39 = 40;
    public static readonly T__40 = 41;
    public static readonly WS = 42;
    public static readonly NL = 43;
    public static readonly LINE_COMMENT = 44;
    public static readonly BLOCK_COMMENT = 45;
    public static readonly LOOP = 46;
    public static readonly FANOUT = 47;
    public static readonly INTERRUPT = 48;
    public static readonly GATE = 49;
    public static readonly LISTEN = 50;
    public static readonly PIPE = 51;
    public static readonly BAD_OP = 52;
    public static readonly BOOL = 53;
    public static readonly NULL = 54;
    public static readonly DURATION = 55;
    public static readonly NUMBER = 56;
    public static readonly MODEL_REF = 57;
    public static readonly IDENTIFIER = 58;
    public static readonly TRIPLE_STRING = 59;
    public static readonly STRING = 60;
    public static readonly RULE_program = 0;
    public static readonly RULE_declaration = 1;
    public static readonly RULE_name = 2;
    public static readonly RULE_dottedId = 3;
    public static readonly RULE_pathPart = 4;
    public static readonly RULE_useDecl = 5;
    public static readonly RULE_useItem = 6;
    public static readonly RULE_modelBinding = 7;
    public static readonly RULE_policyDecl = 8;
    public static readonly RULE_policyRule = 9;
    public static readonly RULE_toolDecl = 10;
    public static readonly RULE_storeDecl = 11;
    public static readonly RULE_schemaDecl = 12;
    public static readonly RULE_schemaField = 13;
    public static readonly RULE_agentDecl = 14;
    public static readonly RULE_modelRef = 15;
    public static readonly RULE_modelParam = 16;
    public static readonly RULE_agentModifier = 17;
    public static readonly RULE_directive = 18;
    public static readonly RULE_directiveArg = 19;
    public static readonly RULE_pipelineDecl = 20;
    public static readonly RULE_paramList = 21;
    public static readonly RULE_param = 22;
    public static readonly RULE_typeRef = 23;
    public static readonly RULE_pipeline = 24;
    public static readonly RULE_pipelineOp = 25;
    public static readonly RULE_loopCondition = 26;
    public static readonly RULE_binding = 27;
    public static readonly RULE_branchArm = 28;
    public static readonly RULE_fanoutItem = 29;
    public static readonly RULE_callExpr = 30;
    public static readonly RULE_callArgs = 31;
    public static readonly RULE_callArg = 32;
    public static readonly RULE_callValue = 33;
    public static readonly RULE_listValue = 34;
    public static readonly RULE_value = 35;
    public static readonly RULE_literal = 36;
    public static readonly RULE_expression = 37;
    public static readonly RULE_contextRef = 38;
    public static readonly RULE_condExpr = 39;
    public static readonly RULE_orExpr = 40;
    public static readonly RULE_andExpr = 41;
    public static readonly RULE_notExpr = 42;
    public static readonly RULE_comparison = 43;
    public static readonly RULE_compOp = 44;
    public static readonly RULE_operand = 45;

    public static readonly literalNames = [
        null, "'policy'", "'tool'", "'store'", "'schema'", "'agent'", "'pipeline'", 
        "'equips'", "'requires'", "'system'", "'context'", "'yield'", "'listen'", 
        "'loop'", "'as'", "'each'", "'in'", "'else'", "'use'", "'with'", 
        "'.'", "'{'", "','", "'}'", "'('", "')'", "':'", "'&'", "'['", "']'", 
        "'@'", "'->'", "'<'", "'>'", "'=>'", "'||'", "'&&'", "'!'", "'=='", 
        "'!='", "'>='", "'<='", null, null, null, null, "'|<>'", "'|*'", 
        "'|!'", "'|?'", "'~>'", "'|>'", null, null, "'null'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, "WS", "NL", 
        "LINE_COMMENT", "BLOCK_COMMENT", "LOOP", "FANOUT", "INTERRUPT", 
        "GATE", "LISTEN", "PIPE", "BAD_OP", "BOOL", "NULL", "DURATION", 
        "NUMBER", "MODEL_REF", "IDENTIFIER", "TRIPLE_STRING", "STRING"
    ];
    public static readonly ruleNames = [
        "program", "declaration", "name", "dottedId", "pathPart", "useDecl", 
        "useItem", "modelBinding", "policyDecl", "policyRule", "toolDecl", 
        "storeDecl", "schemaDecl", "schemaField", "agentDecl", "modelRef", 
        "modelParam", "agentModifier", "directive", "directiveArg", "pipelineDecl", 
        "paramList", "param", "typeRef", "pipeline", "pipelineOp", "loopCondition", 
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
            this.state = 95;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1074004094) !== 0)) {
                {
                {
                this.state = 92;
                this.declaration();
                }
                }
                this.state = 97;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 98;
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
            this.state = 107;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 100;
                this.useDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 101;
                this.policyDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 102;
                this.toolDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 103;
                this.storeDecl();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 104;
                this.schemaDecl();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 105;
                this.agentDecl();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 106;
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
            this.state = 109;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 1048574) !== 0) || _la === 58)) {
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
            this.state = 111;
            this.match(HaloParser.IDENTIFIER);
            this.state = 116;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 20) {
                {
                {
                this.state = 112;
                this.match(HaloParser.T__19);
                this.state = 113;
                this.pathPart();
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
    public pathPart(): PathPartContext {
        let localContext = new PathPartContext(this.context, this.state);
        this.enterRule(localContext, 8, HaloParser.RULE_pathPart);
        try {
            this.state = 121;
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
            case HaloParser.T__17:
            case HaloParser.T__18:
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 119;
                this.name();
                }
                break;
            case HaloParser.NUMBER:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 120;
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
    public useDecl(): UseDeclContext {
        let localContext = new UseDeclContext(this.context, this.state);
        this.enterRule(localContext, 10, HaloParser.RULE_useDecl);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 123;
            this.match(HaloParser.T__17);
            this.state = 124;
            this.match(HaloParser.STRING);
            this.state = 140;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21) {
                {
                this.state = 125;
                this.match(HaloParser.T__20);
                this.state = 137;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 58) {
                    {
                    this.state = 126;
                    this.useItem();
                    this.state = 131;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 4, this.context);
                    while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                        if (alternative === 1) {
                            {
                            {
                            this.state = 127;
                            this.match(HaloParser.T__21);
                            this.state = 128;
                            this.useItem();
                            }
                            }
                        }
                        this.state = 133;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 4, this.context);
                    }
                    this.state = 135;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 22) {
                        {
                        this.state = 134;
                        this.match(HaloParser.T__21);
                        }
                    }

                    }
                }

                this.state = 139;
                this.match(HaloParser.T__22);
                }
            }

            this.state = 158;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 19) {
                {
                this.state = 142;
                this.match(HaloParser.T__18);
                this.state = 143;
                this.match(HaloParser.IDENTIFIER);
                this.state = 144;
                this.match(HaloParser.T__23);
                this.state = 145;
                this.modelBinding();
                this.state = 150;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 8, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 146;
                        this.match(HaloParser.T__21);
                        this.state = 147;
                        this.modelBinding();
                        }
                        }
                    }
                    this.state = 152;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 8, this.context);
                }
                this.state = 154;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 153;
                    this.match(HaloParser.T__21);
                    }
                }

                this.state = 156;
                this.match(HaloParser.T__24);
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
    public useItem(): UseItemContext {
        let localContext = new UseItemContext(this.context, this.state);
        this.enterRule(localContext, 12, HaloParser.RULE_useItem);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 160;
            this.match(HaloParser.IDENTIFIER);
            this.state = 163;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
                {
                this.state = 161;
                this.match(HaloParser.T__13);
                this.state = 162;
                this.match(HaloParser.IDENTIFIER);
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
    public modelBinding(): ModelBindingContext {
        let localContext = new ModelBindingContext(this.context, this.state);
        this.enterRule(localContext, 14, HaloParser.RULE_modelBinding);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 165;
            this.name();
            this.state = 166;
            this.match(HaloParser.T__25);
            this.state = 167;
            this.modelRef();
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
        this.enterRule(localContext, 16, HaloParser.RULE_policyDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 169;
            this.match(HaloParser.T__0);
            this.state = 170;
            this.match(HaloParser.IDENTIFIER);
            this.state = 171;
            this.match(HaloParser.T__25);
            this.state = 172;
            this.policyRule();
            this.state = 177;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 27) {
                {
                {
                this.state = 173;
                this.match(HaloParser.T__26);
                this.state = 174;
                this.policyRule();
                }
                }
                this.state = 179;
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
        this.enterRule(localContext, 18, HaloParser.RULE_policyRule);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 180;
            this.match(HaloParser.IDENTIFIER);
            this.state = 181;
            this.match(HaloParser.T__23);
            this.state = 183;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 255) !== 0)) {
                {
                this.state = 182;
                this.callArgs();
                }
            }

            this.state = 185;
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
    public toolDecl(): ToolDeclContext {
        let localContext = new ToolDeclContext(this.context, this.state);
        this.enterRule(localContext, 20, HaloParser.RULE_toolDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 187;
            this.match(HaloParser.T__1);
            this.state = 188;
            this.match(HaloParser.IDENTIFIER);
            this.state = 189;
            this.match(HaloParser.T__25);
            this.state = 190;
            this.match(HaloParser.IDENTIFIER);
            this.state = 191;
            this.match(HaloParser.T__23);
            this.state = 193;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 255) !== 0)) {
                {
                this.state = 192;
                this.callArgs();
                }
            }

            this.state = 195;
            this.match(HaloParser.T__24);
            this.state = 200;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 27) {
                {
                {
                this.state = 196;
                this.match(HaloParser.T__26);
                this.state = 197;
                this.policyRule();
                }
                }
                this.state = 202;
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
    public storeDecl(): StoreDeclContext {
        let localContext = new StoreDeclContext(this.context, this.state);
        this.enterRule(localContext, 22, HaloParser.RULE_storeDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 203;
            this.match(HaloParser.T__2);
            this.state = 204;
            this.match(HaloParser.IDENTIFIER);
            this.state = 205;
            this.match(HaloParser.T__25);
            this.state = 206;
            this.match(HaloParser.IDENTIFIER);
            this.state = 207;
            this.match(HaloParser.T__23);
            this.state = 209;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 255) !== 0)) {
                {
                this.state = 208;
                this.callArgs();
                }
            }

            this.state = 211;
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
    public schemaDecl(): SchemaDeclContext {
        let localContext = new SchemaDeclContext(this.context, this.state);
        this.enterRule(localContext, 24, HaloParser.RULE_schemaDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 213;
            this.match(HaloParser.T__3);
            this.state = 214;
            this.match(HaloParser.IDENTIFIER);
            this.state = 215;
            this.match(HaloParser.T__20);
            this.state = 222;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1048574) !== 0) || _la === 58) {
                {
                {
                this.state = 216;
                this.schemaField();
                this.state = 218;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 217;
                    this.match(HaloParser.T__21);
                    }
                }

                }
                }
                this.state = 224;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 225;
            this.match(HaloParser.T__22);
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
        this.enterRule(localContext, 26, HaloParser.RULE_schemaField);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 227;
            this.name();
            this.state = 228;
            this.match(HaloParser.T__25);
            this.state = 229;
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
        this.enterRule(localContext, 28, HaloParser.RULE_agentDecl);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 234;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 30) {
                {
                {
                this.state = 231;
                this.directive();
                }
                }
                this.state = 236;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 237;
            this.match(HaloParser.T__4);
            this.state = 238;
            this.match(HaloParser.IDENTIFIER);
            this.state = 239;
            this.match(HaloParser.T__27);
            this.state = 240;
            this.modelRef();
            this.state = 245;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 20, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 241;
                    this.match(HaloParser.T__21);
                    this.state = 242;
                    this.modelParam();
                    }
                    }
                }
                this.state = 247;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 20, this.context);
            }
            this.state = 249;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 22) {
                {
                this.state = 248;
                this.match(HaloParser.T__21);
                }
            }

            this.state = 251;
            this.match(HaloParser.T__28);
            this.state = 255;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 896) !== 0)) {
                {
                {
                this.state = 252;
                this.agentModifier();
                }
                }
                this.state = 257;
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
        this.enterRule(localContext, 30, HaloParser.RULE_modelRef);
        try {
            this.state = 261;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 258;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 259;
                this.match(HaloParser.STRING);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 260;
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
        this.enterRule(localContext, 32, HaloParser.RULE_modelParam);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 263;
            this.name();
            this.state = 264;
            this.match(HaloParser.T__25);
            this.state = 265;
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
        this.enterRule(localContext, 34, HaloParser.RULE_agentModifier);
        let _la: number;
        try {
            this.state = 287;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__6:
                localContext = new EquipsModifierContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 267;
                this.match(HaloParser.T__6);
                this.state = 268;
                this.match(HaloParser.IDENTIFIER);
                this.state = 273;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 22) {
                    {
                    {
                    this.state = 269;
                    this.match(HaloParser.T__21);
                    this.state = 270;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 275;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__7:
                localContext = new RequiresModifierContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 276;
                this.match(HaloParser.T__7);
                this.state = 277;
                this.match(HaloParser.IDENTIFIER);
                this.state = 282;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 22) {
                    {
                    {
                    this.state = 278;
                    this.match(HaloParser.T__21);
                    this.state = 279;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 284;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__8:
                localContext = new SystemModifierContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 285;
                this.match(HaloParser.T__8);
                this.state = 286;
                _la = this.tokenStream.LA(1);
                if(!(_la === 59 || _la === 60)) {
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
        this.enterRule(localContext, 36, HaloParser.RULE_directive);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 289;
            this.match(HaloParser.T__29);
            this.state = 290;
            this.name();
            this.state = 303;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 291;
                this.match(HaloParser.T__23);
                this.state = 300;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 255) !== 0)) {
                    {
                    this.state = 292;
                    this.directiveArg();
                    this.state = 297;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 22) {
                        {
                        {
                        this.state = 293;
                        this.match(HaloParser.T__21);
                        this.state = 294;
                        this.directiveArg();
                        }
                        }
                        this.state = 299;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                this.state = 302;
                this.match(HaloParser.T__24);
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
        this.enterRule(localContext, 38, HaloParser.RULE_directiveArg);
        try {
            this.state = 308;
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
                this.state = 305;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 306;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 307;
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
        this.enterRule(localContext, 40, HaloParser.RULE_pipelineDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 313;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 30) {
                {
                {
                this.state = 310;
                this.directive();
                }
                }
                this.state = 315;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 316;
            this.match(HaloParser.T__5);
            this.state = 317;
            this.match(HaloParser.IDENTIFIER);
            this.state = 318;
            this.match(HaloParser.T__23);
            this.state = 320;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 58) {
                {
                this.state = 319;
                this.paramList();
                }
            }

            this.state = 322;
            this.match(HaloParser.T__24);
            this.state = 325;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 31) {
                {
                this.state = 323;
                this.match(HaloParser.T__30);
                this.state = 324;
                this.typeRef();
                }
            }

            this.state = 327;
            this.match(HaloParser.T__25);
            this.state = 328;
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
        this.enterRule(localContext, 42, HaloParser.RULE_paramList);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 330;
            this.param();
            this.state = 335;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 34, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 331;
                    this.match(HaloParser.T__21);
                    this.state = 332;
                    this.param();
                    }
                    }
                }
                this.state = 337;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 34, this.context);
            }
            this.state = 339;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 22) {
                {
                this.state = 338;
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
    public param(): ParamContext {
        let localContext = new ParamContext(this.context, this.state);
        this.enterRule(localContext, 44, HaloParser.RULE_param);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 341;
            this.match(HaloParser.IDENTIFIER);
            this.state = 342;
            this.match(HaloParser.T__25);
            this.state = 343;
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
        this.enterRule(localContext, 46, HaloParser.RULE_typeRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 345;
            this.dottedId();
            this.state = 357;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 32) {
                {
                this.state = 346;
                this.match(HaloParser.T__31);
                this.state = 347;
                this.typeRef();
                this.state = 352;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 22) {
                    {
                    {
                    this.state = 348;
                    this.match(HaloParser.T__21);
                    this.state = 349;
                    this.typeRef();
                    }
                    }
                    this.state = 354;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 355;
                this.match(HaloParser.T__32);
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
        this.enterRule(localContext, 48, HaloParser.RULE_pipeline);
        let _la: number;
        try {
            this.state = 371;
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
                this.state = 359;
                this.expression();
                this.state = 363;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & 63) !== 0)) {
                    {
                    {
                    this.state = 360;
                    this.pipelineOp();
                    }
                    }
                    this.state = 365;
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
                this.state = 367;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 366;
                    this.pipelineOp();
                    }
                    }
                    this.state = 369;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & 63) !== 0));
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
        this.enterRule(localContext, 50, HaloParser.RULE_pipelineOp);
        let _la: number;
        try {
            let alternative: number;
            this.state = 467;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 56, this.context) ) {
            case 1:
                localContext = new PipeOpContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 373;
                this.match(HaloParser.PIPE);
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
            case 2:
                localContext = new GateOpContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 378;
                this.match(HaloParser.GATE);
                this.state = 379;
                this.match(HaloParser.T__23);
                this.state = 380;
                this.condExpr();
                this.state = 381;
                this.match(HaloParser.T__24);
                this.state = 383;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 34) {
                    {
                    this.state = 382;
                    this.match(HaloParser.T__33);
                    }
                }

                }
                break;
            case 3:
                localContext = new BranchOpContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 385;
                this.match(HaloParser.GATE);
                this.state = 386;
                this.match(HaloParser.T__20);
                this.state = 387;
                this.branchArm();
                this.state = 392;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 43, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 388;
                        this.match(HaloParser.T__21);
                        this.state = 389;
                        this.branchArm();
                        }
                        }
                    }
                    this.state = 394;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 43, this.context);
                }
                this.state = 396;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 395;
                    this.match(HaloParser.T__21);
                    }
                }

                this.state = 398;
                this.match(HaloParser.T__22);
                this.state = 400;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 399;
                    this.binding();
                    }
                }

                }
                break;
            case 4:
                localContext = new InterruptOpContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 402;
                this.match(HaloParser.INTERRUPT);
                this.state = 403;
                this.match(HaloParser.T__10);
                this.state = 404;
                this.match(HaloParser.T__23);
                this.state = 406;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 255) !== 0)) {
                    {
                    this.state = 405;
                    this.callArgs();
                    }
                }

                this.state = 408;
                this.match(HaloParser.T__24);
                this.state = 410;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 409;
                    this.binding();
                    }
                }

                }
                break;
            case 5:
                localContext = new FanoutOpContext(localContext);
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 412;
                this.match(HaloParser.FANOUT);
                this.state = 413;
                this.match(HaloParser.T__20);
                this.state = 414;
                this.fanoutItem();
                this.state = 419;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 48, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 415;
                        this.match(HaloParser.T__21);
                        this.state = 416;
                        this.fanoutItem();
                        }
                        }
                    }
                    this.state = 421;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 48, this.context);
                }
                this.state = 423;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 422;
                    this.match(HaloParser.T__21);
                    }
                }

                this.state = 425;
                this.match(HaloParser.T__22);
                this.state = 427;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 426;
                    this.binding();
                    }
                }

                }
                break;
            case 6:
                localContext = new EachOpContext(localContext);
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 429;
                this.match(HaloParser.FANOUT);
                this.state = 430;
                this.match(HaloParser.T__14);
                this.state = 431;
                this.match(HaloParser.T__23);
                this.state = 432;
                this.match(HaloParser.IDENTIFIER);
                this.state = 433;
                this.match(HaloParser.T__15);
                this.state = 434;
                this.callValue();
                this.state = 437;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 435;
                    this.match(HaloParser.T__21);
                    this.state = 436;
                    this.callArgs();
                    }
                }

                this.state = 439;
                this.match(HaloParser.T__24);
                this.state = 440;
                this.match(HaloParser.T__33);
                this.state = 441;
                this.callExpr();
                this.state = 443;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 442;
                    this.binding();
                    }
                }

                }
                break;
            case 7:
                localContext = new ListenOpContext(localContext);
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 445;
                this.match(HaloParser.LISTEN);
                this.state = 446;
                this.match(HaloParser.T__11);
                this.state = 447;
                this.match(HaloParser.T__23);
                this.state = 448;
                this.callValue();
                this.state = 449;
                this.match(HaloParser.T__24);
                this.state = 451;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 450;
                    this.binding();
                    }
                }

                }
                break;
            case 8:
                localContext = new LoopOpContext(localContext);
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 453;
                this.match(HaloParser.LOOP);
                this.state = 454;
                this.match(HaloParser.T__12);
                this.state = 455;
                this.match(HaloParser.T__23);
                this.state = 456;
                this.match(HaloParser.IDENTIFIER);
                this.state = 457;
                this.match(HaloParser.T__21);
                this.state = 458;
                this.loopCondition();
                this.state = 461;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 459;
                    this.match(HaloParser.T__21);
                    this.state = 460;
                    this.callArgs();
                    }
                }

                this.state = 463;
                this.match(HaloParser.T__24);
                this.state = 465;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 464;
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
    public loopCondition(): LoopConditionContext {
        let localContext = new LoopConditionContext(this.context, this.state);
        this.enterRule(localContext, 52, HaloParser.RULE_loopCondition);
        try {
            this.state = 475;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__23:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 469;
                this.match(HaloParser.T__23);
                this.state = 470;
                this.condExpr();
                this.state = 471;
                this.match(HaloParser.T__24);
                }
                break;
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 473;
                this.match(HaloParser.STRING);
                }
                break;
            case HaloParser.TRIPLE_STRING:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 474;
                this.match(HaloParser.TRIPLE_STRING);
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
    public binding(): BindingContext {
        let localContext = new BindingContext(this.context, this.state);
        this.enterRule(localContext, 54, HaloParser.RULE_binding);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 477;
            this.match(HaloParser.T__13);
            this.state = 478;
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
        this.enterRule(localContext, 56, HaloParser.RULE_branchArm);
        try {
            this.state = 489;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__23:
                localContext = new CondArmContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 480;
                this.match(HaloParser.T__23);
                this.state = 481;
                this.condExpr();
                this.state = 482;
                this.match(HaloParser.T__24);
                this.state = 483;
                this.match(HaloParser.T__33);
                this.state = 484;
                this.callExpr();
                }
                break;
            case HaloParser.T__16:
                localContext = new ElseArmContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 486;
                this.match(HaloParser.T__16);
                this.state = 487;
                this.match(HaloParser.T__33);
                this.state = 488;
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
        this.enterRule(localContext, 58, HaloParser.RULE_fanoutItem);
        let _la: number;
        try {
            this.state = 499;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 61, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 491;
                this.callExpr();
                this.state = 493;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 492;
                    this.binding();
                    }
                }

                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 495;
                this.match(HaloParser.IDENTIFIER);
                this.state = 497;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 496;
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
        this.enterRule(localContext, 60, HaloParser.RULE_callExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 501;
            this.match(HaloParser.IDENTIFIER);
            this.state = 504;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
                {
                this.state = 502;
                this.match(HaloParser.T__19);
                this.state = 503;
                this.name();
                }
            }

            this.state = 506;
            this.match(HaloParser.T__23);
            this.state = 508;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 255) !== 0)) {
                {
                this.state = 507;
                this.callArgs();
                }
            }

            this.state = 510;
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
    public callArgs(): CallArgsContext {
        let localContext = new CallArgsContext(this.context, this.state);
        this.enterRule(localContext, 62, HaloParser.RULE_callArgs);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 512;
            this.callArg();
            this.state = 517;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 64, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 513;
                    this.match(HaloParser.T__21);
                    this.state = 514;
                    this.callArg();
                    }
                    }
                }
                this.state = 519;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 64, this.context);
            }
            this.state = 521;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 22) {
                {
                this.state = 520;
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
    public callArg(): CallArgContext {
        let localContext = new CallArgContext(this.context, this.state);
        this.enterRule(localContext, 64, HaloParser.RULE_callArg);
        try {
            this.state = 528;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 66, this.context) ) {
            case 1:
                localContext = new NamedArgContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 523;
                this.name();
                this.state = 524;
                this.match(HaloParser.T__25);
                this.state = 525;
                this.callValue();
                }
                break;
            case 2:
                localContext = new PositionalArgContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 527;
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
        this.enterRule(localContext, 66, HaloParser.RULE_callValue);
        try {
            this.state = 535;
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
                this.state = 530;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 531;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 532;
                this.contextRef();
                }
                break;
            case HaloParser.T__27:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 533;
                this.listValue();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 534;
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
        this.enterRule(localContext, 68, HaloParser.RULE_listValue);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 537;
            this.match(HaloParser.T__27);
            this.state = 549;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 28 || ((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 255) !== 0)) {
                {
                this.state = 538;
                this.callValue();
                this.state = 543;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 68, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 539;
                        this.match(HaloParser.T__21);
                        this.state = 540;
                        this.callValue();
                        }
                        }
                    }
                    this.state = 545;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 68, this.context);
                }
                this.state = 547;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 546;
                    this.match(HaloParser.T__21);
                    }
                }

                }
            }

            this.state = 551;
            this.match(HaloParser.T__28);
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
        this.enterRule(localContext, 70, HaloParser.RULE_value);
        try {
            this.state = 556;
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
                this.state = 553;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 554;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 555;
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
        this.enterRule(localContext, 72, HaloParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 558;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 207) !== 0))) {
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
        this.enterRule(localContext, 74, HaloParser.RULE_expression);
        try {
            this.state = 563;
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
                this.state = 560;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 561;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 562;
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
        this.enterRule(localContext, 76, HaloParser.RULE_contextRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 565;
            this.match(HaloParser.T__9);
            this.state = 570;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 20) {
                {
                {
                this.state = 566;
                this.match(HaloParser.T__19);
                this.state = 567;
                this.pathPart();
                }
                }
                this.state = 572;
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
        this.enterRule(localContext, 78, HaloParser.RULE_condExpr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 573;
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
        this.enterRule(localContext, 80, HaloParser.RULE_orExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 575;
            this.andExpr();
            this.state = 580;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 35) {
                {
                {
                this.state = 576;
                this.match(HaloParser.T__34);
                this.state = 577;
                this.andExpr();
                }
                }
                this.state = 582;
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
        this.enterRule(localContext, 82, HaloParser.RULE_andExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 583;
            this.notExpr();
            this.state = 588;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 36) {
                {
                {
                this.state = 584;
                this.match(HaloParser.T__35);
                this.state = 585;
                this.notExpr();
                }
                }
                this.state = 590;
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
        this.enterRule(localContext, 84, HaloParser.RULE_notExpr);
        try {
            this.state = 594;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__36:
                localContext = new NegationContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 591;
                this.match(HaloParser.T__36);
                this.state = 592;
                this.notExpr();
                }
                break;
            case HaloParser.T__9:
            case HaloParser.T__23:
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
                this.state = 593;
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
        this.enterRule(localContext, 86, HaloParser.RULE_comparison);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 596;
            this.operand();
            this.state = 600;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 963) !== 0)) {
                {
                this.state = 597;
                this.compOp();
                this.state = 598;
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
        this.enterRule(localContext, 88, HaloParser.RULE_compOp);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 602;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 963) !== 0))) {
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
        this.enterRule(localContext, 90, HaloParser.RULE_operand);
        try {
            this.state = 611;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__23:
                localContext = new ParenOperandContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 604;
                this.match(HaloParser.T__23);
                this.state = 605;
                this.orExpr();
                this.state = 606;
                this.match(HaloParser.T__24);
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
                this.state = 608;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                localContext = new ContextOperandContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 609;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                localContext = new RefOperandContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 610;
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
        4,1,60,614,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,
        7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,
        2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,1,0,
        5,0,94,8,0,10,0,12,0,97,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        3,1,108,8,1,1,2,1,2,1,3,1,3,1,3,5,3,115,8,3,10,3,12,3,118,9,3,1,
        4,1,4,3,4,122,8,4,1,5,1,5,1,5,1,5,1,5,1,5,5,5,130,8,5,10,5,12,5,
        133,9,5,1,5,3,5,136,8,5,3,5,138,8,5,1,5,3,5,141,8,5,1,5,1,5,1,5,
        1,5,1,5,1,5,5,5,149,8,5,10,5,12,5,152,9,5,1,5,3,5,155,8,5,1,5,1,
        5,3,5,159,8,5,1,6,1,6,1,6,3,6,164,8,6,1,7,1,7,1,7,1,7,1,8,1,8,1,
        8,1,8,1,8,1,8,5,8,176,8,8,10,8,12,8,179,9,8,1,9,1,9,1,9,3,9,184,
        8,9,1,9,1,9,1,10,1,10,1,10,1,10,1,10,1,10,3,10,194,8,10,1,10,1,10,
        1,10,5,10,199,8,10,10,10,12,10,202,9,10,1,11,1,11,1,11,1,11,1,11,
        1,11,3,11,210,8,11,1,11,1,11,1,12,1,12,1,12,1,12,1,12,3,12,219,8,
        12,5,12,221,8,12,10,12,12,12,224,9,12,1,12,1,12,1,13,1,13,1,13,1,
        13,1,14,5,14,233,8,14,10,14,12,14,236,9,14,1,14,1,14,1,14,1,14,1,
        14,1,14,5,14,244,8,14,10,14,12,14,247,9,14,1,14,3,14,250,8,14,1,
        14,1,14,5,14,254,8,14,10,14,12,14,257,9,14,1,15,1,15,1,15,3,15,262,
        8,15,1,16,1,16,1,16,1,16,1,17,1,17,1,17,1,17,5,17,272,8,17,10,17,
        12,17,275,9,17,1,17,1,17,1,17,1,17,5,17,281,8,17,10,17,12,17,284,
        9,17,1,17,1,17,3,17,288,8,17,1,18,1,18,1,18,1,18,1,18,1,18,5,18,
        296,8,18,10,18,12,18,299,9,18,3,18,301,8,18,1,18,3,18,304,8,18,1,
        19,1,19,1,19,3,19,309,8,19,1,20,5,20,312,8,20,10,20,12,20,315,9,
        20,1,20,1,20,1,20,1,20,3,20,321,8,20,1,20,1,20,1,20,3,20,326,8,20,
        1,20,1,20,1,20,1,21,1,21,1,21,5,21,334,8,21,10,21,12,21,337,9,21,
        1,21,3,21,340,8,21,1,22,1,22,1,22,1,22,1,23,1,23,1,23,1,23,1,23,
        5,23,351,8,23,10,23,12,23,354,9,23,1,23,1,23,3,23,358,8,23,1,24,
        1,24,5,24,362,8,24,10,24,12,24,365,9,24,1,24,4,24,368,8,24,11,24,
        12,24,369,3,24,372,8,24,1,25,1,25,1,25,3,25,377,8,25,1,25,1,25,1,
        25,1,25,1,25,3,25,384,8,25,1,25,1,25,1,25,1,25,1,25,5,25,391,8,25,
        10,25,12,25,394,9,25,1,25,3,25,397,8,25,1,25,1,25,3,25,401,8,25,
        1,25,1,25,1,25,1,25,3,25,407,8,25,1,25,1,25,3,25,411,8,25,1,25,1,
        25,1,25,1,25,1,25,5,25,418,8,25,10,25,12,25,421,9,25,1,25,3,25,424,
        8,25,1,25,1,25,3,25,428,8,25,1,25,1,25,1,25,1,25,1,25,1,25,1,25,
        1,25,3,25,438,8,25,1,25,1,25,1,25,1,25,3,25,444,8,25,1,25,1,25,1,
        25,1,25,1,25,1,25,3,25,452,8,25,1,25,1,25,1,25,1,25,1,25,1,25,1,
        25,1,25,3,25,462,8,25,1,25,1,25,3,25,466,8,25,3,25,468,8,25,1,26,
        1,26,1,26,1,26,1,26,1,26,3,26,476,8,26,1,27,1,27,1,27,1,28,1,28,
        1,28,1,28,1,28,1,28,1,28,1,28,1,28,3,28,490,8,28,1,29,1,29,3,29,
        494,8,29,1,29,1,29,3,29,498,8,29,3,29,500,8,29,1,30,1,30,1,30,3,
        30,505,8,30,1,30,1,30,3,30,509,8,30,1,30,1,30,1,31,1,31,1,31,5,31,
        516,8,31,10,31,12,31,519,9,31,1,31,3,31,522,8,31,1,32,1,32,1,32,
        1,32,1,32,3,32,529,8,32,1,33,1,33,1,33,1,33,1,33,3,33,536,8,33,1,
        34,1,34,1,34,1,34,5,34,542,8,34,10,34,12,34,545,9,34,1,34,3,34,548,
        8,34,3,34,550,8,34,1,34,1,34,1,35,1,35,1,35,3,35,557,8,35,1,36,1,
        36,1,37,1,37,1,37,3,37,564,8,37,1,38,1,38,1,38,5,38,569,8,38,10,
        38,12,38,572,9,38,1,39,1,39,1,40,1,40,1,40,5,40,579,8,40,10,40,12,
        40,582,9,40,1,41,1,41,1,41,5,41,587,8,41,10,41,12,41,590,9,41,1,
        42,1,42,1,42,3,42,595,8,42,1,43,1,43,1,43,1,43,3,43,601,8,43,1,44,
        1,44,1,45,1,45,1,45,1,45,1,45,1,45,1,45,3,45,612,8,45,1,45,0,0,46,
        0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,
        46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,
        90,0,4,2,0,1,19,58,58,1,0,59,60,2,0,53,56,59,60,2,0,32,33,38,41,
        668,0,95,1,0,0,0,2,107,1,0,0,0,4,109,1,0,0,0,6,111,1,0,0,0,8,121,
        1,0,0,0,10,123,1,0,0,0,12,160,1,0,0,0,14,165,1,0,0,0,16,169,1,0,
        0,0,18,180,1,0,0,0,20,187,1,0,0,0,22,203,1,0,0,0,24,213,1,0,0,0,
        26,227,1,0,0,0,28,234,1,0,0,0,30,261,1,0,0,0,32,263,1,0,0,0,34,287,
        1,0,0,0,36,289,1,0,0,0,38,308,1,0,0,0,40,313,1,0,0,0,42,330,1,0,
        0,0,44,341,1,0,0,0,46,345,1,0,0,0,48,371,1,0,0,0,50,467,1,0,0,0,
        52,475,1,0,0,0,54,477,1,0,0,0,56,489,1,0,0,0,58,499,1,0,0,0,60,501,
        1,0,0,0,62,512,1,0,0,0,64,528,1,0,0,0,66,535,1,0,0,0,68,537,1,0,
        0,0,70,556,1,0,0,0,72,558,1,0,0,0,74,563,1,0,0,0,76,565,1,0,0,0,
        78,573,1,0,0,0,80,575,1,0,0,0,82,583,1,0,0,0,84,594,1,0,0,0,86,596,
        1,0,0,0,88,602,1,0,0,0,90,611,1,0,0,0,92,94,3,2,1,0,93,92,1,0,0,
        0,94,97,1,0,0,0,95,93,1,0,0,0,95,96,1,0,0,0,96,98,1,0,0,0,97,95,
        1,0,0,0,98,99,5,0,0,1,99,1,1,0,0,0,100,108,3,10,5,0,101,108,3,16,
        8,0,102,108,3,20,10,0,103,108,3,22,11,0,104,108,3,24,12,0,105,108,
        3,28,14,0,106,108,3,40,20,0,107,100,1,0,0,0,107,101,1,0,0,0,107,
        102,1,0,0,0,107,103,1,0,0,0,107,104,1,0,0,0,107,105,1,0,0,0,107,
        106,1,0,0,0,108,3,1,0,0,0,109,110,7,0,0,0,110,5,1,0,0,0,111,116,
        5,58,0,0,112,113,5,20,0,0,113,115,3,8,4,0,114,112,1,0,0,0,115,118,
        1,0,0,0,116,114,1,0,0,0,116,117,1,0,0,0,117,7,1,0,0,0,118,116,1,
        0,0,0,119,122,3,4,2,0,120,122,5,56,0,0,121,119,1,0,0,0,121,120,1,
        0,0,0,122,9,1,0,0,0,123,124,5,18,0,0,124,140,5,60,0,0,125,137,5,
        21,0,0,126,131,3,12,6,0,127,128,5,22,0,0,128,130,3,12,6,0,129,127,
        1,0,0,0,130,133,1,0,0,0,131,129,1,0,0,0,131,132,1,0,0,0,132,135,
        1,0,0,0,133,131,1,0,0,0,134,136,5,22,0,0,135,134,1,0,0,0,135,136,
        1,0,0,0,136,138,1,0,0,0,137,126,1,0,0,0,137,138,1,0,0,0,138,139,
        1,0,0,0,139,141,5,23,0,0,140,125,1,0,0,0,140,141,1,0,0,0,141,158,
        1,0,0,0,142,143,5,19,0,0,143,144,5,58,0,0,144,145,5,24,0,0,145,150,
        3,14,7,0,146,147,5,22,0,0,147,149,3,14,7,0,148,146,1,0,0,0,149,152,
        1,0,0,0,150,148,1,0,0,0,150,151,1,0,0,0,151,154,1,0,0,0,152,150,
        1,0,0,0,153,155,5,22,0,0,154,153,1,0,0,0,154,155,1,0,0,0,155,156,
        1,0,0,0,156,157,5,25,0,0,157,159,1,0,0,0,158,142,1,0,0,0,158,159,
        1,0,0,0,159,11,1,0,0,0,160,163,5,58,0,0,161,162,5,14,0,0,162,164,
        5,58,0,0,163,161,1,0,0,0,163,164,1,0,0,0,164,13,1,0,0,0,165,166,
        3,4,2,0,166,167,5,26,0,0,167,168,3,30,15,0,168,15,1,0,0,0,169,170,
        5,1,0,0,170,171,5,58,0,0,171,172,5,26,0,0,172,177,3,18,9,0,173,174,
        5,27,0,0,174,176,3,18,9,0,175,173,1,0,0,0,176,179,1,0,0,0,177,175,
        1,0,0,0,177,178,1,0,0,0,178,17,1,0,0,0,179,177,1,0,0,0,180,181,5,
        58,0,0,181,183,5,24,0,0,182,184,3,62,31,0,183,182,1,0,0,0,183,184,
        1,0,0,0,184,185,1,0,0,0,185,186,5,25,0,0,186,19,1,0,0,0,187,188,
        5,2,0,0,188,189,5,58,0,0,189,190,5,26,0,0,190,191,5,58,0,0,191,193,
        5,24,0,0,192,194,3,62,31,0,193,192,1,0,0,0,193,194,1,0,0,0,194,195,
        1,0,0,0,195,200,5,25,0,0,196,197,5,27,0,0,197,199,3,18,9,0,198,196,
        1,0,0,0,199,202,1,0,0,0,200,198,1,0,0,0,200,201,1,0,0,0,201,21,1,
        0,0,0,202,200,1,0,0,0,203,204,5,3,0,0,204,205,5,58,0,0,205,206,5,
        26,0,0,206,207,5,58,0,0,207,209,5,24,0,0,208,210,3,62,31,0,209,208,
        1,0,0,0,209,210,1,0,0,0,210,211,1,0,0,0,211,212,5,25,0,0,212,23,
        1,0,0,0,213,214,5,4,0,0,214,215,5,58,0,0,215,222,5,21,0,0,216,218,
        3,26,13,0,217,219,5,22,0,0,218,217,1,0,0,0,218,219,1,0,0,0,219,221,
        1,0,0,0,220,216,1,0,0,0,221,224,1,0,0,0,222,220,1,0,0,0,222,223,
        1,0,0,0,223,225,1,0,0,0,224,222,1,0,0,0,225,226,5,23,0,0,226,25,
        1,0,0,0,227,228,3,4,2,0,228,229,5,26,0,0,229,230,3,46,23,0,230,27,
        1,0,0,0,231,233,3,36,18,0,232,231,1,0,0,0,233,236,1,0,0,0,234,232,
        1,0,0,0,234,235,1,0,0,0,235,237,1,0,0,0,236,234,1,0,0,0,237,238,
        5,5,0,0,238,239,5,58,0,0,239,240,5,28,0,0,240,245,3,30,15,0,241,
        242,5,22,0,0,242,244,3,32,16,0,243,241,1,0,0,0,244,247,1,0,0,0,245,
        243,1,0,0,0,245,246,1,0,0,0,246,249,1,0,0,0,247,245,1,0,0,0,248,
        250,5,22,0,0,249,248,1,0,0,0,249,250,1,0,0,0,250,251,1,0,0,0,251,
        255,5,29,0,0,252,254,3,34,17,0,253,252,1,0,0,0,254,257,1,0,0,0,255,
        253,1,0,0,0,255,256,1,0,0,0,256,29,1,0,0,0,257,255,1,0,0,0,258,262,
        5,57,0,0,259,262,5,60,0,0,260,262,3,6,3,0,261,258,1,0,0,0,261,259,
        1,0,0,0,261,260,1,0,0,0,262,31,1,0,0,0,263,264,3,4,2,0,264,265,5,
        26,0,0,265,266,3,70,35,0,266,33,1,0,0,0,267,268,5,7,0,0,268,273,
        5,58,0,0,269,270,5,22,0,0,270,272,5,58,0,0,271,269,1,0,0,0,272,275,
        1,0,0,0,273,271,1,0,0,0,273,274,1,0,0,0,274,288,1,0,0,0,275,273,
        1,0,0,0,276,277,5,8,0,0,277,282,5,58,0,0,278,279,5,22,0,0,279,281,
        5,58,0,0,280,278,1,0,0,0,281,284,1,0,0,0,282,280,1,0,0,0,282,283,
        1,0,0,0,283,288,1,0,0,0,284,282,1,0,0,0,285,286,5,9,0,0,286,288,
        7,1,0,0,287,267,1,0,0,0,287,276,1,0,0,0,287,285,1,0,0,0,288,35,1,
        0,0,0,289,290,5,30,0,0,290,303,3,4,2,0,291,300,5,24,0,0,292,297,
        3,38,19,0,293,294,5,22,0,0,294,296,3,38,19,0,295,293,1,0,0,0,296,
        299,1,0,0,0,297,295,1,0,0,0,297,298,1,0,0,0,298,301,1,0,0,0,299,
        297,1,0,0,0,300,292,1,0,0,0,300,301,1,0,0,0,301,302,1,0,0,0,302,
        304,5,25,0,0,303,291,1,0,0,0,303,304,1,0,0,0,304,37,1,0,0,0,305,
        309,3,72,36,0,306,309,5,57,0,0,307,309,3,6,3,0,308,305,1,0,0,0,308,
        306,1,0,0,0,308,307,1,0,0,0,309,39,1,0,0,0,310,312,3,36,18,0,311,
        310,1,0,0,0,312,315,1,0,0,0,313,311,1,0,0,0,313,314,1,0,0,0,314,
        316,1,0,0,0,315,313,1,0,0,0,316,317,5,6,0,0,317,318,5,58,0,0,318,
        320,5,24,0,0,319,321,3,42,21,0,320,319,1,0,0,0,320,321,1,0,0,0,321,
        322,1,0,0,0,322,325,5,25,0,0,323,324,5,31,0,0,324,326,3,46,23,0,
        325,323,1,0,0,0,325,326,1,0,0,0,326,327,1,0,0,0,327,328,5,26,0,0,
        328,329,3,48,24,0,329,41,1,0,0,0,330,335,3,44,22,0,331,332,5,22,
        0,0,332,334,3,44,22,0,333,331,1,0,0,0,334,337,1,0,0,0,335,333,1,
        0,0,0,335,336,1,0,0,0,336,339,1,0,0,0,337,335,1,0,0,0,338,340,5,
        22,0,0,339,338,1,0,0,0,339,340,1,0,0,0,340,43,1,0,0,0,341,342,5,
        58,0,0,342,343,5,26,0,0,343,344,3,46,23,0,344,45,1,0,0,0,345,357,
        3,6,3,0,346,347,5,32,0,0,347,352,3,46,23,0,348,349,5,22,0,0,349,
        351,3,46,23,0,350,348,1,0,0,0,351,354,1,0,0,0,352,350,1,0,0,0,352,
        353,1,0,0,0,353,355,1,0,0,0,354,352,1,0,0,0,355,356,5,33,0,0,356,
        358,1,0,0,0,357,346,1,0,0,0,357,358,1,0,0,0,358,47,1,0,0,0,359,363,
        3,74,37,0,360,362,3,50,25,0,361,360,1,0,0,0,362,365,1,0,0,0,363,
        361,1,0,0,0,363,364,1,0,0,0,364,372,1,0,0,0,365,363,1,0,0,0,366,
        368,3,50,25,0,367,366,1,0,0,0,368,369,1,0,0,0,369,367,1,0,0,0,369,
        370,1,0,0,0,370,372,1,0,0,0,371,359,1,0,0,0,371,367,1,0,0,0,372,
        49,1,0,0,0,373,374,5,51,0,0,374,376,3,60,30,0,375,377,3,54,27,0,
        376,375,1,0,0,0,376,377,1,0,0,0,377,468,1,0,0,0,378,379,5,49,0,0,
        379,380,5,24,0,0,380,381,3,78,39,0,381,383,5,25,0,0,382,384,5,34,
        0,0,383,382,1,0,0,0,383,384,1,0,0,0,384,468,1,0,0,0,385,386,5,49,
        0,0,386,387,5,21,0,0,387,392,3,56,28,0,388,389,5,22,0,0,389,391,
        3,56,28,0,390,388,1,0,0,0,391,394,1,0,0,0,392,390,1,0,0,0,392,393,
        1,0,0,0,393,396,1,0,0,0,394,392,1,0,0,0,395,397,5,22,0,0,396,395,
        1,0,0,0,396,397,1,0,0,0,397,398,1,0,0,0,398,400,5,23,0,0,399,401,
        3,54,27,0,400,399,1,0,0,0,400,401,1,0,0,0,401,468,1,0,0,0,402,403,
        5,48,0,0,403,404,5,11,0,0,404,406,5,24,0,0,405,407,3,62,31,0,406,
        405,1,0,0,0,406,407,1,0,0,0,407,408,1,0,0,0,408,410,5,25,0,0,409,
        411,3,54,27,0,410,409,1,0,0,0,410,411,1,0,0,0,411,468,1,0,0,0,412,
        413,5,47,0,0,413,414,5,21,0,0,414,419,3,58,29,0,415,416,5,22,0,0,
        416,418,3,58,29,0,417,415,1,0,0,0,418,421,1,0,0,0,419,417,1,0,0,
        0,419,420,1,0,0,0,420,423,1,0,0,0,421,419,1,0,0,0,422,424,5,22,0,
        0,423,422,1,0,0,0,423,424,1,0,0,0,424,425,1,0,0,0,425,427,5,23,0,
        0,426,428,3,54,27,0,427,426,1,0,0,0,427,428,1,0,0,0,428,468,1,0,
        0,0,429,430,5,47,0,0,430,431,5,15,0,0,431,432,5,24,0,0,432,433,5,
        58,0,0,433,434,5,16,0,0,434,437,3,66,33,0,435,436,5,22,0,0,436,438,
        3,62,31,0,437,435,1,0,0,0,437,438,1,0,0,0,438,439,1,0,0,0,439,440,
        5,25,0,0,440,441,5,34,0,0,441,443,3,60,30,0,442,444,3,54,27,0,443,
        442,1,0,0,0,443,444,1,0,0,0,444,468,1,0,0,0,445,446,5,50,0,0,446,
        447,5,12,0,0,447,448,5,24,0,0,448,449,3,66,33,0,449,451,5,25,0,0,
        450,452,3,54,27,0,451,450,1,0,0,0,451,452,1,0,0,0,452,468,1,0,0,
        0,453,454,5,46,0,0,454,455,5,13,0,0,455,456,5,24,0,0,456,457,5,58,
        0,0,457,458,5,22,0,0,458,461,3,52,26,0,459,460,5,22,0,0,460,462,
        3,62,31,0,461,459,1,0,0,0,461,462,1,0,0,0,462,463,1,0,0,0,463,465,
        5,25,0,0,464,466,3,54,27,0,465,464,1,0,0,0,465,466,1,0,0,0,466,468,
        1,0,0,0,467,373,1,0,0,0,467,378,1,0,0,0,467,385,1,0,0,0,467,402,
        1,0,0,0,467,412,1,0,0,0,467,429,1,0,0,0,467,445,1,0,0,0,467,453,
        1,0,0,0,468,51,1,0,0,0,469,470,5,24,0,0,470,471,3,78,39,0,471,472,
        5,25,0,0,472,476,1,0,0,0,473,476,5,60,0,0,474,476,5,59,0,0,475,469,
        1,0,0,0,475,473,1,0,0,0,475,474,1,0,0,0,476,53,1,0,0,0,477,478,5,
        14,0,0,478,479,3,4,2,0,479,55,1,0,0,0,480,481,5,24,0,0,481,482,3,
        78,39,0,482,483,5,25,0,0,483,484,5,34,0,0,484,485,3,60,30,0,485,
        490,1,0,0,0,486,487,5,17,0,0,487,488,5,34,0,0,488,490,3,60,30,0,
        489,480,1,0,0,0,489,486,1,0,0,0,490,57,1,0,0,0,491,493,3,60,30,0,
        492,494,3,54,27,0,493,492,1,0,0,0,493,494,1,0,0,0,494,500,1,0,0,
        0,495,497,5,58,0,0,496,498,3,54,27,0,497,496,1,0,0,0,497,498,1,0,
        0,0,498,500,1,0,0,0,499,491,1,0,0,0,499,495,1,0,0,0,500,59,1,0,0,
        0,501,504,5,58,0,0,502,503,5,20,0,0,503,505,3,4,2,0,504,502,1,0,
        0,0,504,505,1,0,0,0,505,506,1,0,0,0,506,508,5,24,0,0,507,509,3,62,
        31,0,508,507,1,0,0,0,508,509,1,0,0,0,509,510,1,0,0,0,510,511,5,25,
        0,0,511,61,1,0,0,0,512,517,3,64,32,0,513,514,5,22,0,0,514,516,3,
        64,32,0,515,513,1,0,0,0,516,519,1,0,0,0,517,515,1,0,0,0,517,518,
        1,0,0,0,518,521,1,0,0,0,519,517,1,0,0,0,520,522,5,22,0,0,521,520,
        1,0,0,0,521,522,1,0,0,0,522,63,1,0,0,0,523,524,3,4,2,0,524,525,5,
        26,0,0,525,526,3,66,33,0,526,529,1,0,0,0,527,529,3,66,33,0,528,523,
        1,0,0,0,528,527,1,0,0,0,529,65,1,0,0,0,530,536,3,72,36,0,531,536,
        5,57,0,0,532,536,3,76,38,0,533,536,3,68,34,0,534,536,3,6,3,0,535,
        530,1,0,0,0,535,531,1,0,0,0,535,532,1,0,0,0,535,533,1,0,0,0,535,
        534,1,0,0,0,536,67,1,0,0,0,537,549,5,28,0,0,538,543,3,66,33,0,539,
        540,5,22,0,0,540,542,3,66,33,0,541,539,1,0,0,0,542,545,1,0,0,0,543,
        541,1,0,0,0,543,544,1,0,0,0,544,547,1,0,0,0,545,543,1,0,0,0,546,
        548,5,22,0,0,547,546,1,0,0,0,547,548,1,0,0,0,548,550,1,0,0,0,549,
        538,1,0,0,0,549,550,1,0,0,0,550,551,1,0,0,0,551,552,5,29,0,0,552,
        69,1,0,0,0,553,557,3,72,36,0,554,557,5,57,0,0,555,557,3,6,3,0,556,
        553,1,0,0,0,556,554,1,0,0,0,556,555,1,0,0,0,557,71,1,0,0,0,558,559,
        7,2,0,0,559,73,1,0,0,0,560,564,3,72,36,0,561,564,3,76,38,0,562,564,
        3,6,3,0,563,560,1,0,0,0,563,561,1,0,0,0,563,562,1,0,0,0,564,75,1,
        0,0,0,565,570,5,10,0,0,566,567,5,20,0,0,567,569,3,8,4,0,568,566,
        1,0,0,0,569,572,1,0,0,0,570,568,1,0,0,0,570,571,1,0,0,0,571,77,1,
        0,0,0,572,570,1,0,0,0,573,574,3,80,40,0,574,79,1,0,0,0,575,580,3,
        82,41,0,576,577,5,35,0,0,577,579,3,82,41,0,578,576,1,0,0,0,579,582,
        1,0,0,0,580,578,1,0,0,0,580,581,1,0,0,0,581,81,1,0,0,0,582,580,1,
        0,0,0,583,588,3,84,42,0,584,585,5,36,0,0,585,587,3,84,42,0,586,584,
        1,0,0,0,587,590,1,0,0,0,588,586,1,0,0,0,588,589,1,0,0,0,589,83,1,
        0,0,0,590,588,1,0,0,0,591,592,5,37,0,0,592,595,3,84,42,0,593,595,
        3,86,43,0,594,591,1,0,0,0,594,593,1,0,0,0,595,85,1,0,0,0,596,600,
        3,90,45,0,597,598,3,88,44,0,598,599,3,90,45,0,599,601,1,0,0,0,600,
        597,1,0,0,0,600,601,1,0,0,0,601,87,1,0,0,0,602,603,7,3,0,0,603,89,
        1,0,0,0,604,605,5,24,0,0,605,606,3,80,40,0,606,607,5,25,0,0,607,
        612,1,0,0,0,608,612,3,72,36,0,609,612,3,76,38,0,610,612,3,6,3,0,
        611,604,1,0,0,0,611,608,1,0,0,0,611,609,1,0,0,0,611,610,1,0,0,0,
        612,91,1,0,0,0,79,95,107,116,121,131,135,137,140,150,154,158,163,
        177,183,193,200,209,218,222,234,245,249,255,261,273,282,287,297,
        300,303,308,313,320,325,335,339,352,357,363,369,371,376,383,392,
        396,400,406,410,419,423,427,437,443,451,461,465,467,475,489,493,
        497,499,504,508,517,521,528,535,543,547,549,556,563,570,580,588,
        594,600,611
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
    public useDecl(): UseDeclContext | null {
        return this.getRuleContext(0, UseDeclContext);
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


export class UseDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode {
        return this.getToken(HaloParser.STRING, 0)!;
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.IDENTIFIER, 0);
    }
    public modelBinding(): ModelBindingContext[];
    public modelBinding(i: number): ModelBindingContext | null;
    public modelBinding(i?: number): ModelBindingContext[] | ModelBindingContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ModelBindingContext);
        }

        return this.getRuleContext(i, ModelBindingContext);
    }
    public useItem(): UseItemContext[];
    public useItem(i: number): UseItemContext | null;
    public useItem(i?: number): UseItemContext[] | UseItemContext | null {
        if (i === undefined) {
            return this.getRuleContexts(UseItemContext);
        }

        return this.getRuleContext(i, UseItemContext);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_useDecl;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitUseDecl) {
            return visitor.visitUseDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UseItemContext extends antlr.ParserRuleContext {
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
        return HaloParser.RULE_useItem;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitUseItem) {
            return visitor.visitUseItem(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ModelBindingContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public name(): NameContext {
        return this.getRuleContext(0, NameContext)!;
    }
    public modelRef(): ModelRefContext {
        return this.getRuleContext(0, ModelRefContext)!;
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_modelBinding;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitModelBinding) {
            return visitor.visitModelBinding(this);
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
    public policyRule(): PolicyRuleContext[];
    public policyRule(i: number): PolicyRuleContext | null;
    public policyRule(i?: number): PolicyRuleContext[] | PolicyRuleContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PolicyRuleContext);
        }

        return this.getRuleContext(i, PolicyRuleContext);
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
    public loopCondition(): LoopConditionContext {
        return this.getRuleContext(0, LoopConditionContext)!;
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


export class LoopConditionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public condExpr(): CondExprContext | null {
        return this.getRuleContext(0, CondExprContext);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.STRING, 0);
    }
    public TRIPLE_STRING(): antlr.TerminalNode | null {
        return this.getToken(HaloParser.TRIPLE_STRING, 0);
    }
    public override get ruleIndex(): number {
        return HaloParser.RULE_loopCondition;
    }
    public override accept<Result>(visitor: HaloVisitor<Result>): Result | null {
        if (visitor.visitLoopCondition) {
            return visitor.visitLoopCondition(this);
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
