import { CONFIDENCE_CONFIG_CANDIDATE } from '../src/confidence-config.js';
import { confidenceMatrixFromModule2State } from '../src/confidence-adapter.js';
import { configChecksum, measureConfidence } from '../src/confidence-measurement.js';

const base = fixtureMatrix();
const first = await measureConfidence(base, CONFIDENCE_CONFIG_CANDIDATE);
const second = await measureConfidence(base, CONFIDENCE_CONFIG_CANDIDATE);

assert(first.score !== null && first.band, 'complete matrix produces a score and band');
assert(JSON.stringify(first) === JSON.stringify(second), 'measurement is bit-for-bit reproducible');
assert(first.decomposition.perturbations === 1024, 'measurement runs the frozen perturbation count');
assert(first.measurementEngineVersion === 'confidence-measurement-v2', 'measurement exposes its engine version');
assert((await configChecksum(CONFIDENCE_CONFIG_CANDIDATE)) === CONFIDENCE_CONFIG_CANDIDATE.checksum, 'candidate configuration matches its frozen SHA-256 checksum');
assert(first.meaning.includes('not probability'), 'measurement states the non-probability meaning');

const duplicateEvidence = structuredClone(base);
duplicateEvidence.alternatives[0].evidenceAgainst.push(structuredClone(duplicateEvidence.alternatives[0].evidenceAgainst[0]));
const duplicateResult = await measureConfidence(duplicateEvidence, CONFIDENCE_CONFIG_CANDIDATE);
assert(duplicateResult.components.evidenceResistance === first.components.evidenceResistance, 'duplicate evidence does not multiply one objection');

const padded = structuredClone(base);
padded.alternatives.push({
  id: 'foil', origin: 'generated', liveStatus: 'strawman', groundedSupportTraceIds: [],
  criterionScores: base.criteria.map((criterion) => ({ criterion: criterion.id, score: 0.05 })),
  evidenceAgainst: [], fogDependencies: [], failureModes: [],
});
const paddedResult = await measureConfidence(padded, CONFIDENCE_CONFIG_CANDIDATE);
assert(paddedResult.score === first.score, 'strawman padding cannot increase confidence');

const contradicted = structuredClone(base);
contradicted.alternatives[0].evidenceAgainst.push({
  criterion: 'continuity', severity: 'decisive', sourceType: 'direct_client_reply', traceIds: ['reply-2'],
});
const contradictionResult = await measureConfidence(contradicted, CONFIDENCE_CONFIG_CANDIDATE);
assert(contradictionResult.score < first.score, 'decisive sourced contradiction lowers confidence');
assert(contradictionResult.band === 'Low', 'decisive sourced contradiction caps the band at Low');

const foggier = structuredClone(base);
foggier.alternatives[0].fogDependencies[0].status = 'unaddressed';
const fogResult = await measureConfidence(foggier, CONFIDENCE_CONFIG_CANDIDATE);
assert(fogResult.components.fogIndependence < first.components.fogIndependence, 'worsening fog cannot improve fog independence');
assert(fogResult.score <= first.score, 'worsening fog cannot improve confidence');

const failed = structuredClone(base);
failed.alternatives[0].failureModes.push({ id: 'failure-2', severity: 'catastrophic', testStatus: 'untested' });
const failedResult = await measureConfidence(failed, CONFIDENCE_CONFIG_CANDIDATE);
assert(failedResult.components.failureCoverage < first.components.failureCoverage, 'unresolved failure lowers coverage');
assert(failedResult.score <= first.score, 'unresolved failure cannot improve confidence');
assert(failedResult.band === 'Low', 'collapsed failure coverage caps the band at Low');

const materialEvidence = structuredClone(base);
materialEvidence.alternatives[0].evidenceAgainst.push({
  criterion: 'continuity', severity: 'material', sourceType: 'student_observation', traceIds: ['trace-material'],
});
const materialEvidenceResult = await measureConfidence(materialEvidence, CONFIDENCE_CONFIG_CANDIDATE);
assert(materialEvidenceResult.band !== 'High', 'material evidence against prevents a High band');

const materialFog = structuredClone(base);
materialFog.alternatives[0].fogDependencies[0].status = 'dodged';
const materialFogResult = await measureConfidence(materialFog, CONFIDENCE_CONFIG_CANDIDATE);
assert(materialFogResult.band !== 'High', 'material unresolved fog prevents a High band');

const nearTie = structuredClone(base);
nearTie.alternatives[1].criterionScores = nearTie.alternatives[0].criterionScores.map((item) => ({ ...item, score: item.score - 0.01 }));
const tieResult = await measureConfidence(nearTie, CONFIDENCE_CONFIG_CANDIDATE);
assert(tieResult.caps.some((cap) => cap.code === 'near_tie'), 'near tie fires the Moderate cap');
assert(tieResult.band !== 'High', 'near tie cannot display High');

const generated = structuredClone(base);
generated.alternatives[0].origin = 'generated';
generated.alternatives[0].groundedSupportTraceIds = [];
const generatedResult = await measureConfidence(generated, CONFIDENCE_CONFIG_CANDIDATE);
assert(generatedResult.band === 'Low', 'ungrounded generated selection is capped Low');

const stopped = structuredClone(base);
stopped.hardStops.frameResolved = false;
const stoppedResult = await measureConfidence(stopped, CONFIDENCE_CONFIG_CANDIDATE);
assert(stoppedResult.score === null && stoppedResult.band === null, 'hard stop produces no score and no band');

const single = structuredClone(base);
single.alternatives = single.alternatives.slice(0, 1);
const singleResult = await measureConfidence(single, CONFIDENCE_CONFIG_CANDIDATE);
assert(singleResult.score === null, 'single live alternative produces no measurement');

const irrelevant = { ...base, ignoredNarrative: 'A harmless paraphrase outside the measurement contract.' };
const irrelevantResult = await measureConfidence(irrelevant, CONFIDENCE_CONFIG_CANDIDATE);
assert(irrelevantResult.score === first.score, 'irrelevant narrative cannot move the score');
assert(irrelevantResult.inputHash === first.inputHash, 'irrelevant narrative is excluded from measurement identity');
const alternateSelection = await measureConfidence({ ...base, selectedBetId: 'bet-b' }, CONFIDENCE_CONFIG_CANDIDATE);
assert(alternateSelection.stateHash === first.stateHash, 'every candidate uses the same state-derived perturbation field');
assert(alternateSelection.inputHash !== first.inputHash, 'measurement identity still records the selected candidate');

const adapted = confidenceMatrixFromModule2State({
  ground: {
    relevance: { status: 'relevant' },
    fogMap: [{ traceId: 'fog-a', status: 'partial', influence: 0.5, critical: true }],
    voiceDisagreement: { humanConfirmed: false },
  },
  bets: base.alternatives.map((bet) => ({
    ...bet,
    criteria: bet.criterionScores,
    evidenceFor: [{ sourceType: 'module_1_trace', traceIds: bet.groundedSupportTraceIds }],
  })),
  weights: base.criteria.map((item) => ({ criterion: item.id, ...item })),
  ranking: { coverage: { status: 'covered' }, evaluationIncomplete: false, nearTie: false, weakField: false },
  locks: { frameConfirmation: 'confirmed', setCompletenessConfirmation: 'confirmed', selectedBetId: 'bet-a' },
});
assert(adapted.selectedBetId === 'bet-a', 'adapter preserves the explicit human selection');
assert(adapted.hardStops.frameResolved === true && adapted.hardStops.setComplete === true, 'adapter requires explicit human confirmations');
assert(adapted.alternatives[0].groundedSupportTraceIds[0] === 'trace-1', 'adapter derives grounded support only from validated evidence');

console.log('All Module 2 confidence measurement tests passed.');

function fixtureMatrix() {
  return {
    selectedBetId: 'bet-a',
    criteria: [
      { id: 'continuity', weight: 0.45, min: 0.2, max: 0.7, basisType: 'traced' },
      { id: 'implementation', weight: 0.3, min: 0.1, max: 0.6, basisType: 'neutral' },
      { id: 'accountability', weight: 0.25, min: 0.1, max: 0.6, basisType: 'neutral' },
    ],
    alternatives: [
      {
        id: 'bet-a', origin: 'student', liveStatus: 'live', groundedSupportTraceIds: ['trace-1'],
        criterionScores: [
          { criterion: 'continuity', score: 0.82 },
          { criterion: 'implementation', score: 0.72 },
          { criterion: 'accountability', score: 0.68 },
        ],
        evidenceAgainst: [
          { criterion: 'implementation', severity: 'weak', sourceType: 'generated_hypothesis', traceIds: [] },
        ],
        fogDependencies: [
          { id: 'fog-1', status: 'partial', influence: 0.5, critical: false, contradictionConfirmed: false },
        ],
        failureModes: [
          { id: 'failure-1', severity: 'limited', testStatus: 'partially_tested' },
        ],
      },
      {
        id: 'bet-b', origin: 'student', liveStatus: 'live', groundedSupportTraceIds: ['trace-2'],
        criterionScores: [
          { criterion: 'continuity', score: 0.58 },
          { criterion: 'implementation', score: 0.68 },
          { criterion: 'accountability', score: 0.62 },
        ],
        evidenceAgainst: [], fogDependencies: [], failureModes: [],
      },
      {
        id: 'bet-c', origin: 'student', liveStatus: 'live', groundedSupportTraceIds: ['trace-3'],
        criterionScores: [
          { criterion: 'continuity', score: 0.46 },
          { criterion: 'implementation', score: 0.56 },
          { criterion: 'accountability', score: 0.78 },
        ],
        evidenceAgainst: [], fogDependencies: [], failureModes: [],
      },
    ],
    hardStops: {
      relevanceResolved: true,
      frameResolved: true,
      coverageResolved: true,
      setComplete: true,
    },
    flags: { nearTie: false, weakField: false },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`ok - ${message}`);
}
