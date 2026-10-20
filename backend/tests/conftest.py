from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from ..database import DatabaseAdapter
from ..main import app, database_dependency


class FakeDatabase:
    def __init__(self) -> None:
        self.calls: dict[str, dict] = {}
        self.stages: list[dict] = []

    def insert_call(self, values: dict) -> dict:
        self.calls[values["id"]] = dict(values)
        return dict(values)

    def get_call(self, call_id: str) -> dict | None:
        value = self.calls.get(call_id)
        return dict(value) if value else None

    def list_calls(self) -> list[dict]:
        return sorted(
            (dict(value) for value in self.calls.values()),
            key=lambda value: value["created_at"],
            reverse=True,
        )

    def save_stage_atomic(self, call_id: str, values: dict) -> dict:
        call = self.calls.get(call_id)
        if call is None:
            return {"error": "not_found"}
        if call["status"] == "completed":
            return {"error": "completed"}

        stage = {"id": str(uuid4()), "call_id": call_id, **values}
        self.stages.append(stage)
        call["current_stage"] = values["stage_number"]
        call["last_stage"] = values["stage_number"]
        call["updated_at"] = values["created_at"]
        note = values["notes"].strip() or values["prospect_words"].strip()
        if note:
            call["latest_note"] = note
        return {"call": dict(call), "stage_result": dict(stage)}

    def close_call_atomic(self, call_id: str, values: dict) -> dict:
        call = self.calls.get(call_id)
        if call is None:
            return {"error": "not_found"}

        existing = next(
            (
                stage
                for stage in self.stages
                if stage["call_id"] == call_id
                and stage.get("idempotency_key") == values["idempotency_key"]
            ),
            None,
        )
        if existing:
            matches = (
                call["status"] == "completed"
                and call.get("outcome") == values["outcome"]
                and call.get("agreed_next_step") == values["agreed_next_step"]
                and existing["stage_number"] == values["stage_number"]
                and existing["event"] == values["event"]
                and existing["prospect_words"] == values["prospect_words"]
                and existing["notes"] == values["notes"]
            )
            if matches:
                return {"call": dict(call), "stage_result": dict(existing), "replayed": True}
            return {"error": "idempotency_conflict"}
        if call["status"] == "completed":
            return {"error": "completed"}

        call_stages = [stage for stage in self.stages if stage["call_id"] == call_id]
        latest = call_stages[-1] if call_stages else None
        if (
            latest is not None
            and latest.get("idempotency_key") is None
            and latest["stage_number"] == values["stage_number"]
            and latest["event"] == values["event"]
            and latest["prospect_words"] == values["prospect_words"]
            and latest["notes"] == values["notes"]
        ):
            stage = latest
            stage["idempotency_key"] = values["idempotency_key"]
        else:
            stage = {
                "id": str(uuid4()),
                "call_id": call_id,
                "stage_number": values["stage_number"],
                "event": values["event"],
                "prospect_words": values["prospect_words"],
                "notes": values["notes"],
                "idempotency_key": values["idempotency_key"],
                "created_at": values["ended_at"],
            }
            self.stages.append(stage)
        call.update(
            {
                "status": "completed",
                "current_stage": values["stage_number"],
                "last_stage": values["stage_number"],
                "outcome": values["outcome"],
                "agreed_next_step": values["agreed_next_step"],
                "ended_at": values["ended_at"],
                "updated_at": values["updated_at"],
            }
        )
        note = values["notes"].strip() or values["prospect_words"].strip()
        if note:
            call["latest_note"] = note
        return {"call": dict(call), "stage_result": dict(stage), "replayed": False}

    def update_call(self, call_id: str, values: dict) -> dict:
        self.calls[call_id].update(values)
        return dict(self.calls[call_id])

    def list_stage_results(self, call_id: str) -> list[dict]:
        return sorted(
            (dict(value) for value in self.stages if value["call_id"] == call_id),
            key=lambda value: value["created_at"],
        )


@pytest.fixture
def fake_db() -> FakeDatabase:
    return FakeDatabase()


@pytest.fixture
def client(fake_db: FakeDatabase):
    app.dependency_overrides[database_dependency] = lambda: fake_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
