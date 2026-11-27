// Money in and out: wallets, bank accounts, deposits, withdrawals, history.
//
// A deposit by manual transfer returns a reference code the customer must put
// on the transfer, and that code expires, so it is shown large and with its
// deadline.

import { useState } from 'react'
import { api, formatMoney, formatDate, formatDateTime, newKey } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Card, Loading, Empty, Notice, ErrorNote, Field, Segmented, StatusPill, Modal } from '../components/ui.jsx'

const CURRENCIES = [
  { value: 'NGN', label: 'Naira' },
  { value: 'USD', label: 'Dollars' },
  { value: 'KES', label: 'Shillings' },
]

const METHODS = [
  { value: 'manual_bank_transfer', label: 'Bank transfer', note: 'You send money from your bank using a reference code.' },
  { value: 'ach', label: 'Direct debit', note: 'We take it from a bank account you have connected.' },
  { value: 'card', label: 'Card', note: 'Pay by debit or credit card.' },
  { value: 'international_wire', label: 'International wire', note: 'From a bank outside the country.' },
]

export { METHODS, CURRENCIES }

export function AddMoney({ sources, deposits, onDone, isSampleData }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [method, setMethod] = useState('manual_bank_transfer')
  const [fundingSource, setFundingSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)

  const chosen = METHODS.find((m) => m.value === method)
  const needsSource = method === 'ach'
  const usable = sources.filter((s) => !s.currency || s.currency === currency)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.money.deposit(
        { amount, currency, method, funding_source_id: needsSource ? fundingSource : undefined },
        newKey(),
      )
      setCreated(res.data)
      setAmount('')
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function markReceived(id) {
    await api.money.simulateDeposit(id).catch(() => {})
    setCreated(null)
    onDone()
    deposits.reload()
  }

  return (
    <div className="split">
      <Card title="Add money">
        <form onSubmit={submit}>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} ({c.value})
                </option>
              ))}
            </select>
          </Field>

          <Field label="How much">
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
          </Field>

          <Field label="How you want to pay" hint={chosen?.note}>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          {needsSource && (
            <Field label="From which account">
              <select value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} required>
                <option value="">Choose an account</option>
                {usable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.bank_name} ending {s.account_mask}
                  </option>
                ))}
              </select>
              {!usable.length && <span className="hint">Add a bank account first, under Bank accounts.</span>}
            </Field>
          )}

          <ErrorNote error={error} />

          <button className="btn btn-primary btn-block" disabled={busy || !amount || (needsSource && !fundingSource)}>
            {busy ? 'Setting it up…' : 'Continue'}
          </button>
        </form>
      </Card>

      <Card title="Money on its way" flush>
        {deposits.loading ? (
          <div className="card-body">
            <Loading rows={3} />
          </div>
        ) : !(deposits.data || []).length ? (
          <Empty title="Nothing pending">Deposits appear here while they are on their way.</Empty>
        ) : (
          <table>
            <tbody>
              {deposits.data.slice(0, 8).map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{formatMoney(d.amount, d.currency)}</strong>
                    <div className="xs muted">
                      {METHODS.find((m) => m.value === d.method)?.label || d.method} · {formatDate(d.created_at)}
                    </div>
                    {d.reference_code && <div className="xs muted">Reference {d.reference_code}</div>}
                  </td>
                  <td className="num">
                    <StatusPill status={d.status} />
                    {isSampleData && d.status === 'pending' && (
                      <div style={{ marginTop: 6 }}>
                        <button className="btn btn-quiet btn-sm" onClick={() => markReceived(d.id)}>
                          Mark received
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {created && (
        <Modal title="How to send your money" onClose={() => setCreated(null)}>
          {created.status === 'completed' ? (
            <Notice kind="good" title="Done">
              {formatMoney(created.amount, created.currency)} is in your wallet.
            </Notice>
          ) : created.bank_details ? (
            <div className="stack">
              <Notice kind="warn" title="Put this reference on the transfer">
                Without it, the money cannot be matched to your account.
              </Notice>

              <div style={{ textAlign: 'center', padding: 16, background: 'var(--panel)', borderRadius: 8 }}>
                <div className="xs muted">Reference</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>{created.reference_code}</div>
              </div>

              <div>
                <div className="kv">
                  <span className="muted">Bank</span>
                  <span>{created.bank_details.bank_name}</span>
                </div>
                <div className="kv">
                  <span className="muted">Account name</span>
                  <span>{created.bank_details.account_name}</span>
                </div>
                <div className="kv">
                  <span className="muted">Account number</span>
                  <span className="num">{created.bank_details.account_number}</span>
                </div>
                <div className="kv total">
                  <span>Amount</span>
                  <span className="num">{formatMoney(created.amount, created.currency)}</span>
                </div>
              </div>

              {created.expires_at && (
                <p className="small muted">
                  Send it before {formatDateTime(created.expires_at)}. After that the reference stops working and you
                  will need a new one.
                </p>
              )}
            </div>
          ) : (
            <Notice kind="info" title="Being set up">
              This deposit is <StatusPill status={created.status} />.
            </Notice>
          )}
        </Modal>
      )}
    </div>
  )
}

export function Withdraw({ sources, wallets, onDone }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [fundingSource, setFundingSource] = useState('')
  const [quote, setQuote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const wallet = wallets.find((w) => w.currency === currency)

  async function getQuote(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.money.quoteWithdrawal({ amount, currency, funding_source_id: fundingSource })
      setQuote(res.data)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.money.withdraw({ amount, currency, funding_source_id: fundingSource }, newKey())
      setDone(res.data)
      setQuote(null)
      setAmount('')
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Withdraw to your bank">
      {done && (
        <div style={{ marginBottom: 16 }}>
          <Notice kind="good" title="On its way">
            {formatMoney(done.amount, done.currency)} is being sent to your bank.
          </Notice>
        </div>
      )}

      <form onSubmit={getQuote} style={{ maxWidth: 420 }}>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.value})
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="How much"
          hint={wallet ? `You have ${formatMoney(wallet.available_balance, currency)} available.` : undefined}
        >
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>

        <Field label="Where it goes">
          <select value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} required>
            <option value="">Choose an account</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.bank_name} ending {s.account_mask}
              </option>
            ))}
          </select>
          {!sources.length && <span className="hint">Add a bank account first, under Bank accounts.</span>}
        </Field>

        <ErrorNote error={error} />

        <button className="btn btn-outline" disabled={busy || !amount || !fundingSource}>
          {busy ? 'Checking…' : 'See the fee'}
        </button>
      </form>

      {quote && (
        <Modal
          title="Confirm your withdrawal"
          onClose={() => setQuote(null)}
          footer={
            <div className="wrap">
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>
                {busy ? 'Sending…' : 'Yes, withdraw'}
              </button>
              <button className="btn btn-quiet" onClick={() => setQuote(null)}>
                Cancel
              </button>
            </div>
          }
        >
          <div className="kv">
            <span className="muted">Amount</span>
            <span className="num">{formatMoney(quote.amount, quote.currency)}</span>
          </div>
          <div className="kv">
            <span className="muted">Fee</span>
            <span className="num">{formatMoney(quote.fee_amount, quote.currency)}</span>
          </div>
          <div className="kv total">
            <span>Taken from your wallet</span>
            <span className="num">{formatMoney(quote.total_amount, quote.currency)}</span>
          </div>
          {quote.minimum_amount && (
            <p className="xs muted" style={{ marginTop: 10 }}>
              The smallest withdrawal is {formatMoney(quote.minimum_amount, quote.currency)}.
            </p>
          )}
        </Modal>
      )}
    </Card>
  )
}

export function BankAccounts({ sources }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ bank_name: '', account_number: '', currency: 'NGN', type: 'bank_account' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.money.addFundingSource(form)
      setAdding(false)
      setForm({ bank_name: '', account_number: '', currency: 'NGN', type: 'bank_account' })
      sources.reload()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Bank accounts"
      action={
        <button className="btn btn-outline btn-sm" onClick={() => setAdding(true)}>
          Add an account
        </button>
      }
    >
      {sources.loading ? (
        <Loading rows={2} />
      ) : !(sources.data || []).length ? (
        <Empty title="No accounts yet">Add one to make deposits and withdrawals easier.</Empty>
      ) : (
        <div className="stack-sm">
          {sources.data.map((s) => (
            <div className="row" key={s.id}>
              <span>
                <strong>{s.bank_name}</strong>
                <span className="muted"> ending {s.account_mask}</span>
                {s.currency && <span className="xs muted"> · {s.currency}</span>}
              </span>
              <StatusPill status={s.status} />
            </div>
          ))}
        </div>
      )}

      {adding && (
        <Modal title="Add a bank account" onClose={() => setAdding(false)}>
          <form onSubmit={submit}>
            <Field label="Bank">
              <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} required />
            </Field>
            <Field label="Account number">
              <input
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                required
                inputMode="numeric"
              />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.value})
                  </option>
                ))}
              </select>
            </Field>
            <ErrorNote error={error} />
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Adding…' : 'Add it'}
            </button>
          </form>
        </Modal>
      )}
    </Card>
  )
}

