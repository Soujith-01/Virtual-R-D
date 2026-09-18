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

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    full_name       TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    organization    TEXT,
    research_domain TEXT,
    role            TEXT NOT NULL DEFAULT 'researcher',
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TEXT NOT NULL,
    approved_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
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

    # ------------------------------------------------------------------ #
    # users & authentication
    # ------------------------------------------------------------------ #
    def create_user(
        self,
        full_name: str,
        email: str,
        password_hash: str,
        organization: str = "",
        research_domain: str = "",
        role: str = "researcher",
        status: str = "pending",
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Insert a newly registered user."""
        self.init()
        uid = user_id or f"usr-{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        approved_at = now if status == "approved" else None

        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO users (
                    id, full_name, email, password_hash, organization,
                    research_domain, role, status, created_at, approved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    uid,
                    full_name.strip(),
                    email.strip().lower(),
                    password_hash,
                    organization.strip() if organization else "",
                    research_domain.strip() if research_domain else "",
                    role,
                    status,
                    now,
                    approved_at,
                ),
            )

        return self.get_user_by_id(uid)

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Retrieve user row by normalized email."""
        if not self.init():
            return None
        try:
            with self._lock, self._connect() as connection:
                row = connection.execute(
                    "SELECT * FROM users WHERE email = ?",
                    (email.strip().lower(),),
                ).fetchone()
            if not row:
                return None
            return dict(row)
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not query user by email: %s", error)
            return None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve user row by user ID."""
        if not self.init():
            return None
        try:
            with self._lock, self._connect() as connection:
                row = connection.execute(
                    "SELECT * FROM users WHERE id = ?",
                    (str(user_id),),
                ).fetchone()
            if not row:
                return None
            return dict(row)
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not query user by id: %s", error)
            return None

    def list_users(
        self,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List users with optional status filter and text search."""
        if not self.init():
            return []
        try:
            query = "SELECT * FROM users"
            params: list[Any] = []
            conditions: list[str] = []

            if status and status.lower() != "all":
                conditions.append("status = ?")
                params.append(status.lower())

            if search and search.strip():
                pattern = f"%{search.strip().lower()}%"
                conditions.append("(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(organization) LIKE ?)")
                params.extend([pattern, pattern, pattern])

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY created_at DESC"

            with self._lock, self._connect() as connection:
                rows = connection.execute(query, params).fetchall()

            users = []
            for row in rows:
                item = dict(row)
                item.pop("password_hash", None)  # Never leak password hash to callers
                users.append(item)
            return users
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not list users: %s", error)
            return []

    def update_user_status(self, user_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        """Update account status (e.g. approved, rejected, suspended)."""
        if not self.init():
            return None
        try:
            now = datetime.now(timezone.utc).isoformat()
            with self._lock, self._connect() as connection:
                if new_status == "approved":
                    connection.execute(
                        "UPDATE users SET status = ?, approved_at = ? WHERE id = ?",
                        (new_status, now, str(user_id)),
                    )
                else:
                    connection.execute(
                        "UPDATE users SET status = ? WHERE id = ?",
                        (new_status, str(user_id)),
                    )
            user = self.get_user_by_id(user_id)
            if user:
                user.pop("password_hash", None)
            return user
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not update user status: %s", error)
            return None

    def delete_user(self, user_id: str) -> bool:
        """Permanently delete a user account."""
        if not self.init():
            return False
        try:
            with self._lock, self._connect() as connection:
                cursor = connection.execute(
                    "DELETE FROM users WHERE id = ?",
                    (str(user_id),),
                )
                return cursor.rowcount > 0
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not delete user %s: %s", user_id, error)
            return False

    def count_users_by_status(self) -> Dict[str, int]:
        """Count users grouped by status."""
        counts = {
            "total": 0,
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "suspended": 0,
        }
        if not self.init():
            return counts
        try:
            with self._lock, self._connect() as connection:
                rows = connection.execute(
                    "SELECT status, COUNT(*) as cnt FROM users GROUP BY status"
                ).fetchall()
                total = 0
                for row in rows:
                    st = row["status"]
                    cnt = row["cnt"]
                    total += cnt
                    if st in counts:
                        counts[st] = cnt
                counts["total"] = total
            return counts
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not count users: %s", error)
            return counts

    def seed_admin_if_needed(
        self,
        email: str,
        password_hash: str,
        name: str = "Nucleus Administrator",
        organization: str = "Nucleus AI Core",
    ) -> bool:
        """Seed the initial administrator account if no admin exists with this email."""
        if not self.init():
            return False
        existing = self.get_user_by_email(email)
        if existing:
            return False
        try:
            self.create_user(
                full_name=name,
                email=email,
                password_hash=password_hash,
                organization=organization,
                research_domain="Administration",
                role="admin",
                status="approved",
                user_id="usr-admin-001",
            )
            logger.info("Initial admin user seeded: %s", email)
            return True
        except Exception as error:  # noqa: BLE001
            logger.warning("Could not seed admin user: %s", error)
            return False


run_store = RunStore()

