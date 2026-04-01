import { NextResponse } from 'next/server'
import { fetchEmails } from '@/lib/imap'

// Must use Node.js runtime — imapflow requires net/tls which are unavailable in Edge
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  try {
    const emails = await fetchEmails()
    return NextResponse.json({ emails })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
