// The frame around every signed-in screen: the Ink sidebar, the search and
// market-status bar, the ticker, and the watchlist with the quick order box.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api, formatPrice, formatShort, signedPct, tone } from '../api.js'
import { useLoad, useSession } from '../session.jsx'
import { Icon, Spark } from './charts.jsx'
import { Segmented, useDebounced } from './ui.jsx'

// ---------------------------------------------------------------------------
// What the frame shares with the screens inside it
// ---------------------------------------------------------------------------
const UiContext = createContext(null)
export const useUi = () => useContext(UiContext)

export function UiProvider({ children }) {
  const [selected, setSelected] = useState(null)
  const [tick, setTick] = useState(0)
  const watch = useLoad(() => api.extras.watchlist(), [tick])
  const notes = useLoad(() => api.extras.notifications(), [tick])

  // Until someone picks a company, the quick order follows the first one on the list.
  const symbol = selected || watch.data?.[0]?.symbol || null

  const value = useMemo(
    () => ({
      symbol,
      select: setSelected,
      watch: watch.data || [],
      watchLoading: watch.loading,
      reloadWatch: () => setTick((t) => t + 1),
      unread: notes.meta?.unread || 0,
      reloadNotes: () => setTick((t) => t + 1),
    }),
    [symbol, watch.data, watch.loading, notes.meta],
  )
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/markets', label: 'Markets', icon: 'markets', also: ['/watchlist', '/news', '/funds'] },
  { to: '/portfolio', label: 'Portfolios', icon: 'portfolio', also: ['/goals', '/rebalance', '/auto-invest', '/collections', '/portfolios'] },
  { to: '/bonds', label: 'Bonds', icon: 'bonds', also: ['/maturities'] },
  { to: '/offers', label: 'Public offers', icon: 'offers' },
  { to: '/orders', label: 'Orders', icon: 'orders', also: ['/order', '/contract-note'] },
  { to: '/money', label: 'Money', icon: 'money' },
  { to: '/gifts', label: 'Gifts', icon: 'gifts' },
  { to: '/account', label: 'Account', icon: 'account', also: ['/help', '/learn', '/legal'] },
]

function Sidebar() {
  const { pathname } = useLocation()
  const isOn = (item) =>
    item.end ? pathname === '/' : [item.to, ...(item.also || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`))
  return (
    <aside className="sidebar" aria-label="Main">
      <Link className="brand" to="/" aria-label="Dividendii home">
        <img src="/brand/logo-reversed.svg" alt="Dividendii" />
      </Link>
      <nav className="nav-list">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={`nav-item ${isOn(item) ? 'active' : ''}`}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-help">
        <strong>Need a hand?</strong>
        Talk to us from <Link to="/help">Help</Link>. We reply by email.
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Top bar: search, market hours, notifications, the person
// ---------------------------------------------------------------------------
function Topbar() {
  const { user, signOut } = useSession()
  const ui = useUi()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ticker = useLoad(() => api.extras.ticker())
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const initials =
    (user?.name || user?.email || '?')
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join('') || '?'

  const submit = (e) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <>
      <div className="topbar">
        <form className="searchbox" onSubmit={submit} role="search">
          <Icon name="search" size={17} />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a company or bond" aria-label="Search" />
        </form>
        <div className="mkt-status" aria-label="Market hours">
          {(ticker.data?.markets || []).map((m) => (
            <span key={m.code}>
              <i className={`dot ${m.open ? 'on' : ''}`} />
              {m.name} {m.open ? 'open' : 'closed'}
            </span>
          ))}
        </div>
        <Link to="/notifications" className="icon-btn" aria-label={`Notifications${ui.unread ? `, ${ui.unread} new` : ''}`}>
          <Icon name="bell" />
          {ui.unread > 0 && <span className="badge">{ui.unread}</span>}
        </Link>
        <div className="avatar-wrap" ref={menuRef}>
          <button className="avatar" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Your account menu">
            {initials}
          </button>
          {open && (
            <div className="menu" role="menu" onClick={() => setOpen(false)}>
              <div className="who">{user?.name || user?.email}</div>
              <Link to="/account">Account</Link>
              <Link to="/account/security">Sign-in and security</Link>
              <Link to="/help">Help</Link>
              <button onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
      <Ticker data={ticker.data} />
    </>
  )
}

function Ticker({ data }) {
  const { isSampleData } = useSession()
  if (!data) return <div className="ticker">&nbsp;</div>
  return (
    <div className="ticker" aria-label="Indexes">
      {data.indexes.map((i) => (
        <span key={i.code}>
          {i.name}
          <b>{Number(i.value).toLocaleString('en-NG')}</b>
          <span className={tone(i.change_pct)}>{signedPct(i.change_pct, 1)}</span>
        </span>
      ))}
      <span>
        {data.fx.pair}
        <b>{formatPrice(data.fx.value)}</b>
      </span>
      {isSampleData && <span className="tag">Sample data</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Watchlist column and the quick order box
// ---------------------------------------------------------------------------
function Watch() {
  const ui = useUi()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [results, setResults] = useState([])

  useEffect(() => {
    let live = true
    if (!dq.trim()) return setResults([])
    api.market
      .assets({ q: dq, class: 'equity,etf', limit: 6 })
      .then((r) => live && setResults(r.data || []))
      .catch(() => live && setResults([]))
    return () => {
      live = false
    }
  }, [dq])

  const add = async (symbol) => {
    await api.extras.addWatch(symbol).catch(() => {})
    setQ('')
    setResults([])
    ui.reloadWatch()
  }
  const remove = async (symbol) => {
    await api.extras.removeWatch(symbol).catch(() => {})
    ui.reloadWatch()
  }

  return (
    <aside className="watch" aria-label="Watchlist">
      <div className="watch-head">
        <h2>Watchlist</h2>
        <button className="linkbtn xs" onClick={() => setEditing((e) => !e)} style={{ textDecoration: 'none', fontWeight: 600 }}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <div className="watch-search">
        <Icon name="search" size={15} />
        <input type="text" placeholder="Search to add" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search to add to watchlist" />
        {results.length > 0 && (
          <div className="watch-results">
            {results.map((a) => (
              <button key={a.symbol} onClick={() => add(a.symbol)}>
                <span>
                  <strong>{a.symbol}</strong> <span className="muted">{a.name}</span>
                </span>
                <Icon name="plus" size={14} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="watch-list">
        {ui.watchLoading && !ui.watch.length ? (
          <div className="pad">
            <div className="skeleton" style={{ width: '90%' }} />
          </div>
        ) : !ui.watch.length ? (
          <p className="pad small muted">Search above to follow a company.</p>
        ) : (
          ui.watch.map((r) => (
            <div key={r.symbol}>
              <button
                className={`wrow ${r.symbol === ui.symbol ? 'sel' : ''}`}
                onClick={() => (editing ? null : (ui.select(r.symbol), navigate(`/markets/${r.symbol}`)))}
                aria-label={`${r.symbol}, ${formatPrice(r.price)}, ${signedPct(r.change_pct)}`}
              >
                <span>
                  <div className="sym">{r.symbol}</div>
                  <div className="cur">{r.currency}</div>
                </span>
                <Spark values={r.spark} width={56} height={22} />
                <span>
                  <div className="px">{formatPrice(r.price)}</div>
                  <div className={`chg ${tone(r.change_pct)}`}>{signedPct(r.change_pct)}</div>
                </span>
              </button>
              {editing && (
                <div style={{ textAlign: 'right', padding: '0 14px 6px' }}>
                  <button className="linkbtn xs" style={{ color: 'var(--bad)' }} onClick={() => remove(r.symbol)}>
                    Remove {r.symbol}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <QuickOrder />
    </aside>
  )
}

function QuickOrder() {
  const ui = useUi()
  const navigate = useNavigate()
  const [side, setSide] = useState('buy')
  const [qty, setQty] = useState('100')
  const row = ui.watch.find((r) => r.symbol === ui.symbol)
  const total = row ? Number(row.price) * (Number(qty) || 0) : 0

  return (
    <div className="quick">
      <div className="quick-head">
        <h2>Quick order</h2>
        <span className="xs muted">{ui.symbol || ''}</span>
      </div>
      <Segmented
        label="Buy or sell"
        value={side}
        onChange={setSide}
        options={[
          { value: 'buy', label: 'Buy' },
          { value: 'sell', label: 'Sell' },
        ]}
      />
      <label htmlFor="qo-qty">Number of shares</label>
      <input id="qo-qty" type="number" min="0" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
      <div className="kvx">
        <span>Price</span>
        <b>{row ? `${row.currency} ${formatPrice(row.price)}` : '—'}</b>
      </div>
      <div className="kvx">
        <span>{side === 'buy' ? 'You pay about' : 'You get about'}</span>
        <b>{row ? `${row.currency} ${formatPrice(total)}` : '—'}</b>
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={!ui.symbol || !(Number(qty) > 0)}
        onClick={() => navigate(`/order/${ui.symbol}?side=${side}&qty=${encodeURIComponent(qty)}`)}
      >
        Review order
      </button>
      <p className="fine">You see the full cost before you confirm.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------
const NO_WATCH = ['/watchlist']

export function Shell({ children }) {
  const { isSampleData, health } = useSession()
  const { pathname } = useLocation()
  const noWatch = NO_WATCH.includes(pathname)
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <UiProvider>
      <div className={`app ${noWatch ? 'no-watch' : ''}`}>
        <Sidebar />
        <div className="main-col">
          <Topbar />
          <main className="content" id="main">
            {children}
          </main>
          <footer className="foot">
            <span>
              {isSampleData ? 'Sample data. Prices, balances and names are not real.' : 'Brokerage, custody and clearing are provided by Bluum Finance.'}{' '}
              Markets: {(health?.markets || []).join(', ') || '—'}.
            </span>
            <span>Dividendii Investments · Investing involves risk. Values can go down as well as up.</span>
          </footer>
        </div>
        {!noWatch && <Watch />}
      </div>
    </UiProvider>
  )
}

export { formatShort }
