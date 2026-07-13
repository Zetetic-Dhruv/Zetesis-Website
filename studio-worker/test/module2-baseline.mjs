import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildModule1InheritanceSnapshot,
  combineGroundSolutions,
  normalizeModule2State,
  parseStoredModule2State,
} from '../src/module2-state.js';
import {
  INSTRUCTOR_PROMPTS_SQL,
  LIST_CLASS_STUDENTS_SQL,
  isActiveAdminMembership,
} from '../src/instructor-queries.js';

const root = new URL('..', import.meta.url);
const source = readFileSync(new URL('../src/studio.js', import.meta.url), 'utf8');
const contract = JSON.parse(readFileSync(new URL('./fixtures/module1-inheritance-contract.json', import.meta.url), 'utf8'));
const migration = new URL('../migrations/0004_module2.sql', import.meta.url).pathname;
const classWorkspaceMigration = new URL('../migrations/0005_class_workspaces.sql', import.meta.url).pathname;
const productionExport = process.env.MODULE2_PRODUCTION_EXPORT || '';

assert(contract.cases.length === 3, 'inheritance contract freezes full, partial, and absent cases');
for (const testCase of contract.cases) {
  const inherited = buildModule1InheritanceSnapshot(testCase.state, {
    sourceType: testCase.sourceType,
    sourceVersionId: testCase.sourceVersionId,
    snapshotAt: '2026-07-14T00:00:00.000Z',
  });
  assert(inherited.entryState === testCase.expected.entryState, `${testCase.id} entry state`);
  assert(inherited.frame === testCase.expected.frame, `${testCase.id} frame`);
  assert(JSON.stringify(inherited.highValueTraces.map((item) => item.id)) === JSON.stringify(testCase.expected.traceIds), `${testCase.id} trace selection`);
  assert(inherited.inheritedSolutions.length === testCase.expected.solutionCount, `${testCase.id} does not invent solutions`);
}
const malformed = normalizeModule2State({ ground: null, inheritance: 'bad', locks: 3 });
assert(malformed.ground.relevance.status === 'unresolved', 'normalizer rejects malformed ground object');
assert(malformed.inheritance.entryState === 'fresh', 'normalizer rejects malformed inheritance object');
assert(Array.isArray(malformed.locks.heldConstant), 'normalizer rejects malformed locks object');
assertThrows(
  () => parseStoredModule2State('{not-json'),
  'persisted malformed state is rejected instead of rebuilding inheritance'
);
const mergedSolutions = combineGroundSolutions({
  inheritedSolutions: [{ id: 'inherited-a', name: 'Preserve partner continuity' }],
  incomingSolutions: [
    { id: 'duplicate-a', name: 'Preserve partner continuity' },
    { id: 'student-b', name: 'Add a shared operations role' },
  ],
  choice: 'merge',
});
assert(mergedSolutions.length === 2, 'merge keeps inherited and new solutions without exact duplicates');
assert(
  combineGroundSolutions({
    incomingSolutions: [
      { id: 'case-a', name: 'Preserve partner continuity' },
      { id: 'case-b', name: 'Preserve Partner Continuity.' },
    ],
  }).length === 2,
  'punctuation and case variants remain live for near-duplicate review'
);
const updatedIdentity = combineGroundSolutions({
  inheritedSolutions: [{ id: 'same-id', name: 'Original wording' }],
  incomingSolutions: [{ id: 'same-id', name: 'Student update' }],
});
assert(
  updatedIdentity.length === 1 && updatedIdentity[0].name === 'Student update',
  'a repeated explicit ID updates one stable solution identity'
);
const identityIntoDuplicate = combineGroundSolutions({
  inheritedSolutions: [
    { id: 'option-a', name: 'Alpha' },
    { id: 'option-b', name: 'Beta' },
  ],
  incomingSolutions: [{ id: 'option-a', name: 'Beta' }],
});
assert(
  identityIntoDuplicate.length === 1 && identityIntoDuplicate[0].id === 'option-a',
  'an explicit-ID update into existing content collapses the other exact duplicate'
);
assert(
  combineGroundSolutions({
    inheritedSolutions: mergedSolutions,
    incomingSolutions: [{ id: 'replacement', name: 'Use an external service' }],
    choice: 'replace',
  }).map((item) => item.id).join(',') === 'replacement',
  'replace deliberately removes inherited solutions from the Module 2 set'
);
assert(
  combineGroundSolutions({
    inheritedSolutions: mergedSolutions,
    incomingSolutions: [{ id: 'student-c', name: 'Sequence the work' }],
    choice: 'pick',
    pickedIds: ['student-c'],
  }).map((item) => item.id).join(',') === 'student-c',
  'pick retains only explicitly selected solutions'
);
assert(isActiveAdminMembership({
  role: 'admin',
  status: 'active',
  class_status: 'active',
  class_code_status: 'active',
}), 'active admin membership is authorized');
for (const field of ['status', 'class_status', 'class_code_status']) {
  assert(!isActiveAdminMembership({
    role: 'admin',
    status: 'active',
    class_status: 'active',
    class_code_status: 'active',
    [field]: 'inactive',
  }), `inactive admin ${field} is rejected`);
}
testClassScopedActivityQuery();

for (const route of [
  '/api/studio/me',
  '/api/studio/workspace',
  '/api/studio/llm',
  '/api/studio/report/preview',
  '/api/studio/report/save-version',
  '/api/studio/report/versions',
]) {
  assert(source.includes(route), `Module 1 route remains present: ${route}`);
}
assert(source.includes("const SESSION_COOKIE = 'studio_session'"), 'session cookie contract remains studio_session');
assert(source.includes("const CLASS_ID = 'class_bethany_house_2026'"), 'v1 has one fixed Bethany House student class');
assert(source.includes("const STUDENT_CODE_ID = 'code_bethany_house_student_2026'"), 'v1 has one fixed student class code');

if (productionExport) rehearseMigration(productionExport, [migration, classWorkspaceMigration]);
else console.log('skip - production migration rehearsal requires MODULE2_PRODUCTION_EXPORT');

function rehearseMigration(sqlExport, migrationFiles) {
  const dir = mkdtempSync(join(tmpdir(), 'module2-migration-'));
  const db = join(dir, 'production-copy.db');
  try {
    execFileSync('sqlite3', [db], { input: readFileSync(sqlExport) });
    const before = snapshot(db);
    for (const migrationFile of migrationFiles) {
      execFileSync('sqlite3', [db], { input: readFileSync(migrationFile) });
    }
    const after = snapshot(db);
    assert(before.users === after.users, 'migration preserves users');
    assert(before.workspaces === after.workspaces, 'migration preserves workspaces');
    assert(before.workspaceStates === after.workspaceStates, 'migration preserves Module 1 states');
    assert(before.reportVersions === after.reportVersions, 'migration preserves Module 1 report versions');
    assert(after.newTables === '4', 'migration creates Module 2 tables and class-workspace ownership');
    assert(after.workflowColumn === '1', 'migration adds llm_runs.workflow_key');
    assert(after.legacyWorkflowRows === after.llmRuns, 'existing LLM runs default to module_1');
    console.log('ok - additive migration rehearsed against frozen production export');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function testClassScopedActivityQuery() {
  const dir = mkdtempSync(join(tmpdir(), 'module2-class-scope-'));
  const db = join(dir, 'scope.db');
  try {
    const schema = `
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT);
      CREATE TABLE class_memberships (
        id TEXT PRIMARY KEY, class_id TEXT, user_id TEXT, role TEXT, status TEXT,
        model_access_status TEXT, usage_used_micros INTEGER, usage_limit_micros INTEGER, created_at TEXT
      );
      CREATE TABLE team_members (team_id TEXT, user_id TEXT);
      CREATE TABLE class_workspaces (class_id TEXT, user_id TEXT, workspace_id TEXT);
      CREATE TABLE workspaces (id TEXT, team_id TEXT, engagement_id TEXT, current_step TEXT, updated_at TEXT);
      CREATE TABLE report_versions (id TEXT, user_id TEXT, class_id TEXT, created_at TEXT);
      CREATE TABLE llm_runs (
        id TEXT, workspace_id TEXT, module TEXT, workflow_key TEXT, system_prompt TEXT,
        module_prompt TEXT, request_json TEXT, response_json TEXT, provider TEXT, model TEXT,
        input_tokens INTEGER, output_tokens INTEGER, estimated_cost_micros INTEGER,
        guardrail_status TEXT, created_at TEXT, user_id TEXT, class_membership_id TEXT
      );
      INSERT INTO users VALUES ('user-1', 'student@example.com', 'Student');
      INSERT INTO class_memberships VALUES
        ('membership-a', 'class-a', 'user-1', 'student', 'active', 'active', 0, 10000000, '2026-01-01'),
        ('membership-b', 'class-b', 'user-1', 'student', 'active', 'active', 0, 10000000, '2026-01-01');
      INSERT INTO workspaces VALUES
        ('workspace-a', 'team-a', 'engagement-a', 'ground', '2026-01-01'),
        ('workspace-b', 'team-b', 'engagement-a', 'lock', '2026-02-01');
      INSERT INTO class_workspaces VALUES
        ('class-a', 'user-1', 'workspace-a'),
        ('class-b', 'user-1', 'workspace-b');
      INSERT INTO llm_runs (
        id, module, workflow_key, created_at, user_id, class_membership_id
      ) VALUES
        ('run-a', 'parse', 'module_1', '2026-01-02', 'user-1', 'membership-a'),
        ('run-b', 'parse', 'module_1', '2026-02-02', 'user-1', 'membership-b'),
        ('run-legacy', 'parse', 'module_1', '2026-03-02', 'user-1', NULL);
    `;
    execFileSync('sqlite3', [db], { input: schema });
    const sql = LIST_CLASS_STUDENTS_SQL
      .replace('?', "'engagement-a'")
      .replace('?', "'class-a'");
    const rows = JSON.parse(execFileSync('sqlite3', ['-json', db, sql], { encoding: 'utf8' }) || '[]');
    assert(rows.length === 1, 'class student query returns the selected membership once');
    assert(rows[0].workspace_id === 'workspace-a', 'class student query resolves the selected class workspace');
    assert(rows[0].latest_llm_at === '2026-01-02', 'class student activity excludes another class and ambiguous legacy runs');
    const promptSql = bindSql(INSTRUCTOR_PROMPTS_SQL, [
      'user-1', 'module_1', 'user-1', 'class-a', 'user-1', 'class-a',
    ]);
    const prompts = JSON.parse(execFileSync('sqlite3', ['-json', db, promptSql], { encoding: 'utf8' }) || '[]');
    assert(prompts.length === 1 && prompts[0].id === 'run-a', 'prompt query excludes another class and ambiguous legacy runs');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function bindSql(sql, values) {
  let bound = sql;
  for (const value of values) {
    bound = bound.replace('?', `'${String(value).replaceAll("'", "''")}'`);
  }
  return bound;
}

function snapshot(db) {
  const scalar = (sql) => execFileSync('sqlite3', [db, sql], { encoding: 'utf8' }).trim();
  const workflowColumn = scalar("SELECT COUNT(*) FROM pragma_table_info('llm_runs') WHERE name='workflow_key';");
  return {
    users: scalar('SELECT COUNT(*) FROM users;'),
    workspaces: scalar('SELECT COUNT(*) FROM workspaces;'),
    workspaceStates: scalar('SELECT COUNT(*) FROM workspace_states;'),
    reportVersions: scalar('SELECT COUNT(*) FROM report_versions;'),
    llmRuns: scalar('SELECT COUNT(*) FROM llm_runs;'),
    newTables: scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('workspace_module_states','deliverable_versions','deliverable_artifacts','class_workspaces');"),
    workflowColumn,
    legacyWorkflowRows: workflowColumn === '1'
      ? scalar("SELECT COUNT(*) FROM llm_runs WHERE workflow_key='module_1';")
      : '',
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`ok - ${message}`);
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch (_) {
    threw = true;
  }
  assert(threw, message);
}
