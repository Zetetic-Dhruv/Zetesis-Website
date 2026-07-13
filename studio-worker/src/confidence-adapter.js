export function confidenceMatrixFromModule2State(state, selectedBetId) {
  const source = state && typeof state === 'object' ? state : {};
  const bets = array(source.bets);
  const criterionIds = [...new Set(bets.flatMap((bet) => array(bet.criteria).map((item) => text(item.criterion)).filter(Boolean)))];
  const suppliedWeights = new Map(array(source.weights).map((item) => [text(item.criterion), item]));
  const criteria = criterionIds.map((id) => {
    const supplied = suppliedWeights.get(id) || {};
    return {
      id,
      weight: finite(supplied.weight, criterionIds.length ? 1 / criterionIds.length : 0),
      min: finite(supplied.min, 0),
      max: finite(supplied.max, 1),
      basisType: ['traced', 'neutral', 'student_choice'].includes(supplied.basisType) ? supplied.basisType : 'neutral',
    };
  });
  const globalFog = array(source.ground?.fogMap);
  const voiceContradiction = source.ground?.voiceDisagreement?.humanConfirmed === true;
  const alternatives = bets.map((bet) => ({
    id: text(bet.id),
    origin: bet.origin,
    liveStatus: bet.liveStatus,
    groundedSupportTraceIds: [...new Set(array(bet.evidenceFor)
      .filter((item) => item.sourceType !== 'generated_hypothesis')
      .flatMap((item) => array(item.traceIds))
      .map(text)
      .filter(Boolean))],
    criterionScores: array(bet.criteria).map((item) => ({ criterion: text(item.criterion), score: finite(item.score, 0) })),
    evidenceAgainst: array(bet.evidenceAgainst).map((item) => ({
      criterion: text(item.criterion),
      severity: item.severity,
      sourceType: item.sourceType,
      traceIds: array(item.traceIds),
    })),
    fogDependencies: [
      ...globalFog.filter((item) => !array(item.betIds).length || array(item.betIds).includes(bet.id)).map((item) => ({
        id: text(item.traceId || item.id),
        status: item.status,
        influence: finite(item.influence, 0),
        critical: item.critical === true,
        contradictionConfirmed: item.contradictionConfirmed === true,
      })),
      ...(voiceContradiction ? [{
        id: 'human-confirmed-voice-contradiction',
        status: 'unaddressed',
        influence: 1,
        critical: true,
        contradictionConfirmed: true,
      }] : []),
    ],
    failureModes: array(bet.failureModes).map((item) => ({
      id: text(item.id),
      severity: item.severity,
      testStatus: item.testStatus,
    })),
  }));
  return {
    selectedBetId: text(selectedBetId || source.locks?.selectedBetId),
    criteria,
    alternatives,
    hardStops: {
      relevanceResolved: source.ground?.relevance?.status === 'relevant',
      frameResolved: ['confirmed', 'revised_and_confirmed'].includes(source.locks?.frameConfirmation),
      coverageResolved: source.ranking?.coverage?.status === 'covered' && source.ranking?.evaluationIncomplete !== true,
      setComplete: source.locks?.setCompletenessConfirmation === 'confirmed',
    },
    flags: {
      nearTie: source.ranking?.nearTie === true,
      weakField: source.ranking?.weakField === true,
    },
  };
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function finite(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
