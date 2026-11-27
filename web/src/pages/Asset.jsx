// One share or ETF: price, chart, key numbers, an order ticket and your
// position.
//
// What the ticket may offer comes from the asset itself: buying by amount
// only appears when the asset can be held in fractions, and a sale is limited
// to the settled part of the holding, because an unsettled sale is refused
// by Bluum with BLUM-400-017. The full three-step order sheet is /order/:symbol.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, formatMoney, formatPrice, formatQuantity, formatShort, signed, signedPct, tone } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Bars, LineChart } from '../components/charts.jsx'
import { Card, ErrorNote, KV, Loading, Notice, Pill, Ranges, SampleChip, Segmented, useDebounced } from '../components/ui.jsx'
import { useUi } from '../components/shell.jsx'

const BARS = { '1D': 24, '1W': 7, '1M': 30, '3M': 90, '1Y': 250, '5Y': 300 }

export default function Asset() {
  const { symbol } = useParams()
  const navigate = useNavigate()
  const ui = useUi()
  const [range, setRange] = useState('1M')

  const asset = useLoad(() => api.market.asset(symbol), [symbol])
  const bars = useLoad(() => api.market.bars(symbol, BARS[range]), [symbol, range])
  const positions = useLoad(() => api.trade.positions(), [symbol])
  const wallets = useLoad(() => api.money.wallets())
  const news = useLoad(() => api.extras.news(symbol), [symbol])

  useEffect(() => ui?.select(symbol), [symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo(() => {
    const b = bars.data || []
    if (!b.length) return null
    const last = b.at(-1)
    return {
      points: b.map((x) => ({ t: x.t, v: Number(x.c) })),
      open: Number(last.o),
      high: Number(last.h),
      low: Number(last.l),
      volume: Number(last.v),
    }
  }, [bars.data])

  // The first load replaces the page; a later refresh keeps what is on
  // screen so a half-typed order is not thrown away.
  if (asset.loading && !asset.data) return <Loading rows={6} />
  if (asset.error && !asset.data) return <ErrorNote error={asset.error} onRetry={asset.reload} />

  const { asset: a, quote, market, trading } = asset.data
  const holding = (positions.data || []).find((p) => p.symbol === a.symbol)
  const wallet = (wallets.data || []).find((w) => w.currency === a.currency)
  const price = Number(quote?.last_price || a.price)
  const change = Number(quote?.change || 0)
  const pct = Number(quote?.change_percent || 0)
  const shown = model?.points?.length ? model.points : null
  const rangeChange = shown ? shown.at(-1).v - shown[0].v : 0

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link to="/markets" className="crumb">← Markets</Link>
          <h1>{a.symbol}</h1>
          <p>
            {a.name} · {market?.name || String(a.country || '').toUpperCase()}
            {a.class === 'etf' ? ' · ETF' : ''}
          </p>
        </div>
        <div className="actions">
          <Link className="btn btn-danger" to={`/order/${a.symbol}?side=sell`}>Sell</Link>
          <Link className="btn btn-primary" to={`/order/${a.symbol}?side=buy`}>Buy</Link>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <Card>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 16 }}>
                  {a.symbol} <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>{a.name}</span>
                </div>
                <div className="bignum">{formatMoney(price, a.currency)}</div>
                <div className={`small ${tone(change)}`}>
                  {signed(change, a.currency)} ({signedPct(pct)}) <span className="muted">today</span>
                </div>
              </div>
              <div className="small muted right">
                {quote?.bid_price && <div>Bid {formatPrice(quote.bid_price)} · Ask {formatPrice(quote.ask_price)}</div>}
                {market && (
                  <div className="xs">
                    {market.hours}
                    {!market.hours_confirmed && ' (not confirmed by Bluum)'}
                  </div>
                )}
                {a.tradable === false && <Pill kind="bad">Not trading</Pill>}
              </div>
            </div>
          </Card>

          <Card>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <h2>Price</h2>
              <Ranges value={range} onChange={setRange} options={['1D', '1W', '1M', '3M', '1Y', '5Y']} />
            </div>
            <div style={{ marginTop: 10 }}>
              {bars.loading && !shown ? <Loading rows={4} /> : shown ? (
                <>
                  <LineChart points={shown} height={230} format={(n) => formatPrice(n, n >= 1000 ? 0 : 2)} label={`${a.symbol} price`} />
                  <p className={`xs ${tone(rangeChange)}`} style={{ marginTop: 6 }}>
                    {signed(rangeChange, a.currency)} over this range
                  </p>
                </>
              ) : (
                <p className="small muted">No price history yet.</p>
              )}
            </div>
          </Card>

          <Card title="Key numbers">
            <div className="grid g2" style={{ columnGap: 32 }}>
              <div>
                <KV k="Open" v={model ? formatPrice(model.open) : '—'} />
                <KV k="Day low" v={model ? formatPrice(model.low) : '—'} />
                <KV k="Market cap" v={<>{'—'} <SampleChip /></>} />
              </div>
              <div>
                <KV k="Day high" v={model ? formatPrice(model.high) : '—'} />
                <KV k="Volume" v={model ? model.volume.toLocaleString() : '—'} />
                <KV k="Dividend yield" v={<>3.8% <SampleChip /></>} />
              </div>
            </div>
          </Card>

          <Card title={<>Dividends paid per share <SampleChip /></>}>
            <Bars
              items={[2022, 2023, 2024, 2025, 2026].map((y, i) => ({
                label: y,
                value: [14, 18, 22, 28, 31][i],
                display: `${a.currency === 'NGN' ? '₦' : a.currency === 'USD' ? '$' : 'KSh'}${[14, 18, 22, 28, 31][i]}`,
              }))}
            />
          </Card>

          <Card title={`About ${a.name}`}>
            <p>
              {market?.name ? `Listed on ${market.name}.` : ''}{' '}
              {holding ? `You own ${formatQuantity(holding.quantity)} ${a.class === 'etf' ? 'units' : 'shares'} worth ${formatMoney(holding.market_value, a.currency, { decimals: 0 })}.` : 'You do not own this yet.'}
            </p>
            {(news.data || []).length > 0 && (
              <div className="mt">
                <h3 style={{ marginBottom: 6 }}>In the news</h3>
                {news.data.map((n) => (
                  <div className="kv" key={n.id}><span>{n.title}</span><span className="xs muted">{n.tag}</span></div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Ticket asset={a} price={price} trading={trading} holding={holding} wallet={wallet} onReview={(q) => navigate(`/order/${a.symbol}?${q}`)} />

          {holding && (
            <Card title="Your position">
              <KV k={a.class === 'etf' ? 'Units' : 'Shares'} v={formatQuantity(holding.quantity)} />
              <KV k="Average cost" v={holding.average_cost_basis ? formatMoney(holding.average_cost_basis, a.currency) : '—'} />
              <KV
                k="Total gain"
                className={tone(holding.unrealized_pl)}
                v={`${signed(holding.unrealized_pl, a.currency, { decimals: 0 })}${Number(holding.total_cost_basis) ? ` (${signedPct((Number(holding.unrealized_pl) / Number(holding.total_cost_basis)) * 100, 1)})` : ''}`}
              />
              {Number(holding.settled_quantity) < Number(holding.quantity) && (
                <div style={{ marginTop: 10 }}>
                  <Notice kind="info" title="Some of this has not settled">
                    You can sell {formatQuantity(holding.settled_quantity)} of {formatQuantity(holding.quantity)} today.
                  </Notice>
                </div>
              )}
              <p className="mt-sm"><Link to={`/portfolio/${a.symbol}`} className="small" style={{ fontWeight: 600 }}>See this holding in detail</Link></p>
            </Card>
          )}

          <Card title={<>Market depth <SampleChip /></>}>
            {[0, 1, 2].map((i) => (
              <div className="kv" key={i}>
                <span className="muted">{[8200, 12500, 5300][i].toLocaleString()} at {formatPrice(price - 0.5 * i)}</span>
                <span className="num" style={{ fontWeight: 600 }}>{formatPrice(price + 0.5 * (i + 0.0))} · {[6400, 9100, 11800][i].toLocaleString()}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Ticket({ asset, price, trading, holding, wallet, onReview }) {
  const { canTrade, stage } = useSession()
  const [side, setSide] = useState(new URLSearchParams(window.location.search).get('side') === 'sell' ? 'sell' : 'buy')
  const byAmount = side === 'buy' && trading.can_buy_by_amount
  const [value, setValue] = useState('')
  const dv = useDebounced(value)
  const [est, setEst] = useState(null)

  useEffect(() => {
    if (!(Number(dv) > 0)) return setEst(null)
    let live = true
    const body = { symbol: asset.symbol, side, type: 'market', time_in_force: 'day' }
    if (byAmount) body.notional = dv
    else body.quantity = dv
    api.trade.estimate(body).then((r) => live && setEst(r.data)).catch(() => live && setEst(null))
    return () => { live = false }
  }, [dv, side, byAmount, asset.symbol])

  const estShares = byAmount && Number(value) > 0 && price ? Number(value) / price : null

  return (
    <Card>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2>Order ticket</h2>
        <Pill kind="quiet">Market order</Pill>
      </div>
      <Segmented value={side} onChange={(s) => { setSide(s); setValue('') }} label="Buy or sell" options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
      <label className="field" style={{ marginTop: 12, marginBottom: 6 }}>
        <span>{byAmount ? 'Amount to spend' : side === 'sell' ? 'Shares to sell' : 'Number of shares'}</span>
        <div style={{ position: 'relative' }}>
          <input type="number" min="0" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={byAmount ? '850000' : '100'} />
          <span className="xs muted" style={{ position: 'absolute', right: 12, top: 12 }}>{byAmount ? asset.currency : ''}</span>
        </div>
      </label>
      {side === 'buy' ? (
        <p className="xs muted" style={{ marginBottom: 10 }}>Available {wallet ? formatMoney(wallet.available_balance, asset.currency) : '—'}</p>
      ) : (
        <p className="xs muted" style={{ marginBottom: 10 }}>You can sell {formatQuantity(holding?.settled_quantity || 0)}</p>
      )}
      <KV k="Price now" v={formatMoney(price, asset.currency)} />
      {estShares !== null && <KV k="Estimated shares" v={`${estShares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares`} />}
      {est && <KV k="Fee" v={formatMoney(est.total_fees, asset.currency)} />}
      <p className="xs muted" style={{ margin: '8px 0 12px' }}>A market order buys at the best price available. The final price can differ slightly from the one shown.</p>
      <button
        className="btn btn-primary btn-block"
        disabled={!(Number(value) > 0) || !canTrade}
        onClick={() => onReview(`side=${side}&${byAmount ? 'amount' : 'qty'}=${encodeURIComponent(value)}`)}
      >
        Review order
      </button>
      {!canTrade && <p className="xs muted" style={{ marginTop: 8 }}>Trading opens when your account is approved (now: {stage.replace(/_/g, ' ')}).</p>}
    </Card>
  )
}
