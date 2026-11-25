// Every setting the server has, read once at boot.
// Nothing here is sent to the browser.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Minimal .env reader so the project has no dependency on dotenv.
function loadEnvFile() {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const key = m[1]
      let value = m[2].trim()
      if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1)
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // No .env file. Defaults below apply.
  }
}
loadEnvFile()

const env = process.env
const bool = (v, fallback = false) => (v === undefined ? fallback : /^(1|true|yes|on)$/i.test(v))
const list = (v, fallback = []) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback)

const BLUUM_BASE_URLS = {
  sandbox: 'https://sandbox.api.bluumfinance.com/v1',
  production: 'https://api.bluumfinance.com/v1',
}

const bluumEnv = (env.BLUUM_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox'
let mode = (env.BLUUM_MODE || 'mock').toLowerCase() === 'live' ? 'live' : 'mock'

// Guard rails. A missing key must never silently become a live call, and
// production must be switched on deliberately.
const warnings = []
if (mode === 'live' && !env.BLUUM_API_KEY) {
  warnings.push('BLUUM_MODE=live but BLUUM_API_KEY is empty. Falling back to mock mode.')
  mode = 'mock'
}
if (bluumEnv === 'production' && !bool(env.BLUUM_ALLOW_PRODUCTION)) {
  warnings.push('BLUUM_ENV=production without BLUUM_ALLOW_PRODUCTION=true. Using the sandbox URL.')
}

// Serverless instances start, serve and stop. Anything kept in this
// process's memory is lost without warning, so say so loudly rather than
// letting it look like data loss later.
if (env.VERCEL) {
  if (!env.DATABASE_URL) {
    warnings.push(
      'Running serverless with no DATABASE_URL. Logins, gifts and webhook records will vanish between requests. Set DATABASE_URL.',
    )
  }
  if (mode === 'mock') {
    warnings.push(
      'Running serverless in mock mode. The sample data lives in memory, so holdings and orders will reset unpredictably. Use it for a look around, not a demo.',
    )
  }
}

export const config = {
  port: Number(env.PORT || 4000),
  webOrigin: env.WEB_ORIGIN || 'http://localhost:5173',
  sessionSecret: env.SESSION_SECRET || 'dev-only-insecure-secret',
  isProduction: env.NODE_ENV === 'production',

  bluum: {
    mode, // 'mock' | 'live'
    env: bluumEnv,
    baseUrl:
      bluumEnv === 'production' && bool(env.BLUUM_ALLOW_PRODUCTION)
        ? BLUUM_BASE_URLS.production
        : BLUUM_BASE_URLS.sandbox,
    apiKey: env.BLUUM_API_KEY || '',
    apiSecret: env.BLUUM_API_SECRET || '',
    webhookSecret: env.BLUUM_WEBHOOK_SECRET || '',
    timeoutMs: Number(env.BLUUM_TIMEOUT_MS || 20000),
  },

  db: { url: env.DATABASE_URL || '' },

  mail: {
    mode: (env.MAIL_MODE || 'console').toLowerCase(),
    from: env.MAIL_FROM || 'Dividendii Investments <no-reply@dividendii.com>',
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
  },

  kyc: {
    storage: (env.KYC_STORAGE || 'forward-only').toLowerCase(), // 'forward-only' | 'store'
    dir: env.KYC_DIR || './.kyc-uploads',
    // Serverless platforms cap a request body at about 4.5 MB, so this is
    // set under it. On a server of your own it can be raised.
    maxFileBytes: Number(env.KYC_MAX_FILE_BYTES || 4 * 1024 * 1024),
  },

  markets: list(env.MARKETS, ['NG', 'US', 'KE']),

  warnings,
}

// What each market trades. Hours come from the Bluum docs; Nairobi's are not
// documented, so they are marked unknown rather than guessed.
export const MARKETS = {
  NG: {
    code: 'NG',
    name: 'Nigeria',
    currency: 'NGN',
    venue: 'XNSA',
    hours: '10:00 to 14:20 West Africa Time',
    extendedHours: false,
    hoursConfirmed: true,
  },
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    venue: 'XNAS/XNYS',
    hours: '09:30 to 16:00 Eastern Time',
    extendedHours: true,
    hoursConfirmed: true,
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    currency: 'KES',
    venue: 'XNAI',
    hours: 'Not documented by Bluum. Confirm before launch.',
    extendedHours: false,
    hoursConfirmed: false,
  },
}

export const activeMarkets = () => config.markets.map((code) => MARKETS[code]).filter(Boolean)
