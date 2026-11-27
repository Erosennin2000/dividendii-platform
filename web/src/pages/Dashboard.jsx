// Home: one tile per currency, a value chart, what you own, where it sits and
// what needs you.
//
// Totals are never added across currencies. Naira, dollars and shillings are
// three separate accounts, because a single total would be a made-up
// exchange rate.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatMoney, formatPrice, formatQuantity, formatShort, signed, signedPct, tone } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Card, Empty, ErrorNote, Loading, Notice, PageHead, Ranges, StatusPill } from '../components/ui.jsx'
import { Donut, Icon, LineChart } from '../components/charts.jsx'

const ACCOUNTS = [
  { currency: 'NGN', label: 'Naira account', word: 'Naira' },
  { currency: 'USD', label: 'Dollar account', word: 'Dollar' },
  { currency: 'KES', label: 'Shilling account', word: 'Shilling' },
]
const BOND = ['bond', 'bill', 'note']

export default function Dashboard() {
  const { user, stage, canTrade, isSampleData } = useSession()
  const [currency, setCurrency] = useState('NGN')
  const [range, setRange] = useState('3M')

  const wallets = useLoad(() => api.money.wallets())
  const positions = useLoad(() => api.trade.positions())
  const attention = useLoad(() => api.extras.attention())
  const day = useLoad(() => Promise.all(ACCOUNTS.map((a) => api.extras.history(a.currency, '1D'))), [])
  const history = useLoad(() => api.extras.history(currency, range === 'All' ? 'ALL' : range), [currency, range])

  const symbols = useMemo(() => (positions.data || []).map((p) => p.symbol), [positions.data])
  const rows = useLoad(() => (symbols.length ? api.extras.rows(symbols) : Promise.resolve({ data: [] })), [symbols.join(',')])
  const rowOf = (s) => (rows.data || []).find((r) => r.symbol === s)

  const byCurrency = useMemo(() => {
    const out = {}
    for (const a of ACCOUNTS) {
      const w = (wallets.data || []).find((x) => x.currency === a.currency)
      const held = (positions.data || []).filter((p) => p.currency === a.currency)
      const invested = held.reduce((s, p) => s + Number(p.market_value || 0), 0)
      const cash = Number(w?.available_balance || 0)
      const reserved = Number(w?.reserved_balance || 0)
      out[a.currency] = { held, invested, cash, reserved, total: invested + cash + reserved }
    }
    return out
  }, [wallets.data, positions.data])

  const sel = byCurrency[currency]
  const acct = ACCOUNTS.find((a) => a.currency === currency)
  const loading = wallets.loading || positions.loading
  const first = user?.name ? user.name.split(' ')[0] : null
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // Donut parts: the four biggest holdings, then cash and offers on hold.
  const parts = useMemo(() => {
    const held = [...sel.held].sort((a, b) => Number(b.market_value) - Number(a.market_value))
    const top = held.slice(0, 4).map((p) => ({ label: p.symbol, value: Number(p.market_value || 0) }))
    const rest = held.slice(4).reduce((s, p) => s + Number(p.market_value || 0), 0)
    return [
      ...top,
      ...(rest > 0 ? [{ label: 'Other', value: rest }] : []),
      { label: 'Cash', value: sel.cash },
      ...(sel.reserved > 0 ? [{ label: 'Offers on hold', value: sel.reserved }] : []),
    ].filter((p) => p.value > 0)
  }, [sel])

  // Reset the range label so the chart title and the change text agree.
  useEffect(() => {
    if (!['1D', '1W', '1M', '3M', '1Y', 'All'].includes(range)) setRange('3M')
  }, [range])

  const h = history.data
  const rangeWords = { '1D': 'today', '1W': 'over a week', '1M': 'over a month', '3M': 'over 3 months', '1Y': 'over a year', All: 'since you started' }

  return (
    <div className="stack">
      <PageHead title={`${greet}${first ? `, ${first}` : ''}`} sub="Each currency stands alone. We never add naira, dollars and shillings together.">
        <Link className="btn btn-outline" to="/money/move">Add money</Link>
        <Link className="btn btn-primary" to="/markets">Buy something</Link>
      </PageHead>

      {!canTrade && (
        <Notice kind="warn" title="Your account is not ready for trading yet">
          <div className="row" style={{ marginTop: 6 }}>
            <span>
              Status: <StatusPill status={stage} />
            </span>
            <Link to={stage === 'not_started' ? '/open-account' : '/open-account/status'} className="small">
              {stage === 'not_started' ? 'Open your account' : 'See where it stands'}
            </Link>
          </div>
        </Notice>
      )}

      {/* Three accounts */}
      <div className="grid g3">
        {ACCOUNTS.map((a, i) => {
          const t = byCurrency[a.currency]
          const d = day.data?.[i]?.data
          const on = a.currency === currency
          return (
            <button
              key={a.currency}
              className={`tile ${on ? 'sel' : ''}`}
              style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
              onClick={() => setCurrency(a.currency)}
              aria-pressed={on}
            >
              <div className="lab">{a.label}</div>
              <div className="big">{loading ? '—' : formatMoney(t.total, a.currency, { decimals: 0 })}</div>
              <div className={`sub ${tone(d?.change_pct)}`}>
                {d ? `${signedPct(d.change_pct)} today · ${signed(d.change, a.currency, { decimals: 0 })}` : ' '}
              </div>
            </button>
          )
        })}
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
        <div className="stack">
          <Card>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <h2>{acct.word} account value</h2>
              <Ranges value={range} onChange={setRange} />
            </div>
            <div className="bignum" style={{ marginTop: 12 }}>{loading ? '—' : formatMoney(sel.total, currency, { decimals: 0 })}</div>
            {h && (
              <div className={`small ${tone(h.change)}`} style={{ marginBottom: 6 }}>
                {signed(h.change, currency, { decimals: 0 })} ({signedPct(h.change_pct, 1)}) {rangeWords[range]}
              </div>
            )}
            {history.loading && !h ? <Loading rows={4} /> : h && sel.total > 0 ? (
              <LineChart
                points={h.points}
                height={210}
                format={(n) => formatShort(n, currency).replace(/^[^\d-]+/, '')}
                label={`${acct.word} account value`}
              />
            ) : (
              <Empty title="Nothing to chart yet">Add money or buy something and your value appears here.</Empty>
            )}
          </Card>

          <Card
            title={`What you own · ${acct.word}`}
            flush
            action={<Link to="/portfolio" className="small" style={{ fontWeight: 600 }}>See all holdings</Link>}
          >
            {positions.loading ? (
              <div className="card-body"><Loading rows={3} /></div>
            ) : positions.error ? (
              <div className="card-body"><ErrorNote error={positions.error} onRetry={positions.reload} /></div>
            ) : !sel.held.length ? (
              <Empty title="Nothing yet" action={<Link className="btn btn-primary" to="/markets">Browse the markets</Link>}>
                Once you buy something it appears here.
              </Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Holding</th>
                    <th className="num">{sel.held.some((p) => BOND.includes(p.class)) ? 'Units' : 'Shares'}</th>
                    <th className="num">Price</th>
                    <th className="num">Value</th>
                    <th className="num">Today</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.held.slice(0, 6).map((p) => {
                    const r = rowOf(p.symbol)
                    const isBond = BOND.includes(p.class)
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link to={isBond ? `/bonds/${p.symbol}` : `/portfolio/${p.symbol}`}>
                            <strong>{p.symbol}</strong>
                          </Link>
                          <div className="xs muted">
                            {r?.name || (isBond ? 'Bond' : 'Shares')}
                            {Number(p.settled_quantity) < Number(p.quantity) && ' · some not yet settled'}
                          </div>
                        </td>
                        <td className="num">{formatQuantity(p.quantity)}</td>
                        <td className="num">{p.current_price ? formatPrice(p.current_price) : '—'}</td>
                        <td className="num"><strong>{p.market_value ? formatMoney(p.market_value, p.currency, { decimals: 0 }) : '—'}</strong></td>
                        <td className={`num ${tone(r?.change_pct)}`}>{r ? signedPct(r.change_pct) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Where it sits">
            {loading ? <Loading rows={4} /> : parts.length ? (
              <Donut parts={parts} centre={formatShort(sel.total, currency)} />
            ) : (
              <p className="small muted">Nothing to show yet.</p>
            )}
          </Card>

          <Card title="Needs your attention">
            {attention.loading ? <Loading rows={3} /> : (
              <div>
                {(attention.data || []).map((a) => (
                  <Link key={a.text} to={a.to} className="list-row" style={{ color: 'inherit' }}>
                    <span className="ico"><Icon name={a.icon} size={17} /></span>
                    <div className="grow" style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.text}</div>
                  </Link>
                ))}
                {!(attention.data || []).length && <p className="small muted">Nothing needs you right now.</p>}
              </div>
            )}
          </Card>
        </div>
      </div>

      {isSampleData && (
        <p className="xs muted">Sandbox: Bluum is not connected, so every price, holding and offer is invented. Add money on the Money page and it arrives at once.</p>
      )}
    </div>
  )
}
