# Step-by-step setup, deployment, demo, and submission guide

This is the hands-on guide for completing the project. The current project source is in the Manus workspace; live service URLs and account connections are not set up yet. The uploaded assignment does not include the submission-form URL or the CEO WhatsApp contact/QR, so use the exact details supplied by your course rather than guessing them.

## Important privacy rule

The source archive and detailed analysis remain private. The course owner explicitly authorized only non-identifying paraphrases and high-level patterns in public materials. Keep the ZIP, extracted transcripts, transcript IDs, exact quotations, names/contact details, counts, and per-call analysis out of GitHub, Vercel assets, screenshots, and the public video. The app’s stage prompts must stay within that limited authorization. The project has no login, so use fictional/demo records only; do not enter real prospect details.

## Part 1 — Run the app locally

### 1. Install prerequisites

Install Node.js 22.12 or later, pnpm 11.25.0, and Python 3.12. Create or open a terminal in the repository root. If you clone from GitHub later, use the repository’s actual URL:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL> cold-call-guide
cd cold-call-guide
```

Install the pinned frontend dependencies and create a Python environment:

```bash
pnpm install --frozen-lockfile
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

### 2. Create Supabase storage

1. Create a Supabase project in your own account.
2. Open the Supabase SQL Editor and run the repository’s `database/schema.sql` file.
3. Verify that `calls` and `stage_results` exist and row-level security is enabled.
4. In the Supabase API settings, copy the project URL and the server-side secret key. Do not use or expose the secret key in frontend code.
5. Copy `backend/.env.example` to `backend/.env`; enter the project URL and secret key locally. Leave `GEMINI_API_KEY` blank if you are not enabling the optional AI feature. Keep the `.env` file out of Git.

### 3. Start FastAPI

From the repository root, export the local backend variables and start the API:

```bash
set -a
source backend/.env
set +a
backend/.venv/bin/uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Keep this terminal running. In another terminal, verify health:

```bash
curl -i http://127.0.0.1:8000/health
```

The health endpoint should return a successful HTTP response. A healthy API does not prove that Supabase is configured; verify by creating and retrieving a fictional call.

### 4. Start React/Vite

In another terminal at the repository root:

```bash
cp frontend/.env.example frontend/.env.local
```

For database-backed local use, keep `VITE_API_BASE_URL` blank and set `VITE_DEMO_MODE=false`; the Vite proxy sends `/api/*` to FastAPI. Start the frontend:

```bash
pnpm dev:frontend
```

Open `http://localhost:3000`. Confirm that the route declaration is served as JSON:

```bash
curl -i http://localhost:3000/manus-routes.json
```

For a UI-only walkthrough without a Supabase project, set `VITE_DEMO_MODE=true` in `frontend/.env.local` and restart Vite. That mode uses browser local storage, carries a visible demo-only indicator, and does not validate API/database persistence.

### 5. Exercise the call flow

Use only fictional labels. Try all of the following:

1. **End at Opening:** start a call with a fictional prospect, record a short note or mark the person as the wrong contact, choose a final outcome, and end immediately. Open Call History and confirm the call is saved with Stage 1 as the last stage.
2. **Reach Next Step:** start another fictional call, move through the stages, enter fictional prospect wording in “Their need, in their words,” capture an explicit report/callback/meeting/referral agreement in Next Step, then close it. Check that the final outcome and notes appear in Call History and the detail view.
3. **Wrong person:** start a third call, select the wrong-contact event, preserve a brief fictional note, end the call, and confirm the outcome is not represented as a positive lead.
4. **AI optional:** without `GEMINI_API_KEY`, close a call and confirm saving/history still work. If you added a valid key, verify that the summary appears after close and includes only captured evidence, the recorded outcome, and the exact agreed next step (or “none recorded”). Gemini returns only evidence IDs from a dynamic allowlist; FastAPI formats the summary, not model-generated prose. Requests are stateless; a `do_not_call` outcome bypasses Gemini entirely. The automated tests cover the provider bypass and output validation.

Run the checks from the repository root:

```bash
backend/.venv/bin/python -m pytest backend/tests -q
backend/.venv/bin/python -m compileall -q backend
pnpm --dir frontend build
```

## Part 2 — Prepare and publish the GitHub repository

1. Connect the Manus project to your GitHub account or create the repository through the approved WebDev workflow.
2. Before making the repository public, inspect the complete file list and Git status. Confirm it contains only source code, SQL, public setup documentation, and the generalized app prompts.
3. Confirm the repository does **not** contain the transcript ZIP, extracted transcript files, any transcript IDs or quotations, transcript-derived statistics, per-call analysis outputs, `.env` files, secret keys, `.venv`, `node_modules`, or build output.
4. Confirm `backend/.env.example` and `frontend/.env.example` contain only variable names and harmless placeholders.
5. Make the repository public only after that source review; copy the verified repository URL for the final walkthrough.

The private transcript evidence file in the Manus workspace is not part of the repository and must stay private.

## Part 3 — Deploy FastAPI to Render

1. Sign in to Render and create a new Web Service from the GitHub repository.
2. Set the service root directory to `backend/`. Choose Docker as the runtime and use the `Dockerfile` in that directory (repository path `backend/Dockerfile`). It installs Python dependencies and starts `backend.main:app` using Render’s provided `PORT`; the health path is `/health`.
3. Add the following environment variables in Render’s dashboard, not in Git:
   - `SUPABASE_URL`: the Supabase project URL.
   - `SUPABASE_SECRET_KEY`: the server-side Supabase secret key.
   - `GEMINI_API_KEY`: optional; add only if you are enabling the assistant.
   - `GEMINI_MODEL`: optional; default is `gemini-3.8-flash`.
   - `ALLOWED_ORIGINS`: add the exact Vercel production URL after the frontend is created. You can initially include `http://localhost:3000` for local testing.
4. Create the service and wait for deployment. In the Render dashboard, set the health-check path to `/health` if prompted.
5. Open `https://<your-render-service>.onrender.com/health` and confirm a successful response. Record the exact Render URL; do not copy a Preview URL.

## Part 4 — Deploy React/Vite to Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `frontend/`. Use the pnpm workspace lockfile and the frontend’s Vite build. Expected output directory: `dist`.
3. Add these Vercel environment variables:
   - `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`
   - `VITE_DEMO_MODE=false`
4. Deploy and open the production Vercel URL. Test the `/history` route directly, start a fictional call, save a stage, close the call, and confirm Call History can retrieve it from Supabase.
5. Return to Render and set `ALLOWED_ORIGINS` to the exact Vercel production origin (for example, `https://your-project.vercel.app`, without an extra path). Redeploy/restart the backend and test the live app again.
6. Update the README’s live URL table only with URLs that have been deployed and verified.

Do not put `SUPABASE_SECRET_KEY` or `GEMINI_API_KEY` in Vercel. Every `VITE_*` value is public browser code.

## Part 5 — Record the required walkthrough

The assignment requires a real-software video of **at least six minutes** with your camera visible throughout. Record in your own voice; do not use slides in place of the working app. A sample 6:30 run-of-show:

| Time | What to show |
| --- | --- |
| 0:00–0:40 | Introduce yourself, the problem, and that this is a fictional-data educational demo. |
| 0:40–1:15 | Explain one or two high-level patterns from private analysis, using only non-identifying paraphrases. Do not share direct quotes, transcript IDs, names, contact details, counts, or per-call details. |
| 1:15–2:40 | Start a fictional call, move through stages, capture fictional exact words, record a concrete next step, and close. |
| 2:40–3:20 | Open Call History and show the saved outcome, last stage, note, and timestamp. |
| 3:20–4:10 | Start a second call and end it at Opening; show that early ending is saved. |
| 4:10–4:50 | Record a wrong-person result and explain why it is not treated as a positive lead. |
| 4:50–5:25 | Show the optional AI summary if enabled, or explain that saving works without the model key. |
| 5:25–6:30+ | Explain the stack, one implementation choice, the verified live URLs, and what you would improve next. |

Do not show real prospect data, keys, private analysis files, or the transcript source material on camera. Before recording, confirm the app and `/health` URL are live and signed out.

## Part 6 — Share and submit

1. Upload the video to your Google Drive.
2. Open Share and change General access to **Anyone with the link** (Viewer). Copy the link.
3. Open a private/incognito browser window in which you are not signed in. Test the public GitHub repository, Vercel app, Render `/health` URL, and Drive video link.
4. Submit the verified GitHub repository URL and Drive video URL through the exact course submission form.
5. Complete the CEO WhatsApp step using the exact contact or QR and wording supplied by the course.

The uploaded assignment does not contain the submission-form URL or WhatsApp contact/QR. Do not guess either. If you provide those exact official links later, I can help check the instructions and prepare a final checklist; the account-owner should perform the camera-visible recording, Google Drive sharing, and final external submission.

## If the schedule slips

Prioritize the working call flow, persistent history, deployment, end-to-end checks, and the video. Reduce decorative polish and keep the AI optional/simple rather than cutting the required stages, early-end behavior, data persistence, or submission time.
