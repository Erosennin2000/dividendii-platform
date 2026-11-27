// The record of one trade, in the form a customer keeps.

import { Link, useParams } from 'react-router-dom'
import { api, formatDate, formatMoney, formatQuantity } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, ErrorNote, KV, Loading, PageHead, SampleNote } from '../components/ui.jsx'

export default function ContractNote() {
  const { id } = useParams()
  const note = useLoad(() => api.extras.contractNote(id), [id])
  const n = note.data
  if (note.loading) return <Loading rows={5} />
  if (note.error) return <ErrorNote error={note.error} onRetry={note.reload} />

  const qty = n.fills.reduce((s, f) => s + f.quantity, 0)
  const amt = n.fills.reduce((s, f) => s + f.quantity * f.price, 0)

  return (
    <div className="stack">
      <PageHead title={`Contract note ${n.id}`} sub={`${n.side} ${n.symbol} · trade date ${formatDate(n.trade_date)} · settles ${formatDate(n.settles)}`} back={{ to: '/orders', label: 'Orders' }}>
        <button className="btn btn-outline" onClick={() => window.print()}>Download PDF</button>
      </PageHead>
      <div className="split">
        <div className="stack">
          <Card>
            <p className="small muted" style={{ marginBottom: 8 }}>Dividendii Investments Ltd</p>
            <div className="grid g2" style={{ columnGap: 32 }}>
              <div><KV k="Client" v={n.client} /><KV k="Account" v={n.account} /></div>
              <div><KV k="Order" v={n.order} /><KV k="Exchange" v={n.exchange} /></div>
            </div>
          </Card>
          <Card title="What was bought" flush>
            <table>
              <thead><tr><th>Fill</th><th className="num">Shares</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {n.fills.map((f) => (
                  <tr key={f.n}><td>Fill {f.n}</td><td className="num">{formatQuantity(f.quantity)}</td><td className="num">{f.price.toFixed(2)}</td><td className="num">{formatMoney(f.quantity * f.price, n.currency)}</td></tr>
                ))}
                <tr><td><strong>Total</strong></td><td className="num"><strong>{formatQuantity(qty)}</strong></td><td className="num"><strong>{(amt / qty).toFixed(2)}</strong></td><td className="num"><strong>{formatMoney(amt, n.currency)}</strong></td></tr>
              </tbody>
            </table>
            <div className="card-body"><p className="xs muted">Prices and exchange charges follow the exchange rules on the trade date. This note is your record of the trade.</p></div>
          </Card>
          <SampleNote>The fills on this note are sample data. A live note is built from the real fills Bluum reports for the order.</SampleNote>
        </div>
        <div className="stack">
          <Card title="Costs">
            <KV k="Amount" v={formatMoney(n.costs.amount, n.currency)} />
            <KV k="Fee (Dividendii)" v={formatMoney(n.costs.fee, n.currency)} />
            <div className="kv total"><span>Total from your wallet</span><span className="num">{formatMoney(n.costs.total, n.currency)}</span></div>
          </Card>
          <Card title="Related">
            <Link className="list-row" to={`/orders/${n.order}`} style={{ color: 'inherit' }}><div className="grow">Order {n.order}</div></Link>
            <Link className="list-row" to="/account/statements" style={{ color: 'inherit' }}><div className="grow">Statements</div></Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
