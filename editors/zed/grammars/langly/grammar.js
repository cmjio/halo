/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * Tree-sitter grammar for Langly DSL
 * Updated to match grammars/Langly.g4 v2
 */
module.exports = grammar({
  name: "langly",

  extras: ($) => [/\s/],

  rules: {
    program: ($) => repeat(choice($.guardrail_decl, $.tool_decl, $.memory_decl, $.mind_decl, $.stream_decl, $.comment)),

    // === Guardrail ===
    guardrail_decl: ($) => seq(
      "guardrail",
      field("name", $.identifier),
      ":",
      $.guardrail_rule,
      repeat(seq("&", $.guardrail_rule)),
    ),

    guardrail_rule: ($) => seq(
      field("name", $.identifier),
      "(",
      optional($.guardrail_args),
      ")",
    ),

    guardrail_args: ($) => seq($.guardrail_arg, repeat(seq(",", $.guardrail_arg))),

    guardrail_arg: ($) => choice(
      $.model_ref,
      $.dotted_ident,
      $.string,
      $.number,
    ),

    // === Tool ===
    tool_decl: ($) => seq(
      "tool",
      field("name", $.identifier),
      ":",
      field("provider", $.identifier),
      "(",
      optional($.tool_args),
      ")",
    ),

    tool_args: ($) => seq($.tool_arg, repeat(seq(",", $.tool_arg))),

    tool_arg: ($) => choice(
      $.string,
      $.number,
      $.dotted_ident,
    ),

    // === Memory ===
    memory_decl: ($) => seq(
      "memory",
      field("name", $.identifier),
      ":",
      field("provider", $.identifier),
      "(",
      optional($.memory_args),
      ")",
    ),

    memory_args: ($) => seq($.memory_arg, repeat(seq(",", $.memory_arg))),

    memory_arg: ($) => choice(
      $.string,
      $.number,
      $.dotted_ident,
      seq(field("key", $.identifier), ":", choice($.string, $.number, $.dotted_ident)),
    ),

    // === Mind ===
    mind_decl: ($) => seq(
      repeat($.directive),
      "mind",
      field("name", $.identifier),
      "[",
      $.model_config,
      "]",
      optional($.mind_modifiers),
    ),

    mind_modifiers: ($) => repeat1($.mind_modifier),

    mind_modifier: ($) => choice(
      seq("equips", $.equips_list),
      seq("requires", $.requires_list),
    ),

    equips_list: ($) => seq($.identifier, repeat(seq(",", $.identifier))),

    requires_list: ($) => seq($.identifier, repeat(seq(",", $.identifier))),

    model_config: ($) => seq($.model_ref, repeat(seq(",", $.model_param))),

    model_ref: ($) => token(seq(
      optional("/"),
      /[a-zA-Z_][a-zA-Z0-9_]*/,
      repeat1(seq(choice("-", "/"), /[a-zA-Z0-9_-]+/)),
    )),

    model_param: ($) => seq(
      field("key", $.identifier),
      ":",
      $.value,
    ),

    // === Stream ===
    stream_decl: ($) => seq(
      repeat($.directive),
      "stream",
      field("name", $.identifier),
      $.stream_signature,
      ":",
      $.pipeline,
    ),

    stream_signature: ($) => seq(
      "(",
      optional($.param_list),
      ")",
      "->",
      $.type_ref,
    ),

    param_list: ($) => seq($.param, repeat(seq(",", $.param))),

    param: ($) => seq(
      field("name", $.identifier),
      ":",
      field("type", $.type_ref),
    ),

    type_ref: ($) => $.identifier,

    // === Directives ===
    directive: ($) => seq(
      "@",
      $.directive_name,
      optional($.directive_value),
    ),

    directive_name: ($) => choice("timeout", "shadow", "checkpoint", "retry"),

    directive_value: ($) => seq(
      "(",
      optional($.directive_args),
      ")",
    ),

    directive_args: ($) => seq(
      $.directive_arg,
      repeat(seq(",", $.directive_arg)),
    ),

    directive_arg: ($) => choice(
      $.identifier,
      $.number,
      $.string,
      $.model_ref,
      $.duration,
    ),

    duration: ($) => token(seq(/[0-9]+/, choice("s", "m", "h", "d"))),

    // === Pipeline ===
    pipeline: ($) => prec.left(repeat1($.pipeline_stage)),

    pipeline_stage: ($) => choice(
      seq($.pipe_operator, $.call_expr),
      seq($.gate_operator, $.condition),
      seq($.interrupt_operator, $.yield_expr),
      seq($.fanout_operator, "{", $.fanout_stages, "}"),
      seq($.listen_operator, $.listen_expr),
      $.expression,
    ),

    pipe_operator: ($) => "|>",

    gate_operator: ($) => "|?",

    // Grammar Review Fix #2: optional => arrow after condition
    condition: ($) => seq("(", $.condition_expr, ")", optional("=>")),

    condition_expr: ($) => seq(
      $.context_ref,
      $.comparison_op,
      $.value,
    ),

    context_ref: ($) => choice(
      seq("context", ".", "data", optional($.context_path)),
      seq("context", ".", "meta", optional($.context_path)),
      seq("context", ".", "trace"),
    ),

    // Grammar Review Fix #3: grouped (".", IDENTIFIER)+ for deep traversal
    context_path: ($) => repeat1(seq(".", $.identifier)),

    comparison_op: ($) => choice("==", "!=", ">", "<", ">=", "<="),

    interrupt_operator: ($) => "|!",

    yield_expr: ($) => seq(
      "yield",
      "(",
      optional($.yield_args),
      ")",
    ),

    yield_args: ($) => seq($.yield_arg, repeat(seq(",", $.yield_arg))),

    yield_arg: ($) => choice(
      seq(field("key", $.identifier), ":", choice($.dotted_ident, $.string, $.number)),
      $.string,
      $.dotted_ident,
      $.number,
    ),

    fanout_operator: ($) => "|*",

    fanout_stages: ($) => seq($.fanout_stage, repeat(seq(",", $.fanout_stage))),

    fanout_stage: ($) => choice(
      $.call_expr,
      $.identifier,
    ),

    listen_operator: ($) => "~>",

    listen_expr: ($) => seq(
      "listen",
      "(",
      $.listen_target,
      ")",
    ),

    listen_target: ($) => choice(
      $.dotted_ident,
      $.context_ref,
    ),

    // === Expression and calls ===
    expression: ($) => choice(
      $.identifier,
      $.string,
      $.number,
      $.boolean,
      $.context_ref,
    ),

    call_expr: ($) => seq(
      $.identifier,
      ".",
      $.identifier,
      $.call_args,
    ),

    // Grammar Review Fix #1: named and positional args
    call_args: ($) => seq("(", optional($.call_arg_list), ")"),

    call_arg_list: ($) => seq($.call_arg, repeat(seq(",", $.call_arg))),

    call_arg: ($) => choice(
      seq(field("name", $.identifier), ":", $.call_arg_value),
      $.call_arg_value,
    ),

    call_arg_value: ($) => choice(
      $.string,
      $.number,
      $.boolean,
      $.dotted_ident,
      $.context_ref,
    ),

    value: ($) => choice(
      $.identifier,
      $.string,
      $.number,
      $.boolean,
      $.model_ref,
    ),

    // === Dotted identifier ===
    dotted_ident: ($) => seq(
      $.identifier,
      repeat(seq(".", $.identifier)),
    ),

    // === Atoms ===
    identifier: ($) => token(/[a-zA-Z_][a-zA-Z0-9_]*/),

    string: ($) => token(choice(
      seq('"', repeat(choice(token.immediate(/[^"\\]+/), token.immediate(/\\./))), '"'),
      seq("'", repeat(choice(token.immediate(/[^'\\]+/), token.immediate(/\\./))), "'"),
    )),

    number: ($) => token(seq(
      optional("-"),
      /[0-9]+/,
      optional(seq(".", /[0-9]+/)),
    )),

    boolean: ($) => token(choice("true", "false")),

    comment: ($) => token(seq("//", /[^\n]*/)),
  },
});
