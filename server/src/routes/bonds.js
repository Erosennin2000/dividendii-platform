// Bonds, bills and notes.
//
// The same Bluum order endpoint as shares, with different units and stricter
// rules, so it gets its own route and its own screen:
//
//   type           must be limit (market orders are refused)
//   quantity       face value, in multiples of the bond's min_increment
//   limit_price    clean price as a percentage of par, e.g. 99.875
//   time_in_force  must be day
//   cash needed    face x (clean price + accrued interest) / 100
//
// Bond trading is enabled per tenant. Until Bluum switches it on, calls here
// answer with a plain sentence saying so.

import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { assets, orders, positions, disclosures } from '../bluum/api.js'
import { orderTags } from '../db/index.js'
import { route, badRequest } from '../errors.js'
import { requireInvestor, idempotent, ok, logAction } from '../middleware.js'

const router = Router()

const BOND_CLASSES = ['bond', 'bill', 'note']
const FIXED_INCOME_STEP = 'step_fixed_income_enrollment'

// Everything on the bond shelf.
router.get(
  '/',
  route(async (req, res) => {
    const result = await assets.list({ class: BOND_CLASSES.join(','), limit: req.query?.limit || 50 })
    const items = (result.data || []).filter((a) => BOND_CLASSES.includes(a.class))
    ok(res, items.map(decorate), {
      // Price is not money here, and the screen must say so.
      price_note: 'Prices are a percentage of face value. 99.875 means 99.875% of face value.',
    })
  }),
)

router.get(
  '/:symbol',
  route(async (req, res) => {
    const asset = await assets.get(req.params.symbol, { class: 'bond' })
    if (!BOND_CLASSES.includes(asset.class)) throw badRequest('That is not a bond.')
    const quote = await assets.quote(req.params.symbol).catch(() => null)
    ok(res, { asset: decorate(asset), quote })
  }),
)

// The risk disclosure, which must be accepted before the first bond order.
router.get(
  '/disclosures/outstanding',
  requireInvestor,
  route(async (req, res) => {
    const result = await disclosures.outstanding(req.user.investor_id, FIXED_INCOME_STEP)
    ok(res, result.data || [])
  }),
)

function decorate(asset) {
  const bond = asset.bond || {}
  return {
    ...asset,
    display: {
      price_label: 'Price (% of face value)',
      quantity_label: 'Face value',
      min_increment: bond.min_increment || null,
      coupon: bond.coupon_rate ? `${bond.coupon_rate}%` : null,
      coupon_frequency: bond.coupon_frequency || null,
      maturity_date: bond.maturity_date || null,
      settlement: bond.settlement_convention || null,
      accrued_interest_percent: bond.accrued_interest || null,
      yield_to_maturity: bond.yield_to_maturity || null,
    },
  }
}

// Works out the cash a bond order needs, from the face value and the clean
// price, and then asks Bluum for the authoritative estimate.
function validateBondOrder(asset, body) {
  const { side, quantity, limit_price } = body || {}
  if (!['buy', 'sell'].includes(side)) throw badRequest('Choose buy or sell.')

  const face = Number(quantity)
  if (!(face > 0)) throw badRequest('Enter the face value you want.')
  const increment = Number(asset.bond?.min_increment || 0)
  if (increment && face % increment !== 0) {
    throw badRequest(`Face value must be a multiple of ${increment}.`)
  }
  if (!(Number(limit_price) > 0)) throw badRequest('Enter the price you want, as a percentage of face value.')
  if (Number(limit_price) > 200) {
    throw badRequest('That price looks like money rather than a percentage of face value.')
  }

  return {
    symbol: asset.symbol,
    class: 'bond', // so a CUSIP resolves
    side,
    type: 'limit', // Bluum refuses anything else
    time_in_force: 'day', // Bluum refuses anything else
    quantity: String(face),
    limit_price: String(limit_price),
    settlement_date: body?.settlement_date || undefined,
  }
}

router.post(
  '/estimate',
  requireInvestor,
  route(async (req, res) => {
    const asset = await assets.get(req.body?.symbol, { class: 'bond' })
    if (!BOND_CLASSES.includes(asset.class)) throw badRequest('That is not a bond.')
    const body = validateBondOrder(asset, req.body)
    const estimate = await orders.estimate(req.user.investor_id, body)

    // Our own arithmetic alongside Bluum's, so the screen can explain the
    // number rather than only showing it.
    const accrued = Number(asset.bond?.accrued_interest || 0)
    const face = Number(body.quantity)
    const clean = Number(body.limit_price)
    ok(res, estimate, {
      workings: {
        face_value: face,
        clean_price_percent: clean,
        accrued_interest_percent: accrued,
        principal: Number(((face * clean) / 100).toFixed(2)),
        accrued_interest: Number(((face * accrued) / 100).toFixed(2)),
        note: 'The exact accrued interest is worked out by the custodian at settlement, so the total is approximate.',
      },
    })
  }),
)

router.post(
  '/orders',
  requireInvestor,
  idempotent('bonds.place'),
  route(async (req, res) => {
    // The risk disclosure must be out of the way first.
    const outstanding = await disclosures.outstanding(req.user.investor_id, FIXED_INCOME_STEP)
    if ((outstanding.data || []).length) {
      throw badRequest('Please read and accept the bond risk disclosure first.')
    }

    const asset = await assets.get(req.body?.symbol, { class: 'bond' })
    if (!BOND_CLASSES.includes(asset.class)) throw badRequest('That is not a bond.')
    const body = validateBondOrder(asset, req.body)

    const clientOrderId = `dvd_${randomUUID().replace(/-/g, '').slice(0, 20)}`
    const order = await orders.place(req.user.investor_id, { ...body, client_order_id: clientOrderId })
    await orderTags.tag({ clientOrderId, userId: req.user.id, purpose: 'bond' })
    logAction(req, 'bond_order.placed', `${order.id} ${body.side} ${asset.symbol} face ${body.quantity}`)
    ok(res, order)
  }),
)

// Bond holdings, kept separate from shares because the units differ.
router.get(
  '/holdings/all',
  requireInvestor,
  route(async (req, res) => {
    const result = await positions.list(req.user.investor_id, { non_zero_only: true })
    const items = (result.data || []).filter((p) => BOND_CLASSES.includes(p.class))
    ok(res, items, { quantity_label: 'Face value' })
  }),
)

export default router
