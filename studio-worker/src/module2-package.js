export function module2PackageReadinessError(state = {}) {
  const live = admittedLiveBets(state);
  const selected = live.find((bet) => bet.id === state.locks?.selectedBetId);
  if (state.ground?.relevance?.status !== 'relevant') return 'Reconcile a relevant Bethany House reply before packaging.';
  if (state.ground?.voiceDisagreement?.status === 'possible') return 'Confirm whether the attributed voices disagree before packaging.';
  if (!['confirmed', 'revised'].includes(state.locks?.frameConfirmation)) return 'Confirm or revise the decision frame before packaging.';
  if (!['confirmed', 'confirmed_after_review'].includes(state.locks?.setCompletenessConfirmation)) return 'Confirm the complete comparison set before packaging.';
  if (state.ranking?.coverage?.status !== 'covered' || state.ranking?.evaluationIncomplete) return 'Complete the common comparison field before packaging.';
  if (state.ranking?.weakField) return 'Add another credible, non-dominated alternative before packaging.';
  if (live.length < 2) return 'Keep at least two credible live alternatives in the comparison field.';
  if (!selected) return 'Choose the bet the team is prepared to carry.';
  const leaderId = state.ranking?.orderedBetIds?.[0] || '';
  if (leaderId && selected.id !== leaderId && !isLeadingTieChoice(state, selected.id) && !hasConvictionReason(state.locks?.convictionNote)) return 'Explain with a concrete consequence or evidence why the team is carrying a bet that does not lead the current comparison.';
  if (!hasLossBearer(state.locks?.lossBearer)) return 'Name the specific person, role, or group that absorbs the loss if the recommendation fails.';
  if (!hasAccountabilityStatement(state.locks?.accountabilityLocation)) return 'State concretely where accountability sits and who must respond.';
  if (!['reversible', 'costly_to_reverse', 'one_way'].includes(state.locks?.reversibility)) return 'Judge how reversible the recommendation is.';
  if (!hasReversibilityReason(state.locks?.reversibilityNote, state.locks?.reversibility)) return 'Explain the commitment, recovery path, or cost that makes this reversibility judgment true.';
  return '';
}

export function module2LockDetailsError(details = {}) {
  if (!hasLossBearer(details.lossBearer)) return 'Name a specific person, role, or group as the loss bearer.';
  if (!hasAccountabilityStatement(details.accountabilityLocation)) return 'Describe where accountability sits and who must respond.';
  if (!['reversible', 'costly_to_reverse', 'one_way'].includes(details.reversibility)) return 'Choose how reversible the recommendation is.';
  if (!hasReversibilityReason(details.reversibilityNote, details.reversibility)) return 'Explain the commitment, recovery path, or cost behind the reversibility judgment.';
  return '';
}

export function module2ConvictionError(value) {
  return hasConvictionReason(value)
    ? ''
    : 'Explain with a concrete consequence or evidence why this non-leading bet should be carried.';
}

export function module2PackageInput(state = {}) {
  const live = admittedLiveBets(state);
  const byId = new Map(live.map((bet) => [bet.id, bet]));
  const ordered = (state.ranking?.orderedBetIds || []).map((id) => byId.get(id)).filter(Boolean);
  for (const bet of live) if (!ordered.some((item) => item.id === bet.id)) ordered.push(bet);
  const selected = byId.get(state.locks?.selectedBetId) || null;
  const selectedPosition = selected ? ordered.findIndex((bet) => bet.id === selected.id) + 1 : 0;
  return {
    decisionFrame: clean(state.ground?.frameComparison?.groundedFrame || state.inheritance?.frame || state.ground?.problemSeed, 3000),
    selectedBet: selected ? compactBet(selected) : null,
    selectedPosition,
    selectionBasis: selectedPosition === 1 ? 'comparison_leader' : isLeadingTieChoice(state, selected?.id) ? 'tie_choice' : 'accountable_human_override',
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
      convictionNote: clean(state.locks?.convictionNote, 3000),
    },
  };
}

export function fallbackModule2Package(state = {}) {
  const input = module2PackageInput(state);
  const selected = input.selectedBet || {};
  const selectedIndex = input.candidates.findIndex((item) => item.id === selected.id);
  const comparisonLine = input.candidates[selectedIndex]?.comparisonLine || '';
  const override = input.selectionBasis === 'accountable_human_override';
  const tieChoice = input.selectionBasis === 'tie_choice';
  const leadingName = input.candidates[0]?.name || 'another live option';
  const leadingReason = tieChoice
    ? `The comparison produced an effective tie between the leading options. The advisory team selected ${selected.name || 'this option'} as the position it is prepared to carry.`
    : override
    ? `The comparison placed ${leadingName} first. The advisory team carries ${selected.name || 'the selected option'} instead because ${input.humanJudgments.convictionNote}`
    : comparisonLine || `${selected.name || 'The selected option'} remains the team's preferred path under the current evidence.`;
  return {
    executiveFraming: `Bethany House is choosing how to add operating capacity without losing the relationships and accountability the work depends on.`,
    recommendationSummary: selected.description || `${selected.name || 'The selected option'} is the current recommendation.`,
    recommendationRationale: leadingReason,
    currentPositionStatement: tieChoice
      ? `${selected.name || 'The selected option'} is the advisory team's choice from an effectively tied leading pair.`
      : override
      ? `${leadingName} leads the weighted comparison. The advisory team has deliberately selected ${selected.name || 'the selected option'} for the reason stated above.`
      : `${selected.name || 'The selected option'} leads the current comparison and is the team's recommendation after review of ${Math.max(0, input.candidates.length - 1)} live alternative${input.candidates.length === 2 ? '' : 's'}.`,
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
  const override = input.selectionBasis !== 'comparison_leader';
  const fallback = fallbackModule2Package(state);
  const commentary = new Map((override ? [] : Array.isArray(modelResult.candidateCommentary) ? modelResult.candidateCommentary : [])
    .map((item) => [clean(item?.betId, 120), item || {}]));
  const modelText = (key, max = 5000) => override
    ? clientFacingProse(fallback[key], max)
    : clientFacingProse(modelResult[key], max) || clientFacingProse(fallback[key], max);
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
        criterion: criterionLabel(item.criterion),
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
      summary: override ? clientFacingProse(selected.description, 5000) : modelText('recommendationSummary'),
      rationale: override ? clientFacingProse(fallback.recommendationRationale, 5000) : modelText('recommendationRationale'),
    },
    currentPositionStatement: override ? clientFacingProse(fallback.currentPositionStatement, 5000) : modelText('currentPositionStatement'),
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
    .replace(/\bBethany(?: House)? lacks ([^.!?]+)/gi, (_, requirement) => `the required ${requirement.trim()} may not yet be available within Bethany House`)
    .replace(/\bBethany(?: House)? failed to ([^.!?]+)/gi, (_, action) => `the current record does not show that Bethany House has ${action.trim()}`)
    .replace(/\bBethany(?: House)? cannot ([^.!?]+)/gi, (_, action) => `it may not be feasible for Bethany House to ${action.trim()}`)
    .replace(/\b(?:the\s+)?course materials?\s+(describe|show|indicate|suggest|warn|state|note|include|identify|support)\b/gi, (_, verb) => `the available evidence ${singularAgreementVerb(verb)}`)
    .replace(/\b(?:the\s+)?course traces?\s+(describe|show|indicate|suggest|warn|state|note|include|identify|support)\b/gi, (_, verb) => `the current record ${singularAgreementVerb(verb)}`)
    .replace(/\b(?:the\s+)?course materials?\b/gi, 'the available evidence')
    .replace(/\b(?:the\s+)?course traces?\b/gi, 'the current record')
    .replace(/\b(?:the\s+)?course warning\b/gi, 'the evidence limitation')
    .replace(/\bthe available evidence frame\b/gi, 'the available evidence frames')
    .replace(/\b(?:supported by\s+)?supplied the current record\b/gi, 'supported by the current record')
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
  const filtered = text.split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\b(?:confidence|confident|assurance|certainty|certain|probability|probable|likelihood|likely|robustness\s+band)\b/i.test(sentence))
    .join(' ')
    .trim();
  return filtered.replace(/(^|[.!?]\s+)([a-z])/g, (_, boundary, letter) => `${boundary}${letter.toUpperCase()}`);
}

function criterionLabel(value) {
  const normalized = clean(value, 300).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
}

function substantiveJudgment(value, minWords, minChars) {
  const text = clean(value, 3000);
  if (text.length < minChars) return false;
  if (/^(?:n\/?a|none|test|testing|asdf\w*|unknown|tbd|someone|somebody|something|whatever|idk|not sure|placeholder|later)$/i.test(text)) return false;
  if (/^(.)\1{2,}$/i.test(text.replace(/\s+/g, ''))) return false;
  return (text.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/gi) || []).length >= minWords;
}

function hasLossBearer(value) {
  const text = clean(value, 800);
  if (!substantiveJudgment(text, 1, 4)) return false;
  const namedPerson = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);
  const roleOrGroup = /\b(?:staff|team|lead|leader|leadership|director|executive|board|partner|resident|client|women|children|famil(?:y|ies)|community|funder|employee|manager|supervisor|coordinator|officer|owner|sponsor|program|operations|volunteer|vendor|stakeholder)s?\b/i.test(text);
  return namedPerson || roleOrGroup;
}

function hasAccountabilityStatement(value) {
  const text = clean(value, 3000);
  if (!substantiveJudgment(text, 5, 28) || !hasLossBearer(text)) return false;
  const accountableAction = /\b(?:own|owns|responsib\w*|respond\w*|repair\w*|approve\w*|decid\w*|escalat\w*|monitor\w*|report\w*|pause\w*|revers\w*|correct\w*|resolv\w*|carry|carries|absorb\w*)\b/i.test(text);
  const consequence = /\b(?:failure|loss|harm|cost|service|relationship|handoff|decision|risk|consequence|recovery|response|delivery|implementation|disruption|complaint|escalation)\w*\b/i.test(text);
  return accountableAction && consequence;
}

function hasReversibilityReason(value, reversibility) {
  const text = clean(value, 3000);
  if (!substantiveJudgment(text, 5, 28)) return false;
  const causal = /\b(?:because|if|would|will|require\w*|need\w*|after|once|without|means|makes)\b/i.test(text);
  const cues = {
    reversible: /\b(?:revis\w*|chang\w*|adjust\w*|pause\w*|revers\w*|undo\w*|restore\w*|return\w*|cancel\w*|stop\w*|rollback|boundary|boundaries)\b/i,
    costly_to_reverse: /\b(?:cost\w*|repair\w*|recover\w*|rebuild\w*|restore\w*|trust|disrupt\w*|time|resource\w*|relationship\w*|service\w*|handoff\w*|reputation\w*)\b/i,
    one_way: /\b(?:irrevers\w*|cannot|permanent\w*|commit\w*|contract\w*|purchas\w*|terminat\w*|closure|public|trust|loss)\b/i,
  };
  return causal && Boolean(cues[reversibility]?.test(text));
}

function hasConvictionReason(value) {
  const text = clean(value, 3000);
  if (!substantiveJudgment(text, 6, 30)) return false;
  const comparison = /\b(?:option|bet|leader|comparison|alternative|choice|rank\w*|instead|than|outweigh\w*)\b/i.test(text);
  const reason = /\b(?:evidence|reply|record|fact|constraint|risk|failure|loss|consequence|cost|harm|impact|because|despite|although|protect\w*|preserv\w*|avoid\w*|contain\w*)\b/i.test(text);
  return comparison && reason;
}

function isLeadingTieChoice(state, selectedId) {
  return Boolean(state.ranking?.nearTie && selectedId && (state.ranking?.orderedBetIds || []).slice(0, 2).includes(selectedId));
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
