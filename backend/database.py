"""Persistence boundary for Supabase's PostgreSQL Data API.

The client is created only when a data route asks for it. This keeps imports and
/health usable in local development and in Render health checks without secrets.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Protocol


class DatabaseConfigurationError(RuntimeError):
    """Raised when the server has not been configured for Supabase."""


class DatabaseRequestError(RuntimeError):
    """Raised when a configured Supabase request fails."""


class DatabaseAdapter(Protocol):
    def insert_call(self, values: dict[str, Any]) -> dict[str, Any]: ...

    def get_call(self, call_id: str) -> dict[str, Any] | None: ...

    def list_calls(self) -> list[dict[str, Any]]: ...

    def save_stage_atomic(self, call_id: str, values: dict[str, Any]) -> dict[str, Any]: ...

    def close_call_atomic(self, call_id: str, values: dict[str, Any]) -> dict[str, Any]: ...

    def update_call(self, call_id: str, values: dict[str, Any]) -> dict[str, Any]: ...

    def list_stage_results(self, call_id: str) -> list[dict[str, Any]]: ...


class SupabaseDatabase:
    """Small synchronous wrapper around the official supabase-py client."""

    def __init__(self, client: Any) -> None:
        self.client = client

    @staticmethod
    def _one(data: Any) -> dict[str, Any]:
        if not data:
            raise DatabaseRequestError("The database did not return the saved record.")
        return dict(data[0]) if isinstance(data, list) else dict(data)

    @staticmethod
    def _wrap(operation: Any) -> Any:
        try:
            response = operation()
            return response.data
        except DatabaseRequestError:
            raise
        except Exception as exc:  # Do not expose provider details to API clients.
            raise DatabaseRequestError("The database request failed.") from exc

    def insert_call(self, values: dict[str, Any]) -> dict[str, Any]:
        data = self._wrap(lambda: self.client.table("calls").insert(values).execute())
        return self._one(data)

    def get_call(self, call_id: str) -> dict[str, Any] | None:
        data = self._wrap(
            lambda: self.client.table("calls").select("*").eq("id", call_id).limit(1).execute()
        )
        return dict(data[0]) if data else None

    def list_calls(self) -> list[dict[str, Any]]:
        data = self._wrap(
            lambda: self.client.table("calls").select("*").order("created_at", desc=True).execute()
        )
        return [dict(item) for item in (data or [])]

    def save_stage_atomic(self, call_id: str, values: dict[str, Any]) -> dict[str, Any]:
        params = {
            "p_call_id": call_id,
            "p_stage_number": values["stage_number"],
            "p_event": values["event"],
            "p_prospect_words": values.get("prospect_words", ""),
            "p_notes": values.get("notes", ""),
            "p_created_at": values["created_at"],
        }
        data = self._wrap(
            lambda: self.client.rpc("save_call_stage_atomic", params).execute()
        )
        return self._one(data)

    def close_call_atomic(self, call_id: str, values: dict[str, Any]) -> dict[str, Any]:
        params = {
            "p_call_id": call_id,
            "p_stage_number": values["stage_number"],
            "p_event": values["event"],
            "p_prospect_words": values.get("prospect_words", ""),
            "p_notes": values.get("notes", ""),
            "p_outcome": values["outcome"],
            "p_agreed_next_step": values.get("agreed_next_step"),
            "p_idempotency_key": values["idempotency_key"],
            "p_now": values["ended_at"],
        }
        data = self._wrap(
            lambda: self.client.rpc("close_call_atomic", params).execute()
        )
        return self._one(data)

    def update_call(self, call_id: str, values: dict[str, Any]) -> dict[str, Any]:
        data = self._wrap(
            lambda: self.client.table("calls").update(values).eq("id", call_id).execute()
        )
        return self._one(data)

    def list_stage_results(self, call_id: str) -> list[dict[str, Any]]:
        data = self._wrap(
            lambda: self.client.table("stage_results")
            .select("*")
            .eq("call_id", call_id)
            .order("created_at", desc=False)
            .execute()
        )
        return [dict(item) for item in (data or [])]


_client: SupabaseDatabase | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_database() -> SupabaseDatabase:
    """Return the process-local client, creating it only on first data access."""

    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL", "").strip()
    secret_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    missing = [name for name, value in (("SUPABASE_URL", url), ("SUPABASE_SECRET_KEY", secret_key)) if not value]
    if missing:
        names = " and ".join(missing)
        raise DatabaseConfigurationError(f"Database configuration is missing: set {names}.")

    try:
        from supabase import create_client

        _client = SupabaseDatabase(create_client(url, secret_key))
        return _client
    except DatabaseConfigurationError:
        raise
    except Exception as exc:
        raise DatabaseConfigurationError("The database client could not be initialized.") from exc


def reset_database_client_for_tests() -> None:
    """Clear the lazy singleton for tests; not used by application routes."""

    global _client
    _client = None
