# Official stack setup references

Research captured 19 October 2026 from the official documentation links below. This is implementation guidance for the approved Cold Call Guide stack, not account setup or authorization.

## React and Vite

Use the React Vite template and Vite's development/build commands. Vite's production output is `dist`; `vite preview` is for local inspection, not production serving. The official current Vite guide lists Node.js 20.19+ or 22.12+ (a generated template may require more). The Vercel project should use `frontend/` as its Root Directory. A client-side SPA may need a Vercel rewrite to `/index.html` for deep links. Use `VITE_API_BASE_URL` only as a public API address; any `VITE_*` value used by browser code is exposed in the bundle, not a secret.

Sources: [React: Build a React app from Scratch](https://react.dev/learn/build-a-react-app-from-scratch), [Vite: Getting Started](https://vite.dev/guide/), [Vite: Static Site Deployment](https://vite.dev/guide/static-deploy), [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode), [Vercel: Vite](https://vercel.com/docs/frameworks/frontend/vite), [Vercel: Monorepos](https://vercel.com/docs/monorepos).

## FastAPI on Render

Use Pydantic models for request bodies and a production ASGI server command rather than `fastapi dev`. Render's FastAPI example uses `pip install -r requirements.txt` and `uvicorn main:app --host 0.0.0.0 --port $PORT`. The service must bind to `0.0.0.0`, read Render's `PORT`, and expose a lightweight `/health` endpoint; Render's HTTP health check accepts 2xx/3xx responses within five seconds. Store runtime credentials in Render service environment settings, not the repository or Docker build context.

Sources: [FastAPI: First Steps](https://fastapi.tiangolo.com/tutorial/first-steps/), [FastAPI: Request Body](https://fastapi.tiangolo.com/tutorial/body/), [FastAPI: Settings and Environment Variables](https://fastapi.tiangolo.com/advanced/settings/), [Render: Deploy a FastAPI App](https://render.com/docs/deploy-fastapi), [Render: Web Services](https://render.com/docs/web-services), [Render: Health Checks](https://render.com/docs/health-checks), [Render: Environment Variables and Secrets](https://render.com/docs/configure-environment-variables).

## Supabase PostgreSQL

The `supabase-py` Python client uses Supabase's Data API for table operations; SQL schema, exposed objects, grants, and row-level security must be configured. Supabase's current key guidance is to use publishable/secret keys for new integrations; legacy `anon`/`service_role` keys are documented as deprecated by the end of 2026. A `sb_secret_...` key belongs only in trusted server code and maps to the elevated service role, which bypasses RLS. The approved no-login educational demo must use fictional records only. Do not use it for real prospect data without authentication, authorization, and row-level access rules.

Sources: [Supabase: Python Client Initialization](https://supabase.com/docs/reference/python/initializing), [Supabase: API Keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase: Securing Your API](https://supabase.com/docs/guides/api/securing-your-api), [Supabase: Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations).

## Vercel frontend deployment

Connect the repository to Vercel and set the project's Root Directory to `frontend/`. Verify the detected Vite build settings rather than assuming universal defaults. Environment-variable changes affect new deployments, so redeploy after changing them. Keep API paths separate from any SPA fallback. A Vercel external rewrite can proxy API requests, but the approved first implementation uses a configurable frontend API base URL and Render CORS configuration.

Sources: [Vercel: Vite](https://vercel.com/docs/frameworks/frontend/vite), [Vercel: Monorepos](https://vercel.com/docs/monorepos), [Vercel: Configuring a Build](https://vercel.com/docs/builds/configure-a-build), [Vercel: Environment Variables](https://vercel.com/docs/environment-variables), [Vercel: Rewrites](https://vercel.com/docs/routing/rewrites).

## Optional Gemini post-call assistant

Use Google's current recommended `google-genai` Python SDK from FastAPI only. The official Interactions API guide recommends this API for new projects and shows `client.interactions.create(model=..., input=...)`; the project pins `google-genai==2.31.0`, which is above Google's documented 2.3.0 minimum for Interactions. Google currently lists the model identifier `gemini-3.8-flash` and recommends it for new projects. Interactions are stored by default, so set `store=False` when sending captured evidence and call context. The official structured-output guide documents `response_format` with `type="text"`, `mime_type="application/json"`, and a JSON Schema in `schema`; use an enum allowlist for evidence IDs, reject additional properties, validate every returned ID, and build displayed prose deterministically on the server. Keep `GEMINI_API_KEY` in Render's server-side secret configuration. Google documents free-tier access and quotas as model- and project-specific and subject to change; verify the selected model, quota, and pricing before relying on availability. The request format and output validation are tested locally with a fake client, but no live provider call is verified until a user supplies a key. If the provider is unavailable, call save and history paths must remain successful.

Sources: [Gemini API: Models](https://ai.google.dev/gemini-api/docs/models), [Gemini API: Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview), [Gemini API: Structured Output](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini API: Libraries](https://ai.google.dev/gemini-api/docs/libraries), [Gemini API: Quickstart](https://ai.google.dev/gemini-api/docs/quickstart), [Gemini API: API Keys](https://ai.google.dev/gemini-api/docs/api-key), [Gemini API: Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Gemini API: Billing](https://ai.google.dev/gemini-api/docs/billing).

## Planned environment-variable placement

`VITE_API_BASE_URL` is a public Vercel frontend setting and must not contain a credential. `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` (optional), and `ALLOWED_ORIGINS` belong in the Render backend environment. Render supplies `PORT`; the backend must read it. `.env.example` will show names and placeholder values only. No secret values belong in the repository or chat.
