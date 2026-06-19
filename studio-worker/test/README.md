# Decision Manifold Studio Tests

`fixtures/llm-source-oracle.json` is the source-grounded oracle for localhost/offline model-behavior checks.

Use it when running `AGENT_API_MODE=fixture` or `AGENT_API_MODE=offline`, where the Worker substitutes its deterministic offline agent for the external LLM API. The fixture encodes expected behavior from the product spec, tool prompt, workbook, deck, and decision-engineering lineage:

- Parse intake into atomic items without classifying them.
- Sort items into KK/KU/UK/UU only where the team text justifies it.
- Keep missing holder/source items in `needs_attribution`; collect veto only in the curated high-value Gatekeepers step.
- Scaffold the staffing-gap Drill toward the relationship-continuity example without writing the team's answer.
- Re-engineer vague questions along `for whom`, `how much`, and `by when`.
- Treat the staffing-gap-to-relationship-continuity sentence as strong only when it rules work in and out.
- Refuse to invent CEO private meaning or fill UK/UU content on the team's behalf.

The oracle is data, not a mock server. `local-offline-smoke.mjs` calls the real local Worker endpoints and compares responses to these expectations, so auth, local D1 storage, LLM-run logging, and final-report assembly are exercised together.
