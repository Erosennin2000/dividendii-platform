// Auto-invest: the same amount on the same day. Plans are kept here on
// sample data; running them needs a scheduler and a decision on how a missed
// run is handled (see the list of open items).

import { useState } from 'react'
import { api, formatDate, formatMoney } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, ErrorNote, Field, Loading, PageHead, Pill, SampleChip, SampleNote } from '../components/ui.jsx'

export default function AutoInvest() {
  const data = useLoad(() => api.extras.plans())
  const assets = useLoad(() => api.market.assets({ class: 'equity,etf', limit: 100 }))
  const [form, setForm] = useState({ what: '', amount: '', currency: 'NGN', every: 'month', start: '' })
  const [err, setErr] = useState(null)
  const plans = data.data?.plans || []
  const runs = data.data?.runs || []

  async function save(e) {
    e.preventDefault()
    setErr(null)
    try {
      await api.extras.addPlan(form)
      setForm({ what: '', amount: '', currency: 'NGN', every: 'month', start: '' })
      data.reload()
    } catch (x) { setErr(x) }
  }
  const toggle = async (p) => { await api.extras.setPlan(p.id, p.status === 'active' ? 'paused' : 'active'); data.reload() }
  const remove = async (p) => { await api.extras.removePlan(p.id); data.reload() }

  return (
    <div className="stack">
      <PageHead title={<>Auto-invest <SampleChip /></>} sub="Put in the same amount on the same day. Skip or stop any time." back={{ to: '/portfolio', label: 'Portfolio' }} />
      <div className="split">
        <div className="stack">
          <Card title="Your plans" flush>
            {data.loading ? <div className="card-body"><Loading rows={3} /></div> : data.error ? <div className="card-body"><ErrorNote error={data.error} onRetry={data.reload} /></div> : (
              <div className="card-body" style={{ paddingTop: 4 }}>
                {plans.map((p) => (
                  <div className="list-row" key={p.id}>
                    <div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.what}</div><div className="xs muted">{formatMoney(p.amount, p.currency, { decimals: 0 })} every {p.every} · next {formatDate(p.next)} · from {p.from.toLowerCase()}</div></div>
                    <Pill kind={p.status === 'active' ? 'good' : 'quiet'}>{p.status === 'active' ? 'Active' : 'Paused'}</Pill>
                    <button className="btn btn-quiet btn-sm" onClick={() => toggle(p)}>{p.status === 'active' ? 'Pause' : 'Resume'}</button>
                    <button className="btn btn-quiet btn-sm" onClick={() => remove(p)}>Stop</button>
                  </div>
                ))}
                {!plans.length && <p className="small muted pad">No plans yet.</p>}
              </div>
            )}
          </Card>
          <Card title="Recent runs" flush>
            <table>
              <thead><tr><th>Date</th><th>Plan</th><th className="num">Amount</th><th>Result</th></tr></thead>
              <tbody>{runs.map((r, i) => <tr key={i}><td>{formatDate(r.date)}</td><td>{r.plan}</td><td className="num">{formatMoney(r.amount, r.currency, { decimals: 0 })}</td><td><Pill kind="good">{r.result}</Pill></td></tr>)}</tbody>
            </table>
          </Card>
        </div>
        <Card title="New plan">
          <form onSubmit={save}>
            <Field label="What to buy"><input type="text" list="plan-assets" value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value.toUpperCase() })} placeholder="MTNN" /><datalist id="plan-assets">{(assets.data || []).map((a) => <option key={a.symbol} value={a.symbol}>{a.name}</option>)}</datalist></Field>
            <Field label="Amount"><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Currency"><select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="NGN">Naira</option><option value="USD">Dollar</option><option value="KES">Shilling</option></select></Field>
            <Field label="How often"><select value={form.every} onChange={(e) => setForm({ ...form, every: e.target.value })}><option value="month">Every month</option><option value="two weeks">Every two weeks</option><option value="week">Every week</option></select></Field>
            <Field label="Start on"><input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
            <ErrorNote error={err} />
            <button className="btn btn-primary btn-block">Save plan</button>
            <p className="xs muted mt-sm">If your wallet is short on the day, we skip that run and email you.</p>
          </form>
          <SampleNote>Plans are saved here but no run happens yet.</SampleNote>
        </Card>
      </div>
    </div>
  )
}
