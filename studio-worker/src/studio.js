import { renderStudioPage } from './studio-page.js';

const ENGAGEMENT_ID = 'eng_bethany_house_2026';

const SHARED_SYSTEM_PROMPT = `You are the sorting and scaffolding engine inside the Decision Manifold Studio, built for a graduate consulting team working a live nonprofit engagement.

You may classify, summarize, draft multiple-choice scaffolds, flag missing attribution, flag contradictions, and check stated reframes against a weak/strong test.

You may never invent what a stakeholder privately thinks or knows, assert content for Unknown Knowns or Unknown Unknowns on the team's behalf, write the team's recommendation, or auto-complete a blank field to make output look finished. A blank or needs_attribution result is a valid, correct output.

If a request asks you to do work that depends on a real conversation the team had or has not had yet, decline to fabricate and instead return the question that would surface it from that conversation.`;

const DEFAULT_STATE = {
  version: 1,
  intake: {
    problemStatement: '',
    known: '',
    assumptions: '',
    openQuestions: '',
  },
  items: [],
  drill: {
    assumptions: [
      emptyAssumption(),
      emptyAssumption(),
      emptyAssumption(),
    ],
    frameQuestion: '',
  },
  questionEngineering: {
    variants: {},
  },
  oneSentence: {
    briefText: '',
    whatChanged: '',
    reframeText: '',
    rulesIn: '',
    rulesOut: '',
    status: 'draft',
    oneThingLeftOpen: '',
    whyLeftOpen: '',
    aiCheck: null,
  },
  finalReport: {
    document: null,
    markdown: '',
    generatedAt: '',
    pdfGeneratedAt: '',
  },
  updatedAt: '',
};

function emptyAssumption() {
  return {
    selectedItemId: '',
    selectedText: '',
    givenStatement: '',
    wrongIf: '',
    whatChanges: '',
    scaffold: null,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);
    const host = url.hostname.toLowerCase();

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (isPlatformHost(host) && pathname === '/') {
      return html(renderPlatformPage());
    }

    if (pathname === '/studio' || pathname === '/decision-engineering') {
      return html(renderStudioPage());
    }

    if (pathname.startsWith('/api/studio')) {
      return handleApi(request, env, pathname);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleApi(request, env, pathname) {
  try {
    if (!env.STUDIO_DB) {
      return json({ error: 'STUDIO_DB binding is not configured.' }, 500, request);
    }

    if (request.method === 'POST' && pathname === '/api/studio/session') {
      return handlePreviewSession(request, env);
    }

    if (request.method === 'POST' && pathname === '/api/studio/logout') {
      return json({ ok: true }, 200, request, {
        'Set-Cookie': expiredSessionCookie(request),
      });
    }

    const auth = await getAuthenticatedEmail(request, env);
    if (!auth.ok) {
      return json({ error: auth.error }, auth.status, request);
    }

    if (request.method === 'GET' && pathname === '/api/studio/me') {
      return handleMe(request, env, auth.email);
    }

    if (request.method === 'POST' && pathname === '/api/studio/register') {
      return handleRegister(request, env, auth.email);
    }

    const ctx = await getRegisteredContext(env, auth.email);
    if (!ctx.user) {
      return json({ error: 'Registration required.' }, 403, request);
    }

    if (request.method === 'GET' && pathname === '/api/studio/workspace') {
      return json(await loadWorkspaceBundle(env, ctx.user.id), 200, request);
    }

    if (request.method === 'PUT' && pathname === '/api/studio/workspace') {
      return handleSaveWorkspace(request, env, ctx.user);
    }

    if (request.method === 'POST' && pathname === '/api/studio/llm') {
      return handleLlm(request, env, ctx.user);
    }

    if (request.method === 'POST' && pathname === '/api/studio/report/pdf') {
      return handlePdfProxy(request, env, ctx.user);
    }

    return json({ error: 'Not Found' }, 404, request);
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500, request);
  }
}

async function handlePreviewSession(request, env) {
  if (!env.SESSION_SECRET) {
    return json({ error: 'SESSION_SECRET is not configured.' }, 501, request);
  }

  const allowedDomains = getAllowedEmailDomains(env);
  const body = await readJson(request);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  if (!email) {
    return json({ error: 'Email is required.' }, 400, request);
  }
  if (isMasterLoginEmail(email, env)) {
    if (!env.MASTER_LOGIN_PASSWORD) {
      return json({ error: 'Master login password is not configured.' }, 501, request);
    }
    if (!constantTimeEqual(password, env.MASTER_LOGIN_PASSWORD)) {
      return json({ error: 'Password is required for this master login.' }, 403, request);
    }
  } else if (!emailAllowed(email, allowedDomains)) {
    return json({ error: `Only ${allowedDomainsLabel(allowedDomains)} accounts may register.` }, 403, request);
  }

  return json({ authenticated: true, email }, 200, request, {
    'Set-Cookie': await signedSessionCookie(email, env, request),
  });
}

async function handleMe(request, env, email) {
  const user = await getUserByEmail(env, email);
  if (!user) {
    return json({
      authenticated: true,
      registered: false,
      email,
    }, 200, request);
  }

  const bundle = await loadWorkspaceBundle(env, user.id);
  return json({
    authenticated: true,
    registered: Boolean(bundle.workspace),
    email,
    user,
    ...bundle,
  }, 200, request);
}

async function handleRegister(request, env, email) {
  const body = await readJson(request);
  const name = cleanString(body.name, 120);
  const teamName = cleanString(body.teamName, 120);
  const joinCode = cleanString(body.joinCode, 32).toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!name) {
    return json({ error: 'Name is required.' }, 400, request);
  }

  await ensureEngagement(env);

  let user = await getUserByEmail(env, email);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      name,
      role: 'student',
    };
    await env.STUDIO_DB.prepare(
      `INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)`
    ).bind(user.id, user.email, user.name, user.role).run();
  } else {
    await env.STUDIO_DB.prepare(
      `UPDATE users SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).bind(name, user.id).run();
    user = { ...user, name };
  }

  const existing = await getPrimaryTeam(env, user.id);
  if (existing) {
    return json({
      user,
      ...(await loadWorkspaceBundle(env, user.id)),
    }, 200, request);
  }

  let team;
  if (joinCode) {
    team = await env.STUDIO_DB.prepare(
      `SELECT * FROM teams WHERE join_code = ?`
    ).bind(joinCode).first();
    if (!team) {
      return json({ error: 'No team found for that join code.' }, 404, request);
    }
  } else {
    if (!teamName) {
      return json({ error: 'Team name is required when creating a team.' }, 400, request);
    }
    team = {
      id: crypto.randomUUID(),
      engagement_id: ENGAGEMENT_ID,
      name: teamName,
      join_code: await createUniqueJoinCode(env),
      created_by: user.id,
    };
    await env.STUDIO_DB.prepare(
      `INSERT INTO teams (id, engagement_id, name, join_code, created_by) VALUES (?, ?, ?, ?, ?)`
    ).bind(team.id, team.engagement_id, team.name, team.join_code, team.created_by).run();
  }

  await env.STUDIO_DB.prepare(
    `INSERT OR IGNORE INTO team_members (team_id, user_id, member_role) VALUES (?, ?, ?)`
  ).bind(team.id, user.id, team.created_by === user.id ? 'owner' : 'member').run();

  const workspace = await ensureWorkspace(env, team.id, user.id);
  await audit(env, workspace.id, user.id, 'register', { teamId: team.id, joinCode: team.join_code });

  return json({
    user,
    ...(await loadWorkspaceBundle(env, user.id)),
  }, 200, request);
}

async function handleSaveWorkspace(request, env, user) {
  const body = await readJson(request);
  const state = normalizeState(body.state);
  const bundle = await loadWorkspaceBundle(env, user.id);
  if (!bundle.workspace) {
    return json({ error: 'Workspace not found.' }, 404, request);
  }

  state.updatedAt = new Date().toISOString();
  await env.STUDIO_DB.prepare(
    `INSERT INTO workspace_states (workspace_id, state_json, updated_by, updated_at)
     VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(workspace_id) DO UPDATE SET
       state_json = excluded.state_json,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`
  ).bind(bundle.workspace.id, JSON.stringify(state), user.id).run();

  await env.STUDIO_DB.prepare(
    `UPDATE workspaces SET current_step = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).bind(cleanString(body.currentStep || 'intake', 60), bundle.workspace.id).run();

  await audit(env, bundle.workspace.id, user.id, 'save_workspace', { currentStep: body.currentStep || 'intake' });
  return json({ ok: true, state }, 200, request);
}

async function handleLlm(request, env, user) {
  const body = await readJson(request);
  const moduleName = cleanString(body.module, 80);
  const payload = body.payload || {};

  if (!moduleName || !MODULES[moduleName]) {
    return json({ error: 'Unknown LLM module.' }, 400, request);
  }

  const bundle = await loadWorkspaceBundle(env, user.id);
  if (!bundle.workspace) {
    return json({ error: 'Workspace not found.' }, 404, request);
  }

  let result;
  let provider = 'fallback';
  const mode = cleanString(env.AGENT_API_MODE || 'openai', 40).toLowerCase();
  if (moduleName === 'final_report') {
    result = fallbackRaw(moduleName, payload);
    provider = 'guarded-local';
  } else if (mode === 'fixture' || mode === 'offline') {
    result = fallbackModule(moduleName, payload, 'Offline agent fixture mode; no external LLM call made.');
    provider = 'offline-agent';
  } else if (env.OPENAI_API_KEY) {
    try {
      result = await runOpenAi(env, moduleName, payload);
      provider = 'openai';
    } catch (error) {
      result = fallbackModule(moduleName, payload, `OpenAI call failed: ${error.message}`);
    }
  } else {
    result = fallbackModule(moduleName, payload, 'OPENAI_API_KEY is not configured; used local fallback.');
  }

  await env.STUDIO_DB.prepare(
    `INSERT INTO llm_runs (id, workspace_id, user_id, module, request_json, response_json, provider)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    bundle.workspace.id,
    user.id,
    moduleName,
    JSON.stringify(payload),
    JSON.stringify(result),
    provider
  ).run();

  await audit(env, bundle.workspace.id, user.id, 'llm_run', { module: moduleName, provider });
  return json({ module: moduleName, provider, result }, 200, request);
}

async function handlePdfProxy(request, env, user) {
  if (!env.PDF_SERVICE_URL) {
    return json({
      error: 'PDF_SERVICE_URL is not configured. Run the local Python PDF service for localhost, or configure a PDF rendering service for production.',
    }, 501, request);
  }

  const bundle = await loadWorkspaceBundle(env, user.id);
  if (!bundle.workspace) {
    return json({ error: 'Workspace not found.' }, 404, request);
  }

  const body = await request.text();
  const response = await fetch(env.PDF_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    return json({ error: message || `PDF service failed with ${response.status}.` }, 502, request);
  }

  await audit(env, bundle.workspace.id, user.id, 'pdf_render', { provider: 'pdf_service' });
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/pdf',
      'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment; filename="decision-manifold-final-report.pdf"',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    },
  });
}

async function runOpenAi(env, moduleName, payload) {
  const mod = MODULES[moduleName];
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: SHARED_SYSTEM_PROMPT }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: mod.prompt(payload) }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: mod.schemaName,
          schema: mod.schema,
          strict: true,
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI request failed with ${response.status}`);
  }

  const text = extractResponseText(data);
  if (!text) {
    throw new Error('OpenAI response did not contain output text.');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`OpenAI response was not valid JSON: ${text.slice(0, 200)}`);
  }
}

function extractResponseText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  let text = '';
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') text += content.text;
      if (typeof content.text === 'string' && content.type !== 'output_text') text += content.text;
    }
  }
  return text;
}

const REPORT_QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceItemId: { type: 'string' },
    question: { type: 'string' },
    whoMustSayYes: { type: 'string' },
    vetoHolder: { type: 'string' },
    likelyToSayNo: { type: 'string' },
  },
  required: ['sourceItemId', 'question', 'whoMustSayYes', 'vetoHolder', 'likelyToSayNo'],
};

const REPORT_TYPE_MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceItemId: { type: 'string' },
    bucket: { type: 'string' },
    status: { type: 'string' },
    valueTag: { type: 'string' },
    holder: { type: 'string' },
    sourceField: { type: 'string' },
    item: { type: 'string' },
  },
  required: ['sourceItemId', 'bucket', 'status', 'valueTag', 'holder', 'sourceField', 'item'],
};

const REPORT_DRILL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    label: { type: 'string' },
    givenStatement: { type: 'string' },
    wrongIf: { type: 'string' },
    whatChanges: { type: 'string' },
  },
  required: ['label', 'givenStatement', 'wrongIf', 'whatChanges'],
};

const REPORT_DOCUMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    client: { type: 'string' },
    preparedFor: { type: 'string' },
    refinedProblemStatement: { type: 'string' },
    highValueQuestions: { type: 'array', items: REPORT_QUESTION_SCHEMA },
    typeMap: { type: 'array', items: REPORT_TYPE_MAP_SCHEMA },
    drillSummary: { type: 'array', items: REPORT_DRILL_SCHEMA },
    oneThingLeftOpen: { type: 'string' },
    whyLeftOpen: { type: 'string' },
    guardrailNote: { type: 'string' },
  },
  required: [
    'title',
    'subtitle',
    'client',
    'preparedFor',
    'refinedProblemStatement',
    'highValueQuestions',
    'typeMap',
    'drillSummary',
    'oneThingLeftOpen',
    'whyLeftOpen',
    'guardrailNote',
  ],
};

const MODULES = {
  parse_intake: {
    schemaName: 'parse_intake_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              sourceField: { type: 'string', enum: ['problemStatement', 'known', 'assumptions', 'openQuestions'] },
              rawText: { type: 'string' },
            },
            required: ['sourceField', 'rawText'],
          },
        },
      },
      required: ['items'],
    },
    prompt: (payload) => `Split this intake into atomic candidate items for the next module. Do not classify or judge. Preserve the team's wording as much as possible.

Intake:
${JSON.stringify(payload.intake || {}, null, 2)}`,
  },
  sort_items: {
    schemaName: 'sort_items_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              bucket: { type: 'string', enum: ['KK', 'KU', 'UK', 'UU', ''] },
              holder: { type: 'string' },
              status: { type: 'string', enum: ['settled', 'needs_attribution'] },
              aiNotes: { type: 'string' },
            },
            required: ['id', 'bucket', 'holder', 'status', 'aiNotes'],
          },
        },
      },
      required: ['items'],
    },
    prompt: (payload) => `Classify each item into exactly one of KK, KU, UK, or UU only where justified by the team's text.

Rules:
- KK: settleable by research alone.
- KU: the team knows it is missing and needs a conversation.
- UK: something the organisation knows but has not written down. Only valid if the team states this came from listening, not your inference.
- UU: a question nobody has thought to ask yet.
- Every settled item needs a holder/source: whose knowledge this is, or where it can be verified.
- If holder/source is missing, unknown, TBD, or a placeholder, return status needs_attribution and bucket "".
- Do not invent holder/source, stakeholder private beliefs, or UK/UU content. If an item asks you to invent or infer private/tacit content, return status needs_attribution and bucket "".
- Do not assign who says yes, who can say no, or likely no here; those belong to the gatekeeper step for curated high-value questions.

Items:
${JSON.stringify(payload.items || [], null, 2)}`,
  },
  value_tag: {
    schemaName: 'value_tag_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              valueTag: { type: 'string', enum: ['High', 'Medium', 'Low'] },
              valueRationale: { type: 'string' },
            },
            required: ['id', 'valueTag', 'valueRationale'],
          },
        },
      },
      required: ['items'],
    },
    prompt: (payload) => `For each KU, UK, or UU item, propose High, Medium, or Low value.

Use these factors: bucket importance, stakes for people affected if wrong, whether a gatekeeper's decision depends on it, and whether it depends on a single named source. Return a one-sentence rationale. Do not tag everything High.

Items:
${JSON.stringify(payload.items || [], null, 2)}`,
  },
  drill_scaffold: {
    schemaName: 'drill_scaffold_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        claimOptions: { type: 'array', items: { type: 'string' } },
        angles: { type: 'array', items: { type: 'string' } },
        frameQuestion: { type: 'string' },
      },
      required: ['claimOptions', 'angles', 'frameQuestion'],
    },
    prompt: (payload) => `The team selected this item for the Drill: ${JSON.stringify(payload.item || payload.text || '')}

Step (a): Offer 3 alternative phrasings as claims that could be false. Pull language from the team's own intake where possible.
Steps (b) and (c): Do not write the answer. Offer 3-4 angles the team might consider as prompts only.
Step (d): Return only the frame question, not candidate answers.`,
  },
  question_reengineer: {
    schemaName: 'question_reengineer_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        variants: { type: 'array', items: { type: 'string' } },
        ownerFlag: { type: 'string' },
      },
      required: ['variants', 'ownerFlag'],
    },
    prompt: (payload) => `Sharpen this open question along the axes: for whom, how much, by when.

Question: ${JSON.stringify(payload.question || '')}

Return 3-4 variants that are answerable in principle by a specifically named person. If no variant can be tied to a named owner, say so in ownerFlag instead of forcing an unanswerable question.`,
  },
  one_sentence_check: {
    schemaName: 'one_sentence_check_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        verdict: { type: 'string', enum: ['weak', 'strong', 'not_yet_doing_work'] },
        reasoning: { type: 'string' },
        missingFields: { type: 'array', items: { type: 'string' } },
      },
      required: ['verdict', 'reasoning', 'missingFields'],
    },
    prompt: (payload) => `Brief as given:
${payload.briefText || ''}

Team's proposed reframe:
${payload.reframeText || ''}

Rules in:
${payload.rulesIn || ''}

Rules out:
${payload.rulesOut || ''}

Check whether the reframe merely restates the brief or names a tension the brief did not state. Do not supply a replacement sentence. If rules_in or rules_out is empty, return not_yet_doing_work.`,
  },
  final_report: {
    schemaName: 'final_report_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        document: REPORT_DOCUMENT_SCHEMA,
        markdown: { type: 'string' },
      },
      required: ['document', 'markdown'],
    },
    prompt: (payload) => `Assemble a PDF-ready final report object from already-approved upstream work.

Hard guardrails:
- Use only explicit fields in the workspace state below.
- Do not add recommendations, conclusions, stakeholder private beliefs, missing UK/UU content, or polished filler.
- Empty strings are valid when a field has not been approved by the team.
- refinedProblemStatement must be the approved oneSentence reframe only.
- highValueQuestions may include only items whose valueTag is High, whose bucket is KU, UK, or UU, and whose whoSaysYes, veto, and likelyToSayNo fields are explicit non-placeholder text.
- typeMap must include every item, including unsettled and blank-attribution items.
- drillSummary must use only the team's givenStatement, wrongIf, and whatChanges fields.
- The document object must contain plain text only. No Markdown, HTML, LaTeX, tables, or bullets inside document fields.
- The markdown field must contain the same document content.

Required report sections:
1. Refined problem statement.
2. Curated high-value questions for Bethany House, with who must say yes, who holds veto, and who is likely to say no.
3. Type map with all items, buckets, attribution status, value tags, and source fields.
4. Assumption drill summary.
5. One thing left open.

Workspace state:
${JSON.stringify(payload.state || {}, null, 2)}`,
  },
};

function fallbackModule(moduleName, payload, note) {
  const result = fallbackRaw(moduleName, payload);
  return { ...result, note };
}

function fallbackRaw(moduleName, payload) {
  const guardrail = detectGuardrailRequest(payload);

  if (moduleName === 'parse_intake') {
    const intake = payload.intake || {};
    const fields = ['problemStatement', 'known', 'assumptions', 'openQuestions'];
    const items = [];
    for (const field of fields) {
      for (const rawText of splitAtomic(intake[field] || '')) {
        items.push({ sourceField: field, rawText });
      }
    }
    return { items };
  }

  if (moduleName === 'sort_items') {
    return {
      items: (payload.items || []).map((item) => {
        const text = item.rawText || item.text || '';
        const holder = cleanString(item.holder || '', 160);
        if (isSortGuardrailItem(text)) {
          return {
            id: item.id,
            bucket: '',
            holder: '',
            status: 'needs_attribution',
            aiNotes: 'Cannot invent UK/UU content or infer private stakeholder meaning. Ask what the team actually heard and who can corroborate it.',
          };
        }
        if (!isMeaningfulField(holder)) {
          return {
            id: item.id,
            bucket: '',
            holder,
            status: 'needs_attribution',
            aiNotes: 'Missing holder/source; this item is not settled into a final bucket yet.',
          };
        }
        const bucket = inferBucket(text, item.sourceField);
        return {
          id: item.id,
          bucket,
          holder,
          status: 'settled',
          aiNotes: 'Fallback classification. Review before treating as settled.',
        };
      }),
    };
  }

  if (moduleName === 'value_tag') {
    return {
      items: (payload.items || []).map((item) => {
        const text = `${item.rawText || ''} ${item.bucket || ''}`.toLowerCase();
        let valueTag = item.bucket === 'UK' || item.bucket === 'UU' ? 'High' : 'Medium';
        if (item.bucket === 'KK') valueTag = 'Low';
        if (/ceo|board|client|resident|school|funder|trust|veto|risk|hurt|women|children/.test(text)) valueTag = 'High';
        const rationale = item.bucket === 'KU'
          ? 'Fallback tag based on the need for a real conversation and gatekeeper approval relevance.'
          : 'Fallback tag based on bucket importance and visible stakeholder/stakes language.';
        return {
          id: item.id,
          valueTag,
          valueRationale: rationale,
        };
      }),
    };
  }

  if (moduleName === 'drill_scaffold') {
    const text = payload.item?.rawText || payload.item?.text || payload.text || 'this assumption';
    if (guardrail) {
      return {
        claimOptions: [],
        angles: [
          'That depends on what the team actually heard, not on a model guess.',
          'Ask what was said immediately before or after the line.',
          'Ask who else reacted, disagreed, or added context in the room.',
        ],
        frameQuestion: 'What did the team hear, what was said before or after that line, and who else reacted?',
      };
    }
    return {
      claimOptions: [
        `The team is assuming that ${lowerFirst(text)}.`,
        `The current frame treats ${lowerFirst(text)} as settled.`,
        `The recommendation depends on ${lowerFirst(text)} being true.`,
      ],
      angles: [
        'What relationship continuity or trust condition would make this false?',
        'What institutional memory would a new person or process not carry?',
        'What community standing would a standard hire lack on day one?',
        'What changes if the timeline is slower than the team assumes?',
        'Who would experience the cost first if this assumption fails?',
      ],
      frameQuestion: 'What question is this framing keeping us from asking?',
    };
  }

  if (moduleName === 'question_reengineer') {
    const q = cleanString(payload.question || 'What do we need to understand?', 300);
    if (guardrail) {
      return {
        variants: [],
        ownerFlag: 'This asks the assistant to infer private stakeholder meaning. Bring back what was heard in the real conversation, then tie the question to a named owner.',
      };
    }
    return {
      variants: [
        `${q} For whom specifically?`,
        `${q} How much would change if we guessed wrong?`,
        `${q} By when does this need to be answered, and by whom?`,
      ],
      ownerFlag: 'Fallback variants. Attach a named owner before sending the question forward.',
    };
  }

  if (moduleName === 'one_sentence_check') {
    const missing = [];
    if (!cleanString(payload.rulesIn || '', 800)) missing.push('rulesIn');
    if (!cleanString(payload.rulesOut || '', 800)) missing.push('rulesOut');
    const brief = tokenize(payload.briefText || '');
    const reframe = tokenize(payload.reframeText || '');
    const overlap = reframe.length ? reframe.filter((w) => brief.includes(w)).length / reframe.length : 1;
    const verdict = missing.length ? 'not_yet_doing_work' : (overlap > 0.55 ? 'weak' : 'strong');
    return {
      verdict,
      reasoning: missing.length
        ? 'A reframe that rules nothing in or out is not yet doing work.'
        : 'Fallback check: the reframe names a tension beyond the brief, and the rules in/rules out test is populated.',
      missingFields: missing,
    };
  }

  if (moduleName === 'final_report') {
    const document = buildReportDocument(payload.state || {});
    return {
      document,
      markdown: buildReportMarkdown(document),
    };
  }

  return {};
}

function buildReportDocument(state) {
  const one = state.oneSentence || {};
  const items = state.items || [];
  const highValueItems = items.filter((item) => item.valueTag === 'High' && item.bucket && item.bucket !== 'KK');
  const highQuestions = highValueItems.filter(isReadyHighValueQuestion);
  const omittedHighValueCount = highValueItems.length - highQuestions.length;
  const assumptions = state.drill?.assumptions || [];

  return {
    title: 'Decision Manifold Studio Final Report',
    subtitle: 'Decision Manifold summary',
    client: 'Bethany House of Nassau County',
    preparedFor: 'Columbia SPS Mastering Consulting',
    refinedProblemStatement: one.status === 'approved' ? one.reframeText || '' : '',
    highValueQuestions: highQuestions.map((item) => ({
      sourceItemId: item.id || '',
      question: item.reengineeredQuestion || item.rawText || item.text || '',
      whoMustSayYes: item.whoSaysYes || '',
      vetoHolder: item.veto || '',
      likelyToSayNo: item.likelyToSayNo || '',
    })),
    typeMap: items.map((item) => ({
      sourceItemId: item.id || '',
      bucket: item.bucket || '',
      status: item.status || '',
      valueTag: item.valueTag || '',
      holder: item.holder || '',
      sourceField: item.sourceField || '',
      item: item.rawText || item.text || '',
    })),
    drillSummary: assumptions.map((assumption, index) => ({
      label: `Assumption ${index + 1}`,
      givenStatement: assumption.givenStatement || assumption.selectedText || '',
      wrongIf: assumption.wrongIf || '',
      whatChanges: assumption.whatChanges || '',
    })),
    oneThingLeftOpen: one.oneThingLeftOpen || '',
    whyLeftOpen: one.whyLeftOpen || '',
    guardrailNote: [
      'Generated only from approved workspace fields.',
      omittedHighValueCount ? `${omittedHighValueCount} high-value item(s) were omitted because who says yes, who can say no, or likely no was blank or placeholder text.` : '',
    ].filter(Boolean).join(' '),
  };
}

function buildReportMarkdown(document) {
  const lines = [];
  lines.push(`# ${document.title || 'Decision Manifold Studio Final Report'}`);
  if (document.subtitle) lines.push(document.subtitle);
  if (document.client) lines.push(`Client: ${document.client}`);
  lines.push('');
  lines.push('## Refined Problem Statement');
  lines.push(document.refinedProblemStatement || '_Draft not yet approved._');
  lines.push('');
  lines.push('## Curated High-Value Questions');
  if (!document.highValueQuestions?.length) lines.push('_No high-value questions tagged yet._');
  (document.highValueQuestions || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question || ''}`);
    lines.push(`   - Who must say yes: ${item.whoMustSayYes || ''}`);
    lines.push(`   - Who holds veto: ${item.vetoHolder || ''}`);
    lines.push(`   - Likely to say no: ${item.likelyToSayNo || ''}`);
  });
  lines.push('');
  lines.push('## Type Map');
  lines.push('| Bucket | Status | Value | Holder/source | Source | Item |');
  lines.push('|---|---|---|---|---|---|');
  (document.typeMap || []).forEach((item) => {
    lines.push(`| ${safeCell(item.bucket)} | ${safeCell(item.status)} | ${safeCell(item.valueTag)} | ${safeCell(item.holder)} | ${safeCell(item.sourceField)} | ${safeCell(item.item)} |`);
  });
  lines.push('');
  lines.push('## Assumption Drill Summary');
  (document.drillSummary || []).forEach((assumption) => {
    lines.push(`### ${assumption.label || 'Assumption'}`);
    lines.push(`Given: ${assumption.givenStatement || ''}`);
    lines.push(`Wrong if: ${assumption.wrongIf || ''}`);
    lines.push(`What changes: ${assumption.whatChanges || ''}`);
  });
  lines.push('');
  lines.push('## One Thing Left Open');
  lines.push(document.oneThingLeftOpen || '');
  if (document.whyLeftOpen) lines.push(`\n${document.whyLeftOpen}`);
  if (document.guardrailNote) {
    lines.push('');
    lines.push('## Guardrail Note');
    lines.push(document.guardrailNote);
  }
  return lines.join('\n');
}

async function getAuthenticatedEmail(request, env) {
  const allowedDomains = getAllowedEmailDomains(env);
  let email = request.headers.get('Cf-Access-Authenticated-User-Email');

  const devEmail = request.headers.get('X-Studio-Dev-Email');
  const devSecret = request.headers.get('X-Studio-Dev-Secret');
  if (!email && env.DEV_AUTH_SECRET && devEmail && devSecret === env.DEV_AUTH_SECRET) {
    email = devEmail;
  }

  if (!email && env.SESSION_SECRET) {
    email = await readSignedSessionEmail(request, env);
  }

  email = cleanEmail(email);
  if (!email) {
    return { ok: false, status: 401, error: 'Cloudflare Access email is missing.' };
  }
  if (!emailAllowed(email, allowedDomains) && !isMasterLoginEmail(email, env)) {
    return { ok: false, status: 403, error: `Only ${allowedDomainsLabel(allowedDomains)} accounts may register.` };
  }
  return { ok: true, email };
}

function getAllowedEmailDomains(env) {
  const raw = env.ALLOWED_EMAIL_DOMAINS || env.ALLOWED_EMAIL_DOMAIN || 'columbia.edu';
  return raw
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

function allowedDomainsLabel(allowedDomains) {
  return allowedDomains.map((domain) => `@${domain}`).join(' or ');
}

function emailAllowed(email, allowedDomains) {
  const domain = email.split('@')[1] || '';
  return allowedDomains.some((allowedDomain) => (
    domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
  ));
}

function isMasterLoginEmail(email, env) {
  const masterEmail = cleanEmail(env.MASTER_LOGIN_EMAIL || '');
  return Boolean(masterEmail) && cleanEmail(email) === masterEmail;
}

async function signedSessionCookie(email, env, request) {
  const maxAge = Number(env.SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 7);
  const payload = base64UrlEncode(JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  }));
  const signature = await signSessionPayload(payload, env.SESSION_SECRET);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `studio_session=${payload}.${signature}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function expiredSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `studio_session=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
}

async function readSignedSessionEmail(request, env) {
  const token = parseCookies(request.headers.get('Cookie') || '').studio_session;
  if (!token || !token.includes('.')) return '';
  const [payload, signature] = token.split('.', 2);
  if (!payload || !signature) return '';
  const expected = await signSessionPayload(payload, env.SESSION_SECRET);
  if (!constantTimeEqual(signature, expected)) return '';

  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!session.exp || Number(session.exp) < Math.floor(Date.now() / 1000)) return '';
    return cleanEmail(session.email);
  } catch (_) {
    return '';
  }
}

async function signSessionPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function base64UrlEncode(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getRegisteredContext(env, email) {
  const user = await getUserByEmail(env, email);
  return { user };
}

async function getUserByEmail(env, email) {
  return env.STUDIO_DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();
}

async function ensureEngagement(env) {
  await env.STUDIO_DB.prepare(
    `INSERT OR IGNORE INTO engagements (id, name, client_name, cohort_name, status)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    ENGAGEMENT_ID,
    'Decision Manifold Studio',
    'Bethany House of Nassau County',
    'Columbia SPS Mastering Consulting Summer 2026',
    'active'
  ).run();
}

async function getPrimaryTeam(env, userId) {
  return env.STUDIO_DB.prepare(
    `SELECT t.*
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     WHERE tm.user_id = ?
     ORDER BY t.created_at ASC
     LIMIT 1`
  ).bind(userId).first();
}

async function ensureWorkspace(env, teamId, userId) {
  let workspace = await env.STUDIO_DB.prepare(
    `SELECT * FROM workspaces WHERE team_id = ? AND engagement_id = ?`
  ).bind(teamId, ENGAGEMENT_ID).first();

  if (!workspace) {
    workspace = {
      id: crypto.randomUUID(),
      team_id: teamId,
      engagement_id: ENGAGEMENT_ID,
      status: 'draft',
      current_step: 'intake',
    };
    await env.STUDIO_DB.prepare(
      `INSERT INTO workspaces (id, team_id, engagement_id, status, current_step)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(workspace.id, workspace.team_id, workspace.engagement_id, workspace.status, workspace.current_step).run();
  }

  await env.STUDIO_DB.prepare(
    `INSERT OR IGNORE INTO workspace_states (workspace_id, state_json, updated_by)
     VALUES (?, ?, ?)`
  ).bind(workspace.id, JSON.stringify(DEFAULT_STATE), userId).run();

  return workspace;
}

async function loadWorkspaceBundle(env, userId) {
  const team = await getPrimaryTeam(env, userId);
  if (!team) {
    return { team: null, workspace: null, state: null, engagement: null };
  }

  const workspace = await env.STUDIO_DB.prepare(
    `SELECT * FROM workspaces WHERE team_id = ? AND engagement_id = ?`
  ).bind(team.id, ENGAGEMENT_ID).first();
  const engagement = await env.STUDIO_DB.prepare(
    `SELECT * FROM engagements WHERE id = ?`
  ).bind(ENGAGEMENT_ID).first();

  let state = normalizeState(DEFAULT_STATE);
  if (workspace) {
    const stored = await env.STUDIO_DB.prepare(
      `SELECT state_json FROM workspace_states WHERE workspace_id = ?`
    ).bind(workspace.id).first();
    if (stored?.state_json) {
      try {
        state = normalizeState(JSON.parse(stored.state_json));
      } catch (_) {
        state = normalizeState(DEFAULT_STATE);
      }
    }
  }

  return { team, workspace, state, engagement };
}

async function createUniqueJoinCode(env) {
  for (let i = 0; i < 8; i += 1) {
    const code = randomCode(6);
    const found = await env.STUDIO_DB.prepare(
      `SELECT id FROM teams WHERE join_code = ?`
    ).bind(code).first();
    if (!found) return code;
  }
  return randomCode(10);
}

async function audit(env, workspaceId, userId, action, payload = {}) {
  await env.STUDIO_DB.prepare(
    `INSERT INTO audit_events (id, workspace_id, user_id, action, payload_json)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), workspaceId, userId, action, JSON.stringify(payload)).run();
}

function normalizeState(input) {
  const state = structuredClone(DEFAULT_STATE);
  const source = input && typeof input === 'object' ? input : {};
  deepMerge(state, source);
  if (!Array.isArray(state.items)) state.items = [];
  state.items = state.items.map((item) => {
    const normalized = {
      id: item.id || crypto.randomUUID(),
      sourceField: item.sourceField || 'known',
      rawText: item.rawText || item.text || '',
      bucket: item.bucket || '',
      holder: item.holder || '',
      veto: item.veto || '',
      status: item.status || 'needs_attribution',
      valueTag: item.valueTag || '',
      valueRationale: item.valueRationale || '',
      aiNotes: item.aiNotes || '',
      whoSaysYes: item.whoSaysYes || '',
      likelyToSayNo: item.likelyToSayNo || '',
      reengineeredQuestion: item.reengineeredQuestion || '',
    };
    normalized.status = normalized.bucket && isMeaningfulField(normalized.holder) ? 'settled' : 'needs_attribution';
    return normalized;
  });
  state.oneSentence.status = state.oneSentence.status === 'approved' ? 'approved' : 'draft';
  return state;
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object') {
      deepMerge(target[key], value);
    } else if (value !== undefined) {
      target[key] = value;
    }
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function json(data, status = 200, request, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

function html(markup) {
  return new Response(markup, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function corsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Studio-Dev-Email, X-Studio-Dev-Secret',
    'Vary': 'Origin',
  };
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

function isPlatformHost(host) {
  return host === 'platform.zetesislabs.com';
}

function renderPlatformPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zetesis Platform</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    :root { --ink:#111; --muted:#555; --hairline:#d7d7d7; --serif:"Times New Roman",Times,Georgia,serif; --mono:"SFMono-Regular",ui-monospace,Menlo,Monaco,"Courier New",monospace; --sans:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    * { box-sizing: border-box; border-radius: 0; }
    body { margin:0; color:var(--ink); background:#fff; font-family:var(--sans); line-height:1.5; }
    .shell { max-width: 920px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    nav { display:flex; justify-content:space-between; gap:1rem; border-bottom:1px solid var(--hairline); padding-bottom:1rem; }
    h1 { font-family:var(--serif); font-size:58px; line-height:1.05; font-weight:400; margin:4rem 0 1rem; }
    p { color:var(--muted); font-size:18px; max-width:680px; }
    a { color:inherit; text-decoration:none; }
    .card { display:grid; grid-template-columns:64px minmax(0,1fr) 32px; gap:1.25rem; border-top:1px solid var(--hairline); border-bottom:1px solid var(--hairline); padding:2rem 0; margin-top:3rem; }
    .idx,.meta { font-family:var(--mono); color:#666; font-size:12px; }
    .title { font-size:30px; margin-bottom:.35rem; }
    @media (max-width: 640px) { h1 { font-size:42px; } .card { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <main class="shell">
    <nav><strong>Zetesis Labs</strong><a href="https://zetesislabs.com/">Main site</a></nav>
    <h1>Zetesis Platform</h1>
    <p>For the moment when a team has notes, pressure, and a deadline, but not yet a question it can defend.</p>
    <a class="card" href="/decision-engineering/">
      <span class="idx">[ I ]</span>
      <span>
        <span class="title">Decision Engineering Studio</span>
        <p>Sort the brief, name who knows what, test the assumptions carrying the answer, and leave with a report the team can stand behind.</p>
      </span>
      <span aria-hidden="true">→</span>
    </a>
  </main>
</body>
</html>`;
}

function cleanString(value, max = 1000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanString(value || '', 320).toLowerCase();
}

function isMeaningfulField(value) {
  const text = cleanString(value || '', 300).toLowerCase();
  if (!text) return false;
  return !/^(unknown|unk|n\/a|na|none|null|tbd|todo|to be decided|optional|placeholder|\?|not sure)$/i.test(text);
}

function isReadyHighValueQuestion(item) {
  return item
    && item.valueTag === 'High'
    && item.bucket
    && item.bucket !== 'KK'
    && isMeaningfulField(item.reengineeredQuestion || item.rawText || item.text)
    && isMeaningfulField(item.whoSaysYes)
    && isMeaningfulField(item.veto)
    && isMeaningfulField(item.likelyToSayNo);
}

function randomCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function splitAtomic(text) {
  return cleanString(text, 20000)
    .split(/\n+|(?:^|\s)[-*]\s+/)
    .flatMap((part) => part.split(/(?<=[.?])\s+(?=[A-Z0-9])/))
    .map((part) => part.replace(/^\d+[.)]\s*/, '').trim())
    .filter((part) => part.length > 2)
    .slice(0, 80);
}

function inferBucket(text, sourceField) {
  const lower = text.toLowerCase();
  if (/what question.*framing.*keeping|nobody|not thought|unasked|what if|missing entirely|surpris/.test(lower)) return 'UU';
  if (/unstated|not written|in its bones|tacit|privately|informal|never said/.test(lower)) return 'UK';
  if (sourceField === 'openQuestions' || text.includes('?')) return 'KU';
  if (sourceField === 'assumptions') return 'KU';
  if (/assume|might|maybe|unknown|need to|need her|ask/.test(lower)) return 'KU';
  return 'KK';
}

function detectGuardrailRequest(payload) {
  const text = JSON.stringify(payload || {}).toLowerCase();
  return /privately thinks|private meaning|probably means|really worried|what she means|what the ceo means|just tell me what.*ceo/.test(text);
}

function isSortGuardrailItem(text) {
  const lower = cleanString(text, 1000).toLowerCase();
  return /probably knows|probably thinks|private meaning|privately means|really worried|invent the question|invent.*unknown|fill.*unknown|what.*ceo.*private/.test(lower);
}

function lowerFirst(text) {
  const clean = cleanString(text, 300);
  return clean ? clean.charAt(0).toLowerCase() + clean.slice(1) : clean;
}

function tokenize(text) {
  return cleanString(text, 2000)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function safeCell(value) {
  return cleanString(value || '', 500)
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ');
}
