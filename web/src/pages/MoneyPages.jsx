// The Money screens: three wallets, move money, linked accounts, and the
// transaction list with a receipt beside it.

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, formatDateTime, formatMoney, signed, txTime } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { AddMoney, BankAccounts, Withdraw } from './Money.jsx'
import { Card, Empty, ErrorNote, Field, KV, Loading, Notice, PageHead, Pill, SampleNote, Segmented, StatusPill, Tabs } from '../components/ui.jsx'

const NAMES = { NGN: 'Naira wallet', USD: 'US dollar wallet', KES: 'Kenyan shilling wallet' }
const ORDER = ['NGN', 'USD', 'KES']

const kindOf = (t) => {
  const type = String(t.type || '')
  if (/dividend|coupon/.test(type)) return 'dividends'
  if (/buy|sell|ptf|order|offering|trade/.test(type)) return 'trades'
  return Number(t.amount) >= 0 ? 'in' : 'out'
}
const labelOf = (t) => {
  const type = String(t.type || '')
  if (type === 'deposit') return 'Money added'
  if (type === 'withdrawal') return 'Withdrawal'
  if (type === 'buy') return `Bought ${t.symbol || ''}`.trim()
  if (type === 'sell') return `Sold ${t.symbol || ''}`.trim()
  if (type === 'offering_application') return 'Held for offer'
  if (type === 'ptf_buy') return 'Bought a portfolio'
  return t.description || type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// 10. Three wallets
// ---------------------------------------------------------------------------
export default function Money() {
  const navigate = useNavigate()
  const wallets = useLoad(() => api.money.wallets())
  const tx = useLoad(() => api.money.transactions())
  const deposits = useLoad(() => api.money.deposits())
  const subs = useLoad(() => api.offerings.mySubscriptions())

  const ws = [...(wallets.data || [])].sort((a, b) => ORDER.indexOf(a.currency) - ORDER.indexOf(b.currency))
  const holds = (subs.data || []).filter((s) => ['APPLIED', 'ALLOTMENT_PENDING'].includes(s.status))
  const incoming = (deposits.data || []).filter((d) => ['pending', 'processing', 'awaiting_funds', 'created'].includes(d.status))

  return (
    <div className="stack">
      <PageHead title="Money" sub="Three wallets. Each holds one currency.">
        <Link className="btn btn-outline" to="/money/move?tab=withdraw">Withdraw</Link>
        <Link className="btn btn-primary" to="/money/move">Add money</Link>
      </PageHead>

      {wallets.error && <ErrorNote error={wallets.error} onRetry={wallets.reload} />}
      <div className="grid g3">
        {wallets.loading ? [0, 1, 2].map((i) => <div className="tile" key={i}><Loading rows={3} /></div>) : ws.map((w) => (
          <div className="tile" key={w.id}>
            <div className="row"><span className="lab">{NAMES[w.currency] || w.currency}</span><Pill kind="quiet">{w.currency}</Pill></div>
            <div className="big">{formatMoney(w.available_balance, w.currency)}</div>
            <div className="sub muted">
              {Number(w.reserved_balance) > 0 ? `${formatMoney(w.reserved_balance, w.currency, { decimals: 0 })} held for a public offer` : Number(w.pending_balance) > 0 ? `${formatMoney(w.pending_balance, w.currency, { decimals: 0 })} on its way` : 'Nothing on hold'}
            </div>
          </div>
        ))}
      </div>

      <div className="split">
        <Card title="Recent activity" flush action={<Link to="/money/transactions" className="small" style={{ fontWeight: 600 }}>See all</Link>}>
          {tx.loading ? <div className="card-body"><Loading rows={4} /></div> : !(tx.data || []).length ? <Empty title="Nothing yet">Deposits, trades and withdrawals show up here.</Empty> : (
            <table>
              <thead><tr><th>What</th><th>Date</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {tx.data.slice(0, 6).map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => navigate(`/money/transactions?id=${t.id}`)}>
                    <td><strong>{labelOf(t)}</strong>{t.symbol && <div className="xs muted">{t.symbol}</div>}</td>
                    <td className="small muted">{formatDateTime(txTime(t))}</td>
                    <td className={`num ${Number(t.amount) >= 0 ? 'up' : ''}`}>{signed(t.amount, t.currency, { decimals: 0 })}</td>
                    <td><StatusPill status={t.status || 'completed'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <div className="stack">
          <Card title="Holds">
            {holds.length ? holds.map((h) => (
              <Link key={h.id} to={`/offers/${h.offering_id}`} className="list-row" style={{ color: 'inherit' }}>
                <div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{h.offering_name || 'Public offer'}</div><div className="xs muted">Held until allotment</div></div>
                <strong>{formatMoney(h.amount_held || h.amount || 0, h.currency || 'NGN', { decimals: 0 })}</strong>
              </Link>
            )) : <p className="small muted">Nothing is on hold.</p>}
          </Card>
          <Card title="On its way">
            {incoming.length ? incoming.map((d) => (
              <div className="list-row" key={d.id}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Incoming deposit</div><div className="xs muted">{d.method?.replace(/_/g, ' ')}</div></div><strong>{formatMoney(d.amount, d.currency, { decimals: 0 })}</strong></div>
            )) : <p className="small muted">Nothing is on its way.</p>}
          </Card>
          <p className="xs muted">Money usually shows within one banking day. Each currency stays in its own wallet.</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 11. Add money, withdraw and convert
// ---------------------------------------------------------------------------
export function MoneyMove() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'add'
  const { isSampleData } = useSession()
  const wallets = useLoad(() => api.money.wallets())
  const deposits = useLoad(() => api.money.deposits())
  const sources = useLoad(() => api.money.fundingSources())
  const reload = () => { wallets.reload(); deposits.reload() }

  return (
    <div className="stack">
      <PageHead title="Add, withdraw or convert" sub="One place to move money in, out or between wallets." back={{ to: '/money', label: 'Money' }} />
      <Tabs value={tab} onChange={(v) => setParams({ tab: v })} label="What to do" options={[{ value: 'add', label: 'Add money' }, { value: 'withdraw', label: 'Withdraw' }, { value: 'convert', label: 'Convert' }]} />
      <div className="page-narrow" style={{ maxWidth: 760 }}>
        {tab === 'add' && <AddMoney sources={sources.data || []} deposits={deposits} onDone={reload} isSampleData={isSampleData} />}
        {tab === 'withdraw' && <Withdraw sources={sources.data || []} wallets={wallets.data || []} onDone={reload} />}
        {tab === 'convert' && <Convert wallets={wallets.data || []} />}
      </div>
    </div>
  )
}

// Moving money between wallets is not an endpoint in the Bluum documentation
// we have, so this shows the quote the screen needs from a sample rate.
const RATES = { 'USD>NGN': 1512.4, 'NGN>USD': 1 / 1512.4, 'USD>KES': 129.1, 'KES>USD': 1 / 129.1, 'NGN>KES': 129.1 / 1512.4, 'KES>NGN': 1512.4 / 129.1 }
function Convert({ wallets }) {
  const [from, setFrom] = useState('NGN')
  const [to, setTo] = useState('USD')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState(null)
  const rate = RATES[`${from}>${to}`]
  const w = wallets.find((x) => x.currency === from)
  const fee = Number(amount) * 0.005

  return (
    <Card title="Convert">
      <Field label="From"><select value={from} onChange={(e) => { setFrom(e.target.value); setQuote(null) }}>{ORDER.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
      <Field label="To"><select value={to} onChange={(e) => { setTo(e.target.value); setQuote(null) }}>{ORDER.filter((c) => c !== from).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
      <Field label={`Amount (${from})`} hint={w ? `Available ${formatMoney(w.available_balance, from)}` : undefined}><input type="number" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setQuote(null) }} /></Field>
      <p className="small muted" style={{ marginBottom: 12 }}>Rate {rate ? (from === 'NGN' || (from === 'KES' && to === 'NGN') ? `1 ${to} = ${(1 / rate).toFixed(2)} ${from}` : `1 ${from} = ${rate.toFixed(2)} ${to}`) : '—'} · you see the final quote before you confirm.</p>
      {quote && <div className="mt-sm"><KV k="You send" v={formatMoney(quote.send, from)} /><KV k="Fee" v={formatMoney(quote.fee, from)} /><KV k="You get about" v={formatMoney(quote.get, to)} /></div>}
      <button className="btn btn-primary btn-block" disabled={!(Number(amount) > 0)} onClick={() => setQuote({ send: Number(amount), fee, get: (Number(amount) - fee) * rate })}>Get quote</button>
      <SampleNote>Converting between wallets is not connected. The rate and fee here are invented; this needs an endpoint or a partner at Bluum.</SampleNote>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 12. Linked accounts
// ---------------------------------------------------------------------------
export function MoneyAccounts() {
  const sources = useLoad(() => api.money.fundingSources())
  return (
    <div className="stack">
      <PageHead title="Linked accounts" sub="Withdrawals only go to accounts in your name." back={{ to: '/money', label: 'Money' }} />
      <BankAccounts sources={sources} />
      <p className="xs muted">We never ask for your PIN or password to link an account.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 13. Transactions and receipt
// ---------------------------------------------------------------------------
export function Transactions() {
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState('all')
  const tx = useLoad(() => api.money.transactions())
  const all = tx.data || []
  const rows = all.filter((t) => filter === 'all' || kindOf(t) === filter)
  const sel = all.find((t) => t.id === params.get('id')) || rows[0]

  return (
    <div className="stack">
      <PageHead title="Transactions" sub="Everything that moved in or out of your wallets." back={{ to: '/money', label: 'Money' }} />
      <Tabs value={filter} onChange={setFilter} label="Filter" options={[{ value: 'all', label: 'All' }, { value: 'in', label: 'Money in' }, { value: 'out', label: 'Money out' }, { value: 'trades', label: 'Trades' }, { value: 'dividends', label: 'Dividends' }]} />
      <div className="split">
        <Card flush>
          {tx.loading ? <div className="card-body"><Loading rows={5} /></div> : tx.error ? <div className="card-body"><ErrorNote error={tx.error} onRetry={tx.reload} /></div> : !rows.length ? <Empty title="Nothing here">Try another filter.</Empty> : (
            <table>
              <thead><tr><th>Date</th><th>What</th><th>Reference</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => setParams({ id: t.id })} style={t.id === sel?.id ? { background: 'var(--dividendii-info-bg)' } : undefined}>
                    <td className="small muted">{formatDateTime(txTime(t))}</td>
                    <td><strong>{labelOf(t)}</strong></td>
                    <td className="xs muted">{String(t.id).slice(0, 14)}</td>
                    <td className={`num ${Number(t.amount) >= 0 ? 'up' : ''}`}>{signed(t.amount, t.currency)}</td>
                    <td><StatusPill status={t.status || 'completed'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        {sel && (
          <Card title={labelOf(sel)}>
            <KV k="Amount" v={signed(sel.amount, sel.currency)} />
            <KV k="Wallet" v={NAMES[sel.currency] || sel.currency} />
            <KV k="Date" v={formatDateTime(txTime(sel))} />
            <KV k="Reference" v={String(sel.id).slice(0, 18)} />
            <KV k="Status" v={<StatusPill status={sel.status || 'completed'} />} />
            <button className="btn btn-outline btn-block mt" onClick={() => window.print()}>Download receipt</button>
          </Card>
        )}
      </div>
    </div>
  )
}
