grammar Langly;

// Parser rules
program: declaration* EOF;

declaration: guardrailDecl | toolDecl | memoryDecl | mindDecl | streamDecl;

// Guardrails
guardrailDecl: 'guardrail' IDENTIFIER ':' guardrailRule ('&' guardrailRule)*;

guardrailRule: IDENTIFIER '(' guardrailArgs? ')';

guardrailArgs: guardrailArg (',' guardrailArg)*;

guardrailArg: MODEL_REF | dottedId | IDENTIFIER | STRING | NUMBER | DURATION;

// Dotted identifier
dottedId: IDENTIFIER ('.' IDENTIFIER)*;

// Tools
toolDecl: 'tool' IDENTIFIER ':' IDENTIFIER '(' toolArgs? ')';

toolArgs: toolArg (',' toolArg)*;

toolArg: STRING | NUMBER | DURATION | dottedId | IDENTIFIER ':' (STRING | NUMBER | DURATION | dottedId);

// Memory
memoryDecl: 'memory' IDENTIFIER ':' IDENTIFIER '(' memoryArgs? ')';

memoryArgs: memoryArg (',' memoryArg)*;

memoryArg: STRING | NUMBER | dottedId | IDENTIFIER ':' (STRING | NUMBER | dottedId);

// Minds
mindDecl: directive* 'mind' IDENTIFIER '[' modelConfig ']' mindModifiers?;

mindModifiers: mindModifier+;

mindModifier: 'equips' equipsList | 'requires' requiresList;

equipsList: IDENTIFIER (',' IDENTIFIER)*;

requiresList: IDENTIFIER (',' IDENTIFIER)*;

modelConfig: modelId (',' modelParam)*;

modelId: MODEL_REF;

modelParam: IDENTIFIER ':' value;

// Streams
streamDecl: directive* 'stream' IDENTIFIER '(' paramList? ')' '->' typeRef ':' pipeline;

paramList: param (',' param)*;

param: IDENTIFIER ':' typeRef;

typeRef: IDENTIFIER ('.' IDENTIFIER)*;

// Pipeline
pipeline: pipelineStage+;

pipelineStage: PIPE callExpr | GATE condition | INTERRUPT yieldExpr | FANOUT '{' fanoutStages '}' | LISTEN listenExpr | expression;

// Gate
condition: '(' conditionExpr ')' '=>'?;

conditionExpr: expression (comparisonOp expression)?;

comparisonOp: '==' | '!=' | '>' | '<' | '>=' | '<=';

// Fan-out
fanoutStages: fanoutStage (',' fanoutStage)*;

fanoutStage: callExpr | IDENTIFIER;

// Interrupt
yieldExpr: 'yield' '(' yieldArgs? ')';

yieldArgs: yieldArg (',' yieldArg)*;

yieldArg: IDENTIFIER ':' yieldArgValue | callValue;

yieldArgValue: callValue | '[' callValue (',' callValue)* ']';

// Listen
listenExpr: '~>' '(' listenTarget ')';

listenTarget: dottedId | contextRef;

// Expressions & calls
expression: IDENTIFIER | STRING | NUMBER | BOOL | contextRef;

callExpr: IDENTIFIER '.' IDENTIFIER '(' callArgs? ')';

// Call arguments
callArgs: callArg (',' callArg)*;

callArg: IDENTIFIER ':' callValue | callValue;

callValue: STRING | NUMBER | BOOL | DURATION | MODEL_REF | contextRef | '[' callItems ']' | dottedId;

callItems: callValue (',' callValue)*;

value: STRING | NUMBER | BOOL | IDENTIFIER | MODEL_REF;

// Directives
directive: '@' directiveName directiveValue?;

directiveName: 'timeout' | 'shadow' | 'checkpoint' | 'retry';

directiveValue: '(' directiveArgs ')';

directiveArgs: (IDENTIFIER | NUMBER | STRING | MODEL_REF | DURATION) (',' (IDENTIFIER | NUMBER | STRING | MODEL_REF | DURATION))*;

// Context
contextRef: 'context' '.' IDENTIFIER contextTail?;

contextTail: ('.' IDENTIFIER)+;

// Lexer rules (order matters)
WS: [ \t]+ -> skip;
NL: '\r'? '\n'+ -> skip;
COMMENT: '//' ~[\r\n]* -> skip;

// Pipe operators
FANOUT: '|*';
INTERRUPT: '|!';
GATE: '|?';
LISTEN: '~>';
PIPE: '|>';

DURATION: [0-9]+[smhd];

MODEL_REF: '/'? [a-zA-Z_] [a-zA-Z0-9]* ('-' | '/') [a-zA-Z0-9_]+ | '.' [a-zA-Z0-9_]+)+;

IDENTIFIER: [a-zA-Z_] [a-zA-Z0-9_]*;

STRING: '"' (~["\\] | '\\'.)* '"' | '\'' (~['\\] | '\\'.)* '\'';

NUMBER: '-'? [0-9]+ ('.' [0-9]+)?;

BOOL: 'true' | 'false';
