// Your portfolio: what you own, how it has done and what it pays you, one
// currency at a time.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, formatDate, formatMoney, formatPrice, formatQuantity, formatShort, signed, signedPct, tone } from '../api.js'
import { useLoad } from '../session.jsx'
import { Bars, Donut, LineChart } from '../components/charts.jsx'
import { Card, Empty, ErrorNote, KV, Loading, PageHead, Ranges, SampleChip, Tabs } from '../components/ui.jsx'

const ACCOUNTS = [
  { value: 'NGN', label: '₦ Naira', word: 'Naira' },
  { value: 'USD', label: '$ Dollar', word: 'Dollar' },
  { value: 'KES', label: 'KSh Shilling', word: 'Shilling' },
]
const BOND = ['bond', 'bill', 'note']

export default function Portfolio() {
  const navigate = useNavigate()
  const [currency, setCurrency] = useState('NGN')
  const [tab, setTab] = useState('holdings')
  const [range, setRange] = useState('3M')

  const positions = useLoad(() => api.trade.positions())
  const wallets = useLoad(() => api.money.wallets())
  const history = useLoad(() => api.extras.history(currency, range === 'All' ? 'ALL' : range), [currency, range])
  const income = useLoad(() => api.extras.income(currency), [currency])
  const upcoming = useLoad(() => api.extras.upcoming())
  const held = useMemo(() => (positions.data || []).filter((p) => p.currency === currency), [positions.data, currency])
  const symbols = held.map((p) => p.symbol)
  const rows = useLoad(() => (symbols.length ? api.extras.rows(symbols) : Promise.resolve({ data: [] })), [symbols.join(',')])
  const rowOf = (s) => (rows.data || []).find((r) => r.symbol === s)

  const w = (wallets.data || []).find((x) => x.currency === currency)
  const invested = held.reduce((s, p) => s + Number(p.market_value || 0), 0)
  const cost = held.reduce((s, p) => s + Number(p.total_cost_basis || 0), 0)
  const gain = held.reduce((s, p) => s + Number(p.unrealized_pl || 0), 0)
  const cash = Number(w?.available_balance || 0)
  const reserved = Number(w?.reserved_balance || 0)
  const total = invested + cash + reserved
  const h = history.data
  const shares = held.filter((p) => !BOND.includes(p.class)).reduce((s, p) => s + Number(p.market_value || 0), 0)
  const bonds = held.filter((p) => BOND.includes(p.class)).reduce((s, p) => s + Number(p.market_value || 0), 0)
  const loading = positions.loading || wallets.loading

  const incomeBars = (income.data?.months || []).map((m) => ({ label: m.month, value: m.amount, display: formatShort(m.amount, currency).replace(/^[^\d]+/, '') }))

  return (
    <div className="stack">
      <PageHead title="Your portfolio" sub="What you own, how it has done and what it pays you.">
        <Link className="btn btn-outline" to="/collections">Ready-made portfolios</Link>
        <Link className="btn btn-outline" to="/rebalance">Keep my mix on track</Link>
      </PageHead>

      <Tabs options={ACCOUNTS} value={currency} onChange={setCurrency} label="Currency" />

      <div className="grid g3">
        <div className="tile">
          <div className="lab">{ACCOUNTS.find((a) => a.value === currency).word} portfolio</div>
          <div className="big">{loading ? '—' : formatMoney(total, currency, { decimals: 0 })}</div>
          {h && <div className={`sub ${tone(h.change)}`}>{signed(h.change, currency, { decimals: 0 })} over {range === 'All' ? 'all time' : range.replace('M', ' months').replace('Y', ' year').replace('W', ' week').replace('D', ' day')}</div>}
        </div>
        <div className="tile">
          <div className="lab">Total gain</div>
          <div className={`big ${tone(gain)}`}>{loading ? '—' : signed(gain, currency, { decimals: 0 })}</div>
          <div className={`sub ${tone(gain)}`}>{cost ? `${signedPct((gain / cost) * 100, 1)} on what you put in` : ' '}</div>
        </div>
        <div className="tile">
          <div className="lab">Income this year <SampleChip /></div>
          <div className="big">{income.data ? formatMoney(income.data.total, currency, { decimals: 0 }) : '—'}</div>
          <div className="sub muted">Dividends and coupons</div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        label="View"
        options={[{ value: 'holdings', label: 'Holdings' }, { value: 'performance', label: 'Performance' }, { value: 'income', label: 'Income' }, { value: 'allocation', label: 'Allocation' }]}
      />

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
        <div className="stack">
          {(tab === 'holdings' || tab === 'performance') && (
            <Card>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <h2>{ACCOUNTS.find((a) => a.value === currency).word} portfolio value</h2>
                <Ranges value={range} onChange={setRange} options={['1M', '3M', '1Y', 'All']} />
              </div>
              <div style={{ marginTop: 10 }}>
                {history.loading && !h ? <Loading rows={4} /> : h && total > 0 ? (
                  <LineChart points={h.points} height={220} format={(n) => formatShort(n, currency).replace(/^[^\d-]+/, '')} label="Portfolio value" />
                ) : <Empty title="Nothing to chart yet">Your value appears here once you hold something.</Empty>}
              </div>
            </Card>
          )}

          {tab === 'income' && (
            <Card title={<>Income, last 12 months <SampleChip /></>}>
              {income.loading ? <Loading rows={4} /> : <Bars items={incomeBars} height={210} />}
            </Card>
          )}

          {tab === 'allocation' && (
            <Card title="Allocation">
              <Donut centre={formatShort(total, currency)} parts={[{ label: 'Shares', value: shares }, { label: 'Bonds', value: bonds }, { label: 'Cash', value: cash }, { label: 'Offers on hold', value: reserved }].filter((p) => p.value > 0)} />
            </Card>
          )}

          {(tab === 'holdings' || tab === 'performance' || tab === 'income') && (
            <Card title="Holdings" flush>
              {positions.loading ? (
                <div className="card-body"><Loading rows={4} /></div>
              ) : positions.error ? (
                <div className="card-body"><ErrorNote error={positions.error} onRetry={positions.reload} /></div>
              ) : !held.length ? (
                <Empty title="Nothing in this currency yet" action={<Link className="btn btn-primary" to="/markets">Browse the markets</Link>}>Once you buy something it appears here.</Empty>
              ) : (
                <table>
                  <thead><tr><th>Holding</th><th className="num">Shares</th><th className="num">Price</th><th className="num">Value</th><th className="num">Today</th><th className="num">Total gain</th></tr></thead>
                  <tbody>
                    {held.map((p) => {
                      const r = rowOf(p.symbol)
                      const isBond = BOND.includes(p.class)
                      const pct = Number(p.total_cost_basis) ? (Number(p.unrealized_pl) / Number(p.total_cost_basis)) * 100 : 0
                      return (
                        <tr key={p.id} className="clickable" onClick={() => navigate(isBond ? `/bonds/${p.symbol}` : `/portfolio/${p.symbol}`)}>
                          <td><strong>{p.symbol}</strong><div className="xs muted">{r?.name || (isBond ? 'Bond' : '')}</div></td>
                          <td className="num">{formatQuantity(p.quantity)}</td>
                          <td className="num">{p.current_price ? formatPrice(p.current_price) : '—'}</td>
                          <td className="num"><strong>{formatMoney(p.market_value, p.currency, { decimals: 0 })}</strong></td>
                          <td className={`num ${tone(r?.change_pct)}`}>{r ? signedPct(r.change_pct) : '—'}</td>
                          <td className={`num ${tone(p.unrealized_pl)}`}>{signed(p.unrealized_pl, p.currency, { decimals: 0 })}<div className="xs">{signedPct(pct, 1)}</div></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>

        <div className="stack">
          {tab !== 'allocation' && (
            <Card title="By type">
              {loading ? <Loading rows={3} /> : total > 0 ? (
                <Donut size={150} centre={formatShort(total, currency)} parts={[{ label: 'Shares', value: shares }, { label: 'Bonds', value: bonds }, { label: 'Cash', value: cash }, { label: 'Offers on hold', value: reserved }].filter((p) => p.value > 0)} />
              ) : <p className="small muted">Nothing yet.</p>}
            </Card>
          )}
          <Card title={<>Paying you soon <SampleChip /></>}>
            {(upcoming.data || []).filter((u) => u.currency === currency).map((u) => (
              <div className="list-row" key={u.title}>
                <div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{u.title}</div><div className="xs muted">{formatDate(u.date)}</div></div>
                <strong>{formatMoney(u.amount, u.currency, { decimals: 0 })}</strong>
              </div>
            ))}
            {!(upcoming.data || []).some((u) => u.currency === currency) && <p className="small muted">Nothing due soon.</p>}
          </Card>
          <Card title="Plan ahead">
            <Link className="list-row" to="/goals" style={{ color: 'inherit' }}><div className="grow">Goals</div></Link>
            <Link className="list-row" to="/auto-invest" style={{ color: 'inherit' }}><div className="grow">Auto-invest</div></Link>
            <Link className="list-row" to="/rebalance" style={{ color: 'inherit' }}><div className="grow">Keep my mix on track</div></Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
