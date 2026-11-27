// Maturities and rollover: tell us what to do with the money before a bond
// matures. The choice is stored here; the money itself moves at Bluum.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDate, formatMoney } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, Empty, ErrorNote, KV, Loading, PageHead, Pill, SampleNote, Segmented } from '../components/ui.jsx'

export default function Maturities() {
  const list = useLoad(() => api.extras.maturities())
  const [pick, setPick] = useState(null)
  const [saved, setSaved] = useState(false)
  const items = list.data || []
  const sel = items.find((i) => i.symbol === pick) || items[0]
  const [plan, setPlan] = useState(null)
  const choice = plan || sel?.plan || 'wallet'

  async function save() {
    await api.extras.setMaturity(sel.symbol, choice)
    setSaved(true)
    list.reload()
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="stack">
      <PageHead title="Maturities and rollover" sub="Tell us what to do with the money before a bond matures." back={{ to: '/bonds', label: 'Bonds' }} />
      <div className="split">
        <div className="stack">
          <Card title="Coming up" flush>
            {list.loading ? (
              <div className="card-body"><Loading rows={3} /></div>
            ) : list.error ? (
              <div className="card-body"><ErrorNote error={list.error} onRetry={list.reload} /></div>
            ) : !items.length ? (
              <Empty title="No bonds are maturing" action={<Link className="btn btn-primary" to="/bonds">Browse bonds</Link>}>You do not hold a bond yet.</Empty>
            ) : (
              <table>
                <thead><tr><th>Bond</th><th className="num">Face value</th><th>Matures</th><th className="num">You get</th><th>Plan</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.symbol} className="clickable" onClick={() => { setPick(i.symbol); setPlan(null) }} style={i.symbol === sel?.symbol ? { background: 'var(--dividendii-info-bg)' } : undefined}>
                      <td><strong>{i.symbol}</strong><div className="xs muted">{i.name}</div></td>
                      <td className="num">{formatMoney(i.face_value, i.currency, { decimals: 0 })}</td>
                      <td>{formatDate(i.matures)}</td>
                      <td className="num">{formatMoney(i.you_get, i.currency, { decimals: 0 })}</td>
                      <td><Pill kind={i.plan ? 'good' : 'warn'}>{i.plan === 'reinvest' ? 'Reinvest' : i.plan === 'wallet' ? 'To cash' : 'Waiting'}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {sel && (
            <Card title={`What should happen on ${formatDate(sel.matures)}?`}>
              <Segmented value={choice} onChange={setPlan} label="Plan" options={[{ value: 'reinvest', label: 'Reinvest' }, { value: 'wallet', label: 'Move to cash' }]} />
              <p className="small muted mt">Reinvesting buys a new bond at the price on the day. We email you before anything happens.</p>
              <div className="wrap mt">
                <button className="btn btn-primary" onClick={save}>Save plan</button>
                {saved && <span className="small up" style={{ alignSelf: 'center' }}>Saved</span>}
              </div>
              <SampleNote>Your choice is saved here. Acting on it when the bond matures needs a decision with Bluum; see the list of open items.</SampleNote>
            </Card>
          )}
        </div>
        {sel && (
          <Card title={sel.symbol}>
            <KV k="Coupon" v={sel.coupon ? `${Number(sel.coupon).toFixed(2)}%` : '—'} />
            <KV k="Face value" v={formatMoney(sel.face_value, sel.currency, { decimals: 0 })} />
            <KV k="Maturity value" v={formatMoney(sel.you_get, sel.currency, { decimals: 0 })} />
            <p className="xs muted mt-sm">If you do nothing, the money goes to your wallet on the maturity date.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
