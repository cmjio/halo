; ========================================
; Halo Tree-Sitter Highlight Queries
; ========================================

; === Keywords ===
[
  "policy"
  "tool"
  "store"
  "schema"
  "agent"
  "pipeline"
  "equips"
  "requires"
  "system"
  "as"
  "each"
  "in"
  "else"
] @keyword

"context" @variable.builtin

; === Built-in operations ===
[
  "yield"
  "listen"
  "loop"
] @function.builtin

; === Operators ===
[
  "->"
  "=>"
  "&"
  "&&"
  "||"
  "!"
] @operator

(pipe_operator) @operator
(gate_operator) @operator
(interrupt_operator) @operator
(fanout_operator) @operator
(listen_operator) @operator
(loop_operator) @operator
(comparison_op) @operator

; === Directives ===
"@" @attribute
(directive_name) @attribute

; === Punctuation ===
["[" "]" "(" ")" "{" "}"] @punctuation.bracket
["," "." ":"] @punctuation.delimiter

; === Declarations ===
(agent_decl name: (identifier) @type.definition)
(pipeline_decl name: (identifier) @function.definition)
(schema_decl name: (identifier) @type.definition)
(schema_field name: (identifier) @property)
(policy_decl name: (identifier) @constant)
(tool_decl name: (identifier) @constant)
(store_decl name: (identifier) @constant)
(tool_decl provider: (identifier) @type)
(store_decl provider: (identifier) @type)
(policy_rule name: (identifier) @function)
(agent_modifier (identifier) @constant)

(type_ref) @type

; === Parameters & bindings ===
(param name: (identifier) @variable.parameter)
(binding name: (identifier) @variable)
(each_clause item: (identifier) @variable.parameter)
(model_param key: (identifier) @property)
(call_arg name: (identifier) @property)

; === Calls ===
(call_expr callee: (identifier) @variable.special)
(call_expr method: (identifier) @function.method)
(fanout_item (identifier) @variable.special)

; === References ===
(context_ref) @variable.builtin
(dotted_ident) @variable.member

; === Literals ===
(model_ref) @string.special
(string) @string
(number) @number
(duration) @number
(boolean) @boolean
(null) @constant.builtin

; === Comments ===
(comment) @comment
