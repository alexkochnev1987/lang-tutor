# TASK-001: Program Calendar

## Goal

Add a useful learner-facing calendar for the existing 182-day Polish B1 program. A learner must be able to see overall completion, distinguish completed/current/upcoming days, inspect a selected day, and start today's lesson from the calendar.

## Acceptance criteria

1. The Course section exposes a Calendar route without removing the existing Program or Progress routes.
2. The calendar loads the existing curriculum and progress sources; it does not invent a second persistence or API boundary.
3. It shows all curriculum days with stable program-day numbers.
4. Completed, current, and upcoming days are visually and semantically distinguishable.
5. A learner can select any day and see its topic, week, phase, theme, expected outcome, and status.
6. The current day offers a link to start `/lesson/`; future and completed days do not pretend to be actionable current work.
7. The calendar shows completion percentage and completed-day count.
8. Loading and recoverable error states are visible, with a retry action for load failure.
9. The compact grid remains usable on mobile and uses accessible labels/pressed/current state.
10. At least one behavior-level automated test covers calendar status or completion calculation.
11. The calendar is manually checked in a browser, including selecting a day and starting the current lesson link.

## Scope and constraints

- Use the existing Next.js, React, TypeScript, pnpm, Tailwind, `@polski/ui`, curriculum loader, and progress loader.
- Keep the feature inside `apps/web` and `packages/engine`; do not rewrite unrelated learning screens.
- Do not add a database table, API route, external dependency, or date-based scheduling model.
- Preserve the existing Program and Progress screens and the existing bottom navigation.
- No editing completed history, drag-and-drop planning, reminders, search, or deployment is required.

## Decisions

- The route is `/calendar`, linked as a third tab inside the existing Course section.
- Program-day numbering is the stable identity; calendar dates are deliberately not invented.
- The current day is the only day with a start-lesson action.

## Readiness

The task is implementation-ready. Existing `loadCurriculum()` and `loadProgress()` resolve the required data contract.
