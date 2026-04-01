import Anthropic from '@anthropic-ai/sdk'
import type { RawEmail } from './types'

const SYSTEM_PROMPT = `\
You are an expert email assistant. Read the email and extract structured information.

Respond ONLY with a valid JSON object — no extra text, no markdown fences.

Use this exact structure:
{
  "summary": "<one sentence summary>",
  "is_important": <true or false>,
  "flags": ["<flag>"],
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
      "due_date": "<when due, or 'unspecified'>",
      "payee": "<who to pay>"
    }
  ],
  "money_owed_to_me": [
    {
      "description": "<what the payment is for>",
      "amount": "<amount with currency, or 'unspecified'>",
      "due_date": "<when expected, or 'unspecified'>",
      "payer": "<who owes you>"
    }
  ],
  "scheduling": [
    {
      "description": "<what needs scheduling or is time-sensitive>",
      "deadline": "<date/time or 'unspecified'>",
      "action_needed": "<what the user must do>"
    }
  ],
  "action_items": ["<specific task the user must do>"]
}

Rules:
- Return empty arrays [] when nothing applies in that category.
- is_important = true if the email requires action, involves money, has a meeting, or has a deadline.
- flags: use any of MEETING, INVOICE, PAYMENT_DUE, PAYMENT_INCOMING, DEADLINE, RSVP_REQUIRED, FOLLOW_UP, URGENT, SCHEDULING.
- money_owed_by_me: only if the user has an unpaid bill or owes someone money.
- money_owed_to_me: only if someone owes the user money or a reimbursement is expected.
- action_items: concrete, specific tasks derived from this email.`

export async function analyzeEmail(email: RawEmail, yourName?: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY environment variable.')

  const client = new Anthropic({ apiKey })
  const userContext = yourName ? `The user's name is: ${yourName}\n\n` : ''

  const response = await client.messages.create({
    model:     'claude-opus-4-6',
    max_tokens: 4096,
    thinking:  { type: 'adaptive' },
    system:    SYSTEM_PROMPT,
    messages:  [{ role: 'user', content: `${userContext}Please analyze this email:\n\nFROM: ${email.sender}\nDATE: ${email.date}\nSUBJECT: ${email.subject}\n\nBODY:\n${email.body}` }],
  })

  let text = ''
  for (const block of response.content) {
    if (block.type === 'text') { text = block.text.trim(); break }
  }

  if (text.startsWith('```')) {
    text = text.split('\n').filter(l => !l.trim().startsWith('```')).join('\n').trim()
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {
      summary: `Could not parse analysis for: ${email.subject}`,
      is_important: false, flags: [], meetings: [],
      money_owed_by_me: [], money_owed_to_me: [], scheduling: [], action_items: [],
    }
  }
}
