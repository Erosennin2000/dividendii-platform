// Goals: a number and a date, and how close you are. A guide only: nothing
// is locked and nothing is moved. Runs on sample data until goals exist as a
// real product.

import { useState } from 'react'
import { api, formatDate, formatMoney } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, ErrorNote, Field, KV, Loading, PageHead, SampleChip } from '../components/ui.jsx'

export default function Goals() {
  const goals = useLoad(() => api.extras.goals())
  const [pick, setPick] = useState(null)
  const [form, setForm] = useState({ name: '', target: '', currency: 'NGN', by: '' })
  const [err, setErr] = useState(null)
  const list = goals.data || []
  const sel = list.find((g) => g.id === pick) || list[0]

  const yearsLeft = (g) => Math.max(0.25, (new Date(g.by) - Date.now()) / (365 * 864e5))
  const perYear = (g) => Math.max(0, (Number(g.target) - Number(g.saved)) / yearsLeft(g))

  async function create(e) {
    e.preventDefault()
    setErr(null)
    try {
      const r = await api.extras.addGoal(form)
      setForm({ name: '', target: '', currency: 'NGN', by: '' })
      setPick(r.data.id)
      goals.reload()
    } catch (x) { setErr(x) }
  }
  async function remove(id) { await api.extras.removeGoal(id); setPick(null); goals.reload() }

  return (
    <div className="stack">
      <PageHead title={<>Goals <SampleChip /></>} sub="Set a number and a date. We show how close you are." back={{ to: '/portfolio', label: 'Portfolio' }} />
      <div className="split">
        <div className="stack">
          {goals.loading ? <Loading rows={3} /> : goals.error ? <ErrorNote error={goals.error} onRetry={goals.reload} /> : list.map((g) => {
            const pct = Math.min(100, Math.round((Number(g.saved) / Number(g.target)) * 100))
            return (
              <button key={g.id} className={`tile ${g.id === sel?.id ? 'sel' : ''}`} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => setPick(g.id)}>
                <div className="row"><strong style={{ color: 'var(--ink)', fontSize: 15 }}>{g.name}</strong><span className="muted small">{formatMoney(g.target, g.currency, { decimals: 0 })} by {new Date(g.by).getFullYear()}</span></div>
                <div className="progress mt-sm"><div style={{ width: `${pct}%` }} /></div>
                <div className="row mt-sm small"><span>{formatMoney(g.saved, g.currency, { decimals: 0 })} saved · <strong>{pct}% there</strong></span><span className="muted">{formatMoney(perYear(g), g.currency, { decimals: 0 })} a year to stay on track</span></div>
              </button>
            )
          })}
          {sel && (
            <Card title={`What counts toward ${sel.name}`}>
              {sel.parts.map((p) => (
                <div className="list-row" key={p.name}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div><div className="xs muted">{p.kind}</div></div><strong>{formatMoney(p.amount, sel.currency, { decimals: 0 })}</strong></div>
              ))}
              {!sel.parts.length && <p className="small muted">Nothing counts toward this yet.</p>}
              <div className="mt"><button className="btn btn-quiet btn-sm" onClick={() => remove(sel.id)}>Delete this goal</button></div>
            </Card>
          )}
        </div>
        <Card title="New goal">
          <form onSubmit={create}>
            <Field label="Name"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="School fees fund" /></Field>
            <Field label="Currency"><select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="NGN">Naira</option><option value="USD">Dollar</option><option value="KES">Shilling</option></select></Field>
            <Field label="Target"><input type="number" min="0" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></Field>
            <Field label="By"><input type="date" value={form.by} onChange={(e) => setForm({ ...form, by: e.target.value })} /></Field>
            <ErrorNote error={err} />
            <button className="btn btn-primary btn-block">Create goal</button>
            <p className="xs muted mt-sm">Goals are a guide. They do not lock your money.</p>
          </form>
        </Card>
      </div>
    </div>
  )
}
