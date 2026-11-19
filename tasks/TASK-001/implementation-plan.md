# TASK-001 Implementation Plan

## Current behavior

The existing Next.js app has learning routes and shared themed UI primitives, but no training-sessions workspace. There is no session-specific mock boundary, list state, create form, or behavior test.

## Intended behavior

Add `/sessions` with a client component that loads sessions, exposes All/planned filtering, handles loading and retryable errors, validates a future-dated title form, and prepends a successfully created session. Keep the data boundary replaceable through route handlers.

## Files

- `apps/web/app/api/sessions/route.ts` — deterministic GET/POST mock HTTP boundary with validation and an in-memory session store.
- `apps/web/lib/sessions.ts` — shared session types, filter helper, and form validation helper.
- `apps/web/app/sessions/page.tsx` — route shell using existing `Screen` and `Nav` conventions.
- `apps/web/app/sessions/SessionsWorkspace.tsx` — loading, error/retry, filtering, create form, duplicate-submit prevention, and success insertion.
- `apps/web/app/_components/Nav.tsx` — add a sessions entry without changing existing routes.
- `apps/web/lib/sessions.test.ts` — behavior-level tests for status filtering and create-form validation.
- `tasks/TASK-001/review.md` — verbatim read-only code-review result.
- `tasks/TASK-001/verification.md` — factual verification commands, results, and unverified items.
- `tasks/TASK-001/workflow-log.md` — exact prompts, role outputs, developer decisions, Doctor result, and manual observation.

## Ordered implementation

1. Add session types and pure filtering/validation helpers.
2. Add the route-local mock HTTP boundary with deterministic seed data and server-side validation.
3. Build the `/sessions` route and client workspace using the existing UI package and design tokens.
4. Add the nav entry and focused behavior tests.
5. Run typecheck, lint, the focused test, and build from the repository root.
6. Start the web app and manually exercise list → filter → create; record observed behavior.

## Verification

- `pnpm --filter @polski/web typecheck`
- `pnpm --filter @polski/web lint`
- `pnpm --filter @polski/engine test`
- `pnpm --filter @polski/web build`
- Manual browser check at the discovered local URL.

## Non-goals

No database integration, production backend, session detail view, search, pagination, or deployment is included.
