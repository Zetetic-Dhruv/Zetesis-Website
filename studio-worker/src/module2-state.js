export const MODULE2_KEY = 'module_2';

export const DEFAULT_MODULE2_STATE = Object.freeze({
  version: 1,
  inheritance: {
    sourceType: 'absent',
    sourceVersionId: '',
    snapshotAt: '',
    entryState: 'fresh',
    frame: '',
    highValueTraces: [],
    evidenceIds: [],
    inheritedSolutions: [],
  },
  ground: {
    problemSeed: '',
    rawReply: '',
    solutionPaste: '',
    substantiveLines: [],
    relevance: { status: 'unresolved', reason: '', matchedTraceIds: [] },
    frameComparison: { status: 'unresolved', inheritedFrame: '', groundedFrame: '', reason: '' },
    completeness: { status: 'unresolved', reason: '' },
    fogMap: [],
    voiceDisagreement: {
      status: 'none',
      summary: '',
      evidenceLines: [],
      humanConfirmed: false,
    },
    possibleDuplicates: [],
    optionGenerationIssues: [],
    mergeChoice: 'merge',
    corrections: [],
  },
  bets: [],
  weights: [],
  ranking: {
    orderedBetIds: [],
    dominanceRelations: [],
    pairwiseLines: [],
    nearTie: false,
    weakField: false,
    evaluationIncomplete: false,
    incompleteReason: '',
    coverage: { status: 'unresolved', gap: '', resolution: '' },
    comparisonScores: {
      basis: 'weighted_criterion_comparison',
      entries: [],
    },
  },
  locks: {
    frameConfirmation: '',
    setCompletenessConfirmation: '',
    selectedBetId: '',
    lossBearer: '',
    accountabilityLocation: '',
    reversibility: '',
    reversibilityNote: '',
    heldConstant: [],
  },
  package: {
    currentPreview: null,
    savedVersionIds: [],
    generatedAt: '',
  },
  updatedAt: '',
});

export function normalizeModule2State(input) {
  const state = structuredClone(DEFAULT_MODULE2_STATE);
  mergeKnown(state, input && typeof input === 'object' ? input : {});

  state.version = 1;
  state.inheritance.sourceType = oneOf(state.inheritance.sourceType, ['saved_version', 'current_draft', 'absent'], 'absent');
  state.inheritance.entryState = oneOf(state.inheritance.entryState, ['full', 'partial', 'fresh'], 'fresh');
  state.inheritance.highValueTraces = cleanObjectArray(state.inheritance.highValueTraces, 50);
  state.inheritance.evidenceIds = cleanStringArray(state.inheritance.evidenceIds, 100);
  state.inheritance.inheritedSolutions = cleanObjectArray(state.inheritance.inheritedSolutions, 30);

  state.ground.substantiveLines = cleanStringArray(state.ground.substantiveLines, 100);
  state.ground.corrections = cleanObjectArray(state.ground.corrections, 50);
  state.ground.fogMap = cleanObjectArray(state.ground.fogMap, 100);
  state.ground.voiceDisagreement.evidenceLines = cleanStringArray(state.ground.voiceDisagreement.evidenceLines, 30);
  state.ground.possibleDuplicates = cleanObjectArray(state.ground.possibleDuplicates, 20);
  state.ground.optionGenerationIssues = cleanObjectArray(state.ground.optionGenerationIssues, 30);
  state.ground.mergeChoice = oneOf(state.ground.mergeChoice, ['merge', 'replace', 'pick'], 'merge');

  state.bets = cleanObjectArray(state.bets, 50).map((bet, index) => ({
    id: cleanText(bet.id, 120) || `bet-${index + 1}`,
    name: cleanText(bet.name, 200),
    description: cleanText(bet.description, 3000),
    origin: oneOf(bet.origin, ['inherited', 'student', 'generated'], 'student'),
    provisional: Boolean(bet.provisional || bet.origin === 'generated'),
    liveStatus: oneOf(bet.liveStatus, ['live', 'rejected', 'dominated', 'duplicate', 'strawman'], 'live'),
    evidenceFor: cleanObjectArray(bet.evidenceFor, 50),
    evidenceAgainst: cleanObjectArray(bet.evidenceAgainst, 50),
    failureModes: cleanObjectArray(bet.failureModes || bet.untestedFailureModes, 50),
    criteria: cleanObjectArray(bet.criteria || bet.criterionEvaluations, 50),
    frameBasisTraceIds: cleanStringArray(bet.frameBasisTraceIds, 30),
    whyDistinct: cleanText(bet.whyDistinct, 1000),
    evaluationStatus: oneOf(bet.evaluationStatus, ['complete', 'incomplete', 'not_evaluated'], 'not_evaluated'),
  }));

  state.weights = cleanObjectArray(state.weights, 30).map((weight) => ({
    criterion: cleanText(weight.criterion, 160),
    weight: finiteNumber(weight.weight, 0),
    min: finiteNumber(weight.min, 0),
    max: finiteNumber(weight.max, 1),
    basisType: oneOf(weight.basisType, ['traced', 'neutral', 'student_choice'], 'neutral'),
    basisTraceId: cleanText(weight.basisTraceId, 120),
  }));

  state.ranking.orderedBetIds = cleanStringArray(state.ranking.orderedBetIds, 50);
  state.ranking.dominanceRelations = cleanObjectArray(state.ranking.dominanceRelations, 100);
  state.ranking.pairwiseLines = cleanStringArray(state.ranking.pairwiseLines, 100);
  state.ranking.comparisonScores.basis = 'weighted_criterion_comparison';
  state.ranking.comparisonScores.entries = cleanObjectArray(state.ranking.comparisonScores.entries, 50).map((entry) => ({
    betId: cleanText(entry.betId || entry.id, 120),
    weightedResistance: finiteNumber(entry.weightedResistance ?? entry.resistance, 0),
    weightedSupport: finiteNumber(entry.weightedSupport ?? entry.support, 0),
    comparisonValue: finiteNumber(entry.comparisonValue ?? entry.score, 0),
  })).filter((entry) => entry.betId);
  state.ranking.nearTie = Boolean(state.ranking.nearTie);
  state.ranking.weakField = Boolean(state.ranking.weakField);
  state.ranking.evaluationIncomplete = Boolean(state.ranking.evaluationIncomplete);
  state.locks.heldConstant = cleanStringArray(state.locks.heldConstant, 50);
  state.package.savedVersionIds = cleanStringArray(state.package.savedVersionIds, 100);
  state.updatedAt = cleanText(state.updatedAt, 80);
  return state;
}

export function parseStoredModule2State(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Stored Module 2 state is unreadable.');
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return normalizeModule2State(parsed);
  } catch (_) {
    throw new Error('Stored Module 2 state is unreadable.');
  }
}

export function buildModule1InheritanceSnapshot(module1State, source = {}) {
  const state = module1State && typeof module1State === 'object' ? module1State : {};
  const frame = cleanText(state.oneSentence?.reframeText, 3000);
  const highValueTraces = (Array.isArray(state.items) ? state.items : [])
    .filter((item) => (
      item
      && item.bucket !== 'KK'
      && (item.selectedForBrief === true || item.valueTag === 'High')
      && cleanText(item.reengineeredQuestion || item.rawText || item.text, 3000)
    ))
    .slice(0, 50)
    .map((item, index) => ({
      id: cleanText(item.id, 120) || `trace-${index + 1}`,
      text: cleanText(item.reengineeredQuestion || item.rawText || item.text, 3000),
      sourceType: cleanText(item.sourceType, 80) || 'student_trace',
      evidenceIds: cleanStringArray(item.evidenceIds, 20),
      valueTag: cleanText(item.valueTag, 40),
    }));
  const inheritedSolutions = (Array.isArray(state.solutions)
    ? state.solutions
    : Array.isArray(state.questionEngineering?.solutions)
      ? state.questionEngineering.solutions
      : [])
    .slice(0, 30)
    .map((solution, index) => (
      typeof solution === 'string'
        ? { id: `solution-${index + 1}`, name: cleanText(solution, 200), description: cleanText(solution, 3000) }
        : {
            id: cleanText(solution?.id, 120) || `solution-${index + 1}`,
            name: cleanText(solution?.name || solution?.title, 200),
            description: cleanText(solution?.description || solution?.text, 3000),
          }
    ))
    .filter((solution) => solution.name || solution.description);
  const evidenceIds = [...new Set(highValueTraces.flatMap((trace) => trace.evidenceIds))].slice(0, 100);
  const hasSource = Boolean(frame || highValueTraces.length || inheritedSolutions.length);
  const sourceType = hasSource
    ? oneOf(source.sourceType, ['saved_version', 'current_draft'], 'current_draft')
    : 'absent';
  const entryState = frame && highValueTraces.length ? 'full' : hasSource ? 'partial' : 'fresh';

  return {
    sourceType,
    sourceVersionId: sourceType === 'saved_version' ? cleanText(source.sourceVersionId, 120) : '',
    snapshotAt: cleanText(source.snapshotAt, 80) || new Date().toISOString(),
    entryState,
    frame,
    highValueTraces,
    evidenceIds,
    inheritedSolutions,
  };
}

export function combineGroundSolutions({
  inheritedSolutions = [],
  currentBets = [],
  incomingSolutions = [],
  choice = 'merge',
  pickedIds = [],
} = {}) {
  const inherited = normalizeSolutions(inheritedSolutions, 'inherited');
  const current = normalizeSolutions(currentBets, 'student');
  const incoming = normalizeSolutions(incomingSolutions, 'student');
  const mode = oneOf(choice, ['merge', 'replace', 'pick'], 'merge');
  const pool = mode === 'replace'
    ? incoming
    : uniqueSolutions([...inherited, ...current, ...incoming]);
  const picked = new Set(cleanStringArray(pickedIds, 100));
  return mode === 'pick' ? pool.filter((solution) => picked.has(solution.id)) : pool;
}

function mergeKnown(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return;
  for (const key of Object.keys(target)) {
    if (!(key in source) || source[key] === undefined) continue;
    const current = target[key];
    const incoming = source[key];
    if (Array.isArray(current)) {
      if (Array.isArray(incoming)) target[key] = incoming;
    } else if (current && typeof current === 'object') {
      if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) mergeKnown(current, incoming);
    } else if (incoming === null || ['string', 'number', 'boolean'].includes(typeof incoming)) {
      target[key] = incoming;
    }
  }
}

function cleanObjectArray(value, limit) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).slice(0, limit)
    : [];
}

function normalizeSolutions(solutions, fallbackOrigin) {
  return (Array.isArray(solutions) ? solutions : [])
    .slice(0, 50)
    .map((solution) => {
      const object = typeof solution === 'string' ? { name: solution } : solution || {};
      const name = cleanText(object.name || object.title || object.text, 200);
      const description = cleanText(object.description || object.detail, 3000);
      const identityText = `${name}\u0000${description}`;
      const id = cleanText(object.id, 120)
        || `bet-${slug(name || description) || 'option'}-${fingerprint(identityText)}`;
      return {
        id,
        name,
        description,
        origin: oneOf(object.origin, ['inherited', 'student', 'generated'], fallbackOrigin),
        provisional: Boolean(object.provisional || object.origin === 'generated'),
        liveStatus: oneOf(object.liveStatus, ['live', 'rejected', 'dominated', 'duplicate', 'strawman'], 'live'),
        evidenceFor: cleanObjectArray(object.evidenceFor, 50),
        evidenceAgainst: cleanObjectArray(object.evidenceAgainst, 50),
        failureModes: cleanObjectArray(object.failureModes || object.untestedFailureModes, 50),
        criteria: cleanObjectArray(object.criteria || object.criterionEvaluations, 50),
      };
    })
    .filter((solution) => solution.name || solution.description);
}

function uniqueSolutions(solutions) {
  const latestById = new Map();
  solutions.forEach((solution, sequence) => {
    latestById.set(solution.id, { solution, sequence });
  });
  const latestByContent = new Map();
  for (const record of latestById.values()) {
    const signature = exactSolutionSignature(record.solution);
    const previous = latestByContent.get(signature);
    if (!previous || record.sequence > previous.sequence) latestByContent.set(signature, record);
  }
  return [...latestByContent.values()]
    .sort((a, b) => a.sequence - b.sequence)
    .map((record) => record.solution);
}

function exactSolutionSignature(solution) {
  return JSON.stringify([
    solution.name.trim().replace(/\s+/g, ' '),
    solution.description.trim().replace(/\s+/g, ' '),
  ]);
}

function slug(value) {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fingerprint(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanStringArray(value, limit) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, 2000)).filter(Boolean).slice(0, limit)
    : [];
}

function cleanText(value, limit) {
  return String(value ?? '').trim().slice(0, limit);
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
