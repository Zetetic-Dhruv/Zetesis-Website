import { renderStudioPage } from './studio-page.js';
import { renderInstructorPage } from './instructor-page.js';

const ENGAGEMENT_ID = 'eng_bethany_house_2026';
const CLASS_ID = 'class_bethany_house_2026';
const STUDENT_CODE_ID = 'code_bethany_house_student_2026';
const ADMIN_CODE_ID = 'code_bethany_house_admin_2026';
const ABUSE_MESSAGE = 'This workspace only processes Bethany House decision work for the current class assignment.';
const SESSION_COOKIE = 'studio_session';
const PASSWORD_ITERATIONS = 100000;
const DEFAULT_SESSION_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_USAGE_LIMIT_MICROS = 10000000;

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

    if (isInstructorHost(host)) {
      if (pathname.startsWith('/api/instructor')) {
        return handleInstructorApi(request, env, pathname);
      }
      return html(renderInstructorPage());
    }

    if (isPlatformHost(host) && pathname === '/') {
      return html(renderPlatformPage());
    }

    if (isPlatformHost(host) && pathname === '/instructor') {
      return html(renderInstructorPage());
    }

    if (pathname === '/studio' || pathname === '/decision-engineering') {
      return html(renderStudioPage());
    }

    if (pathname.startsWith('/api/instructor')) {
      return handleInstructorApi(request, env, pathname);
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
    await ensurePlatformSeedData(env);

    if (request.method === 'POST' && pathname === '/api/studio/auth/register') {
      return await handleAccountRegister(request, env, { requireAdminCode: false });
    }

    if (request.method === 'POST' && pathname === '/api/studio/auth/login') {
      return await handleAccountLogin(request, env, { requireAdmin: false });
    }

    if (
      (request.method === 'POST' && pathname === '/api/studio/auth/logout')
      || (request.method === 'POST' && pathname === '/api/studio/logout')
    ) {
      return await handleAccountLogout(request, env);
    }

    const auth = await authenticateRequest(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, request);

    if (request.method === 'GET' && pathname === '/api/studio/me') {
      return await handlePlatformMe(request, env, auth);
    }

    if (request.method === 'GET' && pathname === '/api/studio/workspace') {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return json(await loadWorkspaceBundle(env, auth.user.id, ctx.membership), 200, request);
    }

    if (request.method === 'PUT' && pathname === '/api/studio/workspace') {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return await handleSaveWorkspace(request, env, auth.user, ctx.membership);
    }

    if (request.method === 'POST' && pathname === '/api/studio/llm') {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return await handleLlm(request, env, auth.user, ctx.membership);
    }

    if (request.method === 'POST' && pathname === '/api/studio/report/preview') {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return await handleReportPreview(request, env, auth.user, ctx.membership);
    }

    if (request.method === 'POST' && pathname === '/api/studio/report/save-version') {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return await handleSaveReportVersion(request, env, auth.user, ctx.membership);
    }

    if (request.method === 'GET' && pathname === '/api/studio/report/versions') {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return json({ versions: await listReportVersions(env, auth.user.id) }, 200, request);
    }

    const pdfMatch = pathname.match(/^\/api\/studio\/report\/versions\/([^/]+)\/pdf$/);
    if (request.method === 'GET' && pdfMatch) {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return await handleDownloadVersionPdf(request, env, auth.user, ctx.membership, pdfMatch[1]);
    }

    if (request.method === 'POST' && pathname === '/api/studio/report/pdf') {
      const ctx = await getStudentContext(env, auth.user.id);
      if (!ctx.ok) return json({ error: ctx.error }, ctx.status, request);
      return await handleInlineReportPdf(request, env, auth.user, ctx.membership);
    }

    return json({ error: 'Not Found' }, 404, request);
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500, request);
  }
}

async function handleInstructorApi(request, env, pathname) {
  try {
    if (!env.STUDIO_DB) {
      return json({ error: 'STUDIO_DB binding is not configured.' }, 500, request);
    }
    await ensurePlatformSeedData(env);

    if (request.method === 'POST' && pathname === '/api/instructor/auth/register') {
      return await handleAccountRegister(request, env, { requireAdminCode: true });
    }

    if (request.method === 'POST' && pathname === '/api/instructor/auth/login') {
      return await handleAccountLogin(request, env, { requireAdmin: true });
    }

    if (request.method === 'POST' && pathname === '/api/instructor/auth/logout') {
      return await handleAccountLogout(request, env);
    }

    const auth = await authenticateRequest(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, request);
    const admin = await getAdminContext(env, auth.user.id);
    if (!admin.ok) return json({ error: admin.error }, admin.status, request);

    if (request.method === 'GET' && pathname === '/api/instructor/me') {
      return json({ authenticated: true, user: publicUser(auth.user), membership: publicMembership(admin.membership) }, 200, request);
    }

    if (request.method === 'GET' && pathname === '/api/instructor/classes') {
      return json({ classes: await listInstructorClasses(env) }, 200, request);
    }

    const studentsMatch = pathname.match(/^\/api\/instructor\/classes\/([^/]+)\/students$/);
    if (request.method === 'GET' && studentsMatch) {
      return json({ students: await listClassStudents(env, studentsMatch[1]) }, 200, request);
    }

    const zipMatch = pathname.match(/^\/api\/instructor\/classes\/([^/]+)\/pdf-zip$/);
    if (request.method === 'GET' && zipMatch) {
      return await handleClassPdfZip(request, env, zipMatch[1]);
    }

    const studentMatch = pathname.match(/^\/api\/instructor\/students\/([^/]+)$/);
    if (request.method === 'GET' && studentMatch) {
      return json(await getInstructorStudent(env, studentMatch[1]), 200, request);
    }

    const promptsMatch = pathname.match(/^\/api\/instructor\/students\/([^/]+)\/prompts$/);
    if (request.method === 'GET' && promptsMatch) {
      return json({ prompts: await getInstructorPrompts(env, promptsMatch[1]) }, 200, request);
    }

    const versionsMatch = pathname.match(/^\/api\/instructor\/students\/([^/]+)\/versions$/);
    if (request.method === 'GET' && versionsMatch) {
      return json({ versions: await getInstructorVersions(env, versionsMatch[1]) }, 200, request);
    }

    const instructorPdfMatch = pathname.match(/^\/api\/instructor\/report\/versions\/([^/]+)\/pdf$/);
    if (request.method === 'GET' && instructorPdfMatch) {
      const version = await env.STUDIO_DB.prepare(
        `SELECT * FROM report_versions WHERE id = ?`
      ).bind(instructorPdfMatch[1]).first();
      if (!version) return json({ error: 'Report version not found.' }, 404, request);
      return await serveVersionPdf(request, env, version, defaultPdfFilename(`v${version.version_number}`));
    }

    const resetMatch = pathname.match(/^\/api\/instructor\/students\/([^/]+)\/reset-usage$/);
    if (request.method === 'POST' && resetMatch) {
      await env.STUDIO_DB.prepare(
        `UPDATE class_memberships
         SET usage_used_micros = 0, model_access_status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE user_id = ? AND class_id = ?`
      ).bind(resetMatch[1], CLASS_ID).run();
      return json({ ok: true }, 200, request);
    }

    const accessMatch = pathname.match(/^\/api\/instructor\/students\/([^/]+)\/model-access$/);
    if (request.method === 'POST' && accessMatch) {
      const body = await readJson(request);
      const status = body.status === 'blocked' ? 'blocked' : 'active';
      await env.STUDIO_DB.prepare(
        `UPDATE class_memberships
         SET model_access_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE user_id = ? AND class_id = ? AND role = 'student'`
      ).bind(status, accessMatch[1], CLASS_ID).run();
      return json({ ok: true, status }, 200, request);
    }

    const retireMatch = pathname.match(/^\/api\/instructor\/class-codes\/([^/]+)\/retire$/);
    if (request.method === 'POST' && retireMatch) {
      const code = await env.STUDIO_DB.prepare(`SELECT * FROM class_codes WHERE id = ?`).bind(retireMatch[1]).first();
      if (!code) return json({ error: 'Class code not found.' }, 404, request);
      if (code.permanent || code.role === 'admin') return json({ error: 'The admin class code cannot be retired.' }, 400, request);
      await env.STUDIO_DB.batch([
        env.STUDIO_DB.prepare(
          `UPDATE class_codes SET status = 'retired', retired_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
        ).bind(code.id),
        env.STUDIO_DB.prepare(
          `UPDATE class_memberships
           SET model_access_status = 'blocked', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE class_code_id = ? AND role = 'student'`
        ).bind(code.id),
      ]);
      return json({ ok: true }, 200, request);
    }

    return json({ error: 'Not Found' }, 404, request);
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500, request);
  }
}

async function handleAccountRegister(request, env, options = {}) {
  const body = await readJson(request);
  const name = cleanString(body.name, 120);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  const classCodeText = cleanString(body.classCode || '', 160);

  if (!name) return json({ error: 'Name is required.' }, 400, request);
  if (!email || !email.includes('@')) return json({ error: 'A valid email is required.' }, 400, request);
  if (password.length < 8) return json({ error: 'Use at least 8 characters for the password.' }, 400, request);
  if (!classCodeText) return json({ error: 'Class code is required.' }, 400, request);

  const classCode = await findClassCode(env, classCodeText);
  if (!classCode) return json({ error: 'Class code not recognized.' }, 403, request);
  if (classCode.status === 'retired' && classCode.role !== 'admin') return json({ error: 'This class code has been retired.' }, 403, request);
  if (options.requireAdminCode && classCode.role !== 'admin') return json({ error: 'Instructor registration requires an admin code.' }, 403, request);

  await ensureEngagement(env);

  let user = await getUserByEmail(env, email);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      name,
      role: classCode.role === 'admin' ? 'admin' : 'student',
    };
    await env.STUDIO_DB.prepare(
      `INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)`
    ).bind(user.id, user.email, user.name, user.role).run();
  } else {
    const role = user.role === 'admin' || classCode.role === 'admin' ? 'admin' : 'student';
    await env.STUDIO_DB.prepare(
      `UPDATE users SET name = ?, role = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).bind(name, role, user.id).run();
    user = { ...user, name, role };
  }

  const credential = await env.STUDIO_DB.prepare(
    `SELECT user_id FROM user_credentials WHERE user_id = ?`
  ).bind(user.id).first();
  if (credential) {
    return json({ error: 'An account already exists for this email. Log in instead.' }, 409, request);
  }

  const passwordRecord = await hashPassword(password, env);
  await env.STUDIO_DB.prepare(
    `INSERT INTO user_credentials (
      user_id, password_hash, password_salt, password_alg, password_iterations, password_version
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    user.id,
    passwordRecord.hash,
    passwordRecord.salt,
    'PBKDF2-SHA256',
    PASSWORD_ITERATIONS,
    1
  ).run();

  const membership = await ensureClassMembership(env, user, classCode);
  await ensurePersonalWorkspace(env, user, membership);
  const session = await createSession(env, user.id, request);
  const bundle = await loadWorkspaceBundle(env, user.id, membership);

  return json({
    authenticated: true,
    registered: true,
    email,
    user: publicUser(user),
    membership: publicMembership(membership),
    usage: await getUsageSummary(env, membership),
    ...bundle,
  }, 200, request, { 'Set-Cookie': session.cookie });
}

async function handleAccountLogin(request, env, options = {}) {
  const body = await readJson(request);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) return json({ error: 'Email and password are required.' }, 400, request);

  const user = await getUserByEmail(env, email);
  if (!user) return json({ error: 'Email or password is incorrect.' }, 403, request);
  const credential = await env.STUDIO_DB.prepare(
    `SELECT * FROM user_credentials WHERE user_id = ?`
  ).bind(user.id).first();
  if (!credential || !(await verifyPassword(password, credential, env))) {
    return json({ error: 'Email or password is incorrect.' }, 403, request);
  }

  const membership = options.requireAdmin
    ? (await getAdminContext(env, user.id)).membership
    : await getPrimaryMembership(env, user.id);
  if (!membership) return json({ error: options.requireAdmin ? 'Instructor access is invite only.' : 'No class membership found.' }, 403, request);
  if (options.requireAdmin && membership.role !== 'admin') return json({ error: 'Instructor access is invite only.' }, 403, request);

  await ensurePersonalWorkspace(env, user, membership);
  const session = await createSession(env, user.id, request);
  const bundle = await loadWorkspaceBundle(env, user.id, membership);
  return json({
    authenticated: true,
    registered: true,
    email,
    user: publicUser(user),
    membership: publicMembership(membership),
    usage: await getUsageSummary(env, membership),
    ...bundle,
  }, 200, request, { 'Set-Cookie': session.cookie });
}

async function handleAccountLogout(request, env) {
  const token = parseCookies(request.headers.get('Cookie') || '')[SESSION_COOKIE];
  if (token) {
    const tokenHash = await hashSessionToken(token, env);
    await env.STUDIO_DB.prepare(
      `UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token_hash = ?`
    ).bind(tokenHash).run();
  }
  return json({ ok: true }, 200, request, {
    'Set-Cookie': expiredSessionCookie(request),
  });
}

async function handlePlatformMe(request, env, auth) {
  const membership = await getPrimaryMembership(env, auth.user.id);
  if (!membership) {
    return json({
      authenticated: true,
      registered: false,
      email: auth.user.email,
      user: publicUser(auth.user),
    }, 200, request);
  }

  await ensurePersonalWorkspace(env, auth.user, membership);
  const bundle = await loadWorkspaceBundle(env, auth.user.id, membership);
  return json({
    authenticated: true,
    registered: true,
    email: auth.user.email,
    user: publicUser(auth.user),
    membership: publicMembership(membership),
    usage: await getUsageSummary(env, membership),
    versions: await listReportVersions(env, auth.user.id),
    ...bundle,
  }, 200, request);
}

async function authenticateRequest(request, env) {
  const token = parseCookies(request.headers.get('Cookie') || '')[SESSION_COOKIE];
  if (token) {
    const tokenHash = await hashSessionToken(token, env);
    const row = await env.STUDIO_DB.prepare(
      `SELECT s.*, u.id AS user_id, u.email, u.name, u.role, u.created_at AS user_created_at, u.updated_at AS user_updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       LIMIT 1`
    ).bind(tokenHash).first();
    if (row) {
      await env.STUDIO_DB.prepare(
        `UPDATE sessions SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
      ).bind(row.id).run();
      return {
        ok: true,
        user: {
          id: row.user_id,
          email: row.email,
          name: row.name,
          role: row.role,
          created_at: row.user_created_at,
          updated_at: row.user_updated_at,
        },
      };
    }
  }

  const devEmail = cleanEmail(request.headers.get('X-Studio-Dev-Email') || '');
  const devSecret = request.headers.get('X-Studio-Dev-Secret') || '';
  if (env.DEV_AUTH_SECRET && devEmail && devSecret === env.DEV_AUTH_SECRET) {
    const user = await getUserByEmail(env, devEmail);
    if (user) return { ok: true, user };
  }

  return { ok: false, status: 401, error: 'Log in or register to open the studio.' };
}

async function getStudentContext(env, userId) {
  const membership = await getPrimaryMembership(env, userId);
  if (!membership) return { ok: false, status: 403, error: 'Registration required.' };
  if (membership.status !== 'active') return { ok: false, status: 403, error: 'This account is locked for the current class.' };
  return { ok: true, membership };
}

async function getAdminContext(env, userId) {
  const membership = await env.STUDIO_DB.prepare(
    `SELECT cm.*, c.name AS class_name, c.slug AS class_slug, cc.status AS class_code_status
     FROM class_memberships cm
     JOIN classes c ON c.id = cm.class_id
     JOIN class_codes cc ON cc.id = cm.class_code_id
     WHERE cm.user_id = ? AND cm.role = 'admin'
     ORDER BY cm.created_at ASC
     LIMIT 1`
  ).bind(userId).first();
  if (!membership) return { ok: false, status: 403, error: 'Instructor access is invite only.' };
  return { ok: true, membership };
}

async function getPrimaryMembership(env, userId) {
  return env.STUDIO_DB.prepare(
    `SELECT cm.*, c.name AS class_name, c.slug AS class_slug, cc.status AS class_code_status
     FROM class_memberships cm
     JOIN classes c ON c.id = cm.class_id
     JOIN class_codes cc ON cc.id = cm.class_code_id
     WHERE cm.user_id = ?
     ORDER BY CASE WHEN cm.role = 'student' THEN 0 ELSE 1 END, cm.created_at ASC
     LIMIT 1`
  ).bind(userId).first();
}

async function ensureClassMembership(env, user, classCode) {
  const existing = await env.STUDIO_DB.prepare(
    `SELECT cm.*, c.name AS class_name, c.slug AS class_slug, cc.status AS class_code_status
     FROM class_memberships cm
     JOIN classes c ON c.id = cm.class_id
     JOIN class_codes cc ON cc.id = cm.class_code_id
     WHERE cm.class_id = ? AND cm.user_id = ?
     LIMIT 1`
  ).bind(classCode.class_id, user.id).first();
  if (existing) return existing;

  const membership = {
    id: crypto.randomUUID(),
    class_id: classCode.class_id,
    user_id: user.id,
    class_code_id: classCode.id,
    role: classCode.role,
    status: 'active',
    model_access_status: 'active',
    usage_limit_micros: classCode.role === 'admin' ? 0 : Number(classCode.usage_limit_micros || usageLimitMicros(env)),
    usage_used_micros: 0,
  };
  await env.STUDIO_DB.prepare(
    `INSERT INTO class_memberships (
      id, class_id, user_id, class_code_id, role, status, model_access_status,
      usage_limit_micros, usage_used_micros
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    membership.id,
    membership.class_id,
    membership.user_id,
    membership.class_code_id,
    membership.role,
    membership.status,
    membership.model_access_status,
    membership.usage_limit_micros,
    membership.usage_used_micros
  ).run();
  return getPrimaryMembership(env, user.id);
}

async function ensurePlatformSeedData(env) {
  await ensureEngagement(env);
  await env.STUDIO_DB.prepare(
    `INSERT OR IGNORE INTO classes (id, slug, name, status, default_engagement_id)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(CLASS_ID, 'bethany-house-2026', 'Bethany House Decision Engineering', 'active', ENGAGEMENT_ID).run();

  const studentCode = env.STUDENT_CLASS_CODE || 'ZetesisColumbia@2026';
  const adminCode = env.ADMIN_CLASS_CODE || 'ZeteticAdmin@8917';
  await upsertClassCode(env, {
    id: STUDENT_CODE_ID,
    classId: CLASS_ID,
    code: studentCode,
    role: 'student',
    permanent: 0,
    usageLimitMicros: usageLimitMicros(env),
  });
  await upsertClassCode(env, {
    id: ADMIN_CODE_ID,
    classId: CLASS_ID,
    code: adminCode,
    role: 'admin',
    permanent: 1,
    usageLimitMicros: 0,
  });
}

async function upsertClassCode(env, spec) {
  const hash = await classCodeHash(spec.code, env);
  const existing = await env.STUDIO_DB.prepare(`SELECT * FROM class_codes WHERE id = ?`).bind(spec.id).first();
  if (!existing) {
    await env.STUDIO_DB.prepare(
      `INSERT INTO class_codes (
        id, class_id, code_hash, role, status, permanent, usage_limit_micros
      ) VALUES (?, ?, ?, ?, 'active', ?, ?)`
    ).bind(spec.id, spec.classId, hash, spec.role, spec.permanent, spec.usageLimitMicros).run();
    return;
  }
  await env.STUDIO_DB.prepare(
    `UPDATE class_codes
     SET class_id = ?, code_hash = ?, role = ?, permanent = ?, usage_limit_micros = ?
     WHERE id = ?`
  ).bind(spec.classId, hash, spec.role, spec.permanent, spec.usageLimitMicros, spec.id).run();
}

async function findClassCode(env, codeText) {
  const hash = await classCodeHash(codeText, env);
  return env.STUDIO_DB.prepare(
    `SELECT cc.*, c.name AS class_name, c.slug AS class_slug
     FROM class_codes cc
     JOIN classes c ON c.id = cc.class_id
     WHERE cc.code_hash = ?
     LIMIT 1`
  ).bind(hash).first();
}

async function ensurePersonalWorkspace(env, user, membership) {
  let team = await getPrimaryTeam(env, user.id);
  if (!team) {
    team = {
      id: crypto.randomUUID(),
      engagement_id: ENGAGEMENT_ID,
      name: cleanString(`${user.name || user.email} Workspace`, 120),
      join_code: await createUniqueJoinCode(env),
      created_by: user.id,
    };
    await env.STUDIO_DB.prepare(
      `INSERT INTO teams (id, engagement_id, name, join_code, created_by) VALUES (?, ?, ?, ?, ?)`
    ).bind(team.id, team.engagement_id, team.name, team.join_code, team.created_by).run();
  }

  await env.STUDIO_DB.prepare(
    `INSERT OR IGNORE INTO team_members (team_id, user_id, member_role) VALUES (?, ?, ?)`
  ).bind(team.id, user.id, membership?.role === 'admin' ? 'owner' : 'member').run();
  return ensureWorkspace(env, team.id, user.id);
}

async function createSession(env, userId, request) {
  const token = base64UrlEncodeBytes(randomBytes(32));
  const tokenHash = await hashSessionToken(token, env);
  const maxAge = Number(env.SESSION_MAX_AGE_SECONDS || DEFAULT_SESSION_SECONDS);
  const expires = new Date(Date.now() + maxAge * 1000).toISOString();
  await env.STUDIO_DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
  ).bind(crypto.randomUUID(), userId, tokenHash, expires).run();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    token,
    cookie: `${SESSION_COOKIE}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  };
}

async function hashPassword(password, env) {
  const salt = base64UrlEncodeBytes(randomBytes(16));
  const hash = await pbkdf2(passwordWithPepper(password, env), salt, PASSWORD_ITERATIONS);
  return { hash, salt };
}

async function verifyPassword(password, credential, env) {
  const iterations = Number(credential.password_iterations || PASSWORD_ITERATIONS);
  const hash = await pbkdf2(passwordWithPepper(password, env), credential.password_salt, iterations);
  return constantTimeEqual(hash, credential.password_hash);
}

function passwordWithPepper(password, env) {
  return `${password}:${env.PASSWORD_PEPPER || env.SESSION_SECRET || 'local-password-pepper'}`;
}

async function pbkdf2(secret, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations,
    },
    keyMaterial,
    256
  );
  return base64UrlEncodeBytes(new Uint8Array(bits));
}

async function hashSessionToken(token, env) {
  return hmacHex(token, env.SESSION_TOKEN_PEPPER || env.SESSION_SECRET || 'local-session-pepper');
}

async function classCodeHash(code, env) {
  return hmacHex(cleanString(code, 160), env.CLASS_CODE_PEPPER || env.SESSION_SECRET || 'local-class-code-pepper');
}

async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function publicMembership(membership) {
  if (!membership) return null;
  return {
    id: membership.id,
    class_id: membership.class_id,
    class_name: membership.class_name,
    class_slug: membership.class_slug,
    role: membership.role,
    status: membership.status,
    model_access_status: membership.model_access_status,
    usage_limit_micros: Number(membership.usage_limit_micros || 0),
    usage_used_micros: Number(membership.usage_used_micros || 0),
    class_code_status: membership.class_code_status,
  };
}

function usageLimitMicros(env) {
  return Number(env.STUDENT_USAGE_LIMIT_MICROS || DEFAULT_USAGE_LIMIT_MICROS);
}

async function handleSaveWorkspace(request, env, user, membership = null) {
  const body = await readJson(request);
  const state = normalizeState(body.state);
  const bundle = await loadWorkspaceBundle(env, user.id, membership);
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

async function handleLlm(request, env, user, membership = null) {
  const body = await readJson(request);
  const moduleName = cleanString(body.module, 80);
  const payload = body.payload || {};

  if (!moduleName || !MODULES[moduleName]) {
    return json({ error: 'Unknown LLM module.' }, 400, request);
  }

  const bundle = await loadWorkspaceBundle(env, user.id, membership);
  if (!bundle.workspace) {
    return json({ error: 'Workspace not found.' }, 404, request);
  }

  const access = await checkModelAccess(env, membership, moduleName, payload);
  if (!access.ok) {
    if (access.abuse) {
      await logAbuse(env, membership, bundle.workspace.id, user.id, moduleName, access.reason, payload);
      await audit(env, bundle.workspace.id, user.id, 'llm_guardrail_reject', { module: moduleName, reason: access.reason });
      return json({ error: ABUSE_MESSAGE }, 400, request);
    }
    return json({ error: access.error }, access.status, request);
  }

  let result;
  let provider = 'fallback';
  let responseMeta = {
    model: '',
    inputTokens: 0,
    outputTokens: 0,
    systemPrompt: SHARED_SYSTEM_PROMPT,
    modulePrompt: MODULES[moduleName].prompt(payload),
  };
  const mode = cleanString(env.AGENT_API_MODE || 'openai', 40).toLowerCase();
  if (moduleName === 'final_report') {
    result = fallbackRaw(moduleName, payload);
    provider = 'guarded-local';
  } else if (mode === 'fixture' || mode === 'offline') {
    result = fallbackModule(moduleName, payload, 'Offline agent fixture mode; no external LLM call made.');
    provider = 'offline-agent';
  } else if (env.OPENAI_API_KEY) {
    try {
      const openAi = await runOpenAi(env, moduleName, payload);
      result = openAi.result;
      responseMeta = { ...responseMeta, ...openAi.meta };
      provider = 'openai';
    } catch (error) {
      result = fallbackModule(moduleName, payload, `OpenAI call failed: ${error.message}`);
    }
  } else {
    result = fallbackModule(moduleName, payload, 'OPENAI_API_KEY is not configured; used local fallback.');
  }

  const estimatedCostMicros = estimateCostMicros(env, responseMeta.inputTokens, responseMeta.outputTokens, provider);
  const runId = crypto.randomUUID();
  await env.STUDIO_DB.prepare(
    `INSERT INTO llm_runs (
      id, workspace_id, user_id, module, request_json, response_json, provider,
      class_membership_id, system_prompt, module_prompt, model,
      input_tokens, output_tokens, estimated_cost_micros, guardrail_status
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    runId,
    bundle.workspace.id,
    user.id,
    moduleName,
    JSON.stringify(payload),
    JSON.stringify(result),
    provider,
    membership?.id || null,
    responseMeta.systemPrompt || '',
    responseMeta.modulePrompt || '',
    responseMeta.model || '',
    responseMeta.inputTokens || 0,
    responseMeta.outputTokens || 0,
    estimatedCostMicros,
    'ok'
  ).run();

  if (membership) {
    await recordUsage(env, membership, bundle.workspace.id, runId, moduleName, provider, responseMeta.inputTokens || 0, responseMeta.outputTokens || 0, estimatedCostMicros, 'ok');
  }

  await audit(env, bundle.workspace.id, user.id, 'llm_run', { module: moduleName, provider });
  return json({ module: moduleName, provider, result, usage: await getUsageSummary(env, membership) }, 200, request);
}

async function handleReportPreview(request, env, user, membership) {
  const body = await readJson(request);
  const state = normalizeState(body.state || (await loadWorkspaceBundle(env, user.id, membership)).state);
  const report = fallbackRaw('final_report', { state });
  const pdfBytes = buildPdfBytes(reportLines(report.document));
  return json({
    document: report.document,
    markdown: report.markdown,
    filename: defaultPdfFilename(),
    pdfBase64: bytesToBase64(pdfBytes),
    generatedAt: new Date().toISOString(),
  }, 200, request);
}

async function handleSaveReportVersion(request, env, user, membership) {
  const body = await readJson(request);
  const bundle = await loadWorkspaceBundle(env, user.id, membership);
  if (!bundle.workspace) return json({ error: 'Workspace not found.' }, 404, request);
  const state = normalizeState(body.state || bundle.state);
  const ready = reportReadinessError(state);
  if (ready) return json({ error: ready }, 400, request);

  const report = fallbackRaw('final_report', { state });
  state.finalReport.document = report.document;
  state.finalReport.markdown = report.markdown;
  state.finalReport.generatedAt = new Date().toISOString();
  state.finalReport.pdfGeneratedAt = state.finalReport.generatedAt;

  const previous = await env.STUDIO_DB.prepare(
    `SELECT COALESCE(MAX(version_number), 0) AS max_version FROM report_versions WHERE workspace_id = ?`
  ).bind(bundle.workspace.id).first();
  const versionNumber = Number(previous?.max_version || 0) + 1;
  const versionId = crypto.randomUUID();
  const pdfBytes = buildPdfBytes(reportLines(report.document));
  let key = `classes/${membership.class_id}/users/${user.id}/workspaces/${bundle.workspace.id}/versions/${versionId}.pdf`;
  let d1ArtifactBase64 = '';

  if (env.STUDIO_ARTIFACTS) {
    try {
      await env.STUDIO_ARTIFACTS.put(key, pdfBytes, {
        httpMetadata: { contentType: 'application/pdf' },
        customMetadata: {
          userId: user.id,
          workspaceId: bundle.workspace.id,
          classId: membership.class_id,
          versionId,
          versionNumber: String(versionNumber),
        },
      });
    } catch (_) {
      key = `d1:${versionId}`;
      d1ArtifactBase64 = bytesToBase64(pdfBytes);
    }
  } else {
    key = `d1:${versionId}`;
    d1ArtifactBase64 = bytesToBase64(pdfBytes);
  }

  const statements = [
    env.STUDIO_DB.prepare(
      `INSERT INTO report_versions (
        id, workspace_id, user_id, class_id, version_number, title,
        state_json, report_json, report_text, pdf_r2_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      versionId,
      bundle.workspace.id,
      user.id,
      membership.class_id,
      versionNumber,
      `Decision Engineering Report v${versionNumber}`,
      JSON.stringify(state),
      JSON.stringify(report.document),
      report.markdown,
      key
    ),
  ];

  if (d1ArtifactBase64) {
    statements.push(
      env.STUDIO_DB.prepare(
        `INSERT INTO report_artifacts (id, report_version_id, content_type, content_base64)
         VALUES (?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), versionId, 'application/pdf', d1ArtifactBase64)
    );
  }

  statements.push(
    env.STUDIO_DB.prepare(
      `INSERT INTO workspace_states (workspace_id, state_json, updated_by, updated_at)
       VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(workspace_id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    ).bind(bundle.workspace.id, JSON.stringify(state), user.id),
    env.STUDIO_DB.prepare(
      `UPDATE workspaces SET current_step = 'report', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).bind(bundle.workspace.id),
  );

  await env.STUDIO_DB.batch(statements);

  await audit(env, bundle.workspace.id, user.id, 'save_report_version', { versionId, versionNumber });
  return json({
    ok: true,
    version: sanitizeReportVersion({
      id: versionId,
      workspace_id: bundle.workspace.id,
      user_id: user.id,
      class_id: membership.class_id,
      version_number: versionNumber,
      title: `Decision Engineering Report v${versionNumber}`,
      pdf_r2_key: key,
      created_at: new Date().toISOString(),
    }),
    document: report.document,
    markdown: report.markdown,
    filename: defaultPdfFilename(`v${versionNumber}`),
    pdfBase64: bytesToBase64(pdfBytes),
    versions: await listReportVersions(env, user.id),
    state,
  }, 200, request);
}

async function handleDownloadVersionPdf(request, env, user, membership, versionId) {
  const version = await env.STUDIO_DB.prepare(
    `SELECT * FROM report_versions WHERE id = ? AND user_id = ? AND class_id = ?`
  ).bind(versionId, user.id, membership.class_id).first();
  if (!version) return json({ error: 'Report version not found.' }, 404, request);
  return serveVersionPdf(request, env, version, defaultPdfFilename(`v${version.version_number}`));
}

async function handleInlineReportPdf(request, env, user, membership) {
  const body = await readJson(request);
  const report = body.report || {};
  const pdfBytes = buildPdfBytes(reportLines(report));
  await audit(env, null, user.id, 'pdf_render', { provider: 'worker', classMembershipId: membership?.id || '' });
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${defaultPdfFilename()}"`,
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    },
  });
}

async function runOpenAi(env, moduleName, payload) {
  const mod = MODULES[moduleName];
  const modulePrompt = mod.prompt(payload);
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
          content: [{ type: 'input_text', text: modulePrompt }],
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
    return {
      result: JSON.parse(text),
      meta: {
        model: data.model || env.OPENAI_MODEL || 'gpt-4.1-mini',
        inputTokens: Number(data.usage?.input_tokens || data.usage?.prompt_tokens || 0),
        outputTokens: Number(data.usage?.output_tokens || data.usage?.completion_tokens || 0),
        systemPrompt: SHARED_SYSTEM_PROMPT,
        modulePrompt,
      },
    };
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

async function checkModelAccess(env, membership, moduleName, payload) {
  if (!membership) return { ok: false, status: 403, error: 'Registration required.' };
  if (membership.status !== 'active') return { ok: false, status: 403, error: 'This account is locked for the current class.' };
  if (membership.role !== 'admin') {
    if (membership.model_access_status !== 'active') return { ok: false, status: 403, error: 'Model access is paused for this class membership.' };
    if (membership.class_code_status === 'retired') return { ok: false, status: 403, error: 'Model access is paused because this class code has been retired.' };
    const projectedCost = estimatedCallCostMicros(env, moduleName);
    const used = Number(membership.usage_used_micros || 0);
    const limit = Number(membership.usage_limit_micros || usageLimitMicros(env));
    if (limit > 0 && used + projectedCost > limit) {
      return { ok: false, status: 402, error: 'Model budget reached for this class. Draft editing and saved reports remain available.' };
    }
  }
  const abuseReason = detectAssignmentAbuse(moduleName, payload);
  if (abuseReason) return { ok: false, abuse: true, reason: abuseReason };
  return { ok: true };
}

function detectAssignmentAbuse(moduleName, payload) {
  const text = JSON.stringify({ moduleName, payload }).toLowerCase();
  if (!text.trim()) return '';
  const freeChat = /(write|draft|compose).*(essay|poem|cover letter|email|code|python|javascript|sql|dating|resume)|homework unrelated|ignore previous|jailbreak|system prompt|act as|free model|chatgpt|solve this math|investment advice|medical advice|legal advice/.test(text);
  const unrelatedOrg = /(tesla|bitcoin|stock price|nba|movie script|restaurant|travel itinerary|recipe|calculus|leetcode|weather|celebrity)/.test(text);
  const mentionsAssignment = /bethany|house|nassau|staffing|executive assistant|ceo|board|resident|women|children|jericho|school district|decision|unknown|assumption|gatekeeper|consulting|stakeholder|problem statement/.test(text);
  if ((freeChat || unrelatedOrg) && !mentionsAssignment) return 'irrelevant_or_free_chat_use';
  return '';
}

async function logAbuse(env, membership, workspaceId, userId, moduleName, reason, payload) {
  await env.STUDIO_DB.prepare(
    `INSERT INTO abuse_events (id, class_membership_id, workspace_id, user_id, module, reason, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    membership?.id || null,
    workspaceId,
    userId,
    moduleName,
    reason,
    JSON.stringify(payload || {})
  ).run();
}

async function recordUsage(env, membership, workspaceId, llmRunId, moduleName, provider, inputTokens, outputTokens, estimatedCostMicros, status) {
  if (!membership || membership.role === 'admin') return;
  await env.STUDIO_DB.batch([
    env.STUDIO_DB.prepare(
      `INSERT INTO usage_ledger (
        id, class_membership_id, workspace_id, llm_run_id, module,
        input_tokens, output_tokens, estimated_cost_micros, provider, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      membership.id,
      workspaceId,
      llmRunId,
      moduleName,
      inputTokens,
      outputTokens,
      estimatedCostMicros,
      provider,
      status
    ),
    env.STUDIO_DB.prepare(
      `UPDATE class_memberships
       SET usage_used_micros = usage_used_micros + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).bind(estimatedCostMicros, membership.id),
  ]);
  membership.usage_used_micros = Number(membership.usage_used_micros || 0) + estimatedCostMicros;
}

async function getUsageSummary(env, membership) {
  if (!membership) return { used_micros: 0, limit_micros: usageLimitMicros(env), used_usd: 0, limit_usd: usageLimitMicros(env) / 1000000 };
  const fresh = await env.STUDIO_DB.prepare(
    `SELECT usage_used_micros, usage_limit_micros FROM class_memberships WHERE id = ?`
  ).bind(membership.id).first();
  const used = Number(fresh?.usage_used_micros ?? membership.usage_used_micros ?? 0);
  const limit = Number(fresh?.usage_limit_micros ?? membership.usage_limit_micros ?? usageLimitMicros(env));
  return {
    used_micros: used,
    limit_micros: limit,
    used_usd: used / 1000000,
    limit_usd: limit / 1000000,
    remaining_micros: Math.max(0, limit - used),
  };
}

function estimateCostMicros(env, inputTokens, outputTokens, provider) {
  if (provider !== 'openai') return 0;
  const inputUsdPerMillion = Number(env.MODEL_INPUT_USD_PER_MILLION_TOKENS || 0.4);
  const outputUsdPerMillion = Number(env.MODEL_OUTPUT_USD_PER_MILLION_TOKENS || 1.6);
  if (!inputTokens && !outputTokens) return estimatedCallCostMicros(env, '');
  return Math.ceil((inputTokens * inputUsdPerMillion) + (outputTokens * outputUsdPerMillion));
}

function estimatedCallCostMicros(env, moduleName) {
  const base = Number(env.ESTIMATED_CALL_COST_MICROS || 50000);
  return moduleName === 'final_report' ? Math.max(base, 100000) : base;
}

function reportReadinessError(state) {
  if (state.oneSentence?.status !== 'approved') return 'Approve the One Sentence before saving a report version.';
  if (!isMeaningfulField(state.oneSentence?.reframeText)) return 'The approved problem statement is blank.';
  const high = (state.items || []).filter((item) => item.valueTag === 'High' && item.bucket && item.bucket !== 'KK');
  if (!high.length) return 'Tag at least one KU, UK, or UU item High before saving a report version.';
  if (!high.some((item) => isReadyHighValueQuestion(item))) {
    return 'Complete Gatekeepers for at least one high-value question: who says yes, who can say no, and likely no.';
  }
  return '';
}

async function listReportVersions(env, userId) {
  const result = await env.STUDIO_DB.prepare(
    `SELECT id, workspace_id, user_id, class_id, version_number, title, pdf_r2_key, created_at
     FROM report_versions
     WHERE user_id = ?
     ORDER BY version_number DESC`
  ).bind(userId).all();
  return (result.results || []).map(sanitizeReportVersion);
}

function sanitizeReportVersion(version) {
  return {
    id: version.id,
    workspace_id: version.workspace_id,
    user_id: version.user_id,
    class_id: version.class_id,
    version_number: Number(version.version_number || 0),
    title: version.title || `Decision Engineering Report v${version.version_number || ''}`,
    pdf_url: `/api/studio/report/versions/${version.id}/pdf`,
    created_at: version.created_at,
  };
}

async function serveVersionPdf(request, env, version, filename) {
  const bytes = await readVersionPdfBytes(env, version);
  if (!bytes) return json({ error: 'PDF artifact not found.' }, 404, request);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    },
  });
}

async function readVersionPdfBytes(env, version) {
  if (env.STUDIO_ARTIFACTS && version.pdf_r2_key && !version.pdf_r2_key.startsWith('d1:')) {
    const object = await env.STUDIO_ARTIFACTS.get(version.pdf_r2_key);
    if (object) return new Uint8Array(await object.arrayBuffer());
  }

  const artifact = await env.STUDIO_DB.prepare(
    `SELECT content_base64 FROM report_artifacts WHERE report_version_id = ?`
  ).bind(version.id).first();
  if (!artifact?.content_base64) return null;
  return base64ToBytes(artifact.content_base64);
}

function defaultPdfFilename(suffix = new Date().toISOString().slice(0, 10)) {
  const cleanSuffix = cleanString(String(suffix || ''), 40).replace(/[^a-z0-9.-]+/gi, '-').replace(/^-|-$/g, '');
  return `decision-engineering-report-${cleanSuffix || 'draft'}.pdf`;
}

function reportLines(document) {
  const lines = [
    document.title || 'Decision Manifold Studio Final Report',
    document.subtitle || '',
    document.client ? `Client: ${document.client}` : '',
    document.preparedFor ? `Prepared for: ${document.preparedFor}` : '',
    '',
    'Refined Problem Statement',
    document.refinedProblemStatement || 'Draft not yet approved.',
    '',
    'Curated High-Value Questions',
  ];
  if (!document.highValueQuestions?.length) lines.push('No high-value questions ready.');
  (document.highValueQuestions || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question || ''}`);
    lines.push(`   Who says yes: ${item.whoMustSayYes || ''}`);
    lines.push(`   Veto: ${item.vetoHolder || ''}`);
    lines.push(`   Likely no: ${item.likelyToSayNo || ''}`);
  });
  lines.push('', 'Type Map');
  (document.typeMap || []).forEach((item) => {
    lines.push(`${item.bucket || '-'} | ${item.status || '-'} | ${item.valueTag || '-'} | ${item.holder || '-'} | ${item.sourceField || '-'} | ${item.item || ''}`);
  });
  lines.push('', 'Assumption Drill Summary');
  (document.drillSummary || []).forEach((item) => {
    lines.push(item.label || 'Assumption');
    lines.push(`Given: ${item.givenStatement || ''}`);
    lines.push(`Wrong if: ${item.wrongIf || ''}`);
    lines.push(`What changes: ${item.whatChanges || ''}`);
  });
  lines.push('', 'One Thing Left Open', document.oneThingLeftOpen || '', document.whyLeftOpen || '');
  if (document.guardrailNote) lines.push('', 'Guardrail Note', document.guardrailNote);
  return lines;
}

function buildPdfBytes(lines) {
  const wrapped = [];
  lines.forEach((line) => {
    wrapped.push(...wrapPdfLine(line || ' ', 92));
  });
  const pages = [];
  let current = [];
  wrapped.forEach((line) => {
    if (current.length >= 46) {
      pages.push(current);
      current = [];
    }
    current.push(line);
  });
  if (current.length || !pages.length) pages.push(current);

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  pages.forEach((pageLines) => {
    const stream = pdfPageStream(pageLines);
    const contentId = addObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function pdfPageStream(lines) {
  const commands = ['BT', '/F1 11 Tf', '72 742 Td', '14 TL'];
  lines.forEach((line, index) => {
    if (index > 0) commands.push('T*');
    commands.push(`(${escapePdf(line)}) Tj`);
  });
  commands.push('ET');
  return commands.join('\n');
}

function wrapPdfLine(line, width) {
  const words = String(line).replace(/\s+/g, ' ').trim().split(' ');
  const chunks = [];
  let current = '';
  words.forEach((word) => {
    if ((current + ' ' + word).trim().length > width) {
      if (current) chunks.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  });
  chunks.push(current || ' ');
  return chunks;
}

function escapePdf(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value || '');
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function listInstructorClasses(env) {
  const result = await env.STUDIO_DB.prepare(
    `SELECT c.id, c.slug, c.name, c.status, c.created_at,
      COUNT(CASE WHEN cm.role = 'student' THEN 1 END) AS student_count,
      COUNT(rv.id) AS report_count
     FROM classes c
     LEFT JOIN class_memberships cm ON cm.class_id = c.id
     LEFT JOIN report_versions rv ON rv.class_id = c.id AND rv.user_id = cm.user_id
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  ).all();
  return result.results || [];
}

async function listClassStudents(env, classId) {
  const result = await env.STUDIO_DB.prepare(
    `SELECT u.id, u.email, u.name, cm.id AS membership_id, cm.status, cm.model_access_status,
      cm.usage_used_micros, cm.usage_limit_micros, cm.created_at,
      w.id AS workspace_id, w.current_step, w.updated_at AS workspace_updated_at,
      COUNT(DISTINCT rv.id) AS report_count,
      MAX(rv.created_at) AS latest_report_at,
      MAX(lr.created_at) AS latest_llm_at
     FROM class_memberships cm
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN team_members tm ON tm.user_id = u.id
     LEFT JOIN workspaces w ON w.team_id = tm.team_id AND w.engagement_id = ?
     LEFT JOIN report_versions rv ON rv.user_id = u.id AND rv.class_id = cm.class_id
     LEFT JOIN llm_runs lr ON lr.user_id = u.id
     WHERE cm.class_id = ? AND cm.role = 'student'
     GROUP BY u.id, cm.id, w.id
     ORDER BY u.name COLLATE NOCASE`
  ).bind(ENGAGEMENT_ID, classId).all();
  return result.results || [];
}

async function getInstructorStudent(env, userId) {
  const user = await env.STUDIO_DB.prepare(`SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?`).bind(userId).first();
  if (!user) return { error: 'Student not found.' };
  const membership = await getPrimaryMembership(env, userId);
  const bundle = await loadWorkspaceBundle(env, userId, membership);
  return {
    user: publicUser(user),
    membership: publicMembership(membership),
    usage: await getUsageSummary(env, membership),
    ...bundle,
    versions: await listReportVersions(env, userId),
  };
}

async function getInstructorPrompts(env, userId) {
  const result = await env.STUDIO_DB.prepare(
    `SELECT id, workspace_id, module, request_json, response_json, provider, model,
      input_tokens, output_tokens, estimated_cost_micros, guardrail_status, created_at
     FROM llm_runs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 200`
  ).bind(userId).all();
  return result.results || [];
}

async function getInstructorVersions(env, userId) {
  const result = await env.STUDIO_DB.prepare(
    `SELECT id, workspace_id, user_id, class_id, version_number, title, report_json, report_text, pdf_r2_key, created_at
     FROM report_versions
     WHERE user_id = ?
     ORDER BY version_number DESC`
  ).bind(userId).all();
  return (result.results || []).map((version) => ({
    ...sanitizeReportVersion(version),
    report_json: version.report_json,
    report_text: version.report_text,
  }));
}

async function handleClassPdfZip(request, env, classId) {
  const result = await env.STUDIO_DB.prepare(
    `SELECT rv.*, u.email, u.name
     FROM report_versions rv
     JOIN users u ON u.id = rv.user_id
     WHERE rv.class_id = ?
     ORDER BY u.email, rv.version_number`
  ).bind(classId).all();
  const files = [];
  for (const version of result.results || []) {
    const bytes = await readVersionPdfBytes(env, version);
    if (!bytes) continue;
    const cleanEmailPart = cleanString(version.email || version.user_id, 120).replace(/[^a-z0-9@._-]+/gi, '-');
    files.push({
      name: `${cleanEmailPart}/v${version.version_number}-${version.id}.pdf`,
      bytes,
    });
  }
  const zipBytes = buildUncompressedZip(files);
  return new Response(zipBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="bethany-house-report-pdfs.zip"`,
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    },
  });
}

function buildUncompressedZip(files) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local, file.bytes);
    directory.push({ file, nameBytes, crc, offset });
    offset += local.length + file.bytes.length;
  }
  const directoryStart = offset;
  for (const entry of directory) {
    const central = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(central.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.file.bytes.length, true);
    view.setUint32(24, entry.file.bytes.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    central.set(entry.nameBytes, 46);
    chunks.push(central);
    offset += central.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, directory.length, true);
  endView.setUint16(10, directory.length, true);
  endView.setUint32(12, offset - directoryStart, true);
  endView.setUint32(16, directoryStart, true);
  chunks.push(end);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, cursor);
    cursor += chunk.length;
  });
  return out;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function expiredSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `studio_session=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
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

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
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

async function loadWorkspaceBundle(env, userId, membership = null) {
  const team = await getPrimaryTeam(env, userId);
  if (!team) {
    return { team: null, workspace: null, state: null, engagement: null, membership: publicMembership(membership), usage: await getUsageSummary(env, membership), versions: [] };
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

  return {
    team,
    workspace,
    state,
    engagement,
    membership: publicMembership(membership),
    usage: await getUsageSummary(env, membership),
    versions: await listReportVersions(env, userId),
  };
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

function isInstructorHost(host) {
  return host === 'instructor.platform.zetesislabs.com';
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
