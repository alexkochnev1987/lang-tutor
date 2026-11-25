# Independent blind review of the reading pilot

The pilot has 57 passages and 285 questions. The six packages cover days 1–50, 51, 52, 53, 64, 78, 92 and 99.

Each reviewer started with a fresh conversation and received the passages, target levels, questions and options from a single package. Reviewers solved each item, quoted the evidence and scored the Polish, CEFR suitability, question quality, clarity, topic coherence and vocabulary. Answers were compared with the author keys after review. The raw reviewer files are named `review-01.json` through `review-06.json`. Each round's `comparison.json` records weighted scores, input hashes and checks against the keys.

The score uses 25% naturalness, 20% CEFR suitability, 20% question quality, 20% unambiguity, 10% coherence and 5% vocabulary. The cutoff applies to each passage. A passage also needs five key matches, five exact evidence quotes, five questions that test the intended skills, distractor plausibility of at least 75/100 per item and zero ambiguous items or critical issues.

## Round 1

Six GPT-6.2 Astra reviewers assessed the packages from commit `2409121e94d58376a713f5274333c009b6d7f424`.

The mean was **85.29/100**. Nine passages scored 90 or higher and zero met all acceptance criteria. All 285 answers matched the author keys. Two questions were flagged as ambiguous, 32 missed their target skill and 235 scored below 75 for distractor plausibility. The author keys followed a rotating A/B/C pattern, limiting the value of answer agreement as independent evidence of question quality.

Day 26 Q4 inferred a prior attitude toward jazz from an unfamiliar repertoire. Day 28 Q3 assumed rain had started before the family moved indoors, though the text mentioned only dark clouds at that point.

## Revisions

The revision changed the prose in 51 passages, revised 10 titles and changed the wording or option content of 263 questions. It addressed retrieval items labeled as inference, implausible distractors, unsupported assumptions and dense or awkward Polish. Options were reordered across all 285 items using passage ID, question ID and option text. The revised positions are A: 81, B: 102, C: 102. The original position matched the position three items later in 273 of 282 comparisons. After reordering, that happened in 94 of 282.

## Round 2

Four new GPT-6.2 Sol reviewers covered all six revised packages. The session reached its new-agent limit after four, so two of those reviewers each assessed one additional package. All four started without prior project context, and none had seen the original version, edit history or other reviews for any package assigned to them. The round uses a different reviewer model, so the score change combines changes to the material with differences in reviewer judgment.

| Measure | Round 1 | Round 2 |
| --- | ---: | ---: |
| Passages reviewed | 57 | 57 |
| Questions reviewed | 285 | 285 |
| Weighted mean | 85.29 | 90.47 |
| Individual passage scores ≥ 90 | 9 | 35 |
| Passages meeting every criterion | 0 | 4 |
| Ambiguous questions | 2 | 3 |
| Questions below 75 for distractor plausibility | 235 | 145 |
| Questions missing the intended skill | 32 | 5 |
| Passages with critical findings | 39 | 10 |
| Exact evidence quotes | 285 | 285 |

All 282 options selected in Round 2 matched the keys. The three ambiguous questions (day 22 Q4, day 25 Q5, day 64 Q4) received no choice. Both ambiguities found in Round 1 were resolved. Remaining issues include a schedule without the start time required by its question, a question about a camera the narrator has yet to buy and a bottle-return scenario with two workable plans. See the JSON reports for all findings.

## Author handoff

The overall mean reached 90, while 22 passages still scored below 90 and only days 43, 46, 49 and 51 met every criterion. Hold expansion until the pilot passes. The [authoring prompt](authoring-prompt.md) is ready for a separate author and starts with a batch of up to 10 new lessons after the pilot clears the gate.

Give the [reviewer prompt](reviewer-prompt.md) and one blind JSON package to a fresh reviewer. Once the reviewer submits the JSON, compare answers with the author keys using the acceptance criteria above.
