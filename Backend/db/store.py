"""
SQLite persistence for research runs (Phase 12).

Deliberately minimal: one table holding the JSON payload of each run plus a few
indexed columns for listing. Persistence failures are logged and swallowed - a
demo should never 500 because the history table is locked.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import settings

logger = logging.getLogger("virtual_rd_lab.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS research_runs (
    run_id            TEXT PRIMARY KEY,
    created_at        TEXT NOT NULL,
    research_question TEXT NOT NULL,
    objective_json    TEXT,
    recommended_id    TEXT,
    recommended_score REAL,
    predicted_yield   REAL,
    payload_json      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_runs_created_at ON research_runs (created_at DESC);
"""


class RunStore:
    """Thin sqlite3 wrapper for research-run history."""

    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path or settings.database_path)
        self._lock = threading.Lock()
        self._initialised = False
        self._available = True

    # ------------------------------------------------------------------ #
    # lifecycle
    # ------------------------------------------------------------------ #
    def init(self) -> bool:
        """Create the database and schema if needed."""
        if self._initialised:
            return self._available
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self._lock, self._connect() as connection:
                connection.executescript(SCHEMA)
            self._available = True
            logger.info("SQLite history store ready at %s", self.path)
        except Exception as error:  # noqa: BLE001
            self._available = False
            logger.warning("History store unavailable (%s) - runs will not be persisted", error)
        self._initialised = True
        return self._available

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5.0, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    @property
    def available(self) -> bool:
        return self._initialised and self._available

    # ------------------------------------------------------------------ #
    # writes
    # ------------------------------------------------------------------ #
    def save_run(
        self,
        research_question: str,
        payload: Dict[str, Any],
        *,
        objective: Dict[str, Any] | None = None,
        recommended: Dict[str, Any] | None = None,
        run_id: str | None = None,
    ) -> Optional[str]:
        """Persist one research run. Returns the run id, or None on failure."""
        if not self.init():
            return None

        run_id = run_id or f"run_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}_{uuid.uuid4().hex[:6]}"
        recommended = recommended or {}
        try:
            with self._lock, self._connect() as connection:
                connection.execute(
                    "INSERT OR REPLACE INTO research_runs "
                    "(run_id, created_at, research_question, objective_json, recommended_id, "
                    " recommended_score, predicted_yield, payload_json) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        run_id,
                        datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        research_question,
                        json.dumps(objective or {}),
                        str(recommended.get("id", "")),
                        float(recommended.get("score", 0.0) or 0.0),
                        float(recommended.get("predicted_yield", 0.0) or 0.0),
                        json.dumps(payload, default=str),
                    ),
                )
            return run_id
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not persist run: %s", error)
            return None

    # ------------------------------------------------------------------ #
    # reads
    # ------------------------------------------------------------------ #
    def list_runs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Most recent runs, newest first (without the full payload)."""
        if not self.init():
            return []
        try:
            with self._lock, self._connect() as connection:
                rows = connection.execute(
                    "SELECT run_id, created_at, research_question, recommended_id, recommended_score, "
                    "       predicted_yield "
                    "FROM research_runs ORDER BY created_at DESC LIMIT ?",
                    (int(limit),),
                ).fetchall()
            return [dict(row) for row in rows]
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not list runs: %s", error)
            return []

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """One run including its full JSON payload."""
        if not self.init():
            return None
        try:
            with self._lock, self._connect() as connection:
                row = connection.execute(
                    "SELECT * FROM research_runs WHERE run_id = ?", (run_id,)
                ).fetchone()
            if row is None:
                return None
            record = dict(row)
            record["payload"] = json.loads(record.pop("payload_json") or "{}")
            record["objective"] = json.loads(record.pop("objective_json") or "{}")
            return record
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not read run %s: %s", run_id, error)
            return None

    def count(self) -> int:
        if not self.init():
            return 0
        try:
            with self._lock, self._connect() as connection:
                return int(connection.execute("SELECT COUNT(*) FROM research_runs").fetchone()[0])
        except Exception:  # noqa: BLE001
            return 0


run_store = RunStore()
