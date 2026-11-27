// A stand-in for Bluum, used when BLUUM_MODE=mock.
//
// It exists so the whole platform can be built, run and demonstrated before
// sandbox keys arrive. It copies Bluum's shapes and rules closely enough that
// switching to live keys changes no screen and no route:
//
//   - money and quantities are strings, as Bluum returns them
//   - ids carry Bluum's prefixes (inv_, wlt_, dep_, ord_, pos_, off_, sub_)
//   - lists come back in the { object: 'list', data: [...], has_more } envelope
//   - sells use the settled quantity only, and refuse otherwise (BLUM-400-017)
//   - bonds refuse market orders and price in percent of par
//   - notional orders are market buys on fractionable assets only
//
// Everything in here is invented sample data. No real prices, no real
// companies' figures, no real bank details.

import { randomUUID } from 'node:crypto'
import { BluumError } from '../errors.js'

const id = (prefix) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 26)}`
const money = (n) => Number(n).toFixed(2)
const nowIso = () => new Date().toISOString()
const list = (data) => ({ object: 'list', data, has_more: false })

// ---------------------------------------------------------------------------
// Sample catalogue
// ---------------------------------------------------------------------------
const ASSET_SEED = [
  // Nigeria (XNSA, NGN)
  ['DANGCEM', 'Dangote Cement', 'equity', 'ng', 'NGN', 'XNSA', 480.0, true],
  ['SEPLAT', 'Seplat Energy', 'equity', 'ng', 'NGN', 'XNSA', 5420.0, true],
  ['STANBIC', 'Stanbic IBTC Holdings', 'equity', 'ng', 'NGN', 'XNSA', 78.4, true],
  ['MTNN', 'MTN Nigeria Communications', 'equity', 'ng', 'NGN', 'XNSA', 420.5, true],
  ['GTCO', 'Guaranty Trust Holding', 'equity', 'ng', 'NGN', 'XNSA', 61.9, true],
  ['ZENITHBANK', 'Zenith Bank', 'equity', 'ng', 'NGN', 'XNSA', 52.3, true],
  ['NESTLE', 'Nestle Nigeria', 'equity', 'ng', 'NGN', 'XNSA', 1210.0, true],
  ['SERESNGX30', 'Sample NGX 30 ETF', 'etf', 'ng', 'NGN', 'XNSA', 28.4, true],
  // United States (XNAS/XNYS, USD)
  ['AAPL', 'Apple Inc.', 'equity', 'us', 'USD', 'XNAS', 228.4, true],
  ['MSFT', 'Microsoft Corporation', 'equity', 'us', 'USD', 'XNAS', 412.6, true],
  ['NVDA', 'NVIDIA Corporation', 'equity', 'us', 'USD', 'XNAS', 142.8, true],
  ['KO', 'The Coca-Cola Company', 'equity', 'us', 'USD', 'XNYS', 62.15, true],
  ['VOO', 'Vanguard S&P 500 ETF', 'etf', 'us', 'USD', 'XNYS', 528.9, true],
  ['SCHD', 'Schwab US Dividend Equity ETF', 'etf', 'us', 'USD', 'XNYS', 27.85, true],
  // Kenya (XNAI, KES)
  ['SCOM', 'Safaricom', 'equity', 'ke', 'KES', 'XNAI', 17.65, true],
  ['EQTY', 'Equity Group Holdings', 'equity', 'ke', 'KES', 'XNAI', 44.9, true],
  ['KCB', 'KCB Group', 'equity', 'ke', 'KES', 'XNAI', 38.15, true],
]

// Bonds price in percent of par and trade in face value.
const BOND_SEED = [
  ['912797LK9', 'US Treasury Bill, sample 3-month', 'bill', 'us', 'USD', 99.42, 1000, 'treasury'],
  ['91282CJK8', 'US Treasury Note, sample 2-year', 'note', 'us', 'USD', 99.875, 1000, 'treasury'],
  ['037833EN2', 'Sample Corporate Note 2031', 'bond', 'us', 'USD', 101.25, 2000, 'corporate'],
  // Sample sovereign bonds in the other two currencies, so the bond shelf has
  // all three markets. Coupons, yields and dates are invented.
  ['FGN2034', 'Federal Government of Nigeria 2034', 'bond', 'ng', 'NGN', 98.4, 1000, 'treasury', { coupon: '18.500', maturity: '2034-03-15', ytm: '17.80', accrued: '1.85' }],
  ['FGN2031', 'Federal Government of Nigeria 2031', 'bond', 'ng', 'NGN', 96.2, 1000, 'treasury', { coupon: '16.250', maturity: '2031-04-18', ytm: '17.10', accrued: '0.95' }],
  ['FGN2027', 'Federal Government of Nigeria 2027', 'bond', 'ng', 'NGN', 99.1, 1000, 'treasury', { coupon: '17.000', maturity: '2027-01-18', ytm: '17.60', accrued: '3.10' }],
  ['UST2034', 'US Treasury Note 2034', 'note', 'us', 'USD', 99.6, 1000, 'treasury', { coupon: '4.250', maturity: '2034-02-15', ytm: '4.31', accrued: '0.31' }],
  ['GOK2031', 'Government of Kenya 2031', 'bond', 'ke', 'KES', 97.1, 50000, 'treasury', { coupon: '13.200', maturity: '2031-06-10', ytm: '13.90', accrued: '0.70' }],
]

function buildAssets() {
  const out = new Map()
  for (const [symbol, name, cls, country, currency, venue, price, fractionable] of ASSET_SEED) {
    out.set(symbol, {
      id: randomUUID(),
      object: 'asset',
      symbol,
      name,
      class: cls,
      country,
      currency,
      venue,
      status: 'active',
      tradable: true,
      fractionable,
      min_order_size: country === 'us' ? '1.00' : '100.00',
      price: money(price),
    })
  }
  for (const [symbol, name, cls, country, currency, cleanPrice, minIncrement, kind, extra = {}] of BOND_SEED) {
    out.set(symbol, {
      id: randomUUID(),
      object: 'asset',
      symbol,
      name,
      class: cls,
      country,
      currency,
      venue: 'OTC',
      status: 'active',
      tradable: true,
      fractionable: false,
      price: money(cleanPrice), // percent of par
      bond: {
        cusip: symbol,
        issuer_type: kind,
        min_increment: String(minIncrement),
        // A bill pays no coupon: it is bought below face value and redeemed
        // at face value. Notes and bonds pay one twice a year.
        coupon_rate: cls === 'bill' ? null : extra.coupon || (kind === 'treasury' ? '4.250' : '5.600'),
        yield_to_maturity: extra.ytm || null,
        coupon_frequency: cls === 'bill' ? null : 'semi_annual',
        maturity_date: extra.maturity ||
          (cls === 'bill'
            ? new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)
            : cls === 'note'
              ? new Date(Date.now() + 2 * 365 * 864e5).toISOString().slice(0, 10)
              : '2031-05-15'),
        accrued_interest: extra.accrued || (cls === 'bill' ? '0.00' : '0.42'), // percent of par, illustrative
        settlement_convention: kind === 'treasury' && country === 'us' ? 'T+1' : 'T+2',
      },
    })
  }
  return out
}

const DISCLOSURES = [
  {
    id: 'dsc_customer_agreement',
    object: 'disclosure',
    code: 'customer_agreement',
    name: 'Customer agreement',
    version: '2026-01',
    step: 'step_account_opening',
    required: true,
    verbatim_text:
      'SAMPLE TEXT, NOT FOR USE. This is placeholder disclosure text supplied by the mock Bluum service so the ' +
      'acceptance flow can be built and tested. In sandbox and production Bluum returns the real agreement here, ' +
      'and it must be displayed exactly as received, without edits, summaries or reformatting.',
  },
  {
    id: 'dsc_market_data',
    object: 'disclosure',
    code: 'market_data_terms',
    name: 'Market data terms',
    version: '2026-01',
    step: 'step_account_opening',
    required: true,
    verbatim_text:
      'SAMPLE TEXT, NOT FOR USE. Placeholder market data terms from the mock service. Replace by the real text ' +
      'returned by Bluum before anyone signs it.',
  },
  {
    id: 'dsc_fixed_income',
    object: 'disclosure',
    code: 'fixed_income_risk',
    name: 'Bond and treasury risk disclosure',
    version: '2026-01',
    step: 'step_fixed_income_enrollment',
    required: true,
    verbatim_text:
      'SAMPLE TEXT, NOT FOR USE. Placeholder fixed income risk disclosure from the mock service. Bonds carry ' +
      'interest rate risk, credit risk and liquidity risk. The real wording comes from Bluum.',
  },
  {
    id: 'dsc_extended_hours',
    object: 'disclosure',
    code: 'extended_hours_trading',
    name: 'Extended hours trading',
    version: '2026-01',
    step: 'step_extended_hours',
    required: false,
    verbatim_text:
      'SAMPLE TEXT, NOT FOR USE. Placeholder extended hours disclosure from the mock service. Trading outside ' +
      'regular hours has lower liquidity and wider spreads.',
  },
]

function buildOfferings() {
  const open = {
    id: id('off'),
    object: 'offering',
    name: 'Sample Infrastructure Plc, initial public offer',
    type: 'ipo',
    status: 'OPEN',
    country: 'ng',
    currency: 'NGN',
    issuer: 'Sample Infrastructure Plc',
    price_per_unit: '12.50',
    min_units: '1000',
    unit_increment: '100',
    opens_at: new Date(Date.now() - 3 * 864e5).toISOString(),
    closes_at: new Date(Date.now() + 9 * 864e5).toISOString(),
    eligible_countries: ['ng', 'ke'],
    summary:
      'Sample offering created by the mock Bluum service so the application flow can be built. Figures are invented.',
  }
  const rights = {
    id: id('off'),
    object: 'offering',
    name: 'Sample Bank Plc, rights issue',
    type: 'rights_issue',
    status: 'ANNOUNCED',
    country: 'ng',
    currency: 'NGN',
    issuer: 'Sample Bank Plc',
    price_per_unit: '8.00',
    min_units: '500',
    unit_increment: '100',
    opens_at: new Date(Date.now() + 6 * 864e5).toISOString(),
    closes_at: new Date(Date.now() + 20 * 864e5).toISOString(),
    eligible_countries: ['ng'],
    summary: 'Sample rights issue from the mock service.',
  }
  const bondOffer = {
    id: id('off'),
    object: 'offering',
    name: 'Sample State Government bond, series III',
    type: 'public_bond',
    status: 'OPEN',
    country: 'ng',
    currency: 'NGN',
    issuer: 'Sample State Government',
    price_per_unit: '1000.00',
    min_units: '10',
    unit_increment: '1',
    coupon_rate: '16.50',
    tenor: '7 years',
    opens_at: new Date(Date.now() - 1 * 864e5).toISOString(),
    closes_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    eligible_countries: ['ng'],
    summary: 'Sample public bond offer from the mock service.',
  }
  const allotted = {
    id: id('off'),
    object: 'offering',
    name: 'Sample Agritech Plc, initial public offer',
    type: 'ipo',
    status: 'ALLOTTED',
    country: 'ke',
    currency: 'KES',
    issuer: 'Sample Agritech Plc',
    price_per_unit: '22.00',
    min_units: '100',
    unit_increment: '100',
    opens_at: new Date(Date.now() - 40 * 864e5).toISOString(),
    closes_at: new Date(Date.now() - 20 * 864e5).toISOString(),
    eligible_countries: ['ke'],
    summary: 'Sample closed and allotted offering from the mock service.',
  }
  return [open, bondOffer, rights, allotted]
}

function buildPortfolios() {
  return [
    {
      id: id('ptf'),
      object: 'ptf',
      name: 'Dividendii Nigerian Dividend Leaders',
      status: 'published',
      currency: 'NGN',
      unit_price: '112.40',
      inception_date: '2026-03-02',
      constituents: [
        { symbol: 'DANGCEM', weight: '0.25' },
        { symbol: 'MTNN', weight: '0.25' },
        { symbol: 'GTCO', weight: '0.25' },
        { symbol: 'ZENITHBANK', weight: '0.25' },
      ],
      description: 'Sample curated basket from the mock service. Weights and prices are invented.',
    },
    {
      id: id('ptf'),
      object: 'ptf',
      name: 'Dividendii US Income',
      status: 'published',
      currency: 'USD',
      unit_price: '58.15',
      inception_date: '2026-03-02',
      constituents: [
        { symbol: 'SCHD', weight: '0.40' },
        { symbol: 'KO', weight: '0.30' },
        { symbol: 'VOO', weight: '0.30' },
      ],
      description: 'Sample curated basket from the mock service.',
    },
  ]
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
const state = {
  assets: buildAssets(),
  offerings: buildOfferings(),
  portfolios: buildPortfolios(),
  investors: new Map(), // inv_ -> investor
  wallets: new Map(), // inv_ -> [wallet]
  deposits: new Map(), // inv_ -> [deposit]
  withdrawals: new Map(),
  fundingSources: new Map(),
  orders: new Map(), // inv_ -> [order]
  positions: new Map(), // inv_ -> [position]
  transactions: new Map(),
  subscriptions: new Map(),
  acceptances: new Map(),
  holdings: new Map(), // inv_ -> [ptf holding]
}

const CURRENCIES = ['USD', 'NGN', 'KES']

function createWallets(investorId) {
  const wallets = CURRENCIES.map((currency) => ({
    id: id('wlt'),
    object: 'wallet',
    investor_id: investorId,
    currency,
    available_balance: '0.00',
    settled_balance: '0.00',
    reserved_balance: '0.00',
    pending_balance: '0.00',
    updated_at: nowIso(),
  }))
  state.wallets.set(investorId, wallets)
  return wallets
}

const walletFor = (investorId, currency) =>
  (state.wallets.get(investorId) || []).find((w) => w.currency === currency)

function credit(investorId, currency, amount) {
  const w = walletFor(investorId, currency)
  if (!w) return
  w.available_balance = money(Number(w.available_balance) + Number(amount))
  w.settled_balance = money(Number(w.settled_balance) + Number(amount))
  w.updated_at = nowIso()
}

function debit(investorId, currency, amount) {
  const w = walletFor(investorId, currency)
  if (!w) throw mockError(400, 'BLUM-400-002', `No ${currency} wallet.`)
  if (Number(w.available_balance) < Number(amount)) {
    throw mockError(400, 'BLUM-400-010', 'There is not enough cash in that wallet.')
  }
  w.available_balance = money(Number(w.available_balance) - Number(amount))
  w.settled_balance = money(Number(w.settled_balance) - Number(amount))
  w.updated_at = nowIso()
}

function reserve(investorId, currency, amount) {
  const w = walletFor(investorId, currency)
  if (!w) throw mockError(400, 'BLUM-400-002', `No ${currency} wallet.`)
  if (Number(w.available_balance) < Number(amount)) {
    throw mockError(400, 'BLUM-400-010', 'There is not enough cash to apply for that amount.')
  }
  w.available_balance = money(Number(w.available_balance) - Number(amount))
  w.reserved_balance = money(Number(w.reserved_balance) + Number(amount))
  w.updated_at = nowIso()
}

function addTransaction(investorId, tx) {
  const arr = state.transactions.get(investorId) || []
  arr.unshift({ id: id('txn'), object: 'transaction', created: Math.floor(Date.now() / 1000), ...tx })
  state.transactions.set(investorId, arr)
}

const mockError = (status, code, message) => new BluumError({ status, code, message, raw: { mock: true } })

// Fees: a flat illustrative schedule so the fee rows in the UI are exercised.
function feesFor(orderValue, currency) {
  const commission = Math.max(Number(orderValue) * 0.0015, currency === 'NGN' ? 50 : 0.5)
  const regulatory = Number(orderValue) * 0.0003
  return [
    { type: 'commission', amount: money(commission), currency },
    { type: 'regulatory', amount: money(regulatory), currency },
  ]
}

const totalFees = (fees) => fees.reduce((sum, f) => sum + Number(f.amount), 0)

// ---------------------------------------------------------------------------
// Order handling
// ---------------------------------------------------------------------------
function assetOrThrow(symbol) {
  const asset = state.assets.get(String(symbol).toUpperCase())
  if (!asset) throw mockError(404, 'BLUM-404-003', `No asset called ${symbol}.`)
  return asset
}

const isBond = (asset) => ['bond', 'bill', 'note'].includes(asset.class)

function priceOrder(asset, body) {
  const bond = isBond(asset)
  if (bond) {
    if (body.type !== 'limit') throw mockError(400, 'BLUM-400-021', 'Bond orders must be limit orders.')
    if (body.notional) throw mockError(400, 'BLUM-400-022', 'Bonds cannot be bought by amount.')
    if (body.time_in_force && body.time_in_force !== 'day') {
      throw mockError(400, 'BLUM-400-023', 'Bond orders must use time in force "day".')
    }
    const face = Number(body.quantity)
    const inc = Number(asset.bond.min_increment)
    if (!face || face % inc !== 0) {
      throw mockError(400, 'BLUM-400-024', `Face value must be a multiple of ${inc}.`)
    }
    const clean = Number(body.limit_price ?? asset.price)
    const accrued = Number(asset.bond.accrued_interest)
    // Dirty value: face x (clean + accrued) / 100
    const orderValue = (face * (clean + accrued)) / 100
    return { orderValue, quantity: String(face), unitPrice: money(clean) }
  }

  if (body.notional) {
    if (body.side !== 'buy' || body.type !== 'market') {
      throw mockError(400, 'BLUM-400-018', 'An amount can only be used for a market buy.')
    }
    if (!asset.fractionable) throw mockError(400, 'BLUM-400-019', 'That asset cannot be bought in fractions.')
    const orderValue = Number(body.notional)
    return { orderValue, quantity: (orderValue / Number(asset.price)).toFixed(6), unitPrice: asset.price }
  }

  const qty = Number(body.quantity)
  if (!qty || qty <= 0) throw mockError(400, 'BLUM-400-004', 'A quantity is required.')
  const unit = body.type === 'limit' ? Number(body.limit_price ?? asset.price) : Number(asset.price)
  return { orderValue: qty * unit, quantity: String(qty), unitPrice: money(unit) }
}

function estimateOrder(investorId, body) {
  const asset = assetOrThrow(body.symbol)
  const { orderValue, quantity, unitPrice } = priceOrder(asset, body)
  const fees = feesFor(orderValue, asset.currency)
  const fee = totalFees(fees)
  const total = body.side === 'buy' ? orderValue + fee : orderValue - fee
  return {
    object: 'order_estimate',
    symbol: asset.symbol,
    side: body.side,
    type: body.type,
    currency: asset.currency,
    quantity,
    estimated_unit_price: unitPrice,
    order_value: money(orderValue),
    fees,
    total_fees: money(fee),
    estimated_total: money(total),
    settlement_date: isBond(asset)
      ? new Date(Date.now() + (asset.bond.settlement_convention === 'T+1' ? 1 : 2) * 864e5)
          .toISOString()
          .slice(0, 10)
      : undefined,
    is_bond: isBond(asset) || undefined,
  }
}

function settledQuantity(investorId, symbol) {
  const pos = (state.positions.get(investorId) || []).find((p) => p.symbol === symbol)
  return pos ? Number(pos.settled_quantity ?? pos.quantity) : 0
}

function placeOrder(investorId, body) {
  const investor = state.investors.get(investorId)
  if (!investor) throw mockError(404, 'BLUM-404-001', 'No such investor.')
  if (investor.status !== 'active') {
    throw mockError(403, 'BLUM-403-002', 'This account cannot trade until it is active.')
  }
  const asset = assetOrThrow(body.symbol)
  const estimate = estimateOrder(investorId, body)

  if (body.side === 'sell') {
    if (!body.quantity) throw mockError(400, 'BLUM-400-016', 'A sell needs a quantity.')
    if (Number(body.quantity) > settledQuantity(investorId, asset.symbol)) {
      throw mockError(400, 'BLUM-400-017', 'Those shares have not settled yet, so they cannot be sold today.')
    }
  } else {
    debit(investorId, asset.currency, estimate.estimated_total)
  }

  const order = {
    id: id('ord'),
    object: 'order',
    investor_id: investorId,
    client_order_id: body.client_order_id || null,
    symbol: asset.symbol,
    asset_class: asset.class,
    side: body.side,
    type: body.type,
    time_in_force: body.time_in_force || 'day',
    quantity: estimate.quantity,
    notional: body.notional ? money(body.notional) : null,
    limit_price: body.limit_price ? money(body.limit_price) : null,
    filled_quantity: '0',
    status: 'accepted',
    currency: asset.currency,
    fees: estimate.fees,
    order_value: estimate.order_value,
    estimated_total: estimate.estimated_total,
    settlement_date: estimate.settlement_date || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  }

  const arr = state.orders.get(investorId) || []
  arr.unshift(order)
  state.orders.set(investorId, arr)

  // Market orders fill at once. A limit order fills only if its price is
  // already reached, otherwise it stays open, as it would in a real market.
  const crosses =
    body.type === 'market' ||
    (body.side === 'buy' && Number(body.limit_price) >= Number(asset.price)) ||
    (body.side === 'sell' && Number(body.limit_price) <= Number(asset.price))
  if (crosses) fillOrder(investorId, order, asset)
  return order
}

function fillOrder(investorId, order, asset) {
  order.status = 'filled'
  order.filled_quantity = order.quantity
  order.filled_avg_price = order.limit_price || asset.price
  order.filled_at = nowIso()
  order.updated_at = nowIso()

  const positions = state.positions.get(investorId) || []
  let pos = positions.find((p) => p.symbol === asset.symbol)
  const qty = Number(order.quantity)

  if (order.side === 'buy') {
    if (!pos) {
      pos = {
        id: id('pos'),
        object: 'position',
        investor_id: investorId,
        symbol: asset.symbol,
        class: asset.class,
        country: asset.country,
        currency: asset.currency,
        quantity: '0',
        // Bluum settles before a sell is allowed; the mock mirrors that by
        // keeping the newly bought quantity unsettled until T+1.
        settled_quantity: '0',
        average_cost_basis: '0.00',
        total_cost_basis: '0.00',
        current_price: asset.price,
        market_value: '0.00',
        unrealized_pl: '0.00',
        settles_on: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
      }
      positions.push(pos)
    }
    const newQty = Number(pos.quantity) + qty
    const newCost = Number(pos.total_cost_basis) + Number(order.order_value)
    pos.quantity = String(newQty)
    pos.total_cost_basis = money(newCost)
    pos.average_cost_basis = money(newCost / newQty)
    addTransaction(investorId, {
      type: 'buy',
      symbol: asset.symbol,
      amount: `-${order.estimated_total}`,
      currency: asset.currency,
      description: `Bought ${order.quantity} ${asset.symbol}`,
    })
  } else {
    if (pos) {
      const newQty = Number(pos.quantity) - qty
      pos.quantity = String(Math.max(newQty, 0))
      pos.settled_quantity = String(Math.max(Number(pos.settled_quantity) - qty, 0))
      pos.total_cost_basis = money(Number(pos.average_cost_basis) * Math.max(newQty, 0))
    }
    const proceeds = Number(order.order_value) - totalFees(order.fees)
    credit(investorId, asset.currency, proceeds)
    addTransaction(investorId, {
      type: 'sell',
      symbol: asset.symbol,
      amount: money(proceeds),
      currency: asset.currency,
      description: `Sold ${order.quantity} ${asset.symbol}`,
    })
  }

  for (const p of positions) {
    p.current_price = state.assets.get(p.symbol)?.price || p.current_price
    p.market_value = money(Number(p.quantity) * Number(p.current_price))
    p.unrealized_pl = money(Number(p.market_value) - Number(p.total_cost_basis))
  }
  state.positions.set(
    investorId,
    positions.filter((p) => Number(p.quantity) > 0),
  )
}

// Sandbox helper: settle everything, so a sell can be tested the same day.
function settleAll(investorId) {
  for (const p of state.positions.get(investorId) || []) p.settled_quantity = p.quantity
}

// ---------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------
const routes = []
const on = (method, pattern, handler) => routes.push({ method, pattern, handler })

// --- OAuth ---
on('POST', /^\/oauth\/token$/, (_m, { body }) => {
  const investorId = body?.subject_token
  if (!state.investors.has(investorId)) throw mockError(404, 'BLUM-404-001', 'No such investor.')
  return {
    access_token: `mock_tok_${randomUUID().replace(/-/g, '')}`,
    token_type: 'Bearer',
    expires_in: 900,
    investor_id: investorId,
  }
})
on('POST', /^\/oauth\/revoke$/, () => ({ revoked: true }))

// --- Investors ---
on('POST', /^\/investors$/, (_m, { body }) => {
  const investorId = id('inv')
  const investor = {
    id: investorId,
    object: 'investor',
    status: 'onboarding',
    email: body?.email || null,
    first_name: body?.first_name || null,
    last_name: body?.last_name || null,
    country: body?.country || null,
    kyc_mode: 'partner_managed',
    created_at: nowIso(),
    updated_at: nowIso(),
  }
  state.investors.set(investorId, investor)
  createWallets(investorId)
  state.acceptances.set(investorId, [])
  return investor
})

on('GET', /^\/investors\/(inv_[^/]+)$/, (m) => {
  const investor = state.investors.get(m[1])
  if (!investor) throw mockError(404, 'BLUM-404-001', 'No such investor.')
  return investor
})

on('GET', /^\/investors\/(inv_[^/]+)\/document-requirements$/, () =>
  list([
    { kind: 'government_id', name: 'Government photo ID', required: true, formats: ['jpg', 'png', 'pdf'] },
    { kind: 'proof_of_address', name: 'Proof of address', required: true, formats: ['jpg', 'png', 'pdf'] },
    { kind: 'tax_id', name: 'Tax identification number', required: false, formats: ['pdf'] },
  ]),
)

// Partner-managed identity check. The mock accepts the upload and puts the
// investor under review, then activates it, which is what a sandbox CIP
// simulate would do.
on('POST', /^\/investors\/(inv_[^/]+)\/cip$/, (m) => {
  const investor = state.investors.get(m[1])
  if (!investor) throw mockError(404, 'BLUM-404-001', 'No such investor.')
  investor.status = 'under_review'
  investor.updated_at = nowIso()
  return { object: 'cip_submission', investor_id: investor.id, status: 'under_review', submitted_at: nowIso() }
})

on('POST', /^\/investors\/(inv_[^/]+)\/cip\/simulate$/, (m, { body }) => {
  const investor = state.investors.get(m[1])
  if (!investor) throw mockError(404, 'BLUM-404-001', 'No such investor.')
  investor.status = body?.outcome === 'declined' ? 'declined' : 'active'
  investor.updated_at = nowIso()
  return investor
})

on('GET', /^\/investors\/(inv_[^/]+)\/compliance$/, (m) => {
  const investor = state.investors.get(m[1])
  return {
    object: 'compliance',
    investor_id: m[1],
    status: investor?.status === 'active' ? 'passed' : 'in_progress',
    workflows: list([
      { id: 'cmp_identity', name: 'Identity', status: investor?.status === 'active' ? 'passed' : 'pending' },
      { id: 'cmp_watchlist', name: 'Watchlist screening', status: investor?.status === 'active' ? 'passed' : 'pending' },
    ]).data,
  }
})

// --- Disclosures ---
on('GET', /^\/disclosures$/, (_m, { query }) =>
  list(query?.step ? DISCLOSURES.filter((d) => d.step === query.step) : DISCLOSURES),
)
on('GET', /^\/disclosures\/([^/]+)$/, (m) => {
  const d = DISCLOSURES.find((x) => x.id === m[1] || x.code === m[1])
  if (!d) throw mockError(404, 'BLUM-404-004', 'No such disclosure.')
  return d
})
on('GET', /^\/investors\/(inv_[^/]+)\/disclosures\/outstanding$/, (m, { query }) => {
  const accepted = new Set((state.acceptances.get(m[1]) || []).map((a) => a.disclosure_id))
  const step = query?.step
  // Without a step, only the account-opening disclosures are outstanding.
  // Product disclosures (bonds, extended hours) appear when their step is
  // asked for, which is how Bluum describes it.
  const pool = step
    ? DISCLOSURES.filter((d) => d.step === step)
    : DISCLOSURES.filter((d) => d.required && d.step === 'step_account_opening')
  return list(pool.filter((d) => !accepted.has(d.id)))
})
on('GET', /^\/investors\/(inv_[^/]+)\/disclosures\/acceptances$/, (m) => list(state.acceptances.get(m[1]) || []))
on('POST', /^\/investors\/(inv_[^/]+)\/disclosures\/acceptances$/, (m, { body }) => {
  const arr = state.acceptances.get(m[1]) || []
  const items = body?.acceptances || [body]
  const created = items.map((a) => ({
    id: id('acc'),
    object: 'disclosure_acceptance',
    investor_id: m[1],
    disclosure_id: a.disclosure_id,
    version: a.version,
    accepted_at: a.accepted_at || nowIso(),
    ip_address: a.ip_address || null,
  }))
  state.acceptances.set(m[1], [...arr, ...created])
  return list(created)
})

// --- Wallets, deposits, withdrawals ---
on('GET', /^\/investors\/(inv_[^/]+)\/wallets$/, (m) => list(state.wallets.get(m[1]) || createWallets(m[1])))

on('GET', /^\/investors\/(inv_[^/]+)\/funding-sources$/, (m) => list(state.fundingSources.get(m[1]) || []))
on('POST', /^\/investors\/(inv_[^/]+)\/funding-sources\/connect$/, (m, { body }) => {
  const fs = {
    id: id('fs'),
    object: 'funding_source',
    investor_id: m[1],
    type: body?.type || 'bank_account',
    bank_name: body?.bank_name || 'Sample Bank',
    account_mask: String(body?.account_number || '000000').slice(-4),
    currency: body?.currency || 'NGN',
    status: 'active',
    created_at: nowIso(),
  }
  state.fundingSources.set(m[1], [...(state.fundingSources.get(m[1]) || []), fs])
  return fs
})
on('GET', /^\/banks$/, () =>
  list([
    { code: '058', name: 'Sample Bank One', country: 'ng' },
    { code: '011', name: 'Sample Bank Two', country: 'ng' },
    { code: '033', name: 'Sample Bank Three', country: 'ng' },
  ]),
)

on('POST', /^\/investors\/(inv_[^/]+)\/deposits$/, (m, { body }) => {
  const investorId = m[1]
  const currency = body?.currency || 'NGN'
  const method = body?.method || 'manual_bank_transfer'
  const deposit = {
    id: id('dep'),
    object: 'deposit',
    investor_id: investorId,
    amount: money(body?.amount || 0),
    currency,
    method,
    status: 'pending',
    created_at: nowIso(),
  }
  if (method === 'manual_bank_transfer' || method === 'wire' || method === 'international_wire') {
    deposit.reference_code = `DVD${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    deposit.bank_details = {
      bank_name: 'Sample Settlement Bank',
      account_name: 'Bluum Finance Client Account (sample)',
      account_number: '0000000000',
      note: 'Sample details from the mock service. Never use for a real transfer.',
    }
    deposit.expires_at = new Date(Date.now() + 3 * 864e5).toISOString()
  } else {
    // ACH and card complete at once in the mock, so trading can be tested.
    deposit.status = 'completed'
    deposit.completed_at = nowIso()
    credit(investorId, currency, deposit.amount)
    addTransaction(investorId, {
      type: 'deposit',
      amount: deposit.amount,
      currency,
      description: `Deposit by ${method}`,
    })
  }
  state.deposits.set(investorId, [deposit, ...(state.deposits.get(investorId) || [])])
  return deposit
})

on('GET', /^\/investors\/(inv_[^/]+)\/deposits$/, (m) => list(state.deposits.get(m[1]) || []))
on('GET', /^\/investors\/(inv_[^/]+)\/deposits\/(dep_[^/]+)$/, (m) => {
  const d = (state.deposits.get(m[1]) || []).find((x) => x.id === m[2])
  if (!d) throw mockError(404, 'BLUM-404-005', 'No such deposit.')
  return d
})
on('POST', /^\/investors\/(inv_[^/]+)\/deposits\/(dep_[^/]+)\/simulate$/, (m) => {
  const d = (state.deposits.get(m[1]) || []).find((x) => x.id === m[2])
  if (!d) throw mockError(404, 'BLUM-404-005', 'No such deposit.')
  if (d.status !== 'completed') {
    d.status = 'completed'
    d.completed_at = nowIso()
    credit(m[1], d.currency, d.amount)
    addTransaction(m[1], {
      type: 'deposit',
      amount: d.amount,
      currency: d.currency,
      description: 'Deposit received',
    })
  }
  return d
})

on('POST', /^\/investors\/(inv_[^/]+)\/withdrawals\/quote$/, (_m, { body }) => {
  const amount = Number(body?.amount || 0)
  const fee = body?.currency === 'NGN' ? 100 : 2
  return {
    object: 'withdrawal_quote',
    amount: money(amount),
    fee_amount: money(fee),
    total_amount: money(amount + fee),
    currency: body?.currency || 'NGN',
    minimum_amount: body?.currency === 'NGN' ? '1000.00' : '10.00',
  }
})

on('POST', /^\/investors\/(inv_[^/]+)\/withdrawals$/, (m, { body }) => {
  const investorId = m[1]
  const currency = body?.currency || 'NGN'
  const fee = currency === 'NGN' ? 100 : 2
  debit(investorId, currency, Number(body?.amount || 0) + fee)
  const wd = {
    id: id('wd'),
    object: 'withdrawal',
    investor_id: investorId,
    amount: money(body?.amount || 0),
    fee_amount: money(fee),
    currency,
    funding_source_id: body?.funding_source_id || null,
    status: 'pending',
    created_at: nowIso(),
  }
  state.withdrawals.set(investorId, [wd, ...(state.withdrawals.get(investorId) || [])])
  addTransaction(investorId, {
    type: 'withdrawal',
    amount: `-${wd.amount}`,
    currency,
    description: 'Withdrawal requested',
  })
  return wd
})
on('GET', /^\/investors\/(inv_[^/]+)\/withdrawals$/, (m) => list(state.withdrawals.get(m[1]) || []))

// --- Assets ---
const allAssets = () => [...state.assets.values()]

function filterAssets(query = {}) {
  let items = allAssets()
  if (query.class) {
    const classes = String(query.class).split(',')
    items = items.filter((a) => classes.includes(a.class))
  }
  if (query.country) items = items.filter((a) => a.country === String(query.country).toLowerCase())
  if (query.q) {
    const q = String(query.q).toLowerCase()
    items = items.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
  }
  return items
}

on('GET', /^\/assets$/, (_m, { query }) => list(filterAssets(query)))
on('GET', /^\/assets\/search$/, (_m, { query }) => list(filterAssets({ ...query, q: query?.q || query?.query })))
on('GET', /^\/assets\/universe\/search$/, (_m, { query }) =>
  list(
    filterAssets({ ...query, q: query?.q || query?.query }).map(({ price, ...rest }) => rest),
  ),
)
on('GET', /^\/assets\/quotes$/, (_m, { query }) => {
  const symbols = String(query?.symbols || '').split(',').filter(Boolean)
  return list(symbols.map((s) => quoteFor(assetOrThrow(s))))
})
on('GET', /^\/assets\/batch$/, (_m, { query }) => {
  const symbols = String(query?.symbols || '').split(',').filter(Boolean)
  return list(symbols.map((s) => assetOrThrow(s)))
})

// A small deterministic generator, so the same symbol always draws the same
// sample chart and the same sample move. Real prices replace all of this.
function seedOf(text) {
  let h = 2166136261
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
function rng(seed) {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const sampleMovePercent = (symbol) => Number((((seedOf(symbol) % 460) - 210) / 100).toFixed(2)) // -2.10 to +2.49
export function sampleWalk(symbol, end, count, volatility = 0.012) {
  const r = rng(seedOf(symbol))
  const drift = ((seedOf(symbol + 'd') % 100) - 35) / 100 * 0.0016
  const out = [end]
  for (let i = 1; i < count; i++) out.push(out[i - 1] / (1 + drift + (r() - 0.5) * 2 * volatility))
  return out.reverse()
}

function quoteFor(asset) {
  const price = Number(asset.price)
  const pct = sampleMovePercent(asset.symbol)
  const spread = price * 0.0012
  return {
    object: 'quote',
    symbol: asset.symbol,
    currency: asset.currency,
    last_price: money(price),
    bid_price: money(price - spread),
    ask_price: money(price + spread),
    // Illustrative movement so the UI's up and down states are exercised.
    change: money((price * pct) / (100 + pct)),
    change_percent: pct.toFixed(2),
    price_source: 'MOCK',
    price_confidence: 'SAMPLE',
    timestamp: nowIso(),
  }
}

on('GET', /^\/assets\/([^/]+)\/quote$/, (m) => quoteFor(assetOrThrow(decodeURIComponent(m[1]))))
on('GET', /^\/assets\/([^/]+)\/snapshot$/, (m) => {
  const asset = assetOrThrow(decodeURIComponent(m[1]))
  return { object: 'snapshot', asset, quote: quoteFor(asset) }
})
on('GET', /^\/assets\/([^/]+)\/bars$/, (m, { query }) => {
  const asset = assetOrThrow(decodeURIComponent(m[1]))
  const count = Number(query?.limit || 30)
  const base = Number(asset.price)
  const walk = sampleWalk(asset.symbol, base, count)
  const bars = Array.from({ length: count }, (_, i) => {
    const close = walk[i]
    return {
      t: new Date(Date.now() - (count - i) * 864e5).toISOString().slice(0, 10),
      o: money(close * 0.998),
      h: money(close * 1.006),
      l: money(close * 0.994),
      c: money(close),
      v: 100000 + i * 137,
    }
  })
  return list(bars)
})
on('GET', /^\/assets\/([^/]+)$/, (m) => assetOrThrow(decodeURIComponent(m[1])))

// --- Markets ---
on('GET', /^\/markets$/, () =>
  list([
    { code: 'XNSA', name: 'Nigerian Exchange', country: 'ng', currency: 'NGN', status: 'open' },
    { code: 'XNAS', name: 'Nasdaq', country: 'us', currency: 'USD', status: 'open' },
    { code: 'XNAI', name: 'Nairobi Securities Exchange', country: 'ke', currency: 'KES', status: 'open' },
  ]),
)
on('GET', /^\/markets\/([^/]+)\/status$/, (m) => ({
  object: 'market_status',
  code: m[1],
  status: 'open',
  note: 'Sample status from the mock service.',
}))

// --- Orders and positions ---
on('POST', /^\/investors\/(inv_[^/]+)\/orders\/estimate$/, (m, { body }) => estimateOrder(m[1], body))
on('POST', /^\/investors\/(inv_[^/]+)\/orders$/, (m, { body }) => placeOrder(m[1], body))
on('GET', /^\/investors\/(inv_[^/]+)\/orders$/, (m, { query }) => {
  let items = state.orders.get(m[1]) || []
  if (query?.status) items = items.filter((o) => o.status === query.status)
  return list(items)
})
on('GET', /^\/investors\/(inv_[^/]+)\/orders\/(ord_[^/]+)$/, (m) => {
  const o = (state.orders.get(m[1]) || []).find((x) => x.id === m[2])
  if (!o) throw mockError(404, 'BLUM-404-006', 'No such order.')
  return o
})
on('POST', /^\/investors\/(inv_[^/]+)\/orders\/(ord_[^/]+)\/cancel$/, (m) => {
  const o = (state.orders.get(m[1]) || []).find((x) => x.id === m[2])
  if (!o) throw mockError(404, 'BLUM-404-006', 'No such order.')
  if (o.status === 'filled') throw mockError(409, 'BLUM-409-002', 'That order has already been filled.')
  o.status = 'canceled'
  o.updated_at = nowIso()
  if (o.side === 'buy') credit(m[1], o.currency, o.estimated_total)
  return o
})
on('POST', /^\/investors\/(inv_[^/]+)\/orders\/(ord_[^/]+)\/simulate$/, (m) => {
  const o = (state.orders.get(m[1]) || []).find((x) => x.id === m[2])
  if (!o) throw mockError(404, 'BLUM-404-006', 'No such order.')
  if (o.status !== 'filled') fillOrder(m[1], o, assetOrThrow(o.symbol))
  settleAll(m[1])
  return o
})

on('GET', /^\/investors\/(inv_[^/]+)\/positions$/, (m) => list(state.positions.get(m[1]) || []))
on('GET', /^\/investors\/(inv_[^/]+)\/positions\/(pos_[^/]+)$/, (m) => {
  const p = (state.positions.get(m[1]) || []).find((x) => x.id === m[2])
  if (!p) throw mockError(404, 'BLUM-404-007', 'No such position.')
  return p
})
on('POST', /^\/investors\/(inv_[^/]+)\/positions\/(pos_[^/]+)\/close$/, (m) => {
  const p = (state.positions.get(m[1]) || []).find((x) => x.id === m[2])
  if (!p) throw mockError(404, 'BLUM-404-007', 'No such position.')
  const asset = assetOrThrow(p.symbol)
  if (isBond(asset)) throw mockError(400, 'BLUM-400-021', 'Bond orders must be limit orders.')
  return placeOrder(m[1], { symbol: p.symbol, side: 'sell', type: 'market', quantity: p.settled_quantity })
})

on('GET', /^\/investors\/(inv_[^/]+)\/transactions$/, (m, { query }) => {
  let items = state.transactions.get(m[1]) || []
  if (query?.type) items = items.filter((t) => t.type === query.type)
  return list(items)
})

on('GET', /^\/investors\/(inv_[^/]+)\/portfolio-chart$/, (m, { query }) => {
  const positions = state.positions.get(m[1]) || []
  const value = positions.reduce((s, p) => s + Number(p.market_value), 0)
  const points = Number(query?.points || 30)
  return list(
    Array.from({ length: points }, (_, i) => ({
      t: new Date(Date.now() - (points - i) * 864e5).toISOString().slice(0, 10),
      v: money(value * (0.94 + (i / points) * 0.06)),
    })),
  )
})

// --- Offerings ---
on('GET', /^\/offerings$/, (_m, { query }) => {
  let items = state.offerings
  if (query?.status) items = items.filter((o) => o.status === query.status)
  if (query?.country) items = items.filter((o) => o.country === String(query.country).toLowerCase())
  return list(items)
})
on('GET', /^\/offerings\/(off_[^/]+)$/, (m) => {
  const o = state.offerings.find((x) => x.id === m[1])
  if (!o) throw mockError(404, 'BLUM-404-008', 'No such offering.')
  return o
})
on('POST', /^\/investors\/(inv_[^/]+)\/subscription$/, (m, { body }) => {
  const investorId = m[1]
  const offering = state.offerings.find((x) => x.id === body?.offering_id)
  if (!offering) throw mockError(404, 'BLUM-404-008', 'No such offering.')
  if (offering.status !== 'OPEN') throw mockError(409, 'BLUM-409-003', 'That offering is not open for applications.')
  const units = Number(body?.units || 0)
  if (units < Number(offering.min_units)) {
    throw mockError(400, 'BLUM-400-030', `The smallest application is ${offering.min_units} units.`)
  }
  if (units % Number(offering.unit_increment) !== 0) {
    throw mockError(400, 'BLUM-400-031', `Units must be a multiple of ${offering.unit_increment}.`)
  }
  const amount = units * Number(offering.price_per_unit)
  // Cash is held, not spent, until allotment.
  reserve(investorId, offering.currency, amount)
  const sub = {
    id: id('sub'),
    object: 'subscription',
    investor_id: investorId,
    offering_id: offering.id,
    offering_name: offering.name,
    units: String(units),
    price_per_unit: offering.price_per_unit,
    amount: money(amount),
    currency: offering.currency,
    status: 'APPLIED',
    created_at: nowIso(),
  }
  state.subscriptions.set(investorId, [sub, ...(state.subscriptions.get(investorId) || [])])
  addTransaction(investorId, {
    type: 'offering_application',
    amount: `-${sub.amount}`,
    currency: sub.currency,
    description: `Applied for ${units} units of ${offering.name}`,
  })
  return sub
})
on('GET', /^\/investors\/(inv_[^/]+)\/subscriptions$/, (m) => list(state.subscriptions.get(m[1]) || []))
on('GET', /^\/investors\/(inv_[^/]+)\/subscriptions\/(sub_[^/]+)$/, (m) => {
  const s = (state.subscriptions.get(m[1]) || []).find((x) => x.id === m[2])
  if (!s) throw mockError(404, 'BLUM-404-009', 'No such application.')
  return s
})
on('POST', /^\/investors\/(inv_[^/]+)\/subscriptions\/(sub_[^/]+)\/withdraw$/, (m) => {
  const s = (state.subscriptions.get(m[1]) || []).find((x) => x.id === m[2])
  if (!s) throw mockError(404, 'BLUM-404-009', 'No such application.')
  if (s.status !== 'APPLIED') throw mockError(409, 'BLUM-409-004', 'That application can no longer be withdrawn.')
  s.status = 'WITHDRAWN'
  const w = walletFor(m[1], s.currency)
  if (w) {
    w.reserved_balance = money(Number(w.reserved_balance) - Number(s.amount))
    w.available_balance = money(Number(w.available_balance) + Number(s.amount))
  }
  return s
})

// --- Portfolios (PTFs) ---
on('GET', /^\/ptfs$/, () => list(state.portfolios))
on('GET', /^\/ptfs\/(ptf_[^/]+)$/, (m) => {
  const p = state.portfolios.find((x) => x.id === m[1])
  if (!p) throw mockError(404, 'BLUM-404-010', 'No such portfolio.')
  return p
})
on('GET', /^\/ptfs\/(ptf_[^/]+)\/price$/, (m) => {
  const p = state.portfolios.find((x) => x.id === m[1])
  if (!p) throw mockError(404, 'BLUM-404-010', 'No such portfolio.')
  return { object: 'ptf_price', ptf_id: p.id, unit_price: p.unit_price, currency: p.currency, as_of: nowIso() }
})
on('POST', /^\/investors\/(inv_[^/]+)\/ptf-orders\/estimate$/, (_m, { body }) => {
  const p = state.portfolios.find((x) => x.id === body?.ptf_id)
  if (!p) throw mockError(404, 'BLUM-404-010', 'No such portfolio.')
  const amount = Number(body?.amount || 0)
  const fees = feesFor(amount, p.currency)
  return {
    object: 'ptf_order_estimate',
    ptf_id: p.id,
    units: (amount / Number(p.unit_price)).toFixed(6),
    unit_price: p.unit_price,
    order_value: money(amount),
    fees,
    estimated_total: money(amount + totalFees(fees)),
    currency: p.currency,
  }
})
on('POST', /^\/investors\/(inv_[^/]+)\/ptf-orders$/, (m, { body }) => {
  const investorId = m[1]
  const p = state.portfolios.find((x) => x.id === body?.ptf_id)
  if (!p) throw mockError(404, 'BLUM-404-010', 'No such portfolio.')
  const amount = Number(body?.amount || 0)
  const fees = feesFor(amount, p.currency)
  const total = amount + totalFees(fees)
  debit(investorId, p.currency, total)
  const units = amount / Number(p.unit_price)
  const holdings = state.holdings.get(investorId) || []
  let holding = holdings.find((h) => h.ptf_id === p.id)
  if (!holding) {
    holding = {
      id: id('cmpos'),
      object: 'ptf_holding',
      ptf_id: p.id,
      name: p.name,
      currency: p.currency,
      units: '0',
      unit_price: p.unit_price,
      market_value: '0.00',
      total_cost_basis: '0.00',
    }
    holdings.push(holding)
  }
  holding.units = (Number(holding.units) + units).toFixed(6)
  holding.total_cost_basis = money(Number(holding.total_cost_basis) + amount)
  holding.market_value = money(Number(holding.units) * Number(p.unit_price))
  state.holdings.set(investorId, holdings)
  addTransaction(investorId, {
    type: 'ptf_buy',
    amount: `-${money(total)}`,
    currency: p.currency,
    description: `Bought ${units.toFixed(4)} units of ${p.name}`,
  })
  return {
    id: id('ord'),
    object: 'ptf_order',
    investor_id: investorId,
    ptf_id: p.id,
    side: body?.side || 'buy',
    amount: money(amount),
    units: units.toFixed(6),
    status: 'filled',
    currency: p.currency,
    fees,
    created_at: nowIso(),
  }
})
on('GET', /^\/investors\/(inv_[^/]+)\/ptf-holdings$/, (m) => list(state.holdings.get(m[1]) || []))

// --- News ---
on('GET', /^\/news$/, () =>
  list([
    {
      id: 'nws_sample_1',
      object: 'news',
      headline: 'Sample market report from the mock service',
      summary: 'Placeholder text. Real headlines come from Bluum once the news endpoints are confirmed.',
      published_at: nowIso(),
      symbols: ['DANGCEM'],
    },
  ]),
)

// --- Webhooks (registration) ---
on('POST', /^\/webhooks$/, (_m, { body }) => ({
  id: id('wh'),
  object: 'webhook',
  url: body?.url,
  events: body?.events || [],
  secret: 'mock_webhook_secret_not_for_use',
  status: 'active',
  created_at: nowIso(),
}))

// --- Cash management: switched off, as it is for a new tenant ---
on('GET', /^\/investors\/(inv_[^/]+)\/cash-management\/eligibility$/, () => {
  throw mockError(403, 'BLUM-403-004', 'Cash management is not enabled for this tenant.')
})

// ---------------------------------------------------------------------------
export function mockRequest({ method, path, query, body }) {
  for (const r of routes) {
    if (r.method !== method) continue
    const m = path.match(r.pattern)
    if (m) return r.handler(m, { query, body })
  }
  throw mockError(
    501,
    'mock_not_implemented',
    `The sample Bluum service has no answer for ${method} ${path}. It works in live mode.`,
  )
}

// Used by the sandbox tools page so a demo can be reset.
export function resetMock() {
  state.assets = buildAssets()
  state.offerings = buildOfferings()
  state.portfolios = buildPortfolios()
  for (const key of ['investors', 'wallets', 'deposits', 'withdrawals', 'fundingSources', 'orders', 'positions', 'transactions', 'subscriptions', 'acceptances', 'holdings']) {
    state[key] = new Map()
  }
}

export const mockState = state
