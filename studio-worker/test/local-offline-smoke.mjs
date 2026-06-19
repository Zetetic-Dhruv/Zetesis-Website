import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ORACLE = JSON.parse(readFileSync(new URL('./fixtures/llm-source-oracle.json', import.meta.url), 'utf8'));
const CASES = Object.fromEntries(ORACLE.cases.map((testCase) => [testCase.id, testCase]));

const PORT = Number(process.env.STUDIO_TEST_PORT || 8788);
const BASE_URL = `http://localhost:${PORT}`;
const DEV_SECRET = 'dev-secret';
const RUN_ID = Date.now();
const EMAIL = `studio-test-${RUN_ID}@columbia.edu`;
const ZETESIS_EMAIL = `studio-test-${RUN_ID}@zetesislabs.com`;
const MASTER_EMAIL = `studio-master-${RUN_ID}@example.com`;
const MASTER_PASSWORD = `master-password-${RUN_ID}`;

const authHeaders = {
  'Content-Type': 'application/json',
  'X-Studio-Dev-Email': EMAIL,
  'X-Studio-Dev-Secret': DEV_SECRET,
};

const otherDomainHeaders = {
  'Content-Type': 'application/json',
  'X-Studio-Dev-Email': `studio-test-${RUN_ID}@nyu.edu`,
  'X-Studio-Dev-Secret': DEV_SECRET,
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  migrateLocal();
  const server = await startWorker();
  try {
    await runSuite();
  } finally {
    server.kill('SIGINT');
    await delay(500);
  }
}

function migrateLocal() {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'migrations', 'apply', 'zetesis_decision_manifold_studio', '--local'],
    { stdio: 'pipe', encoding: 'utf8' }
  );
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error('Local D1 migration failed');
  }
}

async function startWorker() {
  const child = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(PORT),
      '--var',
      `DEV_AUTH_SECRET:${DEV_SECRET}`,
      '--var',
      'AGENT_API_MODE:fixture',
      '--var',
      `SESSION_SECRET:test-session-secret-${RUN_ID}`,
      '--var',
      `MASTER_LOGIN_EMAIL:${MASTER_EMAIL}`,
      '--var',
      `MASTER_LOGIN_PASSWORD:${MASTER_PASSWORD}`,
      '--show-interactive-dev-session=false',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const started = await waitFor(async () => {
    if (output.includes('Ready on')) return true;
    if (child.exitCode !== null) {
      throw new Error(`Wrangler exited early:\n${output}`);
    }
    return false;
  }, 30000);

  if (!started) throw new Error(`Wrangler did not start:\n${output}`);
  return child;
}

async function runSuite() {
  const html = await fetchText('/studio');
  assert(html.includes('Decision Manifold Studio'), 'serves studio HTML');
  assert(html.includes('Gatekeepers'), 'serves gatekeeper step');
  assert(html.includes('Approve Sentence'), 'serves sentence approval control');
  assert(html.includes('Download PDF'), 'serves PDF download control');
  assert(html.includes('Approve the problem sentence, complete the gatekeeper fields, then open the PDF report.'), 'serves PDF empty state');
  assert(!html.includes('Print'), 'omits print control from report workflow');

  const me = await getJson('/api/studio/me', authHeaders);
  assert(me.authenticated === true && me.registered === false, 'dev auth works for Columbia email');

  const zetesisSession = await postJson('/api/studio/session', { email: ZETESIS_EMAIL });
  assert(zetesisSession.authenticated === true && zetesisSession.email === ZETESIS_EMAIL, 'allows Zetesis domain session login');

  const rejectedSession = await postJson('/api/studio/session', { email: `studio-test-${RUN_ID}@nyu.edu` }, {}, false);
  assert(rejectedSession.status === 403, 'rejects non-allowed email session');

  const badMasterSession = await postJson('/api/studio/session', {
    email: MASTER_EMAIL,
    password: 'wrong-password',
  }, {}, false);
  assert(badMasterSession.status === 403, 'rejects master email without the master password');

  const masterSession = await postJson('/api/studio/session', {
    email: MASTER_EMAIL,
    password: MASTER_PASSWORD,
  });
  assert(masterSession.authenticated === true && masterSession.email === MASTER_EMAIL, 'allows password-protected master login');

  const rejected = await postJson('/api/studio/register', {
    name: 'Bad Domain',
    teamName: 'Bad Domain Team',
  }, otherDomainHeaders, false);
  assert(rejected.status === 403, 'rejects non-Columbia email');

  const reg = await postJson('/api/studio/register', {
    name: 'Studio Test',
    teamName: `Offline Agent Team ${RUN_ID}`,
  }, authHeaders);
  assert(reg.user.email === EMAIL, 'registers Columbia user');
  assert(reg.team.join_code.length >= 6, 'creates team join code');
  assert(Boolean(reg.workspace), 'creates workspace');

  const parseCase = CASES['parse_intake.bethany_staffing_notes'];
  const intake = structuredClone(parseCase.input.intake);

  const parsed = await llm('parse_intake', { intake });
  assert(parsed.provider === 'offline-agent', 'offline agent substitutes for LLM API');
  assert(parsed.result.items.length >= parseCase.expected.minItems, 'parses intake into atomic items');
  assertContainsTextItems(parsed.result.items, parseCase.expected.mustContainItems, 'parsed intake matches source-grounded oracle snippets');
  assertItemsOmitFields(parsed.result.items, parseCase.expected.mustNotAddFields, 'parse_intake does not classify or judge');

  const sortCase = CASES['sort_items.four_buckets_and_attribution'];
  const sourceItems = structuredClone(sortCase.input.items);

  const sorted = await llm('sort_items', { items: sourceItems });
  const sortedById = indexById(sorted.result.items);
  assertExpectedItemList(sortedById, sortCase.expected.items, 'sort_items matches source-grounded bucket oracle');
  assert(sortedById.kk_public_service_count.bucket === 'KK', 'sorts public fact as KK');
  assert(sortedById.ku_board_approval.bucket === 'KU', 'sorts named open question as KU');
  assert(sortedById.uk_relationship_memory_heard.bucket === 'UK', 'sorts stated tacit organizational knowledge as UK');
  assert(sortedById.uu_frame_question.bucket === 'UU', 'sorts frame question as UU');
  assert(sortedById.missing_attribution_board_private_view.status === 'needs_attribution', 'does not settle item without holder/source');
  assert(!sortedById.missing_attribution_board_private_view.holder && !('veto' in sortedById.kk_public_service_count), 'keeps veto out of type sorting');
  assert(!sortedById.missing_attribution_board_private_view.holder, 'does not invent attribution');

  const valueCase = CASES['value_tag.high_for_relationship_memory'];
  const valued = await llm('value_tag', { items: valueCase.input.items.map((item) => ({ ...item, ...(sortedById[item.id] || {}) })) });
  const valuedById = indexById(valued.result.items);
  assertValueTags(valuedById, valueCase.expected.items, 'value_tag matches oracle for high-value items');
  assert(valuedById.uk_relationship_memory_heard.valueTag === 'High', 'tags UK relationship-memory item high value');

  const drillCase = CASES['drill_scaffold.staffing_gap_source_example'];
  const drill = await llm('drill_scaffold', drillCase.input);
  assertDrillResult(drill.result, drillCase.expected);

  const questionCase = CASES['question_reengineer.growth_question_axes'];
  const sharpened = await llm('question_reengineer', questionCase.input);
  const variants = sharpened.result.variants.join(' ');
  assert((sharpened.result.variants || []).length >= questionCase.expected.variants.minCount, 'question sharpening returns enough variants');
  assertIncludesAll(variants, questionCase.expected.variants.mustCoverAxes, 'question sharpening includes source axes');
  assertIncludesAll(sharpened.result.ownerFlag, [questionCase.expected.ownerFlagMustIndicate], 'question sharpening flags named-owner requirement');

  const strongCase = CASES['one_sentence_check.staffing_gap_strong'];
  const sentence = await llm('one_sentence_check', strongCase.input);
  assertOneSentence(sentence.result, strongCase.expected, 'recognizes relationship-continuity reframe as strong');

  const weakCase = CASES['one_sentence_check.staffing_gap_weak'];
  const weakSentence = await llm('one_sentence_check', weakCase.input);
  assertOneSentence(weakSentence.result, weakCase.expected, 'blocks sentence without rules-in/rules-out');

  for (const guardCase of [CASES['guardrail.private_ceo_meaning'], CASES['guardrail.no_uk_uu_autofill']]) {
    const guardrail = await llm(guardCase.module, guardCase.input);
    assertSourceGuardrail(guardCase, guardrail.result);
  }

  const reportCase = CASES['final_report.assembled_only'];
  const finalState = {
    intake,
    ...structuredClone(reportCase.input.state),
    finalReport: {},
  };

  const report = await llm('final_report', { state: finalState });
  assert(report.result.document?.title === 'Decision Manifold Studio Final Report', 'final report returns PDF-ready document JSON');
  assert(report.result.document?.highValueQuestions?.length === 1, 'final report includes only complete high-value gatekeeper questions');
  assert(report.result.document?.typeMap?.length >= 2, 'final report document includes complete and incomplete items in type map');
  assert(/omitted/i.test(report.result.document?.guardrailNote || ''), 'final report notes omitted incomplete high-value items');
  assertIncludesAll(report.result.markdown, reportCase.expected.markdownMustInclude, 'final report includes oracle sections and strong reframe');

  finalState.finalReport.document = report.result.document;
  finalState.finalReport.markdown = report.result.markdown;
  const saved = await putJson('/api/studio/workspace', { state: finalState, currentStep: 'report' }, authHeaders);
  assert(saved.ok === true, 'saves workflow state');
  const loaded = await getJson('/api/studio/workspace', authHeaders);
  assert(/relationship-continuity problem/i.test(loaded.state.finalReport.markdown), 'loads saved offline D1 state');
  assert(loaded.state.finalReport.document?.typeMap?.length >= 1, 'loads saved PDF-ready document state');

  console.log('All local offline Studio tests passed.');
}

async function llm(module, payload) {
  return postJson('/api/studio/llm', { module, payload }, authHeaders);
}

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.text();
}

async function getJson(path, headers) {
  const response = await fetch(`${BASE_URL}${path}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function putJson(path, body, headers) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function postJson(path, body, headers, throwOnError = true) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (throwOnError && !response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(data)}`);
  }
  return throwOnError ? data : { status: response.status, data };
}

function indexById(items) {
  return Object.fromEntries((items || []).map((item) => [item.id, item]));
}

function assertContainsTextItems(items, expectations, message) {
  for (const expected of expectations) {
    const snippet = expected.rawTextIncludes || expected.text;
    const found = items.some((item) => (
      item.sourceField === expected.sourceField
      && textIncludes(item.rawText, snippet)
    ));
    assert(found, `${message}: ${expected.sourceField} contains "${snippet}"`);
  }
}

function assertItemsOmitFields(items, fields, message) {
  for (const item of items) {
    for (const field of fields) {
      assert(!(field in item), `${message}: item omits ${field}`);
    }
  }
}

function assertExpectedItemList(actualById, expectedItems, message) {
  for (const expected of expectedItems) {
    const actual = actualById[expected.id];
    assert(Boolean(actual), `${message}: found ${expected.id}`);
    for (const field of ['bucket', 'status', 'holder', 'veto']) {
      if (!(field in expected)) continue;
      assert(
        (actual[field] || '') === expected[field],
        `${message}: ${expected.id}.${field} is ${JSON.stringify(expected[field])}`
      );
    }
    if (expected.aiNotesMustIncludeOneOf) {
      assert(includesAny(actual.aiNotes, expected.aiNotesMustIncludeOneOf), `${message}: ${expected.id}.aiNotes explains guardrail`);
    }
  }
}

function assertValueTags(actualById, expectedItems, message) {
  for (const expected of expectedItems) {
    const actual = actualById[expected.id];
    assert(Boolean(actual), `${message}: found ${expected.id}`);
    if (expected.valueTag) {
      assert(actual.valueTag === expected.valueTag, `${message}: ${expected.id}.valueTag is ${expected.valueTag}`);
    }
    if (expected.allowedValueTags) {
      assert(expected.allowedValueTags.includes(actual.valueTag), `${message}: ${expected.id}.valueTag is allowed`);
    }
    if (expected.rationaleMustMentionOneOf) {
      assert(includesAny(actual.valueRationale, expected.rationaleMustMentionOneOf), `${message}: ${expected.id}.rationale is item-specific`);
    }
  }
}

function assertDrillResult(result, expected) {
  assert((result.claimOptions || []).length >= expected.claimOptions.minCount, 'drill returns enough claim options');
  assert(includesAny(result.claimOptions.join(' '), expected.claimOptions.mustIncludeOneOf), 'drill keeps staffing-gap/resourcing assumption visible');
  assert((result.angles || []).length >= expected.angles.minCount, 'drill returns enough prompt angles');
  assertIncludesAll(result.angles.join(' '), expected.angles.mustInclude, 'drill points toward relationship-continuity source example');
  assert(result.frameQuestion === expected.frameQuestion, 'drill returns the source frame question');
}

function assertOneSentence(result, expected, message) {
  assert(result.verdict === expected.verdict, message);
  assertIncludesAll((result.missingFields || []).join(' '), expected.missingFields || [], `${message}: missing fields match`);
  assert(includesAny(result.reasoning, expected.reasoningMustIncludeOneOf || []), `${message}: reasoning explains verdict`);
  if (expected.mustNotSupplyReplacementSentence) {
    assert(!('replacementSentence' in result), `${message}: does not write replacement sentence`);
  }
}

function assertSourceGuardrail(guardCase, result) {
  if (guardCase.id === 'guardrail.private_ceo_meaning') {
    assert((result.claimOptions || []).length === guardCase.expected.claimOptions.length, `${guardCase.id} refuses to produce claim options`);
    assert(includesAny(result.frameQuestion, guardCase.expected.redirectMustAskFor), `${guardCase.id} redirects to real conversation evidence`);
    return;
  }
  if (guardCase.id === 'guardrail.no_uk_uu_autofill') {
    assertExpectedItemList(indexById(result.items || []), guardCase.expected.items, `${guardCase.id} refuses UK/UU autofill`);
    return;
  }
  throw new Error(`Unknown guardrail case: ${guardCase.id}`);
}

function assertIncludesAll(text, snippets, message) {
  assert(includesAll(text, snippets), message);
}

function includesAll(text, snippets) {
  return snippets.every((snippet) => textIncludes(text, snippet));
}

function includesAny(text, snippets) {
  return snippets.some((snippet) => textIncludes(text, snippet));
}

function textIncludes(text, snippet) {
  return String(text || '').toLowerCase().includes(String(snippet || '').toLowerCase());
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`ok - ${message}`);
}

async function waitFor(fn, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await fn()) return true;
    await delay(150);
  }
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
