'use client'

import { useState, useCallback, useEffect } from 'react'
import type { AnalysisResult, Meeting, MoneyItem, SchedulingItem, RawEmail } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Settings {
  emailAddress: string
  password:     string
  yourName:     string
  daysBack:     number
  maxEmails:    number
}

const DEFAULT_SETTINGS: Settings = {
  emailAddress: '',
  password:     '',
  yourName:     '',
  daysBack:     7,
  maxEmails:    50,
}

const STORAGE_KEY  = 'emailreader_settings'
const CONCURRENCY  = 5

// ── LocalStorage helpers ──────────────────────────────────────────────────────
function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function trunc(s: string, n = 55) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function flagBadge(flag: string) {
  const styles: Record<string, string> = {
    MEETING:          'bg-blue-100 text-blue-800',
    INVOICE:          'bg-red-100 text-red-800',
    PAYMENT_DUE:      'bg-red-100 text-red-800',
    PAYMENT_INCOMING: 'bg-green-100 text-green-800',
    DEADLINE:         'bg-amber-100 text-amber-800',
    RSVP_REQUIRED:    'bg-purple-100 text-purple-800',
    FOLLOW_UP:        'bg-cyan-100 text-cyan-800',
    URGENT:           'bg-red-200 text-red-900 font-bold',
    SCHEDULING:       'bg-blue-100 text-blue-800',
    ERROR:            'bg-slate-100 text-slate-600',
  }
  const cls = styles[flag.toUpperCase()] ?? 'bg-slate-100 text-slate-600'
  return (
    <span key={flag} className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {flag}
    </span>
  )
}

// ── Settings Form ─────────────────────────────────────────────────────────────
function SettingsForm({ onSave }: { onSave: (s: Settings) => void }) {
  const [form, setForm]       = useState<Settings>(DEFAULT_SETTINGS)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => { setForm(loadSettings()) }, [])

  function set(field: keyof Settings, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    saveSettings(form)
    onSave(form)
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Gmail credentials */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Gmail Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={form.emailAddress}
            onChange={e => set('emailAddress', e.target.value)}
            placeholder="you@gmail.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            App Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              required
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Not your Google password —{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              create an App Password here ↗
            </a>
          </p>
        </div>
      </div>

      {/* Optional fields */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
          <input
            type="text"
            value={form.yourName}
            onChange={e => set('yourName', e.target.value)}
            placeholder="Jane Smith (optional)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Days to scan</label>
          <select
            value={form.daysBack}
            onChange={e => set('daysBack', Number(e.target.value))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1, 3, 7, 14, 30].map(d => (
              <option key={d} value={d}>Last {d} {d === 1 ? 'day' : 'days'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Max emails</label>
          <select
            value={form.maxEmails}
            onChange={e => set('maxEmails', Number(e.target.value))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 25, 50, 100].map(n => (
              <option key={n} value={n}>{n} emails</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Save &amp; Connect
        </button>
        <p className="text-xs text-slate-400">
          Credentials are saved locally in your browser and never stored on a server.
        </p>
      </div>
    </form>
  )
}

// ── Section helpers ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count, color }: {
  icon: string; title: string; count: number; color: string
}) {
  return (
    <div className={`flex items-center gap-2 pb-3 mb-4 border-b-2 ${color}`}>
      <span className="text-xl">{icon}</span>
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <span className="ml-auto bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-slate-400 text-sm py-4 text-center">{text}</p>
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2 pr-4">
      {children}
    </th>
  )
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 pr-4 text-sm align-top ${className}`}>{children}</td>
}

// ── Report sections ───────────────────────────────────────────────────────────
function MeetingsSection({ items }: { items: Array<Meeting & { emailSubject: string }> }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader icon="📅" title="Meetings & Appointments" count={items.length} color="border-blue-400" />
      {items.length === 0 ? <EmptyState text="No meetings found." /> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>Description</Th><Th>When</Th><Th>Where</Th><Th>Organizer</Th><Th>Email</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((m, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <Td className="font-medium">{m.description}</Td>
                  <Td className="text-blue-700">{m.date_time}</Td>
                  <Td className="text-slate-500">{m.location}</Td>
                  <Td className="text-slate-500">{m.organizer}</Td>
                  <Td className="text-slate-400">{trunc(m.emailSubject)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MoneySection({ items, type }: {
  items: Array<MoneyItem & { emailSubject: string }>
  type: 'owed-by-me' | 'owed-to-me'
}) {
  const byMe = type === 'owed-by-me'
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader
        icon={byMe ? '💸' : '💰'}
        title={byMe ? 'Money You Owe' : 'Money Owed to You'}
        count={items.length}
        color={byMe ? 'border-red-400' : 'border-green-400'}
      />
      {items.length === 0 ? <EmptyState text={byMe ? 'No outstanding bills found.' : 'No incoming payments found.'} /> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <Th>What For</Th><Th>Amount</Th>
              <Th>{byMe ? 'Due Date' : 'Expected By'}</Th>
              <Th>{byMe ? 'Pay To' : 'From'}</Th>
              <Th>Email</Th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((m, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <Td className="font-medium">{m.description}</Td>
                  <Td className={`font-semibold ${byMe ? 'text-red-600' : 'text-green-600'}`}>{m.amount}</Td>
                  <Td className="text-amber-600">{m.due_date}</Td>
                  <Td className="text-slate-500">{byMe ? m.payee : m.payer}</Td>
                  <Td className="text-slate-400">{trunc(m.emailSubject)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SchedulingSection({ items }: { items: Array<SchedulingItem & { emailSubject: string }> }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader icon="📆" title="Scheduling & Deadlines" count={items.length} color="border-amber-400" />
      {items.length === 0 ? <EmptyState text="No scheduling items or deadlines found." /> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>Item</Th><Th>Deadline</Th><Th>Action Needed</Th><Th>Email</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((s, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <Td className="font-medium">{s.description}</Td>
                  <Td className="text-amber-600">{s.deadline}</Td>
                  <Td>{s.action_needed}</Td>
                  <Td className="text-slate-400">{trunc(s.emailSubject)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ActionItemsSection({ items }: {
  items: Array<{ text: string; emailSubject: string; emailSender: string }>
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader icon="✅" title="Action Items" count={items.length} color="border-purple-400" />
      {items.length === 0 ? <EmptyState text="No action items found." /> : (
        <ol className="space-y-3">
          {items.map((a, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">{a.text}</p>
                <p className="text-xs text-slate-400 mt-0.5">{trunc(a.emailSender, 40)} · {trunc(a.emailSubject, 40)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ImportantEmailsSection({ emails }: { emails: AnalysisResult[] }) {
  if (emails.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader icon="⭐" title="Important Emails" count={emails.length} color="border-slate-400" />
      <div className="space-y-3">
        {emails.map(e => (
          <div key={e.emailId} className="border border-slate-100 rounded-lg p-4 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{e.subject}</p>
                <p className="text-xs text-slate-400 mt-0.5">{trunc(e.sender, 60)} · {e.date.slice(0, 10)}</p>
              </div>
              <div className="flex flex-wrap gap-1 flex-shrink-0">{e.flags.map(f => flagBadge(f))}</div>
            </div>
            {e.summary && <p className="text-sm text-slate-600 mt-2 italic">{e.summary}</p>}
            {e.error    && <p className="text-xs text-red-500 mt-1">Error: {e.error}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsOverview({ results }: { results: AnalysisResult[] }) {
  const stats = [
    { label: 'Emails analyzed',   value: results.length,                                                color: 'text-slate-700'  },
    { label: 'Flagged important', value: results.filter(r => r.is_important).length,                   color: 'text-blue-600'   },
    { label: 'Meetings',          value: results.reduce((n, r) => n + r.meetings.length, 0),           color: 'text-blue-600'   },
    { label: 'Bills to pay',      value: results.reduce((n, r) => n + r.money_owed_by_me.length, 0),  color: 'text-red-600'    },
    { label: 'Payments incoming', value: results.reduce((n, r) => n + r.money_owed_to_me.length, 0),  color: 'text-green-600'  },
    { label: 'Deadlines',         value: results.reduce((n, r) => n + r.scheduling.length, 0),        color: 'text-amber-600'  },
    { label: 'Action items',      value: results.reduce((n, r) => n + r.action_items.length, 0),      color: 'text-purple-600' },
  ]
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressSection({ completed, total, subject }: {
  completed: number; total: number; subject: string
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex justify-between text-sm text-slate-600 mb-2">
        <span>Analyzing emails with Claude AI…</span>
        <span className="font-medium">{completed} / {total}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3">
        <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      {subject && <p className="text-xs text-slate-400 truncate">Reading: {subject}</p>}
    </div>
  )
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Stage = 'idle' | 'fetching' | 'analyzing' | 'done' | 'error'

export default function Home() {
  const [settings,       setSettings]       = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsOpen,   setSettingsOpen]   = useState(false)
  const [isConfigured,   setIsConfigured]   = useState(false)
  const [stage,          setStage]          = useState<Stage>('idle')
  const [total,          setTotal]          = useState(0)
  const [completed,      setCompleted]      = useState(0)
  const [currentSubject, setCurrentSubject] = useState('')
  const [results,        setResults]        = useState<AnalysisResult[]>([])
  const [errorMsg,       setErrorMsg]       = useState('')

  // Load settings from localStorage on mount
  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    setIsConfigured(Boolean(s.emailAddress && s.password))
    if (!s.emailAddress || !s.password) setSettingsOpen(true)
  }, [])

  function handleSettingsSave(s: Settings) {
    setSettings(s)
    setIsConfigured(Boolean(s.emailAddress && s.password))
    setSettingsOpen(false)
  }

  const runAnalysis = useCallback(async () => {
    if (!settings.emailAddress || !settings.password) {
      setSettingsOpen(true)
      return
    }

    setStage('fetching')
    setResults([])
    setCompleted(0)
    setCurrentSubject('')
    setErrorMsg('')

    // Step 1: Fetch emails
    let emails: RawEmail[]
    try {
      const res = await fetch('/api/fetch-emails', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          address:   settings.emailAddress,
          password:  settings.password,
          server:    'imap.gmail.com',
          port:      993,
          daysBack:  settings.daysBack,
          maxEmails: settings.maxEmails,
        }),
      })
      const data: { emails?: RawEmail[]; error?: string } = await res.json()
      if (data.error || !data.emails) throw new Error(data.error ?? 'Failed to fetch emails')
      emails = data.emails
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStage('error')
      return
    }

    if (emails.length === 0) { setStage('done'); return }

    setTotal(emails.length)
    setStage('analyzing')

    // Step 2: Analyze in parallel batches of CONCURRENCY
    const allResults: AnalysisResult[] = []

    for (let i = 0; i < emails.length; i += CONCURRENCY) {
      const batch = emails.slice(i, i + CONCURRENCY)
      setCurrentSubject(batch[0].subject)

      const batchResults = await Promise.all(
        batch.map(email =>
          fetch('/api/analyze-email', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, yourName: settings.yourName }),
          }).then(r => r.json() as Promise<AnalysisResult>)
        )
      )

      allResults.push(...batchResults)
      setCompleted(allResults.length)
      setResults([...allResults])
    }

    setStage('done')
    setCurrentSubject('')
  }, [settings])

  const isRunning = stage === 'fetching' || stage === 'analyzing'

  // Aggregate report data
  const meetings    = results.flatMap(r => r.meetings.map(m => ({ ...m, emailSubject: r.subject })))
  const moneyByMe   = results.flatMap(r => r.money_owed_by_me.map(m => ({ ...m, emailSubject: r.subject })))
  const moneyToMe   = results.flatMap(r => r.money_owed_to_me.map(m => ({ ...m, emailSubject: r.subject })))
  const scheduling  = results.flatMap(r => r.scheduling.map(s => ({ ...s, emailSubject: r.subject })))
  const actionItems = results.flatMap(r => r.action_items.map(t => ({ text: t, emailSubject: r.subject, emailSender: r.sender })))
  const important   = results.filter(r => r.is_important)

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <span className="text-2xl">📧</span>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">EmailReader</h1>
            <p className="text-xs text-slate-400">AI-powered email intelligence</p>
          </div>
          {/* Settings toggle */}
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              settingsOpen
                ? 'bg-slate-200 text-slate-700'
                : isConfigured
                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            ⚙️ {isConfigured ? 'Settings' : 'Connect Gmail'}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Settings panel ── */}
        {settingsOpen && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Connect Your Gmail</h2>
            <p className="text-sm text-slate-500 mb-5">
              Your credentials are stored only in your browser and sent securely to analyze your emails.
            </p>
            <SettingsForm onSave={handleSettingsSave} />
          </div>
        )}

        {/* ── Not configured banner ── */}
        {!isConfigured && !settingsOpen && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <p className="font-semibold text-amber-800">Connect your Gmail to get started</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Click <strong>Connect Gmail</strong> in the top right to enter your credentials.
              </p>
            </div>
          </div>
        )}

        {/* ── Run card ── */}
        {isConfigured && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="font-semibold text-slate-800">Generate Email Report</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Scanning <strong>{settings.emailAddress}</strong> · last {settings.daysBack} day{settings.daysBack > 1 ? 's' : ''} · up to {settings.maxEmails} emails
              </p>
            </div>
            <button
              onClick={runAnalysis}
              disabled={isRunning}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors whitespace-nowrap"
            >
              {isRunning
                ? <><Spinner /> {stage === 'fetching' ? 'Fetching emails…' : `Analyzing ${completed}/${total}…`}</>
                : <><span>🔍</span> Generate Report</>}
            </button>
          </div>
        )}

        {/* ── Fetching state ── */}
        {stage === 'fetching' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-3">
            <Spinner className="text-blue-500" />
            <p className="text-sm text-slate-600">Connecting to Gmail and fetching messages…</p>
          </div>
        )}

        {/* ── Progress ── */}
        {stage === 'analyzing' && (
          <ProgressSection completed={completed} total={total} subject={currentSubject} />
        )}

        {/* ── Error ── */}
        {stage === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="font-semibold text-red-700">Something went wrong</p>
            <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
            {(errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('login') || errorMsg.toLowerCase().includes('credentials')) && (
              <div className="mt-3 text-xs text-red-500 space-y-1">
                <p>💡 Make sure you&apos;re using a <strong>Gmail App Password</strong>, not your regular Google password.</p>
                <p>
                  Create one at{' '}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">
                    myaccount.google.com/apppasswords
                  </a>
                </p>
              </div>
            )}
            <button
              onClick={() => { setStage('idle'); setSettingsOpen(true) }}
              className="mt-3 text-sm text-red-600 underline hover:text-red-800"
            >
              Update settings
            </button>
          </div>
        )}

        {/* ── Report ── */}
        {results.length > 0 && (
          <>
            <StatsOverview     results={results} />
            <MeetingsSection   items={meetings} />
            <MoneySection      items={moneyByMe} type="owed-by-me" />
            <MoneySection      items={moneyToMe} type="owed-to-me" />
            <SchedulingSection items={scheduling} />
            <ActionItemsSection items={actionItems} />
            <ImportantEmailsSection emails={important} />
          </>
        )}

        {/* ── All clear ── */}
        {stage === 'done' && results.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-semibold text-slate-700">All clear!</p>
            <p className="text-sm text-slate-400 mt-1">No emails found in the configured date range.</p>
          </div>
        )}
      </div>
    </main>
  )
}
