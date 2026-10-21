# Cold Call Guide — Caller Workstation

A desktop-first cold-call workspace designed to stay open beside a dialer during prospect calls. It guides callers through eight stages, captures the prospect's words and the caller's notes, records the outcome, and keeps a history of completed calls.

Use fictional/demo records only. The public demo has no login or user access controls.

## Live Deployment

| Component | Technology | URL / Status |
|---|---|---|
| Frontend | React + Vite on Vercel | https://cold-call-alpha.vercel.app/ |
| Backend API | FastAPI on Render | https://cold-call-4azw.onrender.com |
| Backend health check | FastAPI | https://cold-call-4azw.onrender.com/health |
| Database | Supabase PostgreSQL | Configured for the deployed backend |
| Source repository | GitHub | https://github.com/bhasvitak/Cold-Call |

The health endpoint currently returns `{"status":"ok"}`. The frontend and backend have been deployed, and a test call was saved to Supabase.

## What the App Does

- Guides the caller through eight stages in order: Opening, Purpose, Permission, Their business, Their need (in their words), Objection, Next step, and Close.
- Shows a short purpose reminder and prospect-response examples for the active stage.
- Records the selected stage event, prospect words, and notes.
- Allows a call to end early from any stage.
- Saves the final outcome and last stage reached.
- Displays past calls and their saved details.
- Generates an optional evidence-bound post-call summary using Google Gemini. AI is best-effort and must not block call saving or closing.

## The Eight Stages

| Stage | Name | Purpose |
|---:|---|---|
| 1 | Opening | Reach the right person and introduce the reason for the call. |
| 2 | Purpose | Explain briefly why the caller is contacting the prospect. |
| 3 | Permission | Establish whether the prospect can talk now or prefers another time. |
| 4 | Their business | Learn about the prospect's company and operations. |
| 5 | Their need, in their words | Capture the prospect's stated goals, needs, or challenges. |
| 6 | Objection | Record and understand the reason for hesitation or refusal. |
| 7 | Next step | Record a concrete agreed follow-up, if any. |
| 8 | Close | Confirm the outcome and finish the call clearly. |

## LLM Used and Why

**LLM provider:** Google Gemini, called from the FastAPI backend through Google's `google-genai` Python SDK.

**What it is used for:** After a call closes, Gemini helps select which captured evidence is most relevant to a concise CRM summary. The application formats the displayed summary from the saved evidence, final outcome, and agreed next step; the model is not asked to invent prospect statements or follow-up commitments.

**Why this use case:** Callers need to move quickly between calls and may not have time to write a detailed CRM note. An evidence-bound summary reduces manual note-writing while keeping the record grounded in what was captured.

**Failure handling:** The AI feature is optional. If the API key is missing, the provider request fails, or the response cannot be validated, call closing and call history should remain usable. The API key is stored only in the Render backend environment and must never be placed in frontend variables or committed to Git.

The configured model is read from `GEMINI_MODEL` (the current default in the backend is `gemini-3.8-flash`). A live summary has been observed in the deployed app.

## Architecture

- **Frontend:** React 19 and Vite, deployed on Vercel.
- **Backend:** Python and FastAPI, deployed on Render using Docker.
- **Database:** Supabase PostgreSQL accessed from the backend using the Supabase client.
- **LLM:** Google Gemini through `google-genai`, called server-side after call closure.

## Database Schema

The schema is in [`database/schema.sql`](database/schema.sql). Apply it in the Supabase SQL Editor.

It defines:

- `calls`: prospect/company labels, current and last stage, status, outcome, agreed next step, latest note, timestamps, and optional AI summary.
- `stage_results`: stage number, selected event, prospect words, notes, call reference, and creation time.
- Database functions for saving stage results and closing calls atomically.

## FastAPI Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Health check for deployment verification |
| `POST` | `/calls` | Start a call record |
| `POST` | `/calls/{id}/stages` | Save a stage result |
| `POST` | `/calls/{id}/close` | Save final-stage data and close a call |
| `GET` | `/calls` | List calls for the history screen |
| `GET` | `/calls/{id}` | Retrieve a call and its stage results |

Interactive API documentation is available at `https://cold-call-4azw.onrender.com/docs`.

## Environment Variables

### Render backend

Set these in the Render service's Environment settings:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-side Supabase key; keep private |
| `GEMINI_API_KEY` | Optional Google Gemini API key |
| `GEMINI_MODEL` | Gemini model name |
| `ALLOWED_ORIGINS` | Comma-separated allowed browser origins; include `https://cold-call-alpha.vercel.app` |
| `PORT` | Supplied by Render; do not hardcode it in production settings |

### Vercel frontend

Set these for the frontend project:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://cold-call-4azw.onrender.com` |
| `VITE_DEMO_MODE` | `false` |

Never put Supabase or Gemini secret keys in Vercel `VITE_*` variables. All `VITE_*` values are public in the browser bundle.

## Local Setup

Prerequisites: Node.js, pnpm, Python, and a Supabase project for persistent mode.

### 1. Install frontend dependencies

From the repository root:

```bash
pnpm install --frozen-lockfile
```

### 2. Configure and install the backend

Create a virtual environment and install dependencies:

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` with your own Supabase credentials. Do not commit this file.

### 3. Apply the database schema

In Supabase, open **SQL Editor**, create a new query, paste the contents of `database/schema.sql`, and run it.

### 4. Start the backend

From the repository root, run:

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Verify the health endpoint at `http://127.0.0.1:8000/health`.

### 5. Configure and start the frontend

Create `frontend/.env.local` using `frontend/.env.example` as a reference. For local development, leave `VITE_API_BASE_URL` blank to use the Vite development proxy and set `VITE_DEMO_MODE=false`.

From the repository root:

```bash
pnpm dev:frontend
```

Open `http://localhost:3000`.

## Tests and Build

From the repository root:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
pnpm --dir frontend build
```

## Security and Privacy Notes

- The public demo has no authentication or user access controls. Use fictional/demo records only.
- Keep `backend/.env` and all real API keys out of GitHub.
- If a key has been exposed, revoke or rotate it in the provider dashboard.
- Do not publish private source transcripts, direct quotes, transcript IDs, names, contact details, or per-call analysis. Public materials should contain only authorized, non-identifying examples and high-level patterns.
- Confirm the repository's sharing permissions and authorization before making private source material public.
