# Cold Call Guide — approved implementation plan

**Status: approved by the user on 19 October 2026.** The user approved this implementation direction, and work is proceeding against it.

## Evidence and scope

The supplied transcript archive and matching index have been reviewed privately. Only the generalized, non-identifying paraphrases required for the app's stage prompts may be used in its public code. Do not publish raw transcripts, transcript IDs, names, contact details, per-call outputs, counts, or other transcript-derived results. The source archive and detailed analysis remain outside the public repository.

The live guide uses the eight official stages in order: Opening, Purpose, Permission, Their business, Their need, in their words, Objection, Next step, and Close. A call can end at any stage. Stage 5 has a dedicated, prominent exact-words field, but the call is not forced to reach it. Each stage shows its purpose and three short, realistic examples drawn from recurring response patterns. Examples are paraphrased, non-identifying, and not quotations. The original archive, individual transcripts, transcript IDs, contact details, and secrets stay out of the repository and app assets.

The plan follows the [official course structure](https://sainikpuri.deepthought.education/fde-hyderabad-v2/structure) and [reference-screen concept](https://sainikpuri.deepthought.education/fde-hyderabad-v2/reference).

## Product and architecture

The application uses exactly the requested stack: React + Vite on Vercel, Python + FastAPI on Render, and Supabase PostgreSQL for persistence. The backend uses the official `supabase-py` Data API client with a server-only `SUPABASE_SECRET_KEY`; optional post-call AI uses Google’s current `google-genai` SDK. The frontend and backend are separate deployable folders in the same repository. Local Vite preview runs on the initialized project’s configured port, 3000, and uses a development proxy to FastAPI on port 8000.

The Live Call Guide presents one stage at a time with an eight-stage progress rail, stage purpose, three evidence-based response examples, stage-specific event buttons, a notes field, and a separate field for prospect exact words. Previous/next navigation lets the caller revisit stages. A visible **End Call** action is available at every stage. The close request saves the current/last stage—even when the stage has no text—together with the selected final outcome, agreed next step, notes, and exact words, while retaining all previously captured stage results. Retrying the same latest snapshot does not duplicate it.

The Call History screen lists prior calls with prospect/company labels, final outcome, last stage reached, latest note or AI summary, and timestamp. Selecting a call shows its saved stage results and exact words. History and call data persist after refresh.

Supabase uses two tables. `calls` stores the UUID, optional prospect/company labels, current/last stage, `in_progress` or `completed` status, final outcome, agreed next step, latest note, start/end timestamps, created/updated timestamps, and optional AI summary. `stage_results` stores a UUID, `call_id` reference, stage number, selected event, exact prospect words, notes, optional close idempotency key, and creation timestamp. Repeated saves append records rather than silently replacing earlier stage results. PostgreSQL RPC functions save stage results and update parent calls in one transaction; close requests use a UUID idempotency key so unchanged retries replay safely and changed reuse conflicts.

FastAPI implements `GET /health`, `POST /calls`, `POST /calls/{id}/stages`, `POST /calls/{id}/close`, `GET /calls`, and `GET /calls/{id}`. The additional `GET /calls/{id}` response includes the call and its stage results. UUID route validation, useful HTTP errors, atomic stage/close persistence, and retry-safe close keys are implemented without allowing optional AI failure to block saving or history.

The optional post-call assistant uses only captured stage results, the prospect’s own recorded words, the final outcome, and an agreed next step. Gemini returns structured evidence IDs constrained by a per-request allowlist; FastAPI validates them and formats a short summary and next-step line from the original saved values rather than displaying model-generated prose. A suggested follow-up is only the caller-entered agreement; otherwise the summary says none was recorded. Requests use Gemini’s stateless mode (`store=False`), and `do_not_call` calls skip Gemini entirely. The assistant does not control stage navigation, reframe a refusal as interest, invent a meeting, or ignore a do-not-call result. Gemini credentials are server-side Render environment variables only. If the key is absent, invalid, or over quota, core call saving and history still work. The request shape is tested locally with a fake client; there is no live provider verification until a key is configured.

The assignment does not specify login or multi-user access. The deliverable is therefore a public educational demo and uses fictional/demo call records only. It must not be used to store real prospect details until authentication and access controls are added. Supabase’s server secret key is never sent to the browser; RLS is enabled and direct browser-role access is revoked.

## Project structure

```text
frontend/
  index.html                  App metadata and Vite entry point
  package.json                React/Vite scripts and dependencies
  vite.config.js               Port 3000 and local FastAPI proxy
  vercel.json                  SPA history-route rewrite
  .env.example                 Public frontend settings only
  public/manus-routes.json     Preview route declarations
  public/callguide-mark.svg    Reusable app and platform mark
  src/
    main.jsx                  Live guide, stage data, API calls, history screens
    styles.css                Responsive caller-interface design
backend/
  __init__.py                 Backend package marker
  main.py                     FastAPI routes and application setup
  database.py                 Supabase connection and persistence helpers
  models.py                   Request/response validation models
  ai_service.py               Optional allowlisted evidence selector and deterministic summary
  requirements.txt            Python dependencies
  Dockerfile                  Render container setup
  .env.example                 Server-side variable names and placeholders
  tests/
    __init__.py                Test package marker
    test_api.py                API workflow tests
    test_ai_service.py         AI privacy and outcome-safety tests
database/
  schema.sql                  Calls and stage_results tables/indexes/access rules
docs/
  official-stack-references.md Official setup/security references
  design-rationale.md         Public rationale without transcript data
  step-by-step-guide.md       Local setup, accounts, deploy, demo, and submission
README.md                     Setup, SQL schema reference, service URLs, and LLM role
TODO.md                       Outcome tracker
app.config.ts                 Platform project logo metadata
package.json                  Pinned pnpm version and workspace scripts
pnpm-workspace.yaml           Frontend workspace/lifecycle policy
pyrightconfig.json            Python import resolution for diagnostics
.gitignore                    Secrets, local data, and transcript/archive exclusions
```

The public repository contains source, SQL schema, official stack references, and privacy-safe product rationale. Under the course-owner authorization, the app may include only non-identifying paraphrases and high-level patterns; it must not contain direct transcript quotes, IDs, names, contact details, counts, per-call details, transcript files, `.env` files, or API keys. The private source archive and detailed analysis remain outside the repository. Public sharing happens only after a source review for these exclusions.

## Design direction

The reference specifies a clean, desktop-first call workspace but not a detailed visual style. Three low-probability directions considered are a calm editorial operations console (0.08), a warm paper-ledger notebook (0.05), and a high-impact neo-brutalist control room (0.03). The selected direction is the **calm editorial operations console** because it best supports a caller who needs to scan and act while listening.

- **Design movement:** Swiss-inspired information design applied to a modern call-operations workspace.
- **Core principles:** glanceable stage context; capture what was said separately from interpretation; low cognitive load; respectful, non-pushy outcomes.
- **Color philosophy:** warm off-white surfaces and charcoal text reduce glare; deep teal marks the active stage and primary save action; amber is reserved for pending callbacks; red is reserved for refusal or do-not-call states.
- **Layout paradigm:** a persistent narrow stage rail beside one main work surface; the current stage, examples, outcome controls, exact-words capture, and notes remain in a clear vertical flow; navigation and End Call remain anchored and visible.
- **Signature elements:** a numbered progress rail with a clear active marker; compact paraphrased prospect-response cards; a distinct “Prospect’s exact words” capture panel.
- **Interaction philosophy:** save and navigate with explicit controls; preserve the current stage when a call ends early; keep outcomes human-selected; make previous stages revisitable without losing saved results.
- **Animation:** restrained 120–180 ms transitions for stage changes and save confirmation; no decorative movement; honor reduced-motion settings.
- **Typography:** Inter/system sans-serif for interface text, with a restrained monospace face for small stage numbers and timestamps; use readable sizes and line lengths at laptop width.
- **Brand essence:** a practical caller companion that helps teams listen, record what matters, and close clearly; **calm, precise, respectful**.
- **Brand voice:** short, factual prompts. Example lines: “Capture the prospect’s words, not your guess.” “End the call here; the stage reached is still saved.”
- **Wordmark and mark:** “Cold Call Guide” with a small original compass/step-marker SVG used in the interface and platform metadata.
- **Signature brand color:** deep teal `#0D6F71`.

No decorative hero images are planned: this is an internal-use-style workflow interface, and the assignment asks for clarity rather than illustration.

## Build and handoff sequence

The user approved this plan. Work starts with the complete `TODO.md` outcome list, then project setup and implementation. The official setup documentation for the named technologies has been reviewed. The Supabase schema and FastAPI API form the data layer; the React/Vite screens use that API; optional Gemini generation is added only as a best-effort post-close task. The README and step-by-step guide cover local setup, environment-variable placement, SQL setup, deployment instructions, and the API/LLM responsibilities.

For deployment, code remains free of source transcripts and secrets. Account steps are guided when needed: connect GitHub, create/use the Supabase project, set Render environment variables and deploy FastAPI, then point the Vercel frontend at the Render API. The health URL and end-to-end persistence are checked before confirmed live URLs are recorded in the README. Public materials contain only the course-owner-authorized non-identifying paraphrases and high-level patterns; direct quotes, IDs, names, contact details, counts, per-call details, source files, and credentials are excluded.

The final user guide walks through the required demo scenarios, including ending from Opening, saving a call that reaches Next Step, and recording a wrong-person outcome. It also covers the six-minute-plus camera-visible walkthrough, Google Drive “Anyone with the link” access, signed-out link checks, and the final submission-form and CEO WhatsApp steps. The user performs the camera-visible recording, upload, and submission; the guide explains each step and does not submit or message on the user’s behalf without a separate explicit go-ahead.
