import { NextRequest, NextResponse } from 'next/server'
import { fetchEmails, getImapConfigFromEnv, type ImapConfig } from '@/lib/imap'

// Must use Node.js runtime — imapflow requires net/tls (unavailable in Edge runtime)
export const runtime    = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // Credentials can come from the request body (entered by user in the UI)
    // or fall back to environment variables (set in Vercel dashboard).
    const body = await req.json().catch(() => ({})) as Partial<ImapConfig>
    const envConfig = getImapConfigFromEnv()

    const config: ImapConfig = {
      server:    body.server    || envConfig.server    || '',
      port:      body.port      || envConfig.port      || 993,
      address:   body.address   || envConfig.address   || '',
      password:  body.password  || envConfig.password  || '',
      daysBack:  body.daysBack  || envConfig.daysBack  || 7,
      maxEmails: body.maxEmails || envConfig.maxEmails || 50,
    }

    if (!config.server || !config.address || !config.password) {
      return NextResponse.json(
        { error: 'Email credentials are required. Please fill in the settings form.' },
        { status: 400 },
      )
    }

    const emails = await fetchEmails(config)
    return NextResponse.json({ emails })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
