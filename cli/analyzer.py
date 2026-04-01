"""
AI analysis engine — uses Claude Opus 4.6 to analyze emails and extract:
  - Meetings / appointments
  - Money owed by the user
  - Money owed to the user
  - Scheduling / calendar items
  - Action items and flags
"""

import json
import anthropic

SYSTEM_PROMPT = """\
You are an expert email assistant. Your job is to read emails and extract structured \
information that helps the user stay on top of their commitments.

You must respond ONLY with a valid JSON object — no extra text, no markdown fences.

Analyze the email and return this exact JSON structure:
{
  "summary": "<one sentence summary of the email>",
  "is_important": <true or false>,
  "flags": ["<flag1>", "<flag2>"],
  "meetings": [
    {
      "description": "<what the meeting is about>",
      "date_time": "<when, as stated in the email>",
      "location": "<where, or 'virtual' or 'unknown'>",
      "organizer": "<who is organizing>",
      "attendees": ["<name or email>"]
    }
  ],
  "money_owed_by_me": [
    {
      "description": "<what the payment is for>",
      "amount": "<amount with currency, or 'unspecified'>",
      "due_date": "<when it's due, or 'unspecified'>",
      "payee": "<who to pay>"
    }
  ],
  "money_owed_to_me": [
    {
      "description": "<what the payment is for>",
      "amount": "<amount with currency, or 'unspecified'>",
      "due_date": "<when it's due, or 'unspecified'>",
      "payer": "<who owes you>"
    }
  ],
  "scheduling": [
    {
      "description": "<what needs to be scheduled or is time-sensitive>",
      "deadline": "<date/time or 'unspecified'>",
      "action_needed": "<what the user needs to do>"
    }
  ],
  "action_items": ["<specific thing the user must do>"]
}

Rules:
- Return empty arrays [] when there is nothing to report in that category.
- is_important = true if the email requires action, involves money, has a meeting, or has a deadline.
- flags examples: "MEETING", "INVOICE", "PAYMENT_DUE", "PAYMENT_INCOMING", "DEADLINE",
  "RSVP_REQUIRED", "FOLLOW_UP", "URGENT", "SCHEDULING"
- For money_owed_by_me: only include if the email indicates the user owes money or has an unpaid bill.
- For money_owed_to_me: only include if someone owes the user money or a reimbursement is expected.
- action_items: concrete, specific tasks the user should do as a result of this email.
"""


def analyze_email(
    client: anthropic.Anthropic,
    subject: str,
    sender: str,
    date: str,
    body: str,
    your_name: str = "",
) -> dict:
    """
    Analyze a single email with Claude Opus 4.6 and return structured data.
    """
    user_context = f"The user's name is: {your_name}\n\n" if your_name else ""

    user_message = f"""{user_context}Please analyze this email:

FROM: {sender}
DATE: {date}
SUBJECT: {subject}

BODY:
{body}
"""

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=2048,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        final = stream.get_final_message()

    # Extract the text block (thinking blocks come first with adaptive thinking)
    text = ""
    for block in final.content:
        if block.type == "text":
            text = block.text.strip()
            break

    # Strip markdown code fences if Claude added them despite instructions
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        ).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Return a safe fallback structure if parsing fails
        return {
            "summary": f"Could not parse analysis for: {subject}",
            "is_important": False,
            "flags": [],
            "meetings": [],
            "money_owed_by_me": [],
            "money_owed_to_me": [],
            "scheduling": [],
            "action_items": [],
        }
