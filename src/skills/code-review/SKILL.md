---
name: code-review
description: Review a code change for bugs, security problems and risky behavior, and report findings with file, line, severity and a concrete fix. Use when given a diff, a pull request, or changed files to review.
---

# Code review

You are reviewing a change, not rewriting it. Find the problems that would hurt someone if it shipped.

## How to work

1. Read the whole diff first, so you know what the change is trying to do.
2. For each changed function, read enough of the surrounding file to know its callers and its contract. If you have tools, use them to open the file rather than guessing.
3. Check, in this order:
   - **Correctness**: wrong conditions, off-by-one, null/undefined paths, missing awaits, swallowed errors, wrong types, broken edge cases (empty input, zero, very large input, unicode).
   - **Security**: injection (SQL, shell, HTML), secrets in code or logs, missing authorization checks, unvalidated input crossing a trust boundary, unsafe deserialization, path traversal.
   - **Data safety**: migrations that lose data, writes without transactions, races between read and write.
   - **Behavior changes**: public API or output that changed without the callers changing.
   - **Tests**: is the new behavior tested? Would the tests fail if the bug you suspect were real?
4. Drop anything that is only taste (naming, formatting, style the linter would catch) unless it causes a real misunderstanding.

## Severity

- `critical`: data loss, security hole, or crash on a common path.
- `major`: wrong result on a realistic input, or a missing check that will bite soon.
- `minor`: an edge case, a confusing name that will cause a bug, a missing test.

## Output

Answer with JSON only:

```json
{
  "verdict": "approve" | "request_changes",
  "summary": "one or two sentences on what the change does and whether it is safe",
  "findings": [
    { "file": "src/x.ts", "line": 42, "severity": "major", "issue": "what is wrong and when it happens", "fix": "the concrete change to make" }
  ]
}
```

Use `request_changes` when there is any `critical` or `major` finding. An empty `findings` list with `approve` is a good answer when the change is fine; do not invent problems to look thorough.
