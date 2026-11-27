// Search, notifications, the full watchlist with alerts, news and calendar,
// and the fund page.

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, formatDate, formatDateTime, formatMoney, formatPrice, signedPct, tone } from '../api.js'
import { useLoad } from '../session.jsx'
import { useUi } from '../components/shell.jsx'
import { Bars, Donut, LineChart, Spark } from '../components/charts.jsx'
import { Card, Empty, ErrorNote, Field, KV, Loading, PageHead, Pill, Ranges, Row, SampleChip, SampleNote, Tabs, useDebounced } from '../components/ui.jsx'

const linkFor = (a) => (['bond', 'bill', 'note'].includes(a.class) ? `/bonds/${a.symbol}` : `/markets/${a.symbol}`)

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const dq = useDebounced(q)
  const res = useLoad(() => api.extras.search(dq), [dq])
  const d = res.data
  const none = d && !d.assets.length && !d.bonds.length && !d.help.length

  return (
    <div className="stack">
      <PageHead title="Search" sub="Companies, bonds, offers and help." />
      <input type="search" autoFocus placeholder="Try MTN, Apple or FGN" value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})} aria-label="Search" />
      {!dq ? <Empty title="Start typing">Search by name or symbol.</Empty> : res.loading && !d ? <Loading rows={3} /> : none ? <Empty title={`Nothing for "${dq}"`}>Check the spelling, or try the company's short name.</Empty> : (
        <div className="split">
          <div className="stack">
            {d.assets.length > 0 && <Card title="Companies and funds">{d.assets.map((a) => <Row key={a.symbol} to={linkFor(a)} icon="chart" title={`${a.name}`} sub={`${a.symbol} · ${a.country || ''}`} />)}</Card>}
            {d.bonds.length > 0 && <Card title="Bonds">{d.bonds.map((a) => <Row key={a.symbol} to={linkFor(a)} icon="bond" title={a.name} sub={a.symbol} />)}</Card>}
          </div>
          <div className="stack">{d.help.length > 0 && <Card title="Help">{d.help.map((h) => <Row key={h.id} to="/help" icon="help" title={h.title} />)}</Card>}</div>
        </div>
      )}
    </div>
  )
}

export function Notifications() {
  const list = useLoad(() => api.extras.notifications())
  const { reloadNotes } = useUi() || {}
  const [tab, setTab] = useState('all')
  const items = (list.data || []).filter((n) => tab === 'all' || !n.read)

  async function readAll() { await api.extras.readNotifications(); list.reload(); reloadNotes?.() }

  return (
    <div className="stack">
      <PageHead title={<>Notifications <SampleChip /></>} sub="Order updates, money and offers.">
        <button className="btn btn-outline" onClick={readAll}>Mark all as read</button>
      </PageHead>
      <Tabs value={tab} onChange={setTab} label="Show" options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread${list.meta?.unread ? ` (${list.meta.unread})` : ''}` }]} />
      <Card>
        {list.loading ? <Loading rows={4} /> : items.length === 0 ? <Empty title="You are up to date">Nothing new.</Empty> : items.map((n) => (
          <Row key={n.id} to={n.to} icon={n.icon || 'bell'} title={<span style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</span>} sub={`${n.body || ''} ${formatDateTime(n.at)}`} right={!n.read && <Pill kind="info">New</Pill>} />
        ))}
      </Card>
    </div>
  )
}

export function Watchlist() {
  const { reloadWatch } = useUi() || {}
  const list = useLoad(() => api.extras.watchlist())
  const alerts = useLoad(() => api.extras.alerts())
  const [sym, setSym] = useState('')
  const [alert, setAlert] = useState({ symbol: '', direction: 'above', price: '' })
  const [err, setErr] = useState(null)
  const rows = list.data || []

  async function add() { setErr(null); try { await api.extras.addWatch(sym); setSym(''); list.reload(); reloadWatch?.() } catch (e) { setErr(e) } }
  async function drop(s) { await api.extras.removeWatch(s); list.reload(); reloadWatch?.() }
  async function makeAlert() { setErr(null); try { await api.extras.addAlert(alert); setAlert({ ...alert, price: '' }); alerts.reload() } catch (e) { setErr(e) } }

  return (
    <div className="stack">
      <PageHead title="Watchlist" sub="Companies you follow, and prices you want to hear about." />
      <div className="split">
        <Card title="Following" flush>
          {list.loading ? <div className="card-body"><Loading rows={4} /></div> : rows.length === 0 ? <div className="card-body"><Empty title="Nothing yet">Add a symbol below.</Empty></div> : (
            <table>
              <thead><tr><th>Company</th><th></th><th className="r">Price</th><th className="r">Today</th><th></th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.symbol}>
                  <td><Link to={`/markets/${r.symbol}`}><strong>{r.symbol}</strong></Link><div className="xs muted">{r.name}</div></td>
                  <td><Spark values={r.spark} /></td>
                  <td className="r num">{formatMoney(r.price, r.currency)}</td>
                  <td className={`r num ${tone(r.change_pct)}`}>{signedPct(r.change_pct)}</td>
                  <td className="r"><button className="btn btn-quiet btn-sm" onClick={() => drop(r.symbol)}>Remove</button></td>
                </tr>))}</tbody>
            </table>
          )}
          <div className="card-body" style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Symbol, e.g. DANGCEM" value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} aria-label="Symbol to follow" />
            <button className="btn btn-primary" disabled={!sym} onClick={add}>Follow</button>
          </div>
        </Card>
        <div className="stack">
          <Card title={<>Price alerts <SampleChip /></>}>
            {(alerts.data || []).map((a) => (
              <div className="list-row" key={a.id}><div className="grow"><strong>{a.symbol}</strong> <span className="muted">{a.direction} {formatPrice(a.price)}</span></div><button className="btn btn-quiet btn-sm" onClick={async () => { await api.extras.removeAlert(a.id); alerts.reload() }}>Remove</button></div>
            ))}
            <div className="grid g2 mt-sm">
              <Field label="Symbol"><input type="text" value={alert.symbol} onChange={(e) => setAlert({ ...alert, symbol: e.target.value.toUpperCase() })} /></Field>
              <Field label="When price is"><select value={alert.direction} onChange={(e) => setAlert({ ...alert, direction: e.target.value })}><option value="above">At or above</option><option value="below">At or below</option></select></Field>
            </div>
            <Field label="Price"><input type="number" min="0" value={alert.price} onChange={(e) => setAlert({ ...alert, price: e.target.value })} /></Field>
            <button className="btn btn-outline btn-block" disabled={!alert.symbol || !alert.price} onClick={makeAlert}>Add alert</button>
            <SampleNote>Alerts are saved but nothing sends them yet.</SampleNote>
          </Card>
          <ErrorNote error={err} />
        </div>
      </div>
    </div>
  )
}

export function News() {
  const news = useLoad(() => api.extras.news())
  const cal = useLoad(() => api.extras.calendar())
  const [kind, setKind] = useState('All')
  const kinds = ['All', ...new Set((cal.data || []).map((c) => c.kind))]
  const events = (cal.data || []).filter((c) => kind === 'All' || c.kind === kind)

  return (
    <div className="stack">
      <PageHead title={<>News and calendar <SampleChip /></>} sub="What is happening to the companies you follow." />
      <div className="split">
        <Card title="News">
          {news.loading ? <Loading rows={4} /> : (news.data || []).map((n) => (
            <Row key={n.id} to={n.symbol ? `/markets/${n.symbol}` : undefined} icon="news" title={n.title} sub={`${n.tag} · ${formatDateTime(n.at)}`} right={n.symbol && <Pill kind="quiet">{n.symbol}</Pill>} />
          ))}
          <SampleNote>Headlines are invented. A real feed needs a news source.</SampleNote>
        </Card>
        <Card title="Coming up">
          <Tabs value={kind} onChange={setKind} label="Kind" options={kinds.map((k) => ({ value: k, label: k }))} />
          {events.map((e) => <Row key={e.id} icon="calendar" title={e.title} sub={`${formatDate(e.date)}${e.note ? ` · ${e.note}` : ''}`} right={<Pill kind="quiet">{e.kind}</Pill>} />)}
        </Card>
      </div>
    </div>
  )
}

export function Fund() {
  const { symbol } = useParams()
  const nav = useNavigate()
  const funds = useLoad(() => api.extras.funds())
  const [range, setRange] = useState('1Y')
  const f = (funds.data || []).find((x) => x.symbol === symbol) || (funds.data || [])[0]

  if (funds.loading) return <Loading rows={5} />
  if (!f) return <Empty title="Fund not found" action={<button className="btn btn-outline" onClick={() => nav('/markets')}>Back to markets</button>} />

  return (
    <div className="stack">
      <PageHead title={<>{f.name} <SampleChip /></>} sub={`${f.category} · ${f.country}`} back={{ to: '/markets', label: 'Markets' }}>
        <button className="btn btn-primary" disabled title="Funds are not tradable yet">Invest</button>
      </PageHead>
      <div className="split">
        <div className="stack">
          <Card title="Price over time" action={<Ranges value={range} onChange={setRange} options={['1M', '3M', '1Y']} />}>
            <div className="big num">{formatMoney(f.nav, f.currency)}</div>
            <div className={`small ${tone(f.nav_change)}`}>{signedPct(f.nav_change_pct)} on {formatDate(f.as_of)}</div>
            <LineChart points={f.history.map((v, i) => ({ t: i, v }))} />
          </Card>
          <Card title="Returns" flush>
            <table><thead><tr><th>Period</th><th className="r">Fund</th><th className="r">Index</th></tr></thead>
              <tbody>{f.returns.map(([p, a, b]) => <tr key={p}><td>{p}</td><td className={`r num ${tone(a)}`}>{signedPct(a)}</td><td className="r num">{signedPct(b)}</td></tr>)}</tbody></table>
          </Card>
        </div>
        <div className="stack">
          <Card title="What it holds"><Donut parts={f.holds.map(([label, value]) => ({ label, value }))} caption="Mix" /></Card>
          <Card title="Key facts">{f.facts.map(([k, v]) => <KV key={k} k={k} v={v} />)}</Card>
          <Card title="Documents">{f.documents.map(([t, p]) => <Row key={t} icon="doc" title={t} sub={`PDF · ${p} pages`} />)}</Card>
          <SampleNote>Mutual funds are not on Bluum's list yet. Prices and holdings here are invented.</SampleNote>
        </div>
      </div>
    </div>
  )
}
