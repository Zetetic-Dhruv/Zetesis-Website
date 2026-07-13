const EVIDENCE_SEVERITY = { weak: 0.25, material: 0.6, decisive: 1 };
const CONSTRAINT_FORCE = {
  direct_client_reply: 1,
  public_fact: 0.75,
  module_1_trace: 0.75,
  student_observation: 0.5,
  generated_hypothesis: 0.25,
};
const FOG_PENALTY = {
  answered: 0,
  partial: 0.35,
  dodged: 0.75,
  unaddressed: 1,
  contradiction: 1,
};
const FAILURE_SEVERITY = { limited: 0.25, material: 0.6, catastrophic: 1 };
const TEST_PENALTY = { resolved: 0, partially_tested: 0.5, untested: 1 };
const HALTON_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];
const HARD_STOP_KEYS = ['relevanceResolved', 'frameResolved', 'coverageResolved', 'setComplete'];
const MEASUREMENT_ENGINE_VERSION = 'confidence-measurement-v2';

export async function measureConfidence(matrix, config) {
  validateConfig(config);
  const input = normalizeMatrix(matrix);
  const inputHash = await sha256(stableJson(input));
  const stateHash = await sha256(stableJson({ ...input, selectedBetId: '' }));
  const hardStop = HARD_STOP_KEYS.find((key) => input.hardStops[key] !== true);
  if (hardStop) return noMeasurement(config, inputHash, stateHash, `hard_stop:${hardStop}`);

  const live = input.alternatives.filter((bet) => bet.liveStatus === 'live');
  if (live.length < 2) return noMeasurement(config, inputHash, stateHash, 'hard_stop:fewer_than_two_live_alternatives');
  const selected = live.find((bet) => bet.id === input.selectedBetId);
  if (!selected) return noMeasurement(config, inputHash, stateHash, 'hard_stop:selected_bet_not_live');
  if (!commonCriterionField(live, input.criteria)) {
    return noMeasurement(config, inputHash, stateHash, 'hard_stop:incomplete_common_criterion_field');
  }

  const weights = normalizedBaseWeights(input.criteria);
  const evidenceResistance = evidenceAgainstResistance(selected, input.criteria, weights);
  const ranking = rankingStability(input, live, weights, config, stateHash);
  const fogIndependence = fogIndependenceScore(selected.fogDependencies);
  const failureCoverage = failureModeCoverage(selected.failureModes);
  const components = {
    evidenceResistance,
    rankingStability: ranking.stability,
    fogIndependence,
    failureCoverage,
  };
  const rawScore = geometricScore(components, config);
  const caps = policyCaps(input, selected, ranking, components, config);
  const cappedScore = caps.reduce((score, cap) => Math.min(score, cap.maxScore), rawScore);
  const score = Math.round(cappedScore);

  return {
    score,
    band: bandForScore(score, config),
    rawScore: round(rawScore, 6),
    components: mapValues(components, (value) => round(value, 6)),
    decomposition: {
      perturbations: config.perturbations,
      uniqueWins: ranking.uniqueWins,
      ties: ranking.ties,
      losses: ranking.losses,
      baseMargin: round(ranking.baseMargin, 6),
    },
    caps,
    configVersion: config.version,
    configStatus: config.status,
    policyVersion: config.policyVersion,
    measurementEngineVersion: MEASUREMENT_ENGINE_VERSION,
    inputHash,
    stateHash,
    meaning: "Robustness of the recommendation's current position, not probability of client success.",
  };
}

export async function configChecksum(config) {
  const copy = { ...config, checksum: '' };
  return sha256(stableJson(copy));
}

function evidenceAgainstResistance(selected, criteria, weights) {
  let burden = 0;
  for (const [index, criterion] of criteria.entries()) {
    const strongest = selected.evidenceAgainst
      .filter((item) => item.criterion === criterion.id)
      .reduce((maximum, item) => Math.max(
        maximum,
        EVIDENCE_SEVERITY[item.severity] * CONSTRAINT_FORCE[item.sourceType]
      ), 0);
    burden += weights[index] * strongest;
  }
  return clamp(1 - burden);
}

function rankingStability(input, alternatives, baseWeights, config, inputHash) {
  const seed = Number.parseInt(inputHash.slice(0, 8), 16) % 100000;
  let uniqueWins = 0;
  let ties = 0;
  let losses = 0;
  for (let sample = 0; sample < config.perturbations; sample += 1) {
    const raw = input.criteria.map((criterion, index) => {
      const spread = criterion.basisType === 'traced' ? 0.2 : criterion.basisType === 'student_choice' ? 0.25 : 0.35;
      const movement = (halton(seed + sample + 1, HALTON_PRIMES[index]) * 2) - 1;
      return baseWeights[index] * (1 + spread * movement);
    });
    const weights = projectBoundedSimplex(raw, input.criteria.map((item) => item.min), input.criteria.map((item) => item.max));
    const scores = alternatives.map((bet) => ({ id: bet.id, score: weightedCriterionScore(bet, input.criteria, weights) }));
    const top = Math.max(...scores.map((item) => item.score));
    const topIds = scores.filter((item) => Math.abs(item.score - top) <= config.tieTolerance).map((item) => item.id);
    if (topIds.length === 1 && topIds[0] === input.selectedBetId) uniqueWins += 1;
    else if (topIds.includes(input.selectedBetId)) ties += 1;
    else losses += 1;
  }
  const baseScores = alternatives
    .map((bet) => ({ id: bet.id, score: weightedCriterionScore(bet, input.criteria, baseWeights) }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const selectedIndex = baseScores.findIndex((item) => item.id === input.selectedBetId);
  const nearest = baseScores.find((item) => item.id !== input.selectedBetId);
  const baseMargin = selectedIndex === 0 && nearest ? baseScores[0].score - nearest.score : 0;
  return {
    stability: (uniqueWins + 0.5 * ties) / config.perturbations,
    uniqueWins,
    ties,
    losses,
    baseMargin,
  };
}

function fogIndependenceScore(dependencies) {
  if (!dependencies.length) return 1;
  const totalInfluence = dependencies.reduce((sum, item) => sum + item.influence, 0);
  if (totalInfluence <= 0) return 1;
  const burden = dependencies.reduce((sum, item) => {
    const status = item.contradictionConfirmed ? 'contradiction' : item.status;
    return sum + item.influence * FOG_PENALTY[status];
  }, 0);
  return clamp(1 - (burden / totalInfluence));
}

function failureModeCoverage(failureModes) {
  return failureModes.reduce((product, item) => (
    product * (1 - FAILURE_SEVERITY[item.severity] * TEST_PENALTY[item.testStatus])
  ), 1);
}

function geometricScore(components, config) {
  const exponents = config.exponents;
  const weightedLog = (
    exponents.evidenceResistance * Math.log(Math.max(components.evidenceResistance, config.floor))
    + exponents.rankingStability * Math.log(Math.max(components.rankingStability, config.floor))
    + exponents.fogIndependence * Math.log(Math.max(components.fogIndependence, config.floor))
    + exponents.failureCoverage * Math.log(Math.max(components.failureCoverage, config.floor))
  );
  const total = Object.values(exponents).reduce((sum, value) => sum + value, 0);
  return 100 * Math.exp(weightedLog / total);
}

function policyCaps(input, selected, ranking, components, config) {
  const caps = [];
  const moderateMax = config.thresholds.high - 1;
  const lowMax = config.thresholds.moderate - 1;
  if (input.flags.nearTie || ranking.baseMargin <= config.nearTieMargin) caps.push({ code: 'near_tie', maxBand: 'Moderate', maxScore: moderateMax });
  if (input.flags.weakField) caps.push({ code: 'weak_comparison_field', maxBand: 'Moderate', maxScore: moderateMax });
  if (selected.fogDependencies.some((item) => item.critical && (item.status !== 'answered' || item.contradictionConfirmed))) {
    caps.push({ code: 'critical_unresolved_fog', maxBand: 'Moderate', maxScore: moderateMax });
  }
  if (selected.fogDependencies.some((item) => item.influence >= 0.5 && (item.status !== 'answered' || item.contradictionConfirmed))) {
    caps.push({ code: 'material_unresolved_fog', maxBand: 'Moderate', maxScore: moderateMax });
  }
  if (components.fogIndependence <= 0.25) {
    caps.push({ code: 'collapsed_fog_independence', maxBand: 'Low', maxScore: lowMax });
  }
  if (selected.evidenceAgainst.some((item) => item.severity === 'material')) {
    caps.push({ code: 'material_evidence_against', maxBand: 'Moderate', maxScore: moderateMax });
  }
  if (selected.evidenceAgainst.some((item) => item.severity === 'decisive' && item.sourceType !== 'generated_hypothesis')) {
    caps.push({ code: 'decisive_sourced_contradiction', maxBand: 'Low', maxScore: lowMax });
  }
  if (components.failureCoverage <= 0.25) {
    caps.push({ code: 'critical_failure_exposure', maxBand: 'Low', maxScore: lowMax });
  }
  if (selected.origin === 'generated' && selected.groundedSupportTraceIds.length === 0) {
    caps.push({ code: 'generated_without_grounded_support', maxBand: 'Low', maxScore: lowMax });
  }
  return uniqueCaps(caps);
}

function normalizeMatrix(value) {
  const matrix = value && typeof value === 'object' ? value : {};
  const criteria = array(matrix.criteria).map((item) => ({
    id: string(item.id || item.criterion),
    weight: finite(item.weight, 0),
    min: finite(item.min, 0),
    max: finite(item.max, 1),
    basisType: ['traced', 'neutral', 'student_choice'].includes(item.basisType) ? item.basisType : 'neutral',
  }));
  if (!criteria.length || criteria.length > HALTON_PRIMES.length) throw new Error('Confidence matrix requires 1-30 criteria.');
  if (criteria.some((item) => !item.id || item.min < 0 || item.max > 1 || item.min > item.max)) throw new Error('Invalid criterion bounds.');
  const alternatives = array(matrix.alternatives).map((bet) => ({
    id: string(bet.id),
    origin: ['student', 'inherited', 'generated'].includes(bet.origin) ? bet.origin : 'student',
    liveStatus: ['live', 'rejected', 'dominated', 'duplicate', 'strawman'].includes(bet.liveStatus) ? bet.liveStatus : 'rejected',
    groundedSupportTraceIds: uniqueStrings(bet.groundedSupportTraceIds),
    criterionScores: array(bet.criterionScores).map((item) => ({ criterion: string(item.criterion), score: clamp(finite(item.score, 0)) })),
    evidenceAgainst: array(bet.evidenceAgainst).filter(validEvidenceAgainst).map((item) => ({
      criterion: string(item.criterion),
      severity: item.severity,
      sourceType: item.sourceType,
      traceIds: uniqueStrings(item.traceIds),
    })),
    fogDependencies: array(bet.fogDependencies).filter(validFog).map((item) => ({
      id: string(item.id),
      status: item.status,
      influence: Math.max(0, finite(item.influence, 0)),
      critical: item.critical === true,
      contradictionConfirmed: item.contradictionConfirmed === true,
    })),
    failureModes: array(bet.failureModes).filter(validFailure).map((item) => ({
      id: string(item.id),
      severity: item.severity,
      testStatus: item.testStatus,
    })),
  })).filter((bet) => bet.id);
  return {
    selectedBetId: string(matrix.selectedBetId),
    criteria,
    alternatives,
    hardStops: object(matrix.hardStops),
    flags: object(matrix.flags),
  };
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Confidence configuration is required.');
  const exponentValues = Object.values(config.exponents || {});
  if (exponentValues.length !== 4 || exponentValues.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Invalid confidence exponents.');
  if (!(config.exponents.evidenceResistance > config.exponents.rankingStability
    && config.exponents.rankingStability > config.exponents.fogIndependence
    && config.exponents.fogIndependence > config.exponents.failureCoverage)) throw new Error('Confidence exponents must preserve approved priority order.');
  if (!Number.isInteger(config.perturbations) || config.perturbations <= 0) throw new Error('Invalid perturbation count.');
  if (!(config.thresholds?.moderate > 0 && config.thresholds?.high > config.thresholds.moderate && config.thresholds.high <= 100)) throw new Error('Invalid confidence thresholds.');
}

function commonCriterionField(alternatives, criteria) {
  const expected = criteria.map((item) => item.id).sort();
  return alternatives.every((bet) => {
    const actual = bet.criterionScores.map((item) => item.criterion).sort();
    return actual.length === expected.length && actual.every((item, index) => item === expected[index]);
  });
}

function normalizedBaseWeights(criteria) {
  const raw = criteria.map((item) => Math.max(0, item.weight));
  const fallback = raw.some((value) => value > 0) ? raw : criteria.map(() => 1 / criteria.length);
  return projectBoundedSimplex(fallback, criteria.map((item) => item.min), criteria.map((item) => item.max));
}

function projectBoundedSimplex(raw, minimums, maximums) {
  const minTotal = minimums.reduce((sum, value) => sum + value, 0);
  const maxTotal = maximums.reduce((sum, value) => sum + value, 0);
  if (minTotal > 1 + 1e-9 || maxTotal < 1 - 1e-9) throw new Error('Criterion bounds cannot form a normalized weighting.');
  let values = raw.map((value, index) => clampRange(value, minimums[index], maximums[index]));
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const difference = 1 - values.reduce((sum, value) => sum + value, 0);
    if (Math.abs(difference) <= 1e-12) break;
    const free = values.map((value, index) => ({ value, index }))
      .filter(({ value, index }) => difference > 0 ? value < maximums[index] - 1e-12 : value > minimums[index] + 1e-12);
    if (!free.length) break;
    const share = difference / free.length;
    values = values.map((value, index) => free.some((item) => item.index === index)
      ? clampRange(value + share, minimums[index], maximums[index])
      : value);
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-8) throw new Error('Unable to project criterion weights onto bounded simplex.');
  return values;
}

function weightedCriterionScore(bet, criteria, weights) {
  const scores = new Map(bet.criterionScores.map((item) => [item.criterion, item.score]));
  return criteria.reduce((sum, criterion, index) => sum + weights[index] * scores.get(criterion.id), 0);
}

function halton(index, base) {
  let result = 0;
  let fraction = 1 / base;
  let cursor = index;
  while (cursor > 0) {
    result += fraction * (cursor % base);
    cursor = Math.floor(cursor / base);
    fraction /= base;
  }
  return result;
}

function bandForScore(score, config) {
  if (score >= config.thresholds.high) return 'High';
  if (score >= config.thresholds.moderate) return 'Moderate';
  return 'Low';
}

function noMeasurement(config, inputHash, stateHash, reason) {
  return {
    score: null,
    band: null,
    rawScore: null,
    components: null,
    decomposition: null,
    caps: [],
    reason,
    configVersion: config.version,
    configStatus: config.status,
    policyVersion: config.policyVersion,
    measurementEngineVersion: MEASUREMENT_ENGINE_VERSION,
    inputHash,
    stateHash,
    meaning: "Robustness of the recommendation's current position, not probability of client success.",
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validEvidenceAgainst(item) {
  return item && string(item.criterion) && EVIDENCE_SEVERITY[item.severity] && CONSTRAINT_FORCE[item.sourceType];
}

function validFog(item) {
  return item && string(item.id) && FOG_PENALTY[item.status] !== undefined;
}

function validFailure(item) {
  return item && string(item.id) && FAILURE_SEVERITY[item.severity] && TEST_PENALTY[item.testStatus] !== undefined;
}

function uniqueCaps(caps) {
  const byCode = new Map(caps.map((cap) => [cap.code, cap]));
  return [...byCode.values()];
}

function uniqueStrings(value) {
  return [...new Set(array(value).map(string).filter(Boolean))];
}

function mapValues(objectValue, fn) {
  return Object.fromEntries(Object.entries(objectValue).map(([key, value]) => [key, fn(value)]));
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function string(value) {
  return String(value || '').trim();
}

function finite(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value) {
  return clampRange(value, 0, 1);
}

function clampRange(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, precision) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}
