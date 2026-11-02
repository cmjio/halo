; ========================================
; Halo Tree-Sitter Indentation Queries
; ========================================

[
  (call_args)
  (list)
  (condition)
  (directive_value)
] @indent

(pipeline_stage "{" "}" @end) @indent

[
  ")"
  "]"
  "}"
] @outdent

; Pipeline stages are indented under the pipeline signature
(pipeline_decl (pipeline) @indent)
