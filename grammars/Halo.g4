grammar Halo;

// ============================================================
// Parser rules
// ============================================================

program: declaration* EOF;

declaration: policyDecl | toolDecl | storeDecl | schemaDecl | agentDecl | pipelineDecl;

// Identifiers plus soft keywords. Used wherever a name cannot be confused with
// a declaration keyword: named-arg keys, method names, context path segments.
name
    : IDENTIFIER
    | 'policy' | 'tool' | 'store' | 'schema' | 'agent' | 'pipeline'
    | 'equips' | 'requires' | 'system' | 'context' | 'yield' | 'listen' | 'loop' | 'as'
    | 'each' | 'in' | 'else'
    ;

dottedId: IDENTIFIER ('.' pathPart)*;

// A path segment: a name, or a list index (`items.0.title`).
pathPart: name | NUMBER;

// ── Policies ──
policyDecl: 'policy' IDENTIFIER ':' policyRule ('&' policyRule)*;

policyRule: IDENTIFIER '(' callArgs? ')';

// ── Tools & Stores ──
toolDecl: 'tool' IDENTIFIER ':' IDENTIFIER '(' callArgs? ')';

storeDecl: 'store' IDENTIFIER ':' IDENTIFIER '(' callArgs? ')';

// ── Schemas ──
schemaDecl: 'schema' IDENTIFIER '{' (schemaField ','?)* '}';

schemaField: name ':' typeRef;

// ── Agents ──
agentDecl: directive* 'agent' IDENTIFIER '[' modelRef (',' modelParam)* ','? ']' agentModifier*;

modelRef: MODEL_REF | STRING | dottedId;

modelParam: name ':' value;

agentModifier
    : 'equips' IDENTIFIER (',' IDENTIFIER)*      # equipsModifier
    | 'requires' IDENTIFIER (',' IDENTIFIER)*    # requiresModifier
    | 'system' (STRING | TRIPLE_STRING)          # systemModifier
    ;

// ── Directives ──
directive: '@' name ('(' (directiveArg (',' directiveArg)*)? ')')?;

directiveArg: literal | MODEL_REF | dottedId;

// ── Pipelines ──
pipelineDecl: directive* 'pipeline' IDENTIFIER '(' paramList? ')' ('->' typeRef)? ':' pipeline;

paramList: param (',' param)* ','?;

param: IDENTIFIER ':' typeRef;

// `String`, `UserProfile`, `Array<String>`, `Map<String, Number>`
typeRef: dottedId ('<' typeRef (',' typeRef)* '>')?;

// ── Pipeline ──
pipeline
    : expression pipelineOp*
    | pipelineOp+
    ;

pipelineOp
    : PIPE callExpr binding?                                     # pipeOp
    | GATE '(' condExpr ')' '=>'?                                # gateOp
    | GATE '{' branchArm (',' branchArm)* ','? '}' binding?      # branchOp
    | INTERRUPT 'yield' '(' callArgs? ')' binding?               # interruptOp
    | FANOUT '{' fanoutItem (',' fanoutItem)* ','? '}' binding?  # fanoutOp
    | FANOUT 'each' '(' IDENTIFIER 'in' callValue (',' callArgs)? ')' '=>' callExpr binding?  # eachOp
    | LISTEN 'listen' '(' callValue ')' binding?                 # listenOp
    | LOOP 'loop' '(' IDENTIFIER ',' (STRING | TRIPLE_STRING) (',' callArgs)? ')' binding?  # loopOp
    ;

binding: 'as' name;

// `|? { (cond) => Call(...), else => Call(...) }`: the first matching arm runs.
branchArm
    : '(' condExpr ')' '=>' callExpr    # condArm
    | 'else' '=>' callExpr              # elseArm
    ;

fanoutItem: callExpr binding? | IDENTIFIER binding?;

// `Agent.method(...)`, `Tool.method(...)`, `System.Print()`, or `OtherPipeline(...)`
callExpr: IDENTIFIER ('.' name)? '(' callArgs? ')';

callArgs: callArg (',' callArg)* ','?;

callArg
    : name ':' callValue    # namedArg
    | callValue             # positionalArg
    ;

callValue
    : literal
    | MODEL_REF
    | contextRef
    | listValue
    | dottedId
    ;

listValue: '[' (callValue (',' callValue)* ','?)? ']';

value: literal | MODEL_REF | dottedId;

literal: STRING | TRIPLE_STRING | NUMBER | DURATION | BOOL | NULL;

expression: literal | contextRef | dottedId;

contextRef: 'context' ('.' pathPart)*;

// ── Gate conditions ──
condExpr: orExpr;

orExpr: andExpr ('||' andExpr)*;

andExpr: notExpr ('&&' notExpr)*;

notExpr
    : '!' notExpr          # negation
    | comparison           # comparisonExpr
    ;

comparison: operand (compOp operand)?;

compOp: '==' | '!=' | '>=' | '<=' | '>' | '<';

operand
    : '(' orExpr ')'       # parenOperand
    | literal              # literalOperand
    | contextRef           # contextOperand
    | dottedId             # refOperand
    ;

// ============================================================
// Lexer rules (order matters for equal-length matches)
// ============================================================

WS: [ \t]+ -> skip;
NL: ('\r'? '\n')+ -> skip;
LINE_COMMENT: '//' ~[\r\n]* -> skip;
BLOCK_COMMENT: '/*' .*? '*/' -> skip;

// Pipe operators
LOOP: '|<>';
FANOUT: '|*';
INTERRUPT: '|!';
GATE: '|?';
LISTEN: '~>';
PIPE: '|>';

BOOL: 'true' | 'false';
NULL: 'null';

DURATION: [0-9]+ ('ms' | [smhd]);

NUMBER: '-'? [0-9]+ ('.' [0-9]+)?;

// Model identifiers contain '-' or '/' (e.g. gemini-3-1-pro, openai/gpt-4o-mini,
// together/meta-llama/Llama-3.1-8B-Instruct). Plain dotted names never match.
MODEL_REF: [a-zA-Z_] [a-zA-Z0-9_.]* ([-/] [a-zA-Z0-9_.]+)+;

IDENTIFIER: [a-zA-Z_] [a-zA-Z0-9_]*;

TRIPLE_STRING: '"""' .*? '"""';

STRING
    : '"' (~["\\\r\n] | '\\' .)* '"'
    | '\'' (~['\\\r\n] | '\\' .)* '\''
    ;
