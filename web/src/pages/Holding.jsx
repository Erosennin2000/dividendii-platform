// One holding in detail: what it is worth, what you paid, what it paid you.

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatDate, formatMoney, formatPrice, formatQuantity, signed, signedPct, tone } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, Empty, ErrorNote, KV, Loading, PageHead, SampleChip, SampleNote, Segmented } from '../components/ui.jsx'

export default function Holding() {
  const { symbol } = useParams()
  const positions = useLoad(() => api.trade.positions(), [symbol])
  const detail = useLoad(() => api.extras.holdingHistory(symbol), [symbol])
  const rows = useLoad(() => api.extras.rows([symbol]), [symbol])
  const [setting, setSetting] = useState(null)
  const [saved, setSaved] = useState(false)

  if (positions.loading && !positions.data) return <Loading rows={5} />
  if (positions.error) return <ErrorNote error={positions.error} onRetry={positions.reload} />
  const p = (positions.data || []).find((x) => x.symbol === symbol)
  if (!p) return <Empty title={`You do not own ${symbol}`}><Link to={`/markets/${symbol}`}>See its page</Link></Empty>

  const row = rows.data?.[0]
  const d = detail.data
  const pct = Number(p.total_cost_basis) ? (Number(p.unrealized_pl) / Number(p.total_cost_basis)) * 100 : 0
  const mode = setting || d?.setting || 'cash'

  async function save() {
    await api.extras.setDividend(symbol, mode)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="stack">
      <PageHead title={`Your ${symbol}`} sub={`${row?.name || ''}${d ? ` · bought over ${d.purchases.length} trades` : ''}`} back={{ to: '/portfolio', label: 'Portfolio' }}>
        <Link className="btn btn-danger" to={`/order/${symbol}?side=sell`}>Sell</Link>
        <Link className="btn btn-primary" to={`/order/${symbol}?side=buy`}>Buy more</Link>
      </PageHead>

      <div className="grid g3">
        <div className="tile"><div className="lab">Value</div><div className="big">{formatMoney(p.market_value, p.currency, { decimals: 0 })}</div><div className={`sub ${tone(row?.change_pct)}`}>{row ? `${signedPct(row.change_pct)} today` : ' '}</div></div>
        <div className="tile"><div className="lab">Total gain</div><div className={`big ${tone(p.unrealized_pl)}`}>{signed(p.unrealized_pl, p.currency, { decimals: 0 })}</div><div className={`sub ${tone(pct)}`}>{signedPct(pct, 1)}</div></div>
        <div className="tile"><div className="lab">Average cost</div><div className="big">{formatMoney(p.average_cost_basis, p.currency)}</div><div className="sub muted">{formatQuantity(p.quantity)} shares</div></div>
      </div>

      <div className="split">
        <div className="stack">
          <Card title={<>Your purchases <SampleChip /></>} flush>
            {detail.loading ? <div className="card-body"><Loading rows={3} /></div> : (
              <table>
                <thead><tr><th>Date</th><th className="num">Shares</th><th className="num">Cost per share</th><th className="num">Gain</th></tr></thead>
                <tbody>
                  {(d?.purchases || []).map((b) => (
                    <tr key={b.date}><td>{formatDate(b.date)}</td><td className="num">{formatQuantity(b.quantity)}</td><td className="num">{formatMoney(b.price, p.currency)}</td><td className={`num ${tone(Number(p.current_price) - b.price)}`}>{signed((Number(p.current_price) - b.price) * b.quantity, p.currency, { decimals: 0 })}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title={<>Activity on this holding <SampleChip /></>}>
            {(d?.activity || []).map((a) => (
              <div className="list-row" key={a.what + a.date}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.what}</div><div className="xs muted">{formatDate(a.date)}</div></div><strong>{formatMoney(a.amount, p.currency, { decimals: 0 })}</strong></div>
            ))}
          </Card>
        </div>
        <div className="stack">
          <Card title="Dividend settings">
            <p className="small muted" style={{ marginBottom: 10 }}>When {symbol} pays you. Reinvesting buys more {symbol} on the day the dividend arrives.</p>
            <Segmented value={mode} onChange={setSetting} label="Dividend" options={[{ value: 'cash', label: 'Pay me cash' }, { value: 'reinvest', label: 'Reinvest' }]} />
            <div className="wrap mt"><button className="btn btn-primary btn-sm" onClick={save}>Save</button>{saved && <span className="small up" style={{ alignSelf: 'center' }}>Saved</span>}</div>
            <SampleNote>Your choice is saved here. Acting on it when a dividend arrives is not connected yet.</SampleNote>
          </Card>
          <Card title={<>Dividends <SampleChip /></>}>
            <KV k="Yield" v={d ? `${d.dividends.yield_pct}%` : '—'} />
            <KV k="Paid this year" v={d ? formatMoney(d.dividends.paid_this_year, p.currency, { decimals: 0 }) : '—'} />
            <KV k="Next payment" v={d ? formatDate(d.dividends.next_payment) : '—'} />
          </Card>
        </div>
      </div>
    </div>
  )
}
