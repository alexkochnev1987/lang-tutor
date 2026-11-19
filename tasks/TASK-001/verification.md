# Verification: TASK-001

## Project-check verdict

`PASS` for the applicable implementation checks below, with the existing lint-script/tooling gap recorded separately.

| Command | Result |
| --- | --- |
| `node ./toolchain/bin/doctor.mjs --json` | `DEGRADED`; browser and docs capabilities pass, hooks are `PENDING_ACTIVATION`, lint capability is detected. |
| `pnpm --filter @polski/engine test` | PASS — 3 files, 67 tests passed. |
| `pnpm --filter @polski/web exec tsc --noEmit --incremental false` | PASS. |
| `pnpm --filter @polski/web exec next build --webpack` | PASS — routes include `/sessions` and `/api/sessions`. |
| `pnpm --filter @polski/web lint` | FAIL — existing script invokes removed/unsupported `next lint` behavior in Next 16 (`Invalid project directory .../apps/web/lint`). No ESLint binary/config is present. |
| `git diff --check` | PASS. |

The default `pnpm --filter @polski/web build` path was also attempted. Turbopack failed in this host with an internal `Operation not permitted` error while creating a process for CSS; this is why the Webpack build was run as a diagnostic fallback. Dev mode ran with Turbopack successfully.

## Browser observation

- Command: `pnpm --filter @polski/web dev`
- URL: `http://localhost:3000/sessions/`
- Adapter: project-owned `node ./toolchain/bin/agent-browser.mjs`, session `onboarding-task-002`.
- Observed: initial list displayed 3 sessions; selecting `Запланированные` reduced the list to 2; entering `Новая разговорная практика` and `2026-12-20T14:00` created the session and displayed it at the top with `Запланировано`.
- Network: GET `/api/sessions` returned `200`; POST `/api/sessions/` returned `201`.
- Console/page errors: no application errors; only the standard React DevTools informational message and HMR log.
- The owned browser session and dev server were closed after the check.

## Unverified items

- No separate visual screenshot matrix was required by Basic Onboarding.
- The lint script remains unverified as a passing check until the project adopts an explicit ESLint setup compatible with Next 16.

## Onboarding result

`Passed` — the required role sequence, artifacts, working list/filter/create flow, behavior tests, review, verification, and real browser observation are present. The remaining lint-script and default-Turbopack host issues are documented improvements rather than hidden claims.

Strengths: bounded scope; honest evidence; existing UI and mock-boundary conventions preserved.

Prioritized improvement: replace the obsolete `next lint` script with an explicit ESLint setup compatible with Next 16.
