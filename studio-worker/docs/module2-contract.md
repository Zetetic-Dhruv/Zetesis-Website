# Module 2 Authoritative Build Contract

This contract resolves dependencies left provisional in the v0.95 design. The approved Module 2 implementation plan is authoritative where this document and the design draft differ.

## Module 1 Inheritance

Module 2 reads Module 1 from an immutable snapshot. It never mutates `workspace_states` or a saved Module 1 report.

Source precedence:

1. Latest saved Module 1 `report_versions` row for the workspace.
2. Current mutable `workspace_states` row.
3. Empty source when neither exists.

The inherited contract is:

- `frame`: approved `oneSentence.reframeText`, otherwise the current reframe text, otherwise blank.
- `highValueTraces`: non-KK items selected for the brief or tagged High, preserving IDs, text, provenance, evidence IDs, and Bethany-facing phrasing.
- `solutions`: explicit solution candidates when present. Module 1 currently has no canonical solution field, so free-text solutions enter Module 2 separately and are never inferred from questions.
- `sourceType`: `saved_version | current_draft | absent`.
- `sourceVersionId`: saved report version ID or blank.
- `snapshotAt`: source creation or update timestamp.

Full, partial, and absent examples are frozen in `test/fixtures/module1-inheritance-contract.json`.

## Confidence Semantics

The approved confidence function supersedes the v0.95 placeholder. It combines evidence-against resistance, ranking stability, fog independence, and failure-mode coverage through the approved weighted geometric mean. Exponents and Low/Moderate/High thresholds remain configurable until the sealed calibration gate freezes `confidence-config-v1`.

No numeric score or band is exposed to students, instructors, or PDFs until the independent holdout audit passes. Hard stops return no score and no band. Confidence always means robustness of the recommendation's current position, never probability of Bethany House success.

## Cohort Convergence

The instructor app will show a Module 2 cohort convergence summary in Stage 7. It is observational only. The platform will not inject artificial variance or assign a different recommendation. Instructors may use the summary to assign divergent weightings or ask teams to defend different bets.

## Client Data Handling

- Student access is restricted to the authenticated user's class membership and personal workspace.
- Instructor access requires an admin membership and remains scoped to the selected student and selected panel.
- Pasted replies, extracted lines, prompts, outputs, drafts, and versions are stored in D1. PDFs use R2 when bound and D1 fallback otherwise.
- OpenAI requests are server-side only and request no provider-side storage. API keys, password material, session tokens, and plaintext class codes are never written to prompts, D1 trace payloads, or browser responses.
- Instructor trace visibility is intentional for this course and includes system prompt, module prompt, request, response, model, usage, cost, timestamp, and guardrail status.
- Abuse and relevance rejections are logged with zero model cost.
- Application logs must not print request bodies, prompt bodies, passwords, class codes, session cookies, or PDF bytes.
- v1 has no user-facing deletion workflow or configurable retention period. Class retirement blocks model access but preserves course records and prior deliverables. Deletion and retention policy are explicit post-v1 governance work, not silently implied capabilities.

## Rollback

Before production migration, export D1 and record the active Worker version. If production smoke checks fail:

1. Redeploy the recorded immutable Worker version with `wrangler versions deploy`.
2. Do not reverse the additive migration. Old code ignores the new tables and `workflow_key` column.
3. Verify Module 1 login, workspace load/save, one fixture model call, report list, and existing PDF download.
4. Preserve the failed release bundle and audit evidence for diagnosis.

The Stage 0 rollback version is stored outside source control in the frozen baseline bundle.
