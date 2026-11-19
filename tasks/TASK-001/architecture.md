# Architecture Decision: Program Calendar

## Decision

Add a client route at `/calendar` inside the existing `CourseShell`. Load curriculum content through `loadCurriculum()` and user completion state through `loadProgress()`. Keep selection state local to the page; do not add a database table, API route, or dependency.

## Boundaries

- `apps/web/app/calendar/page.tsx` owns the route shell.
- `apps/web/app/calendar/CalendarWorkspace.tsx` owns loading, retry, selection, and rendering.
- `packages/engine/src/course-calendar.ts` owns pure status/stat calculations and is covered by Vitest.
- Existing `loadCurriculum()` and `loadProgress()` remain the data boundaries.
- `SectionNav` adds a third Course tab; bottom navigation is not expanded.

## Rejected alternatives

- A new API or persistence model is unnecessary because all required data already exists.
- A date-based calendar would imply a course-start scheduling contract that the current curriculum does not expose consistently; program-day numbering is the stable existing identity.
- A new UI dependency is not justified; existing cards, rows, stacks, meters, and theme tokens are sufficient.

## Risks and mitigations

- 182 cells can become dense on mobile; use a seven-column compact grid with short day labels and a separate selected-day detail card.
- Future days must not look completed; status styling and explicit accessible labels distinguish them.
- Content/progress failures must remain recoverable; provide retry and avoid partial false success.
