import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import crypto from 'crypto'
import type { RawEmail } from './types'

export interface ImapConfig {
  server:    string
  port:      number
  address:   string
  password:  string
  daysBack:  number
  maxEmails: number
}

export function getImapConfigFromEnv(): Partial<ImapConfig> {
  return {
    server:    process.env.IMAP_SERVER,
    port:      Number(process.env.IMAP_PORT   ?? 993),
    address:   process.env.EMAIL_ADDRESS,
    password:  process.env.EMAIL_PASSWORD,
    daysBack:  Number(process.env.FETCH_DAYS  ?? 7),
    maxEmails: Number(process.env.MAX_EMAILS  ?? 50),
  }
}

export async function fetchEmails(config: ImapConfig): Promise<RawEmail[]> {
  const since = new Date(Date.now() - config.daysBack * 86_400_000)

  const client = new ImapFlow({
    host:   config.server,
    port:   config.port,
    secure: true,
    auth:   { user: config.address, pass: config.password },
    logger: false,
  })

  await client.connect()
  const collected: RawEmail[] = []

  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      for await (const msg of client.fetch({ since }, { source: true })) {
        if (!msg.source) continue

        const parsed = await simpleParser(msg.source as Buffer)

        const messageId  = String(parsed.messageId ?? '')
        const fingerprint = messageId || `${parsed.from?.text ?? ''}${parsed.subject ?? ''}${parsed.date ?? ''}`
        const id = crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)

        let body = parsed.text ?? ''
        if (body.length > 8000) body = body.slice(0, 8000) + '\n\n[... email truncated ...]'

        collected.push({
          id,
          subject: parsed.subject        ?? '(No Subject)',
          sender:  parsed.from?.text     ?? '',
          date:    parsed.date?.toISOString() ?? '',
          body,
        })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  return collected
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, config.maxEmails)
}
