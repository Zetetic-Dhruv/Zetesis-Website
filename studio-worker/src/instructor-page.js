export function renderInstructorPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Decision Engineering Instructor</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    :root {
      --bg: #fbfbf8;
      --ink: #111111;
      --muted: #555555;
      --hairline: #d7d7d7;
      --soft: #f6f6f2;
      --blue: #183e5a;
      --red: #8e2d2d;
      --green: #2f6f52;
      --mono: "SFMono-Regular", ui-monospace, Menlo, Monaco, "Courier New", monospace;
      --serif: "Times New Roman", Times, Georgia, serif;
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; border-radius: 0; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.45; }
    button, input, textarea, select { font: inherit; }
    button { border: 1px solid var(--blue); background: var(--blue); color: #fff; min-height: 34px; padding: 0.45rem 0.75rem; cursor: pointer; }
    button.secondary { background: #fff; color: var(--ink); border-color: var(--hairline); }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    input, textarea { width: 100%; border: 1px solid var(--hairline); background: #fff; color: var(--ink); padding: 0.55rem 0.65rem; min-height: 36px; }
    textarea { min-height: 180px; resize: vertical; font-family: var(--mono); font-size: 12px; }
    label { display: block; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 0.35rem; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--hairline); padding: 0.65rem; vertical-align: top; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); background: #fafafa; }
    .shell { max-width: 1360px; margin: 0 auto; padding: 1.25rem; }
    .topbar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; border-bottom: 1px solid var(--hairline); padding-bottom: 0.9rem; }
    .brand b { display: block; font-family: var(--serif); font-size: 27px; font-weight: 500; line-height: 1.1; }
    .meta, .status { color: var(--muted); font-size: 12.5px; }
    .auth { max-width: 720px; margin: 4rem auto; border: 1px solid var(--hairline); background: #fff; padding: 1.25rem; }
    .auth h1, .panel h1 { margin: 0 0 0.75rem; font-family: var(--serif); font-weight: 500; font-size: 34px; line-height: 1.1; }
    .layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 1rem; margin-top: 1rem; align-items: start; }
    .panel { border: 1px solid var(--hairline); background: #fff; padding: 1rem; min-width: 0; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    .card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; align-items: start; }
    .info-card { border: 1px solid var(--hairline); background: #fff; padding: 0.9rem; min-height: 156px; min-width: 0; }
    .info-card.wide { grid-column: 1 / -1; }
    .info-card h2 { margin: 0 0 0.5rem; font-size: 18px; line-height: 1.2; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center; margin-top: 1rem; }
    .student-card { width: 100%; display: block; text-align: left; border: 0; border-bottom: 1px solid var(--hairline); background: #fff; color: var(--ink); padding: 0.75rem; }
    .student-card.active { background: var(--blue); color: #fff; }
    .pill { display: inline-block; border: 1px solid var(--hairline); padding: 0.14rem 0.4rem; font-family: var(--mono); font-size: 11px; background: #fff; color: var(--ink); white-space: nowrap; }
    .pill.red { border-color: var(--red); color: var(--red); }
    .pill.green { border-color: var(--green); color: var(--green); }
    .tabs { display: inline-flex; border: 1px solid var(--hairline); margin: 0 0 1rem; }
    .tabs button { border: 0; border-right: 1px solid var(--hairline); background: #fff; color: var(--ink); min-height: 38px; }
    .tabs button:last-child { border-right: 0; }
    .tabs button.active { background: var(--blue); color: #fff; }
    .summary-list { margin: 0; padding-left: 1.1rem; }
    .summary-list li { margin: 0 0 0.35rem; }
    .metric { font-family: var(--serif); font-size: 28px; line-height: 1; margin: 0.2rem 0 0.35rem; }
    details { border-top: 1px solid var(--hairline); margin-top: 0.75rem; padding-top: 0.65rem; }
    summary { cursor: pointer; color: var(--blue); font-weight: 600; }
    .scroll { overflow-x: auto; width: 100%; max-width: 100%; min-width: 0; }
    .pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--mono); font-size: 12px; line-height: 1.45; background: var(--soft); border: 1px solid var(--hairline); padding: 0.75rem; max-height: 460px; overflow: auto; }
    @media (max-width: 900px) { .layout, .grid, .card-grid { grid-template-columns: 1fr; } .topbar { align-items: stretch; flex-direction: column; } .prompt-table { min-width: 900px; } .tabs { display: flex; } .tabs button { flex: 1; } }
  </style>
</head>
<body>
  <div id="app" class="shell">
    <div class="auth">
      <h1>Instructor Workroom</h1>
      <p class="meta">Loading.</p>
    </div>
  </div>

  <script>
    const app = document.getElementById('app');
    let boot = null;
    let classes = [];
    let students = [];
    let selectedClass = '';
    let selectedStudent = '';
    let studentDetail = null;
    let module2Detail = null;
    let workflow = 'module_1';
    let promptsByWorkflow = { module_1: null, module_2: null };
    let prompts = null;
    let promptsOpen = false;
    let promptDisclosurePending = false;
    let versionsByWorkflow = { module_1: [], module_2: [] };
    let versions = [];
    let cohortSummary = null;
    let statusText = '';

    init();

    async function init() {
      try {
        boot = await api('/api/instructor/me');
        await loadClasses();
      } catch (error) {
        renderAuth(error.message || '');
      }
    }

    async function api(path, options = {}) {
      const headers = new Headers(options.headers || {});
      headers.set('Content-Type', 'application/json');
      const response = await fetch(path, { ...options, headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'Request failed');
        error.status = response.status;
        throw error;
      }
      return data;
    }

    function renderAuth(message = '') {
      app.innerHTML = \`
        <div class="auth">
          <h1>Instructor Workroom</h1>
          <p class="meta">\${escapeHtml(message || 'Use the admin class code when creating the instructor account.')}</p>
          <div class="grid">
            <section>
              <h2>Log in</h2>
              <div class="field"><label>Email</label><input id="loginEmail" type="email" autocomplete="email" placeholder="name@example.com"></div>
              <div class="field"><label>Password</label><input id="loginPassword" type="password" autocomplete="current-password" placeholder="Password"></div>
              <div class="actions"><button id="loginBtn">Log in</button></div>
            </section>
            <section>
              <h2>Register</h2>
              <div class="field"><label>Name</label><input id="regName" autocomplete="name" placeholder="Dhruv Gupta"></div>
              <div class="field"><label>Email</label><input id="regEmail" type="email" autocomplete="email" placeholder="name@example.com"></div>
              <div class="field"><label>Password</label><input id="regPassword" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
              <div class="field"><label>Class code</label><input id="regClassCode" autocomplete="off" placeholder="Admin class code"></div>
              <div class="actions"><button id="registerBtn">Create account</button></div>
            </section>
          </div>
          <p class="status">\${escapeHtml(statusText)}</p>
        </div>
      \`;
    }

    async function loadClasses() {
      const data = await api('/api/instructor/classes');
      classes = data.classes || [];
      selectedClass = selectedClass || classes[0]?.id || '';
      if (selectedClass) {
        await loadStudents(selectedClass);
        await loadCohortSummary(selectedClass);
      }
      renderDashboard();
    }

    async function loadStudents(classId) {
      const data = await api('/api/instructor/classes/' + encodeURIComponent(classId) + '/students');
      students = data.students || [];
      selectedStudent = selectedStudent || students[0]?.id || '';
      if (selectedStudent) await loadStudent(selectedStudent);
    }

    async function loadStudent(userId) {
      const encoded = encodeURIComponent(userId);
      const loaded = await Promise.all([
        api('/api/instructor/students/' + encoded),
        api('/api/instructor/students/' + encoded + '/module-2'),
        api('/api/instructor/students/' + encoded + '/versions?workflow=module_1'),
        api('/api/instructor/students/' + encoded + '/versions?workflow=module_2'),
      ]);
      studentDetail = loaded[0];
      module2Detail = loaded[1];
      versionsByWorkflow = {
        module_1: loaded[2].versions || [],
        module_2: loaded[3].versions || [],
      };
      promptsByWorkflow = { module_1: null, module_2: null };
      prompts = null;
      versions = versionsByWorkflow[workflow];
      promptsOpen = false;
      promptDisclosurePending = false;
    }

    async function loadCohortSummary(classId) {
      cohortSummary = await api('/api/instructor/classes/' + encodeURIComponent(classId) + '/module-2/convergence');
    }

    function renderDashboard() {
      const currentClass = classes.find((item) => item.id === selectedClass);
      app.innerHTML = \`
        <div class="topbar">
          <div class="brand">
            <b>Instructor Workroom</b>
            <span class="meta">\${escapeHtml(boot?.user?.email || '')}</span>
          </div>
          <div class="actions" style="margin-top:0">
            <button class="secondary" id="downloadModule1ZipBtn" \${selectedClass ? '' : 'disabled'}>Question briefs ZIP</button>
            <button class="secondary" id="downloadModule2ZipBtn" \${selectedClass ? '' : 'disabled'}>Recommendation briefs ZIP</button>
            <button class="secondary" id="logoutBtn">Log out</button>
            <span class="status">\${escapeHtml(statusText)}</span>
          </div>
        </div>
        <div class="layout">
          <aside class="panel">
            <h1>Class</h1>
            <div class="field">
              <label>Assignment</label>
              <select id="classSelect">
                \${classes.map((item) => \`<option value="\${escapeAttr(item.id)}" \${item.id === selectedClass ? 'selected' : ''}>\${escapeHtml(item.name)}</option>\`).join('')}
              </select>
            </div>
            <p class="meta">\${escapeHtml(currentClass ? countLabel(currentClass.student_count, 'student') + ' · ' + countLabel(currentClass.report_count, 'question brief') + ' · ' + countLabel(currentClass.module2_version_count, 'recommendation brief') : '')}</p>
            <div>
              \${students.map((student) => \`
                <button class="student-card \${student.id === selectedStudent ? 'active' : ''}" data-student="\${escapeAttr(student.id)}">
                  <strong>\${escapeHtml(student.name || student.email)}</strong><br>
                  <span class="meta">\${escapeHtml(student.email)} · \${money(student.usage_used_micros)} / \${money(student.usage_limit_micros)}</span><br>
                  <span class="pill \${student.model_access_status === 'active' ? 'green' : 'red'}">\${escapeHtml(student.model_access_status)}</span>
                  <span class="pill">M1 \${escapeHtml(student.current_step || 'intake')} · \${escapeHtml(String(student.report_count || 0))}</span>
                  <span class="pill">M2 \${escapeHtml(student.module2_current_step || 'not started')} · \${escapeHtml(String(student.module2_version_count || 0))}</span>
                </button>
              \`).join('')}
            </div>
            \${renderCohortSummary()}
          </aside>
          <main class="panel">
            \${renderStudentDetail()}
          </main>
        </div>
      \`;
    }

    function renderStudentDetail() {
      if (!studentDetail?.user) return '<h1>Student</h1><p class="meta">Select a student.</p>';
      const usage = studentDetail.usage || {};
      const currentState = workflow === 'module_2' ? module2Detail?.state || {} : studentDetail.state || {};
      return \`
        <h1>\${escapeHtml(studentDetail.user.name || studentDetail.user.email)}</h1>
        <p class="meta">\${escapeHtml(studentDetail.user.email)} · \${money(usage.used_micros)} / \${money(usage.limit_micros)} used</p>
        <div class="actions" style="margin-bottom:1rem">
          <button class="secondary" id="resetUsageBtn">Reset usage</button>
          <button class="secondary" id="toggleAccessBtn">\${studentDetail.membership?.model_access_status === 'active' ? 'Block model access' : 'Restore model access'}</button>
        </div>
        <div class="tabs" aria-label="Student workflow">
          <button data-workflow="module_1" class="\${workflow === 'module_1' ? 'active' : ''}">Module 1 · Questions</button>
          <button data-workflow="module_2" class="\${workflow === 'module_2' ? 'active' : ''}">Module 2 · Recommendation</button>
        </div>
        <div class="card-grid">
          \${workflow === 'module_2' ? renderModule2SummaryCards() : renderModule1SummaryCards()}
          <section class="info-card">
            <h2>Current draft</h2>
            <p class="meta">Complete mutable state for the selected student and module.</p>
            <details><summary>Open raw draft</summary><div class="pre">\${escapeHtml(JSON.stringify(currentState, null, 2))}</div></details>
          </section>
          <section class="info-card">
            <h2>Saved versions</h2>
            \${versions.length ? \`
              <div class="scroll">
                <table>
                  <thead><tr><th>Version</th><th>Created</th><th>PDF</th></tr></thead>
                  <tbody>\${versions.map((version) => \`
                    <tr>
                      <td>v\${escapeHtml(version.version_number)}</td>
                      <td>\${escapeHtml(version.created_at || '')}</td>
                      <td><a href="\${escapeAttr(versionPdfUrl(version))}" target="_blank" rel="noopener">Download</a></td>
                    </tr>
                    <tr><td colspan="3"><details><summary>View saved content</summary><div class="pre">\${escapeHtml(version.document_text || version.report_text || '')}</div></details></td></tr>
                  \`).join('')}</tbody>
                </table>
              </div>
            \` : '<p class="meta">No saved versions yet.</p>'}
          </section>
          \${renderPromptsCard()}
        </div>
      \`;
    }

    function renderModule1SummaryCards() {
      const state = studentDetail.state || {};
      const workingRead = state.oneSentence?.reframeText || state.oneSentence?.briefText || 'No working read yet.';
      return \`
        <section class="info-card">
          <h2>Module 1 progress</h2>
          <p class="metric">\${escapeHtml(studentDetail.workspace?.current_step || 'intake')}</p>
          <p class="meta">\${escapeHtml(String(versionsByWorkflow.module_1.length))} saved question brief versions</p>
        </section>
        <section class="info-card">
          <h2>Working read</h2>
          <p>\${escapeHtml(workingRead)}</p>
        </section>
      \`;
    }

    function renderModule2SummaryCards() {
      const state = module2Detail?.state || {};
      const inheritance = state.inheritance || {};
      const byId = new Map((state.bets || []).map((bet) => [bet.id, bet]));
      const selected = byId.get(state.locks?.selectedBetId);
      const ranking = (state.ranking?.orderedBetIds || []).map((id, index) => {
        const bet = byId.get(id);
        return bet ? \`<li><strong>\${index + 1}. \${escapeHtml(bet.name)}</strong><br><span class="meta">\${escapeHtml(state.ranking?.pairwiseLines?.[index] || bet.description || '')}</span></li>\` : '';
      }).join('');
      return \`
        <section class="info-card">
          <h2>Module 2 progress</h2>
          <p class="metric">\${escapeHtml(module2Detail?.workspace?.current_step || 'not started')}</p>
          <p class="meta">\${escapeHtml(String(versionsByWorkflow.module_2.length))} saved recommendation versions</p>
        </section>
        <section class="info-card">
          <h2>Inherited source</h2>
          <p><span class="pill">\${escapeHtml(inheritance.sourceType || 'absent')}</span></p>
          <p>\${escapeHtml(inheritance.frame || 'No inherited frame.')}</p>
          <details><summary>View inherited traces</summary><div class="pre">\${escapeHtml(prettyObject(inheritance.highValueTraces || []))}</div></details>
        </section>
        <section class="info-card">
          <h2>Locked choice</h2>
          <p><strong>\${escapeHtml(selected?.name || 'No bet selected.')}</strong></p>
          <p class="meta">Loss bearer: \${escapeHtml(state.locks?.lossBearer || 'not set')}</p>
          <p class="meta">Accountability: \${escapeHtml(state.locks?.accountabilityLocation || 'not set')}</p>
          <p class="meta">Reversibility: \${escapeHtml(state.locks?.reversibility || 'not set')}</p>
          \${state.locks?.convictionNote ? \`<p class="meta">Reason for overriding the weighted leader: \${escapeHtml(state.locks.convictionNote)}</p>\` : ''}
        </section>
        <section class="info-card wide">
          <h2>Current ranking</h2>
          \${ranking ? \`<ol class="summary-list">\${ranking}</ol>\` : '<p class="meta">No evaluated comparison field yet.</p>'}
        </section>
        <section class="info-card wide">
          <h2>Current recommendation brief</h2>
          \${renderPackagePreview(state.package?.currentPreview)}
        </section>
      \`;
    }

    function renderCohortSummary() {
      if (!cohortSummary) return '';
      const bets = cohortSummary.selectedBets || [];
      return \`
        <section style="border-top:1px solid var(--hairline);margin-top:1rem;padding-top:0.8rem">
          <h2 style="font-size:17px">Module 2 cohort</h2>
          <p class="meta">\${escapeHtml(cohortSummary.totalStudents)} total students · \${escapeHtml(cohortSummary.startedStudents)} started · \${escapeHtml(cohortSummary.lockedStudents)} locked · \${escapeHtml(cohortSummary.studentsWithSavedVersions)} saved</p>
          \${bets.length ? \`<ul class="summary-list">\${bets.map((bet) => \`<li>\${escapeHtml(bet.name)} <span class="pill">\${escapeHtml(bet.count)}</span></li>\`).join('')}</ul>\` : '<p class="meta">No locked recommendations yet.</p>'}
        </section>
      \`;
    }

    function renderPackagePreview(document) {
      if (!document) return '<p class="meta">No current recommendation brief generated.</p>';
      return \`
        <p><strong>\${escapeHtml(document.recommendation?.name || document.title || 'Current recommendation')}</strong></p>
        <p>\${escapeHtml(document.currentPositionStatement || document.recommendation?.summary || '')}</p>
        <details><summary>Open complete brief JSON</summary><div class="pre">\${escapeHtml(prettyObject(document))}</div></details>
      \`;
    }

    function versionPdfUrl(version) {
      return workflow === 'module_2'
        ? version.pdf_url || '/api/instructor/deliverable/versions/' + encodeURIComponent(version.id) + '/pdf'
        : '/api/instructor/report/versions/' + encodeURIComponent(version.id) + '/pdf';
    }

    function renderPromptsCard() {
      const countText = prompts ? String(prompts.length) + ' prompt records loaded' : 'Prompt history stays closed until opened.';
      if (!promptsOpen) {
        if (promptDisclosurePending) {
          return \`
            <section class="info-card wide">
              <h2>Prompts</h2>
              <p>These records contain the selected student's complete inputs, model outputs, and Zetesis system instructions for \${workflow === 'module_2' ? 'Module 2' : 'Module 1'}.</p>
              <p class="meta">Access is limited to instructors in this class. Each run stays closed until you choose it.</p>
              <div class="actions">
                <button id="confirmPromptAccessBtn">Continue to prompt records</button>
                <button class="secondary" id="cancelPromptAccessBtn">Cancel</button>
              </div>
            </section>
          \`;
        }
        return \`
          <section class="info-card">
            <h2>Prompts</h2>
            <p class="meta">\${escapeHtml(countText)}</p>
            <div class="actions"><button class="secondary" id="requestPromptAccessBtn">Review prompt history</button></div>
          </section>
        \`;
      }

      return \`
        <section class="info-card wide">
          <h2>Prompts</h2>
          <p class="meta">\${escapeHtml(countText)}</p>
          <div class="actions"><button class="secondary" id="togglePromptsBtn">Close prompt history</button></div>
          \${prompts && prompts.length ? \`
            <div style="margin-top:0.75rem">
              \${prompts.map((prompt) => \`
                <details class="prompt-run">
                  <summary>\${escapeHtml(prompt.created_at || '')} · \${escapeHtml(prompt.module || '')} · \${escapeHtml(prompt.model || prompt.provider || '')}</summary>
                  <p class="meta">\${escapeHtml(prompt.provider || '')} · \${money(prompt.estimated_cost_micros)} · \${escapeHtml(prompt.input_tokens || 0)}/\${escapeHtml(prompt.output_tokens || 0)} tokens · \${escapeHtml(prompt.guardrail_status || '')}</p>
                  <div class="grid">
                    <section><h3>System / kernel prompt</h3><div class="pre">\${escapeHtml(prompt.system_prompt || '')}</div></section>
                    <section><h3>Module prompt</h3><div class="pre">\${escapeHtml(prompt.module_prompt || '')}</div></section>
                    <section><h3>Request / context</h3><div class="pre">\${escapeHtml(prettyJson(prompt.request_json))}</div></section>
                    <section><h3>Model output</h3><div class="pre">\${escapeHtml(prettyJson(prompt.response_json))}</div></section>
                  </div>
                </details>
              \`).join('')}
            </div>
          \` : '<p class="meta">No prompt records yet.</p>'}
        </section>
      \`;
    }

    document.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      try {
        if (button.id === 'loginBtn') {
          boot = await api('/api/instructor/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              email: document.getElementById('loginEmail').value,
              password: document.getElementById('loginPassword').value,
            }),
          });
          await loadClasses();
        }
        if (button.id === 'registerBtn') {
          boot = await api('/api/instructor/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              name: document.getElementById('regName').value,
              email: document.getElementById('regEmail').value,
              password: document.getElementById('regPassword').value,
              classCode: document.getElementById('regClassCode').value,
            }),
          });
          await loadClasses();
        }
        if (button.id === 'logoutBtn') {
          await api('/api/instructor/auth/logout', { method: 'POST', body: '{}' });
          location.reload();
        }
        if (button.dataset.student) {
          selectedStudent = button.dataset.student;
          await loadStudent(selectedStudent);
          renderDashboard();
        }
        if (button.dataset.workflow && ['module_1', 'module_2'].includes(button.dataset.workflow)) {
          workflow = button.dataset.workflow;
          versions = versionsByWorkflow[workflow] || [];
          prompts = promptsByWorkflow[workflow];
          promptsOpen = false;
          promptDisclosurePending = false;
          renderDashboard();
        }
        if (button.id === 'requestPromptAccessBtn' && selectedStudent) {
          promptDisclosurePending = true;
          renderDashboard();
        }
        if (button.id === 'cancelPromptAccessBtn') {
          promptDisclosurePending = false;
          renderDashboard();
        }
        if (button.id === 'confirmPromptAccessBtn' && selectedStudent) {
          promptDisclosurePending = false;
          promptsOpen = true;
          if (!prompts) {
            prompts = (await api('/api/instructor/students/' + encodeURIComponent(selectedStudent) + '/prompts?workflow=' + encodeURIComponent(workflow))).prompts || [];
            promptsByWorkflow[workflow] = prompts;
          }
          renderDashboard();
        }
        if (button.id === 'togglePromptsBtn' && selectedStudent) {
          promptsOpen = false;
          promptDisclosurePending = false;
          renderDashboard();
        }
        if (button.id === 'resetUsageBtn' && selectedStudent) {
          await api('/api/instructor/students/' + encodeURIComponent(selectedStudent) + '/reset-usage', { method: 'POST', body: '{}' });
          await loadStudents(selectedClass);
          statusText = 'Usage reset.';
          renderDashboard();
        }
        if (button.id === 'toggleAccessBtn' && selectedStudent) {
          const next = studentDetail.membership?.model_access_status === 'active' ? 'blocked' : 'active';
          await api('/api/instructor/students/' + encodeURIComponent(selectedStudent) + '/model-access', { method: 'POST', body: JSON.stringify({ status: next }) });
          await loadStudents(selectedClass);
          statusText = 'Model access updated.';
          renderDashboard();
        }
        if (button.id === 'downloadModule1ZipBtn' && selectedClass) {
          location.href = '/api/instructor/classes/' + encodeURIComponent(selectedClass) + '/pdf-zip?workflow=module_1';
        }
        if (button.id === 'downloadModule2ZipBtn' && selectedClass) {
          location.href = '/api/instructor/classes/' + encodeURIComponent(selectedClass) + '/pdf-zip?workflow=module_2';
        }
      } catch (error) {
        statusText = error.message;
        if (boot) renderDashboard();
        else renderAuth(statusText);
      }
    });

    document.addEventListener('change', async (event) => {
      if (event.target.id === 'classSelect') {
        selectedClass = event.target.value;
        selectedStudent = '';
        await loadStudents(selectedClass);
        await loadCohortSummary(selectedClass);
        renderDashboard();
      }
    });

    function money(micros) {
      return '$' + (Number(micros || 0) / 1000000).toFixed(2);
    }

    function countLabel(value, noun) {
      const count = Number(value || 0);
      return String(count) + ' ' + noun + (count === 1 ? '' : 's');
    }

    function prettyJson(value) {
      try {
        return JSON.stringify(JSON.parse(value || '{}'), null, 2);
      } catch (_) {
        return value || '';
      }
    }

    function prettyObject(value) {
      try {
        return JSON.stringify(value ?? {}, null, 2);
      } catch (_) {
        return String(value ?? '');
      }
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }
  </script>
</body>
</html>`;
}
