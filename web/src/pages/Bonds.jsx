// The bond shelf. Kept apart from shares because a bond price is a
// percentage of face value, not an amount of money, and mixing the two in one
// list is how people buy the wrong thing.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, formatDate, formatMoney, formatPercent, formatQuantity } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, Empty, ErrorNote, Loading, Notice, PageHead, Pill, Tabs } from '../components/ui.jsx'

const PLACES = [
  { value: 'ng', label: 'Nigeria' },
  { value: 'us', label: 'United States' },
  { value: 'ke', label: 'Kenya' },
]

export default function Bonds() {
  const [place, setPlace] = useState('ng')
  const navigate = useNavigate()
  const bonds = useLoad(() => api.bonds.list())
  const holdings = useLoad(() => api.bonds.holdings())
  const list = (bonds.data || []).filter((b) => b.country === place)

  return (
    <div className="stack">
      <PageHead title="Bonds" sub="Earn interest twice a year. You get your face value back at maturity.">
        <Link className="btn btn-outline" to="/maturities">Maturities and rollover</Link>
      </PageHead>

      <Notice kind="info" title="Bonds work differently from shares">
        You buy a <strong>face value</strong>, not a number of units, and the price is a <strong>percentage of that face value</strong>.
        A price of 99.5 means you pay about 99.5% of face value, plus the interest built up since the last payment. Every bond order has a price you set yourself.
      </Notice>

      <Tabs options={PLACES} value={place} onChange={setPlace} label="Market" />

      <Card flush>
        {bonds.loading ? (
          <div className="card-body"><Loading rows={5} /></div>
        ) : bonds.error ? (
          <div className="card-body">
            <ErrorNote error={bonds.error} onRetry={bonds.reload} />
            <p className="small muted" style={{ marginTop: 10 }}>Bond trading is switched on per account at Bluum. If this keeps failing, it may not be enabled yet.</p>
          </div>
        ) : !list.length ? (
          <Empty title="No bonds here yet">Bond trading has to be switched on by Bluum for this market before anything appears.</Empty>
        ) : (
          <table>
            <thead>
              <tr><th>Bond</th><th className="num">Coupon</th><th className="num">Yield</th><th className="num">Price (% of par)</th><th>Matures</th><th /></tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.symbol} className="clickable" onClick={() => navigate(`/bonds/${b.symbol}`)}>
                  <td>
                    <Link to={`/bonds/${b.symbol}`} onClick={(e) => e.stopPropagation()}><strong>{b.symbol}</strong></Link>
                    <div className="xs muted">{b.name}</div>
                  </td>
                  <td className="num">{b.bond?.coupon_rate ? formatPercent(b.bond.coupon_rate) : '—'}</td>
                  <td className="num">{b.bond?.yield_to_maturity ? formatPercent(b.bond.yield_to_maturity) : '—'}</td>
                  <td className="num">{b.price}</td>
                  <td>{formatDate(b.bond?.maturity_date)}<div className="xs muted">Settles {b.bond?.settlement_convention || '—'}</div></td>
                  <td className="num"><Link className="btn btn-outline btn-sm" to={`/bonds/${b.symbol}`} onClick={(e) => e.stopPropagation()}>Trade</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(holdings.data || []).length > 0 && (
        <Card title="Your bonds" flush>
          <table>
            <thead><tr><th>Bond</th><th className="num">Face value</th><th className="num">Value</th></tr></thead>
            <tbody>
              {holdings.data.map((h) => (
                <tr key={h.id}>
                  <td><Link to={`/bonds/${h.symbol}`}><strong>{h.symbol}</strong></Link></td>
                  <td className="num">{formatQuantity(h.quantity)}</td>
                  <td className="num">{h.market_value ? formatMoney(h.market_value, h.currency) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="wrap">
        <Pill kind="quiet">Interest is paid into your wallet automatically</Pill>
        <Pill kind="quiet">Face value is returned at maturity</Pill>
      </div>
    </div>
  )
}
