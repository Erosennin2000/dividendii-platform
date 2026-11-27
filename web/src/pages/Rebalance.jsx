// Keep your mix on track: what you hold against a mix you choose. A guide,
// not advice. Computed from your real holdings, one currency at a time.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatMoney } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, ErrorNote, Loading, Notice, PageHead, Tabs } from '../components/ui.jsx'
import { GapBar } from '../components/charts.jsx'

export default function Rebalance() {
  const [model, setModel] = useState('Balanced')
  const [currency, setCurrency] = useState('NGN')
  const mix = useLoad(() => api.extras.mix(model, currency), [model, currency])
  const m = mix.data

  const hint = (r) =>
    r.gap < -3 ? (r.part === 'Bonds' ? { text: 'Buy a bond', to: '/bonds' } : r.part === 'Shares' ? { text: 'Buy shares', to: '/markets' } : null)
    : r.gap > 3 ? { text: r.part === 'Cash' ? 'Put some cash to work' : `Hold less ${r.part.toLowerCase()}`, to: r.part === 'Cash' ? '/markets' : '/portfolio' }
    : null

  return (
    <div className="stack">
      <PageHead title="Keep your mix on track" sub="Compare what you hold with a mix you choose." back={{ to: '/portfolio', label: 'Portfolio' }} />
      <div className="wrap">
        <Tabs value={model} onChange={setModel} label="Mix" options={['Steady income', 'Balanced', 'Growth'].map((v) => ({ value: v, label: v }))} />
        <Tabs value={currency} onChange={setCurrency} label="Currency" options={[{ value: 'NGN', label: 'Naira' }, { value: 'USD', label: 'Dollar' }, { value: 'KES', label: 'Shilling' }]} />
      </div>
      {mix.loading && !m ? <Loading rows={4} /> : mix.error ? <ErrorNote error={mix.error} onRetry={mix.reload} /> : m && (
        <div className="split">
          <div className="stack">
            <Card title={`Your mix against ${m.model}`} flush>
              <table>
                <thead><tr><th>Part</th><th className="num">Now</th><th className="num">Target</th><th className="num">Gap</th></tr></thead>
                <tbody>
                  {m.rows.map((r) => (
                    <tr key={r.part}><td><strong>{r.part}</strong></td><td className="num">{r.now}%</td><td className="num">{r.target}%</td><td className={`num ${r.gap > 0 ? 'up' : r.gap < 0 ? 'dn' : ''}`}>{r.gap > 0 ? '+' : ''}{r.gap}%</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="To get closer">
              {m.rows.map(hint).filter(Boolean).length ? m.rows.map((r) => { const h = hint(r); return h && (
                <div className="list-row" key={r.part}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{h.text}</div><div className="xs muted">{r.part} is {Math.abs(r.gap)}% {r.gap > 0 ? 'above' : 'below'} the target</div></div><Link className="btn btn-outline btn-sm" to={h.to}>Review</Link></div>
              ) }) : <p className="small muted">You are close to this mix. No action needed.</p>}
              <p className="xs muted mt-sm">Keep cash for offers if you plan to apply. Cash on hold for an offer counts as its own part.</p>
            </Card>
          </div>
          <div className="stack">
            <Card title="Mix">
              {m.rows.map((r) => (
                <div key={r.part} style={{ marginBottom: 14 }}>
                  <div className="row small"><strong>{r.part}</strong><span className="muted">{r.now}% now · {r.target}% target</span></div>
                  <GapBar now={r.now} target={r.target} />
                </div>
              ))}
              <p className="xs muted">Blue is what you hold now. Gold is the target.</p>
            </Card>
            <Notice kind="info">This is a guide, not personal advice. Values can go down as well as up. Total counted: {formatMoney(m.total, m.currency, { decimals: 0 })}.</Notice>
          </div>
        </div>
      )}
    </div>
  )
}
