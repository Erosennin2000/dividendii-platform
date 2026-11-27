// Markets: shares and ETFs for Nigeria, the United States and Kenya side by
// side, with indexes and the day's biggest moves beside them.
// Bonds are deliberately elsewhere; their prices mean something different.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, formatMoney, formatPrice, signedPct, tone } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, Empty, ErrorNote, Loading, PageHead, Tabs } from '../components/ui.jsx'
import { Spark } from '../components/charts.jsx'
import { useUi } from '../components/shell.jsx'

const KINDS = [
  { value: 'equity', label: 'Shares' },
  { value: 'etf', label: 'ETFs' },
  { value: 'fund', label: 'Funds' },
]
const PLACES = [
  { value: 'ng', label: 'Nigeria' },
  { value: 'us', label: 'United States' },
  { value: 'ke', label: 'Kenya' },
  { value: 'watch', label: 'My watchlist' },
]
const NAME = { ng: 'Nigeria', us: 'the United States', ke: 'Kenya' }

export default function Markets() {
  const [kind, setKind] = useState('equity')
  const [place, setPlace] = useState('ng')
  const ui = useUi()
  const navigate = useNavigate()

  const assets = useLoad(() => api.market.assets({ class: 'equity,etf', limit: 100 }))
  const symbols = useMemo(() => (assets.data || []).map((a) => a.symbol), [assets.data])
  const rows = useLoad(() => (symbols.length ? api.extras.rows(symbols) : Promise.resolve({ data: [] })), [symbols.join(',')])
  const indexes = useLoad(() => api.extras.indexes())
  const funds = useLoad(() => api.extras.funds())

  const rowOf = (s) => (rows.data || []).find((r) => r.symbol === s)
  const watchSet = new Set(ui.watch.map((w) => w.symbol))
  const list = (assets.data || []).filter((a) => {
    if (kind === 'fund') return false
    if (a.class !== kind) return false
    return place === 'watch' ? watchSet.has(a.symbol) : a.country === place
  })
  const otherPlace = place === 'ng' ? 'us' : 'ng'
  const alsoList = (assets.data || []).filter((a) => a.class === kind && a.country === otherPlace).slice(0, 3)

  const movers = [...(rows.data || [])].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct)).slice(0, 3)

  return (
    <div className="stack">
      <PageHead title="Markets" sub="Nigeria, the United States and Kenya side by side.">
        <Link className="btn btn-outline" to="/watchlist">Watchlist and alerts</Link>
        <Link className="btn btn-outline" to="/news">News</Link>
      </PageHead>

      <div className="split">
        <div className="stack">
          <div className="stack-sm">
            <Tabs options={KINDS} value={kind} onChange={setKind} label="Kind" />
            {kind !== 'fund' && <Tabs options={PLACES} value={place} onChange={setPlace} label="Market" />}
          </div>

          {kind === 'fund' ? (
            <Card flush>
              {funds.loading ? (
                <div className="card-body"><Loading rows={3} /></div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Fund</th><th>Risk</th><th className="num">NAV</th><th className="num">1 year</th><th /></tr>
                  </thead>
                  <tbody>
                    {(funds.data || []).map((f) => (
                      <tr key={f.symbol}>
                        <td><Link to={`/funds/${f.symbol}`}><strong>{f.name}</strong></Link><div className="xs muted">{f.category}</div></td>
                        <td>{f.risk}</td>
                        <td className="num">{formatMoney(f.nav, f.currency)}</td>
                        <td className="num up">{signedPct(f.returns.find((r) => r[0] === '1 year')?.[1], 1)}</td>
                        <td className="num"><Link className="btn btn-outline btn-sm" to={`/funds/${f.symbol}`}>Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ) : (
            <>
              <Card flush>
                {assets.loading ? (
                  <div className="card-body"><Loading rows={5} /></div>
                ) : assets.error ? (
                  <div className="card-body"><ErrorNote error={assets.error} onRetry={assets.reload} /></div>
                ) : !list.length ? (
                  <Empty title={place === 'watch' ? 'Your watchlist has nothing of this kind' : 'Nothing here yet'}>
                    {place === 'watch' ? 'Search in the watchlist box to follow a company.' : 'Try another market.'}
                  </Empty>
                ) : (
                  <AssetTable list={list} rowOf={rowOf} onPick={(s) => ui.select(s)} navigate={navigate} />
                )}
              </Card>

              {place !== 'watch' && alsoList.length > 0 && (
                <Card
                  title={`Also popular in ${NAME[otherPlace]}`}
                  flush
                  action={<button className="linkbtn small" style={{ textDecoration: 'none', fontWeight: 600 }} onClick={() => setPlace(otherPlace)}>Open</button>}
                >
                  <AssetTable list={alsoList} rowOf={rowOf} onPick={(s) => ui.select(s)} navigate={navigate} />
                </Card>
              )}
            </>
          )}
        </div>

        <div className="stack">
          <Card title="Indexes">
            {indexes.loading ? <Loading rows={3} /> : (indexes.data || []).map((i) => (
              <div className="kv" key={i.code}>
                <span className="muted">{i.name}</span>
                <span className={`num ${tone(i.change_pct)}`} style={{ fontWeight: 600 }}>{Number(i.value).toLocaleString('en-NG')}</span>
              </div>
            ))}
            <p className="xs muted mt-sm">Index levels are sample data.</p>
          </Card>
          <Card title="Biggest moves today">
            {rows.loading ? <Loading rows={3} /> : movers.map((m) => (
              <Link to={`/markets/${m.symbol}`} className="kv" key={m.symbol} style={{ color: 'inherit' }}>
                <strong style={{ color: 'var(--ink)' }}>{m.symbol}</strong>
                <span className={`num ${tone(m.change_pct)}`} style={{ fontWeight: 600 }}>{signedPct(m.change_pct)}</span>
              </Link>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

function AssetTable({ list, rowOf, onPick, navigate }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Company</th>
          <th>7 days</th>
          <th className="num">Price</th>
          <th className="num">Today</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {list.map((a) => {
          const r = rowOf(a.symbol)
          return (
            <tr key={a.symbol} className="clickable" onClick={() => navigate(`/markets/${a.symbol}`)}>
              <td>
                <Link to={`/markets/${a.symbol}`} onClick={(e) => e.stopPropagation()}><strong>{a.symbol}</strong></Link>
                <div className="xs muted">{a.name}</div>
              </td>
              <td><Spark values={r?.spark} width={80} height={26} /></td>
              <td className="num">{formatMoney(r?.price ?? a.price, a.currency)}</td>
              <td className={`num ${tone(r?.change_pct)}`} style={{ fontWeight: 600 }}>{r ? signedPct(r.change_pct) : '—'}</td>
              <td className="num">
                <Link className="btn btn-outline btn-sm" to={`/markets/${a.symbol}`} onClick={(e) => { e.stopPropagation(); onPick(a.symbol) }}>Trade</Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
