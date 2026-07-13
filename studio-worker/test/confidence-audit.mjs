import { readFileSync } from 'node:fs';
import { CONFIDENCE_CONFIG_CANDIDATE } from '../src/confidence-config.js';
import { measureConfidence } from '../src/confidence-measurement.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/confidence-holdout.json', import.meta.url), 'utf8'));
assert(fixture.partition === 'sealed_holdout', 'audit reads only the sealed holdout partition');
assert(fixture.cases.length === 24, 'sealed holdout contains 24 cases');

const results = new Map();
for (const testCase of fixture.cases) {
  const first = await measureConfidence(testCase.matrix, CONFIDENCE_CONFIG_CANDIDATE);
  const second = await measureConfidence(testCase.matrix, CONFIDENCE_CONFIG_CANDIDATE);
  assert(JSON.stringify(first) === JSON.stringify(second), `${testCase.id} is reproducible`);
  results.set(testCase.id, first);
}

let metamorphicChecks = 0;
for (const testCase of fixture.cases.filter((item) => item.kind === 'metamorphic')) {
  const result = results.get(testCase.id);
  const base = await measureConfidence(testCase.baselineMatrix, CONFIDENCE_CONFIG_CANDIDATE);
  assert(base.score !== null, `${testCase.id} has a measurable sealed baseline`);
  if (testCase.expectedRelation === 'equal') {
    assert(result.score === base.score, `${testCase.id} cannot move the score`);
  }
  if (testCase.expectedRelation === 'not_higher' && result.score !== null) {
    assert(result.score <= base.score, `${testCase.id} cannot raise the score`);
  }
  if (testCase.expectedRelation === 'not_high' && result.score !== null) {
    assert(result.band !== 'High', `${testCase.id} cannot display High`);
  }
  if (testCase.expectedRelation === 'no_score') {
    assert(result.score === null && result.band === null, `${testCase.id} must produce no measurement`);
  }
  metamorphicChecks += 1;
}

const canonicalByScenario = new Map(fixture.cases.filter((item) => item.kind === 'canonical').map((item) => [item.scenario, results.get(item.id)]));
const material = canonicalByScenario.get('Grounded selection facing a material direct-client objection.');
const fogCollapsed = canonicalByScenario.get('Selected bet depends on fully unresolved consequential fog.');
const failed = canonicalByScenario.get('Selected bet retains a catastrophic untested failure mode.');
const unresolved = canonicalByScenario.get('Unresolved relevance hard stop in an otherwise complete comparison.');
assert(material?.band !== 'High', 'material evidence against prevents a High band');
assert(fogCollapsed?.band === 'Low', 'collapsed fog independence fires the Low cap');
assert(failed?.band === 'Low', 'critical failure exposure fires the Low cap');
assert(unresolved?.score === null, 'unresolved relevance fires a hard stop');
assert(metamorphicChecks === 12, 'all sealed metamorphic cases were audited');

console.log('Independent sealed confidence audit passed.');

function assert(condition, message) {
  if (!condition) throw new Error(`Audit failure: ${message}`);
  console.log(`ok - ${message}`);
}
