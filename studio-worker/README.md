# Decision Manifold Studio Worker

Cloudflare-native student workspace for the Decision Manifold workflow.

## What It Provides

- Cloudflare Access gated app at `/studio`.
- Live app routes at `/studio`, `/decision-engineering`, and
  `platform.zetesislabs.com/decision-engineering`.
- Columbia-domain enforcement in the Worker as a second check.
- Signed preview sessions for the client-approval phase when Cloudflare Access
  is not yet configured.
- D1-backed registration, teams, memberships, workspace state, audit events, and LLM run logs.
- OpenAI API calls from the Worker only. The browser never receives an API key.
- End-to-end student workflow: intake, type sort, value tags, Drill, question re-engineering, One Sentence, final report.
- Downloadable final-report PDFs rendered from guarded structured report JSON.
  Production currently falls back to browser-side PDF generation if no trusted
  Python/Container renderer is configured.

## Cloudflare Setup

1. Create the D1 database:

   ```sh
   cd studio-worker
   npx wrangler d1 create zetesis_decision_manifold_studio
   ```

2. Copy the returned `database_id` into `wrangler.toml`.

3. Apply migrations:

   ```sh
   npx wrangler d1 migrations apply zetesis_decision_manifold_studio --remote
   ```

4. Store the OpenAI key as a Worker secret:

   ```sh
   npx wrangler secret put OPENAI_API_KEY
   ```

5. Store the signed preview-session secret:

   ```sh
   npx wrangler secret put SESSION_SECRET
   ```

6. Deploy:

   ```sh
   npx wrangler deploy
   ```

7. In Cloudflare Zero Trust, put an Access application in front of:

   - `https://zetesislabs.com/studio*`
   - `https://zetesislabs.com/decision-engineering*`
   - `https://zetesislabs.com/api/studio*`
   - `https://platform.zetesislabs.com/*`

   Configure an allow policy for email domain `columbia.edu`. The Worker reads
   `Cf-Access-Authenticated-User-Email` and rejects non-Columbia domains even if
   Access is misconfigured. Until Access is configured, the preview session path
   asks users to claim a Columbia email and stores that claim in a signed
   HttpOnly cookie.

## Local Development

Create a local, uncommitted `studio-worker/.dev.vars`:

```sh
DEV_AUTH_SECRET=local-secret
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
SESSION_SECRET=local-random-secret
PDF_SERVICE_URL=http://127.0.0.1:8790/pdf
```

Run the Worker:

```sh
npm run studio:migrate:local
npm run studio:dev
```

In another terminal, run the local PDF renderer:

```sh
PYTHON_BIN=/path/to/python3 npm run studio:pdf
```

The Codex bundled Python runtime already includes `reportlab`, `pdfplumber`, and
`pypdf`. With a system Python, install them first if needed:

```sh
python3 -m pip install reportlab pdfplumber pypdf
```

Open the local Worker URL, then use the dev-auth panel with:

- Dev email: any `@columbia.edu` address
- Dev secret: the value of `DEV_AUTH_SECRET`

If `OPENAI_API_KEY` is not present, the Worker uses deterministic fallback
logic so the workflow remains testable.

## PDF Rendering

The final report is generated in two steps:

1. The LLM or offline fixture returns a strict `document` JSON object plus a
   Markdown preview. The prompt forbids recommendations, inferred stakeholder
   beliefs, guessed UK/UU content, arbitrary markup, and filler.
2. `pdf_service.py` renders only that JSON object with ReportLab. It escapes
   text, caps field lengths, ignores markup, and owns the layout in code.

Localhost defaults to `http://localhost:8790/pdf`. In production, set
`PDF_SERVICE_URL` to a trusted PDF rendering service or Cloudflare Container
endpoint; `/api/studio/report/pdf` will proxy to it after Columbia/registration
checks. If no renderer is configured, the browser app generates a simple PDF
directly from the guarded report JSON.

PDF smoke test:

```sh
PYTHON_BIN=/path/to/python3 npm run studio:test:pdf
```
