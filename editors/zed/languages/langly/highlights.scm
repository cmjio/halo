; ========================================
; Langly Tree-Sitter Highlight Queries
; ========================================

; === Keywords ===
"guardrail" @keyword
"tool" @keyword
"memory" @keyword
"mind" @keyword
"stream" @keyword
"equips" @keyword
"requires" @keyword

; === Built-in functions ===
(call_expr
  (identifier) @function.builtin
  (#match? @function.builtin "^(yield|listen)$"))

; === Operators ===
"->" @operator
(pipe_operator) @operator
(gate_operator) @operator
(interrupt_operator) @operator
(fanout_operator) @operator
(listen_operator) @operator
(comparison_op) @operator
"&" @operator
"=>" @operator

; === Directives ===
(directive) @attribute
(directive_name) @attribute
(directive_value) @attribute

; === Punctuation ===
"[" @punctuation.bracket
"]" @punctuation.bracket
"(" @punctuation.bracket
")" @punctuation.bracket
"{" @punctuation.bracket
"}" @punctuation.bracket
"," @punctuation.delimiter
"." @punctuation.delimiter
":" @punctuation.delimiter

; === Type definitions ===
(mind_decl
  name: (identifier) @type.definition)

(stream_decl
  name: (identifier) @function.definition)

(guardrail_decl
  name: (identifier) @constant)

(tool_decl
  name: (identifier) @constant)

(memory_decl
  name: (identifier) @constant)

(type_ref) @type

; === Parameters ===
(param
  name: (identifier) @variable.parameter)

; === Model references ===
(model_ref) @string.special

; === Model param keys ===
(model_param
  key: (identifier) @variable.parameter)

; === Dotted identifiers (Env.DB_URI, Slack.Interaction) ===
(dotted_ident) @variable.member

; === Context references (context.data.*, context.meta.*) ===
(context_ref) @variable.builtin

; === Variables ===
(identifier) @variable

; === Function calls ===
(call_expr
  . (identifier) @variable.object)

(call_expr
  . (identifier) . (identifier) @function.method)

; === Literals ===
(string) @string
(number) @constant.numeric
(boolean) @constant.builtin

; === Duration ===
(duration) @constant.numeric

; === Comments ===
(comment) @comment
