# Decision Engineering Platform Worker

Cloudflare-native class platform for the Bethany House Decision Engineering workflow.

## What It Provides

- Student app at `/studio`, `/decision-engineering`, and `platform.zetesislabs.com/decision-engineering`.
- Hidden instructor app at `instructor.platform.zetesislabs.com` once that deep hostname has an edge certificate.
- Temporary hidden instructor fallback at `platform.zetesislabs.com/instructor`.
- Email-agnostic registration and login with D1-backed sessions.
- Class-code registration:
  - `ZetesisColumbia@2026` creates a student membership.
  - `ZeteticAdmin@8917` creates an admin membership.
- PBKDF2-SHA256 password hashes with per-user salt and Worker secret pepper.
- HMAC-hashed class codes in D1; plaintext codes live only in secrets/config.
- D1-backed workspace drafts, prompt/output traces, usage ledger, and report versions.
- OpenAI calls from the Worker only. The browser never receives an API key.
- `$10` lifetime model budget per student membership by default.
- Worker-generated structured PDFs stored in Cloudflare D1 today, with an R2 path ready once R2 is enabled on the account.
- Instructor dashboard for current drafts, raw prompts, saved versions, model-access controls, usage reset, and class PDF ZIP export.

## Cloudflare Resources

The Worker uses:

- D1 binding `STUDIO_DB`
- Optional R2 binding `STUDIO_ARTIFACTS` once R2 is enabled
- Worker secrets:
  - `OPENAI_API_KEY`
  - `PASSWORD_PEPPER`
  - `SESSION_TOKEN_PEPPER`
  - `CLASS_CODE_PEPPER`
  - `STUDENT_CLASS_CODE`
  - `ADMIN_CLASS_CODE`

The current Cloudflare account returns R2 error `10042` until R2 is enabled in the dashboard. The Worker therefore deploys without the binding and stores PDF bytes in D1 through `report_artifacts`. After R2 is enabled, create the bucket and re-add this binding to `wrangler.toml`:

```sh
npx wrangler r2 bucket create zetesis-decision-studio-artifacts
```

Apply D1 migrations:

```sh
npx wrangler d1 migrations apply zetesis_decision_manifold_studio --remote
```

Deploy:

```sh
npx wrangler deploy
```

## Local Development

Run local migrations:

```sh
npm run migrate:local
```

Run the Worker:

```sh
npx wrangler dev --local --port 8787 \
  --var AGENT_API_MODE:fixture \
  --var PASSWORD_PEPPER:local-password-pepper \
  --var SESSION_TOKEN_PEPPER:local-session-pepper \
  --var CLASS_CODE_PEPPER:local-class-code-pepper \
  --var STUDENT_CLASS_CODE:ZetesisColumbia@2026 \
  --var ADMIN_CLASS_CODE:ZeteticAdmin@8917 \
  --show-interactive-dev-session=false
```

Open:

- Student app: `http://localhost:8787/studio`
- Student app alternate route: `http://localhost:8787/decision-engineering`
- Instructor API is available locally under `/api/instructor/*`; production UI is on the instructor subdomain.

## Current Cloudflare Notes

- R2 is not enabled on the account yet, so saved PDFs use D1 artifact storage. Enable R2 in the Cloudflare dashboard, create the bucket, and restore the `STUDIO_ARTIFACTS` binding when ready.
- `instructor.platform.zetesislabs.com` resolves through Cloudflare DNS, but HTTPS needs an edge certificate covering `*.platform.zetesislabs.com`. Until that certificate is active, use the hidden fallback `https://platform.zetesislabs.com/instructor`.

## Tests

Offline source-oracle workflow:

```sh
npm run test:offline
```

This covers:

- account registration/login/logout
- bad class code rejection
- admin registration
- prompt-source oracle behavior
- abuse rejection with the guarded message
- report preview and PDF bytes
- immutable saved report versions
- PDF artifact download through the same endpoint, backed by D1 locally/remotely and R2 when bound
- instructor student cards, prompt history, and saved versions
- instructor model-access block while draft/PDF access remains available

Legacy ReportLab smoke test remains available for the old Python renderer:

```sh
npm run test:pdf
```

The production source of record is now Worker-generated PDF bytes. Current deployment stores them in D1; new saved versions will use R2 automatically after the account enables R2 and the `STUDIO_ARTIFACTS` binding is restored.
