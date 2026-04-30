; ========================================
; Langly Tree-Sitter Indentation Queries
; ========================================

; Increase indent after these nodes opening
; (we match the opening bracket/paren/colon)
[
  "("
  "["
] @indent

; Decrease indent on closing
[
  ")"
  "]"
] @outdent

; Pipeline stages indent after the stream body colon
(stream_decl
  ":"
  . (_) @indent.begin)

; Each pipeline stage increases indent
(pipeline_stage) @indent.begin
