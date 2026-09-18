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

CREATE TABLE IF NOT EXISTS research_papers (
    paper_id        TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    authors_json    TEXT,
    year            INTEGER,
    venue           TEXT,
    abstract        TEXT,
    citation_count  INTEGER,
    doi             TEXT,
    is_open_access  INTEGER,
    url             TEXT,
    open_access_pdf TEXT,
    source          TEXT,
    summary_json    TEXT,
    saved_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_papers_saved_at ON research_papers (saved_at DESC);
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

    # ------------------------------------------------------------------ #
    # research papers library
    # ------------------------------------------------------------------ #
    def save_paper(self, paper: Dict[str, Any]) -> bool:
        """Save a paper to the local research library."""
        if not self.init():
            return False
        paper_id = paper.get("paper_id") or paper.get("id") or str(uuid.uuid4().hex[:12])
        authors = paper.get("authors", [])
        authors_json = json.dumps(authors) if isinstance(authors, (list, dict)) else str(authors or "[]")
        summary = paper.get("summary")
        summary_json = json.dumps(summary) if isinstance(summary, (dict, list)) else None
        saved_at = paper.get("saved_at") or datetime.now(timezone.utc).isoformat()

        try:
            with self._lock, self._connect() as connection:
                connection.execute(
                    "INSERT OR REPLACE INTO research_papers "
                    "(paper_id, title, authors_json, year, venue, abstract, citation_count, "
                    " doi, is_open_access, url, open_access_pdf, source, summary_json, saved_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        str(paper_id),
                        str(paper.get("title") or "Untitled paper"),
                        authors_json,
                        int(paper.get("year")) if paper.get("year") is not None else None,
                        str(paper.get("venue") or ""),
                        str(paper.get("abstract") or ""),
                        int(paper.get("citation_count", paper.get("citationCount", 0)) or 0),
                        str(paper.get("doi") or ""),
                        1 if paper.get("is_open_access") or paper.get("isOpenAccess") else 0,
                        str(paper.get("url") or ""),
                        str(paper.get("open_access_pdf") or paper.get("openAccessPdf") or ""),
                        str(paper.get("source") or "Semantic Scholar"),
                        summary_json,
                        saved_at,
                    ),
                )
            return True
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not save paper %s: %s", paper_id, error)
            return False

    def list_papers(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List all papers saved in the library, newest first."""
        if not self.init():
            return []
        try:
            with self._lock, self._connect() as connection:
                rows = connection.execute(
                    "SELECT * FROM research_papers ORDER BY saved_at DESC LIMIT ?",
                    (int(limit),),
                ).fetchall()
            papers = []
            for row in rows:
                item = dict(row)
                try:
                    item["authors"] = json.loads(item.pop("authors_json") or "[]")
                except Exception:
                    item["authors"] = []
                summary_raw = item.pop("summary_json", None)
                if summary_raw:
                    try:
                        item["summary"] = json.loads(summary_raw)
                    except Exception:
                        item["summary"] = None
                else:
                    item["summary"] = None
                item["is_open_access"] = bool(item.get("is_open_access"))
                papers.append(item)
            return papers
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not list papers: %s", error)
            return []

    def get_paper(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Get one saved paper by its ID."""
        if not self.init():
            return None
        try:
            with self._lock, self._connect() as connection:
                row = connection.execute(
                    "SELECT * FROM research_papers WHERE paper_id = ?",
                    (str(paper_id),),
                ).fetchone()
            if not row:
                return None
            item = dict(row)
            try:
                item["authors"] = json.loads(item.pop("authors_json") or "[]")
            except Exception:
                item["authors"] = []
            summary_raw = item.pop("summary_json", None)
            item["summary"] = json.loads(summary_raw) if summary_raw else None
            item["is_open_access"] = bool(item.get("is_open_access"))
            return item
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not get paper %s: %s", paper_id, error)
            return None

    def delete_paper(self, paper_id: str) -> bool:
        """Remove a paper from the research library."""
        if not self.init():
            return False
        try:
            with self._lock, self._connect() as connection:
                cursor = connection.execute(
                    "DELETE FROM research_papers WHERE paper_id = ?",
                    (str(paper_id),),
                )
                return cursor.rowcount > 0
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not delete paper %s: %s", paper_id, error)
            return False


run_store = RunStore()
