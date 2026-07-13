import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configChecksum, measureConfidence } from '../src/confidence-measurement.js';
import { CONFIDENCE_CONFIG_CANDIDATE } from '../src/confidence-config.js';

const EXPECTED_HUMAN_CASE_IDS = [
  'canonical-01', 'canonical-02', 'canonical-03',
  'trace-01', 'trace-02', 'trace-03',
  'meta-01', 'meta-02', 'meta-03',
  'audit3-canonical-01', 'audit3-canonical-02', 'audit3-canonical-03',
  'audit3-trace-01', 'audit3-trace-02', 'audit3-trace-03',
  'audit3-meta-01', 'audit3-meta-02', 'audit3-meta-03',
];
const ALLOWED_BANDS = new Set(['Low', 'Moderate', 'High', 'NoScore']);

const holdout = readJson(process.argv[2] || 'test/fixtures/confidence-holdout.json');
const labels = readJson(process.argv[3] || 'calibration/terra-holdout-labels.json');
const candidate = readJson(process.argv[4] || 'calibration/confidence-config-v1-candidate.json');
const human = readJson(process.argv[5] || 'test/fixtures/confidence-human-sample.json');
const outputPath = resolve(process.argv[6] || 'calibration/confidence-audit-report.json');
if (holdout.partition !== 'sealed_holdout' || labels.partition !== 'sealed_holdout') throw new Error('Sealed holdout inputs required.');

const config = candidate.selected.config;
const candidateChecksum = await configChecksum(config);
const runtimeChecksum = await configChecksum(CONFIDENCE_CONFIG_CANDIDATE);
if (config.version !== 'confidence-config-v1-candidate' || config.status !== 'candidate') throw new Error('Frozen candidate identity is invalid.');
if (config.checksum !== candidateChecksum || config.checksum !== runtimeChecksum || JSON.stringify(config) !== JSON.stringify(CONFIDENCE_CONFIG_CANDIDATE)) {
  throw new Error('Audited candidate does not match the frozen runtime configuration.');
}
const labelsById = new Map(labels.cases.map((item) => [item.caseId, item]));
const consensus = new Map(holdout.cases.map((item) => {
  const labeled = labelsById.get(item.id);
  if (!labeled) throw new Error(`Missing holdout judgments for ${item.id}.`);
  const liveIds = item.matrix.alternatives.filter((alternative) => alternative.liveStatus === 'live').map((alternative) => alternative.id);
  return [item.id, consensusFor(labeled.judgments, liveIds)];
}));

const metrics = await evaluate(holdout.cases, consensus, config);
const humanStatus = evaluateHuman(human);
const gates = {
  pairwiseAgreement: metrics.pairwiseAgreement >= 0.85,
  weightedKappa: metrics.weightedKappa >= 0.7,
  severeDisagreements: metrics.severeDisagreements === 0,
  humanLabelsComplete: humanStatus.complete,
  humanAgreementResolved: humanStatus.unresolvedDisagreements === 0,
};
const accepted = Object.values(gates).every(Boolean);
const finalConfig = accepted ? {
  ...config,
  version: 'confidence-config-v1',
  status: 'audited',
  checksum: '',
} : null;
if (finalConfig) finalConfig.checksum = await configChecksum(finalConfig);
const report = {
  version: 1,
  accepted,
  metrics,
  gates,
  humanStatus,
  finalConfig,
  auditedAt: new Date().toISOString(),
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!accepted) process.exitCode = 2;

async function evaluate(cases, consensusById, confidenceConfig) {
  let pairwiseCorrect = 0;
  let pairwiseTotal = 0;
  let severeDisagreements = 0;
  const judgedBands = [];
  const measuredBands = [];
  for (const testCase of cases) {
    const judgment = consensusById.get(testCase.id);
    const selected = await measureConfidence(testCase.matrix, confidenceConfig);
    if (judgment.band !== 'NoScore' && selected.band) {
      judgedBands.push(judgment.band);
      measuredBands.push(selected.band);
      if ((judgment.band === 'High' && selected.band === 'Low') || (judgment.band === 'Low' && selected.band === 'High')) severeDisagreements += 1;
    }
    const scores = new Map();
    for (const alternative of testCase.matrix.alternatives.filter((item) => item.liveStatus === 'live')) {
      const result = await measureConfidence({ ...testCase.matrix, selectedBetId: alternative.id }, confidenceConfig);
      if (result.score !== null) scores.set(alternative.id, result.score);
    }
    for (let left = 0; left < judgment.order.length; left += 1) {
      for (let right = left + 1; right < judgment.order.length; right += 1) {
        if (!scores.has(judgment.order[left]) || !scores.has(judgment.order[right])) continue;
        pairwiseTotal += 1;
        if (scores.get(judgment.order[left]) >= scores.get(judgment.order[right])) pairwiseCorrect += 1;
      }
    }
  }
  return {
    pairwiseAgreement: pairwiseTotal ? pairwiseCorrect / pairwiseTotal : 0,
    weightedKappa: weightedKappa(judgedBands, measuredBands),
    severeDisagreements,
    pairwiseTotal,
    bandCases: judgedBands.length,
  };
}

function evaluateHuman(sample) {
  if (sample.reviewers?.dhruv !== 'dhruv' || sample.reviewers?.gopika !== 'gopika') {
    return { required: 18, completed: 0, agreements: 0, unresolvedDisagreements: 0, complete: false, error: 'Independent reviewer identities are not recorded.' };
  }
  const ids = (sample.cases || []).map((item) => item.caseId);
  const exactIds = ids.length === EXPECTED_HUMAN_CASE_IDS.length
    && new Set(ids).size === EXPECTED_HUMAN_CASE_IDS.length
    && EXPECTED_HUMAN_CASE_IDS.every((id) => ids.includes(id));
  if (!exactIds) return { required: 18, completed: 0, agreements: 0, unresolvedDisagreements: 0, complete: false, error: 'Human sample case manifest is invalid.' };
  let completed = 0;
  let agreements = 0;
  let unresolvedDisagreements = 0;
  for (const item of sample.cases || []) {
    if (!ALLOWED_BANDS.has(item.dhruv?.band) || !ALLOWED_BANDS.has(item.gopika?.band)) continue;
    completed += 1;
    if (item.dhruv.band === item.gopika.band) agreements += 1;
    else if (!ALLOWED_BANDS.has(item.adjudication?.band) || !String(item.adjudication?.notes || '').trim()) unresolvedDisagreements += 1;
  }
  return {
    required: 18,
    completed,
    agreements,
    unresolvedDisagreements,
    complete: completed === 18,
  };
}

function consensusFor(judgments, liveIds) {
  if (!Array.isArray(judgments) || judgments.length !== 3) throw new Error('Exactly three judgments are required.');
  for (const judgment of judgments) validateJudgment(judgment, liveIds);
  const band = majority(judgments.map((item) => item.selectedBand));
  const ids = [...new Set(judgments.flatMap((item) => item.robustnessOrder || []))];
  const wins = new Map(ids.map((id) => [id, 0]));
  for (const judgment of judgments) {
    for (let left = 0; left < judgment.robustnessOrder.length; left += 1) {
      for (let right = left + 1; right < judgment.robustnessOrder.length; right += 1) {
        wins.set(judgment.robustnessOrder[left], (wins.get(judgment.robustnessOrder[left]) || 0) + 1);
      }
    }
  }
  return { band, order: ids.sort((left, right) => (wins.get(right) || 0) - (wins.get(left) || 0) || left.localeCompare(right)) };
}

function validateJudgment(judgment, liveIds) {
  if (judgment.noScore !== (judgment.selectedBand === 'NoScore')) throw new Error('Terra no-score fields are inconsistent.');
  if (!judgment.orderSeed || !Array.isArray(judgment.candidateOrder) || judgment.candidateOrder.length !== liveIds.length || new Set(judgment.candidateOrder).size !== liveIds.length || judgment.candidateOrder.some((id) => !liveIds.includes(id))) {
    throw new Error('Terra randomization metadata is missing or invalid.');
  }
  if (judgment.noScore) {
    if (judgment.robustnessOrder.length !== 0) throw new Error('NoScore judgment must have an empty ranking.');
    return;
  }
  const order = judgment.robustnessOrder;
  if (order.length !== liveIds.length || new Set(order).size !== liveIds.length || order.some((id) => !liveIds.includes(id))) {
    throw new Error('Terra ranking must contain every live alternative exactly once.');
  }
}

function weightedKappa(expected, actual) {
  if (!expected.length || expected.length !== actual.length) return 0;
  const levels = ['Low', 'Moderate', 'High'];
  const observed = expected.reduce((sum, value, index) => sum + distance(levels.indexOf(value), levels.indexOf(actual[index])), 0) / expected.length;
  const expectedCounts = levels.map((level) => expected.filter((value) => value === level).length / expected.length);
  const actualCounts = levels.map((level) => actual.filter((value) => value === level).length / actual.length);
  let chance = 0;
  for (let left = 0; left < levels.length; left += 1) {
    for (let right = 0; right < levels.length; right += 1) chance += expectedCounts[left] * actualCounts[right] * distance(left, right);
  }
  return chance === 0 ? 1 : 1 - (observed / chance);
}

function distance(left, right) {
  return ((left - right) ** 2) / 4;
}

function majority(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}
