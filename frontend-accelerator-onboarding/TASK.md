# Onboarding Task: Training Sessions Workspace

## Objective

Build a small frontend workspace that lets a trainer view, filter, and create training sessions.

The exercise exists to practise the accelerator workflow. Keep product and technical scope deliberately small.

## Required User Flow

The user can:

1. open the workspace and see sessions loaded from a mock API;
2. filter sessions by one status;
3. open a create form;
4. create a session with a title and future date/time;
5. see the created session in the list.

## Required Behavior

### Sessions list

- Show the session title, status, and start date/time.
- Provide an `All` option and one status filter.
- Show a loading state while the request is pending.
- Show one understandable, recoverable request-error state.

### Create session

- Require a trimmed title between 3 and 80 characters.
- Require a date and time in the future.
- Prevent duplicate submission while the request is pending.
- Show a useful validation message.
- Add the successfully created session to the visible list.

### Mock boundary

- Keep mock data behind an HTTP client or equivalent replaceable request boundary.
- Use the repository's existing mock mechanism. If none exists, MSW or another conventional HTTP mock is acceptable.
- Do not implement a backend service.

### Essential test

Add at least one behavior-level automated test for the main flow. It may cover filtering or successful creation.

### Manual check

Start the application and exercise the list, filter, and create flow once in a browser. Record what was actually observed. The `browser-verify` role and screenshots are optional.

## Constraints

- Use the repository's existing framework, package manager, scripts, and test stack.
- Do not rewrite unrelated code or configuration.
- Do not add features outside the required flow until onboarding is complete.
- Report incomplete behavior honestly instead of claiming an unperformed check.

## Explicitly Optional

The following are not required for onboarding:

- session details, drawers, or deep links;
- search or multiple filters;
- pagination;
- a complete API contract or scenario matrix;
- desktop/mobile screenshot sets;
- exhaustive responsive and accessibility validation;
- full test coverage;
- CI, deployment, or a public URL;
- strict TypeScript migration or unrelated refactoring.
