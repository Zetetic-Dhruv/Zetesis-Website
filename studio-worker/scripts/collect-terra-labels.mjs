import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const inputPath = resolve(process.argv[2] || '');
const outputPath = resolve(process.argv[3] || '');
if (!process.env.OPENAI_API_KEY || !process.argv[2] || !process.argv[3]) {
  throw new Error('Usage: OPENAI_API_KEY=... node scripts/collect-terra-labels.mjs input.json output.json');
}

const fixture = JSON.parse(readFileSync(inputPath, 'utf8'));
const output = readExisting(outputPath, fixture.partition);
for (const [caseIndex, testCase] of fixture.cases.entries()) {
  const existing = output.cases.find((item) => item.caseId === testCase.id);
  const judgments = existing?.judgments || [];
  while (judgments.length < 3) {
    const panelIndex = judgments.length;
    const judgment = await judge(testCase, panelIndex);
    judgments.push(judgment);
    upsert(output.cases, { caseId: testCase.id, judgments });
    output.usage.inputTokens += judgment.usage.inputTokens;
    output.usage.outputTokens += judgment.usage.outputTokens;
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`${fixture.partition} ${caseIndex + 1}/${fixture.cases.length} panel ${panelIndex + 1}/3`);
  }
}

console.log(`Completed ${output.cases.length * 3} independent Terra judgments.`);

async function judge(testCase, panelIndex) {
  const live = testCase.matrix.alternatives.filter((item) => item.liveStatus === 'live');
  const orderSeed = randomBytes(16).toString('hex');
  const ordered = seededShuffle(live, orderSeed);
  const blindedMatrix = {
    ...testCase.matrix,
    alternatives: ordered,
  };
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      noScore: { type: 'boolean' },
      selectedBand: { type: 'string', enum: ['Low', 'Moderate', 'High', 'NoScore'] },
      robustnessOrder: { type: 'array', items: { type: 'string' } },
      rationale: { type: 'string' },
    },
    required: ['noScore', 'selectedBand', 'robustnessOrder', 'rationale'],
  };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.6-terra',
      reasoning: { effort: 'medium' },
      input: [
        {
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'You are a blinded decision-robustness judge. Judge robustness of the current recommendation position, never probability of client success. Evidence against is dominant; ranking stability is second; fog exposure third; untested failure modes fourth. An unresolved hard stop, fewer than two credible live alternatives, or an incomplete common comparison field produces NoScore. Rejected, dominated, duplicate, and strawman alternatives do not count as live. Near ties, weak fields, material evidence against, and materially unresolved fog cannot be High. Decisive sourced contradiction, collapsed fog independence, critical unresolved failure exposure, and an ungrounded generated selection cannot exceed Low. Do not infer facts outside the supplied matrix.',
          }],
        },
        {
          role: 'user',
          content: [{
            type: 'input_text',
            text: `If a hard stop applies, return noScore=true, selectedBand=NoScore, and an empty robustnessOrder. Otherwise rank every live alternative exactly once from most to least robust and label the selected bet. Candidate order is arbitrary.\n\n${JSON.stringify(blindedMatrix)}`,
          }],
        },
      ],
      text: { format: { type: 'json_schema', name: 'confidence_panel_judgment', schema, strict: true } },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Terra request failed: ${response.status}`);
  const parsed = JSON.parse(extractText(data));
  const liveIds = new Set(live.map((item) => item.id));
  const returnedIds = new Set(parsed.robustnessOrder);
  const noScoreConsistent = parsed.noScore === (parsed.selectedBand === 'NoScore');
  const validNoScoreOrder = parsed.noScore && parsed.robustnessOrder.length === 0;
  const validScoredOrder = !parsed.noScore
    && parsed.robustnessOrder.length === liveIds.size
    && returnedIds.size === liveIds.size
    && [...returnedIds].every((id) => liveIds.has(id));
  if (!noScoreConsistent || (!validNoScoreOrder && !validScoredOrder)) {
    throw new Error(`Terra returned an invalid live ordering for ${testCase.id}.`);
  }
  return {
    ...parsed,
    panelIndex,
    orderSeed,
    candidateOrder: ordered.map((item) => item.id),
    model: data.model || 'gpt-5.6-terra',
    usage: {
      inputTokens: Number(data.usage?.input_tokens || 0),
      outputTokens: Number(data.usage?.output_tokens || 0),
    },
  };
}

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  return (data.output || []).flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text).join('');
}

function readExisting(path, partition) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed.partition !== partition) throw new Error('Label partition mismatch.');
    return parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { version: 1, partition, model: 'gpt-5.6-terra', cases: [], usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

function upsert(items, next) {
  const index = items.findIndex((item) => item.caseId === next.caseId);
  if (index >= 0) items[index] = next;
  else items.push(next);
}

function seededShuffle(items, seed) {
  const output = [...items];
  let state = Number.parseInt(seed.slice(0, 8), 16) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}
