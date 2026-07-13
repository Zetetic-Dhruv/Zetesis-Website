# Stage 4 Review Bundle

## Contract

The evidence engine may create a validated matrix but cannot assign confidence. The measurement engine is deterministic and makes no model calls. The audit engine sees the measurement engine only as a black box. A score is public only when the frozen configuration is independently audited.

## Frozen candidate

- Measurement engine: `confidence-measurement-v2`
- Policy: `confidence-policy-v2`
- Candidate checksum: `aabb90dbfd9b795dcf1648537ce669077d1a21b7af648224cb22e5101e2f961f`
- Exponents: evidence `4`, stability `2`, fog `1.5`, failure coverage `0.5`
- Band thresholds: Moderate `30`, High `75`
- Perturbations: `1024`

## Deterministic evidence

- `npm run test:confidence`: PASS
- `npm run test:confidence-audit`: PASS
- Duplicate evidence cannot multiply an objection.
- Strawman padding and irrelevant paraphrase cannot move the score.
- Every candidate in one state uses the same perturbation field.
- Hard stops, caps, input hashes, state hashes, policy version, and engine version are returned explicitly.

## Calibration evidence

- Calibration cases: `48`
- Terra judgments: `144`, three independently randomized judgments per case
- Pairwise agreement: `0.8864`
- Weighted kappa: `0.8112`
- High-versus-Low disagreements: `0`

## Sealed v3 audit evidence

- Holdout cases: `24`
- Terra judgments: `72`, three independently randomized judgments per case
- Pairwise agreement: `0.8730` (PASS, threshold `0.85`)
- Weighted kappa: `0.6744` (FAIL, threshold `0.70`)
- High-versus-Low disagreements: `1` (FAIL, required `0`)
- Human sample: incomplete

## Required containment

The candidate remains `status: candidate`; `confidenceConfigIsAudited` returns false. Student UI, client PDF, saved artifacts, and public APIs must not expose the numeric score or band as validated. Later stages may use deterministic ranking, caps, and decomposition to support the four human judgments. Any public score requires a new independent human run and an accepted sealed audit.

## Source bundle

Stage 4 confidence artifact digest before this status note: `539ca46946f66c048b17e105b5e6b3445c56ddd7e3ed7b25d7ae6ad6bc604c9b`.
