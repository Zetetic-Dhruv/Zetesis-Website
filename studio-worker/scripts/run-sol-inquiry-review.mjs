import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({
  headersTimeout: 1_800_000,
  bodyTimeout: 1_800_000,
  connectTimeout: 30_000,
}));

const [bundleArg, outputArg, specArg, wireframeArg, browserArg, pdfArg, ...sourceArgs] = process.argv.slice(2);
if (!process.env.OPENAI_API_KEY || !bundleArg || !outputArg || !specArg || !wireframeArg || !browserArg || !pdfArg || !sourceArgs.length) {
  throw new Error('Usage: OPENAI_API_KEY=... node scripts/run-sol-inquiry-review.mjs <bundle> <output> <spec> <wireframe> <browser-evidence> <pdf> <source...>');
}

const bundlePath = resolve(bundleArg);
const outputPath = resolve(outputArg);
const pdfPath = resolve(pdfArg);
const personas = [
  'lazy_mobile_executive',
  'inexperienced_student',
  'adversarial_gamer',
  'disrupted_reality_user',
  'instructor_observer',
];
const schema = reviewSchema(personas);
const sources = sourceArgs.map((path) => {
  const absolute = resolve(path);
  return `FILE: ${path}\nSHA-256: ${sha256(readFileSync(absolute))}\n\n${readFileSync(absolute, 'utf8')}`;
}).join('\n\n===== NEXT FROZEN FILE =====\n\n');
const renderedPages = [];
for (let index = 1; exists(resolve(`tmp/pdfs/stage8-final/page-${index}.png`)); index += 1) {
  renderedPages.push(resolve(`tmp/pdfs/stage8-final/page-${index}.png`));
}
if (!renderedPages.length) throw new Error('Missing rendered PDF witnesses in tmp/pdfs/stage8-final.');

const userContent = [{
  type: 'input_text',
  text: [
    'FINAL RELEASE CONTRACT:',
    readFileSync(bundlePath, 'utf8'),
    'AUTHORITATIVE DESIGN SPECIFICATION:',
    readText(resolve(specArg)),
    'AUTHORITATIVE WIREFRAME:',
    readText(resolve(wireframeArg)),
    'DEPLOYED BROWSER WITNESS:',
    readFileSync(resolve(browserArg), 'utf8'),
    'EXACT SAVED PDF TEXT:',
    readText(pdfPath),
    'FROZEN REVIEWED SOURCE:',
    sources,
  ].join('\n\n'),
}];
for (const page of renderedPages) {
  userContent.push({
    type: 'input_image',
    image_url: `data:image/png;base64,${readFileSync(page).toString('base64')}`,
    detail: 'high',
  });
}

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-5.6-sol',
    reasoning: { effort: 'max' },
    input: [
      {
        role: 'system',
        content: [{
          type: 'input_text',
          text: [
            'You are the sole final release reviewer for a high-stakes decision-engineering platform.',
            'Perform one continuous inquiry, not a panel and not five independent reviews.',
            'First lock the witnessed behavior. Then map structured ignorance as KK, KU, UK, and UU. Use that map to imagine the strongest utility, correctness, security, and artifact failures across all five required perspectives. Test each hypothesis against a named supplied witness. Finally issue one verdict.',
            'A user complaint is actionable when the product can reasonably remove it without changing the assignment. Any actionable complaint, dead end, bypassable human judgment, confidence manipulation, irrelevant model access, cross-student leak, client-language defect, missing structured PDF content, or avoidable typing burden requires verdict=fail.',
            'Do not infer unshown behavior and do not pass from intent. Do not request another review round. The supplied specification is authoritative. The output must contain exactly the five required persona outcomes.',
          ].join(' '),
        }],
      },
      { role: 'user', content: userContent },
    ],
    text: { format: { type: 'json_schema', name: 'sol_inquiry_release_review', schema, strict: true } },
  }),
});

const data = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(data.error?.message || `Sol inquiry review failed: ${response.status}`);
if (!String(data.model || '').startsWith('gpt-5.6-sol')) {
  throw new Error(`Exact reviewer unavailable; received ${data.model || 'unknown model'}.`);
}
const review = JSON.parse(extractText(data));
validateReview(review, personas);
const record = {
  reviewer: data.model,
  reasoningEffort: 'max',
  transport: 'openai-responses-api',
  reviewMode: 'single-inquiry-one-shot',
  requestCount: 1,
  sourceCommit: git('rev-parse', 'HEAD'),
  inputWitnesses: {
    bundleSha256: sha256(readFileSync(bundlePath)),
    specSha256: sha256(readFileSync(resolve(specArg))),
    wireframeSha256: sha256(readFileSync(resolve(wireframeArg))),
    browserEvidenceSha256: sha256(readFileSync(resolve(browserArg))),
    pdfSha256: sha256(readFileSync(pdfPath)),
    renderedPageSha256: renderedPages.map((path) => sha256(readFileSync(path))),
    sourceSha256: sourceArgs.map((path) => ({ path, sha256: sha256(readFileSync(resolve(path))) })),
  },
  usage: {
    inputTokens: Number(data.usage?.input_tokens || 0),
    outputTokens: Number(data.usage?.output_tokens || 0),
    reasoningTokens: Number(data.usage?.output_tokens_details?.reasoning_tokens || 0),
  },
  ...review,
};
writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Final Sol inquiry verdict: ${review.verdict}; probes: ${review.inquiryMap.probes.length}; findings: ${findingCount(review)}`);

function reviewSchema(personaValues) {
  const stringArray = { type: 'array', items: { type: 'string' } };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      verdict: { type: 'string', enum: ['pass', 'fail'] },
      inquiryMap: {
        type: 'object',
        additionalProperties: false,
        properties: {
          lockedMeasurements: stringArray,
          unknowns: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                quadrant: { type: 'string', enum: ['KK', 'KU', 'UK', 'UU'] },
                attackQuestion: { type: 'string' },
                requiredWitness: { type: 'string' },
                disposition: { type: 'string', enum: ['closed', 'confirmed_failure', 'residual_non_actionable'] },
              },
              required: ['id', 'quadrant', 'attackQuestion', 'requiredWitness', 'disposition'],
            },
          },
          probes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                persona: { type: 'string', enum: personaValues },
                hypothesis: { type: 'string' },
                witness: { type: 'string' },
                result: { type: 'string', enum: ['pass', 'fail'] },
                finding: { type: 'string' },
              },
              required: ['id', 'persona', 'hypothesis', 'witness', 'result', 'finding'],
            },
          },
          coverageArgument: stringArray,
        },
        required: ['lockedMeasurements', 'unknowns', 'probes', 'coverageArgument'],
      },
      personaOutcomes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            persona: { type: 'string', enum: personaValues },
            outcome: { type: 'string', enum: ['pass', 'fail'] },
            completedAssignment: { type: 'boolean' },
            complaints: stringArray,
            evidence: stringArray,
          },
          required: ['persona', 'outcome', 'completedAssignment', 'complaints', 'evidence'],
        },
      },
      utilityFindings: stringArray,
      qualityFindings: stringArray,
      correctnessFindings: stringArray,
      securityFindings: stringArray,
      artifactFindings: stringArray,
      residualRisks: stringArray,
      requiredChanges: stringArray,
      releaseRationale: { type: 'string' },
    },
    required: [
      'verdict', 'inquiryMap', 'personaOutcomes', 'utilityFindings', 'qualityFindings',
      'correctnessFindings', 'securityFindings', 'artifactFindings', 'residualRisks',
      'requiredChanges', 'releaseRationale',
    ],
  };
}

function validateReview(review, personaValues) {
  const seen = review.personaOutcomes.map((item) => item.persona);
  if (seen.length !== personaValues.length || new Set(seen).size !== personaValues.length
    || personaValues.some((persona) => !seen.includes(persona))) {
    throw new Error('Sol did not return exactly the five required persona outcomes.');
  }
  const failedPersona = review.personaOutcomes.some((item) => item.outcome !== 'pass'
    || item.completedAssignment !== true || item.complaints.length > 0);
  const probeFailure = review.inquiryMap.probes.some((probe) => probe.result === 'fail');
  const unresolved = findingCount(review) > 0 || failedPersona || probeFailure;
  if ((review.verdict === 'pass') === unresolved) {
    throw new Error('Sol returned an internally inconsistent release verdict.');
  }
}

function findingCount(review) {
  return [
    review.utilityFindings,
    review.qualityFindings,
    review.correctnessFindings,
    review.securityFindings,
    review.artifactFindings,
    review.requiredChanges,
  ].reduce((sum, values) => sum + values.length, 0)
    + review.personaOutcomes.reduce((sum, item) => sum + item.complaints.length, 0);
}

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('');
}

function readText(path) {
  if (extname(path).toLowerCase() !== '.pdf') return readFileSync(path, 'utf8');
  const result = spawnSync('pdftotext', [path, '-'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || `Unable to extract ${path}.`);
  return result.stdout;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exists(path) {
  const result = spawnSync('test', ['-f', path]);
  return result.status === 0;
}

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}
