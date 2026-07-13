const SEVERITY = { weak: 0.25, material: 0.6, decisive: 1 };
const FORCE = {
  direct_client_reply: 1,
  public_fact: 0.75,
  module_1_trace: 0.75,
  student_observation: 0.5,
  generated_hypothesis: 0.25,
};

export function fallbackReconcile(payload = {}) {
  const state = payload.state || {};
  const reply = String(state.ground?.rawReply || payload.rawReply || '').trim();
  const traces = state.inheritance?.highValueTraces || [];
  const lines = reply.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 12).slice(0, 30);
  const overlap = traces.filter((trace) => sharesTerms(reply, trace.text)).map((trace) => trace.id);
  const relevant = Boolean(reply && (overlap.length || hasDecisionContext(reply)));
  const voiceSignal = possibleVoiceSignal(reply, lines);
  const fogMap = traces.map((trace) => ({
    traceId: trace.id,
    question: trace.text,
    status: sharesTerms(reply, trace.text) ? 'partial' : 'unaddressed',
    answerLine: lines.find((line) => sharesTerms(line, trace.text)) || '',
    influence: 0.5,
  }));
  return {
    relevance: {
      status: relevant ? 'relevant' : reply ? 'irrelevant' : 'uncertain',
      reason: relevant ? 'The reply intersects the inherited frame or named Bethany constraints.' : 'No assignment-specific constraint was found in the reply.',
      matchedTraceIds: overlap,
    },
    substantiveLines: lines,
    frameComparison: {
      status: state.inheritance?.frame ? 'consistent' : 'thin',
      inheritedFrame: state.inheritance?.frame || '',
      groundedFrame: state.inheritance?.frame || state.ground?.problemSeed || '',
      reason: state.inheritance?.frame ? 'No explicit contradiction was detected in fixture mode.' : 'No inherited frame is available.',
    },
    fogMap,
    voiceDisagreement: {
      status: voiceSignal.length ? 'possible' : 'none',
      summary: voiceSignal.length ? 'Distinct attributed voices may express different positions; student confirmation is required.' : '',
      evidenceLines: voiceSignal,
    },
    coverage: {
      status: traces.length && overlap.length < traces.length ? 'gap' : 'covered',
      gap: traces.length && overlap.length < traces.length ? 'At least one inherited high-value trace remains unaddressed.' : '',
      resolution: '',
    },
    possibleDuplicates: findPossibleDuplicates(state.bets || []).map((item) => ({ ...item, status: 'needs_review' })),
  };
}

export function fallbackSuggestOptions(payload = {}) {
  const state = payload.state || {};
  const frame = state.ground?.frameComparison?.groundedFrame || state.inheritance?.frame || state.ground?.problemSeed || 'the current Bethany House decision';
  return {
    options: [
      {
        name: 'Sequence capacity and relationship handoffs',
        description: 'Add capacity in phases while explicitly transferring partner and stakeholder memory.',
        whyDistinct: 'Treats implementation order and continuity as one design problem.',
        frameBasisTraceIds: (state.inheritance?.highValueTraces || []).slice(0, 2).map((trace) => trace.id),
        failureModes: ['The handoff may remain informal and person-dependent.'],
      },
      {
        name: 'Separate operational support from people systems',
        description: 'Use distinct ownership for executive coordination and HR trust/compliance work.',
        whyDistinct: 'Avoids forcing two different organizational needs into one role.',
        frameBasisTraceIds: (state.inheritance?.highValueTraces || []).slice(0, 2).map((trace) => trace.id),
        failureModes: ['Coordination costs may rise if accountability is unclear.'],
      },
    ],
    frameCaveat: `These options inherit the current frame: ${frame}`,
  };
}

export function fallbackEvaluateBets(payload = {}) {
  const state = payload.state || {};
  const criteria = (state.weights || []).length
    ? state.weights.map((item) => item.criterion)
    : ['relationship continuity', 'implementation burden', 'accountability', 'reversibility'];
  return {
    evaluations: (state.bets || []).map((bet, betIndex) => {
      const clientLine = array(state.ground?.substantiveLines)[betIndex % Math.max(1, array(state.ground?.substantiveLines).length)];
      const inheritedTrace = array(state.inheritance?.highValueTraces)[betIndex % Math.max(1, array(state.inheritance?.highValueTraces).length)];
      const fallbackFailure = `${bet.name || 'This option'} may leave an important implementation dependency unresolved.`;
      const sourceEvidence = clientLine
        ? [{ id: `${bet.id}-for-1`, text: clientLine, sourceType: 'direct_client_reply', traceIds: [] }]
        : inheritedTrace
          ? [{ id: `${bet.id}-for-1`, text: inheritedTrace.text, sourceType: 'module_1_trace', traceIds: [inheritedTrace.id] }]
          : [];
      const failures = array(bet.failureModes).length ? array(bet.failureModes) : [fallbackFailure];
      return {
      betId: bet.id,
      evidenceFor: sourceEvidence,
      evidenceAgainst: failures.map((failure, index) => ({
        id: `${bet.id}-against-${index + 1}`,
        text: typeof failure === 'string' ? failure : failure.text || '',
        criterion: criteria[index % criteria.length],
        severity: 'material',
        sourceType: 'generated_hypothesis',
        traceIds: [],
      })),
      failureModes: failures.map((failure, index) => ({
        id: `${bet.id}-failure-${index + 1}`,
        text: typeof failure === 'string' ? failure : failure.text || '',
        severity: 'material',
        testStatus: 'untested',
      })),
      criteria: criteria.map((criterion, criterionIndex) => ({
        criterion,
        score: criterionIndex === (betIndex % criteria.length) ? 0.75 : 0.55,
        reason: 'Fixture evaluation for deterministic local testing.',
      })),
    };
    }),
    coverage: {
      status: (state.bets || []).length >= 2 ? 'covered' : 'gap',
      gap: (state.bets || []).length >= 2 ? '' : 'The comparison field has fewer than two live alternatives.',
    },
  };
}

export function applyReconciliation(state, result = {}) {
  const next = structuredClone(state);
  const traceIds = new Set(array(next.inheritance?.highValueTraces).map((trace) => trace.id));
  const betIds = new Set(array(next.bets).map((bet) => bet.id));
  const rawReply = String(next.ground.rawReply || '').toLowerCase();
  next.ground.substantiveLines = array(result.substantiveLines)
    .filter((line) => String(line || '').trim().length >= 8 && rawReply.includes(String(line).trim().toLowerCase()));
  next.ground.relevance = {
    ...object(result.relevance, next.ground.relevance),
    matchedTraceIds: array(result.relevance?.matchedTraceIds).filter((id) => traceIds.has(id)),
  };
  if (!next.ground.substantiveLines.length && next.ground.relevance.status === 'relevant') {
    next.ground.relevance = {
      ...next.ground.relevance,
      status: 'uncertain',
      reason: 'No client-reply line could be verified verbatim; review the extraction before continuing.',
    };
  }
  next.ground.frameComparison = object(result.frameComparison, next.ground.frameComparison);
  next.ground.fogMap = array(result.fogMap).filter((item) => traceIds.has(item.traceId));
  next.ground.voiceDisagreement = {
    ...next.ground.voiceDisagreement,
    ...object(result.voiceDisagreement, {}),
    humanConfirmed: next.ground.voiceDisagreement?.humanConfirmed === true,
  };
  next.ground.completeness = result.coverage?.status === 'gap'
    ? { status: 'gap', reason: result.coverage.gap || '' }
    : { status: 'complete', reason: '' };
  next.ranking.coverage = object(result.coverage, next.ranking.coverage);
  next.ground.possibleDuplicates = array(result.possibleDuplicates)
    .filter((item) => item.leftId !== item.rightId && betIds.has(item.leftId) && betIds.has(item.rightId))
    .map((item) => ({ ...item, status: 'needs_review' }));
  return next;
}

export function applySuggestedOptions(state, result = {}) {
  const next = structuredClone(state);
  const existingIds = new Set(next.bets.map((bet) => bet.id));
  const traceIds = new Set(array(next.inheritance?.highValueTraces).map((trace) => trace.id));
  const hasGroundedFrame = Boolean(
    String(next.ground?.frameComparison?.groundedFrame || next.inheritance?.frame || next.ground?.problemSeed || '').trim()
  );
  const issues = [];
  for (const [index, option] of array(result.options).entries()) {
    let id = option.id || `generated-${slug(option.name || 'option')}-${index + 1}`;
    while (existingIds.has(id)) id = `${id}-new`;
    const frameBasisTraceIds = array(option.frameBasisTraceIds).filter((traceId) => traceIds.has(traceId));
    const failureModes = array(option.failureModes).map((item) => typeof item === 'string' ? item.trim() : String(item?.text || '').trim()).filter(Boolean);
    const candidate = {
      id,
      name: String(option.name || '').trim(),
      description: String(option.description || '').trim(),
      origin: 'generated',
      provisional: true,
      liveStatus: 'live',
      evidenceFor: [],
      evidenceAgainst: [],
      failureModes: failureModes.map((text, failureIndex) => ({
        id: `${id}-failure-${failureIndex + 1}`,
        text,
        severity: 'material',
        testStatus: 'untested',
      })),
      criteria: [],
      frameBasisTraceIds,
      whyDistinct: String(option.whyDistinct || '').trim(),
      evaluationStatus: 'not_evaluated',
    };
    const reasons = [];
    if (!candidate.name || !candidate.description) reasons.push('Name and description are required.');
    if (!candidate.whyDistinct) reasons.push('The option does not explain why it is genuinely distinct.');
    if (!candidate.failureModes.length) reasons.push('At least one untested failure mode is required.');
    if (!hasGroundedFrame) reasons.push('A grounded decision frame is required before generating alternatives.');
    if (traceIds.size && !frameBasisTraceIds.length) reasons.push('The option is not tied to a valid inherited frame trace.');
    if (array(option.frameBasisTraceIds).some((traceId) => !traceIds.has(traceId))) reasons.push('The option supplied an unknown frame trace ID.');
    if (findPossibleDuplicates([...next.bets, candidate]).some((pair) => pair.rightId === candidate.id)) {
      reasons.push('The option duplicates an admitted alternative.');
    }
    if (reasons.length) {
      issues.push({ id, name: candidate.name, reasons });
      continue;
    }
    existingIds.add(id);
    next.bets.push(candidate);
  }
  next.ground.optionGenerationIssues = issues;
  const admittedStudentField = next.bets.filter((bet) => bet.liveStatus === 'live' && bet.provisional !== true);
  if (issues.length && admittedStudentField.length < 2) {
    next.ranking.coverage = {
      status: 'gap',
      gap: 'One or more generated alternatives failed admission checks.',
      resolution: 'Review the generation issues and add or regenerate a distinct grounded alternative.',
    };
  }
  return next;
}

export function applyBetEvaluations(state, result = {}, contextFacts = []) {
  const next = structuredClone(state);
  const byId = new Map(array(result.evaluations).map((evaluation) => [evaluation.betId, evaluation]));
  next.bets = next.bets.map((bet) => {
    const evaluation = byId.get(bet.id);
    if (!evaluation) return { ...bet, evaluationStatus: 'incomplete' };
    const evidenceFor = validateEvidenceItems(array(evaluation.evidenceFor), next, contextFacts);
    const evidenceAgainst = validateEvidenceItems(array(evaluation.evidenceAgainst), next, contextFacts);
    const failureModes = validFailureModes(evaluation.failureModes);
    const criteria = validCriteria(evaluation.criteria);
    const hasGroundedSupport = evidenceFor.some((item) => item.sourceType !== 'generated_hypothesis');
    const evaluationStatus = hasGroundedSupport && evidenceAgainst.length && failureModes.length && criteria.length
      ? 'complete'
      : 'incomplete';
    return {
      ...bet,
      evidenceFor,
      evidenceAgainst,
      failureModes,
      criteria,
      evaluationStatus,
    };
  });
  if (result.coverage) next.ranking.coverage = object(result.coverage, next.ranking.coverage);
  const admittedStudentField = next.bets.filter((bet) => bet.liveStatus === 'live' && bet.provisional !== true);
  if (next.ground.optionGenerationIssues?.length && admittedStudentField.length < 2) {
    next.ranking.coverage = {
      status: 'gap',
      gap: 'One or more generated alternatives failed admission checks.',
      resolution: 'Review the generation issues and add or regenerate a distinct grounded alternative.',
    };
  }
  next.ranking = {
    ...next.ranking,
    ...rankLiveBets(next.bets, next.weights, next.ground.possibleDuplicates, next.ranking.coverage),
    confidence: null,
  };
  return next;
}

export function rankLiveBets(bets = [], weights = [], duplicateSignals = [], coverage = { status: 'covered' }) {
  const live = bets.filter((bet) => bet.liveStatus === 'live' && bet.provisional !== true);
  const unresolvedDuplicates = [
    ...array(duplicateSignals),
    ...findPossibleDuplicates(live).map((item) => ({ ...item, status: 'needs_review' })),
  ].filter((item) => item.status !== 'dismissed' && live.some((bet) => bet.id === item.leftId) && live.some((bet) => bet.id === item.rightId));
  if (coverage?.status !== 'covered') {
    return incompleteRanking(coverage?.gap || 'Evaluation coverage must be resolved before ranking.', true);
  }
  if (live.length < 2) return incompleteRanking('At least two student-admitted live alternatives are required.', true);
  if (unresolvedDuplicates.length) return incompleteRanking('Resolve possible duplicate alternatives before ranking.', true);

  const criteriaByBet = live.map((bet) => [...new Set(array(bet.criteria).map((item) => item.criterion).filter(Boolean))].sort());
  const criteria = criteriaByBet[0] || [];
  const completeField = criteria.length > 0
    && live.every((bet, index) => bet.evaluationStatus === 'complete'
      && array(bet.evidenceFor).length > 0
      && array(bet.evidenceFor).some((item) => item.sourceType !== 'generated_hypothesis')
      && array(bet.evidenceAgainst).length > 0
      && array(bet.failureModes).length > 0
      && criteriaByBet[index].length === criteria.length
      && criteriaByBet[index].every((criterion, criterionIndex) => criterion === criteria[criterionIndex]));
  if (!completeField) return incompleteRanking('Every live alternative must be evaluated against the same criteria.', false);

  const weightMap = normalizedWeights(criteria, weights);
  const initiallyScored = live.map((bet) => {
    const resistance = evidenceResistance(bet, weightMap);
    const support = criteria.reduce((sum, criterion) => {
      const evaluation = array(bet.criteria).find((item) => item.criterion === criterion);
      return sum + (weightMap.get(criterion) || 0) * clamp(evaluation?.score ?? 0.5);
    }, 0);
    return { id: bet.id, resistance, support, score: resistance * 0.8 + support * 0.2 };
  });
  const dominanceRelations = [];
  for (const left of live) {
    for (const right of live) {
      if (left.id === right.id) continue;
      if (dominates(left, right, criteria)) dominanceRelations.push({ dominantBetId: left.id, dominatedBetId: right.id });
    }
  }
  const dominatedIds = new Set(dominanceRelations.map((item) => item.dominatedBetId));
  const scored = initiallyScored
    .filter((item) => !dominatedIds.has(item.id))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (scored.length < 2) {
    return {
      ...incompleteRanking('Fewer than two non-dominated alternatives remain in the comparison field.', true),
      dominanceRelations,
    };
  }
  const pairwiseLines = scored.slice(0, 3).map((item, index) => {
    const next = scored[index + 1];
    if (!next) return `${item.id} remains live under the current evidence.`;
    const resistanceEffect = 0.8 * (item.resistance - next.resistance);
    const supportEffect = 0.2 * (item.support - next.support);
    return Math.abs(resistanceEffect) >= Math.abs(supportEffect)
      ? `${item.id} ranks above ${next.id} because its weighted counterevidence burden is lower in the current field.`
      : `${item.id} ranks above ${next.id} because its admitted criterion support is stronger in the current field.`;
  });
  return {
    orderedBetIds: scored.map((item) => item.id),
    dominanceRelations,
    pairwiseLines,
    nearTie: scored.length > 1 && Math.abs(scored[0].score - scored[1].score) <= 0.05,
    weakField: false,
    evaluationIncomplete: false,
    incompleteReason: '',
    scoreTable: scored,
  };
}

function incompleteRanking(reason, weakField) {
  return {
    orderedBetIds: [],
    dominanceRelations: [],
    pairwiseLines: [],
    nearTie: false,
    weakField,
    evaluationIncomplete: true,
    incompleteReason: reason,
    scoreTable: [],
  };
}

function evidenceResistance(bet, weightMap) {
  let burden = 0;
  for (const [criterion, weight] of weightMap.entries()) {
    const strongest = array(bet.evidenceAgainst)
      .filter((item) => item.criterion === criterion)
      .reduce((max, item) => Math.max(max, (SEVERITY[item.severity] || 0.25) * (FORCE[item.sourceType] || 0.25)), 0);
    burden += weight * strongest;
  }
  return clamp(1 - burden);
}

function dominates(left, right, criteria) {
  if (!criteria.length) return false;
  const leftScores = new Map(array(left.criteria).map((item) => [item.criterion, clamp(item.score)]));
  const rightScores = new Map(array(right.criteria).map((item) => [item.criterion, clamp(item.score)]));
  return criteria.every((criterion) => (leftScores.get(criterion) || 0) >= (rightScores.get(criterion) || 0))
    && criteria.some((criterion) => (leftScores.get(criterion) || 0) > (rightScores.get(criterion) || 0));
}

function normalizedWeights(criteria, weights) {
  const supplied = new Map(array(weights).map((item) => [item.criterion, Math.max(0, Number(item.weight) || 0)]));
  const raw = criteria.map((criterion) => supplied.get(criterion) || (criteria.length ? 1 / criteria.length : 0));
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return new Map(criteria.map((criterion, index) => [criterion, raw[index] / total]));
}

function findPossibleDuplicates(bets) {
  const results = [];
  for (let left = 0; left < bets.length; left += 1) {
    for (let right = left + 1; right < bets.length; right += 1) {
      const a = tokens(`${bets[left].name} ${bets[left].description}`);
      const b = tokens(`${bets[right].name} ${bets[right].description}`);
      const overlap = a.filter((token) => b.includes(token)).length / Math.max(1, new Set([...a, ...b]).size);
      if (overlap >= 0.55) results.push({ leftId: bets[left].id, rightId: bets[right].id, reason: 'These options may describe the same underlying bet.' });
    }
  }
  return results.slice(0, 5);
}

function validateEvidenceItems(items, state, contextFacts) {
  const inherited = new Set(array(state.inheritance?.highValueTraces).map((trace) => trace.id));
  const publicFacts = new Set(array(contextFacts).filter((fact) => fact.sourceType === 'public_fact').map((fact) => fact.id));
  const courseTraces = new Set(array(contextFacts).filter((fact) => fact.sourceType === 'course_trace').map((fact) => fact.id));
  const studentTraces = new Set(array(state.inheritance?.highValueTraces)
    .filter((trace) => trace.sourceType === 'student_trace')
    .map((trace) => trace.id));
  const rawReply = String(state.ground?.rawReply || '').toLowerCase();
  return items.filter((item) => String(item?.text || '').trim()).map((item, index) => {
    const traceIds = array(item.traceIds).filter((id) => typeof id === 'string');
    const sourceType = supportedEvidenceSource(item, traceIds, {
      inherited,
      publicFacts,
      courseTraces,
      studentTraces,
      rawReply,
    });
    return {
      ...item,
      id: item.id || `evidence-${index + 1}`,
      sourceType,
      traceIds: sourceType === 'generated_hypothesis' ? [] : traceIds,
    };
  });
}

function validFailureModes(value) {
  return array(value).filter((item) => (
    String(item?.text || '').trim()
    && ['limited', 'material', 'catastrophic'].includes(item.severity)
    && ['resolved', 'partially_tested', 'untested'].includes(item.testStatus)
  ));
}

function validCriteria(value) {
  return array(value).filter((item) => (
    String(item?.criterion || '').trim()
    && Number.isFinite(Number(item.score))
    && Number(item.score) >= 0
    && Number(item.score) <= 1
    && String(item.reason || '').trim()
  ));
}

function supportedEvidenceSource(item, traceIds, sources) {
  if (item.sourceType === 'direct_client_reply') {
    const text = String(item.text || '').trim().toLowerCase();
    return text.length >= 8 && sources.rawReply.includes(text) ? 'direct_client_reply' : 'generated_hypothesis';
  }
  if (item.sourceType === 'public_fact') {
    return traceIds.length && traceIds.every((id) => sources.publicFacts.has(id)) ? 'public_fact' : 'generated_hypothesis';
  }
  if (item.sourceType === 'module_1_trace') {
    return traceIds.length && traceIds.every((id) => sources.inherited.has(id) || sources.courseTraces.has(id))
      ? 'module_1_trace'
      : 'generated_hypothesis';
  }
  if (item.sourceType === 'student_observation') {
    return traceIds.length && traceIds.every((id) => sources.studentTraces.has(id)) ? 'student_observation' : 'generated_hypothesis';
  }
  return 'generated_hypothesis';
}

function hasDecisionContext(reply) {
  const lower = String(reply || '').toLowerCase();
  const organization = /bethany|shelter|nassau|safe ground/.test(lower);
  const decisionTerms = [
    /staff|hiring|role|capacity|implementation/,
    /partner|relationship|handoff|continuity/,
    /board|accountab|approval|governance/,
    /hr|trust|compliance|payroll/,
    /community|resident|school|town/,
  ].filter((pattern) => pattern.test(lower)).length;
  return (organization && decisionTerms >= 1) || decisionTerms >= 2;
}

function possibleVoiceSignal(reply, lines) {
  const attributedVoices = String(reply || '').match(/^(?:from|by|speaker|author):\s*.+$/gim) || [];
  if (attributedVoices.length < 2 || !/disagree|different view|contrary|instead|would not|should not/i.test(reply)) return [];
  return lines.filter((line) => /^(?:from|by|speaker|author):|disagree|different view|contrary|instead|would not|should not/i.test(line)).slice(0, 6);
}

function sharesTerms(left, right) {
  const a = tokens(left);
  const b = new Set(tokens(right));
  return a.filter((token) => b.has(token)).length >= 2;
}

function tokens(value) {
  return String(value || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value, fallback) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'option';
}
