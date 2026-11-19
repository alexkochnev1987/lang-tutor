# Basic Onboarding Pass Criteria

The result is binary. Do not assign a score out of 100.

## Passed

Mark the onboarding **Passed** when all of the following are true:

- the developer manually selected the required roles in the expected lifecycle;
- the developer authored a bounded prompt for every required role and preserved the prompts in the workflow log;
- each prompt named enough context, one role-appropriate outcome, expected evidence, an important boundary, and the STOP condition;
- each role STOPped before the developer selected the next action;
- requirements, plan, review, verification, and workflow log artifacts exist;
- the application starts with a documented repository command;
- the main list, filter, and create flow works end to end;
- the required loading and recoverable request-error states are implemented;
- at least one behavior-level automated test exists and passes when the repository test tooling is available;
- the developer considered the review findings and resolved happy-path blockers;
- verification reports commands, results, failures, and unverified items truthfully;
- the developer recorded one real manual browser observation.

## Repeat A Stage

Ask the developer to repeat the relevant stage when any of these conditions applies:

- a required role was skipped or roles were chained without a developer decision;
- role prompts were copied from an answer key, were not recorded, or repeatedly asked one agent to perform multiple lifecycle roles;
- a prompt omitted enough context or boundaries to make the role output unusable, and the developer did not correct it;
- the application cannot be started;
- the main user flow does not work;
- required task artifacts are absent;
- review findings were ignored without a recorded decision;
- commands, test results, screenshots, or observations were claimed but not produced.

Repeat only the missing or unreliable stage. Do not require the participant to restart the entire onboarding unless the repository cannot be reproduced.

## Feedback That Does Not Block Passing

Record these as improvement recommendations unless they break the required main flow:

- prompt wording, grammar, or style when the role still received clear context and produced the intended bounded result;
- visual polish and design-system consistency;
- tablet or mobile edge cases;
- exhaustive accessibility coverage;
- additional loading, empty, error, and race scenarios;
- architecture refinements and component decomposition;
- broader unit, integration, or browser automation;
- coverage thresholds, CI, deployment, or a public URL;
- full TypeScript `strict` adoption;
- optional roles or artifacts from the Advanced / Production Assessment.

## Doctor Interpretation

Record Doctor's top-level result and runtime hook status. Missing a separate setup receipt is not a failure. A `BLOCKED` result prevents passing only when it makes the required accelerator workflow impossible to complete.

## Evaluator Output

Return:

1. `Passed` or `Repeat: <stage>`;
2. one sentence explaining the decision;
3. up to three concrete strengths;
4. up to three prioritized improvements.

Do not apply the Advanced / Production Assessment rubric to this track.
