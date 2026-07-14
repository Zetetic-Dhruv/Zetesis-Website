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

The clean run separated relationship transfer, workflow routing, function sequencing, and stakeholder-liaison mechanisms. The forwarded run preserved continuity, cost, and accountability as separate constraints. The minimal run still produced concrete documentation, supervised-transfer, and triage mechanisms with named failure conditions. Across runs, the model surfaced implementation tripwires such as stale relationship records, exception growth, ambiguous overlap authority, hidden transition cost, and continued CEO routing. It did not choose the final recommendation. The remediation battery additionally exercised explicit voice-disposition and duplicate-review transitions, bounded weak-field recovery, and server-owned lock invalidation after source edits.

### Cost and model evidence

- Completed workflows: `3`
- Median complete-workflow cost: `$0.196428`
- p95 complete-workflow cost: `$0.248697`
- Total review cost: `$0.635089`
- Every workflow remained below the `$0.75` median and `$2.00` p95 release ceilings.

The frozen remediation request-result evidence and per-call ledger are in `calibration/stage8-live-model-runs-remediation.json`.

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
- Active immutable staging version: `7cffccb0-593c-4195-ae88-f0d09113cd74`.
- A fresh student account completed Ground, Board, and Lock through visible controls against the deployed Worker and real OpenAI API.
- Ground accepted a three-speaker reply and two student bets. The Board surfaced a possible multi-voice signal and a possible duplicate signal as heuristics. The student explicitly marked the voices as one compatible position and kept both bets as distinct.
- The common-field evaluation produced an effective near tie. The student explicitly chose the leading staged-handoff bet before entering Lock.
- On Lock, `Generate PDF` and `Save Version` remained unavailable until the student named the loss bearer, accountability location, reversibility classification, and recovery note, then saved those judgments.
- The deployed flow generated and saved immutable version `bf470467-7142-4745-949e-a36c5742d7da` from the remediated candidate.
- The exact saved PDF is six letter-sized pages. PNG inspection of every page found no clipping, overlap, broken glyph, horizontal rule, orphaned rationale heading, or unreadable section transition.
- The document contains all 144 JSON string leaves in order with 100% token-subsequence coverage, including strings split by page headers.
- The fresh instructor account selected the same student and displayed the same locked recommendation, ranking, loss bearer, accountability, reversibility, saved version, and PDF link.
- Instructor prompts remained absent until `Review prompt history` and a second disclosure confirmation. Four run summaries then appeared closed. Opening the package run exposed its complete system/kernel prompt and module prompt under the selected student only.

## Confidence Containment

The deterministic measurement and sealed metamorphic audit code pass their mechanical tests, but the candidate configuration is deliberately classified as unreleasable until the independent calibration label-quality acceptance is completed. The student UI, package compiler, version storage, single-PDF route, instructor views, and ZIP route all fail closed against candidate confidence provenance. Module 2 ships as `client_no_confidence` only.

## Source Integrity

- Integrated source, harness, test, and remediation-ledger SHA-256: `1acf55696ee009e270bab21986425f658a8a6bd1072a200a83cc5f8660ff660b`.

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
- `calibration/stage8-live-model-runs-remediation.json`
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
