"""Privacy and outcome-safety tests for the optional Gemini integration."""

import json
from types import SimpleNamespace

import google

from backend.ai_service import generate_summary


def test_gemini_selects_only_allowlisted_evidence_and_never_writes_follow_up(monkeypatch):
    captured = {}

    class FakeInteractions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                output_text=json.dumps(
                    {
                        "selected_evidence_ids": ["E2", "E999", "E2", "E1"],
                    }
                )
            )

    class FakeClient:
        def __init__(self, *, api_key):
            assert api_key == "test-key"
            self.interactions = FakeInteractions()

    class FakeGenAI:
        Client = FakeClient

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.setattr(google, "genai", FakeGenAI, raising=False)

    summary = generate_summary(
        [
            {
                "stage_number": 5,
                "event": "need_recorded",
                "prospect_words": "SYNTHETIC TEST MARKER; not transcript content.",
                "notes": "Fictional test note.",
            }
        ],
        "interested",
        "Only the agreed synthetic callback next Tuesday.",
    )

    assert summary is not None
    assert summary.startswith("Outcome: Interested.")
    assert "SYNTHETIC TEST MARKER; not transcript content." in summary
    assert "Only the agreed synthetic callback next Tuesday." in summary
    assert "Fake meeting next Friday" not in summary
    assert "E999" not in summary
    assert captured["model"] == "gemini-3.8-flash"
    assert captured["store"] is False
    assert captured["response_format"]["type"] == "text"
    assert captured["response_format"]["mime_type"] == "application/json"
    schema = captured["response_format"]["schema"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["selected_evidence_ids"]["items"]["enum"] == ["E1", "E2", "E3"]
    payload = json.loads(captured["input"])
    assert payload["call_context"] == {
        "final_outcome": "interested",
        "agreed_next_step": "Only the agreed synthetic callback next Tuesday.",
    }
    assert "SYNTHETIC TEST MARKER" in json.dumps(payload)
    assert "prospect_name" not in payload
    assert "transcript_id" not in payload


def test_do_not_call_outcome_never_sends_data_to_gemini(monkeypatch):
    class FakeClient:
        def __init__(self, *, api_key):
            raise AssertionError("Do-not-call outcomes must never be sent to Gemini.")

    class FakeGenAI:
        Client = FakeClient

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(google, "genai", FakeGenAI, raising=False)

    summary = generate_summary(
        [{"prospect_words": "Synthetic test marker."}],
        "do_not_call",
        "A synthetic next step to reject.",
    )

    assert summary == "Outcome: Do not call. No further outreach should be made."


def test_gemini_is_skipped_without_a_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert generate_summary([], "not_logged", None) is None


def test_unallowlisted_or_malformed_model_output_never_becomes_user_text(monkeypatch):
    class FakeInteractions:
        def create(self, **kwargs):
            return SimpleNamespace(
                output_text=json.dumps(
                    {
                        "selected_evidence_ids": ["E999"],
                        "follow_up": "Invented meeting next Friday",
                    }
                )
            )

    class FakeClient:
        def __init__(self, *, api_key):
            self.interactions = FakeInteractions()

    class FakeGenAI:
        Client = FakeClient

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(google, "genai", FakeGenAI, raising=False)

    summary = generate_summary(
        [{"stage_number": 5, "event": "need_recorded", "notes": "Synthetic note."}],
        "follow_up",
        None,
    )

    assert summary is None
