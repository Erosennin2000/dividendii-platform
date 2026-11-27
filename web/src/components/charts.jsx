// Charts, drawn from the numbers given. No chart library: they are small SVG
// and they follow the brand chart colours in this order.

import { useEffect, useMemo, useRef, useState } from 'react'

export const CHART_COLOURS = ['#295D8F', '#C59F56', '#17375A', '#94AEC7', '#6E8B5A', '#B5654A']

// ---------------------------------------------------------------------------
// Icons. One set, one stroke width, so the console looks like one thing.
// ---------------------------------------------------------------------------
const PATHS = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  markets: 'M6 20V10M12 20V4M18 20v-7',
  portfolio: 'M12 3a9 9 0 1 0 9 9h-9V3zM15 3.5A9 9 0 0 1 20.5 9H15V3.5z',
  bonds: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  offers: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01',
  orders: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  money: 'M3 7h18v12H3zM3 11h18M7 15h3',
  gifts: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7C10 7 8 6 8 4.5S10 3 12 7zM12 7c2 0 4-1 4-2.5S14 3 12 7z',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 21h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7V6a2 2 0 0 1 2-2h10M16 14h.01',
  warning: 'M12 4l9.5 16h-19L12 4zM12 10v4M12 17h.01',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  x: 'M6 6l12 12M18 6L6 18',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13',
  news: 'M5 4h12v16H7a2 2 0 0 1-2-2V4zM17 8h3v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  repeat: 'M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4M21 13v2a2 2 0 0 1-2 2H3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  scale: 'M12 4v16M5 20h14M5 8h14M5 8l-3 7a3 3 0 0 0 6 0L5 8zM19 8l-3 7a3 3 0 0 0 6 0l-3-7z',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6',
  alert: 'M12 4l9.5 16h-19L12 4zM12 10v4M12 17h.01',
  refresh: 'M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18',
  chart: 'M6 20V10M12 20V4M18 20v-7',
  bond: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
}

export function Icon({ name, size = 20, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name] || PATHS.info} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Sparkline: a small line with no axes, red or green by direction.
// ---------------------------------------------------------------------------
export function Spark({ values, width = 56, height = 22, colour }) {
  if (!values || values.length < 2) return <span style={{ width, height, display: 'inline-block' }} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = (width - 2) / (values.length - 1)
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${(1 + i * step).toFixed(1)} ${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ')
  const up = values.at(-1) >= values[0]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={colour || (up ? 'var(--good)' : 'var(--bad)')} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Line chart with axes, an area fill and a hover read-out.
// points: [{ t, v }]. format: how to print a value.
// ---------------------------------------------------------------------------
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const read = () => setW(Math.max(260, Math.floor(el.getBoundingClientRect().width)))
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const compact = (n) => {
  const a = Math.abs(n)
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}bn`
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}m`
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}k`
  if (a >= 100) return n.toFixed(0)
  return n.toFixed(2)
}
export const compactNumber = compact

export function LineChart({ points, height = 220, format = compact, dateFormat, colour = 'var(--blue)', label = 'Chart' }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const model = useMemo(() => {
    if (!points || points.length < 2) return null
    const left = 52
    const right = 12
    const top = 10
    const bottom = 24
    const vals = points.map((p) => Number(p.v))
    let min = Math.min(...vals)
    let max = Math.max(...vals)
    const pad = (max - min || Math.abs(max) * 0.02 || 1) * 0.12
    min -= pad
    max += pad
    const x = (i) => left + (i / (points.length - 1)) * (width - left - right)
    const y = (v) => top + (1 - (v - min) / (max - min)) * (height - top - bottom)
    const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    const area = `${line} L${x(vals.length - 1).toFixed(1)} ${height - bottom} L${left} ${height - bottom} Z`
    const grid = [0, 1, 2, 3].map((k) => {
      const v = min + ((max - min) * k) / 3
      return { v, y: y(v) }
    })
    const xl = [0, 1, 2, 3].map((k) => {
      const i = Math.round((k / 3) * (points.length - 1))
      return { i, x: x(i), t: points[i].t }
    })
    return { line, area, grid, xl, x, y, vals, left, right, bottom }
  }, [points, width, height])

  if (!model) return <div className="skeleton" style={{ height }} />

  const fmtDate =
    dateFormat ||
    ((t) => {
      const d = new Date(t)
      return Number.isNaN(d.getTime()) ? String(t) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    })

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    const i = Math.round(((px - model.left) / (width - model.left - model.right)) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }
  const last = points.length - 1
  const at = hover ?? last

  return (
    <div className="chart-box" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        role="img"
        aria-label={label}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {model.grid.map((g, i) => (
          <g key={i}>
            <line x1={model.left} x2={width - model.right} y1={g.y} y2={g.y} stroke="var(--line)" strokeWidth="1" />
            <text x={model.left - 8} y={g.y + 3} textAnchor="end" fontSize="10.5" fill="var(--muted)">
              {format(g.v)}
            </text>
          </g>
        ))}
        {model.xl.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === model.xl.length - 1 ? 'end' : 'middle'}
            fontSize="10.5"
            fill="var(--muted)"
          >
            {fmtDate(l.t)}
          </text>
        ))}
        <path d={model.area} fill={colour} opacity="0.09" />
        <path d={model.line} fill="none" stroke={colour} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={model.x(at)} cy={model.y(model.vals[at])} r="3.6" fill={colour} />
        {hover !== null && (
          <line x1={model.x(at)} x2={model.x(at)} y1="8" y2={height - model.bottom} stroke={colour} strokeDasharray="3 3" opacity="0.5" />
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(model.x(at) / width) * 100}%`, top: model.y(model.vals[at]) }}>
          {format(model.vals[at], true)} · {fmtDate(points[at].t)}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Donut with the total in the middle.
// parts: [{ label, value, colour? }]
// ---------------------------------------------------------------------------
export function Donut({ parts, size = 170, centre, caption = 'Total' }) {
  const total = parts.reduce((s, p) => s + Math.max(0, Number(p.value) || 0), 0)
  const r = size / 2 - 14
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Allocation">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel)" strokeWidth="22" />
          {total > 0 &&
            parts.map((p, i) => {
              const frac = Math.max(0, Number(p.value) || 0) / total
              const dash = frac * c
              const el = (
                <circle
                  key={p.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={p.colour || CHART_COLOURS[i % CHART_COLOURS.length]}
                  strokeWidth="22"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              )
              offset += dash
              return el
            })}
          <text x="50%" y="48%" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)">
            {centre}
          </text>
          <text x="50%" y="48%" dy="16" textAnchor="middle" fontSize="11" fill="var(--muted)">
            {caption}
          </text>
        </svg>
      </div>
      <div className="legend">
        {parts.map((p, i) => (
          <div className="li" key={p.label}>
            <span className="sw" style={{ background: p.colour || CHART_COLOURS[i % CHART_COLOURS.length] }} />
            <span>{p.label}</span>
            <span className="pc">{total ? `${Math.round((p.value / total) * 100)}%` : '0%'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bars with a value label above each bar.
// items: [{ label, value, display }]
// ---------------------------------------------------------------------------
export function Bars({ items, height = 190, colour = 'var(--blue)' }) {
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height, paddingTop: 22 }} role="img" aria-label="Bar chart">
      {items.map((i) => (
        <div key={i.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{i.display ?? i.value}</div>
          <div style={{ width: '100%', maxWidth: 64, height: `${Math.max(3, (Number(i.value) / max) * 100)}%`, background: colour, borderRadius: '4px 4px 0 0' }} />
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{i.label}</div>
        </div>
      ))}
    </div>
  )
}

// A horizontal pair of bars: where you are against where you want to be.
export function GapBar({ now, target }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div className="progress"><div style={{ width: `${Math.min(100, now)}%` }} /></div>
      <div className="progress"><div style={{ width: `${Math.min(100, target)}%`, background: 'var(--gold)' }} /></div>
    </div>
  )
}
