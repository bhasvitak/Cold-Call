"""FastAPI application for the fictional-record Cold Call Guide demo."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .ai_service import generate_summary, suggest_stage_from_words
from .database import (
    DatabaseAdapter,
    DatabaseConfigurationError,
    DatabaseRequestError,
    get_database,
)
from .models import (
    Call,
    CallDetail,
    CallStartRequest,
    CallSummaryResponse,
    CloseCallRequest,
    HealthResponse,
    StageResult,
    StageResultRequest,
    StageSuggestionRequest,
    StageSuggestionResponse,
)


def _origins() -> list[str]:
    """Use local defaults or the exact comma-separated production origins."""
    configured = os.getenv("ALLOWED_ORIGINS", "").strip()
    if not configured:
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app = FastAPI(
    title="Cold Call Guide API",
    version="1.0.0",
    description="Backend for a no-login fictional educational call-guide demo.",
)
# Data writes use atomic database functions; /health remains independent of secrets.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def database_dependency() -> DatabaseAdapter:
    try:
        return get_database()
    except DatabaseConfigurationError as exc:
        # Keep this actionable without exposing any environment value.
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _database_error(exc: Exception) -> HTTPException:
    if isinstance(exc, DatabaseRequestError):
        return HTTPException(status_code=503, detail="Database request failed.")
    return HTTPException(status_code=503, detail="Database service is unavailable.")


def _call_or_404(db: DatabaseAdapter, call_id: str) -> dict[str, Any]:
    try:
        record = db.get_call(call_id)
    except Exception as exc:
        raise _database_error(exc) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="Call not found.")
    return record


def _raise_atomic_error(result: dict[str, Any]) -> None:
    error = result.get("error")
    if error == "not_found":
        raise HTTPException(status_code=404, detail="Call not found.")
    if error == "completed":
        raise HTTPException(status_code=409, detail="Completed calls cannot be changed.")
    if error == "idempotency_conflict":
        raise HTTPException(status_code=409, detail="This close key was already used for different call data.")
    if error == "missing_idempotency_key":
        raise HTTPException(status_code=422, detail="A close idempotency key is required.")
    if error:
        raise HTTPException(status_code=503, detail="The database could not complete this operation.")


def _best_effort_summary(
    db: DatabaseAdapter,
    call_id: str,
    agreed_next_step: str | None,
) -> None:
    """Run after close; all AI and persistence failures are intentionally swallowed."""

    try:
        call = db.get_call(call_id)
        if not call or not call.get("outcome"):
            return
        stages = db.list_stage_results(call_id)
        summary = generate_summary(stages, str(call["outcome"]), agreed_next_step)
        if summary:
            db.update_call(
                call_id,
                {"ai_summary": summary, "updated_at": _utc_now().isoformat()},
            )
    except Exception:
        return


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Lightweight health check that never touches the database."""

    return HealthResponse(status="ok")


@app.post("/calls", response_model=Call, status_code=status.HTTP_201_CREATED)
def create_call(
    request: CallStartRequest,
    db: DatabaseAdapter = Depends(database_dependency),
) -> Call:
    now = _utc_now().isoformat()
    values: dict[str, Any] = {
        "id": str(uuid4()),
        "prospect_name": request.prospect_name,
        "company_name": request.company_name,
        "status": "in_progress",
        "current_stage": 1,
        "last_stage": None,
        "outcome": None,
        "agreed_next_step": None,
        "started_at": now,
        "ended_at": None,
        "created_at": now,
        "updated_at": now,
        "ai_summary": None,
        "latest_note": None,
    }
    try:
        return Call.model_validate(db.insert_call(values))
    except Exception as exc:
        raise _database_error(exc) from exc


@app.post(
    "/calls/{call_id}/stages",
    response_model=StageResult,
    status_code=status.HTTP_201_CREATED,
)
def save_stage(
    call_id: UUID,
    request: StageResultRequest,
    db: DatabaseAdapter = Depends(database_dependency),
) -> StageResult:
    call_id_text = str(call_id)
    now = _utc_now().isoformat()
    values: dict[str, Any] = {
        "stage_number": request.stage_number,
        "event": request.event,
        "prospect_words": request.prospect_words,
        "notes": request.notes,
        "created_at": now,
    }
    try:
        result = db.save_stage_atomic(call_id_text, values)
        _raise_atomic_error(result)
        return StageResult.model_validate(result["stage_result"])
    except HTTPException:
        raise
    except Exception as exc:
        raise _database_error(exc) from exc


@app.post("/calls/{call_id}/close", response_model=Call)
def close_call(
    call_id: UUID,
    request: CloseCallRequest,
    background_tasks: BackgroundTasks,
    db: DatabaseAdapter = Depends(database_dependency),
) -> Call:
    call_id_text = str(call_id)
    now = _utc_now().isoformat()
    values: dict[str, Any] = {
        "stage_number": request.stage_number,
        "event": request.event,
        "prospect_words": request.prospect_words,
        "notes": request.notes,
        "outcome": request.outcome,
        "agreed_next_step": request.agreed_next_step,
        "idempotency_key": str(request.idempotency_key),
        "ended_at": now,
        "updated_at": now,
    }
    try:
        result = db.close_call_atomic(call_id_text, values)
        _raise_atomic_error(result)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise _database_error(exc) from exc

    # Replaying the same close is safe and must not schedule duplicate AI work.
    if not result.get("replayed"):
        background_tasks.add_task(_best_effort_summary, db, call_id_text, request.agreed_next_step)
    return Call.model_validate(result["call"])


@app.get("/calls", response_model=list[Call])
def list_calls(db: DatabaseAdapter = Depends(database_dependency)) -> list[Call]:
    try:
        return [Call.model_validate(item) for item in db.list_calls()]
    except Exception as exc:
        raise _database_error(exc) from exc


@app.get("/calls/{call_id}", response_model=CallDetail)
def get_call(call_id: UUID, db: DatabaseAdapter = Depends(database_dependency)) -> CallDetail:
    call_id_text = str(call_id)
    call = _call_or_404(db, call_id_text)
    try:
        stages = db.list_stage_results(call_id_text)
        return CallDetail.model_validate({**call, "stage_results": stages})
    except Exception as exc:
        raise _database_error(exc) from exc


@app.post("/ai/suggest-stage", response_model=StageSuggestionResponse)
def suggest_stage(request: StageSuggestionRequest) -> StageSuggestionResponse:
    """Classify prospect words into one of the 8 call stages and event."""
    result = suggest_stage_from_words(request.words, request.current_stage)
    return StageSuggestionResponse.model_validate(result)


@app.post("/calls/{call_id}/summary", response_model=CallSummaryResponse)
def summarize_call(
    call_id: UUID,
    db: DatabaseAdapter = Depends(database_dependency),
) -> CallSummaryResponse:
    """Generate or refresh a concise, evidence-grounded AI summary for a call."""
    call_id_text = str(call_id)
    call = _call_or_404(db, call_id_text)
    stages = db.list_stage_results(call_id_text)
    outcome = str(call.get("outcome") or "closed")
    agreed_next_step = call.get("agreed_next_step")
    summary = generate_summary(stages, outcome, agreed_next_step)
    if not summary:
        clean_outcome = outcome.replace("_", " ").capitalize()
        summary = f"Outcome: {clean_outcome}."
        if agreed_next_step:
            summary += f" Agreed next step: {agreed_next_step}"
        else:
            summary += " Follow-up: none recorded."

    now = _utc_now()
    try:
        db.update_call(call_id_text, {"ai_summary": summary, "updated_at": now.isoformat()})
    except Exception:
        pass
    return CallSummaryResponse(call_id=call_id_text, ai_summary=summary, generated_at=now)
