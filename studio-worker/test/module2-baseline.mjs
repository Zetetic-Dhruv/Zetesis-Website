import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const source = readFileSync(new URL('../src/studio.js', import.meta.url), 'utf8');
const contract = JSON.parse(readFileSync(new URL('./fixtures/module1-inheritance-contract.json', import.meta.url), 'utf8'));
const migration = new URL('../migrations/0004_module2.sql', import.meta.url).pathname;
const productionExport = process.env.MODULE2_PRODUCTION_EXPORT || '';

assert(contract.cases.length === 3, 'inheritance contract freezes full, partial, and absent cases');
for (const testCase of contract.cases) {
  const inherited = inherit(testCase.state, testCase.sourceType, testCase.sourceVersionId);
  assert(inherited.entryState === testCase.expected.entryState, `${testCase.id} entry state`);
  assert(inherited.frame === testCase.expected.frame, `${testCase.id} frame`);
  assert(JSON.stringify(inherited.highValueTraces.map((item) => item.id)) === JSON.stringify(testCase.expected.traceIds), `${testCase.id} trace selection`);
  assert(inherited.solutions.length === testCase.expected.solutionCount, `${testCase.id} does not invent solutions`);
}

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

if (productionExport) rehearseMigration(productionExport, migration);
else console.log('skip - production migration rehearsal requires MODULE2_PRODUCTION_EXPORT');

function inherit(state, sourceType, sourceVersionId) {
  const frame = String(state?.oneSentence?.reframeText || '').trim();
  const highValueTraces = (state?.items || []).filter((item) => (
    item
    && item.bucket !== 'KK'
    && (item.selectedForBrief === true || item.valueTag === 'High')
    && String(item.rawText || item.text || item.reengineeredQuestion || '').trim()
  )).map((item) => ({
    id: item.id,
    text: item.reengineeredQuestion || item.rawText || item.text || '',
    sourceType: item.sourceType || 'student_trace',
    evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : [],
  }));
  const entryState = frame && highValueTraces.length ? 'full' : frame || highValueTraces.length ? 'partial' : 'fresh';
  return { sourceType, sourceVersionId, frame, highValueTraces, solutions: [], entryState };
}

function rehearseMigration(sqlExport, migrationFile) {
  const dir = mkdtempSync(join(tmpdir(), 'module2-migration-'));
  const db = join(dir, 'production-copy.db');
  try {
    execFileSync('sqlite3', [db], { input: readFileSync(sqlExport) });
    const before = snapshot(db);
    execFileSync('sqlite3', [db], { input: readFileSync(migrationFile) });
    const after = snapshot(db);
    assert(before.users === after.users, 'migration preserves users');
    assert(before.workspaces === after.workspaces, 'migration preserves workspaces');
    assert(before.workspaceStates === after.workspaceStates, 'migration preserves Module 1 states');
    assert(before.reportVersions === after.reportVersions, 'migration preserves Module 1 report versions');
    assert(after.newTables === '3', 'migration creates three Module 2 tables');
    assert(after.workflowColumn === '1', 'migration adds llm_runs.workflow_key');
    assert(after.legacyWorkflowRows === after.llmRuns, 'existing LLM runs default to module_1');
    console.log('ok - additive migration rehearsed against frozen production export');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
    newTables: scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('workspace_module_states','deliverable_versions','deliverable_artifacts');"),
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
