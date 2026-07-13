const BLOCKED_KEYS = new Set([
  'confidence',
  'confidenceScore',
  'confidenceBand',
  'rawScore',
  'decomposition',
  'caps',
  'configVersion',
  'configStatus',
  'confidenceConfigVersion',
  'confidenceInputHash',
  'confidence_config_version',
  'confidence_input_hash',
]);

export function stripUnauditedConfidence(value, audited = false) {
  if (audited) return structuredClone(value);
  if (Array.isArray(value)) return value.map((item) => stripUnauditedConfidence(item, false));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key)) continue;
    output[key] = stripUnauditedConfidence(child, false);
  }
  return output;
}

export function sanitizeUnauditedDocumentJson(value, audited = false) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return '{}'; }
  }
  const sanitized = stripUnauditedConfidence(parsed, audited);
  return typeof value === 'string' ? JSON.stringify(sanitized) : sanitized;
}

export function sanitizeUnauditedDocumentText(value, audited = false) {
  const text = String(value || '');
  if (audited) return text;
  return text.split(/\r?\n/).filter((line) => !(
    /\bconfidence\s+(score|band|configuration|config|input hash)\b/i.test(line)
    || /\braw\s+score\b/i.test(line)
  )).join('\n');
}

export function module2ArtifactMayRelease(version, audited = false) {
  const releaseClass = String(version?.artifact_release_class || 'unclassified');
  if (releaseClass === 'client_no_confidence') {
    return !version?.confidence_config_version && !version?.confidence_input_hash;
  }
  if (releaseClass === 'audited_confidence') {
    return audited === true && Boolean(version?.confidence_config_version) && Boolean(version?.confidence_input_hash);
  }
  return false;
}
