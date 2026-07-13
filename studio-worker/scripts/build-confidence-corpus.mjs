import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const database = process.argv[2];
if (!database) throw new Error('Usage: node scripts/build-confidence-corpus.mjs /path/to/anonymized-source.sqlite');

const states = JSON.parse(execFileSync('sqlite3', [
  '-json',
  database,
  `SELECT state_json FROM workspace_states ORDER BY workspace_id LIMIT 24;`,
], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) || '[]');
if (states.length < 24) throw new Error(`Expected 24 trace states; found ${states.length}.`);

const canonical = Array.from({ length: 12 }, (_, index) => canonicalCase(index));
const traces = states.map((row, index) => traceCase(row.state_json, index));
const metamorphic = canonical.flatMap((source, index) => [0, 1, 2].map((variant) => metamorphicCase(source, index * 3 + variant)));
const freshHoldoutCanonical = Array.from({ length: 4 }, (_, index) => freshCanonicalCase(index));
const freshHoldoutTraces = states.slice(0, 8).map((row, index) => freshTraceCase(row.state_json, states[23 - index].state_json, index));
const freshHoldoutMetamorphic = Array.from({ length: 12 }, (_, index) => freshMetamorphicCase(freshHoldoutCanonical[index % freshHoldoutCanonical.length], index));

const calibration = [
  ...canonical.slice(0, 8),
  ...traces.slice(0, 16),
  ...metamorphic.slice(0, 24),
];
const holdout = [
  ...freshHoldoutCanonical,
  ...freshHoldoutTraces,
  ...freshHoldoutMetamorphic,
];
if (calibration.length !== 48 || holdout.length !== 24) throw new Error('Corpus partition size invariant failed.');

const fixtureDir = resolve(root, 'test/fixtures');
mkdirSync(fixtureDir, { recursive: true });
writeJson(resolve(fixtureDir, 'confidence-calibration.json'), {
  version: 1,
  partition: 'calibration',
  source: { canonical: 8, anonymizedTraceDerived: 16, metamorphic: 24 },
  cases: calibration,
});
writeJson(resolve(fixtureDir, 'confidence-holdout.json'), {
  version: 3,
  partition: 'sealed_holdout',
  sealId: 'confidence-holdout-v3-policy-v2-frozen',
  source: { canonical: 4, anonymizedTraceDerived: 8, metamorphic: 12 },
  cases: holdout,
});

const humanIds = [
  ...calibration.filter((item) => item.kind === 'canonical').slice(0, 3),
  ...calibration.filter((item) => item.kind === 'trace_derived').slice(0, 3),
  ...calibration.filter((item) => item.kind === 'metamorphic').slice(0, 3),
  ...holdout.filter((item) => item.kind === 'canonical').slice(0, 3),
  ...holdout.filter((item) => item.kind === 'trace_derived').slice(0, 3),
  ...holdout.filter((item) => item.kind === 'metamorphic').slice(0, 3),
];
writeJson(resolve(fixtureDir, 'confidence-human-sample.json'), {
  version: 1,
  instructions: 'Dhruv and Gopika independently assign robustnessOrder and band without inspecting formula outputs.',
  reviewers: { dhruv: null, gopika: null },
  cases: humanIds.map((item) => ({
    caseId: item.id,
    partition: calibration.some((candidate) => candidate.id === item.id) ? 'calibration' : 'sealed_holdout',
    dhruv: { band: null, notes: '' },
    gopika: { band: null, notes: '' },
    adjudication: { band: null, notes: '' },
  })),
});

console.log(`Wrote ${calibration.length} calibration, ${holdout.length} holdout, and ${humanIds.length} human-sample cases.`);

function canonicalCase(index) {
  const id = `canonical-${String(index + 1).padStart(2, '0')}`;
  const matrix = baseMatrix(index + 1);
  const mutations = [
    () => {},
    () => matrix.alternatives[0].evidenceAgainst.push(evidence('implementation', 'material', 'student_observation')),
    () => matrix.alternatives[0].evidenceAgainst.push(evidence('continuity', 'decisive', 'direct_client_reply')),
    () => matrix.alternatives[0].fogDependencies.push(fog('partial', 0.7, false)),
    () => matrix.alternatives[0].fogDependencies.push(fog('unaddressed', 1, true)),
    () => matrix.alternatives[0].failureModes.push(failure('catastrophic', 'untested')),
    () => matrix.alternatives[1].criterionScores = matrix.alternatives[0].criterionScores.map((item) => ({ ...item, score: clamp(item.score - 0.01) })),
    () => { matrix.flags.weakField = true; },
    () => { matrix.alternatives[0].origin = 'generated'; matrix.alternatives[0].groundedSupportTraceIds = []; },
    () => { matrix.hardStops.relevanceResolved = false; },
    () => { matrix.alternatives = matrix.alternatives.slice(0, 1); },
    () => { matrix.criteria[0].weight = 0.34; matrix.criteria[1].weight = 0.33; matrix.criteria[2].weight = 0.33; },
  ];
  mutations[index]();
  return { id, kind: 'canonical', scenario: canonicalScenario(index), matrix };
}

function traceCase(serialized, index) {
  const state = safeJson(serialized);
  const items = Array.isArray(state.items) ? state.items : [];
  const high = items.filter((item) => item?.valueTag === 'High' || item?.selectedForBrief === true).length;
  const hypotheses = items.filter((item) => item?.sourceType === 'hypothesis_to_test').length;
  const selected = items.filter((item) => item?.selectedForBrief === true).length;
  const answerDepth = items.filter((item) => item?.whyItMatters || item?.whatAnswerClarifies || item?.reengineeredQuestion).length;
  const matrix = baseMatrix(index + 101);
  const structuralStrength = clamp(0.48 + Math.min(0.22, high * 0.025) + Math.min(0.12, answerDepth * 0.01));
  matrix.alternatives[0].criterionScores = matrix.alternatives[0].criterionScores.map((item, criterionIndex) => ({
    ...item,
    score: clamp(structuralStrength - criterionIndex * 0.025),
  }));
  if (hypotheses) matrix.alternatives[0].evidenceAgainst.push(evidence('continuity', hypotheses > 2 ? 'material' : 'weak', 'generated_hypothesis'));
  if (!selected) matrix.alternatives[0].fogDependencies.push(fog('unaddressed', 0.8, true));
  else if (selected < high) matrix.alternatives[0].fogDependencies.push(fog('partial', 0.5, false));
  if (answerDepth < 2) matrix.alternatives[0].failureModes.push(failure('material', 'untested'));
  return {
    id: `trace-${String(index + 1).padStart(2, '0')}`,
    kind: 'trace_derived',
    scenario: 'Anonymized structural projection of an existing workspace trace.',
    traceFeatures: { itemCount: items.length, highValueCount: high, hypothesisCount: hypotheses, selectedCount: selected, elaboratedCount: answerDepth },
    matrix,
  };
}

function freshCanonicalCase(index) {
  const matrix = baseMatrix(2309 + index * 47);
  const scenarios = [
    'Grounded selection facing a material direct-client objection.',
    'Selected bet depends on fully unresolved consequential fog.',
    'Selected bet retains a catastrophic untested failure mode.',
    'Unresolved relevance hard stop in an otherwise complete comparison.',
  ];
  if (index === 0) {
    matrix.selectedBetId = 'bet-b';
    matrix.alternatives[1].criterionScores = matrix.alternatives[0].criterionScores.map((item) => ({ ...item, score: clamp(item.score + 0.02) }));
    matrix.alternatives[1].evidenceAgainst.push(evidence('accountability', 'material', 'direct_client_reply'));
  } else if (index === 1) {
    matrix.selectedBetId = 'bet-c';
    matrix.alternatives[2].criterionScores = matrix.alternatives[0].criterionScores.map((item) => ({ ...item, score: clamp(item.score + 0.015) }));
    matrix.alternatives[2].fogDependencies.push(fog('unaddressed', 0.9, true));
  } else if (index === 2) {
    matrix.alternatives[0].failureModes.push(failure('catastrophic', 'untested'));
  } else {
    matrix.hardStops.relevanceResolved = false;
  }
  return {
    id: `audit3-canonical-${String(index + 1).padStart(2, '0')}`,
    kind: 'canonical',
    scenario: scenarios[index],
    matrix,
  };
}

function freshTraceCase(serializedLeft, serializedRight, index) {
  const left = traceCase(serializedLeft, index).traceFeatures;
  const right = traceCase(serializedRight, 23 - index).traceFeatures;
  const features = {
    itemCount: left.itemCount + right.itemCount,
    highValueCount: Math.max(left.highValueCount, right.highValueCount),
    hypothesisCount: left.hypothesisCount + right.hypothesisCount,
    selectedCount: Math.min(left.selectedCount, right.selectedCount),
    elaboratedCount: Math.round((left.elaboratedCount + right.elaboratedCount) / 2),
  };
  const matrix = baseMatrix(3203 + index * 53);
  const selectedIndex = index % matrix.alternatives.length;
  matrix.selectedBetId = matrix.alternatives[selectedIndex].id;
  const selected = matrix.alternatives[selectedIndex];
  const structuralStrength = clamp(0.44
    + Math.min(0.2, features.highValueCount * 0.022)
    + Math.min(0.14, features.elaboratedCount * 0.012));
  selected.criterionScores = selected.criterionScores.map((item, criterionIndex) => ({
    ...item,
    score: clamp(structuralStrength + (2 - criterionIndex) * 0.018),
  }));
  if (features.hypothesisCount > 0) selected.evidenceAgainst.push(evidence('accountability', features.hypothesisCount > 2 ? 'material' : 'weak', 'generated_hypothesis'));
  if (features.selectedCount === 0) selected.fogDependencies.push(fog('unaddressed', 0.85, true));
  else if (features.selectedCount < features.highValueCount) selected.fogDependencies.push(fog('partial', 0.55, false));
  if (features.elaboratedCount < 2) selected.failureModes.push(failure('material', 'untested'));
  return {
    id: `audit3-trace-${String(index + 1).padStart(2, '0')}`,
    kind: 'trace_derived',
    scenario: 'Blinded composite of two anonymized workspace structures under a rotated selected bet.',
    traceFeatures: features,
    matrix,
  };
}

function freshMetamorphicCase(source, index) {
  const matrix = baseMatrix(4109 + index * 59);
  const baselineMatrix = structuredClone(matrix);
  const transforms = [
    ['contradiction', 'not_higher', () => matrix.alternatives[0].evidenceAgainst.push(evidence('implementation', 'decisive', 'module_1_trace'))],
    ['fog_worsening', 'not_higher', () => matrix.alternatives[0].fogDependencies.push(fog('unaddressed', 0.8, false))],
    ['near_tie', 'not_high', () => { matrix.alternatives[1].criterionScores = matrix.alternatives[0].criterionScores.map((item) => ({ ...item, score: clamp(item.score - 0.006) })); matrix.flags.nearTie = true; }],
    ['weak_field', 'not_high', () => { matrix.flags.weakField = true; }],
    ['duplicate_evidence', 'equal', () => {
      const duplicate = evidence('accountability', 'material', 'student_observation');
      baselineMatrix.alternatives[0].evidenceAgainst.push(structuredClone(duplicate));
      matrix.alternatives[0].evidenceAgainst.push(duplicate, structuredClone(duplicate), structuredClone(duplicate));
    }],
    ['strawman_padding', 'equal', () => matrix.alternatives.push(strawman(matrix.criteria))],
    ['weight_shift', 'recompute', () => { matrix.criteria[0].weight = 0.38; matrix.criteria[1].weight = 0.27; matrix.criteria[2].weight = 0.35; }],
    ['irrelevant_paraphrase', 'equal', () => { matrix.ignoredNarrative = 'A third wording-only field outside the measurement contract.'; }],
    ['generated_selected', 'not_high', () => { matrix.alternatives[0].origin = 'generated'; matrix.alternatives[0].groundedSupportTraceIds = []; }],
    ['failure_mode', 'not_higher', () => matrix.alternatives[0].failureModes.push(failure('catastrophic', 'partially_tested'))],
    ['coverage_gap', 'no_score', () => { matrix.hardStops.coverageResolved = false; }],
    ['single_bet', 'no_score', () => { matrix.alternatives = matrix.alternatives.slice(0, 1); }],
  ];
  const [transformation, expectedRelation, mutate] = transforms[index];
  mutate();
  return {
    id: `audit3-meta-${String(index + 1).padStart(2, '0')}`,
    kind: 'metamorphic',
    scenario: `Fresh adversarial ${transformation} probe derived from ${source.id}.`,
    baseCaseId: source.id,
    baselineMatrix,
    transformation,
    expectedRelation,
    matrix,
  };
}

function metamorphicCase(source, index) {
  const matrix = baseMatrix(index + 501);
  const baselineMatrix = structuredClone(matrix);
  const transforms = [
    ['contradiction', 'not_higher', () => matrix.alternatives[0].evidenceAgainst.push(evidence('continuity', 'decisive', 'direct_client_reply'))],
    ['fog_worsening', 'not_higher', () => matrix.alternatives[0].fogDependencies.push(fog('unaddressed', 1, true))],
    ['near_tie', 'not_high', () => { matrix.alternatives[1].criterionScores = matrix.alternatives[0].criterionScores.map((item) => ({ ...item, score: clamp(item.score - 0.01) })); }],
    ['weak_field', 'not_high', () => { matrix.flags.weakField = true; }],
    ['duplicate_evidence', 'equal', () => { const first = matrix.alternatives[0].evidenceAgainst[0] || evidence('implementation', 'weak', 'generated_hypothesis'); matrix.alternatives[0].evidenceAgainst.push(first, structuredClone(first)); }],
    ['strawman_padding', 'equal', () => matrix.alternatives.push(strawman(matrix.criteria))],
    ['weight_shift', 'recompute', () => { matrix.criteria[0].weight = 0.34; matrix.criteria[1].weight = 0.33; matrix.criteria[2].weight = 0.33; }],
    ['irrelevant_paraphrase', 'equal', () => { matrix.ignoredNarrative = 'Wording changed outside the measurement contract.'; }],
    ['generated_selected', 'not_high', () => { matrix.alternatives[0].origin = 'generated'; matrix.alternatives[0].groundedSupportTraceIds = []; }],
    ['failure_mode', 'not_higher', () => matrix.alternatives[0].failureModes.push(failure('catastrophic', 'untested'))],
    ['coverage_gap', 'no_score', () => { matrix.hardStops.coverageResolved = false; }],
    ['single_bet', 'no_score', () => { matrix.alternatives = matrix.alternatives.slice(0, 1); }],
  ];
  const [transformation, expectedRelation, mutate] = transforms[index % transforms.length];
  mutate();
  return {
    id: `meta-${String(index + 1).padStart(2, '0')}`,
    kind: 'metamorphic',
    scenario: `Adversarial ${transformation} variant of ${source.id}.`,
    baseCaseId: source.id,
    baselineMatrix,
    transformation,
    expectedRelation,
    matrix,
  };
}

function baseMatrix(seed) {
  const drift = ((seed * 37) % 11) / 100;
  return {
    selectedBetId: 'bet-a',
    criteria: [
      { id: 'continuity', weight: 0.45, min: 0.15, max: 0.7, basisType: 'traced' },
      { id: 'implementation', weight: 0.3, min: 0.1, max: 0.65, basisType: 'neutral' },
      { id: 'accountability', weight: 0.25, min: 0.1, max: 0.6, basisType: 'neutral' },
    ],
    alternatives: [
      bet('bet-a', [0.82 - drift, 0.73 - drift / 2, 0.69]),
      bet('bet-b', [0.61, 0.68 + drift / 2, 0.62]),
      bet('bet-c', [0.48, 0.57, 0.79 - drift]),
    ],
    hardStops: { relevanceResolved: true, frameResolved: true, coverageResolved: true, setComplete: true },
    flags: { nearTie: false, weakField: false },
  };
}

function bet(id, scores) {
  return {
    id,
    origin: 'student',
    liveStatus: 'live',
    groundedSupportTraceIds: [`${id}-trace`],
    criterionScores: ['continuity', 'implementation', 'accountability'].map((criterion, index) => ({ criterion, score: clamp(scores[index]) })),
    evidenceAgainst: [evidence('implementation', 'weak', 'generated_hypothesis')],
    fogDependencies: [],
    failureModes: [failure('limited', 'partially_tested')],
  };
}

function evidence(criterion, severity, sourceType) {
  return { criterion, severity, sourceType, traceIds: sourceType === 'generated_hypothesis' ? [] : [`${sourceType}-trace`] };
}

function fog(status, influence, critical) {
  return { id: `fog-${status}`, status, influence, critical, contradictionConfirmed: false };
}

function failure(severity, testStatus) {
  return { id: `failure-${severity}-${testStatus}`, severity, testStatus };
}

function strawman(criteria) {
  return {
    id: 'strawman', origin: 'generated', liveStatus: 'strawman', groundedSupportTraceIds: [],
    criterionScores: criteria.map((item) => ({ criterion: item.id, score: 0.05 })),
    evidenceAgainst: [], fogDependencies: [], failureModes: [],
  };
}

function canonicalScenario(index) {
  return [
    'Strong grounded field with a stable selected bet.',
    'Material student-observed objection.',
    'Decisive direct-client contradiction.',
    'Partial fog dependency.',
    'Critical unresolved fog.',
    'Catastrophic untested failure mode.',
    'Near tie between the top alternatives.',
    'Weak comparison field.',
    'Generated selected bet without grounded support.',
    'Unresolved relevance hard stop.',
    'Single live alternative.',
    'Neutral-equal reweighting sensitivity.',
  ][index];
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return {}; }
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
