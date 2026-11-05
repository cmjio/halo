---
name: write-tests
description: Write focused automated tests for a function, module or bug fix, in the project's existing test framework and style. Use when asked to add tests, cover a change, or reproduce a bug with a failing test.
---

# Writing tests

Good tests pin down behavior someone relies on. They fail when that behavior breaks and pass otherwise.

## Before writing

1. Find the existing tests (look for `*.test.*`, `*_test.*`, `test/`, `tests/`, `spec/`). Copy their framework, imports, file naming and helper style. Do not introduce a new test framework.
2. Read the code under test and list its behaviors: the normal case, each branch, each error it raises, and its edge cases (empty, zero, negative, very large, unicode, missing fields, duplicates).
3. For a bug fix, first write the test that reproduces the bug. It must fail without the fix.

## Writing

- One behavior per test, named for the behavior: `"returns null when the user has no email"`, not `"test 3"`.
- Arrange, act, assert. Keep setup short; move repeated setup into a helper only after the third copy.
- Assert on outputs and visible effects, not on private internals or call counts, unless the call itself is the behavior.
- No real network, clock or randomness: use the project's mocks, fixed dates and seeded values.
- Each test cleans up what it creates (temp files, databases, servers).
- Prefer a few precise assertions over snapshotting a whole object.

## After writing

Run the tests. Every new test should pass against the current code, except a bug-reproduction test written before its fix. If a test fails because the code is wrong, say so: do not weaken the test to make it pass.

Report: the files you added or changed, what each test covers, and the test command and its result.
