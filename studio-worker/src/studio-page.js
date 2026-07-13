export function renderStudioPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Decision Manifold Studio · Zetesis Labs</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    :root {
      --bg: #fbfbf8;
      --ink: #111111;
      --muted: #555555;
      --hairline: #d7d7d7;
      --soft: #f6f6f2;
      --blue: #183e5a;
      --gold: #9b6b22;
      --red: #8e2d2d;
      --green: #2f6f52;
      --mono: "SFMono-Regular", ui-monospace, Menlo, Monaco, "Courier New", monospace;
      --serif: "Times New Roman", Times, Georgia, serif;
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
      border-radius: 0;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 15px;
      line-height: 1.45;
    }

    button,
    input,
    textarea,
    select {
      font: inherit;
    }

    button {
      border: 1px solid var(--blue);
      background: var(--blue);
      color: #fff;
      min-height: 34px;
      padding: 0.45rem 0.75rem;
      cursor: pointer;
    }

    button.secondary {
      background: #fff;
      color: var(--ink);
      border-color: var(--hairline);
    }

    button.ghost {
      background: transparent;
      color: var(--ink);
      border-color: transparent;
      text-decoration: underline;
      padding-left: 0;
      padding-right: 0;
    }

    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    input,
    textarea,
    select {
      width: 100%;
      border: 1px solid var(--hairline);
      background: #fff;
      color: var(--ink);
      padding: 0.55rem 0.65rem;
      min-height: 36px;
    }

    textarea {
      resize: vertical;
      min-height: 110px;
      line-height: 1.45;
    }

    label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0 0 0.35rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      border-bottom: 1px solid var(--hairline);
      padding: 0.65rem;
      vertical-align: top;
      text-align: left;
    }

    th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }

    .shell {
      max-width: 1320px;
      margin: 0 auto;
      padding: 1.25rem;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--hairline);
      padding-bottom: 0.9rem;
      gap: 1rem;
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .brand b {
      font-family: var(--serif);
      font-size: 23px;
      font-weight: 500;
      line-height: 1.1;
    }

    .brand span,
    .meta {
      color: var(--muted);
      font-size: 12.5px;
    }

    .module-switch {
      display: flex;
      gap: 0.2rem;
      border: 1px solid var(--hairline);
      background: #fff;
      padding: 0.2rem;
    }

    .module-switch a {
      padding: 0.38rem 0.65rem;
      text-decoration: none;
      font-size: 13px;
      color: var(--ink);
    }

    .module-switch a.active {
      background: var(--ink);
      color: #fff;
    }

    .layout {
      display: grid;
      grid-template-columns: 235px minmax(0, 1fr);
      gap: 1.25rem;
      margin-top: 1.25rem;
      align-items: start;
    }

    .sidebar {
      border: 1px solid var(--hairline);
      position: sticky;
      top: 1rem;
      background: #fff;
    }

    .step-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      background: #fff;
      color: var(--ink);
      border: 0;
      border-bottom: 1px solid var(--hairline);
      text-align: left;
      padding: 0.78rem 0.85rem;
    }

    .step-btn.active {
      background: var(--blue);
      color: #fff;
    }

    .step-num {
      font-family: var(--mono);
      font-size: 11px;
      color: inherit;
      opacity: 0.75;
    }

    .panel {
      border: 1px solid var(--hairline);
      background: #fff;
    }

    .panel-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid var(--hairline);
      padding: 1rem;
      align-items: start;
    }

    .panel-head h1 {
      margin: 0;
      font-family: var(--serif);
      font-size: 34px;
      line-height: 1.1;
      font-weight: 500;
      letter-spacing: 0;
    }

    .panel-subhead {
      margin: 0.45rem 0 0;
      max-width: 760px;
      color: #333;
      font-size: 15px;
      line-height: 1.5;
    }

    .panel-body {
      padding: 1rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .field {
      margin-bottom: 1rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      align-items: center;
      margin-top: 1rem;
    }

    .status {
      min-height: 1.2rem;
      color: var(--muted);
      font-size: 12.5px;
    }

    .pill {
      display: inline-block;
      border: 1px solid var(--hairline);
      padding: 0.14rem 0.4rem;
      font-family: var(--mono);
      font-size: 11px;
      background: #fff;
      white-space: nowrap;
    }

    .pill.high { border-color: var(--red); color: var(--red); }
    .pill.medium { border-color: var(--gold); color: var(--gold); }
    .pill.low { border-color: var(--green); color: var(--green); }

    .note {
      border-left: 3px solid var(--blue);
      background: var(--soft);
      padding: 0.75rem 0.9rem;
      color: #222;
      margin: 0.75rem 0;
    }

    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0.75rem;
    }

    .item-text {
      font-family: var(--serif);
      font-size: 16px;
      line-height: 1.45;
    }

    .compact textarea {
      min-height: 72px;
    }

    .pdf-preview-wrap {
      border: 1px solid var(--hairline);
      min-height: 420px;
      background: #fff;
    }

    .pdf-preview {
      width: 100%;
      min-height: 68vh;
      border: 0;
      display: block;
      background: #fff;
    }

    .empty {
      border: 1px dashed var(--hairline);
      padding: 1.25rem;
      color: var(--muted);
      background: #fffdf7;
    }

    .auth {
      max-width: 680px;
      margin: 4rem auto;
      border: 1px solid var(--hairline);
      padding: 1.25rem;
    }

    .auth h1 {
      font-family: var(--serif);
      font-weight: 500;
      font-size: 34px;
      margin: 0 0 0.65rem;
    }

    .hidden {
      display: none !important;
    }

    @media (max-width: 900px) {
      .layout,
      .grid,
      .split,
      .grid-3 {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
      }

      .topbar,
      .panel-head {
        flex-direction: column;
        align-items: stretch;
      }

      table {
        min-width: 920px;
      }

      .table-scroll {
        overflow-x: auto;
      }
    }
  </style>
</head>
<body>
  <div id="app" class="shell">
    <div class="auth">
      <h1>Decision Manifold Studio</h1>
      <p class="meta">Loading workspace.</p>
    </div>
  </div>

  <script>
    const STEPS = [
      ['intake', 'Intake'],
      ['sort', 'Type Sort'],
      ['value', 'Value Tags'],
      ['drill', 'The Drill'],
      ['questions', 'Questions'],
      ['gatekeepers', 'Gatekeepers'],
      ['sentence', 'One Sentence'],
      ['report', 'Final Report']
    ];

    const STEP_HELP = {
      intake: 'Put the brief on the table before the system tries to sort it.',
      sort: 'Every claim needs a place and a holder. Blank is better than fake.',
      value: 'Mark the questions and unknowns that could change the recommendation.',
      drill: 'Test the assumptions that are quietly carrying the answer.',
      questions: 'Turn open questions into something a real person can answer in time.',
      gatekeepers: 'Name who must say yes, who can say no, and where resistance is likely.',
      sentence: 'Write the sentence that rules something in and something out.',
      report: 'Open the PDF only after the map has earned it.'
    };

    const SOURCE_LABELS = {
      problemStatement: 'Problem',
      known: 'Known',
      assumptions: 'Assumption',
      openQuestions: 'Question'
    };

    const PLACEHOLDERS = {
      'intake.problemStatement': 'Example: Bethany House has a staffing gap that is affecting operations.',
      'intake.known': 'Example: Bethany House serves 100+ women and children a year. The CEO holds many partner relationships personally. A past Jericho facility plan was stopped by school-district concern.',
      'intake.assumptions': 'Example: The staffing gap is mainly a resourcing problem. A standard hire would close it. Better measurement is straightforwardly good.',
      'intake.openQuestions': 'Example: Who must approve a staffing change? What relationship breaks if we move too fast? What question is this framing keeping us from asking?',
      'drill.frameQuestion': 'Example: What question is this framing keeping us from asking?',
      'oneSentence.briefText': 'Example: There is a staffing gap.',
      'oneSentence.whatChanged': 'Example: The EA role appears to carry institutional memory and partner relationships, not just tasks.',
      'oneSentence.reframeText': 'Example: The staffing gap is a relationship-continuity problem showing up as staffing pressure.',
      'oneSentence.rulesIn': 'Example: Protect continuity, transfer relationships, hire for community standing.',
      'oneSentence.rulesOut': 'Example: Post the job, screen only for generic skills, fill fast.',
      'oneSentence.oneThingLeftOpen': 'Example: Which partner relationship is most fragile?',
      'oneSentence.whyLeftOpen': 'Example: We need a channel outside the CEO before treating this as settled.'
    };

    const ITEM_PLACEHOLDERS = {
      rawText: 'Example: The Executive Assistant role holds several donor and partner relationships.',
      holder: 'Example: Bethany House CEO or public record',
      veto: 'Example: School district, board chair, funder',
      valueRationale: 'Example: High value because it can change the recommended action and who must be consulted.',
      whoSaysYes: 'Example: Program director',
      likelyToSayNo: 'Example: Board member concerned about budget',
      reengineeredQuestion: 'Example: Which relationship must survive the staffing change?'
    };

    const ASSUMPTION_PLACEHOLDERS = {
      givenStatement: 'Example: The staffing gap is an execution-capacity problem.',
      wrongIf: 'Example: The missing capacity is actually relationship continuity or institutional memory.',
      whatChanges: 'Example: We would design a transition plan before writing a generic job description.'
    };

    const app = document.getElementById('app');
    let boot = null;
    let state = null;
    let currentStep = 'intake';
    let busy = false;
    let statusText = '';
    let pdfPreviewUrl = '';
    let pdfPreviewBlob = null;
    let pdfPreviewFilename = '';

    init();

    async function init() {
      try {
      const me = await api('/api/studio/me');
      if (!me.registered) {
        renderEmailGate();
        return;
      }
        boot = me;
        state = me.state;
      renderStudio();
    } catch (error) {
      if (error.status === 401) renderEmailGate(error);
      else renderAuthError(error);
    }
  }

    async function api(path, options = {}) {
      const headers = new Headers(options.headers || {});
      headers.set('Content-Type', 'application/json');
      const devEmail = localStorage.getItem('studio.devEmail');
      const devSecret = localStorage.getItem('studio.devSecret');
      if (devEmail && devSecret) {
        headers.set('X-Studio-Dev-Email', devEmail);
        headers.set('X-Studio-Dev-Secret', devSecret);
      }
      const response = await fetch(path, { ...options, headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'Request failed');
        error.status = response.status;
        throw error;
      }
      return data;
    }

    function renderEmailGate(error) {
      app.innerHTML = authShell('Decision Manifold Studio', \`
        <p class="meta">\${escapeHtml(error?.message || 'Use the class code from the session to create an account, then return to the same workspace as your report develops.')}</p>
        <div class="grid">
          <section>
            <h2>Log in</h2>
            <div class="field">
              <label>Email</label>
              <input id="loginEmail" type="email" autocomplete="email" placeholder="Example: maya@example.com">
            </div>
            <div class="field">
              <label>Password</label>
              <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Your password">
            </div>
            <div class="actions">
              <button id="loginBtn">Log in</button>
            </div>
          </section>
          <section>
            <h2>Register</h2>
            <div class="field">
              <label>Name</label>
              <input id="regName" autocomplete="name" placeholder="Example: Maya Shah">
            </div>
            <div class="field">
              <label>Email</label>
              <input id="regEmail" type="email" autocomplete="email" placeholder="Example: maya@example.com">
            </div>
            <div class="field">
              <label>Password</label>
              <input id="regPassword" type="password" autocomplete="new-password" placeholder="At least 8 characters">
            </div>
            <div class="field">
              <label>Class code</label>
              <input id="regClassCode" autocomplete="off" placeholder="Example: shared in class">
            </div>
            <div class="actions">
              <button id="registerBtn">Create account</button>
            </div>
          </section>
        </div>
        <p class="status">\${escapeHtml(statusText)}</p>
      \`);
    }

    function renderAuthError(error) {
      app.innerHTML = authShell('Decision Manifold Studio', \`
        <p class="meta">\${escapeHtml(error.message)}</p>
        <div id="devAuth" class="note">
          <div class="grid">
            <div class="field">
              <label>Dev email</label>
              <input id="devEmail" value="\${escapeAttr(localStorage.getItem('studio.devEmail') || '')}" placeholder="uni@columbia.edu">
            </div>
            <div class="field">
              <label>Dev secret</label>
              <input id="devSecret" type="password" value="\${escapeAttr(localStorage.getItem('studio.devSecret') || '')}" placeholder="dev-secret">
            </div>
          </div>
          <div class="actions">
            <button id="saveDevAuth">Save dev auth</button>
          </div>
        </div>
      \`);
    }

    function renderRegistration(me) {
      renderEmailGate({ message: me?.email ? 'Finish registration for ' + me.email + '.' : '' });
    }

    function authShell(title, body) {
      return \`<div class="auth"><h1>\${title}</h1>\${body}</div>\`;
    }

    function renderStudio() {
      app.innerHTML = \`
        <div class="topbar">
          <div class="brand">
            <b>Decision Manifold Studio</b>
            <span>\${escapeHtml(boot.engagement?.cohort_name || 'Decision Engineering')} · \${escapeHtml(boot.team?.name || '')}</span>
          </div>
          <nav class="module-switch" aria-label="Assignment modules">
            <a class="active" href="/decision-engineering">Inquiry</a>
            <a href="/decision-engineering/module-2">Bet Selection</a>
          </nav>
          <div class="actions" style="margin-top:0">
            <span class="pill">\${usageLabel()}</span>
            <button class="secondary" id="saveBtn">Save</button>
            <button class="secondary" id="logoutBtn">Log out</button>
            <span class="status" id="status">\${escapeHtml(statusText)}</span>
          </div>
        </div>
        <div class="layout">
          <aside class="sidebar">
            \${STEPS.map(([id, label], index) => \`
              <button class="step-btn \${id === currentStep ? 'active' : ''}" data-step="\${id}">
                <span>\${label}</span><span class="step-num">\${String(index + 1).padStart(2, '0')}</span>
              </button>
            \`).join('')}
          </aside>
          <main class="panel">
            <div class="panel-head">
              <div>
                <h1>\${escapeHtml(STEPS.find(([id]) => id === currentStep)?.[1] || '')}</h1>
                <p class="panel-subhead">\${escapeHtml(STEP_HELP[currentStep] || '')}</p>
              </div>
              <div class="meta">\${summaryMeta()}</div>
            </div>
            <div class="panel-body">
              \${renderStep()}
            </div>
          </main>
        </div>
      \`;
    }

    function summaryMeta() {
      const settled = state.items.filter((item) => item.status === 'settled').length;
      return \`\${state.items.length} items · \${settled} settled · \${highValueItems().length} high-value\`;
    }

    function usageLabel() {
      const usage = boot?.usage || {};
      return \`\${money(usage.used_micros)} / \${money(usage.limit_micros || 10000000)} used\`;
    }

    function money(micros) {
      return '$' + (Number(micros || 0) / 1000000).toFixed(2);
    }

    function renderStep() {
      if (currentStep === 'intake') return renderIntake();
      if (currentStep === 'sort') return renderSort();
      if (currentStep === 'value') return renderValue();
      if (currentStep === 'drill') return renderDrill();
      if (currentStep === 'questions') return renderQuestions();
      if (currentStep === 'gatekeepers') return renderGatekeepers();
      if (currentStep === 'sentence') return renderSentence();
      if (currentStep === 'report') return renderReport();
      return '';
    }

    function renderIntake() {
      return \`
        <div class="grid">
          \${textareaField('Problem statement', 'intake.problemStatement')}
          \${textareaField('Everything known', 'intake.known')}
          \${textareaField('Assumptions', 'intake.assumptions')}
          \${textareaField('Open questions', 'intake.openQuestions')}
        </div>
        <div class="actions">
          <button id="parseBtn" \${busyAttr()}>Build item map</button>
          <button class="secondary" id="saveBtn2">Save</button>
        </div>
      \`;
    }

    function renderSort() {
      if (!state.items.length) return emptyState('Start with the brief. The map appears after intake is parsed.');
      return \`
        <div class="actions" style="margin-top:0; margin-bottom:0.75rem">
          <button id="sortBtn" \${busyAttr()}>Sort items</button>
          <button class="secondary" id="addItemBtn">Add Item</button>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th style="width:43%">Item</th>
                <th style="width:10%">Source</th>
                <th style="width:10%">Bucket</th>
                <th style="width:22%">Holder / source</th>
                <th style="width:10%">Status</th>
                <th style="width:5%"></th>
              </tr>
            </thead>
            <tbody>
              \${state.items.map(renderSortRow).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    function renderSortRow(item) {
      return \`
        <tr>
          <td><textarea class="item-input" data-item-id="\${item.id}" data-field="rawText" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.rawText)}">\${escapeHtml(item.rawText)}</textarea><div class="meta">\${escapeHtml(item.aiNotes || '')}</div></td>
          <td><span class="pill">\${escapeHtml(SOURCE_LABELS[item.sourceField] || item.sourceField)}</span></td>
          <td>\${selectItemField(item, 'bucket', ['', 'KK', 'KU', 'UK', 'UU'])}</td>
          <td><input data-item-id="\${item.id}" data-field="holder" value="\${escapeAttr(item.holder)}" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.holder)}"></td>
          <td><span class="pill">\${escapeHtml(item.status || 'needs_attribution')}</span></td>
          <td><button class="ghost" data-remove-item="\${item.id}">Del</button></td>
        </tr>
      \`;
    }

    function renderValue() {
      const items = state.items.filter((item) => item.bucket && item.bucket !== 'KK');
      if (!items.length) return emptyState('Nothing needs judgment yet. Sort the brief first.');
      return \`
        <div class="actions" style="margin-top:0; margin-bottom:0.75rem">
          <button id="valueBtn" \${busyAttr()}>Mark high-value items</button>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th style="width:48%">Item</th>
                <th style="width:10%">Bucket</th>
                <th style="width:12%">Value</th>
                <th style="width:30%">Rationale</th>
              </tr>
            </thead>
            <tbody>
              \${items.map(renderValueRow).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    function renderValueRow(item) {
      return \`
        <tr>
          <td class="item-text">\${escapeHtml(item.rawText)}</td>
          <td><span class="pill">\${escapeHtml(item.bucket)}</span></td>
          <td>\${selectItemField(item, 'valueTag', ['', 'High', 'Medium', 'Low'])}</td>
          <td><textarea data-item-id="\${item.id}" data-field="valueRationale" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.valueRationale)}">\${escapeHtml(item.valueRationale)}</textarea></td>
        </tr>
      \`;
    }

    function renderDrill() {
      const options = itemOptions(true);
      return \`
        <div class="grid-3">
          \${state.drill.assumptions.map((assumption, index) => \`
            <section class="panel compact" style="margin:0">
              <div class="panel-head"><h1 style="font-size:22px">Assumption \${index + 1}</h1></div>
              <div class="panel-body">
                <div class="field">
                  <label>Selected item</label>
                  <select data-assumption-index="\${index}" data-assumption-field="selectedItemId">
                    <option value=""></option>
                    \${options.map((option) => \`<option value="\${option.id}" \${assumption.selectedItemId === option.id ? 'selected' : ''}>\${escapeHtml(option.label)}</option>\`).join('')}
                  </select>
                </div>
                \${textareaAssumption(index, 'Given statement', 'givenStatement')}
                \${textareaAssumption(index, 'Wrong if', 'wrongIf')}
                \${textareaAssumption(index, 'What changes', 'whatChanges')}
                <div class="actions">
                  <button data-drill-scaffold="\${index}" \${busyAttr()}>Build scaffold</button>
                </div>
                \${renderScaffold(assumption)}
              </div>
            </section>
          \`).join('')}
        </div>
        <div class="field" style="margin-top:1rem">
          <label>Frame question</label>
          <input data-path="drill.frameQuestion" value="\${escapeAttr(state.drill.frameQuestion)}" placeholder="\${escapeAttr(PLACEHOLDERS['drill.frameQuestion'])}">
        </div>
      \`;
    }

    function renderScaffold(assumption) {
      if (!assumption.scaffold) return '';
      return \`
        <div class="note">
          <b>Claim phrasings</b>
          <ol>\${(assumption.scaffold.claimOptions || []).map((x) => \`<li>\${escapeHtml(x)}</li>\`).join('')}</ol>
          <b>Angles</b>
          <ol>\${(assumption.scaffold.angles || []).map((x) => \`<li>\${escapeHtml(x)}</li>\`).join('')}</ol>
          <div class="meta">\${escapeHtml(assumption.scaffold.frameQuestion || '')}</div>
        </div>
      \`;
    }

    function renderQuestions() {
      const items = state.items.filter((item) => item.sourceField === 'openQuestions' || item.bucket === 'KU' || item.rawText.includes('?'));
      if (!items.length) return emptyState('No open question has reached the table yet.');
      return \`
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th style="width:38%">Original</th>
                <th style="width:32%">Selected variant</th>
                <th style="width:20%">Variants</th>
                <th style="width:10%"></th>
              </tr>
            </thead>
            <tbody>
              \${items.map(renderQuestionRow).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    function renderQuestionRow(item) {
      const variants = state.questionEngineering.variants[item.id] || [];
      return \`
        <tr>
          <td class="item-text">\${escapeHtml(item.rawText)}</td>
          <td><textarea data-item-id="\${item.id}" data-field="reengineeredQuestion" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.reengineeredQuestion)}">\${escapeHtml(item.reengineeredQuestion)}</textarea></td>
          <td>
            \${variants.map((variant) => \`<button class="secondary" style="margin:0 0 0.35rem; width:100%; text-align:left" data-use-variant="\${item.id}" data-variant="\${escapeAttr(variant)}">\${escapeHtml(variant)}</button>\`).join('')}
          </td>
          <td><button data-sharpen-question="\${item.id}" \${busyAttr()}>Sharpen</button></td>
        </tr>
      \`;
    }

    function renderGatekeepers() {
      const items = state.items.filter((item) => item.valueTag === 'High' && item.bucket && item.bucket !== 'KK');
      const risk = channelRisk();
      return \`
        \${risk ? \`<div class="note"><b>Channel risk</b><br>\${escapeHtml(risk)}</div>\` : ''}
        \${items.length ? \`
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style="width:26%">High-value item</th>
                  <th style="width:26%">Curated question</th>
                  <th style="width:14%">Who says yes</th>
                  <th style="width:14%">Can say no</th>
                  <th style="width:14%">Likely no</th>
                  <th style="width:6%">Ready</th>
                </tr>
              </thead>
              <tbody>
                \${items.map(renderGatekeeperRow).join('')}
              </tbody>
            </table>
          </div>
        \` : emptyState('Tag at least one KU, UK, or UU item High before mapping gatekeepers.')}
      \`;
    }

    function renderGatekeeperRow(item) {
      return \`
        <tr>
          <td class="item-text">\${escapeHtml(item.rawText)}</td>
          <td><textarea data-item-id="\${item.id}" data-field="reengineeredQuestion" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.reengineeredQuestion)}">\${escapeHtml(item.reengineeredQuestion)}</textarea></td>
          <td><input data-item-id="\${item.id}" data-field="whoSaysYes" value="\${escapeAttr(item.whoSaysYes)}" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.whoSaysYes)}"></td>
          <td><input data-item-id="\${item.id}" data-field="veto" value="\${escapeAttr(item.veto)}" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.veto)}"></td>
          <td><input data-item-id="\${item.id}" data-field="likelyToSayNo" value="\${escapeAttr(item.likelyToSayNo)}" placeholder="\${escapeAttr(ITEM_PLACEHOLDERS.likelyToSayNo)}"></td>
          <td><span class="pill">\${isReadyHighValueQuestion(item) ? 'ready' : 'missing'}</span></td>
        </tr>
      \`;
    }

    function renderSentence() {
      const check = state.oneSentence.aiCheck;
      return \`
        <div class="grid">
          \${textareaField('Brief as given', 'oneSentence.briefText')}
          \${textareaField('What changed', 'oneSentence.whatChanged')}
          \${textareaField('Reframed sentence', 'oneSentence.reframeText')}
          <div>
            \${textareaField('Rules in', 'oneSentence.rulesIn')}
            \${textareaField('Rules out', 'oneSentence.rulesOut')}
          </div>
          \${textareaField('One thing left open', 'oneSentence.oneThingLeftOpen')}
          \${textareaField('Why left open', 'oneSentence.whyLeftOpen')}
        </div>
        <div class="actions">
          <button id="sentenceCheckBtn" \${busyAttr()}>Check Sentence</button>
          <button class="secondary" id="approveSentenceBtn" \${busyAttr()}>Approve Sentence</button>
          <span class="pill">\${escapeHtml(state.oneSentence.status || 'draft')}</span>
        </div>
        \${check ? \`<div class="note"><b>\${escapeHtml(check.verdict)}</b><br>\${escapeHtml(check.reasoning)}<br><span class="meta">\${escapeHtml((check.missingFields || []).join(', '))}</span></div>\` : ''}
      \`;
    }

    function renderReport() {
      return \`
        <div class="actions" style="margin-top:0; margin-bottom:0.75rem">
          <button id="reportBtn" \${busyAttr()}>Generate PDF</button>
          <button class="secondary" id="saveVersionBtn" \${busyAttr()}>Save Version</button>
          <button class="secondary" id="downloadPdfBtn" \${busyAttr()} \${pdfPreviewBlob || state.finalReport.document ? '' : 'disabled'}>Download PDF</button>
          <button class="secondary" id="copyReportBtn">Copy</button>
        </div>
        \${renderVersions()}
        \${pdfPreviewUrl
          ? \`<div class="pdf-preview-wrap"><iframe class="pdf-preview" src="\${escapeAttr(pdfPreviewUrl)}" title="Final report PDF"></iframe></div>\`
          : emptyState('Approve the problem sentence, complete the gatekeeper fields, then generate the PDF report.')}
      \`;
    }

    function renderVersions() {
      const versions = boot?.versions || [];
      if (!versions.length) return '<div class="meta" style="margin-bottom:0.75rem">No saved versions yet.</div>';
      return \`
        <div class="table-scroll" style="margin-bottom:0.75rem">
          <table>
            <thead><tr><th style="width:12%">Version</th><th style="width:28%">Saved</th><th>PDF</th></tr></thead>
            <tbody>
              \${versions.map((version) => \`
                <tr>
                  <td>v\${escapeHtml(version.version_number)}</td>
                  <td>\${escapeHtml(version.created_at || '')}</td>
                  <td><a href="\${escapeAttr(version.pdf_url)}" target="_blank" rel="noopener">Download saved PDF</a></td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    function textareaField(label, path) {
      return \`
        <div class="field">
          <label>\${label}</label>
          <textarea data-path="\${path}" placeholder="\${escapeAttr(PLACEHOLDERS[path] || '')}">\${escapeHtml(getPath(state, path) || '')}</textarea>
        </div>
      \`;
    }

    function textareaAssumption(index, label, field) {
      const assumption = state.drill.assumptions[index];
      return \`
        <div class="field">
          <label>\${label}</label>
          <textarea data-assumption-index="\${index}" data-assumption-field="\${field}" placeholder="\${escapeAttr(ASSUMPTION_PLACEHOLDERS[field] || '')}">\${escapeHtml(assumption[field] || '')}</textarea>
        </div>
      \`;
    }

    function selectItemField(item, field, values) {
      return \`
        <select data-item-id="\${item.id}" data-field="\${field}">
          \${values.map((value) => \`<option value="\${value}" \${item[field] === value ? 'selected' : ''}>\${value}</option>\`).join('')}
        </select>
      \`;
    }

    function itemOptions(includeAssumptionsOnly) {
      const items = includeAssumptionsOnly
        ? state.items.filter((item) => item.sourceField === 'assumptions' || item.bucket === 'KK' || item.bucket === 'KU')
        : state.items;
      return items.map((item) => ({
        id: item.id,
        label: (item.rawText || '').slice(0, 90)
      }));
    }

    function emptyState(text) {
      return \`<div class="empty">\${escapeHtml(text)}</div>\`;
    }

    function busyAttr() {
      return busy ? 'disabled' : '';
    }

    function highValueItems() {
      return state.items.filter((item) => item.valueTag === 'High');
    }

    document.addEventListener('click', async (event) => {
      const target = event.target.closest('button');
      if (!target) return;

      if (target.id === 'saveDevAuth') {
        localStorage.setItem('studio.devEmail', document.getElementById('devEmail').value.trim());
        localStorage.setItem('studio.devSecret', document.getElementById('devSecret').value);
        init();
        return;
      }

      if (target.id === 'loginBtn') {
        await startSession();
        return;
      }

      if (target.id === 'registerBtn') {
        await register();
        return;
      }

      if (target.dataset.step) {
        currentStep = target.dataset.step;
        renderStudio();
        return;
      }

      if (target.id === 'saveBtn' || target.id === 'saveBtn2') {
        await save();
        return;
      }

      if (target.id === 'logoutBtn') {
        await api('/api/studio/auth/logout', { method: 'POST', body: '{}' });
        location.reload();
        return;
      }

      if (target.id === 'parseBtn') await parseIntake();
      if (target.id === 'sortBtn') await sortItems();
      if (target.id === 'valueBtn') await valueItems();
      if (target.id === 'addItemBtn') addItem();
      if (target.dataset.removeItem) removeItem(target.dataset.removeItem);
      if (target.dataset.drillScaffold) await scaffoldDrill(Number(target.dataset.drillScaffold));
      if (target.dataset.sharpenQuestion) await sharpenQuestion(target.dataset.sharpenQuestion);
      if (target.dataset.useVariant) useVariant(target.dataset.useVariant, target.dataset.variant);
      if (target.id === 'sentenceCheckBtn') await checkSentence();
      if (target.id === 'approveSentenceBtn') approveSentence();
      if (target.id === 'reportBtn') await generateReport();
      if (target.id === 'saveVersionBtn') await saveReportVersion();
      if (target.id === 'downloadPdfBtn') await downloadPdf();
      if (target.id === 'copyReportBtn') await copyReport();
    });

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (target.dataset.path) {
        setPath(state, target.dataset.path, target.value);
      }
      if (target.dataset.itemId && target.dataset.field) {
        const item = state.items.find((x) => x.id === target.dataset.itemId);
        if (item) {
          item[target.dataset.field] = target.value;
          refreshItemStatus(item);
        }
      }
      if (target.dataset.assumptionIndex && target.dataset.assumptionField) {
        const assumption = state.drill.assumptions[Number(target.dataset.assumptionIndex)];
        assumption[target.dataset.assumptionField] = target.value;
        if (target.dataset.assumptionField === 'selectedItemId') {
          const item = state.items.find((x) => x.id === target.value);
          assumption.selectedText = item ? item.rawText : '';
        }
      }
    });

    async function startSession() {
      await withBusy(async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const data = await api('/api/studio/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        boot = data;
        state = data.state;
        currentStep = data.workspace?.current_step || 'intake';
        statusText = '';
        renderStudio();
      }, false);
    }

    async function register() {
      await withBusy(async () => {
        const data = await api('/api/studio/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('regName').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value,
            classCode: document.getElementById('regClassCode').value,
          }),
        });
        boot = data;
        state = data.state;
        currentStep = 'intake';
        statusText = 'Registered.';
        renderStudio();
      });
    }

    async function save() {
      await withBusy(async () => {
        await persist();
        statusText = 'Saved ' + new Date().toLocaleTimeString();
        renderStudio();
      }, false);
    }

    async function persist() {
      const data = await api('/api/studio/workspace', {
        method: 'PUT',
        body: JSON.stringify({ state, currentStep }),
      });
      state = data.state;
    }

    async function runModule(module, payload) {
      const response = await api('/api/studio/llm', {
        method: 'POST',
        body: JSON.stringify({ module, payload }),
      });
      if (response.usage && boot) boot.usage = response.usage;
      return response.result;
    }

    async function parseIntake() {
      await withBusy(async () => {
        const result = await runModule('parse_intake', { intake: state.intake });
        state.items = (result.items || []).map((item) => ({
          id: crypto.randomUUID(),
          sourceField: item.sourceField,
          rawText: item.rawText,
          bucket: '',
          holder: '',
          veto: '',
          status: 'needs_attribution',
          valueTag: '',
          valueRationale: '',
          aiNotes: '',
          whoSaysYes: '',
          likelyToSayNo: '',
          reengineeredQuestion: '',
        }));
        statusText = result.note || 'Parsed.';
        currentStep = 'sort';
        await persist();
      });
    }

    async function sortItems() {
      await withBusy(async () => {
        const result = await runModule('sort_items', { items: state.items });
        for (const update of result.items || []) {
          const item = state.items.find((x) => x.id === update.id);
          if (!item) continue;
          Object.assign(item, {
            bucket: update.bucket || item.bucket,
            holder: update.holder || item.holder,
            veto: update.veto || item.veto,
            status: update.status || item.status,
            aiNotes: update.aiNotes || item.aiNotes,
          });
        }
        statusText = result.note || 'Sorted.';
        await persist();
      });
    }

    async function valueItems() {
      await withBusy(async () => {
        const result = await runModule('value_tag', { items: state.items.filter((item) => item.bucket && item.bucket !== 'KK') });
        for (const update of result.items || []) {
          const item = state.items.find((x) => x.id === update.id);
          if (!item) continue;
          item.valueTag = update.valueTag || item.valueTag;
          item.valueRationale = update.valueRationale || item.valueRationale;
        }
        statusText = result.note || 'Tagged.';
        await persist();
      });
    }

    async function scaffoldDrill(index) {
      await withBusy(async () => {
        const assumption = state.drill.assumptions[index];
        const item = state.items.find((x) => x.id === assumption.selectedItemId);
        const result = await runModule('drill_scaffold', { item, text: assumption.selectedText || assumption.givenStatement });
        assumption.scaffold = result;
        if (!assumption.givenStatement && result.claimOptions?.[0]) assumption.givenStatement = result.claimOptions[0];
        if (!state.drill.frameQuestion && result.frameQuestion) state.drill.frameQuestion = result.frameQuestion;
        statusText = result.note || 'Scaffolded.';
        await persist();
      });
    }

    async function sharpenQuestion(itemId) {
      await withBusy(async () => {
        const item = state.items.find((x) => x.id === itemId);
        const result = await runModule('question_reengineer', { question: item.rawText });
        state.questionEngineering.variants[itemId] = result.variants || [];
        statusText = result.ownerFlag || result.note || 'Sharpened.';
        await persist();
      });
    }

    function useVariant(itemId, variant) {
      const item = state.items.find((x) => x.id === itemId);
      if (item) item.reengineeredQuestion = variant;
      renderStudio();
    }

    async function checkSentence() {
      await withBusy(async () => {
        const result = await runModule('one_sentence_check', state.oneSentence);
        state.oneSentence.aiCheck = result;
        if (result.verdict !== 'strong') state.oneSentence.status = 'draft';
        statusText = result.note || 'Checked.';
        await persist();
      });
    }

    function approveSentence() {
      const missing = [];
      if (!isMeaningfulField(state.oneSentence.reframeText)) missing.push('reframed sentence');
      if (!isMeaningfulField(state.oneSentence.rulesIn)) missing.push('rules in');
      if (!isMeaningfulField(state.oneSentence.rulesOut)) missing.push('rules out');
      if (state.oneSentence.aiCheck?.verdict !== 'strong') missing.push('strong check');
      if (missing.length) {
        statusText = 'Cannot approve yet: missing ' + missing.join(', ') + '.';
        state.oneSentence.status = 'draft';
      } else {
        state.oneSentence.status = 'approved';
        statusText = 'Sentence approved.';
      }
      renderStudio();
    }

    async function generateReport() {
      await withBusy(async () => {
        validateReportReady();
        const result = await refreshReport();
        const pdf = await requestPdfBlob();
        setPdfPreview(pdf.blob, pdf.filename);
        state.finalReport.pdfGeneratedAt = new Date().toISOString();
        statusText = result.note || 'PDF ready.';
        await persist();
      });
    }

    async function refreshReport() {
      const result = await api('/api/studio/report/preview', {
        method: 'POST',
        body: JSON.stringify({ state }),
      });
      state.finalReport.document = result.document || null;
      state.finalReport.markdown = result.markdown || '';
      state.finalReport.pdfBase64 = result.pdfBase64 || '';
      state.finalReport.generatedAt = new Date().toISOString();
      return result;
    }

    async function saveReportVersion() {
      await withBusy(async () => {
        validateReportReady();
        const data = await api('/api/studio/report/save-version', {
          method: 'POST',
          body: JSON.stringify({ state }),
        });
        state = data.state || state;
        boot.versions = data.versions || boot.versions || [];
        if (data.pdfBase64) {
          setPdfPreview(base64ToPdfBlob(data.pdfBase64), data.filename || defaultPdfFilename());
        }
        statusText = 'Saved version ' + (data.version?.version_number || '') + '.';
      });
    }

    function addItem() {
      state.items.push({
        id: crypto.randomUUID(),
        sourceField: 'known',
        rawText: '',
        bucket: '',
        holder: '',
        veto: '',
        status: 'needs_attribution',
        valueTag: '',
        valueRationale: '',
        aiNotes: '',
        whoSaysYes: '',
        likelyToSayNo: '',
        reengineeredQuestion: '',
      });
      renderStudio();
    }

    function removeItem(itemId) {
      state.items = state.items.filter((item) => item.id !== itemId);
      renderStudio();
    }

    async function copyReport() {
      await navigator.clipboard.writeText(state.finalReport.markdown || '');
      statusText = 'Copied.';
      renderStudio();
    }

    async function downloadPdf() {
      await withBusy(async () => {
        if (!pdfPreviewBlob) {
          if (!state.finalReport.document) await refreshReport();
          const pdf = await requestPdfBlob();
          setPdfPreview(pdf.blob, pdf.filename);
          state.finalReport.pdfGeneratedAt = new Date().toISOString();
        }

        downloadBlob(pdfPreviewBlob, pdfPreviewFilename || defaultPdfFilename());
        statusText = 'PDF downloaded.';
        await persist();
      });
    }

    async function requestPdfBlob() {
      if (!state.finalReport.document) {
        throw new Error('Generate a report before requesting a PDF.');
      }

      if (state.finalReport.pdfBase64) {
        return {
          blob: base64ToPdfBlob(state.finalReport.pdfBase64),
          filename: defaultPdfFilename(),
        };
      }

      return {
        blob: buildPdfBlob(reportLines(state.finalReport.document)),
        filename: defaultPdfFilename(),
      };
    }

    function base64ToPdfBlob(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: 'application/pdf' });
    }

    function setPdfPreview(blob, filename) {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      pdfPreviewBlob = blob;
      pdfPreviewFilename = filename || defaultPdfFilename();
      pdfPreviewUrl = URL.createObjectURL(blob);
    }

    function defaultPdfFilename(stamp = new Date().toISOString().slice(0, 10)) {
      return \`decision-manifold-final-report-\${stamp}.pdf\`;
    }

    function reportLines(document) {
      const lines = [
        document.title || 'Decision Manifold Studio Final Report',
        '',
        'Refined Problem Statement',
        document.refinedProblemStatement || 'Draft not yet approved.',
        '',
        'Curated High-Value Questions',
      ];
      if (!document.highValueQuestions?.length) lines.push('No high-value questions ready.');
      (document.highValueQuestions || []).forEach((item, index) => {
        lines.push(\`\${index + 1}. \${item.question || ''}\`);
        lines.push(\`   Who says yes: \${item.whoMustSayYes || ''}\`);
        lines.push(\`   Veto: \${item.vetoHolder || ''}\`);
        lines.push(\`   Likely no: \${item.likelyToSayNo || ''}\`);
      });
      lines.push('', 'Type Map');
      (document.typeMap || []).forEach((item) => {
        lines.push(\`\${item.bucket || '-'} | \${item.status || '-'} | \${item.valueTag || '-'} | \${item.holder || '-'} | \${item.sourceField || '-'} | \${item.item || ''}\`);
      });
      lines.push('', 'Assumption Drill Summary');
      (document.drillSummary || []).forEach((item) => {
        lines.push(item.label || 'Assumption');
        lines.push(\`Given: \${item.givenStatement || ''}\`);
        lines.push(\`Wrong if: \${item.wrongIf || ''}\`);
        lines.push(\`What changes: \${item.whatChanges || ''}\`);
      });
      lines.push('', 'One Thing Left Open', document.oneThingLeftOpen || '', document.whyLeftOpen || '');
      if (document.guardrailNote) lines.push('', 'Guardrail Note', document.guardrailNote);
      return lines;
    }

    function buildPdfBlob(lines) {
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
      pages.push(current);

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
        const contentId = addObject(\`<< /Length \${byteLength(stream)} >>\\nstream\\n\${stream}\\nendstream\`);
        const pageId = addObject(\`<< /Type /Page /Parent \${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 \${fontId} 0 R >> >> /Contents \${contentId} 0 R >>\`);
        pageIds.push(pageId);
      });
      objects[pagesId - 1] = \`<< /Type /Pages /Kids [\${pageIds.map((id) => \`\${id} 0 R\`).join(' ')}] /Count \${pageIds.length} >>\`;

      let pdf = '%PDF-1.4\\n';
      const offsets = [0];
      objects.forEach((body, index) => {
        offsets.push(byteLength(pdf));
        pdf += \`\${index + 1} 0 obj\\n\${body}\\nendobj\\n\`;
      });
      const xref = byteLength(pdf);
      pdf += \`xref\\n0 \${objects.length + 1}\\n0000000000 65535 f \\n\`;
      offsets.slice(1).forEach((offset) => {
        pdf += \`\${String(offset).padStart(10, '0')} 00000 n \\n\`;
      });
      pdf += \`trailer\\n<< /Size \${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n\${xref}\\n%%EOF\`;
      return new Blob([pdf], { type: 'application/pdf' });
    }

    function pdfPageStream(lines) {
      const commands = ['BT', '/F1 11 Tf', '72 742 Td', '14 TL'];
      lines.forEach((line, index) => {
        if (index > 0) commands.push('T*');
        commands.push(\`(\${escapePdf(line)}) Tj\`);
      });
      commands.push('ET');
      return commands.join('\\n');
    }

    function wrapPdfLine(line, width) {
      const words = String(line).replace(/\\s+/g, ' ').trim().split(' ');
      const chunks = [];
      let current = '';
      words.forEach((word) => {
        if ((current + ' ' + word).trim().length > width) {
          chunks.push(current);
          current = word;
        } else {
          current = (current + ' ' + word).trim();
        }
      });
      chunks.push(current || ' ');
      return chunks;
    }

    function escapePdf(text) {
      return String(text).replace(/\\\\/g, '\\\\\\\\').replace(/\\(/g, '\\\\(').replace(/\\)/g, '\\\\)');
    }

    function byteLength(text) {
      return new TextEncoder().encode(text).length;
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function validateReportReady() {
      if (state.oneSentence.status !== 'approved') {
        throw new Error('Approve the One Sentence before generating the final report.');
      }
      if (!isMeaningfulField(state.oneSentence.reframeText)) {
        throw new Error('The approved problem statement is blank.');
      }
      const high = state.items.filter((item) => item.valueTag === 'High' && item.bucket && item.bucket !== 'KK');
      if (!high.length) {
        throw new Error('Tag at least one KU, UK, or UU item High before generating the final report.');
      }
      if (!high.some((item) => isReadyHighValueQuestion(item))) {
        throw new Error('Complete Gatekeepers for at least one high-value question: who says yes, who can say no, and likely no.');
      }
    }

    function refreshItemStatus(item) {
      item.status = item.bucket && isMeaningfulField(item.holder) ? 'settled' : 'needs_attribution';
    }

    function isReadyHighValueQuestion(item) {
      return item
        && item.valueTag === 'High'
        && item.bucket
        && item.bucket !== 'KK'
        && isMeaningfulField(item.reengineeredQuestion || item.rawText)
        && isMeaningfulField(item.whoSaysYes)
        && isMeaningfulField(item.veto)
        && isMeaningfulField(item.likelyToSayNo);
    }

    function channelRisk() {
      const holders = state.items
        .filter((item) => item.status === 'settled' && isMeaningfulField(item.holder))
        .map((item) => item.holder.trim().toLowerCase());
      if (holders.length < 2) return '';
      const counts = holders.reduce((acc, holder) => {
        acc[holder] = (acc[holder] || 0) + 1;
        return acc;
      }, {});
      const [holder, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const share = count / holders.length;
      if (share < 0.7) return '';
      return \`\${count} of \${holders.length} settled items cite "\${holder}" as holder/source. Find a second channel before treating the map as fully settled.\`;
    }

    function isMeaningfulField(value) {
      const text = String(value || '').trim().toLowerCase();
      return Boolean(text) && !/^(unknown|unk|n\\/a|na|none|null|tbd|todo|to be decided|optional|placeholder|\\?|not sure)$/.test(text);
    }

    async function withBusy(fn, rerender = true) {
      if (busy) return;
      busy = true;
      if (rerender && state) renderStudio();
      try {
        await fn();
      } catch (error) {
        statusText = error.message;
        if (state) renderStudio();
        else renderEmailGate({ message: statusText });
      } finally {
        busy = false;
        if (rerender && state) renderStudio();
      }
    }

    function getPath(object, path) {
      return path.split('.').reduce((acc, part) => acc ? acc[part] : undefined, object);
    }

    function setPath(object, path, value) {
      const parts = path.split('.');
      let cursor = object;
      while (parts.length > 1) {
        const part = parts.shift();
        cursor[part] = cursor[part] || {};
        cursor = cursor[part];
      }
      cursor[parts[0]] = value;
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
