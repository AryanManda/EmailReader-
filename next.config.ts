import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep imapflow and mailparser server-side only — they use Node.js
  // built-ins (net, tls) that cannot run in the Edge runtime.
  serverExternalPackages: ['imapflow', 'mailparser'],
}

export default nextConfig
