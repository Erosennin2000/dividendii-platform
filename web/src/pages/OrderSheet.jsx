// The order sheet: enter, review, confirm. Three steps, one screen.
//
//   /order/:symbol?side=buy&amount=850000   (or qty=100, or limit=98.4)
//
// Every figure on the review step is the estimate Bluum returned for exactly
// what will be sent, so the total on screen is the total that is charged.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, formatMoney, formatPrice, formatQuantity, newKey, signed, signedPct } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Card, ErrorNote, Field, KV, Loading, Notice, Pill, Segmented, useDebounced } from '../components/ui.jsx'
import { Icon } from '../components/charts.jsx'

const STEPS = ['1 · Enter amount', '2 · Review', '3 · Confirmed']

export default function OrderSheet() {
  const { symbol } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { canTrade, stage } = useSession()

  const asset = useLoad(() => api.market.asset(symbol), [symbol])
  const positions = useLoad(() => api.trade.positions())
  const wallets = useLoad(() => api.money.wallets())

  const [step, setStep] = useState(1)
  const [side, setSide] = useState(params.get('side') === 'sell' ? 'sell' : 'buy')
  const [type, setType] = useState(params.get('limit') ? 'limit' : 'market')
  const [mode, setMode] = useState(params.get('qty') ? 'quantity' : 'amount')
  const [amount, setAmount] = useState(params.get('amount') || '')
  const [quantity, setQuantity] = useState(params.get('qty') || '')
  const [limitPrice, setLimitPrice] = useState(params.get('limit') || '')
  const [estimate, setEstimate] = useState(null)
  const [estimateError, setEstimateError] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)
  const [placed, setPlaced] = useState(null)

  const dAmount = useDebounced(amount)
  const dQty = useDebounced(quantity)
  const dLimit = useDebounced(limitPrice)

  const a = asset.data?.asset
  const trading = asset.data?.trading
  const quote = asset.data?.quote
  const holding = (positions.data || []).find((p) => p.symbol === symbol)
  const wallet = (wallets.data || []).find((w) => w.currency === a?.currency)
  const price = Number(quote?.last_price || a?.price || 0)
  const canAmount = side === 'buy' && type === 'market' && trading?.can_buy_by_amount

  // An amount only exists for a market buy, so the mode follows the rules.
  useEffect(() => {
    if (trading && !canAmount && mode === 'amount') setMode('quantity')
  }, [trading, canAmount, mode])

  const body = useMemo(() => {
    const b = { symbol, side, type, time_in_force: 'day' }
    if (mode === 'amount') b.notional = dAmount
    else b.quantity = dQty
    if (type === 'limit') b.limit_price = dLimit
    return b
  }, [symbol, side, type, mode, dAmount, dQty, dLimit])

  useEffect(() => {
    const filled = mode === 'amount' ? Number(dAmount) > 0 : Number(dQty) > 0
    if (!filled || (type === 'limit' && !(Number(dLimit) > 0)) || !a) {
      setEstimate(null)
      setEstimateError(null)
      return
    }
    let live = true
    api.trade
      .estimate(body)
      .then((r) => live && (setEstimate(r.data), setEstimateError(null)))
      .catch((e) => live && (setEstimate(null), setEstimateError(e)))
    return () => { live = false }
  }, [body, a]) // eslint-disable-line react-hooks/exhaustive-deps

  if (asset.loading && !a) return <Loading rows={6} />
  if (asset.error && !a) return <ErrorNote error={asset.error} onRetry={asset.reload} />

  const settled = Number(holding?.settled_quantity || 0)
  const verb = side === 'buy' ? 'Buy' : 'Sell'
  const estShares = mode === 'amount' && Number(amount) > 0 && price ? Number(amount) / price : null

  async function place() {
    setPlacing(true)
    setError(null)
    try {
      const res = await api.trade.place({ ...body, notional: mode === 'amount' ? amount : undefined, quantity: mode === 'amount' ? undefined : quantity, limit_price: type === 'limit' ? limitPrice : undefined }, newKey())
      setPlaced(res.data)
      setStep(3)
      positions.reload()
      wallets.reload()
    } catch (e) {
      setError(e)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link to={`/markets/${symbol}`} className="crumb">← {symbol}</Link>
          <h1>{verb} {symbol}</h1>
          <p>Three steps. Every order is checked before it goes out.</p>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <div className="steps3" aria-label="Steps">
            {STEPS.map((s, i) => (
              <div key={s} className={i + 1 <= step ? 'on' : ''} aria-current={i + 1 === step ? 'step' : undefined}>{s}</div>
            ))}
          </div>

          {!canTrade && (
            <Notice kind="warn" title="You cannot place orders yet">
              Your account is {stage.replace(/_/g, ' ')}. <Link to="/open-account/status">See where it stands</Link>.
            </Notice>
          )}

          {step === 1 && (
            <Card>
              <div className="row" style={{ marginBottom: 12 }}>
                <h2>Order ticket</h2>
                <Pill kind="quiet">{type === 'market' ? 'Market order' : 'Limit order'}</Pill>
              </div>
              <div className="stack-sm">
                <Segmented value={side} onChange={(v) => { setSide(v); setEstimate(null) }} label="Buy or sell" options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
                {trading.order_types.length > 1 && (
                  <Segmented value={type} onChange={setType} label="Order type" options={trading.order_types.map((t) => ({ value: t, label: t === 'market' ? 'At market price' : 'At my price' }))} />
                )}
                {canAmount && (
                  <Segmented value={mode} onChange={setMode} label="How to buy" options={[{ value: 'amount', label: 'By amount' }, { value: 'quantity', label: 'By shares' }]} />
                )}
              </div>

              {mode === 'amount' ? (
                <Field label="Amount to spend" hint={`Available ${wallet ? formatMoney(wallet.available_balance, a.currency) : '—'}`}>
                  <div style={{ position: 'relative' }}>
                    <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
                    <span className="xs muted" style={{ position: 'absolute', right: 12, top: 13 }}>{a.currency}</span>
                  </div>
                </Field>
              ) : (
                <Field
                  label={side === 'sell' ? 'Shares to sell' : 'Number of shares'}
                  hint={side === 'sell' ? `You can sell up to ${formatQuantity(settled)} settled shares.` : trading.min_order_size ? `Smallest order: ${trading.min_order_size}` : undefined}
                >
                  <input type="number" min="0" step={a.fractionable ? '0.000001' : '1'} max={side === 'sell' ? settled || undefined : undefined} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" autoFocus />
                </Field>
              )}

              {type === 'limit' && (
                <Field label={`Your price (${a.currency} per share)`} hint="The order waits until the market reaches it, until the end of the day.">
                  <input type="number" min="0" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={String(price)} />
                </Field>
              )}

              <KV k="Price now" v={formatMoney(price, a.currency)} />
              {estShares !== null && <KV k="Estimated shares" v={`${estShares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares`} />}
              {estimate && <KV k={`Fee (Dividendii and exchange)`} v={formatMoney(estimate.total_fees, a.currency)} />}
              {estimateError && <div className="mt-sm"><Notice kind="warn">{estimateError.message}</Notice></div>}

              <p className="xs muted" style={{ margin: '10px 0 14px' }}>
                {type === 'market' ? 'A market order buys at the best price available. The final price can differ slightly from the one shown.' : 'A limit order only runs at your price or better.'}
              </p>
              <button className="btn btn-primary btn-block" disabled={!estimate || !canTrade} onClick={() => setStep(2)}>Review order</button>
            </Card>
          )}

          {step === 2 && estimate && (
            <Card>
              <h2 style={{ marginBottom: 8 }}>Review your order</h2>
              <KV k={`You are ${side === 'buy' ? 'buying' : 'selling'}`} v={`${symbol} · ${a.name}`} />
              <KV k="Order type" v={type === 'market' ? 'Market order' : `Limit at ${formatMoney(limitPrice, a.currency)}`} />
              <KV k="Amount" v={formatMoney(estimate.order_value, a.currency)} />
              <KV k="Fee" v={formatMoney(estimate.total_fees, a.currency)} />
              <KV k="Estimated shares" v={formatQuantity(estimate.quantity)} />
              <div className="kv total">
                <span>{side === 'buy' ? `Total from your ${a.currency === 'NGN' ? 'naira' : a.currency === 'USD' ? 'dollar' : 'shilling'} wallet` : 'You receive about'}</span>
                <span className="num">{formatMoney(estimate.estimated_total, a.currency)}</span>
              </div>
              <p className="xs muted" style={{ margin: '10px 0 14px' }}>Prices move. If the price changes a lot before your order runs, we will stop and ask you again.</p>
              <ErrorNote error={error} />
              <div className="stack-sm">
                <button className="btn btn-primary btn-block" disabled={placing} onClick={place}>{placing ? 'Placing…' : `Confirm and ${side}`}</button>
                <button className="btn btn-outline btn-block" disabled={placing} onClick={() => setStep(1)}>Back</button>
              </div>
            </Card>
          )}

          {step === 3 && placed && (
            <Card>
              <div className="center pad">
                <div className="check-circle"><Icon name="check" size={30} /></div>
                <h2 style={{ fontSize: 22 }}>{placed.status === 'filled' ? 'Order filled' : 'Order accepted'}</h2>
                <p className="muted" style={{ margin: '8px 0 18px' }}>
                  {placed.status === 'filled' ? 'It filled straight away.' : 'We will tell you in the app and by email when it fills.'}
                </p>
                <div className="wrap" style={{ justifyContent: 'center' }}>
                  <Link className="btn btn-primary" to={`/orders/${placed.id}`}>View order</Link>
                  <button className="btn btn-outline" onClick={() => navigate('/')}>Done</button>
                </div>
                <div className="card" style={{ margin: '20px auto 0', maxWidth: 420, textAlign: 'left' }}>
                  <KV k={placed.side === 'buy' ? 'Bought' : 'Sold'} v={placed.symbol} />
                  <KV k="Amount" v={formatMoney(placed.order_value, placed.currency)} />
                  <KV k="Reference" v={placed.id} />
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="stack">
          <Card title="Your position">
            {holding ? (
              <>
                <KV k="Shares" v={formatQuantity(holding.quantity)} />
                <KV k="Average cost" v={formatMoney(holding.average_cost_basis, a.currency)} />
                <KV k="Total gain" className={Number(holding.unrealized_pl) >= 0 ? 'up' : 'dn'} v={signed(holding.unrealized_pl, a.currency, { decimals: 0 })} />
              </>
            ) : (
              <p className="small muted">You do not own {symbol} yet.</p>
            )}
          </Card>
          <Notice kind="warn">
            <Icon name="warning" size={18} />
            <div>Prices move. If the price changes a lot before your order runs, we stop and ask you again.</div>
          </Notice>
        </div>
      </div>
    </div>
  )
}
