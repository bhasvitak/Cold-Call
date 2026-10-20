from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from .. import main
from ..database import reset_database_client_for_tests
from ..main import app, database_dependency


def _close_payload(outcome: str, stage_number: int, **overrides) -> dict:
    return {
        "outcome": outcome,
        "stage_number": stage_number,
        "idempotency_key": "00000000-0000-0000-0000-000000000001",
        **overrides,
    }


def test_health_does_not_require_database():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_call(client):
    response = client.post(
        "/calls",
        json={"prospect_name": "Demo Prospect", "company_name": "Fictional Co"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "in_progress"
    assert body["prospect_name"] == "Demo Prospect"
    assert body["current_stage"] == 1
    assert body["outcome"] is None


def test_stage_save_is_append_only_and_detail_includes_results(client):
    call_id = client.post("/calls", json={}).json()["id"]
    first = client.post(
        f"/calls/{call_id}/stages",
        json={
            "stage_number": 2,
            "event": "permission_granted",
            "prospect_words": "Synthetic test payload A; not transcript material.",
            "notes": "Keep it brief.",
        },
    )
    second = client.post(
        f"/calls/{call_id}/stages",
        json={
            "stage_number": 2,
            "event": "objection",
            "prospect_words": "Synthetic test payload B; not transcript material.",
            "notes": "Revisited stage without erasing the first result.",
        },
    )
    assert first.status_code == 201
    assert second.status_code == 201

    detail = client.get(f"/calls/{call_id}")
    assert detail.status_code == 200
    results = detail.json()["stage_results"]
    assert len(results) == 2
    assert results[0]["event"] == "permission_granted"
    assert results[1]["event"] == "objection"
    assert detail.json()["last_stage"] == 2


def test_early_close_records_outcome_and_last_stage(client):
    call_id = client.post("/calls", json={}).json()["id"]
    client.post(
        f"/calls/{call_id}/stages",
        json={"stage_number": 1, "event": "wrong_person", "notes": "Ended early."},
    )
    response = client.post(
        f"/calls/{call_id}/close",
        json=_close_payload("wrong_person", 1, event="wrong_person", notes="Ended early."),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["outcome"] == "wrong_person"
    assert body["last_stage"] == 1
    assert body["agreed_next_step"] is None
    assert len(client.get(f"/calls/{call_id}").json()["stage_results"]) == 1

    assert client.post(
        f"/calls/{call_id}/stages",
        json={"stage_number": 2, "event": "late_save"},
    ).status_code == 409


def test_close_directly_saves_blank_current_stage_for_each_stage(client):
    for stage_number in range(1, 9):
        call_id = client.post("/calls", json={}).json()["id"]
        response = client.post(
            f"/calls/{call_id}/close",
            json=_close_payload("not_logged", stage_number),
        )
        assert response.status_code == 200
        assert response.json()["current_stage"] == stage_number
        assert response.json()["last_stage"] == stage_number
        detail = client.get(f"/calls/{call_id}").json()
        assert len(detail["stage_results"]) == 1
        assert detail["stage_results"][0]["stage_number"] == stage_number
        assert detail["stage_results"][0]["event"] == "not_logged"
        assert detail["stage_results"][0]["prospect_words"] == ""
        assert detail["stage_results"][0]["notes"] == ""


def test_close_persists_explicitly_agreed_next_step(client):
    call_id = client.post("/calls", json={}).json()["id"]
    client.post(
        f"/calls/{call_id}/stages",
        json={"stage_number": 7, "event": "callback", "notes": "Synthetic fixture."},
    )
    response = client.post(
        f"/calls/{call_id}/close",
        json=_close_payload("next_step_agreed", 7, event="callback", notes="Synthetic fixture.", agreed_next_step="Synthetic callback next Tuesday."),
    )
    assert response.status_code == 200
    assert response.json()["agreed_next_step"] == "Synthetic callback next Tuesday."


def test_call_list_is_newest_first_and_detail_has_stages(client):
    first = client.post("/calls", json={"company_name": "First Demo"}).json()
    second = client.post("/calls", json={"company_name": "Second Demo"}).json()
    listed = client.get("/calls")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [second["id"], first["id"]]
    assert client.get(f"/calls/{second['id']}").json()["stage_results"] == []
    assert client.get(f"/calls/{uuid4()}").status_code == 404
    assert client.get("/calls/not-a-real-call").status_code == 422


def test_close_retry_with_same_key_is_idempotent_and_mismatched_reuse_conflicts(client):
    call_id = client.post("/calls", json={}).json()["id"]
    payload = _close_payload(
        "not_interested",
        2,
        event="declined",
        prospect_words="Synthetic, non-transcript test content.",
        notes="Synthetic test note.",
    )

    first = client.post(f"/calls/{call_id}/close", json=payload)
    replay = client.post(f"/calls/{call_id}/close", json=payload)
    assert first.status_code == replay.status_code == 200
    assert len(client.get(f"/calls/{call_id}").json()["stage_results"]) == 1

    conflict = client.post(
        f"/calls/{call_id}/close",
        json={**payload, "notes": "Changed after a close key was used."},
    )
    assert conflict.status_code == 409


def test_missing_database_configuration_returns_503(monkeypatch):
    app.dependency_overrides.clear()
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    reset_database_client_for_tests()
    with TestClient(app) as client:
        response = client.post("/calls", json={})
    assert response.status_code == 503
    assert "SUPABASE_URL" in response.json()["detail"]
    assert "SUPABASE_SECRET_KEY" in response.json()["detail"]


def test_ai_failure_does_not_block_close(client, monkeypatch):
    call_id = client.post("/calls", json={}).json()["id"]

    def broken_summary(*args, **kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(main, "generate_summary", broken_summary)
    response = client.post(
        f"/calls/{call_id}/close",
        json=_close_payload("interested", 1),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["outcome"] == "interested"


def test_invalid_stage_and_outcome_are_rejected(client):
    call_id = client.post("/calls", json={}).json()["id"]
    assert client.post(
        f"/calls/{call_id}/stages",
        json={"stage_number": 9, "event": "invalid"},
    ).status_code == 422
    assert client.post(
        f"/calls/{call_id}/close",
        json=_close_payload("made_up_outcome", 1),
    ).status_code == 422


def test_ai_suggest_stage_endpoint(client):
    response = client.post(
        "/ai/suggest-stage",
        json={"words": "We already have an in-house consultant handling this", "current_stage": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["suggested_stage"] == 6
    assert data["stage_name"] == "Objection"
    assert "already_has_agency" in data["suggested_event"]


def test_call_summary_endpoint(client):
    call_id = client.post("/calls", json={"prospect_name": "Dev Sharma"}).json()["id"]
    client.post(
        f"/calls/{call_id}/stages",
        json={
            "stage_number": 5,
            "event": "growth_need",
            "prospect_words": "Plant running at 60 percent capacity.",
            "notes": "Looking for OEM buyers.",
        },
    )
    client.post(
        f"/calls/{call_id}/close",
        json=_close_payload("next_step_agreed", 5, agreed_next_step="Google Meet Tuesday 2pm"),
    )
    response = client.post(f"/calls/{call_id}/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["call_id"] == call_id
    assert "Outcome: Next step agreed." in body["ai_summary"]
