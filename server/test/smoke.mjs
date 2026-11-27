// Walks the whole platform end to end against a running server, the way a
// customer would: sign in, open the account, accept the disclosures, add
// money, buy, sell, apply for an offering, buy a bond, buy a portfolio,
// create a gift.
//
//   node src/index.js            # in one terminal
//   node test/smoke.mjs          # in another
//
// It prints a line per step and exits non-zero on the first failure, so it
// can also run in a deployment pipeline.

const BASE = process.env.SMOKE_BASE || 'http://localhost:4000'
const EMAIL = `smoke-${Date.now()}@example.com`

let cookie = ''
let failures = 0

const colour = (c, s) => `\u001b[${c}m${s}\u001b[0m`
const pass = (name, extra = '') => console.log(`${colour(32, 'ok')}  ${name}${extra ? ` ${colour(90, extra)}` : ''}`)
const fail = (name, detail) => {
  failures += 1
  console.log(`${colour(31, 'FAIL')} ${name}\n     ${detail}`)
}

async function call(method, path, body, { expectStatus = 200, form } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body && !form ? { 'content-type': 'application/json' } : {}),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (res.status !== expectStatus) {
    throw new Error(`${method} ${path} gave ${res.status}, expected ${expectStatus}: ${text.slice(0, 300)}`)
  }
  return json
}

async function step(name, fn, extra) {
  try {
    const result = await fn()
    pass(name, typeof extra === 'function' ? extra(result) : extra)
    return result
  } catch (error) {
    fail(name, error.message)
    return null
  }
}

console.log(`\nDividendii platform smoke test against ${BASE}\n`)

const health = await step('server is up', () => call('GET', '/api/health'), (r) => `bluum=${r.data.bluum_mode} db=${r.data.database}`)
if (!health) process.exit(1)

// --- Sign in ------------------------------------------------------------
const codeRes = await step('a sign-in code is issued', () =>
  call('POST', '/api/auth/request-code', { email: EMAIL, name: 'Smoke Test' }),
)
const code = codeRes?.data?.dev_code
if (!code) {
  fail('the code is readable in console mail mode', 'no dev_code in the response; set MAIL_MODE=console')
  process.exit(1)
}
await step('the code signs the customer in', () => call('POST', '/api/auth/verify', { email: EMAIL, code }))
await step('the session is recognised', () => call('GET', '/api/auth/me'), (r) => r.data.email)

// --- Open the account ---------------------------------------------------
await step('the agreements are readable before signing up', () => call('GET', '/api/account/disclosures'), (r) => `${r.data.length} disclosures`)

await step('an investor account is opened', () =>
  call('POST', '/api/account/investor', {
    first_name: 'Smoke',
    last_name: 'Test',
    country: 'ng',
    date_of_birth: '1990-01-01',
    phone: '08030000000',
  }),
  (r) => r.data.investor.id,
)

const outstanding = await step('the outstanding disclosures are listed', () =>
  call('GET', '/api/account/disclosures/outstanding'),
  (r) => `${r.data.length} to accept`,
)

if (outstanding?.data?.length) {
  await step('the disclosures are accepted', () =>
    call('POST', '/api/account/disclosures/accept', {
      acceptances: outstanding.data.map((d) => ({ disclosure_id: d.id, version: d.version })),
    }),
  )
}

await step('the account is approved (sandbox shortcut)', () => call('POST', '/api/dev/approve-me'), (r) => r.data.status)

// --- Money in -----------------------------------------------------------
await step('the wallets exist in all three currencies', () => call('GET', '/api/money/wallets'), (r) =>
  r.data.map((w) => w.currency).join(' '),
)

const deposit = await step('a manual transfer deposit is created', () =>
  call('POST', '/api/money/deposits', { amount: '500000', currency: 'NGN', method: 'manual_bank_transfer' }),
  (r) => `${r.data.id} ref ${r.data.reference_code}`,
)

await step('a repeated deposit with the same key is not charged twice', async () => {
  const key = `smoke-${Date.now()}`
  const headers = { cookie, 'content-type': 'application/json', 'Idempotency-Key': key }
  const body = JSON.stringify({ amount: '1000', currency: 'NGN', method: 'manual_bank_transfer' })
  const a = await fetch(BASE + '/api/money/deposits', { method: 'POST', headers, body })
  const b = await fetch(BASE + '/api/money/deposits', { method: 'POST', headers, body })
  const [ja, jb] = [await a.json(), await b.json()]
  if (ja.data.id !== jb.data.id) throw new Error(`two different deposits were created: ${ja.data.id} and ${jb.data.id}`)
  if (b.headers.get('Idempotent-Replay') !== 'true') throw new Error('the second call was not marked as a replay')
  return jb
})

if (deposit) {
  await step('the deposit is marked as received (sandbox)', () =>
    call('POST', `/api/money/deposits/${deposit.data.id}/simulate`, {}),
    (r) => r.data.status,
  )
}
// US dollars too, so the fractional buy and the bond order have cash behind
// them. ACH completes at once in the sample data.
await step('a US dollar deposit lands', async () => {
  const fs = await call('POST', '/api/money/funding-sources', { type: 'bank_account', currency: 'USD', bank_name: 'Sample Bank', account_number: '12345678' })
  return call('POST', '/api/money/deposits', { amount: '5000', currency: 'USD', method: 'ach', funding_source_id: fs.data.id })
}, (r) => `${r.data.currency} ${r.data.amount} ${r.data.status}`)

await step('the wallet now holds the cash', () => call('GET', '/api/money/wallets'), (r) => {
  const ngn = r.data.find((w) => w.currency === 'NGN')
  if (Number(ngn.available_balance) <= 0) throw new Error('the NGN wallet is still empty')
  return `NGN ${ngn.available_balance}`
})

// --- Trading ------------------------------------------------------------
await step('the Nigerian shelf lists assets', () => call('GET', '/api/market/assets?country=ng'), (r) => `${r.data.length} assets`)
await step('an asset page loads with its market hours', () => call('GET', '/api/market/assets/GTCO'), (r) =>
  `${r.data.asset.name} / ${r.data.market.hours}`,
)

await step('an order is estimated with its fees', () =>
  call('POST', '/api/trade/estimate', { symbol: 'GTCO', side: 'buy', type: 'market', quantity: '100' }),
  (r) => `total ${r.data.estimated_total} ${r.data.currency}`,
)

const order = await step('a market buy is placed', () =>
  call('POST', '/api/trade/orders', { symbol: 'GTCO', side: 'buy', type: 'market', quantity: '100' }),
  (r) => `${r.data.id} ${r.data.status}`,
)

await step('buying by amount works on a fractionable asset', () =>
  call('POST', '/api/trade/orders', { symbol: 'AAPL', side: 'buy', type: 'market', notional: '50' }),
  (r) => `${r.data.quantity} AAPL`,
)

await step('buying by amount is refused on a sell', async () => {
  await call('POST', '/api/trade/orders', { symbol: 'AAPL', side: 'sell', type: 'market', notional: '50' }, { expectStatus: 400 })
  return true
})

await step('a holding appears', () => call('GET', '/api/trade/positions'), (r) => `${r.data.length} positions`)

await step('selling unsettled shares is refused', async () => {
  const res = await call('POST', '/api/trade/orders', { symbol: 'GTCO', side: 'sell', type: 'market', quantity: '100' }, { expectStatus: 400 })
  if (!/settle/i.test(res.error.message)) throw new Error(`unexpected message: ${res.error.message}`)
  return res
})

if (order) {
  await step('settling the holding (sandbox) allows a sell', async () => {
    await call('POST', `/api/trade/orders/${order.data.id}/simulate`, {})
    return call('POST', '/api/trade/orders', { symbol: 'GTCO', side: 'sell', type: 'market', quantity: '50' })
  }, (r) => `${r.data.side} ${r.data.quantity} ${r.data.status}`)
}

// --- Bonds --------------------------------------------------------------
const bonds = await step('the bond shelf lists bonds', () => call('GET', '/api/bonds'), (r) => `${r.data.length} bonds`)
const bond = bonds?.data?.[0]

await step('a market order on a bond is refused', async () => {
  const res = await call('POST', '/api/trade/orders', { symbol: bond.symbol, side: 'buy', type: 'market', quantity: '1000' }, { expectStatus: 400 })
  if (!/bond/i.test(res.error.message)) throw new Error(`unexpected message: ${res.error.message}`)
  return res
})

await step('a bond face value off the increment is refused', async () =>
  call('POST', '/api/bonds/estimate', { symbol: bond.symbol, side: 'buy', quantity: '1500', limit_price: '99.5' }, { expectStatus: 400 }),
)

await step('a bond order is estimated as a dirty value', () =>
  call('POST', '/api/bonds/estimate', { symbol: bond.symbol, side: 'buy', quantity: '2000', limit_price: '99.5' }),
  (r) => `principal ${r.meta.workings.principal} + accrued ${r.meta.workings.accrued_interest}`,
)

await step('the bond risk disclosure must be accepted first', async () => {
  const res = await call('POST', '/api/bonds/orders', { symbol: bond.symbol, side: 'buy', quantity: '2000', limit_price: '99.5' }, { expectStatus: 400 })
  if (!/disclosure/i.test(res.error.message)) throw new Error(`unexpected message: ${res.error.message}`)
  return res
})

await step('after accepting it, a bond limit order is placed', async () => {
  const out = await call('GET', '/api/bonds/disclosures/outstanding')
  if (out.data.length) {
    await call('POST', '/api/account/disclosures/accept', {
      acceptances: out.data.map((d) => ({ disclosure_id: d.id, version: d.version })),
    })
  }
  return call('POST', '/api/bonds/orders', { symbol: bond.symbol, side: 'buy', quantity: '2000', limit_price: '99.5' })
}, (r) => `${r.data.id} face ${r.data.quantity}`)

// --- Offerings ----------------------------------------------------------
const offerings = await step('offerings are listed', () => call('GET', '/api/offerings'), (r) =>
  `${r.meta.open} open, ${r.meta.upcoming} upcoming, ${r.meta.closed} closed`,
)
const open = offerings?.data?.find((o) => o.status === 'OPEN')

await step('an application is quoted against the wallet', () =>
  call('POST', `/api/offerings/${open.id}/quote`, { units: '2000' }),
  (r) => `${r.data.amount} ${r.data.currency}, enough cash: ${r.data.enough_cash}`,
)

await step('an application below the minimum is refused', () =>
  call('POST', `/api/offerings/${open.id}/apply`, { units: '10' }, { expectStatus: 400 }),
)

await step('an application is accepted and the cash is held, not spent', async () => {
  const before = (await call('GET', '/api/money/wallets')).data.find((w) => w.currency === open.currency)
  const sub = await call('POST', `/api/offerings/${open.id}/apply`, { units: '2000' })
  const after = (await call('GET', '/api/money/wallets')).data.find((w) => w.currency === open.currency)
  if (Number(after.reserved_balance) <= Number(before.reserved_balance)) {
    throw new Error('the reserved balance did not go up')
  }
  return sub
}, (r) => `${r.data.id} ${r.data.status}`)

await step('a second application to the same offer is refused', () =>
  call('POST', `/api/offerings/${open.id}/apply`, { units: '2000' }, { expectStatus: 409 }),
)

await step('an application can be withdrawn and the hold released', async () => {
  const subs = await call('GET', '/api/offerings/me/subscriptions')
  const applied = subs.data.find((s) => s.status === 'APPLIED')
  return call('POST', `/api/offerings/subscriptions/${applied.id}/withdraw`, {})
}, (r) => r.data.status)

// --- Portfolios ---------------------------------------------------------
const ptfs = await step('curated portfolios are listed', () => call('GET', '/api/portfolios'), (r) => `${r.data.length} portfolios`)
const ptf = ptfs?.data?.find((p) => p.currency === 'NGN')

await step('a portfolio buy is estimated and placed', async () => {
  await call('POST', '/api/portfolios/estimate', { ptf_id: ptf.id, amount: '50000' })
  return call('POST', '/api/portfolios/orders', { ptf_id: ptf.id, amount: '50000' })
}, (r) => `${r.data.units} units`)

await step('the portfolio holding appears', () => call('GET', '/api/portfolios/me/holdings'), (r) => `${r.data.length} holdings`)

// --- Gifting ------------------------------------------------------------
await step('a gift to an unknown email is refused', () =>
  call('POST', '/api/gifts', { symbol: 'AAPL', amount: '20', to_email: 'nobody@example.com' }, { expectStatus: 400 }),
)

await step('a gift is quoted with a fee warning when it is small', () =>
  call('POST', '/api/gifts/quote', { symbol: 'AAPL', amount: '5' }),
  (r) => `fees ${r.data.total_fees}${r.meta.fee_warning ? ' (warned)' : ''}`,
)

// --- Webhooks -----------------------------------------------------------
await step('a webhook with no signature is refused', async () => {
  const res = await fetch(BASE + '/api/webhooks/bluum', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'evt_smoke', type: 'order.filled', data: {} }),
  })
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
  return true
})

await step('the rejected webhook was still recorded', () => call('GET', '/api/webhooks/recent'), (r) => {
  const bad = r.data.find((e) => e.event_id === 'evt_smoke')
  if (!bad) throw new Error('the event was not stored')
  if (bad.signature_ok) throw new Error('it was stored as having a good signature')
  return `${r.data.length} events, secret set: ${r.meta.secret_configured}`
})

// --- Sample-data features (/api/extras) ----------------------------------
for (const [name, path] of [
  ['ticker and indexes', '/api/extras/indexes'], ['watchlist', '/api/extras/watchlist'], ['alerts', '/api/extras/alerts'],
  ['search', '/api/extras/search?q=mtn'], ['value history', '/api/extras/history?currency=NGN&range=3M'],
  ['notifications', '/api/extras/notifications'], ['news', '/api/extras/news'], ['calendar', '/api/extras/calendar'],
  ['goals', '/api/extras/goals'], ['auto-invest plans', '/api/extras/plans'], ['statements', '/api/extras/statements'],
  ['fees', '/api/extras/fees'], ['profile', '/api/extras/profile'], ['security', '/api/extras/security'],
  ['preferences', '/api/extras/preferences'], ['help', '/api/extras/help'], ['tickets', '/api/extras/tickets'],
  ['learn', '/api/extras/learn'], ['legal', '/api/extras/legal'], ['funds', '/api/extras/funds'],
]) {
  await step(`extras: ${name}`, async () => {
    const r = await call('GET', path)
    if (r.data === undefined) throw new Error('no data in the reply')
    return r
  }, (r) => (r.meta?.sample ? 'sample' : 'live'))
}
await step('extras: follow and unfollow a company', async () => {
  await call('POST', '/api/extras/watchlist', { symbol: 'GTCO' })
  const r = await call('DELETE', '/api/extras/watchlist/GTCO')
  if (r.data.some((x) => x.symbol === 'GTCO')) throw new Error('still on the watchlist')
})
await step('extras: open and answer a support ticket', async () => {
  const t = await call('POST', '/api/extras/tickets', { subject: 'Smoke', message: 'Hello' })
  await call('POST', `/api/extras/tickets/${t.data.id}/reply`, { message: 'More' })
})

// --- Errors -------------------------------------------------------------
await step('a bare UUID in a path is refused with a clear message', async () => {
  const res = await call('GET', '/api/trade/orders/123e4567-e89b-12d3-a456-426614174000', null, { expectStatus: 400 })
  if (!/prefixed/i.test(res.error.message)) throw new Error(`unexpected message: ${res.error.message}`)
  return res
})

await step('an unknown asset gives a plain message', () =>
  call('GET', '/api/market/assets/NOSUCHTHING', null, { expectStatus: 404 }),
)

console.log('')
if (failures) {
  console.log(colour(31, `${failures} step(s) failed.`))
  process.exit(1)
}
console.log(colour(32, 'Every step passed.'))
