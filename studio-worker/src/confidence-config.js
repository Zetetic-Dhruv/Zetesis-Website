export const CONFIDENCE_CONFIG_CANDIDATE = Object.freeze({
  version: 'confidence-config-v1-candidate',
  status: 'candidate',
  policyVersion: 'confidence-policy-v2',
  exponents: {
    evidenceResistance: 4,
    rankingStability: 2,
    fogIndependence: 1.5,
    failureCoverage: 0.5,
  },
  thresholds: {
    moderate: 30,
    high: 75,
  },
  perturbations: 1024,
  nearTieMargin: 0.05,
  tieTolerance: 1e-9,
  floor: 0.01,
  checksum: 'aabb90dbfd9b795dcf1648537ce669077d1a21b7af648224cb22e5101e2f961f',
});

export const CONFIDENCE_AUDIT_RELEASE = Object.freeze({
  accepted: false,
  configVersion: '',
  configChecksum: '',
  auditReportChecksum: '',
});

export async function confidenceConfigIsAudited(config) {
  if (CONFIDENCE_AUDIT_RELEASE.accepted !== true) return false;
  const computedChecksum = await configChecksum(config);
  return config?.checksum === computedChecksum
    && config?.status === 'audited'
    && config?.version === 'confidence-config-v1'
    && CONFIDENCE_AUDIT_RELEASE.configVersion === config.version
    && CONFIDENCE_AUDIT_RELEASE.configChecksum === computedChecksum
    && /^[a-f0-9]{64}$/.test(CONFIDENCE_AUDIT_RELEASE.auditReportChecksum || '');
}

async function configChecksum(config) {
  if (!config || typeof config !== 'object') return '';
  const canonical = stableJson({ ...config, checksum: '' });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
