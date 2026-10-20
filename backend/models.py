"""API schemas for the no-login educational call guide demo.

These schemas intentionally model only caller-captured stage information. They do
not accept transcript archives, transcript identifiers, or contact details.
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


CallOutcome = Literal[
    "agreed_to_receive_report",
    "call_again",
    "do_not_call",
    "follow_up",
    "interested",
    "moved_company",
    "next_step_agreed",
    "not_interested",
    "not_logged",
    "wrong_person",
]
CallStatus = Literal["in_progress", "completed"]

# Keep the public demo fields bounded and intentionally free of contact fields.
ShortText = Annotated[str, Field(min_length=1, max_length=240)]
LongText = Annotated[str, Field(max_length=4000)]


class CallStartRequest(BaseModel):
    """Optional fictional labels used to identify a demo call in its history."""

    model_config = ConfigDict(extra="forbid")

    prospect_name: str | None = Field(default=None, max_length=120)
    company_name: str | None = Field(default=None, max_length=160)


class StageResultRequest(BaseModel):
    """One append-only observation from one of the eight guide stages."""

    model_config = ConfigDict(extra="forbid")

    stage_number: int = Field(ge=1, le=8)
    event: ShortText
    prospect_words: LongText = ""
    notes: LongText = ""


class CloseCallRequest(BaseModel):
    """Final caller-selected outcome; closing may happen at any stage."""

    model_config = ConfigDict(extra="forbid")

    outcome: CallOutcome
    stage_number: int = Field(ge=1, le=8)
    event: ShortText = "not_logged"
    prospect_words: LongText = ""
    notes: LongText = ""
    # This is used only as grounded input to the optional post-close summary.
    # It is not a meeting commitment and the assistant must not invent one.
    agreed_next_step: str | None = Field(default=None, max_length=1000)
    idempotency_key: UUID


class StageResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    call_id: str
    stage_number: int = Field(ge=1, le=8)
    event: str
    prospect_words: str = ""
    notes: str = ""
    created_at: datetime


class Call(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    prospect_name: str | None = None
    company_name: str | None = None
    status: CallStatus
    current_stage: int | None = Field(default=None, ge=1, le=8)
    last_stage: int | None = Field(default=None, ge=1, le=8)
    outcome: CallOutcome | None = None
    agreed_next_step: str | None = None
    latest_note: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None
    ai_summary: str | None = None


class CallDetail(Call):
    stage_results: list[StageResult] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class StageSuggestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    words: str = Field(max_length=4000)
    current_stage: int | None = Field(default=None, ge=1, le=8)


class StageSuggestionResponse(BaseModel):
    suggested_stage: int = Field(ge=1, le=8)
    stage_name: str
    suggested_event: str
    confidence: Literal["high", "medium", "low"] = "high"
    reason: str


class CallSummaryResponse(BaseModel):
    call_id: str
    ai_summary: str
    generated_at: datetime
