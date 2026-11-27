// Orders and activity: everything placed, newest first, with the selected
// order's details and recent money activity beside it.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, formatDateTime, formatMoney, formatQuantity, signed, txTime } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Card, Empty, ErrorNote, KV, Loading, PageHead, StatusPill, Tabs } from '../components/ui.jsx'

const OPEN = ['accepted', 'pending', 'partially_filled', 'new']
const BOND = ['bond', 'bill', 'note']

export const orderSize = (o) =>
  BOND.includes(o.asset_class)
    ? `${formatQuantity(o.quantity)} face`
    : o.notional
      ? formatMoney(o.notional, o.currency, { decimals: 0 })
      : `${formatQuantity(o.quantity)} sh`

export default function Orders() {
  const { isSampleData } = useSession()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const orders = useLoad(() => api.trade.orders())
  const tx = useLoad(() => api.money.transactions())

  const rows = (orders.data || []).filter((o) =>
    filter === 'open' ? OPEN.includes(o.status) : filter === 'filled' ? o.status === 'filled' : filter === 'cancelled' ? ['canceled', 'cancelled'].includes(o.status) : true,
  )
  const sel = (orders.data || []).find((o) => o.id === picked) || rows[0]

  async function act(fn, id) {
    setBusy(true)
    await fn(id).catch(() => {})
    setBusy(false)
    orders.reload()
  }

  return (
    <div className="stack">
      <PageHead title="Orders and activity" sub="Everything you have placed, newest first." />
      <div className="split">
        <div className="stack">
          <Tabs
            label="Which orders"
            value={filter}
            onChange={setFilter}
            options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'filled', label: 'Filled' }, { value: 'cancelled', label: 'Cancelled' }]}
          />
          <Card flush>
            {orders.loading ? (
              <div className="card-body"><Loading rows={5} /></div>
            ) : orders.error ? (
              <div className="card-body"><ErrorNote error={orders.error} onRetry={orders.reload} /></div>
            ) : !rows.length ? (
              <Empty title="No orders here" action={<Link className="btn btn-primary" to="/markets">Place one</Link>}>
                {filter === 'all' ? 'Your orders will appear here.' : 'Try another filter.'}
              </Empty>
            ) : (
              <table>
                <thead>
                  <tr><th>Order</th><th>Side</th><th>Type</th><th className="num">Size</th><th>Status</th><th>Placed</th></tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className="clickable" onClick={() => setPicked(o.id)} style={o.id === sel?.id ? { background: 'var(--dividendii-info-bg)' } : undefined}>
                      <td><strong>{o.symbol}</strong><div className="xs muted">{o.id.slice(0, 12)}</div></td>
                      <td>{o.side === 'buy' ? 'Buy' : 'Sell'}</td>
                      <td>{o.type === 'limit' ? `Limit${o.limit_price ? ` ${o.limit_price}` : ''}` : 'Market'}</td>
                      <td className="num">{orderSize(o)}</td>
                      <td><StatusPill status={o.status} /></td>
                      <td className="small muted">{formatDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="stack">
          {sel && (
            <Card title={sel.id.slice(0, 16)}>
              <p className="small muted" style={{ marginTop: -8, marginBottom: 8 }}>{sel.symbol}</p>
              <KV k="Status" v={<StatusPill status={sel.status} />} />
              <KV k="Amount" v={sel.order_value ? formatMoney(sel.order_value, sel.currency) : '—'} />
              <KV k="Fee" v={sel.fees?.length ? formatMoney(sel.fees.reduce((s, f) => s + Number(f.amount || 0), 0), sel.currency) : '—'} />
              <div className="wrap mt">
                {OPEN.includes(sel.status) && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => act(api.trade.cancel, sel.id)}>Cancel order</button>}
                {OPEN.includes(sel.status) && isSampleData && <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => act(api.trade.simulateFill, sel.id)}>Fill it (sandbox)</button>}
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/orders/${sel.id}`)}>Open order</button>
              </div>
            </Card>
          )}
          <Card title="Recent activity" action={<Link className="small" to="/money/transactions" style={{ fontWeight: 600 }}>See all</Link>}>
            {tx.loading ? <Loading rows={3} /> : (tx.data || []).slice(0, 4).map((t) => (
              <div className="list-row" key={t.id}>
                <div className="grow">
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.description || t.type}</div>
                  <div className="xs muted">{formatDateTime(txTime(t))}</div>
                </div>
                <span className={`num ${Number(t.amount) >= 0 ? 'up' : 'dn'}`}>{signed(t.amount, t.currency, { decimals: 0 })}</span>
              </div>
            ))}
            {!tx.loading && !(tx.data || []).length && <p className="small muted">Nothing yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  )
}
