"""
SQLite database layer for storing emails and their analysis results.
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path


DB_PATH = Path("email_reader.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS emails (
                id          TEXT PRIMARY KEY,
                subject     TEXT,
                sender      TEXT,
                date        TEXT,
                body        TEXT,
                fetched_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS analyses (
                email_id        TEXT PRIMARY KEY REFERENCES emails(id),
                analyzed_at     TEXT DEFAULT (datetime('now')),
                summary         TEXT,
                flags           TEXT,   -- JSON list of flag labels
                meetings        TEXT,   -- JSON list of meeting objects
                money_owed_by_me    TEXT,   -- JSON list of financial objects
                money_owed_to_me    TEXT,   -- JSON list of financial objects
                scheduling      TEXT,   -- JSON list of scheduling objects
                action_items    TEXT,   -- JSON list of strings
                is_important    INTEGER DEFAULT 0
            );
        """)


def save_email(email_id: str, subject: str, sender: str, date: str, body: str):
    """Insert or ignore an email record."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO emails (id, subject, sender, date, body)
            VALUES (?, ?, ?, ?, ?)
            """,
            (email_id, subject, sender, date, body),
        )


def save_analysis(email_id: str, analysis: dict):
    """Upsert analysis results for an email."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO analyses
                (email_id, analyzed_at, summary, flags, meetings,
                 money_owed_by_me, money_owed_to_me, scheduling, action_items, is_important)
            VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                email_id,
                analysis.get("summary", ""),
                json.dumps(analysis.get("flags", [])),
                json.dumps(analysis.get("meetings", [])),
                json.dumps(analysis.get("money_owed_by_me", [])),
                json.dumps(analysis.get("money_owed_to_me", [])),
                json.dumps(analysis.get("scheduling", [])),
                json.dumps(analysis.get("action_items", [])),
                1 if analysis.get("is_important") else 0,
            ),
        )


def get_unanalyzed_emails() -> list[dict]:
    """Return emails that have no analysis record yet."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT e.id, e.subject, e.sender, e.date, e.body
            FROM emails e
            LEFT JOIN analyses a ON a.email_id = e.id
            WHERE a.email_id IS NULL
            ORDER BY e.date DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


def get_report_data() -> list[dict]:
    """Return all emails that have analysis results, for report generation."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                e.subject, e.sender, e.date,
                a.summary, a.flags, a.meetings,
                a.money_owed_by_me, a.money_owed_to_me,
                a.scheduling, a.action_items, a.is_important
            FROM emails e
            JOIN analyses a ON a.email_id = e.id
            ORDER BY e.date DESC
            """
        ).fetchall()

    results = []
    for r in rows:
        d = dict(r)
        for field in ("flags", "meetings", "money_owed_by_me", "money_owed_to_me",
                      "scheduling", "action_items"):
            d[field] = json.loads(d[field] or "[]")
        results.append(d)
    return results


def email_exists(email_id: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM emails WHERE id = ?", (email_id,)
        ).fetchone()
    return row is not None
