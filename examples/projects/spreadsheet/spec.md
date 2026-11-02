# Spreadsheet engine

Build a small spreadsheet engine in TypeScript for Bun. `index.ts` must export a
class `Sheet`:

```ts
const s = new Sheet();
s.set("A1", "5");          // set a cell's raw text
s.set("A2", "=A1*2");
s.get("A2");               // 10   (number | string | null)
s.getRaw("A2");            // "=A1*2"
s.toCSV("A1:B2");          // "5,\n10,"
```

## Cells

- References are a column of letters and a row number: `A1`, `B12`, `AA3`. They
  are case-insensitive (`a1` is `A1`).
- Raw `""` (or a cell never set) is empty: `get` returns `null`.
- Raw text that is a number (`"3"`, `"-2.5"`, `" 4 "`) is that number: anything
  non-blank that `Number(text.trim())` reads as a finite number.
- Raw text starting with `=` is a formula. Anything else is a string.

## Formulas

- Numbers, cell references, string literals in double quotes (`"hi"`).
- Operators, lowest precedence first:
  1. comparisons `=` `<>` `<` `>` `<=` `>=`, giving `1` (true) or `0` (false)
  2. `&` string concatenation (numbers become text with `String(n)`)
  3. `+` `-`
  4. `*` `/`
  5. `^` power, right-associative (`2^3^2` is 512)
  6. unary minus
- Parentheses group.
- Ranges like `A1:B3` (inclusive rectangle) are allowed only as function arguments.
- Functions (names are case-insensitive): `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`
  over numbers and ranges; `ABS(x)`; `ROUND(x, digits)` (halves round away from zero, and `digits` can be negative); `IF(cond, a, b)`, which
  evaluates only the branch it picks (a condition is true when it is a non-zero
  number).
- An empty cell is `0` in arithmetic and `""` in `&`. In `SUM`, `AVERAGE`, `MIN`,
  `MAX` and `COUNT`, empty and string cells in a range are skipped. `MIN`/`MAX` of
  no numbers is `0`.
- A string in arithmetic (`+ - * / ^`, unary minus, `ABS`, `ROUND`) is `#VALUE!`.

## Errors

A cell whose value is an error holds one of these strings:

| Error      | When |
|------------|------|
| `#DIV/0!`  | division by zero, or `AVERAGE` of no numbers |
| `#VALUE!`  | a string where a number is needed |
| `#NAME?`   | an unknown function |
| `#ERROR!`  | a formula that doesn't parse |
| `#CYCLE!`  | the cell is part of (or depends on) a reference cycle |

An error in any cell a formula uses (directly or through a range) makes the
formula's value that error; when several are involved, the first one reached
left to right wins. `IF` only passes on an error from the branch it picks.

## Recalculation

Setting a cell updates every cell that depends on it, directly or not. Breaking a
cycle (by setting one of its cells to a value) makes the other cells compute again.

## CSV

`toCSV(range)` gives one line per row joined with `\n`, cells joined with `,`.
Numbers use `String(n)`, strings and errors as they are, empty cells as nothing.
