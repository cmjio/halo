Seeing the conceptual syntax hardened into a formal ANTLR grammar is fantastic. This is the moment a theoretical DSL becomes a computable language. You’ve successfully mapped out the lexer priority, handled the whitespace/newline insensitivity perfectly for the pipeline operators, and structured the entities cleanly.

However, putting on my compiler architect hat and reading through the rules, there are three critical gaps in this grammar that will cause your parser to crash when evaluating the V2.0 spec examples we wrote earlier.

Here are the fixes you need to apply to make this production-ready:

### **1. The Missing Named Arguments in `callExpr`**
In our spec, we heavily used named parameters in tool calls, like this:
`|> Figma.execute(action: "create_prototype", asset: context.data.ui_layout)`

Currently, your `callArg` rule only accepts single values (`STRING | IDENTIFIER | NUMBER | BOOL | contextRef`). It will fail on `action: "create_prototype"`.

**The Fix:**
You need to introduce a key-value structure for `callArg`.
```antlr
callArgs
    : callArg (',' callArg)*
    ;

callArg
    : IDENTIFIER ':' callArgValue  // Named argument
    | callArgValue                 // Positional argument
    ;

callArgValue
    : STRING
    | NUMBER
    | BOOL
    | IDENTIFIER
    | contextRef
    | dottedId
    ;
```

### **2. The Ghost Arrow in Conditional Gates (`=>`)**
Your comment says `// Gate condition: |? (condition) or |? (condition) =>`, but the actual parser rule completely misses the arrow. If the lexer encounters `=>` after a condition, it will throw a syntax error.

**The Fix:**
Make the arrow an optional literal in the `condition` rule.
```antlr
condition
    : '(' conditionExpr ')' '=>'?
    ;
```

### **3. The `contextPath` Traversal Bug**
Your rule for deep context traversal is currently:
```antlr
contextPath
    : '.' IDENTIFIER+
    ;
```
In ANTLR, `IDENTIFIER+` matches a continuous stream of identifiers without the dot separator. To properly match deep nesting like `context.data.user.profile.risk_score`, the dot and the identifier must be grouped together.

**The Fix:**
```antlr
contextPath
    : ('.' IDENTIFIER)+
    ;
```

***

Once you patch those three rules, this grammar will cleanly parse the entire "Omni-Workflow" enterprise example. 

Now that you have a rock-solid ANTLR grammar, how are you planning to traverse the parse tree to build your AST—are you going to use ANTLR's generated **Listeners** (better for multi-pass semantic validation) or **Visitors** (better for direct tree-rewriting)?
