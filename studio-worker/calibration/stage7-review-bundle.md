# Stage 7 Review Bundle

## Contract

Review the Module 2 instructor workroom against the approved Stage 7 contract and `../platform/Module2_Design_Spec_v0.95.pdf`.

Attack cross-student leakage, workflow confusion, prompt dumping, system-prompt omission, stale artifacts, class aggregates, QA-record pollution, mass-download correctness, and desktop/mobile usability. A pass requires every findings array to be empty.

## Release Boundary

- Instructor route: `/instructor` locally and `https://instructor.platform.zetesislabs.com` in production.
- The public platform page contains no instructor link.
- The instructor uses the existing admin account and class membership.
- Confidence remains omitted because the sealed label-quality gate did not pass.

## Student Scoping

The class roster returns one record per real student membership in the instructor's class. Each card shows separate Module 1 and Module 2 progress/version counts.

The selected student is loaded through four class-authorized endpoints:

- Module 1 current draft;
- Module 2 current draft and inheritance;
- Module 1 versions;
- Module 2 versions.

Prompts are fetched only after the instructor opens the selected student's Prompts card and confirms the complete-input/system-instruction disclosure. They are filtered by both selected student and selected workflow. Changing student clears all prompt caches. Changing workflow closes the prompt panel and switches to that workflow's cache. Loaded runs remain individually closed until selected; the UI never dumps the complete stack into one open table.

The instructor shell and instructor API are served only on `instructor.platform.zetesislabs.com` in production. Local development must opt in with `LOCAL_DEV_MODE=true` and use an explicit localhost route. The override cannot authorize the public platform host or an unknown host, even if accidentally enabled.

## Reserved QA Records

Addresses under the IANA-reserved `example.com` domain are retained in D1 for development audit but excluded from:

- the instructor class roster;
- class student/report counts;
- Module 2 cohort aggregation;
- Module 1 and Module 2 class ZIP exports.

They therefore do not appear as students or distort cohort decisions. Direct class-authorized artifact and prompt APIs remain ownership-scoped.

## Module Views

Module 1 exposes:

- current step and saved-version count;
- current working read;
- complete mutable draft behind `Open raw draft`;
- saved version content behind a disclosure and PDF download;
- Module 1 prompt history, closed by default.

Module 2 exposes:

- current step and saved-version count;
- inherited source, frame, and collapsible traces;
- locked recommendation, loss bearer, accountability, and reversibility;
- ordered comparison field and pairwise reasons;
- current recommendation summary with complete JSON behind a disclosure;
- complete mutable draft behind a disclosure;
- saved recommendation versions and PDFs;
- Module 2 prompt history, closed by default.

Every individually opened prompt run includes system/kernel prompt, module prompt, request/context JSON, response JSON, model/provider, token counts, cost, timestamp, and guardrail status.

## Cohort And Downloads

The class sidebar shows deterministic Module 2 cohort counts:

- total students;
- started students;
- students with locked selections;
- students with saved recommendation versions;
- exact selected-bet name frequencies.

The rendered cohort line includes the denominator explicitly, for example `5 total students · 5 started · 5 locked · 5 saved`.

The header offers separate Question briefs ZIP and Recommendation briefs ZIP controls. Module 2 ZIP generation applies artifact release classification and rerenders saved document JSON through the current PDF renderer.

## Browser Exercise

A fresh local admin account exercised the live workroom against retained local D1 data.

Observed facts:

- Before the reserved-record exclusion, 78 `@example.com` smoke accounts appeared; after the query fix, the roster contained only real-domain test students.
- Selecting a Module 2 student and switching tabs showed independent progress, inheritance, ranking, locks, current brief, saved versions, and current draft.
- Confirming and opening Module 2 Prompts produced exactly `m2_reconcile`, `m2_suggest_options`, `m2_evaluate_bets`, and `m2_package` for the selected fresh smoke student.
- Every prompt row included the system/kernel prompt and module prompt.
- With prompts closed, no prompt table exists in the DOM.
- `Review prompt history` first displayed the selected-student disclosure and required `Continue to prompt records`; no prompt data was loaded before confirmation.
- After confirmation, 10 prompt runs appeared as individually collapsed disclosures and zero runs were open by default.
- Desktop `1440 x 900`: document width `1440`, no horizontal overflow.
- Mobile `390 x 844`: document width `390`; the class and student workroom remains single-column with no document overflow.
- Mobile prompt disclosure: one opened run used a `285px` single-column grid; all four prompt/context/output blocks fit at `283px` with no document overflow.
- Raw drafts, saved content, inherited traces, and complete package JSON are collapsed by default.

The in-app screenshot backend timed out; browser evidence is DOM/accessibility and exact layout measurement rather than a frozen screenshot.

## Deterministic Evidence

- `node --check` for instructor page, instructor queries, and Worker: pass.
- Rendered instructor client script extraction and syntax check: pass.
- `npm run test:module2`: pass.
- `npm run test:offline`: pass.
- `npm run test:pdf`: pass.
- `git diff --check`: pass.
- Cross-class student, Module 2 detail, prompts, versions, convergence, and usage-reset requests return 404: pass.
- Student-card Module 2 progress and version count: pass.
- Cohort selected-bet aggregation: pass.
- Workflow-filtered prompt histories with system/module prompts: pass.
- Module 2 ZIP content and reserved-QA exclusion: pass.
- Saved Module 2 PDF remains downloadable after draft staleness and model-access block: pass.
- Production instructor host policy allows the instructor host and rejects the public platform and unknown hosts: pass.
- Local instructor access requires the explicit development-only runtime variable: pass.
- The local override cannot authorize public or unknown hosts: pass.
- Prompt history rejects unauthenticated and student sessions; class-scoped admin access passes: pass.
- Prompt disclosure requires explicit confirmation and each run remains independently collapsed: pass.
- Cohort denominator is visible beside started, locked, and saved counts: pass.
- Admin-owned question and recommendation artifacts cannot inflate student class totals: pass.

## Review Transport

- The original Codex subagent transport failed before producing a verdict because the workspace agent-credit pool was exhausted.
- The independent review therefore uses the project-side OpenAI Responses API with the required `gpt-5.6-luna` model and low reasoning effort.
- The specification, frozen bundle, source diff, response schema, and zero-finding pass rule are unchanged. No fallback model is allowed.

## Source Integrity

- Stage 7 source and review-harness SHA-256: `2bf38e51eed21a5ed0408fd9cb7232427e4e4ecd050d29c20f5edb497a122735`.

## Files In Scope

- `src/instructor-page.js`
- `src/instructor-queries.js`
- instructor routes, aggregates, and ZIP queries in `src/studio.js`
- `test/module2-baseline.mjs`
- `test/local-offline-smoke.mjs`
- `scripts/run-stage-review.mjs`
- `package.json`

## Required Response

Return JSON with:

- `verdict`
- `specCoverage`
- `utilityFindings`
- `qualityFindings`
- `correctnessFindings`
- `evidence`
- `requiredChanges`

Use `verdict: "pass"` only when every findings array and `requiredChanges` is empty.
