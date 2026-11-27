// The Account screens: summary, statements, fees, profile, security,
// preferences, privacy. Profile and wallets come from the real account; the
// rest run on sample data until each becomes a product (see the open items).

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDate, formatDateTime, formatMoney, formatPercent } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Card, ErrorNote, Field, KV, LinkTabs, Loading, Notice, PageHead, Pill, SampleChip, SampleNote, Row, Toggle, StatusPill, Segmented } from '../components/ui.jsx'

const TABS = [
  { to: '/account', label: 'Summary' },
  { to: '/account/statements', label: 'Statements' },
  { to: '/account/fees', label: 'Fees' },
  { to: '/account/profile', label: 'Profile' },
  { to: '/account/security', label: 'Security' },
  { to: '/account/preferences', label: 'Preferences' },
  { to: '/account/privacy', label: 'Privacy' },
]
const Head = ({ title, sub, children }) => (
  <>
    <PageHead title={title} sub={sub}>{children}</PageHead>
    <LinkTabs items={TABS} />
  </>
)
const WALLET = { NGN: 'Naira wallet', USD: 'US dollar wallet', KES: 'Kenyan shilling wallet' }

// ---------------------------------------------------------------------------
// 32. Summary
// ---------------------------------------------------------------------------
export function AccountSummary() {
  const { user, account, stage, health, isSampleData, refresh } = useSession()
  const profile = useLoad(() => api.extras.profile())
  const wallets = useLoad(() => api.money.wallets())
  const webhooks = useLoad(() => api.webhooks.recent())
  const p = profile.data

  return (
    <div className="stack">
      <Head title="Account" sub="Your details, accounts and the person who looks after you." />
      <div className="split">
        <div className="stack">
          <Card title="Profile">
            <KV k="Name" v={user.name || '—'} />
            <KV k="Email" v={user.email} />
            <KV k="Lives in" v={String(user.country || p?.country || '—').toUpperCase() === 'NG' ? 'Nigeria' : user.country || p?.country || '—'} />
            <KV k="Account number" v={<>{p?.account_number || '—'} <SampleChip /></>} />
            <KV k="Account type" v={p?.account_type || 'Individual'} />
            <KV k="Markets" v={(health?.markets || []).join(' · ') || '—'} />
            <KV k="Status" v={<StatusPill status={stage} />} />
            {account?.investor?.id && <KV k="Bluum reference" v={<span className="xs">{account.investor.id}</span>} />}
            <button className="linkbtn" onClick={refresh}>Check my status again</button>
          </Card>
          <Card title="Wallets">
            {wallets.loading ? <Loading rows={3} /> : (wallets.data || []).map((w) => (
              <KV key={w.id} k={WALLET[w.currency] || w.currency} v={formatMoney(w.available_balance, w.currency)} />
            ))}
          </Card>
          {(isSampleData || health?.bluum_env === 'sandbox') && (
            <Card title="Platform status (testing)">
              <KV k="Bluum" v={`${health?.bluum_mode} · ${health?.bluum_env}`} />
              <KV k="Database" v={health?.database} />
              <KV k="Email" v={health?.mail_mode} />
              <KV k="Webhook secret set" v={health?.webhook_secret_set ? 'Yes' : 'No'} />
              <KV k="Webhooks received" v={webhooks.data ? String(webhooks.data.length) : '—'} />
              {(health?.warnings || []).map((w) => <p className="xs muted mt-sm" key={w}>{w}</p>)}
            </Card>
          )}
        </div>
        <div className="stack">
          <Card title="Your Dividendii contact">
            <div className="list-row"><span className="ico">TA</span><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p?.contact?.name || '—'}</div><div className="xs muted">{p?.contact?.note}</div></div></div>
            <p className="xs muted"><SampleChip /> The named contact is invented.</p>
          </Card>
          <Card title="Quick links">
            <Row to="/account/statements" icon="doc" title="Statements and tax documents" />
            <Row to="/account/fees" icon="scale" title="Fees" />
            <Row to="/account/security" icon="shield" title="Sign-in and security" />
            <Row to="/help" icon="help" title="Help" />
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 33. Statements and documents
// ---------------------------------------------------------------------------
export function Statements() {
  const data = useLoad(() => api.extras.statements())
  const [tab, setTab] = useState('statements')
  const [range, setRange] = useState({ from: '', to: '', format: 'PDF' })
  const [made, setMade] = useState(false)
  const d = data.data
  const lists = { statements: d?.statements, notes: d?.notes, tax: d?.tax }
  const items = lists[tab] || []

  return (
    <div className="stack">
      <Head title={<>Statements and documents <SampleChip /></>} sub="Monthly statements, contract notes and your tax summary." />
      <Segmented value={tab} onChange={setTab} label="Kind" options={[{ value: 'statements', label: 'Statements' }, { value: 'notes', label: 'Contract notes' }, { value: 'tax', label: 'Tax' }]} />
      <div className="split">
        <Card title={tab === 'statements' ? 'Statements' : tab === 'notes' ? 'Contract notes' : 'Tax'}>
          {data.loading ? <Loading rows={4} /> : items.map((i) => (
            <div className="list-row" key={i.id}>
              <span className="ico"><span className="xs" style={{ fontWeight: 700 }}>PDF</span></span>
              <div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{i.title}</div><div className="xs muted">{i.pages ? `PDF · ${i.pages} pages` : formatDate(i.date)}</div></div>
              {tab === 'notes' ? <Link className="btn btn-outline btn-sm" to={`/contract-note/${i.id}`}>Open</Link> : <button className="btn btn-outline btn-sm" onClick={() => window.print()}>Download</button>}
            </div>
          ))}
          <SampleNote>Statements are invented. Real ones need a statement source (see the open items).</SampleNote>
        </Card>
        <div className="stack">
          <Card title="Need a different period?">
            <Field label="From"><input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
            <Field label="To"><input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
            <Field label="Format"><select value={range.format} onChange={(e) => setRange({ ...range, format: e.target.value })}><option>PDF</option><option>CSV</option></select></Field>
            <button className="btn btn-primary btn-block" disabled={!range.from || !range.to} onClick={() => setMade(true)}>Create statement</button>
            {made && <p className="small up mt-sm">We will email it to you when it is ready.</p>}
          </Card>
          <Card title="My documents">
            {(d?.documents || []).map((x) => <div className="list-row" key={x.title}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{x.title}</div><div className="xs muted">{x.note}</div></div></div>)}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 34. Fees
// ---------------------------------------------------------------------------
export function Fees() {
  const fees = useLoad(() => api.extras.fees())
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('850000')
  const [est, setEst] = useState(null)
  const [err, setErr] = useState(null)

  async function show() {
    setErr(null)
    try {
      const r = await api.trade.estimate({ symbol: 'MTNN', side, type: 'market', notional: amount })
      setEst(r.data)
    } catch (e) { setErr(e); setEst(null) }
  }

  return (
    <div className="stack">
      <Head title="Fees" sub="What we charge, in plain words. No fee is hidden in the price." />
      <div className="split">
        <Card title={<>Fee schedule <SampleChip /></>} flush>
          <table>
            <thead><tr><th>What</th><th>Fee</th><th>When</th></tr></thead>
            <tbody>{(fees.data || []).map((f) => <tr key={f.what}><td>{f.what}</td><td><strong>{f.fee}</strong></td><td className="muted">{f.when}</td></tr>)}</tbody>
          </table>
          <div className="card-body"><p className="xs muted">Exchange and regulator charges are shown on every order before you confirm it. Bracketed fees are still to be confirmed.</p></div>
        </Card>
        <Card title="Work out a fee">
          <Segmented value={side} onChange={setSide} label="Side" options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
          <Field label="Amount (NGN)"><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <button className="btn btn-primary btn-block" onClick={show}>Show the fee</button>
          <ErrorNote error={err} />
          {est && (
            <div className="mt">
              <KV k="Amount" v={formatMoney(est.order_value, est.currency)} />
              <KV k="Fee" v={formatMoney(est.total_fees, est.currency)} />
              <div className="kv total"><span>Total</span><span className="num">{formatMoney(est.estimated_total, est.currency)}</span></div>
              <p className="xs muted mt-sm">Worked out by Bluum for a Nigerian share (MTNN).</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 35. Profile
// ---------------------------------------------------------------------------
export function Profile() {
  const { user, refresh } = useSession()
  const profile = useLoad(() => api.extras.profile())
  const [name, setName] = useState(null)
  const [saved, setSaved] = useState(false)
  const p = profile.data
  const value = name ?? user.name ?? ''

  async function save() {
    await api.extras.saveProfile({ name: value })
    await refresh()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="stack">
      <Head title="Profile" sub="Details we hold about you. Changes to name or ID are checked again.">
        <button className="btn btn-primary" onClick={save}>Save changes</button>
        {saved && <span className="small up" style={{ alignSelf: 'center' }}>Saved</span>}
      </Head>
      <div className="split">
        <Card title="Your details">
          <Field label="Full name"><input type="text" value={value} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={user.email} disabled /></Field>
          <div className="grid g2">
            <Field label="Date of birth"><input type="date" disabled value={p?.date_of_birth || ''} /></Field>
            <Field label="Phone"><input type="tel" disabled value={user.phone || ''} placeholder="Held at Bluum" /></Field>
          </div>
          <p className="xs muted">Date of birth, phone, address and tax number are held at Bluum from your application. Editing them here needs a Bluum endpoint (see the open items).</p>
        </Card>
        <Card title="Checks">
          {(p?.checks || []).map((c) => (
            <div className="list-row" key={c.name}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div><div className="xs muted">{c.detail}</div></div><Pill kind={c.status === 'verified' ? 'good' : 'warn'}>{c.status === 'verified' ? 'Verified' : 'Waiting'}</Pill></div>
          ))}
          <SampleNote>The checks list is sample. A real one reads the status Bluum reports for each check.</SampleNote>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 36. Sign-in and security
// ---------------------------------------------------------------------------
export function Security() {
  const sec = useLoad(() => api.extras.security())
  const [busy, setBusy] = useState(false)
  const s = sec.data
  const set = async (patch) => { setBusy(true); await api.extras.saveSecurity(patch).catch(() => {}); setBusy(false); sec.reload() }

  return (
    <div className="stack">
      <Head title="Sign-in and security" sub="Email code only. No password to lose, no SMS to hijack." />
      <div className="split">
        <div className="stack">
          <Card title="Sign-in">
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Email code</div><div className="xs muted">We email a 6-digit code each time you sign in</div></div><Toggle on label="Email code" disabled onChange={() => {}} /></div>
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Email code to withdraw</div><div className="xs muted">Needed before money leaves your account</div></div><Toggle on={s?.settings.withdraw_code} label="Email code to withdraw" disabled={busy || !s} onChange={(v) => set({ withdraw_code: v })} /></div>
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Notify me of new devices</div><div className="xs muted">Email</div></div><Toggle on={s?.settings.new_device} label="Notify of new devices" disabled={busy || !s} onChange={(v) => set({ new_device: v })} /></div>
          </Card>
          <Card title="Recent sign-ins">
            {(s?.recent || []).map((r, i) => <div className="list-row" key={i}><div className="grow">{r.place}</div><span className="xs muted">{formatDateTime(r.at)}</span></div>)}
            <SampleNote>Devices, places and the two switches are sample. The sign-in code itself is real.</SampleNote>
          </Card>
        </div>
        <div className="stack">
          <Card title="Devices">
            {(s?.devices || []).map((d) => (
              <div className="list-row" key={d.id}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{d.name}</div><div className="xs muted">{d.place} · {d.current ? 'now' : formatDateTime(d.last_seen)}{d.current ? ' · this device' : ''}</div></div>{d.current ? <Pill kind="info">This device</Pill> : <button className="btn btn-quiet btn-sm" onClick={async () => { await api.extras.removeDevice(d.id); sec.reload() }}>Remove</button>}</div>
            ))}
          </Card>
          <Card title="Sign out everywhere">
            <p className="small muted" style={{ marginBottom: 10 }}>Ends every other session. You will need a new email code on each device.</p>
            <button className="btn btn-outline btn-block" onClick={async () => { await api.extras.signOutOthers(); sec.reload() }}>Sign out other devices</button>
          </Card>
          <Notice kind="info">We never ask for your PIN or password. If someone does, it is not us.</Notice>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 37. Preferences
// ---------------------------------------------------------------------------
const NOTICES = [['orders', 'Order filled or cancelled'], ['money', 'Money added or withdrawn'], ['offers', 'Offers closing soon'], ['statements', 'Monthly statement'], ['news', 'News about companies I own']]
export function Preferences() {
  const prefs = useLoad(() => api.extras.preferences())
  const [saved, setSaved] = useState(false)
  const p = prefs.data
  const save = async (patch) => { await api.extras.savePreferences(patch); prefs.reload(); setSaved(true); setTimeout(() => setSaved(false), 1800) }

  return (
    <div className="stack">
      <Head title={<>Preferences <SampleChip /></>} sub="How the app looks and what it tells you.">
        {saved && <span className="small up">Saved</span>}
      </Head>
      {!p ? <Loading rows={4} /> : (
        <div className="split">
          <div className="stack">
            <Card title="Notices by email">
              {NOTICES.map(([k, label]) => (
                <div className="list-row" key={k}><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{label}</div><div className="xs muted">Email and in-app</div></div><Toggle on={p.notify[k]} label={label} onChange={(v) => save({ notify: { [k]: v } })} /></div>
              ))}
            </Card>
            <Card title="Trading">
              <Field label="Default order type"><select value={p.default_order_type} onChange={(e) => save({ default_order_type: e.target.value })}><option value="market">Market order</option><option value="limit">Limit order</option></select></Field>
              <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Ask me before I confirm</div><div className="xs muted">Review screens always show the total before you confirm.</div></div><Toggle on disabled label="Ask before confirm" onChange={() => {}} /></div>
            </Card>
          </div>
          <div className="stack">
            <Card title="Display">
              <Field label="Language"><select value={p.language} onChange={(e) => save({ language: e.target.value })}><option>English</option></select></Field>
              <Field label="Home currency"><select value={p.home_currency} onChange={(e) => save({ home_currency: e.target.value })}><option value="NGN">Naira</option><option value="USD">Dollar</option><option value="KES">Shilling</option></select></Field>
              <Field label="Theme"><select value={p.theme} onChange={(e) => save({ theme: e.target.value })}><option>Light</option></select></Field>
              <Field label="Colour for gains"><select value={p.gain_colour} onChange={(e) => save({ gain_colour: e.target.value })}><option>Green up, red down</option></select></Field>
            </Card>
            <Card title="Risk profile">
              <KV k="Your answer" v={p.risk_profile} />
              <p className="xs muted">Last updated {formatDate(p.risk_updated)}</p>
              <Link className="btn btn-outline btn-sm mt-sm" to="/open-account">Review</Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 38. Privacy, data and closing your account
// ---------------------------------------------------------------------------
export function Privacy() {
  const prefs = useLoad(() => api.extras.preferences())
  const [note, setNote] = useState(null)
  const [closing, setClosing] = useState(null)
  const p = prefs.data

  return (
    <div className="stack">
      <Head title={<>Privacy and your data <SampleChip /></>} sub="See what we keep, download it, or close your account." />
      <div className="split">
        <div className="stack">
          <Card title="What we may use your data for">
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Service notices and codes</div><div className="xs muted">Always on</div></div><Toggle on disabled label="Service notices" onChange={() => {}} /></div>
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Tips and product news</div><div className="xs muted">Email</div></div><Toggle on={p?.privacy.tips} label="Tips" disabled={!p} onChange={async (v) => { await api.extras.savePreferences({ privacy: { tips: v } }); prefs.reload() }} /></div>
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Share anonymous usage to improve the app</div></div><Toggle on={p?.privacy.usage} label="Usage" disabled={!p} onChange={async (v) => { await api.extras.savePreferences({ privacy: { usage: v } }); prefs.reload() }} /></div>
          </Card>
          <Card title="Your data">
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Download my data</div><div className="xs muted">A copy of what we hold, by email within 30 days</div></div><button className="btn btn-outline btn-sm" onClick={async () => { await api.extras.exportData(); setNote('We will email you a copy within 30 days.') }}>Request</button></div>
            <div className="list-row"><div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>Privacy policy</div><div className="xs muted">Updated 20 Nov 2026</div></div><Link className="btn btn-outline btn-sm" to="/legal">Read</Link></div>
            {note && <p className="small up mt-sm">{note}</p>}
          </Card>
        </div>
        <Card title="Close my account">
          <p className="small muted" style={{ marginBottom: 12 }}>Before we can close it: sell or move your holdings, withdraw your cash, and cancel open orders. We keep records the law requires.</p>
          {closing ? <Notice kind="warn" title="Still to do">{closing.map((b) => <div key={b}>• {b}</div>)}</Notice> : <button className="btn btn-danger btn-block" onClick={async () => { const r = await api.extras.closeAccount(); setClosing(r.data.blockers) }}>Start closing my account</button>}
          <SampleNote>Starting closure does not close anything yet.</SampleNote>
        </Card>
      </div>
    </div>
  )
}
