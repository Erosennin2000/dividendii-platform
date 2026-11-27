// One bond, with its own order ticket.
//
// Everything on this screen speaks in face value and percent of par. The
// disclosure gate comes first: Bluum requires the fixed income disclosure
// before the first bond order, and this screen will not let the ticket be
// used until it is signed.

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatMoney, formatPercent, formatQuantity, formatDate, newKey } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import {
  Card,
  Loading,
  Notice,
  ErrorNote,
  Field,
  Segmented,
  DisclosureList,
  StatusPill,
  FeeRows,
  useDebounced,
} from '../components/ui.jsx'

export default function BondDetail() {
  const { symbol } = useParams()
  const { canTrade } = useSession()
  const bond = useLoad(() => api.bonds.get(symbol), [symbol])
  const outstanding = useLoad(() => api.bonds.outstandingDisclosures(), [symbol])
  const holdings = useLoad(() => api.bonds.holdings(), [symbol])

  // As on the share screen: a refresh must not unmount the ticket.
  if (bond.loading && !bond.data) return <Loading rows={6} />
  if (bond.error && !bond.data) return <ErrorNote error={bond.error} onRetry={bond.reload} />

  const { asset, quote } = bond.data
  const b = asset.bond || {}
  const holding = (holdings.data || []).find((h) => h.symbol === asset.symbol)
  const needsDisclosure = (outstanding.data || []).length > 0

  return (
    <div className="stack">
      <div className="page-head">
        <Link to="/bonds" className="small">
          ← Bonds
        </Link>
        <h1 style={{ marginTop: 8 }}>{asset.name}</h1>
        <p>
          {b.cusip || asset.symbol}
          {b.issuer_type ? ` · ${b.issuer_type}` : ''} · {asset.currency}
        </p>
      </div>

      <div className="split">
        <div className="stack">
          <Card title="The terms">
            <div className="grid g2">
              <Row label="Price" value={`${quote?.last_price || asset.price}% of face value`} />
              <Row label="Coupon" value={b.coupon_rate ? `${formatPercent(b.coupon_rate, 3)} a year` : '—'} />
              <Row label="Paid" value={b.coupon_frequency ? b.coupon_frequency.replace('_', ' ') : '—'} />
              <Row label="Yield to maturity" value={b.yield_to_maturity ? `${formatPercent(b.yield_to_maturity)} a year` : '—'} />
              <Row label="Matures" value={formatDate(b.maturity_date)} />
              <Row label="Smallest order" value={b.min_increment ? `${formatQuantity(b.min_increment)} face value` : '—'} />
              <Row label="Settles" value={b.settlement_convention || '—'} />
              <Row
                label="Interest built up"
                value={b.accrued_interest ? `${b.accrued_interest}% of face value` : '—'}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <Notice kind="info" title="What you will pay">
                Face value × (price + interest built up) ÷ 100. On {formatQuantity(b.min_increment || 1000)} of face
                value at {quote?.last_price || asset.price}%, that is about{' '}
                {formatMoney(
                  (Number(b.min_increment || 1000) * (Number(quote?.last_price || asset.price) + Number(b.accrued_interest || 0))) / 100,
                  asset.currency,
                )}
                . The exact interest is worked out at settlement, so the total is approximate.
              </Notice>
            </div>
          </Card>

          <Schedule asset={asset} bond={b} />

          {holding && (
            <Card title="Your holding">
              <div className="grid g3">
                <Row label="Face value held" value={formatQuantity(holding.quantity)} />
                <Row label="Value" value={holding.market_value ? formatMoney(holding.market_value, holding.currency) : '—'} />
                <Row label="Cost" value={holding.total_cost_basis ? formatMoney(holding.total_cost_basis, holding.currency) : '—'} />
              </div>
              <p className="xs muted" style={{ marginTop: 12 }}>
                To sell, place a sell order with your own price. A bond cannot be sold at market price.
              </p>
            </Card>
          )}
        </div>

        {needsDisclosure ? (
          <DisclosureGate disclosures={outstanding.data} onDone={outstanding.reload} />
        ) : (
          <BondTicket
            asset={asset}
            quote={quote}
            holding={holding}
            canTrade={canTrade}
            onDone={() => {
              holdings.reload()
              bond.reload()
            }}
          />
        )}
      </div>
    </div>
  )
}

// What the bond pays on a face value, from the coupon and the maturity date.
// Dates run back from maturity in the bond's payment steps. This is an
// illustration: the real calendar comes from the bond's own terms at Bluum.
function Schedule({ asset, bond }) {
  const defaults = { NGN: 5000000, USD: 10000, KES: 500000 }
  const [face, setFace] = useState(String(defaults[asset.currency] || 10000))
  const rows = useMemo(() => {
    if (!bond.maturity_date || !bond.coupon_rate) return []
    const f = Number(face) || 0
    const coupon = (f * Number(bond.coupon_rate)) / 100 / 2
    const out = []
    const d = new Date(bond.maturity_date)
    const now = new Date()
    while (d > now && out.length < 24) {
      out.unshift(new Date(d))
      d.setMonth(d.getMonth() - 6)
    }
    const shown = out.length > 5 ? [...out.slice(0, 3), out.at(-1)] : out
    return shown.map((dt, i) => {
      const last = dt.getTime() === out.at(-1).getTime()
      return { date: dt.toISOString().slice(0, 10), what: last ? 'Coupon and face value' : 'Coupon', amount: last ? coupon + f : coupon }
    })
  }, [face, bond])
  if (!rows.length) return null
  return (
    <Card title={`What you get on ${formatMoney(face || 0, asset.currency, { decimals: 0 })} face value`} flush>
      <div className="card-body" style={{ paddingBottom: 0 }}>
        <Field label={`Face value (${asset.currency})`}>
          <input type="number" min="0" value={face} onChange={(e) => setFace(e.target.value)} style={{ maxWidth: 220 }} />
        </Field>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Payment</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date}><td>{formatDate(r.date)}</td><td>{r.what}</td><td className="num">{formatMoney(r.amount, asset.currency, { decimals: 0 })}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="card-body"><p className="xs muted">Dates and amounts follow from the coupon and the maturity date. Interest is paid into your wallet.</p></div>
    </Card>
  )
}

const Row = ({ label, value }) => (
  <div>
    <div className="muted xs">{label}</div>
    <div style={{ fontWeight: 500 }}>{value}</div>
  </div>
)

function DisclosureGate({ disclosures, onDone }) {
  const [accepted, setAccepted] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const all = disclosures.every((d) => accepted[d.id])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.account.accept(disclosures.map((d) => ({ disclosure_id: d.id, version: d.version })))
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Before your first bond">
      <form onSubmit={submit}>
        <p className="small muted" style={{ marginBottom: 14 }}>
          Bonds carry risks shares do not. Please read this once.
        </p>
        <DisclosureList
          disclosures={disclosures}
          accepted={accepted}
          onToggle={(id) => setAccepted((a) => ({ ...a, [id]: !a[id] }))}
        />
        <ErrorNote error={error} />
        <button className="btn btn-primary btn-block" disabled={busy || !all} style={{ marginTop: 14 }}>
          {busy ? 'Recording…' : 'I understand, continue'}
        </button>
      </form>
    </Card>
  )
}

function BondTicket({ asset, quote, holding, canTrade, onDone }) {
  const b = asset.bond || {}
  const increment = Number(b.min_increment || 1000)

  const [side, setSide] = useState('buy')
  const [face, setFace] = useState(String(increment))
  const [price, setPrice] = useState(String(quote?.last_price || asset.price))
  const [estimate, setEstimate] = useState(null)
  const [workings, setWorkings] = useState(null)
  const [estimateError, setEstimateError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [placed, setPlaced] = useState(null)

  const debouncedFace = useDebounced(face)
  const debouncedPrice = useDebounced(price)

  useEffect(() => {
    if (!(Number(debouncedFace) > 0) || !(Number(debouncedPrice) > 0)) return
    let cancelled = false
    api.bonds
      .estimate({ symbol: asset.symbol, side, quantity: debouncedFace, limit_price: debouncedPrice })
      .then((r) => {
        if (cancelled) return
        setEstimate(r.data)
        setWorkings(r.meta?.workings || null)
        setEstimateError(null)
      })
      .catch((e) => !cancelled && (setEstimate(null), setEstimateError(e)))
    return () => {
      cancelled = true
    }
  }, [debouncedFace, debouncedPrice, side, asset.symbol])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.bonds.place(
        { symbol: asset.symbol, side, quantity: face, limit_price: price },
        newKey(),
      )
      setPlaced(res.data)
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (placed) {
    return (
      <Card title="Order placed">
        <div className="stack">
          <div className="row">
            <span>
              {placed.side === 'buy' ? 'Buy' : 'Sell'} {formatQuantity(placed.quantity)} face value of {placed.symbol}
            </span>
            <StatusPill status={placed.status} />
          </div>
          <p className="small muted">
            Your price was {placed.limit_price}% of face value. The order lasts until the end of today.
          </p>
          <div className="wrap">
            <button className="btn btn-primary" onClick={() => setPlaced(null)}>
              Place another
            </button>
            <Link className="btn btn-outline" to="/orders">
              See my orders
            </Link>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card title={`${side === 'buy' ? 'Buy' : 'Sell'} this bond`}>
      {!canTrade && (
        <div style={{ marginBottom: 14 }}>
          <Notice kind="warn" title="Not yet">
            Your account is not active for trading. <Link to="/open-account">Finish opening it</Link>.
          </Notice>
        </div>
      )}

      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <Segmented
            options={[
              { value: 'buy', label: 'Buy' },
              { value: 'sell', label: 'Sell' },
            ]}
            value={side}
            onChange={setSide}
            label="Buy or sell"
          />
        </div>

        <Field
          label={`Face value (${asset.currency})`}
          hint={
            side === 'sell' && holding
              ? `You hold ${formatQuantity(holding.quantity)}.`
              : `In multiples of ${formatQuantity(increment)}.`
          }
        >
          <input type="number" min={increment} step={increment} value={face} onChange={(e) => setFace(e.target.value)} required />
        </Field>

        <Field label="Your price (% of face value)" hint="Not an amount of money. 99.875 means 99.875% of face value.">
          <input type="number" min="0" max="200" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>

        {workings && (
          <div style={{ margin: '16px 0' }}>
            <div className="kv">
              <span className="muted">Principal</span>
              <span className="num">{formatMoney(workings.principal, asset.currency)}</span>
            </div>
            <div className="kv">
              <span className="muted">Interest built up</span>
              <span className="num">{formatMoney(workings.accrued_interest, asset.currency)}</span>
            </div>
            {estimate && <FeeRows estimate={estimate} currency={asset.currency} formatMoney={formatMoney} />}
          </div>
        )}

        {estimateError && (
          <div style={{ margin: '12px 0' }}>
            <Notice kind="warn">{estimateError.message}</Notice>
          </div>
        )}

        <ErrorNote error={error} />

        <button className="btn btn-primary btn-block" disabled={busy || !canTrade || !estimate}>
          {busy ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} at ${price}%`}
        </button>

        <p className="xs muted" style={{ marginTop: 10 }}>
          Bond orders always have a price you set, and they last for the day only. Settlement is{' '}
          {b.settlement_convention || 'a day or two'} after the trade.
        </p>
      </form>
    </Card>
  )
}
