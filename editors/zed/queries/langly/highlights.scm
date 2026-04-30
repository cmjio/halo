; ========================================
; Langly Tree-Sitter Highlight Queries
; (for Zed queries directory)
; ========================================

"mind" @keyword
"stream" @keyword
"guardrail" @keyword
"tool" @keyword
"memory" @keyword
"equips" @keyword
"requires" @keyword
"->" @operator
(pipe_operator) @operator
(gate_operator) @operator
(interrupt_operator) @operator
(fanout_operator) @operator
(listen_operator) @operator
"yield" @function.builtin
"listen" @function.builtin
(directive) @attribute
"[" @punctuation.bracket
"]" @punctuation.bracket
"(" @punctuation.bracket
")" @punctuation.bracket
"{" @punctuation.bracket
"}" @punctuation.bracket
"," @punctuation.delimiter
"." @punctuation.delimiter
":" @punctuation.delimiter
"&" @operator
(mind_decl name: (identifier) @type.definition)
(stream_decl name: (identifier) @function.definition)
(guardrail_decl name: (identifier) @constant)
(tool_decl name: (identifier) @constant)
(memory_decl name: (identifier) @constant)
(type_ref) @type
(param name: (identifier) @variable.parameter)
(model_ref) @string.special
(model_param key: (identifier) @variable.parameter)
(identifier) @variable
(call_expr (identifier) @variable.object)
(call_expr (identifier) @function.method)
(dotted_ident) @variable.member
(context_ref) @variable.builtin
(string) @string
(number) @constant.numeric
(boolean) @constant.builtin
(comment) @comment
