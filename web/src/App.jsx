// Routing and the shell around every screen.
//
// Gates, in this order:
//   not signed in            -> welcome and sign in
//   signed in, no investor   -> open the account
//   investor not yet active  -> the screens load, but the order ticket says
//                               why it cannot be used
// A customer can look around while their identity check is still running.

import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useSession } from './session.jsx'
import { Loading } from './components/ui.jsx'
import { Shell } from './components/shell.jsx'

import SignIn from './pages/SignIn.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Markets from './pages/Markets.jsx'
import Asset from './pages/Asset.jsx'
import OrderSheet from './pages/OrderSheet.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import ContractNote from './pages/ContractNote.jsx'
import Portfolio from './pages/Portfolio.jsx'
import Holding from './pages/Holding.jsx'
import Goals from './pages/Goals.jsx'
import Rebalance from './pages/Rebalance.jsx'
import AutoInvest from './pages/AutoInvest.jsx'
import Portfolios from './pages/Portfolios.jsx'
import Bonds from './pages/Bonds.jsx'
import BondDetail from './pages/BondDetail.jsx'
import Maturities from './pages/Maturities.jsx'
import Offers from './pages/Offers.jsx'
import OfferDetail from './pages/OfferDetail.jsx'
import Money, { MoneyAccounts, MoneyMove, Transactions } from './pages/MoneyPages.jsx'
import Gifts from './pages/Gifts.jsx'
import { AccountSummary, Fees, Preferences, Privacy, Profile, Security, Statements } from './pages/AccountPages.jsx'
import { Help, Learn, Legal, Tickets } from './pages/HelpPages.jsx'
import { Fund, News, Notifications, Search, Watchlist } from './pages/DiscoverPages.jsx'
import { ErrorBoundary, ErrorScreen, Maintenance, OnlineGate, UpdateNeeded, Welcome, Offline } from './pages/StatusPages.jsx'

const ToAsset = () => {
  const { symbol } = useParams()
  return <Navigate to={`/markets/${symbol}`} replace />
}

export default function App() {
  const { user, loading, stage } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="main" style={{ paddingTop: 48 }}>
        <Loading rows={4} />
      </div>
    )
  }

  // Status screens are reachable signed out, so they can be checked on their own.
  if (location.pathname.startsWith('/status/')) {
    const which = location.pathname.split('/')[2]
    const screens = { maintenance: <Maintenance />, update: <UpdateNeeded />, offline: <Offline />, error: <ErrorScreen /> }
    return screens[which] || <Navigate to="/" replace />
  }

  if (!user) {
    return location.pathname === '/signin' ? <SignIn /> : <Welcome />
  }

  // The account has to exist at Bluum before any screen has anything to show.
  if (stage === 'not_started' && !location.pathname.startsWith('/open-account')) {
    return <Navigate to="/open-account" replace />
  }

  return (
    <OnlineGate>
        <Shell>
          <ErrorBoundary key={location.pathname}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/signin" element={<Navigate to="/" replace />} />
              <Route path="/open-account" element={<Onboarding />} />
              <Route path="/open-account/status" element={<Onboarding />} />
              <Route path="/search" element={<Search />} />
              <Route path="/notifications" element={<Notifications />} />

              <Route path="/markets" element={<Markets />} />
              <Route path="/markets/:symbol" element={<Asset />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/news" element={<News />} />
              <Route path="/funds/:symbol" element={<Fund />} />
              <Route path="/assets/:symbol" element={<ToAsset />} />

              <Route path="/order/:symbol" element={<OrderSheet />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/contract-note/:id" element={<ContractNote />} />

              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/portfolio/:symbol" element={<Holding />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/rebalance" element={<Rebalance />} />
              <Route path="/auto-invest" element={<AutoInvest />} />
              <Route path="/collections" element={<Portfolios />} />
              <Route path="/portfolios" element={<Navigate to="/collections" replace />} />

              <Route path="/bonds" element={<Bonds />} />
              <Route path="/bonds/:symbol" element={<BondDetail />} />
              <Route path="/maturities" element={<Maturities />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/offers/:id" element={<OfferDetail />} />

              <Route path="/money" element={<Money />} />
              <Route path="/money/move" element={<MoneyMove />} />
              <Route path="/money/accounts" element={<MoneyAccounts />} />
              <Route path="/money/transactions" element={<Transactions />} />
              <Route path="/gifts" element={<Gifts />} />

              <Route path="/account" element={<AccountSummary />} />
              <Route path="/account/statements" element={<Statements />} />
              <Route path="/account/fees" element={<Fees />} />
              <Route path="/account/profile" element={<Profile />} />
              <Route path="/account/security" element={<Security />} />
              <Route path="/account/preferences" element={<Preferences />} />
              <Route path="/account/privacy" element={<Privacy />} />

              <Route path="/help" element={<Help />} />
              <Route path="/help/tickets" element={<Tickets />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/legal" element={<Legal />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </Shell>
    </OnlineGate>
  )
}
