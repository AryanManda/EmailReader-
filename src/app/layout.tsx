import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EmailReader — AI Email Intelligence',
  description: 'Scan your inbox and get a smart report on meetings, money, and action items.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
