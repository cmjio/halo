---
name: incident-postmortem
description: Write a blameless incident postmortem from alerts, logs, chat transcripts and timelines, with impact, a timestamped timeline, root cause, contributing factors and owned action items. Use after an outage or production incident.
---

# Incident postmortem

A postmortem explains how the system let this happen, so it happens less. It never blames a person.

## Gather

From the material you were given, collect:
- When the problem started, when it was detected, when it was mitigated, when it was resolved (all with timezone).
- Who and what was affected, and how much: users, requests, revenue, data. Use the numbers in the material; if there are none, say "not measured".
- What responders did and when.

## Write these sections

1. **Summary**: three sentences. What broke, for whom, for how long.
2. **Impact**: numbers and duration. Separate "detected" from "started".
3. **Timeline**: a table of `time | event`, from the first cause to resolution. Include detection and every change responders made.
4. **Root cause**: the technical chain of events. Keep asking "why did that happen?" until you reach something a team can change (a missing check, an unsafe default, a gap in testing or alerting). Stop at systems and processes, never at "a person made a mistake".
5. **Contributing factors**: what made it worse or slower to fix (late alert, unclear runbook, missing dashboard).
6. **What went well**: things worth keeping.
7. **Action items**: a table of `action | type (prevent / detect / mitigate) | owner | priority`. Each must be specific and checkable ("Add an alert when queue depth > 10k for 5m"), not "be more careful". Leave owner as `TBD` if unknown.

## Tone

Neutral and factual. Describe actions by role ("the on-call engineer"), not by name, unless the input asks otherwise. Mark anything you inferred rather than read as *(inferred)*.
