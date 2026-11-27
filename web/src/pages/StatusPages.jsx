// The Welcome page for signed-out visitors, and the screens for when things
// go wrong: maintenance, update needed, offline and error.

import { Component, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/charts.jsx'

export function Welcome() {
  return (
    <div className="center-page">
      <div className="welcome">
        <img src="/brand/logo-horizontal.svg" alt="Dividendii" height="34" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <h1>Shares and bonds, in plain words.</h1>
        <p className="muted">Buy and sell Nigerian, US and Kenyan shares, bonds and public offers from one account. Every price and fee is shown before you confirm.</p>
        <div className="steps3">
          <div><strong>1</strong><span>Open an account</span></div>
          <div><strong>2</strong><span>Add money</span></div>
          <div><strong>3</strong><span>Buy your first share</span></div>
        </div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/signin">Open an account</Link>
          <Link className="btn btn-outline" to="/signin?mode=in">Sign in</Link>
        </div>
        <p className="xs muted">Investing involves risk. The value of your shares can go down as well as up.</p>
      </div>
    </div>
  )
}

function Screen({ icon, title, children, actions }) {
  return (
    <div className="center-page">
      <div className="status-screen">
        <span className="ico big"><Icon name={icon} size={28} /></span>
        <h1>{title}</h1>
        <p className="muted">{children}</p>
        {actions && <div className="actions" style={{ justifyContent: 'center' }}>{actions}</div>}
      </div>
    </div>
  )
}

export const Maintenance = () => (
  <Screen icon="clock" title="We are doing some maintenance" actions={<button className="btn btn-primary" onClick={() => window.location.assign('/')}>Try again</button>}>
    Dividendii will be back shortly. Your money and holdings are safe, and open orders stay where they are.
  </Screen>
)
export const UpdateNeeded = () => (
  <Screen icon="refresh" title="Please update the app" actions={<button className="btn btn-primary" onClick={() => window.location.reload()}>Update now</button>}>
    A newer version is ready. Update to keep trading safely.
  </Screen>
)
export const Offline = () => (
  <Screen icon="wifi" title="You are offline" actions={<button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>}>
    Check your connection. Nothing you placed has been lost.
  </Screen>
)
export const ErrorScreen = ({ error }) => (
  <Screen icon="alert" title="Something went wrong" actions={<><button className="btn btn-primary" onClick={() => window.location.assign('/')}>Go to Home</button><Link className="btn btn-outline" to="/help/tickets">Tell us</Link></>}>
    We could not show this page. Your money and orders are not affected.
    {error?.message && <span className="xs" style={{ display: 'block', marginTop: 8 }}>{String(error.message).slice(0, 140)}</span>}
  </Screen>
)

export class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() { return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children }
}

// Shows the offline screen whenever the browser loses its connection.
export function OnlineGate({ children }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online ? children : <Offline />
}
