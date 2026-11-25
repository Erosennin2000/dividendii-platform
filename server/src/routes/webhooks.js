// Bluum's webhooks. This is how the platform learns that anything happened:
// an order filled, a deposit arrived, an account was approved, a coupon was
// paid. Nothing is polled.
//
// The order of work matters:
//   1. verify the signature on the raw body, before parsing
//   2. store the event, and stop if it has been seen before
//   3. answer 200 straight away, so Bluum does not retry
//   4. then act on it
//
// An event we have no handler for is still stored. It is not an error.

import { Router } from 'express'
import { verifyWebhookSignature } from '../bluum/signature.js'
import { webhookEvents, users, gifts, orderTags } from '../db/index.js'
import { ok } from '../middleware.js'
import { config } from '../config.js'

const router = Router()

// The events this platform subscribes to. Bluum has no wildcards, so each
// name is registered exactly as spelled here.
export const SUBSCRIBED_EVENTS = [
  'investor.activated',
  'investor.updated',
  'investor.declined',
  'investor.suspended',
  'investor.documents_requested',
  'deposit.completed',
  'deposit.failed',
  'withdrawal.completed',
  'withdrawal.failed',
  'order.accepted',
  'order.filled',
  'order.partially_filled',
  'order.canceled',
  'order.rejected',
  'position.opened',
  'position.closed',
  'subscription.allotted',
  'subscription.partially_allotted',
  'subscription.rejected',
  'subscription.refunded',
  'bond.coupon.paid',
  'bond.matured',
]

router.post('/bluum', async (req, res) => {
  // req.rawBody is set in index.js by the JSON parser's verify hook.
  const raw = req.rawBody || Buffer.from('')
  const check = verifyWebhookSignature(raw, req.header('X-Bluum-Signature'))

  const payload = req.body || {}
  const eventType = payload.type || payload.event || 'unknown'
  const eventId = payload.id || payload.event_id || null

  // A bad signature is recorded and refused. It is never acted on.
  if (!check.ok) {
    await webhookEvents
      .store({ eventId, eventType, signatureOk: false, payload })
      .catch((e) => console.error('could not store rejected webhook', e))
    console.warn(`[webhook] rejected ${eventType}: ${check.reason}`)
    // 400 rather than 401, so Bluum does not retry a body we will never trust.
    return res.status(400).json({ error: { code: 'bad_signature', message: 'Signature check failed.' } })
  }

  const stored = await webhookEvents.store({ eventId, eventType, signatureOk: true, payload })
  if (!stored) {
    // Already handled. Bluum may deliver the same event more than once.
    return res.status(200).json({ received: true, duplicate: true })
  }

  // The work is done before answering. On a long-running server it would be
  // safe to answer first, but a serverless instance can be frozen as soon as
  // the response is sent, and the handler would never run. Handlers here are
  // short. A failure answers 500 so Bluum retries, and the stored event means
  // a retry is recognised rather than processed twice.
  try {
    await handleEvent(eventType, payload)
    await webhookEvents.markProcessed(stored.id)
    return res.status(200).json({ received: true })
  } catch (error) {
    console.error(`[webhook] ${eventType} failed`, error)
    await webhookEvents.markProcessed(stored.id, String(error?.message || error))
    return res.status(500).json({ error: { code: 'handler_failed', message: 'Stored, but not yet handled.' } })
  }
})

async function handleEvent(type, payload) {
  const data = payload.data || payload
  const investorId = data.investor_id || data.id

  switch (type) {
    case 'investor.activated':
    case 'investor.updated':
    case 'investor.declined':
    case 'investor.suspended':
    case 'investor.documents_requested': {
      if (!investorId) return
      const user = await users.findByInvestorId(investorId)
      if (user) await users.update(user.id, { investor_status: data.status || type.split('.')[1] })
      return
    }

    case 'order.filled':
    case 'order.partially_filled': {
      // If this order was a gift, mark the gift delivered.
      const clientOrderId = data.client_order_id
      if (!clientOrderId) return
      const tag = await orderTags.find(clientOrderId)
      if (tag?.gift_id) await gifts.update(tag.gift_id, { status: 'delivered' })
      return
    }

    case 'order.rejected':
    case 'order.canceled': {
      const clientOrderId = data.client_order_id
      if (!clientOrderId) return
      const tag = await orderTags.find(clientOrderId)
      if (tag?.gift_id) await gifts.update(tag.gift_id, { status: 'awaiting_funding' })
      return
    }

    // These need no action beyond being stored: the screens read the current
    // state from Bluum when they open. They are listed so it is clear they
    // were considered rather than forgotten.
    case 'deposit.completed':
    case 'deposit.failed':
    case 'withdrawal.completed':
    case 'withdrawal.failed':
    case 'order.accepted':
    case 'position.opened':
    case 'position.closed':
    case 'subscription.allotted':
    case 'subscription.partially_allotted':
    case 'subscription.rejected':
    case 'subscription.refunded':
    case 'bond.coupon.paid':
    case 'bond.matured':
      return

    default:
      console.log(`[webhook] no handler for ${type}; stored only`)
  }
}

// For the staff page: what has arrived lately, and whether the secret is set.
router.get('/recent', async (_req, res) => {
  const events = await webhookEvents.recent(50)
  ok(
    res,
    events.map((e) => ({
      id: e.id,
      event_id: e.event_id,
      event_type: e.event_type,
      signature_ok: e.signature_ok,
      received_at: e.received_at,
      processed_at: e.processed_at,
      error: e.error,
    })),
    {
      secret_configured: Boolean(config.bluum.webhookSecret),
      subscribed_events: SUBSCRIBED_EVENTS,
    },
  )
})

export default router
