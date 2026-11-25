# TASK-001 Implementation Plan

## Current behavior

The product already has a 182-day curriculum, a roadmap at `/program`, and aggregate progress at `/progress`. The learner cannot inspect all day statuses in one compact view or select a day for its details. `docs/PLAN.md` explicitly lists the calendar as unfinished product work.

## Intended behavior

Add `/calendar` within `CourseShell`. Load `loadCurriculum()` and `loadProgress()` in parallel. Render a 182-cell program-day grid, selected-day details, completion summary, loading/retry states, and a current-day link to `/lesson/`.

## Files

- `apps/web/app/calendar/page.tsx` — route shell using the existing Course section.
- `apps/web/app/calendar/CalendarWorkspace.tsx` — data loading, retry, grid, selection, status styling, and day details.
- `packages/engine/src/course-calendar.ts` — pure status and completion calculations.
- `packages/engine/src/course-calendar.test.ts` — behavior tests for status and completion.
- `packages/engine/src/index.ts` — export the calendar helpers.
- `apps/web/app/_components/SectionNav.tsx` — add Calendar to the existing Course tabs.
- `apps/web/app/_components/CourseShell.tsx` — accept the Calendar route.
- `apps/web/messages/ru.json` — add the Calendar label.
- `tasks/TASK-001/brainstorm.md` — product alternatives and recommendation.
- `tasks/TASK-001/architecture.md` — data/routing/state boundary decision.
- `tasks/TASK-001/review.md` — read-only code review result.
- `tasks/TASK-001/verification.md` — factual commands, browser evidence, and gaps.
- `tasks/TASK-001/workflow-log.md` — prompts and manual role decisions.

## Ordered implementation

1. Add pure calendar status/stat helpers and tests.
2. Add the route and client workspace with existing curriculum/progress boundaries.
3. Integrate the route into Course navigation without changing bottom navigation.
4. Run tests, typecheck, build, and browser verification at desktop and mobile widths.
5. Record review and verification evidence.

## Verification

- `pnpm --filter @polski/engine test`
- `pnpm --filter @polski/web exec tsc --noEmit --incremental false`
- `pnpm --filter @polski/web exec next build --webpack`
- `git diff --check`
- Manual browser check of `/calendar`, day selection, current lesson link, and mobile viewport.

## Non-goals

No database/API changes, calendar-date scheduling, editing history, reminders, search, or new dependencies.
