# Workflow Log

Task: `<task-id>`

Developer: `<name>`

Active work started: `<timestamp>`

## Runtime Readiness

- Doctor result: `<READY | DEGRADED | BLOCKED>`
- Runtime hook status: `<status>`
- Blocking effect, if any: `<none or short explanation>`

## Role Decisions

| Time | Role | Exact prompt used | Result reviewed | Developer decision | Next action |
| --- | --- | --- | --- | --- | --- |
| `<time>` | `requirements-analyst` | `<developer-authored prompt>` | `<artifact or short result>` | `<accept, clarify, or correct>` | `<manually selected role or action>` |

Add one row for each role invocation or important correction. Preserve each prompt exactly, but do not copy full role responses into this file.

## Manual Browser Observation

- Command and URL: `<actual command and discovered URL>`
- Flow exercised: `<list -> filter -> create>`
- Observed result: `<what actually happened>`
- Unverified or incomplete behavior: `<none or short list>`

## Completion

- Active work finished: `<timestamp>`
- Known limitations: `<short list>`
