import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [stage, bundleArg, outputArg, specArg, ...sourceArgs] = process.argv.slice(2);
if (!process.env.OPENAI_API_KEY || !stage || !bundleArg || !outputArg || !specArg || sourceArgs.length === 0) {
  throw new Error('Usage: OPENAI_API_KEY=... node scripts/run-stage-review.mjs <stage> <bundle> <output> <spec> <source...>');
}

const bundlePath = resolve(bundleArg);
const outputPath = resolve(outputArg);
const specPath = resolve(specArg);
const bundle = readFileSync(bundlePath, 'utf8');
const spec = readText(specPath);
const diff = gitDiff(sourceArgs);
const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    specCoverage: { type: 'array', items: { type: 'string' } },
    utilityFindings: { type: 'array', items: { type: 'string' } },
    qualityFindings: { type: 'array', items: { type: 'string' } },
    correctnessFindings: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'string' } },
    requiredChanges: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'verdict',
    'specCoverage',
    'utilityFindings',
    'qualityFindings',
    'correctnessFindings',
    'evidence',
    'requiredChanges',
  ],
};

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-5.6-luna',
    reasoning: { effort: 'low' },
    input: [
      {
        role: 'system',
        content: [{
          type: 'input_text',
          text: 'You are the independent serial release reviewer for a decision-engineering platform. Attack specification coverage, user utility, interaction quality, security boundaries, correctness, and regression risk. Treat the supplied specification and stage contract as authoritative. Review only the frozen evidence and diff; do not infer unshown implementation discussion. A pass is allowed only when utilityFindings, qualityFindings, correctnessFindings, and requiredChanges are all empty. Any actionable concern requires verdict=fail and a concrete required change. Do not praise intent. Cite supplied evidence precisely.',
        }],
      },
      {
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            `STAGE: ${stage}`,
            'AUTHORITATIVE STAGE BUNDLE:',
            bundle,
            'AUTHORITATIVE PRODUCT SPECIFICATION:',
            spec,
            'FROZEN IMPLEMENTATION DIFF:',
            diff || '(No tracked diff was supplied.)',
          ].join('\n\n'),
        }],
      },
    ],
    text: { format: { type: 'json_schema', name: `stage_${stage}_review`, schema, strict: true } },
  }),
});

const data = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(data.error?.message || `Luna review failed: ${response.status}`);
const review = JSON.parse(extractText(data));
const findingCount = review.utilityFindings.length
  + review.qualityFindings.length
  + review.correctnessFindings.length
  + review.requiredChanges.length;
if ((review.verdict === 'pass') !== (findingCount === 0)) {
  throw new Error('Luna returned an internally inconsistent verdict.');
}

const record = {
  reviewer: data.model || 'gpt-5.6-luna',
  reasoningEffort: 'low',
  transport: 'openai-responses-api',
  stage: Number(stage),
  usage: {
    inputTokens: Number(data.usage?.input_tokens || 0),
    outputTokens: Number(data.usage?.output_tokens || 0),
  },
  reviewHistory: appendReviewHistory(outputPath, review, data),
  ...review,
};
writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Stage ${stage} Luna verdict: ${review.verdict}; findings: ${findingCount}`);

function gitDiff(paths) {
  const result = spawnSync('git', ['diff', '--', ...paths], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || 'Unable to create frozen source diff.');
  const untracked = paths.flatMap((path) => {
    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', path], { encoding: 'utf8' });
    if (tracked.status === 0) return [];
    const absolute = resolve(path);
    return [`diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ untracked source @@\n${readFileSync(absolute, 'utf8')}`];
  });
  return [result.stdout, ...untracked].filter(Boolean).join('\n');
}

function readText(path) {
  if (extname(path).toLowerCase() !== '.pdf') return readFileSync(path, 'utf8');
  const result = spawnSync('pdftotext', [path, '-'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || `Unable to extract ${path}.`);
  return result.stdout;
}

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('');
}

function appendReviewHistory(path, review, data) {
  let history = [];
  try {
    const previous = JSON.parse(readFileSync(path, 'utf8'));
    history = Array.isArray(previous.reviewHistory)
      ? previous.reviewHistory
      : [{
          attempt: 1,
          reviewer: previous.reviewer,
          verdict: previous.verdict,
          utilityFindings: previous.utilityFindings || [],
          qualityFindings: previous.qualityFindings || [],
          correctnessFindings: previous.correctnessFindings || [],
          requiredChanges: previous.requiredChanges || [],
        }];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return [
    ...history,
    {
      attempt: history.length + 1,
      reviewer: data.model || 'gpt-5.6-luna',
      verdict: review.verdict,
      utilityFindings: review.utilityFindings,
      qualityFindings: review.qualityFindings,
      correctnessFindings: review.correctnessFindings,
      requiredChanges: review.requiredChanges,
    },
  ];
}
