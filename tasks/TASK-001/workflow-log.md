# Workflow Log

Task: `TASK-001`

Developer: `Codex with developer-provided project path`

Active work started: `2026-11-19`

## Runtime Readiness

- Doctor result: `DEGRADED`
- Runtime hook status: `claude=PENDING_ACTIVATION; codex=PENDING_ACTIVATION`
- Blocking effect: `none; required browser and docs capabilities passed`

## Role Decisions

| Time | Role | Exact prompt used | Result reviewed | Developer decision | Next action |
| --- | --- | --- | --- | --- | --- |
| 2026-11-19 | `brainstorm` | `Study the existing lang-tutor README, docs/PLAN.md, UX/UI conventions, routes, and progress/curriculum code. Identify one small product feature that closes a documented gap and is useful to a learner. Compare 2–3 interaction approaches, recommend one, and write tasks/TASK-001/brainstorm.md only. Do not edit production code. STOP.` | `tasks/TASK-001/brainstorm.md` | Accepted 182-day Program Calendar because it is explicitly unfinished and reuses existing data. | Manually selected `architect`. |
| 2026-11-19 | `architect` | `Read the calendar brainstorm, existing CourseShell, SectionNav, loadCurriculum, loadProgress, package boundaries, and tests. Decide the smallest route/state/data architecture for a Program Calendar. Write tasks/TASK-001/architecture.md only; do not edit production code; STOP.` | `tasks/TASK-001/architecture.md` | Accepted `/calendar`, existing loaders, local selection state, pure engine helpers, no API/dependency. | Manually selected `requirements-analyst`. |
| 2026-11-19 | `requirements-analyst` | `Turn the approved Program Calendar direction into implementation-ready requirements. Include 182 program days, completed/current/upcoming states, selected-day details, current lesson link, loading/retry, mobile accessibility, one behavior test, and manual browser evidence. Write tasks/TASK-001/requirements.md only and STOP.` | `tasks/TASK-001/requirements.md` | Accepted; scope is bounded and product-relevant. | Manually selected `writing-plans`. |
| 2026-11-19 | `writing-plans` | `Read the confirmed calendar requirements, brainstorm, architecture, existing Course components, curriculum/progress loaders, and scripts. Produce a file-level plan with contracts, tests, verification, and non-goals. Write tasks/TASK-001/implementation-plan.md only and STOP.` | `tasks/TASK-001/implementation-plan.md` | Accepted; no unresolved specialist decision remained. | Manually selected `coder`. |
| 2026-11-19 | `coder` | `Implement only TASK-001 Program Calendar in apps/web and packages/engine. Add /calendar, reuse loadCurriculum/loadProgress, render 182 days with status and selected details, link current day to /lesson, add loading/retry, preserve Program/Progress/bottom nav, and add focused tests. Remove the earlier artificial sessions implementation from the final diff. Run tests/typecheck/build, report failures honestly, and STOP.` | Calendar route and helpers implemented; 67 tests, typecheck, and Webpack build passed. | Accepted; stale `.next` route types were cleaned and the export issue fixed. | Manually selected `code-reviewer`. |
| 2026-11-19 | `code-reviewer` | `Review the bounded Program Calendar implementation against requirements and the current diff. Check product fit, data boundaries, state/error behavior, accessibility, mobile risk, regressions, and tests. Do not edit source. Return PASS or NEEDS-CHANGES with concrete findings and STOP.` | `tasks/TASK-001/review.md` | Accepted `PASS`; no blocking or should-fix findings. | Manually selected `verify`. |
| 2026-11-19 | `verify` | `Run the applicable checks for TASK-001 and perform a real browser check of /calendar at desktop and mobile widths. Report exact commands, results, network/console evidence, failures, and unverified items. Write tasks/TASK-001/verification.md without repairing code or claiming unperformed checks, then STOP.` | `tasks/TASK-001/verification.md` | Accepted; browser, tests, typecheck, build, and known lint gap are recorded truthfully. | Update PR with the product feature. |

## Manual Browser Observation

- Command and URL: `pnpm --filter @polski/web dev` → `http://localhost:3000/calendar/`
- Flow exercised: `open calendar → select day 2 → select current day → inspect lesson link → mobile viewport`
- Observed result: all 182 days rendered; day 1 was current; day 2 details changed to the selected topic; current day exposed `Начать занятие`; mobile viewport rendered the grid.
- Unverified or incomplete behavior: existing lint script needs a separate Next 16 ESLint migration.

## Completion

- Active work finished: `2026-11-19`
- Known limitations: accelerator hooks remain pending activation; no new persistence/API was added because the feature uses existing curriculum and progress data.
