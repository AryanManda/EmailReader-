import { NextRequest, NextResponse } from 'next/server'
import { analyzeEmail } from '@/lib/analyzer'
import type { AnalysisResult, RawEmail } from '@/lib/types'

export const runtime    = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const body: { email: RawEmail; yourName?: string } = await req.json()
  const { email, yourName } = body

  try {
    const raw = await analyzeEmail(email, yourName)

    const result: AnalysisResult = {
      emailId:          email.id,
      subject:          email.subject,
      sender:           email.sender,
      date:             email.date,
      summary:          String(raw.summary          ?? ''),
      is_important:     Boolean(raw.is_important),
      flags:            Array.isArray(raw.flags)            ? (raw.flags            as string[])                          : [],
      meetings:         Array.isArray(raw.meetings)         ? (raw.meetings         as AnalysisResult['meetings'])         : [],
      money_owed_by_me: Array.isArray(raw.money_owed_by_me) ? (raw.money_owed_by_me as AnalysisResult['money_owed_by_me']) : [],
      money_owed_to_me: Array.isArray(raw.money_owed_to_me) ? (raw.money_owed_to_me as AnalysisResult['money_owed_to_me']) : [],
      scheduling:       Array.isArray(raw.scheduling)       ? (raw.scheduling       as AnalysisResult['scheduling'])       : [],
      action_items:     Array.isArray(raw.action_items)     ? (raw.action_items     as string[])                          : [],
    }

    return NextResponse.json(result)
  } catch (err) {
    // Return 200 with error flag so the frontend collects partial results
    const result: AnalysisResult = {
      emailId: email.id, subject: email.subject, sender: email.sender, date: email.date,
      summary: 'Analysis failed', is_important: false,
      flags: ['ERROR'], meetings: [], money_owed_by_me: [],
      money_owed_to_me: [], scheduling: [], action_items: [],
      error: err instanceof Error ? err.message : String(err),
    }
    return NextResponse.json(result)
  }
}
