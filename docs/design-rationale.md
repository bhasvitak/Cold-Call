# Design rationale

The call guide follows the assignment’s eight-stage workflow and keeps caller interpretation separate from the prospect’s own words. The course owner authorized only non-identifying paraphrases and high-level patterns in public materials. The app uses short, generalized response-pattern prompts only; it includes no direct transcript quotes, transcript IDs, names, contact details, counts, or per-call details.

The interface presents one stage at a time so a caller can scan it while listening. The stage rail remains visible, but the caller can end early; ending at Opening or another incomplete stage is still a valid record. The exact-words field is separate from stage events and final outcomes so the caller can preserve the conversation without converting a refusal, callback, or ambiguous result into a positive label. A dedicated Next Step field captures the concrete agreement, if one exists.

Stage saves and call closure run as PostgreSQL functions so the stage result and parent call are updated in one transaction. Call closure uses a per-request UUID idempotency key: an unchanged retry replays safely, while a reused key with changed data is rejected. The history view keeps the final outcome, last stage, latest note, timestamp, and saved stage details together.

The optional post-call summary is grounded only in captured fields and cannot control the workflow: Gemini may select only allowlisted evidence IDs, while FastAPI formats the summary and follow-up line from saved values. It is best-effort, uses stateless requests, and bypasses the provider for do-not-call outcomes. The API has no login or per-user data boundary; use fictional/demo records only until authentication and access controls are added.

Detailed transcript text, the source archive, and per-call analysis remain private and outside this repository. Do not add direct quotes, transcript IDs, names, contact details, counts, per-call classifications, or source files to public materials.
