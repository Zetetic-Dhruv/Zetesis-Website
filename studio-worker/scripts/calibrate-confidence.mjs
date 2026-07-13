import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configChecksum, measureConfidence } from '../src/confidence-measurement.js';

const fixturePath = resolve(process.argv[2] || 'test/fixtures/confidence-calibration.json');
const labelsPath = resolve(process.argv[3] || 'calibration/terra-calibration-labels.json');
const outputPath = resolve(process.argv[4] || 'calibration/confidence-config-v1-candidate.json');
if (/holdout/i.test(fixturePath) || /holdout/i.test(labelsPath)) throw new Error('Calibration script cannot read holdout files.');

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const labels = JSON.parse(readFileSync(labelsPath, 'utf8'));
if (fixture.partition !== 'calibration' || labels.partition !== 'calibration') throw new Error('Calibration partition required.');

const labelsById = new Map(labels.cases.map((item) => [item.caseId, item]));
const consensus = new Map(fixture.cases.map((item) => {
  const labeled = labelsById.get(item.id);
  if (!labeled) throw new Error(`Missing calibration judgments for ${item.id}.`);
  const liveIds = item.matrix.alternatives.filter((alternative) => alternative.liveStatus === 'live').map((alternative) => alternative.id);
  return [item.id, consensusFor(labeled.judgments, liveIds)];
}));
const observations = await precomputeObservations(fixture.cases);

let best = null;
for (const exponents of exponentGrid()) {
  for (let moderate = 30; moderate <= 60; moderate += 5) {
    for (let high = Math.max(60, moderate + 5); high <= 85; high += 5) {
      const config = candidateConfig(exponents, moderate, high);
      const metrics = scoreConfiguration(fixture.cases, consensus, config, observations);
      const candidate = { config, metrics, complexity: Object.values(exponents).reduce((sum, value) => sum + value, 0) };
      if (better(candidate, best)) best = candidate;
    }
  }
}

best.config.checksum = await configChecksum(best.config);
const output = {
  version: 1,
  status: 'candidate_pending_holdout_and_human_audit',
  selected: best,
  searchedAt: new Date().toISOString(),
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));

function scoreConfiguration(cases, consensusById, config, observationByCase) {
  let pairwiseCorrect = 0;
  let pairwiseTotal = 0;
  let severeDisagreements = 0;
  const measuredBands = [];
  const judgedBands = [];
  for (const testCase of cases) {
    const judgment = consensusById.get(testCase.id);
    const caseObservations = observationByCase.get(testCase.id);
    const selected = projectObservation(caseObservations.get(testCase.matrix.selectedBetId), config);
    if (judgment.band !== 'NoScore' && selected.band) {
      measuredBands.push(selected.band);
      judgedBands.push(judgment.band);
      if ((judgment.band === 'High' && selected.band === 'Low') || (judgment.band === 'Low' && selected.band === 'High')) severeDisagreements += 1;
    }
    const scores = new Map([...caseObservations.entries()].map(([id, observation]) => [id, projectObservation(observation, config).score]));
    for (let left = 0; left < judgment.order.length; left += 1) {
      for (let right = left + 1; right < judgment.order.length; right += 1) {
        if (scores.get(judgment.order[left]) === null || scores.get(judgment.order[right]) === null) continue;
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
  };
}

async function precomputeObservations(cases) {
  const output = new Map();
  const baseConfig = candidateConfig({ evidenceResistance: 4, rankingStability: 3, fogIndependence: 2, failureCoverage: 1 }, 45, 70);
  for (const testCase of cases) {
    const alternatives = new Map();
    for (const alternative of testCase.matrix.alternatives.filter((item) => item.liveStatus === 'live')) {
      const result = await measureConfidence({ ...testCase.matrix, selectedBetId: alternative.id }, baseConfig);
      alternatives.set(alternative.id, {
        components: result.components,
        capCodes: result.caps.map((cap) => cap.code),
      });
    }
    output.set(testCase.id, alternatives);
  }
  return output;
}

function projectObservation(observation, config) {
  if (!observation?.components) return { score: null, band: null };
  const components = observation.components;
  const exponents = config.exponents;
  const total = Object.values(exponents).reduce((sum, value) => sum + value, 0);
  const raw = 100 * Math.exp((
    exponents.evidenceResistance * Math.log(Math.max(components.evidenceResistance, config.floor))
    + exponents.rankingStability * Math.log(Math.max(components.rankingStability, config.floor))
    + exponents.fogIndependence * Math.log(Math.max(components.fogIndependence, config.floor))
    + exponents.failureCoverage * Math.log(Math.max(components.failureCoverage, config.floor))
  ) / total);
  const lowCap = observation.capCodes.some((code) => ['decisive_sourced_contradiction', 'generated_without_grounded_support'].includes(code));
  const moderateCap = observation.capCodes.some((code) => ['near_tie', 'weak_comparison_field', 'critical_unresolved_fog'].includes(code));
  const capped = Math.min(raw, lowCap ? config.thresholds.moderate - 1 : moderateCap ? config.thresholds.high - 1 : 100);
  const score = Math.round(capped);
  return { score, band: score >= config.thresholds.high ? 'High' : score >= config.thresholds.moderate ? 'Moderate' : 'Low' };
}

function consensusFor(judgments, liveIds) {
  if (!Array.isArray(judgments) || judgments.length !== 3) throw new Error('Exactly three judgments are required per case.');
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
  const observed = expected.reduce((sum, value, index) => sum + distanceWeight(levels.indexOf(value), levels.indexOf(actual[index])), 0) / expected.length;
  const expectedCounts = levels.map((level) => expected.filter((value) => value === level).length / expected.length);
  const actualCounts = levels.map((level) => actual.filter((value) => value === level).length / actual.length);
  let chance = 0;
  for (let left = 0; left < levels.length; left += 1) {
    for (let right = 0; right < levels.length; right += 1) chance += expectedCounts[left] * actualCounts[right] * distanceWeight(left, right);
  }
  return chance === 0 ? 1 : 1 - (observed / chance);
}

function distanceWeight(left, right) {
  return ((left - right) ** 2) / 4;
}

function majority(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
}

function exponentGrid() {
  const output = [];
  for (const evidenceResistance of [4, 5, 6, 7]) {
    for (const rankingStability of [2, 3, 4, 5]) {
      for (const fogIndependence of [1.5, 2, 2.5, 3]) {
        for (const failureCoverage of [0.5, 1, 1.5, 2]) {
          if (evidenceResistance > rankingStability && rankingStability > fogIndependence && fogIndependence > failureCoverage) {
            output.push({ evidenceResistance, rankingStability, fogIndependence, failureCoverage });
          }
        }
      }
    }
  }
  return output;
}

function candidateConfig(exponents, moderate, high) {
  return {
    version: 'confidence-config-v1-candidate', status: 'candidate', policyVersion: 'confidence-policy-v2', exponents,
    thresholds: { moderate, high }, perturbations: 1024, nearTieMargin: 0.05, tieTolerance: 1e-9, floor: 0.01, checksum: '',
  };
}

function better(candidate, current) {
  if (!current) return true;
  const candidateAcceptable = candidate.metrics.severeDisagreements === 0 && candidate.metrics.weightedKappa >= 0.7;
  const currentAcceptable = current.metrics.severeDisagreements === 0 && current.metrics.weightedKappa >= 0.7;
  if (candidateAcceptable !== currentAcceptable) return candidateAcceptable;
  if (candidate.metrics.pairwiseAgreement !== current.metrics.pairwiseAgreement) return candidate.metrics.pairwiseAgreement > current.metrics.pairwiseAgreement;
  if (candidate.metrics.weightedKappa !== current.metrics.weightedKappa) return candidate.metrics.weightedKappa > current.metrics.weightedKappa;
  return candidate.complexity < current.complexity;
}
