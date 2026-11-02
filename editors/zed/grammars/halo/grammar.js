/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * Tree-sitter grammar for Halo DSL
 * Mirrors grammars/Halo.g4 (the source of truth).
 */

const commaSep1 = (rule) => seq(rule, repeat(seq(",", rule)), optional(","));

const SOFT_KEYWORDS = ["policy", "tool", "store", "schema", "agent", "pipeline", "equips", "requires", "system", "context", "yield", "listen", "loop", "as", "each", "in", "else"];

module.exports = grammar({
  name: "halo",

  word: ($) => $.identifier,

  extras: ($) => [/\s/, $.comment],

  rules: {
    program: ($) => repeat(choice($.policy_decl, $.tool_decl, $.store_decl, $.schema_decl, $.agent_decl, $.pipeline_decl)),

    // Identifiers plus keywords usable as names (named-arg keys, methods, context paths).
    _name: ($) => choice($.identifier, ...SOFT_KEYWORDS.map((k) => alias(k, $.identifier))),

    dotted_ident: ($) => prec.right(seq($.identifier, repeat(seq(".", $._name)))),

    // === Policy ===
    policy_decl: ($) => seq("policy", field("name", $.identifier), ":", $.policy_rule, repeat(seq("&", $.policy_rule))),

    policy_rule: ($) => seq(field("name", $.identifier), $.call_args),

    // === Tool & Store ===
    tool_decl: ($) => seq("tool", field("name", $.identifier), ":", field("provider", $.identifier), $.call_args),

    store_decl: ($) => seq("store", field("name", $.identifier), ":", field("provider", $.identifier), $.call_args),

    // === Schema ===
    schema_decl: ($) => seq("schema", field("name", $.identifier), "{", repeat(seq($.schema_field, optional(","))), "}"),

    schema_field: ($) => seq(field("name", $._name), ":", $.type_ref),

    // === Agent ===
    agent_decl: ($) =>
      seq(
        repeat($.directive),
        "agent",
        field("name", $.identifier),
        "[",
        field("model", choice($.model_ref, $.string, $.dotted_ident)),
        repeat(seq(",", $.model_param)),
        optional(","),
        "]",
        repeat($.agent_modifier),
      ),

    model_param: ($) => seq(field("key", $._name), ":", $._value),

    agent_modifier: ($) => choice(seq("equips", commaSep1($.identifier)), seq("requires", commaSep1($.identifier)), seq("system", $.string)),

    // === Directives ===
    directive: ($) => seq("@", field("name", alias($._name, $.directive_name)), optional($.directive_value)),

    directive_value: ($) => seq("(", optional(commaSep1(choice($._literal, $.model_ref, $.dotted_ident))), ")"),

    // === Pipeline ===
    pipeline_decl: ($) =>
      seq(
        repeat($.directive),
        "pipeline",
        field("name", $.identifier),
        "(",
        optional(commaSep1($.param)),
        ")",
        optional(seq("->", $.type_ref)),
        ":",
        $.pipeline,
      ),

    param: ($) => seq(field("name", $.identifier), ":", field("type", $.type_ref)),

    type_ref: ($) => prec.right(seq($.identifier, repeat(seq(".", $.identifier)), optional(seq("<", commaSep1($.type_ref), ">")))),

    // === Pipeline ===
    pipeline: ($) => prec.right(choice(seq(field("head", $._expression), repeat($.pipeline_stage)), repeat1($.pipeline_stage))),

    pipeline_stage: ($) =>
      choice(
        seq($.pipe_operator, $.call_expr, optional($.binding)),
        seq($.gate_operator, $.condition),
        seq($.gate_operator, "{", commaSep1($.branch_arm), "}", optional($.binding)),
        seq($.interrupt_operator, "yield", $.call_args, optional($.binding)),
        seq($.fanout_operator, "{", commaSep1($.fanout_item), "}", optional($.binding)),
        seq($.fanout_operator, $.each_clause, "=>", $.call_expr, optional($.binding)),
        seq($.listen_operator, "listen", "(", $._call_value, ")", optional($.binding)),
        seq($.loop_operator, "loop", "(", field("agent", $.identifier), ",", $.string, optional(seq(",", commaSep1($.call_arg))), ")", optional($.binding)),
      ),

    pipe_operator: (_) => "|>",
    gate_operator: (_) => "|?",
    interrupt_operator: (_) => "|!",
    fanout_operator: (_) => "|*",
    listen_operator: (_) => "~>",
    loop_operator: (_) => "|<>",

    binding: ($) => seq("as", field("name", $._name)),

    // `(cond) => Call(...)` or `else => Call(...)`
    branch_arm: ($) => seq(choice(seq("(", $._cond, ")"), "else"), "=>", $.call_expr),

    // `each(item in list, concurrency: 2)`
    each_clause: ($) => seq("each", "(", field("item", $.identifier), "in", $._call_value, optional(seq(",", commaSep1($.call_arg))), ")"),

    fanout_item: ($) => seq(choice($.call_expr, $.identifier), optional($.binding)),

    // `Mind.method(...)`, `Tool.method(...)`, `System.Print()`, or `OtherStream(...)`
    call_expr: ($) => seq(field("callee", $.identifier), optional(seq(".", field("method", $._name))), $.call_args),

    call_args: ($) => seq("(", optional(commaSep1($.call_arg)), ")"),

    call_arg: ($) => choice(seq(field("name", $._name), ":", $._call_value), $._call_value),

    _call_value: ($) => choice($._literal, $.model_ref, $.context_ref, $.list, $.dotted_ident),

    list: ($) => seq("[", optional(commaSep1($._call_value)), "]"),

    _value: ($) => choice($._literal, $.model_ref, $.dotted_ident),

    _literal: ($) => choice($.string, $.number, $.duration, $.boolean, $.null),

    _expression: ($) => choice($._literal, $.context_ref, $.dotted_ident),

    context_ref: ($) => prec.right(seq("context", repeat(seq(".", $._name)))),

    // === Gate conditions ===
    condition: ($) => seq("(", $._cond, ")", optional("=>")),

    _cond: ($) => choice($.binary_condition, $.not_condition, $.comparison, $._operand),

    binary_condition: ($) =>
      choice(
        prec.left(1, seq(field("left", $._cond), field("operator", "||"), field("right", $._cond))),
        prec.left(2, seq(field("left", $._cond), field("operator", "&&"), field("right", $._cond))),
      ),

    not_condition: ($) => prec(3, seq("!", $._cond)),

    comparison: ($) => prec.left(4, seq($._operand, $.comparison_op, $._operand)),

    _operand: ($) => choice($.paren_condition, $._literal, $.context_ref, $.dotted_ident),

    paren_condition: ($) => seq("(", $._cond, ")"),

    comparison_op: (_) => choice("==", "!=", ">=", "<=", ">", "<"),

    // === Tokens ===
    // Model ids contain '-' or '/': gemini-3-1-pro, openai/gpt-4o-mini, together/meta-llama/Llama-3.1-8B
    model_ref: (_) => token(prec(1, seq(/[a-zA-Z_][a-zA-Z0-9_.]*/, repeat1(seq(/[-\/]/, /[a-zA-Z0-9_.]+/))))),

    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    string: (_) =>
      token(
        choice(
          seq('"""', repeat(choice(/[^"]/, /"[^"]/, /""[^"]/)), '"""'),
          seq('"', repeat(choice(/[^"\\\n]/, /\\./)), '"'),
          seq("'", repeat(choice(/[^'\\\n]/, /\\./)), "'"),
        ),
      ),

    duration: (_) => token(prec(2, /[0-9]+(ms|[smhd])/)),

    number: (_) => token(seq(optional("-"), /[0-9]+/, optional(seq(".", /[0-9]+/)))),

    boolean: (_) => choice("true", "false"),

    null: (_) => "null",

    comment: (_) => token(choice(seq("//", /[^\n]*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"))),
  },
});
