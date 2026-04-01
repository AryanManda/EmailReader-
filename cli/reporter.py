"""
Report generator — renders analysis data as a rich, readable terminal report.
"""

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box
from rich.columns import Columns
from rich.rule import Rule


console = Console()


def _flag_style(flag: str) -> str:
    styles = {
        "MEETING": "bold blue",
        "INVOICE": "bold red",
        "PAYMENT_DUE": "bold red",
        "PAYMENT_INCOMING": "bold green",
        "DEADLINE": "bold yellow",
        "RSVP_REQUIRED": "bold magenta",
        "FOLLOW_UP": "bold cyan",
        "URGENT": "bold red reverse",
        "SCHEDULING": "bold blue",
    }
    return styles.get(flag.upper(), "white")


def _render_flags(flags: list[str]) -> Text:
    text = Text()
    for i, flag in enumerate(flags):
        if i > 0:
            text.append("  ")
        style = _flag_style(flag)
        text.append(f"[{flag}]", style=style)
    return text


def _truncate(s: str, max_len: int = 60) -> str:
    return s if len(s) <= max_len else s[:max_len - 3] + "..."


def print_report(data: list[dict]):
    """Print the full analysis report to the terminal."""

    console.print()
    console.rule("[bold cyan]EMAIL ANALYSIS REPORT[/bold cyan]", style="cyan")
    console.print()

    # ── Summary counters ──────────────────────────────────────────────────────
    total = len(data)
    important = sum(1 for d in data if d.get("is_important"))
    total_meetings = sum(len(d.get("meetings", [])) for d in data)
    total_owed_by_me = sum(len(d.get("money_owed_by_me", [])) for d in data)
    total_owed_to_me = sum(len(d.get("money_owed_to_me", [])) for d in data)
    total_scheduling = sum(len(d.get("scheduling", [])) for d in data)
    total_actions = sum(len(d.get("action_items", [])) for d in data)

    stats = Table.grid(padding=(0, 3))
    stats.add_column(justify="right", style="bold")
    stats.add_column(style="cyan")
    stats.add_row("Emails analyzed:", str(total))
    stats.add_row("Flagged important:", str(important))
    stats.add_row("Meetings found:", str(total_meetings))
    stats.add_row("Bills / payments due:", str(total_owed_by_me))
    stats.add_row("Payments incoming:", str(total_owed_to_me))
    stats.add_row("Scheduling items:", str(total_scheduling))
    stats.add_row("Action items:", str(total_actions))

    console.print(Panel(stats, title="[bold]Overview[/bold]", border_style="cyan"))
    console.print()

    # ── Meetings ──────────────────────────────────────────────────────────────
    all_meetings = [
        (d["subject"], d["sender"], m)
        for d in data
        for m in d.get("meetings", [])
    ]
    if all_meetings:
        console.rule("[bold blue]MEETINGS & APPOINTMENTS[/bold blue]", style="blue")
        console.print()
        t = Table(box=box.ROUNDED, show_header=True, header_style="bold blue",
                  border_style="blue", expand=True)
        t.add_column("Description", ratio=3)
        t.add_column("When", ratio=2)
        t.add_column("Where", ratio=2)
        t.add_column("Organizer", ratio=2)
        t.add_column("From Email", ratio=3)
        for subject, sender, m in all_meetings:
            t.add_row(
                m.get("description", ""),
                m.get("date_time", "unknown"),
                m.get("location", "unknown"),
                m.get("organizer", "unknown"),
                _truncate(sender),
            )
        console.print(t)
        console.print()

    # ── Money owed BY me ─────────────────────────────────────────────────────
    all_owed_by_me = [
        (d["subject"], d["sender"], item)
        for d in data
        for item in d.get("money_owed_by_me", [])
    ]
    if all_owed_by_me:
        console.rule("[bold red]MONEY YOU OWE[/bold red]", style="red")
        console.print()
        t = Table(box=box.ROUNDED, show_header=True, header_style="bold red",
                  border_style="red", expand=True)
        t.add_column("What For", ratio=3)
        t.add_column("Amount", ratio=2)
        t.add_column("Due Date", ratio=2)
        t.add_column("Pay To", ratio=2)
        t.add_column("Email Subject", ratio=3)
        for subject, sender, item in all_owed_by_me:
            t.add_row(
                item.get("description", ""),
                item.get("amount", "unspecified"),
                item.get("due_date", "unspecified"),
                item.get("payee", "unknown"),
                _truncate(subject),
            )
        console.print(t)
        console.print()

    # ── Money owed TO me ─────────────────────────────────────────────────────
    all_owed_to_me = [
        (d["subject"], d["sender"], item)
        for d in data
        for item in d.get("money_owed_to_me", [])
    ]
    if all_owed_to_me:
        console.rule("[bold green]MONEY OWED TO YOU[/bold green]", style="green")
        console.print()
        t = Table(box=box.ROUNDED, show_header=True, header_style="bold green",
                  border_style="green", expand=True)
        t.add_column("What For", ratio=3)
        t.add_column("Amount", ratio=2)
        t.add_column("Expected By", ratio=2)
        t.add_column("From", ratio=2)
        t.add_column("Email Subject", ratio=3)
        for subject, sender, item in all_owed_to_me:
            t.add_row(
                item.get("description", ""),
                item.get("amount", "unspecified"),
                item.get("due_date", "unspecified"),
                item.get("payer", "unknown"),
                _truncate(subject),
            )
        console.print(t)
        console.print()

    # ── Scheduling ───────────────────────────────────────────────────────────
    all_scheduling = [
        (d["subject"], item)
        for d in data
        for item in d.get("scheduling", [])
    ]
    if all_scheduling:
        console.rule("[bold yellow]SCHEDULING & DEADLINES[/bold yellow]", style="yellow")
        console.print()
        t = Table(box=box.ROUNDED, show_header=True, header_style="bold yellow",
                  border_style="yellow", expand=True)
        t.add_column("Item", ratio=4)
        t.add_column("Deadline", ratio=2)
        t.add_column("Action Needed", ratio=4)
        t.add_column("Email Subject", ratio=3)
        for subject, item in all_scheduling:
            t.add_row(
                item.get("description", ""),
                item.get("deadline", "unspecified"),
                item.get("action_needed", ""),
                _truncate(subject),
            )
        console.print(t)
        console.print()

    # ── Action items ─────────────────────────────────────────────────────────
    all_actions = [
        (d["subject"], d["sender"], action)
        for d in data
        for action in d.get("action_items", [])
    ]
    if all_actions:
        console.rule("[bold magenta]ACTION ITEMS[/bold magenta]", style="magenta")
        console.print()
        for i, (subject, sender, action) in enumerate(all_actions, 1):
            console.print(
                f"  [bold magenta]{i:>2}.[/bold magenta]  {action}",
            )
            console.print(
                f"       [dim]From: {_truncate(sender, 50)}  |  Subject: {_truncate(subject, 50)}[/dim]",
            )
        console.print()

    # ── Per-email detail (important emails only) ──────────────────────────────
    important_emails = [d for d in data if d.get("is_important")]
    if important_emails:
        console.rule("[bold cyan]IMPORTANT EMAILS — DETAIL[/bold cyan]", style="cyan")
        console.print()
        for d in important_emails:
            flags_text = _render_flags(d.get("flags", []))
            header = Text()
            header.append(f"  {_truncate(d['subject'], 70)}\n", style="bold")
            header.append(f"  From: {_truncate(d['sender'], 60)}\n", style="dim")
            header.append(f"  Date: {d.get('date', '')}\n", style="dim")
            header.append("  ")
            header.append_text(flags_text)

            console.print(
                Panel(
                    header,
                    subtitle=f"[italic]{d.get('summary', '')}[/italic]",
                    border_style="cyan",
                    padding=(0, 1),
                )
            )
        console.print()

    if total == 0:
        console.print("[dim]No analyzed emails found. Run 'fetch' and 'analyze' first.[/dim]")

    console.rule(style="dim")
    console.print()
