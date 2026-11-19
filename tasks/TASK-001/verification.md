# Verification: TASK-001 Program Calendar

## Project-check verdict

`PASS` for applicable implementation checks, with the existing lint-script/tooling gap recorded separately.

| Command | Result |
| --- | --- |
| `pnpm --filter @polski/engine test` | PASS — 3 files, 67 tests passed. |
| `pnpm --filter @polski/web exec tsc --noEmit --incremental false` | PASS. |
| `pnpm --filter @polski/web exec next build --webpack` | PASS — `/calendar` is included and deleted `/sessions` is absent. |
| `git diff --check` | PASS. |
| `pnpm --filter @polski/web lint` | Not a valid passing check in the current repo — existing `next lint` is incompatible with Next 16 and no ESLint binary/config is present. |

## Browser observation

- Command: `pnpm --filter @polski/web dev`
- URL: `http://localhost:3000/calendar/`
- Adapter: project-owned `node ./toolchain/bin/agent-browser.mjs`, session `calendar-feature`.
- Desktop: Course navigation showed `Календарь`; all 182 program days rendered, day 1 was current, completion was `0%`, and `Начать занятие` was exposed.
- Interaction: selecting day 2 changed details to `Глагол «быть» в настоящем` with `Впереди`; selecting day 1 restored current-day details and lesson action.
- Mobile: viewport `390×844` rendered the same grid and current-day action without a page error.
- Network: `/api/state/` and curriculum, grammar, levels, vocabulary, and morphology JSON requests returned `200`.
- Console/page errors: no application errors; only standard React DevTools/HMR informational logs.
- The owned browser session and dev server were closed after the check.

## Onboarding result

`Passed` — role sequence, product requirements, architecture, implementation, tests, review, verification, and browser observation are recorded.

Known limitation: lint tooling needs a separate Next 16 ESLint migration and is not silently claimed as passing.
