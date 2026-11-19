PASS

Review surface: the Program Calendar feature in `apps/web` and `packages/engine`, compared with the current branch base. The previous artificial sessions feature was removed from the final diff.

No blocking or should-fix findings.

Strengths:

- The feature closes an explicit product gap from `docs/PLAN.md` and reuses existing curriculum/progress boundaries instead of adding a parallel API or persistence model.
- Completed, current, and upcoming statuses are calculated in pure tested code and exposed through accessible labels, `aria-current`, and `aria-pressed`.
- Loading/retry, selected-day details, current-lesson action, mobile seven-column layout, and existing Course navigation are all covered.

Residual note:

- The repository's existing `@polski/web` lint script uses obsolete `next lint` behavior in Next 16 and has no ESLint binary/config. This is pre-existing project tooling, not a defect introduced by the calendar.
