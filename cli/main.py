#!/usr/bin/env python3
"""
EmailReader — AI-powered email analysis and reporting tool.

Usage:
    python main.py              # fetch + analyze + report (full run)
    python main.py fetch        # fetch new emails only
    python main.py analyze      # analyze fetched emails with Claude
    python main.py report       # print the report

Environment:
    Copy .env.example to .env and fill in your credentials.
"""

import os
import sys
import time
from dotenv import load_dotenv
import anthropic
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

import database
import email_client
import analyzer
import reporter

load_dotenv()
console = Console()


def _require_env(key: str) -> str:
    val = os.getenv(key)
    if not val:
        console.print(f"[red]Error:[/red] Missing required environment variable: [bold]{key}[/bold]")
        console.print("       Copy [bold].env.example[/bold] to [bold].env[/bold] and fill in your values.")
        sys.exit(1)
    return val


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_fetch():
    """Fetch recent emails via IMAP and store them in the database."""
    imap_server   = _require_env("IMAP_SERVER")
    imap_port     = int(os.getenv("IMAP_PORT", "993"))
    email_address = _require_env("EMAIL_ADDRESS")
    password      = _require_env("EMAIL_PASSWORD")
    days_back     = int(os.getenv("FETCH_DAYS", "7"))
    max_emails    = int(os.getenv("MAX_EMAILS", "50"))

    console.print()
    console.print(f"[bold cyan]Fetching emails[/bold cyan] from [bold]{imap_server}[/bold]")
    console.print(f"  Account  : {email_address}")
    console.print(f"  Date range: last {days_back} day(s)")
    console.print(f"  Max emails: {max_emails}")
    console.print()

    with console.status("[cyan]Connecting to email server...[/cyan]"):
        try:
            emails = email_client.fetch_emails(
                imap_server=imap_server,
                imap_port=imap_port,
                email_address=email_address,
                password=password,
                days_back=days_back,
                max_emails=max_emails,
            )
        except Exception as e:
            console.print(f"[red]Failed to fetch emails:[/red] {e}")
            console.print()
            console.print("[dim]Tip: For Gmail, enable IMAP and use an App Password.[/dim]")
            console.print("[dim]     https://support.google.com/mail/answer/185833[/dim]")
            sys.exit(1)

    new_count = 0
    for em in emails:
        if not database.email_exists(em["id"]):
            database.save_email(
                email_id=em["id"],
                subject=em["subject"],
                sender=em["sender"],
                date=em["date"],
                body=em["body"],
            )
            new_count += 1

    console.print(f"[green]Done.[/green] Fetched {len(emails)} email(s), {new_count} new.")
    console.print()


def cmd_analyze():
    """Analyze unprocessed emails with Claude Opus 4.6."""
    api_key   = _require_env("ANTHROPIC_API_KEY")
    your_name = os.getenv("YOUR_NAME", "")

    unanalyzed = database.get_unanalyzed_emails()

    if not unanalyzed:
        console.print("[dim]No new emails to analyze.[/dim]")
        return

    console.print()
    console.print(f"[bold cyan]Analyzing[/bold cyan] {len(unanalyzed)} email(s) with Claude Opus 4.6...")
    console.print()

    client = anthropic.Anthropic(api_key=api_key)

    success = 0
    failed  = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("Analyzing...", total=len(unanalyzed))

        for em in unanalyzed:
            progress.update(
                task,
                description=f"[cyan]{em['subject'][:50]}[/cyan]",
            )
            try:
                result = analyzer.analyze_email(
                    client=client,
                    subject=em["subject"],
                    sender=em["sender"],
                    date=em["date"],
                    body=em["body"],
                    your_name=your_name,
                )
                database.save_analysis(em["id"], result)
                success += 1
            except anthropic.RateLimitError:
                console.print("\n[yellow]Rate limited — waiting 60 seconds...[/yellow]")
                time.sleep(60)
                try:
                    result = analyzer.analyze_email(
                        client=client,
                        subject=em["subject"],
                        sender=em["sender"],
                        date=em["date"],
                        body=em["body"],
                        your_name=your_name,
                    )
                    database.save_analysis(em["id"], result)
                    success += 1
                except Exception as retry_err:
                    console.print(f"[red]Retry failed:[/red] {retry_err}")
                    failed += 1
            except Exception as e:
                console.print(f"\n[red]Error analyzing email:[/red] {em['subject'][:40]} — {e}")
                failed += 1

            progress.advance(task)

    console.print(f"[green]Analysis complete.[/green] {success} succeeded, {failed} failed.")
    console.print()


def cmd_report():
    """Print the analysis report."""
    data = database.get_report_data()
    reporter.print_report(data)


def cmd_run_all():
    """Full pipeline: fetch → analyze → report."""
    cmd_fetch()
    cmd_analyze()
    cmd_report()


# ── Entry point ───────────────────────────────────────────────────────────────

COMMANDS = {
    "fetch":   cmd_fetch,
    "analyze": cmd_analyze,
    "report":  cmd_report,
}

if __name__ == "__main__":
    database.init_db()

    arg = sys.argv[1].lower() if len(sys.argv) > 1 else None

    if arg is None:
        cmd_run_all()
    elif arg in COMMANDS:
        COMMANDS[arg]()
    else:
        console.print(f"[red]Unknown command:[/red] {arg}")
        console.print()
        console.print("Usage:")
        console.print("  python main.py              [dim]# full run (fetch + analyze + report)[/dim]")
        console.print("  python main.py fetch        [dim]# fetch new emails[/dim]")
        console.print("  python main.py analyze      [dim]# analyze with Claude[/dim]")
        console.print("  python main.py report       [dim]# print the report[/dim]")
        sys.exit(1)
