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
    public static readonly BOOL = 52;
    public static readonly NULL = 53;
    public static readonly DURATION = 54;
    public static readonly NUMBER = 55;
    public static readonly MODEL_REF = 56;
    public static readonly IDENTIFIER = 57;
    public static readonly TRIPLE_STRING = 58;
    public static readonly STRING = 59;
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
    public static readonly RULE_binding = 26;
    public static readonly RULE_branchArm = 27;
    public static readonly RULE_fanoutItem = 28;
    public static readonly RULE_callExpr = 29;
    public static readonly RULE_callArgs = 30;
    public static readonly RULE_callArg = 31;
    public static readonly RULE_callValue = 32;
    public static readonly RULE_listValue = 33;
    public static readonly RULE_value = 34;
    public static readonly RULE_literal = 35;
    public static readonly RULE_expression = 36;
    public static readonly RULE_contextRef = 37;
    public static readonly RULE_condExpr = 38;
    public static readonly RULE_orExpr = 39;
    public static readonly RULE_andExpr = 40;
    public static readonly RULE_notExpr = 41;
    public static readonly RULE_comparison = 42;
    public static readonly RULE_compOp = 43;
    public static readonly RULE_operand = 44;

    public static readonly literalNames = [
        null, "'policy'", "'tool'", "'store'", "'schema'", "'agent'", "'pipeline'", 
        "'equips'", "'requires'", "'system'", "'context'", "'yield'", "'listen'", 
        "'loop'", "'as'", "'each'", "'in'", "'else'", "'use'", "'with'", 
        "'.'", "'{'", "','", "'}'", "'('", "')'", "':'", "'&'", "'['", "']'", 
        "'@'", "'->'", "'<'", "'>'", "'=>'", "'||'", "'&&'", "'!'", "'=='", 
        "'!='", "'>='", "'<='", null, null, null, null, "'|<>'", "'|*'", 
        "'|!'", "'|?'", "'~>'", "'|>'", null, "'null'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, "WS", "NL", 
        "LINE_COMMENT", "BLOCK_COMMENT", "LOOP", "FANOUT", "INTERRUPT", 
        "GATE", "LISTEN", "PIPE", "BOOL", "NULL", "DURATION", "NUMBER", 
        "MODEL_REF", "IDENTIFIER", "TRIPLE_STRING", "STRING"
    ];
    public static readonly ruleNames = [
        "program", "declaration", "name", "dottedId", "pathPart", "useDecl", 
        "useItem", "modelBinding", "policyDecl", "policyRule", "toolDecl", 
        "storeDecl", "schemaDecl", "schemaField", "agentDecl", "modelRef", 
        "modelParam", "agentModifier", "directive", "directiveArg", "pipelineDecl", 
        "paramList", "param", "typeRef", "pipeline", "pipelineOp", "binding", 
        "branchArm", "fanoutItem", "callExpr", "callArgs", "callArg", "callValue", 
        "listValue", "value", "literal", "expression", "contextRef", "condExpr", 
        "orExpr", "andExpr", "notExpr", "comparison", "compOp", "operand",
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
            this.state = 93;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1074004094) !== 0)) {
                {
                {
                this.state = 90;
                this.declaration();
                }
                }
                this.state = 95;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 96;
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
            this.state = 105;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 98;
                this.useDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 99;
                this.policyDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 100;
                this.toolDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 101;
                this.storeDecl();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 102;
                this.schemaDecl();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 103;
                this.agentDecl();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 104;
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
            this.state = 107;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 1048574) !== 0) || _la === 57)) {
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
            this.state = 109;
            this.match(HaloParser.IDENTIFIER);
            this.state = 114;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 20) {
                {
                {
                this.state = 110;
                this.match(HaloParser.T__19);
                this.state = 111;
                this.pathPart();
                }
                }
                this.state = 116;
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
            this.state = 119;
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
                this.state = 117;
                this.name();
                }
                break;
            case HaloParser.NUMBER:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 118;
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
            this.state = 121;
            this.match(HaloParser.T__17);
            this.state = 122;
            this.match(HaloParser.STRING);
            this.state = 138;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21) {
                {
                this.state = 123;
                this.match(HaloParser.T__20);
                this.state = 135;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 57) {
                    {
                    this.state = 124;
                    this.useItem();
                    this.state = 129;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 4, this.context);
                    while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                        if (alternative === 1) {
                            {
                            {
                            this.state = 125;
                            this.match(HaloParser.T__21);
                            this.state = 126;
                            this.useItem();
                            }
                            }
                        }
                        this.state = 131;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 4, this.context);
                    }
                    this.state = 133;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 22) {
                        {
                        this.state = 132;
                        this.match(HaloParser.T__21);
                        }
                    }

                    }
                }

                this.state = 137;
                this.match(HaloParser.T__22);
                }
            }

            this.state = 156;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 19) {
                {
                this.state = 140;
                this.match(HaloParser.T__18);
                this.state = 141;
                this.match(HaloParser.IDENTIFIER);
                this.state = 142;
                this.match(HaloParser.T__23);
                this.state = 143;
                this.modelBinding();
                this.state = 148;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 8, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 144;
                        this.match(HaloParser.T__21);
                        this.state = 145;
                        this.modelBinding();
                        }
                        }
                    }
                    this.state = 150;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 8, this.context);
                }
                this.state = 152;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 151;
                    this.match(HaloParser.T__21);
                    }
                }

                this.state = 154;
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
            this.state = 158;
            this.match(HaloParser.IDENTIFIER);
            this.state = 161;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
                {
                this.state = 159;
                this.match(HaloParser.T__13);
                this.state = 160;
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
            this.state = 163;
            this.name();
            this.state = 164;
            this.match(HaloParser.T__25);
            this.state = 165;
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
            this.state = 167;
            this.match(HaloParser.T__0);
            this.state = 168;
            this.match(HaloParser.IDENTIFIER);
            this.state = 169;
            this.match(HaloParser.T__25);
            this.state = 170;
            this.policyRule();
            this.state = 175;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 27) {
                {
                {
                this.state = 171;
                this.match(HaloParser.T__26);
                this.state = 172;
                this.policyRule();
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
    public policyRule(): PolicyRuleContext {
        let localContext = new PolicyRuleContext(this.context, this.state);
        this.enterRule(localContext, 18, HaloParser.RULE_policyRule);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 178;
            this.match(HaloParser.IDENTIFIER);
            this.state = 179;
            this.match(HaloParser.T__23);
            this.state = 181;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 255) !== 0)) {
                {
                this.state = 180;
                this.callArgs();
                }
            }

            this.state = 183;
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
            this.state = 185;
            this.match(HaloParser.T__1);
            this.state = 186;
            this.match(HaloParser.IDENTIFIER);
            this.state = 187;
            this.match(HaloParser.T__25);
            this.state = 188;
            this.match(HaloParser.IDENTIFIER);
            this.state = 189;
            this.match(HaloParser.T__23);
            this.state = 191;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 255) !== 0)) {
                {
                this.state = 190;
                this.callArgs();
                }
            }

            this.state = 193;
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
    public storeDecl(): StoreDeclContext {
        let localContext = new StoreDeclContext(this.context, this.state);
        this.enterRule(localContext, 22, HaloParser.RULE_storeDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 195;
            this.match(HaloParser.T__2);
            this.state = 196;
            this.match(HaloParser.IDENTIFIER);
            this.state = 197;
            this.match(HaloParser.T__25);
            this.state = 198;
            this.match(HaloParser.IDENTIFIER);
            this.state = 199;
            this.match(HaloParser.T__23);
            this.state = 201;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 255) !== 0)) {
                {
                this.state = 200;
                this.callArgs();
                }
            }

            this.state = 203;
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
            this.state = 205;
            this.match(HaloParser.T__3);
            this.state = 206;
            this.match(HaloParser.IDENTIFIER);
            this.state = 207;
            this.match(HaloParser.T__20);
            this.state = 214;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1048574) !== 0) || _la === 57) {
                {
                {
                this.state = 208;
                this.schemaField();
                this.state = 210;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 209;
                    this.match(HaloParser.T__21);
                    }
                }

                }
                }
                this.state = 216;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 217;
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
            this.state = 219;
            this.name();
            this.state = 220;
            this.match(HaloParser.T__25);
            this.state = 221;
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
            this.state = 226;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 30) {
                {
                {
                this.state = 223;
                this.directive();
                }
                }
                this.state = 228;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 229;
            this.match(HaloParser.T__4);
            this.state = 230;
            this.match(HaloParser.IDENTIFIER);
            this.state = 231;
            this.match(HaloParser.T__27);
            this.state = 232;
            this.modelRef();
            this.state = 237;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 19, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 233;
                    this.match(HaloParser.T__21);
                    this.state = 234;
                    this.modelParam();
                    }
                    }
                }
                this.state = 239;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 19, this.context);
            }
            this.state = 241;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 22) {
                {
                this.state = 240;
                this.match(HaloParser.T__21);
                }
            }

            this.state = 243;
            this.match(HaloParser.T__28);
            this.state = 247;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 896) !== 0)) {
                {
                {
                this.state = 244;
                this.agentModifier();
                }
                }
                this.state = 249;
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
            this.state = 253;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 250;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.STRING:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 251;
                this.match(HaloParser.STRING);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 252;
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
            this.state = 255;
            this.name();
            this.state = 256;
            this.match(HaloParser.T__25);
            this.state = 257;
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
            this.state = 279;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__6:
                localContext = new EquipsModifierContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 259;
                this.match(HaloParser.T__6);
                this.state = 260;
                this.match(HaloParser.IDENTIFIER);
                this.state = 265;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 22) {
                    {
                    {
                    this.state = 261;
                    this.match(HaloParser.T__21);
                    this.state = 262;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 267;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__7:
                localContext = new RequiresModifierContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 268;
                this.match(HaloParser.T__7);
                this.state = 269;
                this.match(HaloParser.IDENTIFIER);
                this.state = 274;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 22) {
                    {
                    {
                    this.state = 270;
                    this.match(HaloParser.T__21);
                    this.state = 271;
                    this.match(HaloParser.IDENTIFIER);
                    }
                    }
                    this.state = 276;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case HaloParser.T__8:
                localContext = new SystemModifierContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 277;
                this.match(HaloParser.T__8);
                this.state = 278;
                _la = this.tokenStream.LA(1);
                if(!(_la === 58 || _la === 59)) {
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
            this.state = 281;
            this.match(HaloParser.T__29);
            this.state = 282;
            this.name();
            this.state = 295;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
                {
                this.state = 283;
                this.match(HaloParser.T__23);
                this.state = 292;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 255) !== 0)) {
                    {
                    this.state = 284;
                    this.directiveArg();
                    this.state = 289;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 22) {
                        {
                        {
                        this.state = 285;
                        this.match(HaloParser.T__21);
                        this.state = 286;
                        this.directiveArg();
                        }
                        }
                        this.state = 291;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                this.state = 294;
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
            this.state = 300;
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
                this.state = 297;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 298;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 299;
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
            this.state = 305;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 30) {
                {
                {
                this.state = 302;
                this.directive();
                }
                }
                this.state = 307;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 308;
            this.match(HaloParser.T__5);
            this.state = 309;
            this.match(HaloParser.IDENTIFIER);
            this.state = 310;
            this.match(HaloParser.T__23);
            this.state = 312;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 57) {
                {
                this.state = 311;
                this.paramList();
                }
            }

            this.state = 314;
            this.match(HaloParser.T__24);
            this.state = 317;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 31) {
                {
                this.state = 315;
                this.match(HaloParser.T__30);
                this.state = 316;
                this.typeRef();
                }
            }

            this.state = 319;
            this.match(HaloParser.T__25);
            this.state = 320;
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
            this.state = 322;
            this.param();
            this.state = 327;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 323;
                    this.match(HaloParser.T__21);
                    this.state = 324;
                    this.param();
                    }
                    }
                }
                this.state = 329;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
            }
            this.state = 331;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 22) {
                {
                this.state = 330;
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
            this.state = 333;
            this.match(HaloParser.IDENTIFIER);
            this.state = 334;
            this.match(HaloParser.T__25);
            this.state = 335;
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
            this.state = 337;
            this.dottedId();
            this.state = 349;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 32) {
                {
                this.state = 338;
                this.match(HaloParser.T__31);
                this.state = 339;
                this.typeRef();
                this.state = 344;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 22) {
                    {
                    {
                    this.state = 340;
                    this.match(HaloParser.T__21);
                    this.state = 341;
                    this.typeRef();
                    }
                    }
                    this.state = 346;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 347;
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
            this.state = 363;
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
                this.state = 351;
                this.expression();
                this.state = 355;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & 63) !== 0)) {
                    {
                    {
                    this.state = 352;
                    this.pipelineOp();
                    }
                    }
                    this.state = 357;
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
                this.state = 359;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 358;
                    this.pipelineOp();
                    }
                    }
                    this.state = 361;
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
            this.state = 459;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 55, this.context) ) {
            case 1:
                localContext = new PipeOpContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 365;
                this.match(HaloParser.PIPE);
                this.state = 366;
                this.callExpr();
                this.state = 368;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 367;
                    this.binding();
                    }
                }

                }
                break;
            case 2:
                localContext = new GateOpContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 370;
                this.match(HaloParser.GATE);
                this.state = 371;
                this.match(HaloParser.T__23);
                this.state = 372;
                this.condExpr();
                this.state = 373;
                this.match(HaloParser.T__24);
                this.state = 375;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 34) {
                    {
                    this.state = 374;
                    this.match(HaloParser.T__33);
                    }
                }

                }
                break;
            case 3:
                localContext = new BranchOpContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 377;
                this.match(HaloParser.GATE);
                this.state = 378;
                this.match(HaloParser.T__20);
                this.state = 379;
                this.branchArm();
                this.state = 384;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 42, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 380;
                        this.match(HaloParser.T__21);
                        this.state = 381;
                        this.branchArm();
                        }
                        }
                    }
                    this.state = 386;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 42, this.context);
                }
                this.state = 388;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 387;
                    this.match(HaloParser.T__21);
                    }
                }

                this.state = 390;
                this.match(HaloParser.T__22);
                this.state = 392;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 391;
                    this.binding();
                    }
                }

                }
                break;
            case 4:
                localContext = new InterruptOpContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 394;
                this.match(HaloParser.INTERRUPT);
                this.state = 395;
                this.match(HaloParser.T__10);
                this.state = 396;
                this.match(HaloParser.T__23);
                this.state = 398;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 255) !== 0)) {
                    {
                    this.state = 397;
                    this.callArgs();
                    }
                }

                this.state = 400;
                this.match(HaloParser.T__24);
                this.state = 402;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 401;
                    this.binding();
                    }
                }

                }
                break;
            case 5:
                localContext = new FanoutOpContext(localContext);
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 404;
                this.match(HaloParser.FANOUT);
                this.state = 405;
                this.match(HaloParser.T__20);
                this.state = 406;
                this.fanoutItem();
                this.state = 411;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 47, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 407;
                        this.match(HaloParser.T__21);
                        this.state = 408;
                        this.fanoutItem();
                        }
                        }
                    }
                    this.state = 413;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 47, this.context);
                }
                this.state = 415;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 414;
                    this.match(HaloParser.T__21);
                    }
                }

                this.state = 417;
                this.match(HaloParser.T__22);
                this.state = 419;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 418;
                    this.binding();
                    }
                }

                }
                break;
            case 6:
                localContext = new EachOpContext(localContext);
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 421;
                this.match(HaloParser.FANOUT);
                this.state = 422;
                this.match(HaloParser.T__14);
                this.state = 423;
                this.match(HaloParser.T__23);
                this.state = 424;
                this.match(HaloParser.IDENTIFIER);
                this.state = 425;
                this.match(HaloParser.T__15);
                this.state = 426;
                this.callValue();
                this.state = 429;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 427;
                    this.match(HaloParser.T__21);
                    this.state = 428;
                    this.callArgs();
                    }
                }

                this.state = 431;
                this.match(HaloParser.T__24);
                this.state = 432;
                this.match(HaloParser.T__33);
                this.state = 433;
                this.callExpr();
                this.state = 435;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 434;
                    this.binding();
                    }
                }

                }
                break;
            case 7:
                localContext = new ListenOpContext(localContext);
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 437;
                this.match(HaloParser.LISTEN);
                this.state = 438;
                this.match(HaloParser.T__11);
                this.state = 439;
                this.match(HaloParser.T__23);
                this.state = 440;
                this.callValue();
                this.state = 441;
                this.match(HaloParser.T__24);
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
            case 8:
                localContext = new LoopOpContext(localContext);
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 445;
                this.match(HaloParser.LOOP);
                this.state = 446;
                this.match(HaloParser.T__12);
                this.state = 447;
                this.match(HaloParser.T__23);
                this.state = 448;
                this.match(HaloParser.IDENTIFIER);
                this.state = 449;
                this.match(HaloParser.T__21);
                this.state = 450;
                _la = this.tokenStream.LA(1);
                if(!(_la === 58 || _la === 59)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 453;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 451;
                    this.match(HaloParser.T__21);
                    this.state = 452;
                    this.callArgs();
                    }
                }

                this.state = 455;
                this.match(HaloParser.T__24);
                this.state = 457;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 456;
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
        this.enterRule(localContext, 52, HaloParser.RULE_binding);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 461;
            this.match(HaloParser.T__13);
            this.state = 462;
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
        this.enterRule(localContext, 54, HaloParser.RULE_branchArm);
        try {
            this.state = 473;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__23:
                localContext = new CondArmContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 464;
                this.match(HaloParser.T__23);
                this.state = 465;
                this.condExpr();
                this.state = 466;
                this.match(HaloParser.T__24);
                this.state = 467;
                this.match(HaloParser.T__33);
                this.state = 468;
                this.callExpr();
                }
                break;
            case HaloParser.T__16:
                localContext = new ElseArmContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 470;
                this.match(HaloParser.T__16);
                this.state = 471;
                this.match(HaloParser.T__33);
                this.state = 472;
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
        this.enterRule(localContext, 56, HaloParser.RULE_fanoutItem);
        let _la: number;
        try {
            this.state = 483;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 59, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 475;
                this.callExpr();
                this.state = 477;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 476;
                    this.binding();
                    }
                }

                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 479;
                this.match(HaloParser.IDENTIFIER);
                this.state = 481;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 14) {
                    {
                    this.state = 480;
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
        this.enterRule(localContext, 58, HaloParser.RULE_callExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 485;
            this.match(HaloParser.IDENTIFIER);
            this.state = 488;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
                {
                this.state = 486;
                this.match(HaloParser.T__19);
                this.state = 487;
                this.name();
                }
            }

            this.state = 490;
            this.match(HaloParser.T__23);
            this.state = 492;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 269484030) !== 0) || ((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 255) !== 0)) {
                {
                this.state = 491;
                this.callArgs();
                }
            }

            this.state = 494;
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
        this.enterRule(localContext, 60, HaloParser.RULE_callArgs);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 496;
            this.callArg();
            this.state = 501;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 62, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 497;
                    this.match(HaloParser.T__21);
                    this.state = 498;
                    this.callArg();
                    }
                    }
                }
                this.state = 503;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 62, this.context);
            }
            this.state = 505;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 22) {
                {
                this.state = 504;
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
        this.enterRule(localContext, 62, HaloParser.RULE_callArg);
        try {
            this.state = 512;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 64, this.context) ) {
            case 1:
                localContext = new NamedArgContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 507;
                this.name();
                this.state = 508;
                this.match(HaloParser.T__25);
                this.state = 509;
                this.callValue();
                }
                break;
            case 2:
                localContext = new PositionalArgContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 511;
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
        this.enterRule(localContext, 64, HaloParser.RULE_callValue);
        try {
            this.state = 519;
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
                this.state = 514;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 515;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 516;
                this.contextRef();
                }
                break;
            case HaloParser.T__27:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 517;
                this.listValue();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 518;
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
        this.enterRule(localContext, 66, HaloParser.RULE_listValue);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 521;
            this.match(HaloParser.T__27);
            this.state = 533;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 28 || ((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 255) !== 0)) {
                {
                this.state = 522;
                this.callValue();
                this.state = 527;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 66, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 523;
                        this.match(HaloParser.T__21);
                        this.state = 524;
                        this.callValue();
                        }
                        }
                    }
                    this.state = 529;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 66, this.context);
                }
                this.state = 531;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 22) {
                    {
                    this.state = 530;
                    this.match(HaloParser.T__21);
                    }
                }

                }
            }

            this.state = 535;
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
        this.enterRule(localContext, 68, HaloParser.RULE_value);
        try {
            this.state = 540;
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
                this.state = 537;
                this.literal();
                }
                break;
            case HaloParser.MODEL_REF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 538;
                this.match(HaloParser.MODEL_REF);
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 539;
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
        this.enterRule(localContext, 70, HaloParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 542;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 207) !== 0))) {
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
        this.enterRule(localContext, 72, HaloParser.RULE_expression);
        try {
            this.state = 547;
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
                this.state = 544;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 545;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 546;
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
        this.enterRule(localContext, 74, HaloParser.RULE_contextRef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 549;
            this.match(HaloParser.T__9);
            this.state = 554;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 20) {
                {
                {
                this.state = 550;
                this.match(HaloParser.T__19);
                this.state = 551;
                this.pathPart();
                }
                }
                this.state = 556;
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
        this.enterRule(localContext, 76, HaloParser.RULE_condExpr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 557;
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
        this.enterRule(localContext, 78, HaloParser.RULE_orExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 559;
            this.andExpr();
            this.state = 564;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 35) {
                {
                {
                this.state = 560;
                this.match(HaloParser.T__34);
                this.state = 561;
                this.andExpr();
                }
                }
                this.state = 566;
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
        this.enterRule(localContext, 80, HaloParser.RULE_andExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 567;
            this.notExpr();
            this.state = 572;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 36) {
                {
                {
                this.state = 568;
                this.match(HaloParser.T__35);
                this.state = 569;
                this.notExpr();
                }
                }
                this.state = 574;
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
        this.enterRule(localContext, 82, HaloParser.RULE_notExpr);
        try {
            this.state = 578;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__36:
                localContext = new NegationContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 575;
                this.match(HaloParser.T__36);
                this.state = 576;
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
                this.state = 577;
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
        this.enterRule(localContext, 84, HaloParser.RULE_comparison);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 580;
            this.operand();
            this.state = 584;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 963) !== 0)) {
                {
                this.state = 581;
                this.compOp();
                this.state = 582;
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
        this.enterRule(localContext, 86, HaloParser.RULE_compOp);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 586;
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
        this.enterRule(localContext, 88, HaloParser.RULE_operand);
        try {
            this.state = 595;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case HaloParser.T__23:
                localContext = new ParenOperandContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 588;
                this.match(HaloParser.T__23);
                this.state = 589;
                this.orExpr();
                this.state = 590;
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
                this.state = 592;
                this.literal();
                }
                break;
            case HaloParser.T__9:
                localContext = new ContextOperandContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 593;
                this.contextRef();
                }
                break;
            case HaloParser.IDENTIFIER:
                localContext = new RefOperandContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 594;
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
        4,1,59,598,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,
        7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,
        2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,1,0,5,0,92,8,0,
        10,0,12,0,95,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,106,8,1,
        1,2,1,2,1,3,1,3,1,3,5,3,113,8,3,10,3,12,3,116,9,3,1,4,1,4,3,4,120,
        8,4,1,5,1,5,1,5,1,5,1,5,1,5,5,5,128,8,5,10,5,12,5,131,9,5,1,5,3,
        5,134,8,5,3,5,136,8,5,1,5,3,5,139,8,5,1,5,1,5,1,5,1,5,1,5,1,5,5,
        5,147,8,5,10,5,12,5,150,9,5,1,5,3,5,153,8,5,1,5,1,5,3,5,157,8,5,
        1,6,1,6,1,6,3,6,162,8,6,1,7,1,7,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,
        5,8,174,8,8,10,8,12,8,177,9,8,1,9,1,9,1,9,3,9,182,8,9,1,9,1,9,1,
        10,1,10,1,10,1,10,1,10,1,10,3,10,192,8,10,1,10,1,10,1,11,1,11,1,
        11,1,11,1,11,1,11,3,11,202,8,11,1,11,1,11,1,12,1,12,1,12,1,12,1,
        12,3,12,211,8,12,5,12,213,8,12,10,12,12,12,216,9,12,1,12,1,12,1,
        13,1,13,1,13,1,13,1,14,5,14,225,8,14,10,14,12,14,228,9,14,1,14,1,
        14,1,14,1,14,1,14,1,14,5,14,236,8,14,10,14,12,14,239,9,14,1,14,3,
        14,242,8,14,1,14,1,14,5,14,246,8,14,10,14,12,14,249,9,14,1,15,1,
        15,1,15,3,15,254,8,15,1,16,1,16,1,16,1,16,1,17,1,17,1,17,1,17,5,
        17,264,8,17,10,17,12,17,267,9,17,1,17,1,17,1,17,1,17,5,17,273,8,
        17,10,17,12,17,276,9,17,1,17,1,17,3,17,280,8,17,1,18,1,18,1,18,1,
        18,1,18,1,18,5,18,288,8,18,10,18,12,18,291,9,18,3,18,293,8,18,1,
        18,3,18,296,8,18,1,19,1,19,1,19,3,19,301,8,19,1,20,5,20,304,8,20,
        10,20,12,20,307,9,20,1,20,1,20,1,20,1,20,3,20,313,8,20,1,20,1,20,
        1,20,3,20,318,8,20,1,20,1,20,1,20,1,21,1,21,1,21,5,21,326,8,21,10,
        21,12,21,329,9,21,1,21,3,21,332,8,21,1,22,1,22,1,22,1,22,1,23,1,
        23,1,23,1,23,1,23,5,23,343,8,23,10,23,12,23,346,9,23,1,23,1,23,3,
        23,350,8,23,1,24,1,24,5,24,354,8,24,10,24,12,24,357,9,24,1,24,4,
        24,360,8,24,11,24,12,24,361,3,24,364,8,24,1,25,1,25,1,25,3,25,369,
        8,25,1,25,1,25,1,25,1,25,1,25,3,25,376,8,25,1,25,1,25,1,25,1,25,
        1,25,5,25,383,8,25,10,25,12,25,386,9,25,1,25,3,25,389,8,25,1,25,
        1,25,3,25,393,8,25,1,25,1,25,1,25,1,25,3,25,399,8,25,1,25,1,25,3,
        25,403,8,25,1,25,1,25,1,25,1,25,1,25,5,25,410,8,25,10,25,12,25,413,
        9,25,1,25,3,25,416,8,25,1,25,1,25,3,25,420,8,25,1,25,1,25,1,25,1,
        25,1,25,1,25,1,25,1,25,3,25,430,8,25,1,25,1,25,1,25,1,25,3,25,436,
        8,25,1,25,1,25,1,25,1,25,1,25,1,25,3,25,444,8,25,1,25,1,25,1,25,
        1,25,1,25,1,25,1,25,1,25,3,25,454,8,25,1,25,1,25,3,25,458,8,25,3,
        25,460,8,25,1,26,1,26,1,26,1,27,1,27,1,27,1,27,1,27,1,27,1,27,1,
        27,1,27,3,27,474,8,27,1,28,1,28,3,28,478,8,28,1,28,1,28,3,28,482,
        8,28,3,28,484,8,28,1,29,1,29,1,29,3,29,489,8,29,1,29,1,29,3,29,493,
        8,29,1,29,1,29,1,30,1,30,1,30,5,30,500,8,30,10,30,12,30,503,9,30,
        1,30,3,30,506,8,30,1,31,1,31,1,31,1,31,1,31,3,31,513,8,31,1,32,1,
        32,1,32,1,32,1,32,3,32,520,8,32,1,33,1,33,1,33,1,33,5,33,526,8,33,
        10,33,12,33,529,9,33,1,33,3,33,532,8,33,3,33,534,8,33,1,33,1,33,
        1,34,1,34,1,34,3,34,541,8,34,1,35,1,35,1,36,1,36,1,36,3,36,548,8,
        36,1,37,1,37,1,37,5,37,553,8,37,10,37,12,37,556,9,37,1,38,1,38,1,
        39,1,39,1,39,5,39,563,8,39,10,39,12,39,566,9,39,1,40,1,40,1,40,5,
        40,571,8,40,10,40,12,40,574,9,40,1,41,1,41,1,41,3,41,579,8,41,1,
        42,1,42,1,42,1,42,3,42,585,8,42,1,43,1,43,1,44,1,44,1,44,1,44,1,
        44,1,44,1,44,3,44,596,8,44,1,44,0,0,45,0,2,4,6,8,10,12,14,16,18,
        20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,
        64,66,68,70,72,74,76,78,80,82,84,86,88,0,4,2,0,1,19,57,57,1,0,58,
        59,2,0,52,55,58,59,2,0,32,33,38,41,650,0,93,1,0,0,0,2,105,1,0,0,
        0,4,107,1,0,0,0,6,109,1,0,0,0,8,119,1,0,0,0,10,121,1,0,0,0,12,158,
        1,0,0,0,14,163,1,0,0,0,16,167,1,0,0,0,18,178,1,0,0,0,20,185,1,0,
        0,0,22,195,1,0,0,0,24,205,1,0,0,0,26,219,1,0,0,0,28,226,1,0,0,0,
        30,253,1,0,0,0,32,255,1,0,0,0,34,279,1,0,0,0,36,281,1,0,0,0,38,300,
        1,0,0,0,40,305,1,0,0,0,42,322,1,0,0,0,44,333,1,0,0,0,46,337,1,0,
        0,0,48,363,1,0,0,0,50,459,1,0,0,0,52,461,1,0,0,0,54,473,1,0,0,0,
        56,483,1,0,0,0,58,485,1,0,0,0,60,496,1,0,0,0,62,512,1,0,0,0,64,519,
        1,0,0,0,66,521,1,0,0,0,68,540,1,0,0,0,70,542,1,0,0,0,72,547,1,0,
        0,0,74,549,1,0,0,0,76,557,1,0,0,0,78,559,1,0,0,0,80,567,1,0,0,0,
        82,578,1,0,0,0,84,580,1,0,0,0,86,586,1,0,0,0,88,595,1,0,0,0,90,92,
        3,2,1,0,91,90,1,0,0,0,92,95,1,0,0,0,93,91,1,0,0,0,93,94,1,0,0,0,
        94,96,1,0,0,0,95,93,1,0,0,0,96,97,5,0,0,1,97,1,1,0,0,0,98,106,3,
        10,5,0,99,106,3,16,8,0,100,106,3,20,10,0,101,106,3,22,11,0,102,106,
        3,24,12,0,103,106,3,28,14,0,104,106,3,40,20,0,105,98,1,0,0,0,105,
        99,1,0,0,0,105,100,1,0,0,0,105,101,1,0,0,0,105,102,1,0,0,0,105,103,
        1,0,0,0,105,104,1,0,0,0,106,3,1,0,0,0,107,108,7,0,0,0,108,5,1,0,
        0,0,109,114,5,57,0,0,110,111,5,20,0,0,111,113,3,8,4,0,112,110,1,
        0,0,0,113,116,1,0,0,0,114,112,1,0,0,0,114,115,1,0,0,0,115,7,1,0,
        0,0,116,114,1,0,0,0,117,120,3,4,2,0,118,120,5,55,0,0,119,117,1,0,
        0,0,119,118,1,0,0,0,120,9,1,0,0,0,121,122,5,18,0,0,122,138,5,59,
        0,0,123,135,5,21,0,0,124,129,3,12,6,0,125,126,5,22,0,0,126,128,3,
        12,6,0,127,125,1,0,0,0,128,131,1,0,0,0,129,127,1,0,0,0,129,130,1,
        0,0,0,130,133,1,0,0,0,131,129,1,0,0,0,132,134,5,22,0,0,133,132,1,
        0,0,0,133,134,1,0,0,0,134,136,1,0,0,0,135,124,1,0,0,0,135,136,1,
        0,0,0,136,137,1,0,0,0,137,139,5,23,0,0,138,123,1,0,0,0,138,139,1,
        0,0,0,139,156,1,0,0,0,140,141,5,19,0,0,141,142,5,57,0,0,142,143,
        5,24,0,0,143,148,3,14,7,0,144,145,5,22,0,0,145,147,3,14,7,0,146,
        144,1,0,0,0,147,150,1,0,0,0,148,146,1,0,0,0,148,149,1,0,0,0,149,
        152,1,0,0,0,150,148,1,0,0,0,151,153,5,22,0,0,152,151,1,0,0,0,152,
        153,1,0,0,0,153,154,1,0,0,0,154,155,5,25,0,0,155,157,1,0,0,0,156,
        140,1,0,0,0,156,157,1,0,0,0,157,11,1,0,0,0,158,161,5,57,0,0,159,
        160,5,14,0,0,160,162,5,57,0,0,161,159,1,0,0,0,161,162,1,0,0,0,162,
        13,1,0,0,0,163,164,3,4,2,0,164,165,5,26,0,0,165,166,3,30,15,0,166,
        15,1,0,0,0,167,168,5,1,0,0,168,169,5,57,0,0,169,170,5,26,0,0,170,
        175,3,18,9,0,171,172,5,27,0,0,172,174,3,18,9,0,173,171,1,0,0,0,174,
        177,1,0,0,0,175,173,1,0,0,0,175,176,1,0,0,0,176,17,1,0,0,0,177,175,
        1,0,0,0,178,179,5,57,0,0,179,181,5,24,0,0,180,182,3,60,30,0,181,
        180,1,0,0,0,181,182,1,0,0,0,182,183,1,0,0,0,183,184,5,25,0,0,184,
        19,1,0,0,0,185,186,5,2,0,0,186,187,5,57,0,0,187,188,5,26,0,0,188,
        189,5,57,0,0,189,191,5,24,0,0,190,192,3,60,30,0,191,190,1,0,0,0,
        191,192,1,0,0,0,192,193,1,0,0,0,193,194,5,25,0,0,194,21,1,0,0,0,
        195,196,5,3,0,0,196,197,5,57,0,0,197,198,5,26,0,0,198,199,5,57,0,
        0,199,201,5,24,0,0,200,202,3,60,30,0,201,200,1,0,0,0,201,202,1,0,
        0,0,202,203,1,0,0,0,203,204,5,25,0,0,204,23,1,0,0,0,205,206,5,4,
        0,0,206,207,5,57,0,0,207,214,5,21,0,0,208,210,3,26,13,0,209,211,
        5,22,0,0,210,209,1,0,0,0,210,211,1,0,0,0,211,213,1,0,0,0,212,208,
        1,0,0,0,213,216,1,0,0,0,214,212,1,0,0,0,214,215,1,0,0,0,215,217,
        1,0,0,0,216,214,1,0,0,0,217,218,5,23,0,0,218,25,1,0,0,0,219,220,
        3,4,2,0,220,221,5,26,0,0,221,222,3,46,23,0,222,27,1,0,0,0,223,225,
        3,36,18,0,224,223,1,0,0,0,225,228,1,0,0,0,226,224,1,0,0,0,226,227,
        1,0,0,0,227,229,1,0,0,0,228,226,1,0,0,0,229,230,5,5,0,0,230,231,
        5,57,0,0,231,232,5,28,0,0,232,237,3,30,15,0,233,234,5,22,0,0,234,
        236,3,32,16,0,235,233,1,0,0,0,236,239,1,0,0,0,237,235,1,0,0,0,237,
        238,1,0,0,0,238,241,1,0,0,0,239,237,1,0,0,0,240,242,5,22,0,0,241,
        240,1,0,0,0,241,242,1,0,0,0,242,243,1,0,0,0,243,247,5,29,0,0,244,
        246,3,34,17,0,245,244,1,0,0,0,246,249,1,0,0,0,247,245,1,0,0,0,247,
        248,1,0,0,0,248,29,1,0,0,0,249,247,1,0,0,0,250,254,5,56,0,0,251,
        254,5,59,0,0,252,254,3,6,3,0,253,250,1,0,0,0,253,251,1,0,0,0,253,
        252,1,0,0,0,254,31,1,0,0,0,255,256,3,4,2,0,256,257,5,26,0,0,257,
        258,3,68,34,0,258,33,1,0,0,0,259,260,5,7,0,0,260,265,5,57,0,0,261,
        262,5,22,0,0,262,264,5,57,0,0,263,261,1,0,0,0,264,267,1,0,0,0,265,
        263,1,0,0,0,265,266,1,0,0,0,266,280,1,0,0,0,267,265,1,0,0,0,268,
        269,5,8,0,0,269,274,5,57,0,0,270,271,5,22,0,0,271,273,5,57,0,0,272,
        270,1,0,0,0,273,276,1,0,0,0,274,272,1,0,0,0,274,275,1,0,0,0,275,
        280,1,0,0,0,276,274,1,0,0,0,277,278,5,9,0,0,278,280,7,1,0,0,279,
        259,1,0,0,0,279,268,1,0,0,0,279,277,1,0,0,0,280,35,1,0,0,0,281,282,
        5,30,0,0,282,295,3,4,2,0,283,292,5,24,0,0,284,289,3,38,19,0,285,
        286,5,22,0,0,286,288,3,38,19,0,287,285,1,0,0,0,288,291,1,0,0,0,289,
        287,1,0,0,0,289,290,1,0,0,0,290,293,1,0,0,0,291,289,1,0,0,0,292,
        284,1,0,0,0,292,293,1,0,0,0,293,294,1,0,0,0,294,296,5,25,0,0,295,
        283,1,0,0,0,295,296,1,0,0,0,296,37,1,0,0,0,297,301,3,70,35,0,298,
        301,5,56,0,0,299,301,3,6,3,0,300,297,1,0,0,0,300,298,1,0,0,0,300,
        299,1,0,0,0,301,39,1,0,0,0,302,304,3,36,18,0,303,302,1,0,0,0,304,
        307,1,0,0,0,305,303,1,0,0,0,305,306,1,0,0,0,306,308,1,0,0,0,307,
        305,1,0,0,0,308,309,5,6,0,0,309,310,5,57,0,0,310,312,5,24,0,0,311,
        313,3,42,21,0,312,311,1,0,0,0,312,313,1,0,0,0,313,314,1,0,0,0,314,
        317,5,25,0,0,315,316,5,31,0,0,316,318,3,46,23,0,317,315,1,0,0,0,
        317,318,1,0,0,0,318,319,1,0,0,0,319,320,5,26,0,0,320,321,3,48,24,
        0,321,41,1,0,0,0,322,327,3,44,22,0,323,324,5,22,0,0,324,326,3,44,
        22,0,325,323,1,0,0,0,326,329,1,0,0,0,327,325,1,0,0,0,327,328,1,0,
        0,0,328,331,1,0,0,0,329,327,1,0,0,0,330,332,5,22,0,0,331,330,1,0,
        0,0,331,332,1,0,0,0,332,43,1,0,0,0,333,334,5,57,0,0,334,335,5,26,
        0,0,335,336,3,46,23,0,336,45,1,0,0,0,337,349,3,6,3,0,338,339,5,32,
        0,0,339,344,3,46,23,0,340,341,5,22,0,0,341,343,3,46,23,0,342,340,
        1,0,0,0,343,346,1,0,0,0,344,342,1,0,0,0,344,345,1,0,0,0,345,347,
        1,0,0,0,346,344,1,0,0,0,347,348,5,33,0,0,348,350,1,0,0,0,349,338,
        1,0,0,0,349,350,1,0,0,0,350,47,1,0,0,0,351,355,3,72,36,0,352,354,
        3,50,25,0,353,352,1,0,0,0,354,357,1,0,0,0,355,353,1,0,0,0,355,356,
        1,0,0,0,356,364,1,0,0,0,357,355,1,0,0,0,358,360,3,50,25,0,359,358,
        1,0,0,0,360,361,1,0,0,0,361,359,1,0,0,0,361,362,1,0,0,0,362,364,
        1,0,0,0,363,351,1,0,0,0,363,359,1,0,0,0,364,49,1,0,0,0,365,366,5,
        51,0,0,366,368,3,58,29,0,367,369,3,52,26,0,368,367,1,0,0,0,368,369,
        1,0,0,0,369,460,1,0,0,0,370,371,5,49,0,0,371,372,5,24,0,0,372,373,
        3,76,38,0,373,375,5,25,0,0,374,376,5,34,0,0,375,374,1,0,0,0,375,
        376,1,0,0,0,376,460,1,0,0,0,377,378,5,49,0,0,378,379,5,21,0,0,379,
        384,3,54,27,0,380,381,5,22,0,0,381,383,3,54,27,0,382,380,1,0,0,0,
        383,386,1,0,0,0,384,382,1,0,0,0,384,385,1,0,0,0,385,388,1,0,0,0,
        386,384,1,0,0,0,387,389,5,22,0,0,388,387,1,0,0,0,388,389,1,0,0,0,
        389,390,1,0,0,0,390,392,5,23,0,0,391,393,3,52,26,0,392,391,1,0,0,
        0,392,393,1,0,0,0,393,460,1,0,0,0,394,395,5,48,0,0,395,396,5,11,
        0,0,396,398,5,24,0,0,397,399,3,60,30,0,398,397,1,0,0,0,398,399,1,
        0,0,0,399,400,1,0,0,0,400,402,5,25,0,0,401,403,3,52,26,0,402,401,
        1,0,0,0,402,403,1,0,0,0,403,460,1,0,0,0,404,405,5,47,0,0,405,406,
        5,21,0,0,406,411,3,56,28,0,407,408,5,22,0,0,408,410,3,56,28,0,409,
        407,1,0,0,0,410,413,1,0,0,0,411,409,1,0,0,0,411,412,1,0,0,0,412,
        415,1,0,0,0,413,411,1,0,0,0,414,416,5,22,0,0,415,414,1,0,0,0,415,
        416,1,0,0,0,416,417,1,0,0,0,417,419,5,23,0,0,418,420,3,52,26,0,419,
        418,1,0,0,0,419,420,1,0,0,0,420,460,1,0,0,0,421,422,5,47,0,0,422,
        423,5,15,0,0,423,424,5,24,0,0,424,425,5,57,0,0,425,426,5,16,0,0,
        426,429,3,64,32,0,427,428,5,22,0,0,428,430,3,60,30,0,429,427,1,0,
        0,0,429,430,1,0,0,0,430,431,1,0,0,0,431,432,5,25,0,0,432,433,5,34,
        0,0,433,435,3,58,29,0,434,436,3,52,26,0,435,434,1,0,0,0,435,436,
        1,0,0,0,436,460,1,0,0,0,437,438,5,50,0,0,438,439,5,12,0,0,439,440,
        5,24,0,0,440,441,3,64,32,0,441,443,5,25,0,0,442,444,3,52,26,0,443,
        442,1,0,0,0,443,444,1,0,0,0,444,460,1,0,0,0,445,446,5,46,0,0,446,
        447,5,13,0,0,447,448,5,24,0,0,448,449,5,57,0,0,449,450,5,22,0,0,
        450,453,7,1,0,0,451,452,5,22,0,0,452,454,3,60,30,0,453,451,1,0,0,
        0,453,454,1,0,0,0,454,455,1,0,0,0,455,457,5,25,0,0,456,458,3,52,
        26,0,457,456,1,0,0,0,457,458,1,0,0,0,458,460,1,0,0,0,459,365,1,0,
        0,0,459,370,1,0,0,0,459,377,1,0,0,0,459,394,1,0,0,0,459,404,1,0,
        0,0,459,421,1,0,0,0,459,437,1,0,0,0,459,445,1,0,0,0,460,51,1,0,0,
        0,461,462,5,14,0,0,462,463,3,4,2,0,463,53,1,0,0,0,464,465,5,24,0,
        0,465,466,3,76,38,0,466,467,5,25,0,0,467,468,5,34,0,0,468,469,3,
        58,29,0,469,474,1,0,0,0,470,471,5,17,0,0,471,472,5,34,0,0,472,474,
        3,58,29,0,473,464,1,0,0,0,473,470,1,0,0,0,474,55,1,0,0,0,475,477,
        3,58,29,0,476,478,3,52,26,0,477,476,1,0,0,0,477,478,1,0,0,0,478,
        484,1,0,0,0,479,481,5,57,0,0,480,482,3,52,26,0,481,480,1,0,0,0,481,
        482,1,0,0,0,482,484,1,0,0,0,483,475,1,0,0,0,483,479,1,0,0,0,484,
        57,1,0,0,0,485,488,5,57,0,0,486,487,5,20,0,0,487,489,3,4,2,0,488,
        486,1,0,0,0,488,489,1,0,0,0,489,490,1,0,0,0,490,492,5,24,0,0,491,
        493,3,60,30,0,492,491,1,0,0,0,492,493,1,0,0,0,493,494,1,0,0,0,494,
        495,5,25,0,0,495,59,1,0,0,0,496,501,3,62,31,0,497,498,5,22,0,0,498,
        500,3,62,31,0,499,497,1,0,0,0,500,503,1,0,0,0,501,499,1,0,0,0,501,
        502,1,0,0,0,502,505,1,0,0,0,503,501,1,0,0,0,504,506,5,22,0,0,505,
        504,1,0,0,0,505,506,1,0,0,0,506,61,1,0,0,0,507,508,3,4,2,0,508,509,
        5,26,0,0,509,510,3,64,32,0,510,513,1,0,0,0,511,513,3,64,32,0,512,
        507,1,0,0,0,512,511,1,0,0,0,513,63,1,0,0,0,514,520,3,70,35,0,515,
        520,5,56,0,0,516,520,3,74,37,0,517,520,3,66,33,0,518,520,3,6,3,0,
        519,514,1,0,0,0,519,515,1,0,0,0,519,516,1,0,0,0,519,517,1,0,0,0,
        519,518,1,0,0,0,520,65,1,0,0,0,521,533,5,28,0,0,522,527,3,64,32,
        0,523,524,5,22,0,0,524,526,3,64,32,0,525,523,1,0,0,0,526,529,1,0,
        0,0,527,525,1,0,0,0,527,528,1,0,0,0,528,531,1,0,0,0,529,527,1,0,
        0,0,530,532,5,22,0,0,531,530,1,0,0,0,531,532,1,0,0,0,532,534,1,0,
        0,0,533,522,1,0,0,0,533,534,1,0,0,0,534,535,1,0,0,0,535,536,5,29,
        0,0,536,67,1,0,0,0,537,541,3,70,35,0,538,541,5,56,0,0,539,541,3,
        6,3,0,540,537,1,0,0,0,540,538,1,0,0,0,540,539,1,0,0,0,541,69,1,0,
        0,0,542,543,7,2,0,0,543,71,1,0,0,0,544,548,3,70,35,0,545,548,3,74,
        37,0,546,548,3,6,3,0,547,544,1,0,0,0,547,545,1,0,0,0,547,546,1,0,
        0,0,548,73,1,0,0,0,549,554,5,10,0,0,550,551,5,20,0,0,551,553,3,8,
        4,0,552,550,1,0,0,0,553,556,1,0,0,0,554,552,1,0,0,0,554,555,1,0,
        0,0,555,75,1,0,0,0,556,554,1,0,0,0,557,558,3,78,39,0,558,77,1,0,
        0,0,559,564,3,80,40,0,560,561,5,35,0,0,561,563,3,80,40,0,562,560,
        1,0,0,0,563,566,1,0,0,0,564,562,1,0,0,0,564,565,1,0,0,0,565,79,1,
        0,0,0,566,564,1,0,0,0,567,572,3,82,41,0,568,569,5,36,0,0,569,571,
        3,82,41,0,570,568,1,0,0,0,571,574,1,0,0,0,572,570,1,0,0,0,572,573,
        1,0,0,0,573,81,1,0,0,0,574,572,1,0,0,0,575,576,5,37,0,0,576,579,
        3,82,41,0,577,579,3,84,42,0,578,575,1,0,0,0,578,577,1,0,0,0,579,
        83,1,0,0,0,580,584,3,88,44,0,581,582,3,86,43,0,582,583,3,88,44,0,
        583,585,1,0,0,0,584,581,1,0,0,0,584,585,1,0,0,0,585,85,1,0,0,0,586,
        587,7,3,0,0,587,87,1,0,0,0,588,589,5,24,0,0,589,590,3,78,39,0,590,
        591,5,25,0,0,591,596,1,0,0,0,592,596,3,70,35,0,593,596,3,74,37,0,
        594,596,3,6,3,0,595,588,1,0,0,0,595,592,1,0,0,0,595,593,1,0,0,0,
        595,594,1,0,0,0,596,89,1,0,0,0,77,93,105,114,119,129,133,135,138,
        148,152,156,161,175,181,191,201,210,214,226,237,241,247,253,265,
        274,279,289,292,295,300,305,312,317,327,331,344,349,355,361,363,
        368,375,384,388,392,398,402,411,415,419,429,435,443,453,457,459,
        473,477,481,483,488,492,501,505,512,519,527,531,533,540,547,554,
        564,572,578,584,595
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
