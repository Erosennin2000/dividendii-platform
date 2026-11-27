// The only place the screens talk to the server.
//
// Every call goes to Dividendii's own API, never to Bluum: the browser has no
// Bluum credential and never sees one.

const BASE = import.meta.env.VITE_API_BASE || '/api'

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Something went wrong.')
    this.status = status
    this.code = body?.error?.code
    this.retryable = Boolean(body?.error?.retryable)
    this.body = body
  }
}

async function request(method, path, { body, form, idempotencyKey, query } = {}) {
  const url = new URL(BASE + path, window.location.origin)
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
  })

  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, json)
  return json
}

const get = (path, query) => request('GET', path, { query })
const post = (path, body, opts) => request('POST', path, { body, ...opts })

// A key for one attempt, so tapping twice cannot pay twice.
export const newKey = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, '')

export const api = {
  health: () => get('/health'),

  auth: {
    requestCode: (email, name) => post('/auth/request-code', { email, name }),
    verify: (email, code) => post('/auth/verify', { email, code }),
    me: () => get('/auth/me'),
    signOut: () => post('/auth/signout'),
  },

  account: {
    status: () => get('/account/status'),
    openInvestor: (details) => post('/account/investor', details),
    disclosures: (step) => get('/account/disclosures', { step }),
    outstanding: (step) => get('/account/disclosures/outstanding', { step }),
    accept: (acceptances) => post('/account/disclosures/accept', { acceptances }),
    kycRequirements: () => get('/account/kyc/requirements'),
    submitKyc: (formData) => request('POST', '/account/kyc/submit', { form: formData }),
    kycDocuments: () => get('/account/kyc/documents'),
  },

  money: {
    wallets: () => get('/money/wallets'),
    transactions: (type) => get('/money/transactions', { type }),
    fundingSources: () => get('/money/funding-sources'),
    banks: (country) => get('/money/banks', { country }),
    addFundingSource: (details) => post('/money/funding-sources', details),
    deposits: () => get('/money/deposits'),
    deposit: (details, key) => post('/money/deposits', details, { idempotencyKey: key }),
    simulateDeposit: (id) => post(`/money/deposits/${id}/simulate`, {}),
    quoteWithdrawal: (details) => post('/money/withdrawals/quote', details),
    withdraw: (details, key) => post('/money/withdrawals', details, { idempotencyKey: key }),
    withdrawals: () => get('/money/withdrawals'),
  },

  market: {
    markets: () => get('/market/markets'),
    assets: (query) => get('/market/assets', query),
    asset: (symbol) => get(`/market/assets/${encodeURIComponent(symbol)}`),
    bars: (symbol, limit = 30) => get(`/market/assets/${encodeURIComponent(symbol)}/bars`, { limit }),
    quotes: (symbols) => get('/market/quotes', { symbols: symbols.join(',') }),
  },

  trade: {
    estimate: (order) => post('/trade/estimate', order),
    place: (order, key) => post('/trade/orders', order, { idempotencyKey: key }),
    orders: (status) => get('/trade/orders', { status }),
    cancel: (id) => post(`/trade/orders/${id}/cancel`, {}),
    simulateFill: (id) => post(`/trade/orders/${id}/simulate`, {}),
    positions: () => get('/trade/positions'),
    closePosition: (id, key) => post(`/trade/positions/${id}/close`, {}, { idempotencyKey: key }),
  },

  bonds: {
    list: () => get('/bonds'),
    get: (symbol) => get(`/bonds/${encodeURIComponent(symbol)}`),
    outstandingDisclosures: () => get('/bonds/disclosures/outstanding'),
    estimate: (order) => post('/bonds/estimate', order),
    place: (order, key) => post('/bonds/orders', order, { idempotencyKey: key }),
    holdings: () => get('/bonds/holdings/all'),
  },

  offerings: {
    list: (query) => get('/offerings', query),
    get: (id) => get(`/offerings/${id}`),
    quote: (id, units) => post(`/offerings/${id}/quote`, { units }),
    apply: (id, units, key) => post(`/offerings/${id}/apply`, { units }, { idempotencyKey: key }),
    mySubscriptions: () => get('/offerings/me/subscriptions'),
    withdrawApplication: (id) => post(`/offerings/subscriptions/${id}/withdraw`, {}),
  },

  portfolios: {
    list: () => get('/portfolios'),
    get: (id) => get(`/portfolios/${id}`),
    estimate: (details) => post('/portfolios/estimate', details),
    order: (details, key) => post('/portfolios/orders', details, { idempotencyKey: key }),
    holdings: () => get('/portfolios/me/holdings'),
  },

  gifts: {
    quote: (details) => post('/gifts/quote', details),
    create: (details, key) => post('/gifts', details, { idempotencyKey: key }),
    sent: () => get('/gifts/sent'),
    received: () => get('/gifts/received'),
    cancel: (id) => post(`/gifts/${id}/cancel`, {}),
  },

  webhooks: { recent: () => get('/webhooks/recent') },

  // Everything Bluum has no endpoint for: watchlist, alerts, news, goals,
  // statements, tickets and so on. Responses carry meta.sample = true.
  extras: {
    ticker: () => get('/extras/ticker'),
    indexes: () => get('/extras/indexes'),
    rows: (symbols) => get('/extras/rows', { symbols: symbols.join(',') }),
    watchlist: () => get('/extras/watchlist'),
    addWatch: (symbol) => post('/extras/watchlist', { symbol }),
    removeWatch: (symbol) => request('DELETE', `/extras/watchlist/${encodeURIComponent(symbol)}`),
    alerts: () => get('/extras/alerts'),
    addAlert: (alert) => post('/extras/alerts', alert),
    removeAlert: (id) => request('DELETE', `/extras/alerts/${id}`),
    search: (q) => get('/extras/search', { q }),
    history: (currency, range) => get('/extras/history', { currency, range }),
    income: (currency) => get('/extras/income', { currency }),
    upcoming: () => get('/extras/upcoming'),
    holdingHistory: (symbol) => get(`/extras/holdings/${encodeURIComponent(symbol)}/history`),
    setDividend: (symbol, setting) => request('PUT', `/extras/holdings/${encodeURIComponent(symbol)}/dividend`, { body: { setting } }),
    notifications: () => get('/extras/notifications'),
    readNotifications: () => post('/extras/notifications/read', {}),
    attention: () => get('/extras/attention'),
    news: (symbol) => get('/extras/news', { symbol }),
    calendar: () => get('/extras/calendar'),
    goals: () => get('/extras/goals'),
    addGoal: (goal) => post('/extras/goals', goal),
    removeGoal: (id) => request('DELETE', `/extras/goals/${id}`),
    plans: () => get('/extras/plans'),
    addPlan: (plan) => post('/extras/plans', plan),
    setPlan: (id, status) => request('PATCH', `/extras/plans/${id}`, { body: { status } }),
    removePlan: (id) => request('DELETE', `/extras/plans/${id}`),
    mix: (model, currency) => get('/extras/mix', { model, currency }),
    maturities: () => get('/extras/maturities'),
    setMaturity: (symbol, plan) => request('PUT', `/extras/maturities/${encodeURIComponent(symbol)}`, { body: { plan } }),
    statements: () => get('/extras/statements'),
    contractNote: (id) => get(`/extras/contract-note/${encodeURIComponent(id)}`),
    fees: () => get('/extras/fees'),
    profile: () => get('/extras/profile'),
    saveProfile: (details) => request('PUT', '/extras/profile', { body: details }),
    security: () => get('/extras/security'),
    saveSecurity: (settings) => request('PUT', '/extras/security', { body: settings }),
    removeDevice: (id) => request('DELETE', `/extras/security/devices/${id}`),
    signOutOthers: () => post('/extras/security/sign-out-others', {}),
    preferences: () => get('/extras/preferences'),
    savePreferences: (prefs) => request('PUT', '/extras/preferences', { body: prefs }),
    exportData: () => post('/extras/privacy/export', {}),
    closeAccount: () => post('/extras/privacy/close', {}),
    help: (q) => get('/extras/help', { q }),
    tickets: () => get('/extras/tickets'),
    newTicket: (t) => post('/extras/tickets', t),
    replyTicket: (id, message) => post(`/extras/tickets/${id}/reply`, { message }),
    learn: () => get('/extras/learn'),
    legal: () => get('/extras/legal'),
    rewards: () => get('/extras/rewards'),
    funds: () => get('/extras/funds'),
  },

  // Sandbox shortcuts. These endpoints refuse to exist in production.
  dev: {
    approveMe: () => post('/dev/approve-me', {}),
    fundMe: () => post('/dev/fund-me', {}),
    reset: () => post('/dev/reset', {}),
  },
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const SYMBOLS = { NGN: '₦', USD: '$', KES: 'KSh' }

export function formatMoney(amount, currency = 'NGN', { decimals = 2 } = {}) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const body = Math.abs(n).toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${sign}${SYMBOLS[currency] || `${currency} `}${body}`
}

export const formatQuantity = (q) => {
  const n = Number(q)
  if (!Number.isFinite(n)) return '—'
  // Fractional holdings need decimals; whole ones should not show .0000.
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

// A price without the currency sign, for tight columns.
export const formatPrice = (n, decimals = 2) =>
  Number.isFinite(Number(n))
    ? Number(n).toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : '—'

// Short money for headlines: ₦28.6m, $142k.
export function formatShort(amount, currency = 'NGN') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  const sym = SYMBOLS[currency] || `${currency} `
  const body = a >= 1e9 ? `${(a / 1e9).toFixed(2)}bn` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}m` : a >= 1e4 ? `${(a / 1e3).toFixed(0)}k` : a.toLocaleString('en-NG', { maximumFractionDigits: 0 })
  return `${n < 0 ? '-' : ''}${sym}${body}`
}

export const signed = (n, currency, opts) => `${Number(n) > 0 ? '+' : ''}${formatMoney(n, currency, opts)}`
export const signedPct = (n, decimals = 2) => `${Number(n) > 0 ? '+' : ''}${Number(n).toFixed(decimals)}%`
export const tone = (n) => (Number(n) > 0 ? 'up' : Number(n) < 0 ? 'dn' : '')

export const formatPercent = (value, decimals = 2) =>
  Number.isFinite(Number(value)) ? `${Number(value).toFixed(decimals)}%` : '—'

// Bluum reports a transaction time as unix seconds or as an ISO string.
export const txTime = (t) => (t?.created ? new Date(t.created * 1000).toISOString() : t?.created_at || null)

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
