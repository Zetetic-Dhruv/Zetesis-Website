# Stage 8 Integrated Release Candidate Review Bundle

## Contract

Review the integrated Module 2 release candidate against the approved design specification and Stage 8 contract. Attack semantic utility, lazy-user recovery, model provenance, cost containment, Module 1 regression, migration safety, client-language integrity, and whether any unaccepted confidence output can escape.

A pass requires every findings array and `requiredChanges` to be empty.

## Release Boundary

- Module 1 routes, states, versions, PDFs, authentication, class codes, sessions, and student budgets remain unchanged.
- Module 2 adds the three-screen Ground, Board, and Lock workflow and the Bethany House Recommendation Brief.
- Production model routing remains `gpt-5.4-mini` for reconciliation and option generation and `gpt-5.5` for evaluation and package prose.
- The candidate confidence engine remains contained. No confidence score, band, configuration, or confidence language is released to students or client artifacts because the independent label-quality gate has not been accepted.
- Instructor prompt traces remain available only under the selected student's closed Prompts panel.

## Live Semantic Battery

Three fresh, complete local workflows used the real OpenAI API and separate student accounts:

1. A clean Bethany reply with continuity, ownership, and sequencing constraints.
2. A forwarded reply with two explicitly attributed Bethany voices and distinct concerns.
3. A minimal lazy reply containing only three short priority lines.

Each workflow exercised:

- class-code registration and D1 session persistence;
- Ground with two student alternatives;
- `m2_reconcile`;
- explicit human resolution of heuristic duplicate signals;
- `m2_suggest_options`;
- explicit human admission of one generated provisional option;
- `m2_evaluate_bets`;
- deterministic ranking and the explicit server-owned frame, set, selection, loss-bearer, accountability, reversibility, and held-constant transitions;
- `m2_package`;
- instructor retrieval of all four scoped prompt records.

All 12 calls used provider `openai`; no fallback occurred.

### Semantic findings closed during the battery

- Verbatim client lines wrapped in quotation marks are now verified after removable quote normalization.
- Context facts can ground a proposed option without pretending they are inherited student traces.
- Generated candidates must use a genuinely different mechanism from the current field.
- Criterion scores are schema-bounded decimal fit values from 0 to 1.
- Heuristic near-duplicates have explicit keep/remove recovery actions on the Board.
- A generated option remains provisional until an explicit human action admits it.
- Unattributed short priorities cannot trigger multi-voice review; at least two explicitly attributed speakers are required.
- Every client document string is compiled through a final language boundary that removes classroom, student-process, product-process, and unaudited confidence language without changing the locked recommendation.
- Offline fallback option generation now proposes distinct, grounded mechanisms instead of duplicating the live field.
- Generic workspace saves cannot promote a generated option or forge lock judgments. Those changes are accepted only through the dedicated admission and human-judgment endpoints.
- Package readiness is checked before model access, so an incomplete lock is rejected with `409` without spending student tokens.
- The human-judgment endpoint accepts clean `confirmed` set acceptance only while the server-owned coverage status is `covered`. A named `gap` rejects that value with `409` and can be resolved only through the distinct `confirmed_after_review` transition, which records the review and clears the gap.
- The frozen ledger distinguishes the model's raw reconciliation output from the state admitted by deterministic post-processing. Voice status is `none -> none` for the clean and minimal cases and `possible -> possible` only for the explicitly attributed multi-voice case.
- Reconciliation provenance is admitted against the union of inherited high-value trace IDs and the exact context-fact IDs supplied to the call. The refreshed live ledger shows every valid returned course/public ID retained in applied state, while a deterministic regression proves an invented ID is removed.
- Client-language compilation now preserves singular agreement after provenance substitutions and repairs malformed advisory-team possessives at the final prose boundary. Regression tests cover both forms.

### Utility judgment

The clean run separated relationship transfer, workflow routing, function sequencing, and stakeholder-liaison mechanisms. The forwarded run preserved continuity, cost, and accountability as separate constraints. The minimal run still produced concrete documentation, supervised-transfer, and triage mechanisms with named failure conditions. Across runs, the model surfaced implementation tripwires such as stale relationship records, exception growth, ambiguous overlap authority, hidden transition cost, and continued CEO routing. It did not choose the final recommendation.

### Cost and model evidence

- Completed workflows: `3`
- Median complete-workflow cost: `$0.237971`
- p95 complete-workflow cost: `$0.254133`
- Total 12-call review cost: `$0.695807`
- Reconciliation: 3 calls, 4,548 input tokens, 2,380 output tokens, `$0.014123`
- Option generation: 3 calls, 3,995 input tokens, 1,426 output tokens, `$0.009414`
- Bet evaluation: 3 calls, 8,606 input tokens, 14,470 output tokens, `$0.477130`
- Package prose: 3 calls, 18,478 input tokens, 3,425 output tokens, `$0.195140`

The frozen raw request-result evidence and per-call ledger are in `calibration/stage8-live-model-runs.json`.

## Deterministic Evidence

- Additive migration rehearsal against the frozen production D1 export: pass.
- Module 2 baseline, measurement, independent sealed audit, and confidence-containment suites: pass.
- Complete Module 1 and Module 2 offline integration suite: pass.
- Module 1 and Module 2 PDF generation, text extraction, complete structured-field rendering, and PNG render checks: pass.
- Worker, review harness, live harness, rendered student script, and rendered instructor script syntax checks: pass.
- `git diff --check`: pass.
- No horizontal rules in the recommendation PDF: pass.
- No client artifact confidence claim: pass.
- No student, course, classroom, prompt, model, module, or app process language in the compiled client brief: pass.
- Full admitted candidate field, supporting evidence, contrary evidence, criteria, distinctions, and tripwires remain in one PDF: pass.

## Deployed Render Evidence

- Isolated Cloudflare staging Worker: `zetesislabs-decision-manifold-studio-staging`.
- Isolated staging D1: `zetesis_decision_manifold_studio_staging`.
- Reviewed HTTPS host: `https://m2-staging.zetesislabs.com`.
- Active immutable staging version: `7a16645f-d307-48f0-9ad5-8616cf9cd196`.
- A fresh browser account completed Ground, Board, and Lock through visible controls against the deployed Worker and real OpenAI API.
- The Board visibly rendered two generated options as provisional. The reviewer admitted one with `Add to live comparison`; the app then required a fresh common-field evaluation.
- The deployed clean Board showed a consistent frame and covered set as ready, with no separate keep-frame or review-set blocker. `Take ... to Lock` persisted the frame, set, and selected bet together. D1 readback confirmed `frameConfirmation=confirmed` and `setCompletenessConfirmation=confirmed`.
- Drift, thin-frame, unresolved-frame, and comparison-gap states retain explicit keep/revise or gap-review hard stops. Executable regression tests cover all four hard states.
- A model-produced near tie still required the human to choose which of the two leading bets to carry before the combined Lock action.
- On Lock, `Generate PDF` and `Save Version` were disabled until the loss bearer, accountability location, and reversibility judgment were supplied and saved.
- The deployed flow generated and saved corrected version 3. D1 contains the immutable Module 2 version and its 61,572-character base64 PDF artifact; versions 1 and 2 remain downloadable.
- The exact saved PDF is eight letter-sized pages. PNG inspection of all pages found no clipping, overlap, broken glyph, horizontal rule, or unreadable section transition.
- The document contains every one of 217 substantive JSON string leaves after PDF punctuation normalization, with zero missing leaves.
- The instructor surface displayed one student, one locked recommendation, one saved version, the selected bet, ranking, loss bearer, accountability, reversibility, and download link.
- Instructor prompts remained absent until `Review prompt history` and a second disclosure confirmation. Six run summaries then appeared closed; no raw prompt body was dumped into the student page.

## Confidence Containment

The deterministic measurement and sealed metamorphic audit code pass their mechanical tests, but the candidate configuration is deliberately classified as unreleasable until the independent calibration label-quality acceptance is completed. The student UI, package compiler, version storage, single-PDF route, instructor views, and ZIP route all fail closed against candidate confidence provenance. Module 2 ships as `client_no_confidence` only.

## Source Integrity

- Integrated source, harness, test, live-evidence, and staging-config SHA-256: `b1720223007ae9919620b8d1679146181eb4079f6b1c3589a442eed29c5981a0`.

## Files In Scope

- `src/module2-engine.js`
- `src/module2-package.js`
- `src/module2-pdf.js`
- `src/module2-page.js`
- `src/instructor-page.js`
- `src/instructor-queries.js`
- `src/studio.js`
- `scripts/module2-live-semantic-smoke.mjs`
- `scripts/run-stage-review.mjs`
- `test/module2-baseline.mjs`
- `test/local-offline-smoke.mjs`
- `package.json`
- `calibration/stage8-live-model-runs.json`
- `wrangler.staging.toml`

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
