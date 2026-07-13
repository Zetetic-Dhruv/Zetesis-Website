import { mkdirSync, writeFileSync } from 'node:fs';
import { compileModule2Document } from '../src/module2-package.js';
import { buildRecommendationPdfBytes, pdfSafe } from '../src/module2-pdf.js';

const outputDir = new URL('../tmp/pdfs/', import.meta.url);
mkdirSync(outputDir, { recursive: true });

const lockedState = {
  inheritance: {
    frame: 'Which operating-capacity design protects relationship continuity while making people-decision accountability explicit?',
  },
  ground: {
    relevance: { status: 'relevant' },
    frameComparison: {
      groundedFrame: 'Which operating-capacity design protects relationship continuity while making people-decision accountability explicit?',
    },
  },
  bets: [
    candidate({
      id: 'pilot',
      name: 'Time-boxed operations pilot',
      description: 'A one-quarter operating-capacity pilot with explicit review points.',
      origin: 'student',
      whyDistinct: 'Creates bounded implementation evidence before any permanent transfer of ownership.',
      supportingText: 'Bethany House described continuity of partner relationships as a live constraint.',
      supportingSource: 'direct_client_reply',
      contraryText: 'A pilot may postpone a needed permanent role decision.',
      contrarySource: 'generated_hypothesis',
      tripwire: 'Partner handoffs become less reliable during the pilot.',
      criterion: 'Reversibility',
      score: 0.82,
      criterionReason: 'The pilot can be stopped before a permanent ownership change.',
    }),
    candidate({
      id: 'handoff',
      name: 'Phased relationship handoff',
      description: 'Sequence added capacity with explicit transfer of partner memory.',
      origin: 'inherited',
      whyDistinct: 'Treats relationship memory as an asset that must be transferred deliberately.',
      supportingText: 'The inquiry record identifies relationship continuity as decision-critical.',
      supportingSource: 'module_1_trace',
      contraryText: 'The handoff could remain informal and person-dependent.',
      contrarySource: 'direct_client_reply',
      tripwire: 'No named owner accepts the relationship-transfer work.',
      criterion: 'Relationship continuity',
      score: 0.68,
      criterionReason: 'Continuity improves only if transfer ownership is explicit.',
    }),
    candidate({
      id: 'split',
      name: 'Separate operations and people ownership',
      description: 'Keep executive coordination and trust-heavy people work under distinct owners.',
      origin: 'generated',
      whyDistinct: 'Separates two organizational needs instead of combining them in one role.',
      supportingText: 'The team observed that operating coordination and people judgment impose different demands.',
      supportingSource: 'student_observation',
      contraryText: 'Coordination burden may move back to executive leadership.',
      contrarySource: 'student_observation',
      tripwire: 'Routine decisions still require executive escalation.',
      criterion: 'Accountability',
      score: 0.42,
      criterionReason: 'Distinct owners clarify scope but create a new coordination boundary.',
    }),
  ],
  ranking: {
    orderedBetIds: ['pilot', 'handoff', 'split'],
    pairwiseLines: [
      'It leads because the admitted downside is more reversible.',
      'It remains live but asks more of the handoff process.',
      'It remains live but adds coordination cost.',
    ],
    coverage: { status: 'covered' },
    evaluationIncomplete: false,
  },
  locks: {
    frameConfirmation: 'confirmed',
    setCompletenessConfirmation: 'confirmed',
    selectedBetId: 'pilot',
    lossBearer: 'Program staff and partner relationships',
    accountabilityLocation: 'Program leadership owns the pilot decision and the response to failed handoffs.',
    reversibility: 'costly_to_reverse',
    reversibilityNote: 'The pilot can stop, but relationship disruption would require active repair.',
    heldConstant: [
      'The consolidated reply is the current client record for this decision.',
      'New Bethany House evidence can reopen the comparison field.',
    ],
  },
};

const document = compileModule2Document(lockedState, {
  executiveFraming: 'Bethany House is choosing how to add capacity while preserving partner trust and clear accountability.',
  recommendationSummary: 'Use a bounded pilot to learn before making a permanent ownership change.',
  recommendationRationale: 'The pilot currently carries less irreversible downside than the other live options.',
  currentPositionStatement: 'This is a current decision position, not a prediction of programme success.',
  candidateCommentary: [
    { betId: 'pilot', rationale: 'It creates implementation evidence before permanent role transfer.', comparisonReason: 'It leads because the admitted downside is more reversible.' },
    { betId: 'handoff', rationale: 'It directly protects continuity during transition.', comparisonReason: 'It remains live but asks more of the handoff process.' },
    { betId: 'split', rationale: 'It avoids combining two different organizational needs in one role.', comparisonReason: 'It remains live but adds coordination cost.' },
  ],
  closingNote: 'Reopen the decision if a tripwire appears or Bethany House clarifies a constraint that changes the field.',
});

const pdfBytes = buildRecommendationPdfBytes(document);
const expectedStrings = collectStrings(document).map(pdfSafe).filter((value) => value.length > 1);
const excludedStrings = ['trace-internal-pilot', 'trace-internal-handoff', 'trace-internal-split'];
writeFileSync(new URL('module2-recommendation-smoke.pdf', outputDir), pdfBytes);
writeFileSync(new URL('module2-recommendation-source.json', outputDir), JSON.stringify({ document, expectedStrings, excludedStrings }, null, 2));

assert(pdfBytes.length > 5000, 'recommendation PDF is non-trivial');
assert(!new TextDecoder().decode(pdfBytes).includes(' 0 m '), 'recommendation PDF does not draw horizontal rules');
assert(document.candidates.every((item) => item.supportingEvidence.length), 'compiler preserves supporting evidence for every admitted candidate');
assert(document.candidates.every((item) => item.decisionCriteria.length), 'compiler preserves decision criteria for every admitted candidate');
assert(document.candidates.every((item) => item.distinction), 'compiler preserves why every admitted candidate is distinct');
assert(!JSON.stringify(document).includes('trace-internal-'), 'client contract deliberately excludes internal trace IDs');
console.log(new URL('module2-recommendation-smoke.pdf', outputDir).pathname);

function candidate({ id, name, description, origin, whyDistinct, supportingText, supportingSource, contraryText, contrarySource, tripwire, criterion, score, criterionReason }) {
  return {
    id,
    name,
    description,
    origin,
    provisional: false,
    liveStatus: 'live',
    whyDistinct,
    frameBasisTraceIds: [`trace-internal-${id}`],
    evidenceFor: [{ id: `${id}-for`, text: supportingText, sourceType: supportingSource, traceIds: [`trace-internal-${id}`] }],
    evidenceAgainst: [{ id: `${id}-against`, text: contraryText, severity: id === 'split' ? 'weak' : 'material', sourceType: contrarySource, traceIds: [`trace-internal-${id}`] }],
    failureModes: [{ id: `${id}-failure`, text: tripwire, severity: id === 'pilot' ? 'catastrophic' : 'material', testStatus: id === 'handoff' ? 'partially_tested' : 'untested' }],
    criteria: [{ criterion, score, reason: criterionReason }],
    evaluationStatus: 'complete',
  };
}

function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`ok - ${message}`);
}
