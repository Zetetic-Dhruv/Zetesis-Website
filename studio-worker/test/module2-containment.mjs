import { readFileSync } from 'node:fs';
import { CONFIDENCE_CONFIG_CANDIDATE, confidenceConfigIsAudited } from '../src/confidence-config.js';
import {
  sanitizeUnauditedDocumentJson,
  sanitizeUnauditedDocumentText,
  module2ArtifactMayRelease,
  stripUnauditedConfidence,
} from '../src/confidence-containment.js';
import { normalizeModule2State } from '../src/module2-state.js';

const malicious = normalizeModule2State({
  ranking: {
    confidence: { score: 99, band: 'High' },
    scoreTable: [{ id: 'bet-a', score: 0.99 }],
    comparisonScores: {
      basis: 'forged',
      entries: [{ id: 'bet-a', score: 0.71, confidenceBand: 'High' }],
    },
  },
  package: { confidenceConfigVersion: 'forged-audit', confidenceInputHash: 'forged-hash' },
});
assert(!('confidence' in malicious.ranking), 'state normalization drops injected confidence');
assert(!('scoreTable' in malicious.ranking), 'state normalization drops ambiguous legacy score tables');
assert(malicious.ranking.comparisonScores.basis === 'weighted_criterion_comparison', 'comparison values retain a fixed non-confidence namespace');
assert(malicious.ranking.comparisonScores.entries[0].comparisonValue === 0.71, 'ordinary comparison values remain usable');
assert(!('confidenceConfigVersion' in malicious.package), 'state normalization drops injected confidence provenance');

const forgedAudited = {
  ...CONFIDENCE_CONFIG_CANDIDATE,
  version: 'confidence-config-v1',
  status: 'audited',
  checksum: 'a'.repeat(64),
};
assert(!await confidenceConfigIsAudited(CONFIDENCE_CONFIG_CANDIDATE), 'candidate configuration is not releaseable');
assert(!await confidenceConfigIsAudited(forgedAudited), 'forged audited shape cannot satisfy the release record');

assert(!module2ArtifactMayRelease({}, false), 'provenance-free artifacts fail closed');
assert(!module2ArtifactMayRelease({ artifact_release_class: 'unclassified' }, false), 'unclassified artifacts fail closed');
assert(!module2ArtifactMayRelease({
  artifact_release_class: 'client_no_confidence',
  confidence_config_version: 'candidate',
}, false), 'client-only artifacts cannot carry candidate provenance');
assert(module2ArtifactMayRelease({
  artifact_release_class: 'client_no_confidence',
  confidence_config_version: '',
  confidence_input_hash: '',
}, false), 'server-classified client artifacts can release without confidence');
assert(!module2ArtifactMayRelease({
  artifact_release_class: 'audited_confidence',
  confidence_config_version: 'confidence-config-v1',
  confidence_input_hash: 'hash',
}, false), 'audited-confidence artifacts remain blocked without an accepted release');

const stripped = stripUnauditedConfidence({
  recommendation: 'Keep this.',
  confidenceScore: 94,
  nested: { confidenceBand: 'High', evidence: 'Keep evidence.' },
});
assert(stripped.recommendation === 'Keep this.' && stripped.nested.evidence === 'Keep evidence.', 'non-confidence document content is preserved');
assert(!('confidenceScore' in stripped) && !('confidenceBand' in stripped.nested), 'candidate confidence is stripped recursively');

const documentJson = JSON.parse(sanitizeUnauditedDocumentJson(JSON.stringify({ title: 'Brief', confidence: { score: 88 }, body: 'Client content' })));
assert(documentJson.title === 'Brief' && documentJson.body === 'Client content' && !('confidence' in documentJson), 'stored document JSON is sanitized');
const documentText = sanitizeUnauditedDocumentText('Recommendation\nConfidence score: 88\nClient evidence');
assert(documentText === 'Recommendation\nClient evidence', 'stored document text is sanitized');

const studioSource = readFileSync(new URL('../src/studio.js', import.meta.url), 'utf8');
assert(studioSource.includes('sanitizeUnauditedDocumentJson(version.document_json'), 'instructor document JSON passes through containment');
assert(studioSource.includes('sanitizeUnauditedDocumentText(version.document_text'), 'instructor document text passes through containment');
assert(studioSource.includes('if (!module2ArtifactMayRelease(version, confidenceAudited))'), 'single-artifact routes fail closed through release classification');
assert(studioSource.includes('if (!module2ArtifactMayRelease(version, confidenceAudited)) continue'), 'mass-download path excludes unclassified artifacts');

console.log('All Module 2 confidence containment tests passed.');

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`ok - ${message}`);
}
