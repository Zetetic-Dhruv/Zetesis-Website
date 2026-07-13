# Stage 5 Review Bundle

## Contract

Review the Module 2 BOARD and LOCK student experience against `../platform/Module2_Design_Spec_v0.95.pdf` and `../platform/Module2_Wireframe_v0.95.pdf`.

The review must attack utility, quality, correctness, and lazy/adversarial usability. A pass requires every findings array to be empty.

## Release Boundary

- Student route: `/decision-engineering/module-2`
- Three screens: GROUND, BOARD, LOCK
- Module 1 remains `/decision-engineering`
- Candidate confidence remains hidden because the sealed audit did not pass all release gates.
- Stage 6 owns package generation and PDF controls.
- Stage 7 owns instructor UI changes.

## Human Judgments Preserved

- Confirm or revise the decision frame.
- Review the comparison-set gap before dismissing it.
- Choose the bet to carry, including an explicit choice under a near tie.
- Name loss bearer, accountability location, and reversibility.

The model may extract, reconcile, propose provisional options, describe a thin option, and evaluate evidence. It cannot make the judgments above.

## Recovery Paths

- Irrelevant reply returns to GROUND.
- Thin or drifting frame can be confirmed or revised in place.
- Missing/weak comparison field can add an option on BOARD or request provisional options.
- Generated options require explicit admission to the live field.
- A coverage gap can be filled or explicitly reviewed and dismissed; dismissal marks the set covered and reranks existing evidence.
- A possible voice conflict remains heuristic until the student confirms or dismisses it. Confirmation persists as unresolved fog.
- Every hard stop names the next available action.

## Browser Exercise

A fresh local account completed:

1. Fresh-entry GROUND with a decision frame, one pasted Bethany reply, and three one-line options.
2. Reconciliation and common-field evaluation.
3. In-place frame revision after a thin-frame result.
4. Addition and evaluation of a fourth option without leaving BOARD.
5. Explicit selection under a near tie.
6. LOCK with loss bearer, accountability location, reversibility, and held constants.

Observed browser facts:

- Desktop viewport: `1440 x 900`; document width `1440`; no overflowing elements.
- Mobile viewport: `390 x 844`; document width `390`; no document-level horizontal overflow.
- Mobile grounding band collapses when ready.
- Mobile sticky BOARD/LOCK action stays within the viewport.
- Ranking explanations use option names, never internal IDs.
- One-line pasted options receive an editable working description during evaluation.
- No confidence score or band is present in the student HTML.

The in-app screenshot backend timed out, so the review should inspect the live page and DOM itself rather than relying on a frozen screenshot.

## Deterministic Evidence

- `npm run test:module2`: pass
- `npm run test:offline`: pass
- `npm run test:pdf`: pass before Stage 5; Stage 5 does not modify PDF generation
- Rendered Module 2 client script is extracted from final HTML and syntax checked.
- Module 2 route, three screens, frame recovery, set judgment, inline Board addition, deterministic rerank, and confidence absence have offline smoke coverage.
- Candidate confidence containment and sealed metamorphic audit tests pass; score/band release remains disabled because the sealed label-quality gate failed.

## Files In Scope

- `src/module2-page.js`
- `src/module2-state.js`
- `src/module2-engine.js`
- Module 2 route and rerank handler in `src/studio.js`
- Module switch additions in `src/studio-page.js`
- `test/module2-baseline.mjs`
- `test/local-offline-smoke.mjs`

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
