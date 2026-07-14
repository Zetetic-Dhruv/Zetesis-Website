export function module2PackageReadinessError(state = {}) {
  const live = admittedLiveBets(state);
  const selected = live.find((bet) => bet.id === state.locks?.selectedBetId);
  if (state.ground?.relevance?.status !== 'relevant') return 'Reconcile a relevant Bethany House reply before packaging.';
  if (!['confirmed', 'revised'].includes(state.locks?.frameConfirmation)) return 'Confirm or revise the decision frame before packaging.';
  if (state.ranking?.coverage?.status !== 'covered' || state.ranking?.evaluationIncomplete) return 'Complete the common comparison field before packaging.';
  if (live.length < 2) return 'Keep at least two credible live alternatives in the comparison field.';
  if (!selected) return 'Choose the bet the team is prepared to carry.';
  if (!meaningful(state.locks?.lossBearer)) return 'Name who absorbs the loss if the recommendation fails.';
  if (!meaningful(state.locks?.accountabilityLocation)) return 'Name where accountability sits.';
  if (!['reversible', 'costly_to_reverse', 'one_way'].includes(state.locks?.reversibility)) return 'Judge how reversible the recommendation is.';
  return '';
}

export function module2PackageInput(state = {}) {
  const live = admittedLiveBets(state);
  const byId = new Map(live.map((bet) => [bet.id, bet]));
  const ordered = (state.ranking?.orderedBetIds || []).map((id) => byId.get(id)).filter(Boolean);
  for (const bet of live) if (!ordered.some((item) => item.id === bet.id)) ordered.push(bet);
  const selected = byId.get(state.locks?.selectedBetId) || null;
  return {
    decisionFrame: clean(state.ground?.frameComparison?.groundedFrame || state.inheritance?.frame || state.ground?.problemSeed, 3000),
    selectedBet: selected ? compactBet(selected) : null,
    candidates: ordered.map((bet, index) => ({
      ...compactBet(bet),
      position: index + 1,
      comparisonLine: clean(state.ranking?.pairwiseLines?.[index], 3000),
    })),
    humanJudgments: {
      lossBearer: clean(state.locks?.lossBearer, 800),
      accountabilityLocation: clean(state.locks?.accountabilityLocation, 3000),
      reversibility: clean(state.locks?.reversibility, 80),
      reversibilityNote: clean(state.locks?.reversibilityNote, 3000),
      heldConstants: cleanArray(state.locks?.heldConstant, 50, 3000),
    },
  };
}

export function fallbackModule2Package(state = {}) {
  const input = module2PackageInput(state);
  const selected = input.selectedBet || {};
  const selectedIndex = input.candidates.findIndex((item) => item.id === selected.id);
  const comparisonLine = input.candidates[selectedIndex]?.comparisonLine || '';
  const leadingReason = comparisonLine || `${selected.name || 'The selected option'} remains the team's preferred path under the current evidence.`;
  return {
    executiveFraming: `Bethany House is choosing how to add operating capacity without losing the relationships and accountability the work depends on.`,
    recommendationSummary: selected.description || `${selected.name || 'The selected option'} is the current recommendation.`,
    recommendationRationale: leadingReason,
    currentPositionStatement: `${selected.name || 'The selected option'} is the team's current recommendation after comparison with ${Math.max(0, input.candidates.length - 1)} live alternative${input.candidates.length === 2 ? '' : 's'}.`,
    candidateCommentary: input.candidates.map((candidate) => ({
      betId: candidate.id,
      rationale: candidate.description || `${candidate.name} remains a live response to the decision frame.`,
      comparisonReason: candidate.comparisonLine || `${candidate.name} remains live under the current evidence.`,
    })),
    closingNote: 'Revisit the recommendation if a named tripwire is observed or if Bethany House clarifies a constraint that changes the comparison field.',
  };
}

export function compileModule2Document(state = {}, modelResult = {}) {
  const readiness = module2PackageReadinessError(state);
  if (readiness) throw new Error(readiness);
  const input = module2PackageInput(state);
  const selected = input.selectedBet;
  const fallback = fallbackModule2Package(state);
  const commentary = new Map((Array.isArray(modelResult.candidateCommentary) ? modelResult.candidateCommentary : [])
    .map((item) => [clean(item?.betId, 120), item || {}]));
  const modelText = (key, max = 5000) => clientFacingProse(modelResult[key], max) || clientFacingProse(fallback[key], max);
  const candidates = input.candidates.map((candidate) => {
    const prose = commentary.get(candidate.id) || {};
    const fallbackProse = fallback.candidateCommentary.find((item) => item.betId === candidate.id) || {};
    return {
      betId: candidate.id,
      name: clientFacingProse(candidate.name, 300) || 'Current option',
      description: clientFacingProse(candidate.description, 4000),
      position: candidate.position,
      status: candidate.id === selected.id ? 'Recommended' : 'Alternative',
      rationale: clientFacingProse(prose.rationale, 4000) || clientFacingProse(fallbackProse.rationale, 4000),
      comparisonReason: clientFacingProse(prose.comparisonReason, 4000) || clientFacingProse(fallbackProse.comparisonReason, 4000),
      distinction: clientFacingProse(candidate.whyDistinct, 2000),
      supportingEvidence: candidate.evidenceFor.map((item) => ({
        text: clientFacingProse(item.text, 4000),
        basis: evidenceBasis(item.sourceType),
      })).filter((item) => item.text),
      evidenceAgainst: candidate.evidenceAgainst.map((item) => ({
        text: clientFacingProse(item.text, 4000),
        severity: clientSeverity(item.severity),
        basis: evidenceBasis(item.sourceType),
      })).filter((item) => item.text),
      tripwires: candidate.failureModes.map((item) => ({
        text: clientFacingProse(item.text, 4000),
        consequence: clientSeverity(item.severity),
        testStatus: testStatusLabel(item.testStatus),
      })).filter((item) => item.text),
      decisionCriteria: candidate.criteria.map((item) => ({
        criterion: clientFacingProse(item.criterion, 300),
        assessment: criterionAssessment(item.score),
        reason: clientFacingProse(item.reason, 2000) || 'Further evidence could change this assessment.',
      })).filter((item) => item.criterion),
    };
  });
  const selectedCandidate = candidates.find((candidate) => candidate.betId === selected.id);
  const publicCandidates = candidates.map(({ betId, ...candidate }) => candidate);
  const document = {
    title: 'Bethany House Recommendation Brief',
    subtitle: 'A decision position for discussion with Bethany House',
    client: 'Bethany House of Nassau County',
    preparedFor: 'Bethany House leadership',
    executiveFraming: modelText('executiveFraming'),
    decisionFrame: input.decisionFrame,
    recommendation: {
      name: selected.name,
      description: selected.description,
      summary: modelText('recommendationSummary'),
      rationale: modelText('recommendationRationale'),
    },
    currentPositionStatement: modelText('currentPositionStatement'),
    candidates: publicCandidates,
    heldConstants: input.humanJudgments.heldConstants,
    lossBearer: input.humanJudgments.lossBearer,
    accountabilityLocation: input.humanJudgments.accountabilityLocation,
    reversibility: reversibilityLabel(input.humanJudgments.reversibility),
    reversibilityNote: input.humanJudgments.reversibilityNote,
    closingNote: modelText('closingNote'),
  };
  return sanitizeClientDocument(document);
}

export function module2DocumentText(document = {}) {
  const lines = [
    document.title,
    document.subtitle,
    document.executiveFraming,
    'Decision frame',
    document.decisionFrame,
    'Recommendation',
    document.recommendation?.name,
    document.recommendation?.description,
    document.recommendation?.summary,
    document.recommendation?.rationale,
    document.currentPositionStatement,
    'Candidate field',
  ];
  for (const candidate of document.candidates || []) {
    lines.push(`${candidate.position}. ${candidate.name}`, candidate.status, candidate.description, candidate.rationale, candidate.comparisonReason, candidate.distinction);
    for (const item of candidate.supportingEvidence || []) lines.push(`Supporting evidence: ${item.text} (${item.basis})`);
    for (const item of candidate.evidenceAgainst || []) lines.push(`Evidence against: ${item.text} (${item.severity}; ${item.basis})`);
    for (const item of candidate.tripwires || []) lines.push(`Tripwire: ${item.text} (${item.consequence}; ${item.testStatus})`);
    for (const item of candidate.decisionCriteria || []) lines.push(`Decision criterion: ${item.criterion} (${item.assessment})`, item.reason);
  }
  lines.push('Decision commitments', `Loss bearer: ${document.lossBearer || ''}`, `Accountability: ${document.accountabilityLocation || ''}`, `Reversibility: ${document.reversibility || ''}`, document.reversibilityNote);
  lines.push('Held constant', ...(document.heldConstants || []), document.closingNote);
  return lines.filter(meaningful).join('\n');
}

function admittedLiveBets(state) {
  return (Array.isArray(state.bets) ? state.bets : []).filter((bet) => bet?.liveStatus === 'live' && bet.provisional !== true);
}

function compactBet(bet = {}) {
  return {
    id: clean(bet.id, 120),
    name: clean(bet.name, 300),
    description: clean(bet.description, 4000),
    origin: clean(bet.origin, 80),
    whyDistinct: clean(bet.whyDistinct, 2000),
    evidenceFor: (Array.isArray(bet.evidenceFor) ? bet.evidenceFor : []).slice(0, 50).map((item) => ({
      id: clean(item?.id, 120),
      text: clean(item?.text, 4000),
      sourceType: clean(item?.sourceType, 80),
      traceIds: cleanArray(item?.traceIds, 30, 120),
    })),
    evidenceAgainst: (Array.isArray(bet.evidenceAgainst) ? bet.evidenceAgainst : []).slice(0, 50).map((item) => ({
      id: clean(item?.id, 120),
      text: clean(item?.text, 4000),
      criterion: clean(item?.criterion, 300),
      severity: clean(item?.severity, 80),
      sourceType: clean(item?.sourceType, 80),
      traceIds: cleanArray(item?.traceIds, 30, 120),
    })),
    failureModes: (Array.isArray(bet.failureModes) ? bet.failureModes : []).slice(0, 50).map((item) => ({
      id: clean(item?.id, 120),
      text: clean(item?.text, 4000),
      severity: clean(item?.severity, 80),
      testStatus: clean(item?.testStatus, 80),
    })),
    criteria: (Array.isArray(bet.criteria) ? bet.criteria : []).slice(0, 50).map((item) => ({
      criterion: clean(item?.criterion, 300),
      score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
      reason: clean(item?.reason, 2000),
    })),
  };
}

function evidenceBasis(sourceType) {
  const labels = {
    direct_client_reply: 'Bethany House reply',
    public_fact: 'Public record',
    module_1_trace: 'Inquiry record',
    student_observation: 'Team observation',
    generated_hypothesis: 'Hypothesis to test',
  };
  return labels[clean(sourceType, 80)] || 'Current analysis';
}

function clientSeverity(value) {
  const labels = { weak: 'Limited', material: 'Material', decisive: 'Decision-changing', limited: 'Limited', catastrophic: 'Critical' };
  return labels[clean(value, 80)] || 'Material';
}

function testStatusLabel(value) {
  const labels = { resolved: 'Checked', partially_tested: 'Partly checked', untested: 'Not yet tested' };
  return labels[clean(value, 80)] || 'Not yet tested';
}

function reversibilityLabel(value) {
  const labels = { reversible: 'Reversible', costly_to_reverse: 'Costly to reverse', one_way: 'One-way commitment' };
  return labels[value] || '';
}

function criterionAssessment(value) {
  const score = Math.max(0, Math.min(1, Number(value) || 0));
  if (score >= 0.7) return 'Strong fit';
  if (score >= 0.45) return 'Mixed fit';
  return 'Weak fit';
}

function clean(value, max = 5000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function clientFacingProse(value, max = 5000) {
  const text = clean(value, max)
    .replace(/\b(?:the\s+)?course materials?\s+(describe|show|indicate|suggest|warn|state|note|include|identify|support)\b/gi, (_, verb) => `the available evidence ${singularAgreementVerb(verb)}`)
    .replace(/\b(?:the\s+)?course traces?\s+(describe|show|indicate|suggest|warn|state|note|include|identify|support)\b/gi, (_, verb) => `the current record ${singularAgreementVerb(verb)}`)
    .replace(/\b(?:the\s+)?course materials?\b/gi, 'the available evidence')
    .replace(/\b(?:the\s+)?course traces?\b/gi, 'the current record')
    .replace(/\bmodule\s*[12]\s+(?:trace|record|output)s?\b/gi, 'working record')
    .replace(/\bstudent performance\b/gi, 'work quality')
    .replace(/\bthe student team\b/gi, 'the advisory team')
    .replace(/\bthe student's\b/gi, 'the')
    .replace(/\bstudents?\b/gi, 'the advisory team')
    .replace(/\bmuch\s+(?:of\s+)?the advisory team\s+knowledge\b/gi, "much of the advisory team's knowledge")
    .replace(/\bthe advisory team\s+(describe|show|indicate|suggest|warn|state|note|include|identify|support|know)\b/gi, (_, verb) => `the advisory team ${singularAgreementVerb(verb)}`)
    .replace(/\b(the available evidence|the current record|the advisory team)([^.!?]*?)\b(and|or)\s+(describe|show|indicate|suggest|warn|state|note|include|identify|support|know)\b/gi, (_, subject, middle, conjunction, verb) => `${subject}${middle}${conjunction} ${singularAgreementVerb(verb)}`)
    .replace(/\bpartner confidence\b/gi, 'partner trust')
    .replace(/\bfalse confidence\b/gi, 'a misleading picture');
  if (/\b(?:classroom|system prompt|module prompt|language model|the app)\b/i.test(text)) return '';
  return text.split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\b(?:confidence|confident|assurance|certainty|certain|probability|probable|likelihood|likely|robustness\s+band)\b/i.test(sentence))
    .join(' ')
    .trim();
}

function singularAgreementVerb(value) {
  const verb = String(value || '').toLowerCase();
  const irregular = { have: 'has' };
  if (irregular[verb]) return irregular[verb];
  if (verb.endsWith('s')) return verb;
  if (verb.endsWith('y') && !/[aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  if (/(?:ch|sh|x|z|o)$/.test(verb)) return `${verb}es`;
  return `${verb}s`;
}

function sanitizeClientDocument(value) {
  if (Array.isArray(value)) return value.map(sanitizeClientDocument);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeClientDocument(item)]));
  }
  return typeof value === 'string' ? clientFacingProse(value, Math.max(5000, value.length)) : value;
}

function cleanArray(values, limit, max) {
  return (Array.isArray(values) ? values : []).map((value) => clean(value, max)).filter(Boolean).slice(0, limit);
}

function meaningful(value) {
  return Boolean(String(value ?? '').trim());
}
