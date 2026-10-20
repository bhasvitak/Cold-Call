# Cold Call Guide — Caller Workstation

A desktop-first cold-call screen kept open beside the dialer during live prospect calls. Built to guide callers through the exact 8-stage cold call structure, grounded in 100 real transcripts of calls to Indian enterprise leaders by Meridian Growth Partners.

Live free-tier architecture: **Vercel** (Frontend) + **Render** (FastAPI Backend) + **Supabase** (PostgreSQL Data API) + **Google Gemini** (Server-side LLM).

---

## Live Service URLs & Deployment

| Service | Target Platform | Status / Live URL |
| --- | --- | --- |
| **Frontend Surface** | Vercel (Free Tier) | Pending deployment |
| **Backend API Health** | Render (Free Tier) | Pending deployment |
| **PostgreSQL Database** | Supabase (Free Tier) | Apply `database/schema.sql` |
| **Public GitHub Repo** | GitHub | Public repository |

---

## What It Shows on Screen

Designed from [the structure of a cold call](https://sainikpuri.deepthought.education/fde-hyderabad-v2/structure) and [the reference screen](https://sainikpuri.deepthought.education/fde-hyderabad-v2/reference):

1. **Active Stage & Purpose**: Shows which stage the caller is in (Stages 1 through 8) and a 1-sentence reminder of what that stage is for.
2. **"They may say"**: Three realistic prospect response quotes per stage, drawn directly from the 100 real transcripts.
3. **"What happened"**: 4 quick-tap buttons in a 2x2 grid representing the most frequent real-world paths at that stage. Clicking one immediately records the event without typing.
4. **"Their words"**: **The only free-text box on the screen**. Captures the prospect's exact words.
5. **AI Live Stage Suggestion**: While typing in "Their words", the caller can tap **"✨ AI Stage Suggest"** (or receive real-time detection) to identify when a prospect suddenly raises an objection, gives a callback time, or agrees to a meeting, allowing a 1-click jump to the right stage.
6. **Next Stage & Early End**: A prominent `Next: [Stage Name] →` button and an `End call` button accessible from every single stage (since most cold calls end early).
7. **Second Screen: Past Calls**: A clean archive matching the reference screen layout, showing each prospect, company, stage reached, timestamp, and the AI-drafted one-line summary.

---

## The 8 Stages Grounded in the 100 Transcripts

| Stage | Name | Purpose | What Happened (4 Taps) |
|---|---|---|---|
| **1** | **Opening** | Reach the right person and say who you are. The prospect decides in the first ten seconds whether this call is worth a minute. | `Reached right person`, `Reception / Assistant`, `Busy / In a meeting`, `Wrong number / Left company` |
| **2** | **Purpose** | Say why you called in one or two sentences the prospect can repeat to a colleague. | `Asked what company does`, `Asked where number came from`, `Guessed it is a sales call`, `Allowed caller to continue` |
| **3** | **Permission** | Find out whether they are willing to talk now: clear yes, callback, or end. | `Agreed to talk now`, `Requested callback time`, `Asked for WhatsApp first`, `Declined to continue` |
| **4** | **Their business** | Ask about their company and operations before describing yours. | `Shared operations & capacity`, `Corrected company scope`, `Asked caller to pitch first`, `Guarded / Refused details` |
| **5** | **Their need, in their words** | Hear what they are trying to do or struggling with, in their own words. | `Stated growth / revenue goal`, `Stated capacity / margin bottleneck`, `Said everything is fine / no need`, `Uncertain / Exploring options` |
| **6** | **Objection** | Hear the reason for a no and understand it without talking over them. | `Already has agency / consultant`, `Referred to MD / other person`, `Requested written info first`, `Flat refusal / Not interested` |
| **7** | **Next step** | Agree one concrete thing: WhatsApp document, callback time, or meeting with founder. | `Agreed to Google Meet with founder`, `Agreed to report on WhatsApp`, `Named specific callback time`, `Referred to colleague with contact` |
| **8** | **Close** | End the call clearly and record the outcome, next step, and prospect's words. | `Confirmed next step & closed warmly`, `Polite close after refusal`, `Call dropped / Abrupt hangup`, `Requested do not call` |

---

## The LLM in It: Why We Chose This & What It Does

The backend calls **Google Gemini** (via `google-genai` / Google AI Studio free key) from Render. The API key is kept strictly on the backend.

### The Problem It Solves
On a live, fast-moving cold call (averaging 60–90 seconds):
1. **Mid-Call Stage Detection**: Prospects often jump ahead (e.g. at Stage 2 Purpose, a prospect says: *"We already have an agency in Mumbai handling this, please don't call again"*). The caller types their words and taps **"✨ AI Stage Suggest"**. The LLM immediately detects Stage 6 (Objection: Already has agency) and provides a 1-click `[Jump to Stage 6 →]` button. The caller never loses structure.
2. **Post-Call 1-Line CRM Summary**: Cold callers must maintain momentum (dialing 50–80 leads a day). They cannot spend 3 minutes typing CRM notes after every call. Upon call close, the LLM analyzes the prospect's recorded words, stages visited, and agreed next steps to draft a crisp, factual 1-line CRM summary (e.g.: *"Kalpana Chem: Dev Sharma confirmed plant capacity at 60%. Agreed to Google Meet next Tuesday after 2 PM with Vikram."*).

---

## FastAPI Backend Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Health check (`{"status": "ok"}`) for Render liveness |
| `POST` | `/calls` | Start a call record |
| `POST` | `/calls/{id}/stages` | Append-only stage save (atomic transaction) |
| `POST` | `/calls/{id}/close` | Save final stage snapshot, outcome, next step, and close |
| `GET` | `/calls` | List past calls for History screen |
| `GET` | `/calls/{id}` | Retrieve complete call details and all visited stages |
| `POST` | `/calls/{id}/summary` | Generate / regenerate 1-line AI summary |
| `POST` | `/ai/suggest-stage` | Classify prospect words into stage (1–8) and event |

---

## Database Schema (`database/schema.sql`)

PostgreSQL tables running on Supabase with Row Level Security (RLS) enabled:
- `calls`: `id` (UUID), `prospect_name`, `company_name`, `current_stage`, `last_stage`, `status` (`in_progress` / `completed`), `outcome` (10 transcript enum values), `agreed_next_step`, `latest_note`, `started_at`, `ended_at`, `ai_summary`.
- `stage_results`: `id`, `call_id` (FK), `stage_number` (1–8), `event`, `prospect_words`, `notes`, `idempotency_key`, `created_at`.
- Stored procedures: `save_call_stage_atomic` and `close_call_atomic` guarantee that parent call state and stage snapshots are updated in a single transaction.

---

## Local Setup

### 1. Backend
```bash
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt
# Copy environment template
cp backend/.env.example backend/.env
# Run FastAPI on port 8000
backend/.venv/Scripts/uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

### 3. Tests
```bash
backend/.venv/Scripts/pytest backend/tests
npm run build --prefix frontend
```

---

## 6-Minute Video Walkthrough Guide (For Candidate)

When recording your 6-minute unscripted video with your camera on:
1. **Show the screen beside you**: Explain that this is the caller's workstation, designed to be kept open during live calls for Meridian Growth Partners.
2. **Select a real transcript**: Click sample chip **T001 (Dev Sharma, Kalpana Chem Supplies)** or **T010 (Vinod Nair, ChromaChem India)**.
3. **Walk through the stages**:
   - Stage 1 Opening: Highlight the live timer ticking, prospect details, and tap `Reached right person`.
   - Stage 2 Purpose: Show "They may say" quotes. Type what the prospect said into "Their words".
   - Demonstrate the LLM: Click **"✨ AI Stage Suggest"** to show how the model classifies the objection/next step and allows 1-click stage jumping.
   - Stage 7 Next step: Tap `Agreed to Google Meet with founder`.
   - End Call: Open modal, confirm outcome (`next_step_agreed`), enter `Google Meet next Tuesday after 2 PM with Vikram`, and save.
4. **Show the Post-Call Summary**: Point to the AI 1-line CRM summary generated automatically.
5. **Open Second Screen (Past Calls)**: Show how completed calls appear in the archive with stage reached and timestamp, matching Reading 2.
6. **Explain your decision and what you left out**: Explain why the LLM was given this specific role (cognitive offloading + CRM speed) and why you left out complex CRM forms during the call to keep the caller focused on listening.
