"""
IMAP email client — fetches emails from any standard IMAP server.
Supports Gmail, Outlook, Yahoo, and generic IMAP providers.
"""

import imaplib
import email
import email.header
import email.utils
import hashlib
import os
import re
from datetime import datetime, timedelta
from email.message import Message


def _decode_header(raw) -> str:
    """Decode an email header value that may contain encoded words."""
    if raw is None:
        return ""
    parts = email.header.decode_header(raw)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _get_body(msg: Message) -> str:
    """Extract the plain-text body from an email message."""
    body_parts = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    body_parts.append(payload.decode(charset, errors="replace"))
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            body_parts.append(payload.decode(charset, errors="replace"))

    body = "\n".join(body_parts)
    # Strip excessive whitespace but keep paragraph breaks
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def _make_email_id(msg: Message) -> str:
    """Generate a stable ID for an email from its headers."""
    message_id = msg.get("Message-ID", "")
    if message_id:
        return hashlib.sha256(message_id.encode()).hexdigest()[:32]
    # Fallback: hash from/subject/date
    fingerprint = f"{msg.get('From','')}{msg.get('Subject','')}{msg.get('Date','')}"
    return hashlib.sha256(fingerprint.encode()).hexdigest()[:32]


def fetch_emails(
    imap_server: str,
    imap_port: int,
    email_address: str,
    password: str,
    days_back: int = 7,
    max_emails: int = 50,
    folder: str = "INBOX",
) -> list[dict]:
    """
    Connect to IMAP, fetch recent emails, and return them as dicts.

    Returns a list of:
        {
            "id": str,
            "subject": str,
            "sender": str,
            "date": str (ISO format),
            "body": str,
        }
    """
    since_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")

    emails = []

    with imaplib.IMAP4_SSL(imap_server, imap_port) as mail:
        mail.login(email_address, password)
        mail.select(folder, readonly=True)

        status, data = mail.search(None, f'(SINCE "{since_date}")')
        if status != "OK":
            return []

        message_ids = data[0].split()
        # Most recent first
        message_ids = list(reversed(message_ids))[:max_emails]

        for uid in message_ids:
            try:
                status, msg_data = mail.fetch(uid, "(RFC822)")
                if status != "OK" or not msg_data or msg_data[0] is None:
                    continue

                raw = msg_data[0][1]
                if not isinstance(raw, bytes):
                    continue

                msg = email.message_from_bytes(raw)

                subject = _decode_header(msg.get("Subject", "(No Subject)"))
                sender = _decode_header(msg.get("From", ""))
                date_str = msg.get("Date", "")

                # Parse date to ISO format
                try:
                    parsed_date = email.utils.parsedate_to_datetime(date_str)
                    iso_date = parsed_date.isoformat()
                except Exception:
                    iso_date = date_str

                body = _get_body(msg)
                # Truncate very long emails to stay within token limits
                if len(body) > 8000:
                    body = body[:8000] + "\n\n[... email truncated for analysis ...]"

                email_id = _make_email_id(msg)

                emails.append({
                    "id": email_id,
                    "subject": subject,
                    "sender": sender,
                    "date": iso_date,
                    "body": body,
                })
            except Exception:
                # Skip individual emails that fail to parse
                continue

    return emails
