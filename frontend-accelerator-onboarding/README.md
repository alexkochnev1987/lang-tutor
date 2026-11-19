# Basic Accelerator Onboarding

This is the default learning track for first-time Frontend Accelerator users.

Do not use files from `frontend-accelerator-assessment/` during this task. That directory contains a separate Advanced / Production Assessment.

## Goal

Learn to guide one small frontend task through the accelerator's manual workflow:

```text
developer selects a role
-> isolated agent performs one skill
-> agent reports and STOPs
-> developer reviews the result and selects the next role
```

Success means controlling and checking the workflow. It does not mean producing a production-ready application.

The developer must also formulate a basic, bounded prompt for every selected role. This onboarding does not provide copy-paste role prompts.

## Timebox

Use up to six hours of active work. Initial environment installation is outside the timebox.

Stop adding scope when the required user flow works. Spend remaining time on review and verification.

## Before Starting

1. Use a prepared React and TypeScript repository with the Frontend Accelerator installed.
2. Run Runtime Doctor once:

   ```powershell
   node ./toolchain/bin/doctor.mjs --json
   ```

3. Record only Doctor's top-level result and relevant runtime hook status in `workflow-log.md`.
4. Read [`TASK.md`](TASK.md) and [`PASS_CRITERIA.md`](PASS_CRITERIA.md).

A separate setup receipt is not an onboarding submission requirement. A `BLOCKED` Doctor result stops the exercise only when it prevents the role workflow from running.

## Required Role Sequence

Run these roles one at a time:

1. `requirements-analyst`
2. `writing-plans`
3. `coder`
4. `code-reviewer`
5. `verify`

After every role:

1. record the exact prompt used in `workflow-log.md`;
2. read the role output;
3. decide whether to accept it, clarify it, or request a correction;
4. record the decision in `workflow-log.md`;
5. manually select the next role.

The role may recommend a next action, but it must not start another role automatically.

Use `architect`, `api-integration`, `ui-designer`, `test-generator`, `debugger`, or `browser-verify` only when the task actually needs them. Optional roles do not affect the onboarding result.

## How To Prompt A Role

Write each role prompt yourself using this structure:

```text
Context and sources -> bounded outcome -> expected artifact or evidence -> important constraints -> STOP
```

A sufficient onboarding prompt answers five questions:

1. **What context should the role read?** Name the task ID, task file, confirmed artifact, or bounded diff.
2. **What outcome is needed?** Ask for one result owned by that role.
3. **Where should durable output go?** Name the task artifact when the role is allowed to write one.
4. **What must the role not do?** State the important boundary, such as no production edits during review or verification.
5. **Where must it stop?** Require the role to report its result and STOP without starting the next role.

Do not ask one role to perform the whole lifecycle. Do not paste implementation instructions before requirements and planning exist. A prompt may be short when its context and boundary are still clear.

For read-only `code-reviewer`, save the returned response verbatim as `tasks/<task-id>/review.md`; do not rewrite its verdict. For `verify`, explicitly request factual commands, exit results, failures, and unverified items in `tasks/<task-id>/verification.md`.

## Expected Artifacts

The accelerator roles should create or provide the content for:

```text
tasks/<task-id>/requirements.md
tasks/<task-id>/implementation-plan.md
tasks/<task-id>/review.md
tasks/<task-id>/verification.md
tasks/<task-id>/workflow-log.md
```

The developer does not manually author or improve the role artifacts. When a read-only role cannot write its result, save the role response verbatim in the named file. The developer is responsible for reviewing the artifacts and ensuring that they contain real results.

Start `workflow-log.md` from [`workflow-log.template.md`](workflow-log.template.md). Keep it concise: one row per role invocation or important developer decision is enough.

## Linear Checklist

- [ ] Run Doctor and record the short result.
- [ ] Write and run a bounded prompt for `requirements-analyst`.
- [ ] Review the requirements and correct material misunderstandings.
- [ ] Write and run a bounded prompt for `writing-plans`.
- [ ] Review the plan and confirm that it stays inside the task scope.
- [ ] Write and run a bounded prompt for `coder`.
- [ ] Write and run a bounded prompt for `code-reviewer`.
- [ ] Consider every review finding; fix critical happy-path issues or record why a finding remains.
- [ ] Start the app and manually exercise the main list, filter, and create flow once.
- [ ] Write and run a bounded prompt for `verify`.
- [ ] Confirm the submission against `PASS_CRITERIA.md`.

## When A Skill Is Wrong

Do not accept an incorrect or irrelevant result silently.

1. Explain the concrete problem to the same role once and request a correction.
2. Review the corrected result.
3. If the limitation remains, record it in `workflow-log.md` and continue with a reasonable developer decision.

Detecting and correcting agent output is part of the learning objective.

## Submission

Submit:

- the working repository;
- the task artifacts listed above;
- the commands and actual results recorded by `verify`;
- one short manual browser observation covering the main flow;
- known limitations that remain after review.

No deployment, public URL, pull request, CI setup, full browser matrix, or advanced assessment evidence is required.
