# Confidence Calibration Artifacts

This directory contains development-only calibration evidence. It is never read by the Worker at runtime and never charged to a student usage ledger.

- `terra-calibration-labels.json`: three blinded Terra judgments per calibration case.
- `terra-holdout-labels.json`: three blinded Terra judgments per sealed case.
- `confidence-config-v1-candidate.json`: parameter search result before human and sealed acceptance.
- `confidence-audit-report.json`: final numeric gates and human-label status.

The calibration script refuses paths containing `holdout`. The independent audit calls only the public measurement function and cannot change parameters.

## Release status

`confidence-policy-v2` passes deterministic, monotonicity, reproducibility, and calibration checks. The sealed v3 panel passed pairwise ordering but did not pass the required band-agreement or zero-severe-disagreement gates. Independent human labels are also incomplete.

The configuration therefore remains `candidate`. Runtime code must keep the student-facing numeric score and band hidden until a later audit produces `status: audited` and `version: confidence-config-v1`. Ranking, hard stops, policy caps, and component decomposition may be used as internal decision support, but they must not be described as a validated confidence instrument.
