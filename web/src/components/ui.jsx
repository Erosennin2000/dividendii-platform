// Small pieces every screen uses. Nothing here knows about Bluum.

import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './charts.jsx'

export function Card({ title, action, children, flush, className = '' }) {
  if (!title) return <div className={`card ${className}`}>{children}</div>
  return (
    <section className={`card ${flush ? 'flush' : ''} ${className}`}>
      <div className="card-head">
        <h2>{title}</h2>
        {action}
      </div>
      {flush ? children : <div className="card-body">{children}</div>}
    </section>
  )
}

export function Notice({ kind = 'info', title, children }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'bad' ? 'alert' : undefined}>
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  )
}

export function Pill({ kind = 'quiet', children }) {
  return <span className={`pill pill-${kind}`}>{children}</span>
}

// One place that decides how a status looks, so the same word is never green
// on one screen and grey on another.
const STATUS_KINDS = {
  active: 'good',
  filled: 'good',
  completed: 'good',
  passed: 'good',
  published: 'good',
  delivered: 'good',
  FULLY_ALLOTTED: 'good',
  OPEN: 'good',
  onboarding: 'warn',
  under_review: 'warn',
  awaiting_documents: 'warn',
  awaiting_funding: 'warn',
  pending: 'warn',
  accepted: 'info',
  partially_filled: 'info',
  in_progress: 'info',
  APPLIED: 'info',
  ANNOUNCED: 'info',
  PARTIALLY_ALLOTTED: 'info',
  ALLOTMENT_PENDING: 'info',
  placed: 'info',
  declined: 'bad',
  suspended: 'bad',
  rejected: 'bad',
  failed: 'bad',
  setup_failed: 'bad',
  REJECTED: 'bad',
  canceled: 'quiet',
  cancelled: 'quiet',
  WITHDRAWN: 'quiet',
  CLOSED: 'quiet',
}

export const StatusPill = ({ status }) => (
  <Pill kind={STATUS_KINDS[status] || 'quiet'}>{humanStatus(status)}</Pill>
)

export const humanStatus = (status) =>
  String(status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function Loading({ rows = 3 }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <Notice kind="bad" title="That did not work">
      {error.message}
      {error.retryable && onRetry && (
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </Notice>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// A plain line chart, drawn from the numbers given. No chart library.
export function Sparkline({ points, height = 72, colour = 'var(--blue)' }) {
  if (!points || points.length < 2) return <div className="skeleton" style={{ height }} />
  const values = points.map((p) => Number(p.v ?? p.c ?? p))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = 100 / (values.length - 1)
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(2)} ${(100 - ((v - min) / span) * 100).toFixed(2)}`)
    .join(' ')
  const rising = values.at(-1) >= values[0]
  return (
    <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} role="img" aria-label="Price over time">
      <path d={`${d} L 100 100 L 0 100 Z`} fill={rising ? 'var(--good-bg)' : 'var(--bad-bg)'} opacity="0.7" />
      <path d={d} fill="none" stroke={rising ? 'var(--good)' : 'var(--bad)'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Modal({ title, children, onClose, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--dividendii-scrim)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        zIndex: 50,
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <div className="row" style={{ marginBottom: 16 }}>
          <h2>{title}</h2>
          <button className="linkbtn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  )
}

// Shows a Bluum fee breakdown as its own rows, so a customer sees what each
// charge is rather than one lump.
export function FeeRows({ estimate, currency, formatMoney }) {
  if (!estimate) return null
  const fees = estimate.fees || []
  return (
    <div>
      <div className="kv">
        <span className="muted">Value</span>
        <span className="num">{formatMoney(estimate.order_value, currency)}</span>
      </div>
      {fees.map((f, i) => (
        <div className="kv" key={i}>
          <span className="muted">{humanStatus(f.type)}</span>
          <span className="num">{formatMoney(f.amount, f.currency || currency)}</span>
        </div>
      ))}
      <div className="kv total">
        <span>Total</span>
        <span className="num">{formatMoney(estimate.estimated_total, currency)}</span>
      </div>
    </div>
  )
}

// A checkbox list of disclosures, each with its text shown exactly as the
// API returned it. Nothing is pre-ticked and nothing is summarised.
export function DisclosureList({ disclosures, accepted, onToggle }) {
  return (
    <div className="stack">
      {disclosures.map((d) => (
        <div key={d.id}>
          <h3 style={{ marginBottom: 8 }}>{d.name || d.code}</h3>
          <div className="disclosure-text">{d.verbatim_text}</div>
          <label className="check">
            <input type="checkbox" checked={Boolean(accepted[d.id])} onChange={() => onToggle(d.id)} />
            <span>
              I have read and agree to the {d.name || d.code}
              {d.version ? ` (version ${d.version})` : ''}.
            </span>
          </label>
        </div>
      ))}
    </div>
  )
}

// Keeps a value while it is being typed, so a number field does not fight
// the person using it.
export function useDebounced(value, ms = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// ---------------------------------------------------------------------------
// Added for the console design
// ---------------------------------------------------------------------------

export const Toggle = ({ on, onChange, label, disabled }) => (
  <button type="button" role="switch" className="toggle" aria-checked={Boolean(on)} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />
)

// Tells the customer a block runs on invented data, until Bluum or a real
// product sits behind it.
export const SampleChip = () => <span className="sample-chip">Sample</span>

export function PageHead({ title, sub, children, back }) {
  return (
    <div className="page-head">
      <div>
        {back && (
          <NavLink to={back.to} className="crumb">
            ← {back.label}
          </NavLink>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  )
}

// Tabs that are links, so each tab has its own address.
export function LinkTabs({ items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end role="tab">
          {i.label}
        </NavLink>
      ))}
    </div>
  )
}

export function Tabs({ options, value, onChange, label }) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const Ranges = ({ value, onChange, options = ['1D', '1W', '1M', '3M', '1Y', 'All'] }) => (
  <div className="ranges" role="group" aria-label="Time range">
    {options.map((o) => (
      <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}>
        {o}
      </button>
    ))}
  </div>
)

export const KV = ({ k, v, className = '' }) => (
  <div className="kv">
    <span className="muted">{k}</span>
    <span className={`num ${className}`} style={{ fontWeight: 600, color: className ? undefined : 'var(--ink)' }}>
      {v}
    </span>
  </div>
)

export const Row = ({ icon, title, sub, right, tone, to }) => {
  const inner = (
    <>
      {icon && (
        <span className={`ico ${tone || ''}`}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <div className="grow">
        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        {sub && <div className="xs muted">{sub}</div>}
      </div>
      {right}
    </>
  )
  return to ? (
    <NavLink to={to} className="list-row" style={{ color: 'inherit' }}>
      {inner}
    </NavLink>
  ) : (
    <div className="list-row">{inner}</div>
  )
}

// Text shown when a feature runs on sample data, so nobody mistakes it.
export const SampleNote = ({ children }) => (
  <p className="xs muted" style={{ marginTop: 10 }}>
    {children || 'Sample data for layout. This is not connected to a real service yet.'}
  </p>
)
