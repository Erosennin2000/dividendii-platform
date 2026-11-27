// Everything on the new screens that Bluum has no endpoint for.
//
// Bluum covers accounts, money, trading, bonds, offers, portfolios and
// positions. The approved design also has a watchlist, price alerts, news,
// goals, auto-invest, statements, support tickets, preferences and more. None
// of those exist at Bluum, so they live here, on invented sample data, and
// every response says so (meta.sample = true) so a screen can show it.
//
// Per-customer state is kept in memory for now. When these features are
// confirmed as real products, each one moves to a table in db/schema.sql and
// its sample data is deleted. docs/WHATS_MISSING.md lists what needs a
// decision before that.

import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { assets, investors, wallets, positions } from '../bluum/api.js'
import { route, badRequest, notFound } from '../errors.js'
import { requireUser, requireInvestor, ok } from '../middleware.js'
import { config } from '../config.js'
import { users } from '../db/index.js'
import { sampleWalk } from '../bluum/mock.js'

const router = Router()
const sample = (res, data, meta = {}) => ok(res, data, { ...meta, sample: true })

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const bag = new Map()
const mine = (req) => {
  if (!bag.has(req.user.id)) bag.set(req.user.id, seedFor(req.user))
  return bag.get(req.user.id)
}
const id = (p) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 8)}`
const daysAgo = (n, h = 10) => {
  const d = new Date(Date.now() - n * 864e5)
  d.setHours(h, 12, 0, 0)
  return d.toISOString()
}
const daysAhead = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

const hash = (text) => {
  let h = 2166136261
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

// Seeded series so the same range draws the same line each time.
function series(key, end, count, volatility = 0.01) {
  return sampleWalk(key, end, count, volatility)
}

const RANGES = { '1D': 24, '1W': 7, '1M': 30, '3M': 90, '1Y': 120, '5Y': 120, ALL: 120 }
const RANGE_DAYS = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365, '5Y': 1825, ALL: 900 }

function seedFor(user) {
  return {
    watchlist: ['MTNN', 'ZENITHBANK', 'DANGCEM', 'SEPLAT', 'GTCO', 'NVDA', 'AAPL', 'SCOM'],
    alerts: [
      { id: id('alr'), symbol: 'MTNN', direction: 'above', price: '450.00', currency: 'NGN', channel: 'email', created_at: daysAgo(7) },
      { id: id('alr'), symbol: 'NVDA', direction: 'below', price: '130.00', currency: 'USD', channel: 'email', created_at: daysAgo(9) },
    ],
    notificationsRead: new Set(),
    goals: [
      {
        id: id('gol'), name: 'School fees fund', currency: 'NGN', target: '20000000', saved: '12400000',
        by: '2030-09-01', funded_from: ['Naija Dividend Leaders', 'FGN 2031'],
        parts: [{ name: 'Naija Dividend Leaders', kind: 'Portfolio', amount: '8200000' }, { name: 'FGN 2031', kind: 'Bond', amount: '4200000' }],
      },
      {
        id: id('gol'), name: 'Dollar savings', currency: 'USD', target: '250000', saved: '127500',
        by: '2028-06-01', funded_from: ['US Treasury Note 2034'],
        parts: [{ name: 'US Treasury Note 2034', kind: 'Bond', amount: '90000' }, { name: 'VOO', kind: 'ETF', amount: '37500' }],
      },
    ],
    plans: [
      { id: id('pln'), what: 'Naija Dividend Leaders', kind: 'portfolio', amount: '100000', currency: 'NGN', every: 'month', next: daysAhead(8), status: 'active', from: 'Naira wallet' },
      { id: id('pln'), what: 'Sample Naira Income Fund', kind: 'fund', amount: '50000', currency: 'NGN', every: 'month', next: daysAhead(13), status: 'paused', from: 'Naira wallet' },
      { id: id('pln'), what: 'NVDA', kind: 'equity', amount: '200', currency: 'USD', every: 'two weeks', next: daysAhead(5), status: 'active', from: 'Dollar wallet' },
    ],
    maturityPlans: { FGN2027: 'wallet' },
    tickets: [
      {
        id: 'TCK-1042', subject: 'Deposit not showing', status: 'replied', updated_at: daysAgo(2, 11),
        messages: [
          { from: 'you', at: daysAgo(2, 9), text: 'I sent ₦500,000 from GTBank this morning. Reference DVD-4821-AX7.' },
          { from: 'dividendii', at: daysAgo(2, 11), text: 'Thanks. We can see the transfer and it will show in your wallet by 3pm today.' },
        ],
      },
      { id: 'TCK-1019', subject: 'Change my phone number', status: 'closed', updated_at: daysAgo(9), messages: [{ from: 'you', at: daysAgo(10), text: 'Please change my phone number.' }, { from: 'dividendii', at: daysAgo(9), text: 'Done. You can check it under Profile.' }] },
      { id: 'TCK-0987', subject: 'Question about FGN 2034', status: 'closed', updated_at: daysAgo(17), messages: [{ from: 'you', at: daysAgo(18), text: 'When is the next coupon?' }, { from: 'dividendii', at: daysAgo(17), text: 'The next coupon is on 15 March 2027.' }] },
    ],
    preferences: {
      notify: { orders: true, money: true, offers: true, statements: true, news: false },
      language: 'English', home_currency: 'NGN', theme: 'Light', gain_colour: 'Green up, red down',
      default_order_type: 'market', confirm_before_trading: true, risk_profile: 'Balanced', risk_updated: daysAgo(2),
      privacy: { tips: false, usage: true },
      security: { email_code: true, withdraw_code: true, new_device: true },
    },
    devices: [
      { id: 'dev_now', name: 'Edge on Windows', place: 'Lagos', last_seen: new Date().toISOString(), current: true },
      { id: 'dev_phone', name: 'Safari on iPhone', place: 'Lagos', last_seen: daysAgo(3, 19), current: false },
    ],
    dividendSettings: { MTNN: 'cash' },
  }
}

// ---------------------------------------------------------------------------
// Static sample content
// ---------------------------------------------------------------------------
const INDEXES = [
  { code: 'ASI', name: 'All Share Index', value: 98420, change_pct: 0.9, country: 'ng' },
  { code: 'NGX30', name: 'NGX 30', value: 4215, change_pct: 0.7, country: 'ng' },
  { code: 'SPX', name: 'S&P 500', value: 6012, change_pct: 0.3, country: 'us' },
  { code: 'NSE20', name: 'NSE 20', value: 1682, change_pct: -0.2, country: 'ke' },
]
const FX = { pair: 'USD/NGN', value: 1512.4 }

const NEWS = [
  { id: 'n1', title: 'MTN Nigeria schedules half-year dividend payment', tag: 'Company notice', at: 2, symbol: 'MTNN' },
  { id: 'n2', title: 'Zenith Bank results show higher interest income', tag: 'Results', at: 5, symbol: 'ZENITHBANK' },
  { id: 'n3', title: 'Central bank holds rate at current level', tag: 'Market news', at: 26 },
  { id: 'n4', title: 'Safaricom adds new payments partner', tag: 'Company news', at: 72, symbol: 'SCOM' },
  { id: 'n5', title: 'Dangote Cement reports steady volumes', tag: 'Results', at: 98, symbol: 'DANGCEM' },
]
const CALENDAR = [
  { id: 'c1', title: 'Lekki Logistics offer closes', kind: 'Rights', date: daysAhead(3), note: '' },
  { id: 'c2', title: 'MTNN pays dividend', kind: 'Dividends', date: daysAhead(7), note: '₦12.50 a share' },
  { id: 'c3', title: 'Harbour Grid allotment', kind: 'Offers', date: daysAhead(22), note: 'Offer' },
  { id: 'c4', title: 'Zenith Bank full-year results', kind: 'Earnings', date: daysAhead(40), note: '' },
  { id: 'c5', title: 'FGN 2034 coupon', kind: 'Dividends', date: '2027-03-15', note: '18.50%' },
]

const LEARN = [
  { id: 'l1', track: 'Shares', title: 'What is a share?', minutes: 3, done: true },
  { id: 'l2', track: 'Bonds', title: 'How a bond pays you', minutes: 4, done: false },
  { id: 'l3', track: 'Shares', title: 'Market order or limit order?', minutes: 3, done: false },
  { id: 'l4', track: 'Offers', title: 'What happens in a public offer?', minutes: 5, done: false },
  { id: 'l5', track: 'Shares', title: 'Reading a company page', minutes: 4, done: false },
  { id: 'l6', track: 'Shares', title: 'Why prices go up and down', minutes: 3, done: false },
]
const GLOSSARY = [
  ['Market order', 'Buys or sells now at the best price available'],
  ['Limit order', 'Only runs at your price or better'],
  ['Coupon', 'The interest a bond pays you'],
  ['Face value', 'What a bond pays back at the end'],
]
const HELP_TOPICS = [
  ['Adding money', 'Deposits, cards, wires'], ['Buying and selling', 'Orders, fees, limits'],
  ['Bonds and offers', 'Coupons, IPOs, rights'], ['Your account', 'ID, security, tax'],
  ['Statements', 'Documents and receipts'], ['Gifts', 'Send and open gifts'],
]
const HELP_ARTICLES = [
  { id: 'h1', title: 'What is a market order and what is a limit order?', topic: 'Buying and selling', body: 'A market order buys or sells straight away at the best price available. A limit order only runs at the price you set, or a better one. If the market never reaches your price, a limit order does not run.' },
  { id: 'h2', title: 'How long do withdrawals take?', topic: 'Adding money', body: 'Withdrawals to a bank account in your name usually reach it within one banking day. Each one needs an email code. [TO CONFIRM: real timings from Bluum and the bank]' },
  { id: 'h3', title: 'When do I get my dividend?', topic: 'Your account', body: 'The company sets the payment date. The money arrives in the wallet of the currency it pays in, and you see it under Transactions.' },
  { id: 'h4', title: 'What is a public offer?', topic: 'Bonds and offers', body: 'A public offer lets you apply for shares before they list. Your money is held until allotment, and applying is a request, not a guarantee of shares.' },
]
const FEES = [
  ['Buying or selling Nigerian shares', '0.50% of the amount', 'Each order'],
  ['Buying or selling US shares and ETFs', '[TO CONFIRM]', 'Each order'],
  ['Buying or selling Kenyan shares', '[TO CONFIRM]', 'Each order'],
  ['Bonds', '[TO CONFIRM]', 'Each order'],
  ['Public offers and IPOs', '[TO CONFIRM]', 'On allotment'],
  ['Adding money by bank transfer', '₦0', 'Each deposit'],
  ['Withdrawals', '[TO CONFIRM]', 'Each withdrawal'],
]
const MODELS = {
  'Steady income': { shares: 30, bonds: 45, cash: 15, offers: 10 },
  Balanced: { shares: 50, bonds: 25, cash: 15, offers: 10 },
  Growth: { shares: 70, bonds: 10, cash: 10, offers: 10 },
}
const NOTIFICATIONS = [
  { id: 'nt1', kind: 'orders', title: 'Order filled', body: 'NVDA · $1,500.00', status: 'Filled', at: 0.5, group: 'Today' },
  { id: 'nt2', kind: 'orders', title: 'Order accepted', body: 'MTNN · ₦850,000.00', status: 'Accepted', at: 1, group: 'Today' },
  { id: 'nt3', kind: 'account', title: 'Account approved', body: 'Trading is now open', status: '', at: 2, group: 'Today' },
  { id: 'nt4', kind: 'money', title: 'Dividend received', body: 'MTNN · +₦312,500.00', status: '', at: 72, group: 'Earlier this week' },
  { id: 'nt5', kind: 'offers', title: 'Offer closing soon', body: 'Lekki Logistics Plc closes in 3 days', status: 'Closing soon', at: 80, group: 'Earlier this week' },
  { id: 'nt6', kind: 'money', title: 'Statement ready', body: 'October 2026 statement', status: 'Download', at: 90, group: 'Earlier this week' },
  { id: 'nt7', kind: 'money', title: 'Money added', body: 'Bank transfer · ₦2,000,000.00', status: 'Settled', at: 96, group: 'Earlier this week' },
]
const hoursAgo = (h) => new Date(Date.now() - h * 36e5).toISOString()

// ---------------------------------------------------------------------------
// Market chrome: ticker, market hours, indexes
// ---------------------------------------------------------------------------
function marketStatus(now = new Date()) {
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes()
  const weekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5
  const within = (from, to) => weekday && utc >= from && utc < to
  return [
    { code: 'NG', name: 'Nigeria', open: within(9 * 60, 13 * 60 + 30) },
    { code: 'US', name: 'US', open: within(14 * 60 + 30, 21 * 60) },
    { code: 'KE', name: 'Kenya', open: within(6 * 60, 12 * 60) },
  ]
}

router.get('/ticker', (_req, res) =>
  sample(res, { indexes: INDEXES, fx: FX, markets: marketStatus() }),
)

router.get('/indexes', (_req, res) => sample(res, INDEXES))

// ---------------------------------------------------------------------------
// Watchlist and alerts
// ---------------------------------------------------------------------------
async function rowsFor(symbols) {
  if (!symbols.length) return []
  const [quotes, list] = await Promise.all([
    assets.quotes(symbols.join(',')).then((r) => r.data || []).catch(() => []),
    assets.batch(symbols.join(',')).then((r) => r.data || []).catch(() => []),
  ])
  return symbols.map((symbol) => {
    const q = quotes.find((x) => x.symbol === symbol)
    const a = list.find((x) => x.symbol === symbol)
    const price = Number(q?.last_price ?? a?.price ?? 0)
    return {
      symbol,
      name: a?.name || symbol,
      currency: q?.currency || a?.currency || 'NGN',
      country: a?.country,
      class: a?.class,
      price,
      change_pct: Number(q?.change_percent ?? 0),
      spark: price ? series(symbol, price, 14) : [],
    }
  })
}

router.get(
  '/rows',
  route(async (req, res) => {
    const symbols = String(req.query?.symbols || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30)
    ok(res, await rowsFor(symbols))
  }),
)

router.get(
  '/watchlist',
  requireUser,
  route(async (req, res) => ok(res, await rowsFor(mine(req).watchlist))),
)
router.post(
  '/watchlist',
  requireUser,
  route(async (req, res) => {
    const symbol = String(req.body?.symbol || '').toUpperCase()
    if (!symbol) throw badRequest('Choose a company to follow.')
    await assets.get(symbol) // throws a clear 404 for a symbol that does not exist
    const m = mine(req)
    if (!m.watchlist.includes(symbol)) m.watchlist.push(symbol)
    ok(res, await rowsFor(m.watchlist))
  }),
)
router.delete(
  '/watchlist/:symbol',
  requireUser,
  route(async (req, res) => {
    const m = mine(req)
    m.watchlist = m.watchlist.filter((s) => s !== req.params.symbol.toUpperCase())
    ok(res, await rowsFor(m.watchlist))
  }),
)

router.get('/alerts', requireUser, (req, res) => sample(res, mine(req).alerts))
router.post(
  '/alerts',
  requireUser,
  route(async (req, res) => {
    const { symbol, direction, price, channel } = req.body || {}
    if (!symbol || !['above', 'below'].includes(direction) || !(Number(price) > 0)) {
      throw badRequest('Choose a company, above or below, and a price.')
    }
    const asset = await assets.get(String(symbol).toUpperCase())
    const alert = {
      id: id('alr'), symbol: asset.symbol, direction, price: Number(price).toFixed(2),
      currency: asset.currency, channel: channel === 'app' ? 'app' : 'email', created_at: new Date().toISOString(),
    }
    mine(req).alerts.unshift(alert)
    sample(res, alert)
  }),
)
router.delete('/alerts/:id', requireUser, (req, res) => {
  const m = mine(req)
  m.alerts = m.alerts.filter((a) => a.id !== req.params.id)
  sample(res, m.alerts)
})

// ---------------------------------------------------------------------------
// Search across companies, bonds, offers and help
// ---------------------------------------------------------------------------
router.get(
  '/search',
  route(async (req, res) => {
    const q = String(req.query?.q || '').trim()
    if (!q) return ok(res, { assets: [], bonds: [], help: [], offers: [] })
    const found = await assets.search({ q, limit: 12 }).then((r) => r.data || []).catch(() => [])
    const BOND = ['bond', 'bill', 'note']
    const ql = q.toLowerCase()
    ok(res, {
      assets: found.filter((a) => !BOND.includes(a.class)),
      bonds: found.filter((a) => BOND.includes(a.class)),
      help: HELP_ARTICLES.filter((h) => h.title.toLowerCase().includes(ql)).map(({ id: hid, title }) => ({ id: hid, title })),
    })
  }),
)

// ---------------------------------------------------------------------------
// Value over time, for the Home chart and the Portfolio screen
// ---------------------------------------------------------------------------
router.get(
  '/history',
  requireInvestor,
  route(async (req, res) => {
    const currency = String(req.query?.currency || 'NGN').toUpperCase()
    const range = RANGES[req.query?.range] ? req.query.range : '3M'
    const [pos, wal] = await Promise.all([
      positions.list(req.user.investor_id, { non_zero_only: true }).then((r) => r.data || []),
      wallets.list(req.user.investor_id).then((r) => r.data || []),
    ])
    const invested = pos.filter((p) => p.currency === currency).reduce((s, p) => s + Number(p.market_value || 0), 0)
    const cash = Number(wal.find((w) => w.currency === currency)?.available_balance || 0)
    const end = invested + cash || 0
    const count = RANGES[range]
    const values = end ? series(`${req.user.id}:${currency}:${range}`, end, count, range === '1D' ? 0.002 : 0.006) : Array(count).fill(0)
    const days = RANGE_DAYS[range]
    const step = (days * 864e5) / (count - 1)
    const points = values.map((v, i) => ({ t: new Date(Date.now() - (count - 1 - i) * step).toISOString(), v: Number(v.toFixed(2)) }))
    const start = points[0]?.v || 0
    ok(res, { currency, range, points, end, change: end - start, change_pct: start ? ((end - start) / start) * 100 : 0 }, { sample: true })
  }),
)

router.get(
  '/income',
  requireInvestor,
  route(async (req, res) => {
    const currency = String(req.query?.currency || 'NGN').toUpperCase()
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      const base = currency === 'NGN' ? 90000 : currency === 'USD' ? 60 : 4000
      return { month: d.toLocaleString('en-GB', { month: 'short' }), amount: Math.round(base * (0.5 + ((hash(currency + i) % 100) / 100) * 1.4)) }
    })
    sample(res, { currency, months, total: months.reduce((s, m) => s + m.amount, 0) })
  }),
)

router.get('/upcoming', requireUser, (_req, res) =>
  sample(res, [
    { title: 'MTNN dividend', date: daysAhead(7), amount: '312500', currency: 'NGN', kind: 'dividend' },
    { title: 'FGN 2034 coupon', date: '2027-03-15', amount: '462500', currency: 'NGN', kind: 'coupon' },
    { title: 'UST 2034 coupon', date: '2027-02-15', amount: '425', currency: 'USD', kind: 'coupon' },
  ]),
)

router.get('/holdings/:symbol/history', requireInvestor, (req, res) =>
  sample(res, {
    purchases: [
      { date: '2025-03-12', quantity: 10000, price: 318.0 },
      { date: '2025-09-03', quantity: 8000, price: 352.5 },
      { date: '2026-01-18', quantity: 5000, price: 402.0 },
      { date: '2026-06-09', quantity: 2000, price: 395.0 },
    ],
    activity: [
      { what: 'Dividend received', date: daysAgo(3).slice(0, 10), amount: '312500' },
      { what: 'Bought 2,000 shares', date: '2026-06-09', amount: '790000' },
    ],
    dividends: { yield_pct: 3.8, paid_this_year: '625000', next_payment: daysAhead(7), per_share: '12.50' },
    setting: mine(req).dividendSettings[req.params.symbol] || 'cash',
  }),
)
router.put('/holdings/:symbol/dividend', requireInvestor, (req, res) => {
  if (!['cash', 'reinvest'].includes(req.body?.setting)) throw badRequest('Choose cash or reinvest.')
  mine(req).dividendSettings[req.params.symbol] = req.body.setting
  sample(res, { setting: req.body.setting })
})

// ---------------------------------------------------------------------------
// Notifications, news, calendar
// ---------------------------------------------------------------------------
router.get('/notifications', requireUser, (req, res) => {
  const m = mine(req)
  sample(res, NOTIFICATIONS.map((n) => ({ ...n, at: hoursAgo(n.at), read: m.notificationsRead.has(n.id) })), {
    unread: NOTIFICATIONS.filter((n) => !m.notificationsRead.has(n.id)).length,
  })
})
router.post('/notifications/read', requireUser, (req, res) => {
  const m = mine(req)
  for (const n of NOTIFICATIONS) m.notificationsRead.add(n.id)
  sample(res, { unread: 0 })
})
router.get('/attention', requireUser, (_req, res) =>
  sample(res, [
    { icon: 'check', text: 'Account approved', to: '/account' },
    { icon: 'clock', text: 'Lekki Logistics Plc offer closes in 3 days', to: '/offers' },
    { icon: 'list', text: '1 order open: FGN 2034 limit at 98.40', to: '/orders' },
    { icon: 'wallet', text: '₦312,500 dividend from MTNN arrived', to: '/money/transactions' },
  ]),
)
router.get('/news', (req, res) => {
  const symbol = req.query?.symbol
  const items = NEWS.filter((n) => !symbol || n.symbol === symbol).map((n) => ({ ...n, at: hoursAgo(n.at) }))
  sample(res, items)
})
router.get('/calendar', (_req, res) => sample(res, CALENDAR))

// ---------------------------------------------------------------------------
// Goals, auto-invest, model portfolios
// ---------------------------------------------------------------------------
router.get('/goals', requireUser, (req, res) => sample(res, mine(req).goals))
router.post('/goals', requireUser, (req, res) => {
  const { name, target, currency, by } = req.body || {}
  if (!name || !(Number(target) > 0) || !by) throw badRequest('Give the goal a name, a target and a date.')
  const goal = { id: id('gol'), name: String(name).slice(0, 60), currency: currency || 'NGN', target: String(Number(target)), saved: '0', by, funded_from: [], parts: [] }
  mine(req).goals.push(goal)
  sample(res, goal)
})
router.delete('/goals/:id', requireUser, (req, res) => {
  const m = mine(req)
  m.goals = m.goals.filter((g) => g.id !== req.params.id)
  sample(res, m.goals)
})

router.get('/plans', requireUser, (req, res) => {
  const runs = [
    { date: daysAgo(22).slice(0, 10), plan: 'Naija Dividend Leaders', amount: '100000', currency: 'NGN', result: 'Filled' },
    { date: daysAgo(25).slice(0, 10), plan: 'NVDA', amount: '200', currency: 'USD', result: 'Filled' },
    { date: daysAgo(52).slice(0, 10), plan: 'Naija Dividend Leaders', amount: '100000', currency: 'NGN', result: 'Filled' },
  ]
  sample(res, { plans: mine(req).plans, runs })
})
router.post('/plans', requireUser, (req, res) => {
  const { what, amount, currency, every, start } = req.body || {}
  if (!what || !(Number(amount) > 0)) throw badRequest('Choose what to buy and an amount.')
  const plan = { id: id('pln'), what, kind: 'equity', amount: String(Number(amount)), currency: currency || 'NGN', every: every || 'month', next: start || daysAhead(7), status: 'active', from: 'Wallet' }
  mine(req).plans.push(plan)
  sample(res, plan)
})
router.patch('/plans/:id', requireUser, (req, res) => {
  const plan = mine(req).plans.find((p) => p.id === req.params.id)
  if (!plan) throw notFound('No such plan.')
  if (['active', 'paused'].includes(req.body?.status)) plan.status = req.body.status
  sample(res, plan)
})
router.delete('/plans/:id', requireUser, (req, res) => {
  const m = mine(req)
  m.plans = m.plans.filter((p) => p.id !== req.params.id)
  sample(res, m.plans)
})

router.get(
  '/mix',
  requireInvestor,
  route(async (req, res) => {
    const target = MODELS[req.query?.model] ? req.query.model : 'Balanced'
    const [pos, wal] = await Promise.all([
      positions.list(req.user.investor_id, { non_zero_only: true }).then((r) => r.data || []),
      wallets.list(req.user.investor_id).then((r) => r.data || []),
    ])
    // Counted in one currency at a time. Naira is the default.
    const currency = String(req.query?.currency || 'NGN').toUpperCase()
    const BOND = ['bond', 'bill', 'note']
    const ofCur = pos.filter((p) => p.currency === currency)
    const shares = ofCur.filter((p) => !BOND.includes(p.class)).reduce((s, p) => s + Number(p.market_value || 0), 0)
    const bonds = ofCur.filter((p) => BOND.includes(p.class)).reduce((s, p) => s + Number(p.market_value || 0), 0)
    const w = wal.find((x) => x.currency === currency)
    const cash = Number(w?.available_balance || 0)
    const offers = Number(w?.reserved_balance || 0)
    const total = shares + bonds + cash + offers || 1
    const pct = (v) => Math.round((v / total) * 100)
    const rows = [
      ['Shares', pct(shares), MODELS[target].shares],
      ['Bonds', pct(bonds), MODELS[target].bonds],
      ['Cash', pct(cash), MODELS[target].cash],
      ['Offers on hold', pct(offers), MODELS[target].offers],
    ].map(([part, now, tgt]) => ({ part, now, target: tgt, gap: now - tgt }))
    sample(res, { model: target, currency, total, rows, models: Object.keys(MODELS) })
  }),
)

router.get(
  '/maturities',
  requireInvestor,
  route(async (req, res) => {
    const pos = await positions.list(req.user.investor_id, { non_zero_only: true }).then((r) => r.data || [])
    const BOND = ['bond', 'bill', 'note']
    const bonds = pos.filter((p) => BOND.includes(p.class))
    const detail = await Promise.all(bonds.map((p) => assets.get(p.symbol).catch(() => null)))
    const plans = mine(req).maturityPlans
    const items = bonds.map((p, i) => {
      const b = detail[i]?.bond || {}
      const face = Number(p.quantity)
      const coupon = Number(b.coupon_rate || 0)
      return {
        symbol: p.symbol, name: detail[i]?.name || p.symbol, currency: p.currency, face_value: String(face),
        matures: b.maturity_date || null, coupon: b.coupon_rate || null,
        you_get: String(Math.round(face * (1 + coupon / 200))), plan: plans[p.symbol] || null,
      }
    }).filter((x) => x.matures).sort((a, b) => a.matures.localeCompare(b.matures))
    sample(res, items)
  }),
)
router.put('/maturities/:symbol', requireInvestor, (req, res) => {
  if (!['wallet', 'reinvest'].includes(req.body?.plan)) throw badRequest('Choose reinvest or move to cash.')
  mine(req).maturityPlans[req.params.symbol] = req.body.plan
  sample(res, { plan: req.body.plan })
})

// ---------------------------------------------------------------------------
// Documents, fees, profile, security, preferences, help, tickets, learn
// ---------------------------------------------------------------------------
router.get('/statements', requireUser, (_req, res) => {
  const months = ['October 2026', 'September 2026', 'August 2026', 'July 2026']
  sample(res, {
    statements: months.map((m) => ({ id: `st_${m.replace(' ', '_')}`, title: `${m} statement`, pages: 3 })),
    notes: [{ id: 'CN-20261125-0412', title: 'Buy MTNN', date: '2026-11-25' }, { id: 'CN-20261121-0388', title: 'Buy AAPL', date: '2026-11-21' }],
    tax: [{ id: 'tax_2025', title: '2025 tax summary', pages: 2 }],
    documents: [{ title: 'ID document', note: 'Uploaded 25 Nov 2026' }, { title: 'Customer agreement', note: 'Signed 25 Nov 2026' }],
  })
})
router.get('/contract-note/:id', requireInvestor, async (req, res) =>
  sample(res, {
    id: req.params.id, client: req.user.name || req.user.email, account: 'DVD-0004821',
    order: 'ord_7D1Q', exchange: 'Nigerian Exchange', symbol: 'MTNN', side: 'Buy',
    trade_date: '2026-11-25', settles: '2026-11-27',
    fills: [{ n: 1, quantity: 1200, price: 420.0 }, { n: 2, quantity: 821, price: 421.45 }],
    costs: { amount: '850000.00', fee: '4250.00', total: '854250.00' }, currency: 'NGN',
  }),
)
router.get('/fees', (_req, res) => sample(res, FEES.map(([what, fee, when]) => ({ what, fee, when }))))

router.get('/profile', requireUser, (req, res) =>
  sample(res, {
    name: req.user.name || '', email: req.user.email, phone: '', country: 'Nigeria', tax_number: '',
    date_of_birth: '', address: { street: '', city: '', state: '', country: 'Nigeria' },
    account_number: 'DVD-0004821', account_type: 'Individual', markets: config.markets,
    checks: [
      { name: 'Identity', detail: 'Passport · checked 25 Nov 2026', status: 'verified' },
      { name: 'Address', detail: 'Checked 25 Nov 2026', status: 'verified' },
      { name: 'Tax residency', detail: 'Needed for US and Kenya', status: 'waiting' },
    ],
    contact: { name: 'Tunde Adeyemi', note: 'Replies by email within one working day' },
  }),
)
router.put(
  '/profile',
  requireUser,
  route(async (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 80)
    if (name && users.update) await users.update(req.user.id, { name }).catch(() => {})
    sample(res, { saved: true })
  }),
)

router.get('/security', requireUser, (req, res) => {
  const m = mine(req)
  sample(res, {
    settings: m.preferences.security,
    devices: m.devices,
    recent: [
      { place: 'Lagos, Nigeria', at: daysAgo(0, 8) },
      { place: 'Lagos, Nigeria', at: daysAgo(1, 19) },
    ],
  })
})
router.put('/security', requireUser, (req, res) => {
  const m = mine(req)
  for (const k of ['withdraw_code', 'new_device']) if (typeof req.body?.[k] === 'boolean') m.preferences.security[k] = req.body[k]
  sample(res, m.preferences.security)
})
router.delete('/security/devices/:id', requireUser, (req, res) => {
  const m = mine(req)
  m.devices = m.devices.filter((d) => d.id !== req.params.id || d.current)
  sample(res, m.devices)
})
router.post('/security/sign-out-others', requireUser, (req, res) => {
  const m = mine(req)
  m.devices = m.devices.filter((d) => d.current)
  sample(res, m.devices)
})

router.get('/preferences', requireUser, (req, res) => sample(res, mine(req).preferences))
router.put('/preferences', requireUser, (req, res) => {
  const m = mine(req)
  const b = req.body || {}
  if (b.notify) Object.assign(m.preferences.notify, b.notify)
  if (b.privacy) Object.assign(m.preferences.privacy, b.privacy)
  for (const k of ['language', 'home_currency', 'theme', 'gain_colour', 'default_order_type', 'confirm_before_trading']) {
    if (b[k] !== undefined) m.preferences[k] = b[k]
  }
  sample(res, m.preferences)
})
router.post('/privacy/export', requireUser, (_req, res) => sample(res, { requested: true, within_days: 30 }))
router.post('/privacy/close', requireUser, (_req, res) =>
  sample(res, { started: true, blockers: ['Sell or move your holdings', 'Withdraw your cash', 'Cancel open orders'] }),
)

router.get('/help', (req, res) => {
  const q = String(req.query?.q || '').toLowerCase()
  sample(res, {
    topics: HELP_TOPICS.map(([title, note]) => ({ title, note })),
    articles: HELP_ARTICLES.filter((a) => !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)),
    contact: { email: 'help@dividendii.com', reply: 'We reply within one working day' },
  })
})
router.get('/help/:id', (req, res) => {
  const a = HELP_ARTICLES.find((x) => x.id === req.params.id)
  if (!a) throw notFound('No such article.')
  sample(res, a)
})

router.get('/tickets', requireUser, (req, res) => sample(res, mine(req).tickets))
router.post('/tickets', requireUser, (req, res) => {
  const { subject, message } = req.body || {}
  if (!subject || !message) throw badRequest('Add a subject and a message.')
  const m = mine(req)
  const ticket = {
    id: `TCK-${1043 + m.tickets.length}`, subject: String(subject).slice(0, 100), status: 'open', updated_at: new Date().toISOString(),
    messages: [{ from: 'you', at: new Date().toISOString(), text: String(message).slice(0, 2000) }],
  }
  m.tickets.unshift(ticket)
  sample(res, ticket)
})
router.post('/tickets/:id/reply', requireUser, (req, res) => {
  const t = mine(req).tickets.find((x) => x.id === req.params.id)
  if (!t) throw notFound('No such ticket.')
  if (!req.body?.message) throw badRequest('Write a message first.')
  t.messages.push({ from: 'you', at: new Date().toISOString(), text: String(req.body.message).slice(0, 2000) })
  t.status = 'open'
  t.updated_at = new Date().toISOString()
  sample(res, t)
})

router.get('/learn', (_req, res) => sample(res, { lessons: LEARN, glossary: GLOSSARY.map(([term, meaning]) => ({ term, meaning })) }))

router.get('/legal', (_req, res) =>
  sample(res, {
    documents: [
      { title: 'Terms of use', note: 'Version 1.0' }, { title: 'Privacy policy', note: 'Updated 20 Nov 2026' },
      { title: 'Risk disclosure', note: 'Values can go down as well as up' }, { title: 'Fee schedule', note: '' },
      { title: 'Complaints procedure', note: '' },
    ],
    company: [
      ['Company', 'Dividendii Investments Ltd'], ['Registration', 'RC [NUMBER]'], ['Registered office', '[ADDRESS]'],
      ['Regulator', '[SEC REGISTRATION TO CONFIRM]'], ['Custody and trading partner', 'Bluum Finance'],
    ],
    app: { version: '1.0.0', released: '2026-11-27' },
  }),
)

router.get('/rewards', requireUser, (_req, res) =>
  sample(res, { invite_code: 'ADAEZE-4821', invited: 3, joined: 2, reward: '[TO CONFIRM: reward and its terms]' }),
)

router.get('/funds', (_req, res) =>
  sample(res, [
    {
      symbol: 'SNIF', name: 'Sample Naira Income Fund', category: 'Money market and short bonds', country: 'Nigeria', risk: 'Low to medium',
      currency: 'NGN', nav: 104.82, nav_change: 0.04, nav_change_pct: 0.04, as_of: '2026-11-25', min_first: '10000', min_next: '5000',
      returns: [['1 month', 1.1, 0.9], ['3 months', 3.4, 2.9], ['1 year', 13.9, 12.1], ['3 years', 11.2, 10.4]],
      holds: [['Treasury bills', 46], ['Short bonds', 28], ['Bank deposits', 20], ['Cash', 6]],
      facts: [['Objective', 'Steady income'], ['Risk', 'Low to medium'], ['Benchmark', 'Sample index'], ['Manager', '[FUND MANAGER]'], ['Size', '₦12.4bn'], ['Fees', '[TO CONFIRM]'], ['Minimum', '₦10,000 then ₦5,000']],
      documents: [['Fund fact sheet', 2], ['Prospectus', 48], ['Annual report', 36]],
      history: series('SNIF', 104.82, 60, 0.0008),
    },
  ]),
)

export default router
