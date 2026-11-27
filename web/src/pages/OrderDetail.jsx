// One order: where it is, what has filled, and what can still be done.

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatDateTime, formatMoney, formatPrice, formatQuantity } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Card, ErrorNote, KV, Loading, Notice, PageHead, StatusPill } from '../components/ui.jsx'

const OPEN = ['accepted', 'pending', 'partially_filled', 'new']

export default function OrderDetail() {
  const { id } = useParams()
  const { isSampleData } = useSession()
  const order = useLoad(() => api.trade.orders().then((r) => ({ data: (r.data || []).find((o) => o.id === id) || null })), [id])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const o = order.data

  if (order.loading && !o) return <Loading rows={5} />
  if (order.error) return <ErrorNote error={order.error} onRetry={order.reload} />
  if (!o) return <Notice kind="warn" title="We could not find that order"><Link to="/orders">Back to orders</Link></Notice>

  const open = OPEN.includes(o.status)
  const filled = o.status === 'filled'
  const cancelled = ['canceled', 'cancelled'].includes(o.status)
  const total = Number(o.filled_quantity) || 0
  const when = o.created_at ? formatDateTime(o.created_at) : ''

  async function act(fn) {
    setBusy(true)
    setErr(null)
    try {
      await fn(o.id)
      order.reload()
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  const steps = [
    { name: 'Placed', done: true, note: when },
    { name: 'Accepted by the exchange', done: !cancelled || filled, note: when },
    { name: 'Filling', done: filled || total > 0, now: open, note: open ? 'Waiting for the market' : '' },
    { name: cancelled ? 'Cancelled' : 'Filled', done: filled || cancelled, note: filled ? (o.filled_at ? formatDateTime(o.filled_at) : '') : cancelled ? '' : 'We email you' },
  ]

  return (
    <div className="stack">
      <PageHead title={`Order ${o.id.slice(0, 12)}`} sub={`${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.symbol} · placed ${when}`} back={{ to: '/orders', label: 'Orders' }}>
        {open && <button className="btn btn-danger" disabled={busy} onClick={() => act(api.trade.cancel)}>Cancel order</button>}
        {open && isSampleData && <button className="btn btn-quiet" disabled={busy} onClick={() => act(api.trade.simulateFill)}>Fill it (sandbox)</button>}
        {filled && <Link className="btn btn-outline" to={`/contract-note/${o.id}`}>Contract note</Link>}
      </PageHead>
      <ErrorNote error={err} />
      <div className="split">
        <div className="stack">
          <Card title="Where your order is">
            {steps.map((s, i) => (
              <div className="list-row" key={s.name}>
                <span className={`ico ${s.done ? 'good' : s.now ? '' : ''}`} style={s.done || s.now ? undefined : { background: 'var(--panel)', color: 'var(--muted)' }}>
                  {s.done ? '✓' : i + 1}
                </span>
                <div className="grow">
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{s.name}</div>
                  {s.note && <div className="xs muted">{s.note}</div>}
                </div>
                <span className="xs muted">{s.done ? 'Done' : s.now ? 'Now' : 'Next'}</span>
              </div>
            ))}
          </Card>
          <Card title="Fills so far">
            {total > 0 ? (
              <>
                <KV k="Shares filled" v={formatQuantity(total)} />
                <KV k="Average price" v={o.filled_avg_price ? formatMoney(o.filled_avg_price, o.currency) : '—'} />
              </>
            ) : (
              <p className="small muted">No fills yet. Market orders usually fill within seconds while the market is open.</p>
            )}
          </Card>
        </div>
        <Card title="Order">
          <KV k="Company" v={o.symbol} />
          <KV k="Side" v={o.side === 'buy' ? 'Buy' : 'Sell'} />
          <KV k="Type" v={o.type === 'limit' ? `Limit ${o.limit_price ? formatPrice(o.limit_price) : ''}` : 'Market order'} />
          <KV k="Amount" v={o.order_value ? formatMoney(o.order_value, o.currency) : '—'} />
          <KV k="Fee" v={o.fees?.length ? formatMoney(o.fees.reduce((s, f) => s + Number(f.amount || 0), 0), o.currency) : '—'} />
          <KV k="Status" v={<StatusPill status={o.status} />} />
          <p className="xs muted mt-sm">{open ? 'You can cancel while the order is open. Once it fills it cannot be cancelled.' : ''}</p>
        </Card>
      </div>
    </div>
  )
}
