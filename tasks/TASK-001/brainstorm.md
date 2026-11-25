# Product Brainstorm: Program Calendar

## Problem

The app already computes a 182-day curriculum and exposes completed day numbers in progress, but the learner can only see the current roadmap/progress summaries. They cannot answer "where am I in the program?" or inspect the sequence of completed and upcoming days in one place.

## Options

1. **Full program calendar in the Course section** — show all 182 days grouped by week, with completed/current/upcoming states and a selected-day detail panel. High user value, uses existing curriculum/progress data, no new persistence.
2. **Rolling 14-day agenda** — show only the current two weeks. Lower implementation cost, but hides the long-term program shape and does not satisfy the documented 182-day calendar gap.
3. **Calendar integrated into the existing roadmap** — add status markers only to `/program`. Smallest change, but the roadmap is already a dense phase view and lacks a focused day-detail interaction.

## Recommendation

Choose option 1. It directly addresses the documented product gap, keeps the existing roadmap intact, and gives the learner a durable orientation tool without inventing a new backend model or dependency.

## States

- Loading while curriculum and progress load.
- Recoverable error with retry.
- Completed days are visually distinct.
- The current day is highlighted and links to `/lesson`.
- Future days remain inspectable but clearly marked as upcoming.
- Selected day shows its topic, phase, theme, expected outcome, and status.

## Success criteria

The learner can open `/calendar`, understand completion at a glance, select any program day, and start the current lesson from the calendar. The existing progress and roadmap screens remain unchanged.
