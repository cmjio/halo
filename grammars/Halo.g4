grammar Halo;

// Parser rules
program: declaration* EOF;

declaration: policyDecl | toolDecl | storeDecl | agentDecl | pipelineDecl | schemaDecl;

// Policies
policyDecl: 'policy' IDENTIFIER ':' policyRule ('&' policyRule)*;
policyRule: IDENTIFIER '(' policyArgs? ')';
policyArgs: policyArg (',' policyArg)*;
policyArg: MODEL_REF | dottedId | IDENTIFIER | STRING | NUMBER | DURATION;
idOrKeyword: IDENTIFIER | 'tool' | 'agent' | 'store' | 'policy' | 'pipeline' | 'schema' | 'equips' | 'requires' | 'system' | 'listen' | 'yield' | 'context' | 'timeout' | 'shadow' | 'checkpoint' | 'retry' | 'correct';
dottedId: idOrKeyword ('.' idOrKeyword)*;

// Schemas
schemaDecl: 'schema' IDENTIFIER '{' schemaFields '}' ;
schemaFields: schemaField* ;
schemaField: IDENTIFIER ':' typeRef ;

// Tools
toolDecl: 'tool' IDENTIFIER ':' IDENTIFIER '(' toolArgs? ')';
toolArgs: toolArg (',' toolArg)*;
toolArg: STRING | NUMBER | DURATION | dottedId | idOrKeyword ':' (STRING | NUMBER | DURATION | dottedId);

// Stores
storeDecl: 'store' IDENTIFIER ':' IDENTIFIER '(' storeArgs? ')';
storeArgs: storeArg (',' storeArg)*;
storeArg: STRING | NUMBER | dottedId | idOrKeyword ':' (STRING | NUMBER | dottedId);

// Agents
agentDecl: directive* 'agent' IDENTIFIER '[' modelConfig ']' agentModifiers?;
agentModifiers: agentModifier+;
agentModifier: 'equips' equipsList | 'requires' requiresList | 'system' stringLiteral;
stringLiteral: STRING | TRIPLE_STRING;
equipsList: IDENTIFIER (',' IDENTIFIER)*;
requiresList: IDENTIFIER (',' IDENTIFIER)*;
modelConfig: modelId (',' modelParam)*;
modelId: MODEL_REF | dottedId | IDENTIFIER;
modelParam: IDENTIFIER ':' value;

// Pipelines
pipelineDecl: directive* 'pipeline' IDENTIFIER '(' paramList? ')' '->' typeRef ':' pipeline;
directive: '@' directiveName directiveValue?;
directiveName: 'timeout' | 'shadow' | 'checkpoint' | 'retry' | 'correct';
directiveValue: '(' directiveArgs ')';
directiveArgs: (IDENTIFIER | NUMBER | STRING | MODEL_REF | DURATION) (',' (IDENTIFIER | NUMBER | STRING | MODEL_REF | DURATION))*;
paramList: param (',' param)*;
param: IDENTIFIER ':' typeRef;
typeRef: typeName ('<' typeName '>')? ;
typeName: idOrKeyword ('.' idOrKeyword)* ;

// Pipeline
pipeline: pipelineStage+;
pipelineStage: PIPE callExpr | GATE condition | INTERRUPT yieldExpr | FANOUT '{' fanoutStages '}' | LISTEN listenExpr | LOOP loopExpr | expression;
condition: '(' conditionExpr ')' '=>'?;
conditionExpr: expression (comparisonOp expression)?;
comparisonOp: '==' | '!=' | '>' | '<' | '>=' | '<=';
fanoutStages: fanoutStage (',' fanoutStage)*;
fanoutStage: callExpr | IDENTIFIER;
yieldExpr: 'yield' '(' yieldArgs? ')';
yieldArgs: yieldArg (',' yieldArg)*;
yieldArg: idOrKeyword ':' yieldArgValue | callValue;
yieldArgValue: callValue | '[' callValue (',' callValue)* ']';
listenExpr: 'listen' '(' listenTarget ')';
listenTarget: dottedId | contextRef;
loopExpr: 'loop' '(' IDENTIFIER ',' STRING ')';
expression: IDENTIFIER | STRING | NUMBER | BOOL | contextRef;
callExpr: IDENTIFIER '.' IDENTIFIER '(' callArgs? ')';
callArgs: callArg (',' callArg)*;
callArg: idOrKeyword ':' callValue | callValue;
callValue: STRING | NUMBER | BOOL | DURATION | MODEL_REF | contextRef | '[' callItems ']' | dottedId;
callItems: callValue (',' callValue)*;
value: STRING | NUMBER | BOOL | idOrKeyword | MODEL_REF | dottedId;

// Context
contextRef: 'context' '.' IDENTIFIER contextTail?;
contextTail: ('.' IDENTIFIER)+;

// Lexer rules (order matters - more specific first)
WS: [ \t]+ -> skip;
NL: '\r'? '\n'+ -> skip;
COMMENT: '//' ~[\r\n]* -> skip;

// Pipe operators
LOOP: '|<>';
FANOUT: '|*';
INTERRUPT: '|!';
GATE: '|?';
LISTEN: '~>';
PIPE: '|>';

DURATION: [0-9]+[smhd];

// MODEL_REF must come AFTER IDENTIFIER
IDENTIFIER: [a-zA-Z_] [a-zA-Z0-9_]*;
MODEL_REF: '/'? [a-zA-Z_] [a-zA-Z0-9]* (('-' | '/') [a-zA-Z0-9_.]+)+;

TRIPLE_STRING: '"""' .*? '"""';
STRING: '"' (~["\\] | '\\'.)* '"' | '\'' (~['\\] | '\\'.)* '\'';
NUMBER: '-'? [0-9]+ ('.' [0-9]+)?;
BOOL: 'true' | 'false';
