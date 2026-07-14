import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Agent, setGlobalDispatcher } from 'undici';
import {
  module2FrameNeedsExplicitReview,
  module2LockTransitionJudgments,
  module2SetNeedsExplicitReview,
} from '../src/module2-page.js';

setGlobalDispatcher(new Agent({
  headersTimeout: 600_000,
  bodyTimeout: 600_000,
  connectTimeout: 30_000,
}));

const PORT = Number(process.env.STUDIO_LIVE_TEST_PORT || 8796);
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT = resolve(process.argv[2] || 'calibration/stage8-live-model-runs.json');
const RUN_ID = Date.now();
const PASSWORD = `module2-live-${RUN_ID}`;
const STUDENT_CODE = process.env.STUDENT_CLASS_CODE || 'ZetesisColumbia@2026';
const ADMIN_CODE = process.env.ADMIN_CLASS_CODE || 'ZeteticAdmin@8917';
const scenarios = [
  {
    id: 'clean-grounded-reply',
    problemSeed: 'How should Bethany House add staffing capacity without losing partner continuity or accountability?',
    rawReply: [
      'Bethany House confirmed that partner continuity matters during the staffing transition.',
      'Program leadership needs a clear owner for implementation and failed handoffs.',
      'The sequence should protect service delivery while adding capacity.',
    ].join('\n'),
  },
  {
    id: 'forwarded-two-voice-reply',
    problemSeed: 'What staffing design adds capacity while protecting relationship memory and board confidence?',
    rawReply: [
      'Forwarded reply from Bethany House',
      'Executive Director: We cannot lose continuity with long-standing partners during a transition.',
      'Board member: We also need cost visibility and a named point of accountability.',
      'Operations lead: A phased handoff is workable if ownership is explicit.',
      'Sent from my phone',
    ].join('\n'),
  },
  {
    id: 'minimal-lazy-reply',
    problemSeed: 'How can Bethany House relieve the current capacity constraint without making relationship continuity more fragile?',
    rawReply: [
      'We need added capacity.',
      'Keep partner history intact.',
      'Program leadership must own the handoff.',
    ].join('\n'),
  },
];

const server = await startWorker();
const audit = {
  createdAt: new Date().toISOString(),
  workerUrl: BASE_URL,
  models: { standard: 'gpt-5.4-mini', highQuality: 'gpt-5.5' },
  runs: [],
};

try {
  const admin = createSession('admin');
  await post('/api/instructor/auth/register', {
    name: 'Stage 8 Review Admin',
    email: `stage8-admin-${RUN_ID}@example.com`,
    password: PASSWORD,
    classCode: ADMIN_CODE,
  }, admin);

  for (const [index, scenario] of scenarios.entries()) {
    const student = createSession(`student-${index + 1}`);
    const registration = await post('/api/studio/auth/register', {
      name: `Stage 8 Student ${index + 1}`,
      email: `stage8-student-${RUN_ID}-${index + 1}@example.com`,
      password: PASSWORD,
      classCode: STUDENT_CODE,
    }, student);
    const ground = await post('/api/studio/modules/module-2/ground', {
      problemSeed: scenario.problemSeed,
      rawReply: scenario.rawReply,
      solutions: [
        {
          id: `phased-handoff-${index + 1}`,
          name: 'Phased relationship handoff',
          description: 'Add capacity in stages while explicitly transferring partner history and decision ownership.',
        },
        {
          id: `split-ownership-${index + 1}`,
          name: 'Separate operational and people ownership',
          description: 'Place executive coordination and people-system responsibility under distinct accountable owners.',
        },
      ],
      mergeChoice: 'replace',
    }, student);
    assert(ground.state.bets.length === 2, `${scenario.id}: ground admits two student alternatives`);

    const reconcile = await modelCall('m2_reconcile', student);
    assert(reconcile.state.ground.relevance.status === 'relevant', `${scenario.id}: reconciliation recognizes assignment relevance`);
    assert(reconcile.state.ground.substantiveLines.length >= 2, `${scenario.id}: reconciliation preserves substantive client lines`);
    const returnedContextIds = (reconcile.result.relevance?.matchedTraceIds || [])
      .filter((id) => /^(?:course|public)_/.test(String(id)));
    assert(
      returnedContextIds.every((id) => reconcile.state.ground.relevance.matchedTraceIds.includes(id)),
      `${scenario.id}: valid supplied context provenance survives deterministic admission`,
    );
    assert(reconcile.state.ground.voiceDisagreement.humanConfirmed === false, `${scenario.id}: model cannot confirm a voice disagreement`);
    if (scenario.id === 'forwarded-two-voice-reply') {
      assert(reconcile.state.ground.voiceDisagreement.status === 'possible', `${scenario.id}: explicitly attributed voices remain available for human review`);
    } else {
      assert(reconcile.state.ground.voiceDisagreement.status === 'none', `${scenario.id}: unattributed priorities do not create a voice-review burden`);
    }
    const reviewedState = structuredClone(reconcile.state);
    reviewedState.ground.possibleDuplicates = reviewedState.ground.possibleDuplicates.map((pair) => ({ ...pair, status: 'dismissed' }));
    await put('/api/studio/modules/module-2/workspace', { state: reviewedState, currentStep: 'board', status: 'draft' }, student);

    let suggest = await modelCall('m2_suggest_options', student);
    if (!suggest.result.options.length) {
      console.log(`retry - ${scenario.id}: first option-generation call found no distinct mechanism`);
      suggest = await modelCall('m2_suggest_options', student);
    }
    assert(suggest.result.options.length >= 1, `${scenario.id}: model identifies at least one different mechanism`);
    const generated = suggest.state.bets.filter((bet) => bet.origin === 'generated');
    assert(generated.length >= 1, `${scenario.id}: at least one imagined mechanism survives grounding and duplicate checks`);
    assert(generated.every((bet) => bet.provisional === true), `${scenario.id}: generated options remain provisional`);
    assert(distinctNames(generated.map((bet) => bet.name)), `${scenario.id}: generated options are not duplicate labels`);
    const admittedSuggestion = await post(`/api/studio/modules/module-2/bets/${encodeURIComponent(generated[0].id)}/admit`, {}, student);
    assert(admittedSuggestion.state.bets.find((bet) => bet.id === generated[0].id)?.provisional === false, `${scenario.id}: explicit admission transition promotes the chosen generated option`);

    const evaluate = await modelCall('m2_evaluate_bets', student);
    const admitted = evaluate.state.bets.filter((bet) => bet.liveStatus === 'live' && bet.provisional !== true);
    assert(admitted.length === 3, `${scenario.id}: student-admitted comparison field contains three mechanisms`);
    assert(admitted.every((bet) => bet.evaluationStatus === 'complete'), `${scenario.id}: every admitted alternative has a complete common-field evaluation`);
    assert(evaluate.state.ranking.orderedBetIds.length >= 1, `${scenario.id}: deterministic ranking identifies at least one leading option`);
    const accountedBetIds = new Set([
      ...evaluate.state.ranking.orderedBetIds,
      ...(evaluate.state.ranking.dominanceRelations || []).map((relation) => relation.dominatedBetId),
    ]);
    assert(admitted.every((bet) => accountedBetIds.has(bet.id)), `${scenario.id}: ranking and dominance records account for the complete admitted field`);
    assert(!evaluate.state.locks.selectedBetId, `${scenario.id}: model does not choose the recommendation`);
    assert(!JSON.stringify(evaluate).toLowerCase().includes('confidence score'), `${scenario.id}: evaluation does not expose candidate confidence`);

    const selectedBetId = evaluate.state.ranking.orderedBetIds[0];
    const frameNeedsReview = module2FrameNeedsExplicitReview(evaluate.state.ground.frameComparison?.status, evaluate.state.locks.frameConfirmation);
    const setNeedsReview = module2SetNeedsExplicitReview(evaluate.state.ranking.coverage?.status, evaluate.state.locks.setCompletenessConfirmation);
    if (scenario.id === 'clean-grounded-reply') {
      assert(!frameNeedsReview, `${scenario.id}: a consistent frame stays on the soft clean path`);
      assert(!setNeedsReview, `${scenario.id}: a covered comparison set stays on the soft clean path`);
    }
    const lockTransition = module2LockTransitionJudgments({
      frameStatus: evaluate.state.ground.frameComparison?.status,
      frameConfirmation: evaluate.state.locks.frameConfirmation,
      coverageStatus: evaluate.state.ranking.coverage?.status,
      setConfirmation: evaluate.state.locks.setCompletenessConfirmation,
      selectedBetId,
    });
    if (frameNeedsReview) lockTransition.frameConfirmation = 'confirmed';
    if (setNeedsReview) lockTransition.setCompletenessConfirmation = 'confirmed_after_review';
    let judged = await post('/api/studio/modules/module-2/judgments', lockTransition, student);
    assert(judged.state.locks.frameConfirmation === 'confirmed', `${scenario.id}: Take to Lock persists the frame judgment`);
    assert(['confirmed', 'confirmed_after_review'].includes(judged.state.locks.setCompletenessConfirmation), `${scenario.id}: Take to Lock persists the comparison-set judgment`);
    assert(judged.state.locks.selectedBetId === selectedBetId, `${scenario.id}: explicit recommendation choice is persisted`);
    await expectRequestFailure('POST', '/api/studio/llm', { module: 'm2_package', payload: {} }, student, 409, `${scenario.id}: package is blocked before consequence and reversibility judgments`);
    judged = await post('/api/studio/modules/module-2/judgments', {
      lossBearer: 'Program staff and partner-facing teams',
      accountabilityLocation: 'Program leadership owns the recommendation and any repair after a failed handoff.',
      reversibility: 'costly_to_reverse',
      reversibilityNote: 'A failed transition would require deliberate relationship repair.',
      heldConstant: [
        'The supplied Bethany House reply is the current client record.',
        'Material new client evidence can reopen the comparison.',
      ],
    }, student);
    assert(judged.status === 'locked', `${scenario.id}: explicit Lock judgments produce a locked workspace`);
    const packaged = await modelCall('m2_package', student);
    const document = packaged.result.document;
    const selected = judged.state.bets.find((bet) => bet.id === judged.state.locks.selectedBetId);
    assert(document.title === 'Bethany House Recommendation Brief', `${scenario.id}: package uses the client deliverable title`);
    assert(document.recommendation.name === selected.name, `${scenario.id}: package preserves the human-selected recommendation`);
    assert(document.candidates.length === 3, `${scenario.id}: package retains the complete admitted comparison field`);
    assert(respectfulDocument(document), `${scenario.id}: package passes Bethany-respect language checks`);
    assert(!/\b(?:confidence|confident|assurance|certainty|probability|likelihood|robustness\s+band)\b/i.test(JSON.stringify(document)), `${scenario.id}: package makes no unaudited confidence-family claim`);

    const prompts = await get(`/api/instructor/students/${registration.user.id}/prompts?workflow=module_2`, admin);
    const promptModules = new Set(prompts.prompts.map((run) => run.module));
    assert(['m2_reconcile', 'm2_suggest_options', 'm2_evaluate_bets', 'm2_package'].every((module) => promptModules.has(module)), `${scenario.id}: instructor trace contains every required model step`);
    assert(prompts.prompts.length >= 4 && prompts.prompts.length <= 5, `${scenario.id}: live workflow uses at most one bounded option-generation retry`);
    assert(prompts.prompts.every((run) => run.provider === 'openai'), `${scenario.id}: no call silently falls back from OpenAI`);
    const workflowCostMicros = prompts.prompts.reduce((sum, run) => sum + Number(run.estimated_cost_micros || 0), 0);
    audit.runs.push({
      scenario: scenario.id,
      studentId: registration.user.id,
      workflowCostMicros,
      calls: prompts.prompts.map((run) => ({
        module: run.module,
        model: run.model,
        inputTokens: Number(run.input_tokens || 0),
        outputTokens: Number(run.output_tokens || 0),
        estimatedCostMicros: Number(run.estimated_cost_micros || 0),
      })),
      outputs: {
        reconcile: {
          rawModelOutput: reconcile.result,
          appliedState: {
            relevance: reconcile.state.ground.relevance,
            frameComparison: reconcile.state.ground.frameComparison,
            voiceDisagreement: reconcile.state.ground.voiceDisagreement,
            coverage: reconcile.state.ranking.coverage,
          },
        },
        suggestOptions: suggest.result,
        evaluateBets: evaluate.result,
        package: packaged.result,
      },
      selectedBet: selected.name,
      rankedBetIds: evaluate.state.ranking.orderedBetIds,
    });
    writeFileSync(OUTPUT, `${JSON.stringify(withSummary(audit), null, 2)}\n`);
  }

  const completed = withSummary(audit);
  assert(completed.summary.medianWorkflowUsd < 0.75, 'median complete workflow cost stays below $0.75');
  assert(completed.summary.p95WorkflowUsd < 2, 'p95 complete workflow cost stays below $2.00');
  writeFileSync(OUTPUT, `${JSON.stringify(completed, null, 2)}\n`);
  console.log(`Live Module 2 semantic battery passed: ${OUTPUT}`);
  console.log(JSON.stringify(completed.summary));
} finally {
  server.kill('SIGINT');
  await delay(400);
}

function createSession(name) {
  return { name, cookie: '' };
}

async function modelCall(module, session) {
  const response = await post('/api/studio/llm', { module, payload: {} }, session);
  assert(response.provider === 'openai', `${module}: OpenAI provider is live`);
  return response;
}

async function startWorker() {
  const child = spawn('npx', [
    'wrangler', 'dev', '--local', '--route', 'localhost/*', '--port', String(PORT),
    '--var', 'LOCAL_DEV_MODE:true', '--var', 'AGENT_API_MODE:openai',
    '--show-interactive-dev-session=false',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const ready = await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`Wrangler exited before readiness:\n${output}`);
    try {
      const response = await fetch(`${BASE_URL}/decision-engineering/module-2`);
      return response.ok;
    } catch {
      return false;
    }
  }, 30000);
  if (!ready) throw new Error(`Wrangler did not become ready:\n${output}`);
  return child;
}

async function request(method, path, body, session) {
  const headers = { 'Content-Type': 'application/json' };
  if (session?.cookie) headers.Cookie = session.cookie;
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie && session) session.cookie = setCookie.split(';')[0];
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

function post(path, body, session) {
  return request('POST', path, body, session);
}

function put(path, body, session) {
  return request('PUT', path, body, session);
}

function get(path, session) {
  return request('GET', path, undefined, session);
}

async function expectRequestFailure(method, path, body, session, status, message) {
  const headers = { 'Content-Type': 'application/json' };
  if (session?.cookie) headers.Cookie = session.cookie;
  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: JSON.stringify(body) });
  assert(response.status === status, message);
}

function distinctNames(options) {
  const normalized = options.map((name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  return new Set(normalized).size === normalized.length;
}

function respectfulDocument(document) {
  const text = JSON.stringify(document).toLowerCase();
  return ![
    'bethany lacks',
    'bethany failed',
    'bethany cannot',
    'the team is not assuming',
    'we are not assuming',
    'obviously',
    'simply needs to',
  ].some((phrase) => text.includes(phrase));
}

function withSummary(audit) {
  const costs = audit.runs.map((run) => run.workflowCostMicros / 1_000_000).sort((a, b) => a - b);
  const median = costs.length ? costs[Math.floor(costs.length / 2)] : 0;
  const p95 = costs.length ? costs[Math.min(costs.length - 1, Math.ceil(costs.length * 0.95) - 1)] : 0;
  return {
    ...audit,
    summary: {
      completedWorkflows: costs.length,
      medianWorkflowUsd: median,
      p95WorkflowUsd: p95,
      totalReviewUsd: costs.reduce((sum, cost) => sum + cost, 0),
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`ok - ${message}`);
}

async function waitFor(fn, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await delay(150);
  }
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
