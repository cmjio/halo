---
name: release-notes
description: Turn a list of commits, merged pull requests or a changelog diff into release notes written for users, grouped by impact, with breaking changes and upgrade steps first. Use when preparing a release or a changelog entry.
---

# Release notes

Release notes are for the people who use the software, not the people who wrote it. Say what changed for them.

## Steps

1. Read every commit or pull request. Drop the ones users can't notice: refactors, test-only changes, CI, dependency bumps without a visible effect, typo fixes in comments.
2. Merge entries that describe the same change.
3. Sort what's left into groups, in this order, omitting empty groups:
   - **Breaking changes**: anything that can make an existing setup fail after upgrading. Each one gets a "To upgrade:" line with the exact step.
   - **New**: features and new options.
   - **Improved**: faster, clearer, more compatible.
   - **Fixed**: bugs, described by the symptom the user saw ("Exports no longer drop the last row"), not the cause.
   - **Security**: fixes with security impact; link the advisory if there is one.
4. Write each entry as one sentence in the present tense, starting with what the user can now do or what now works. Add the PR or issue number at the end when available: `(#123)`.
5. Credit outside contributors by handle if the input names them.

## Output

Markdown, starting with `## <version> — <date>` when they are given. Lead with a one-sentence summary of the release when there is a headline change. Never invent a version number, date, or a change that isn't in the input.
