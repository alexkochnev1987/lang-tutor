# Polish reading corpus (drafts, not live content)

## Scope

The course contains 182 study days. The initial draft covers days 1–50 (50 original passages, 250 questions). Seven additional source-based drafts cover days 51, 52, 53, 64, 78, 92 and 99 (57 passages / 285 questions total). All 132 remaining-day topics are in scripts/reading-topic-plan.json; 125 passages still need authoring. See the [blind review reports](../reading-reviews/README.md) for the current acceptance status. Day 1 is diagnostic in the current curriculum; a reading passage for that day is available but does not imply replacing the diagnostic. Drafts live under scripts/reading-drafts, outside the runtime content pack. Nothing here changes the existing lesson or production deployment.

Target length bands are teaching design choices, not certified CEFR ratings:
- Days 1–28: A1, 80–120 words.
- Days 29–84: A2, 130–200 words.
- Days 85–182: B1, 200–350 words.

Exactly five skills per text: main idea, specific detail, cause/effect, inference, vocabulary in context. Each question has three options, a single proposed key, an explanation and a literal evidence quote.

## Validation and review workflow

Run from the repo root (Node 20+):

```sh
node scripts/reading-pipeline.mjs validate --from 1 --to 50
```

This checks coverage, word counts, IDs, exact quote/key matches, distinct options, skill coverage and exact duplicates. It does not establish pedagogical quality or CEFR accuracy.

For independent model evaluation, configure the review provider directly in the shell (do not commit or paste keys). The endpoint must support the OpenAI-compatible chat-completions JSON-object mode. Choose a model genuinely independent of the author, preferably another model family. Optional base URL defaults to the OpenAI API:

```sh
export READING_REVIEW_BASE_URL="https://your-provider.example/v1"
export READING_REVIEW_MODEL="your-independent-model"
# Set READING_REVIEW_API_KEY securely in the environment.
node scripts/reading-pipeline.mjs review --from 1 --to 10
```

The reviewer first solves questions without keys, then evaluates the complete text and item set in a separate request. Approval requires 5/5 blind matches, exact quoted evidence, no ambiguity or critical issues, passing per-item criteria, weighted score >=90. Reports include a SHA-256 content fingerprint and the model identity. Rejected drafts should be corrected; a changed fingerprint creates a new review file. Review reports are evidence of model evaluation, not a native-speaker or official exam certification. The [blind pilot review](../reading-reviews/README.md) used isolated reviewers and separate reports under `scripts/reading-reviews/`. The command above writes export-compatible per-text reports.

## Extend to remaining days

See the [authoring prompt](../reading-reviews/authoring-prompt.md) for the independent author handoff. Start expanding after the pilot passes the blind review criteria.

For API-based authoring, configure a separate author model using READING_AUTHOR_MODEL, READING_AUTHOR_API_KEY and optional READING_AUTHOR_BASE_URL. This uses current curriculum theme, rule IDs and vocabulary backlog; generation is limited to explicit batches of at most ten to control cost. Review each batch before expanding.

```sh
node scripts/reading-pipeline.mjs author --from 51 --to 60
node scripts/reading-pipeline.mjs validate --from 51 --to 60
node scripts/reading-pipeline.mjs review --from 51 --to 60
```

Once all days pass independent review, validate the entire range and export to a **new** file for integration:

```sh
node scripts/reading-pipeline.mjs validate --from 1 --to 182
node scripts/reading-pipeline.mjs export --from 1 --to 182 --out reading-reviewed.json
```

The exporter refuses missing, rejected or stale reports and never overwrites the live reading pack. Integration should select by curriculum day (not modulo), add paragraph-aware pagination, preserve the passage for reopening during questions, and use the existing answer/result persistence. Do not merge into production before review and UI verification.

## Source-grounded authoring

`scripts/reading-sources.json` records checked source links and factual summaries. `scripts/reading-topic-plan.json` assigns a unique topic to each remaining curriculum day. Source-backed drafts carry per-item provenance. The author uses verified facts when assigned; other passages must use clearly fictional examples, not invented real-world claims. Official examination samples are format references only. Do not copy third-party teaching texts without confirming reuse rights for the specific item. The registry is a snapshot of reviewed facts, not a live feed or a complete license audit. Update facts before publication if rules or services change.
