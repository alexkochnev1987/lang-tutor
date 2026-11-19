# TASK-001: Training Sessions Workspace

## Goal

Add a small training-sessions workspace to the existing Next.js application. A trainer must be able to load sessions from a replaceable mock HTTP boundary, filter by one status, and create a future-dated session that immediately appears in the list.

## Acceptance criteria

1. The workspace route renders a sessions list loaded through an HTTP client boundary.
2. Each session shows title, status, and localized start date/time.
3. The list provides `All` and one status filter; selecting a status only shows matching sessions.
4. A loading state is visible while the list request is pending.
5. A recoverable request-error state explains the problem and offers retry.
6. The create form requires a trimmed title from 3 through 80 characters.
7. The create form requires a date/time later than the current time.
8. The submit control prevents duplicate submissions while the request is pending.
9. Validation errors are understandable and tied to the relevant controls.
10. A successful creation adds the returned session to the visible list.
11. Mock data remains behind a replaceable request boundary; no backend service is added.
12. At least one behavior-level automated test covers filtering or successful creation.
13. The main list, filter, and create flow is manually exercised in a browser and recorded honestly.

## Scope and constraints

- Use the existing Next.js, React, TypeScript, pnpm, Tailwind, and `@polski/ui` stack.
- Keep the feature inside `apps/web` and do not rewrite unrelated learning screens.
- Use a route-local mock API implementation rather than a database or backend service.
- Preserve the existing navigation and theme conventions; add only the smallest useful entry point.
- No details page, search, pagination, authentication, deployment, or advanced responsive matrix is required.

## Assumptions and decisions

- The selected Application Root is `apps/web` inside the repository root.
- The new route is `/sessions` so the current `/` learning flow remains unchanged.
- The initial list contains deterministic in-memory mock sessions and the create endpoint returns the created record.
- The required single status filter is `planned`.

## Readiness

The task is implementation-ready. No unresolved UI, architecture, API, or dependency decision blocks the bounded flow.
