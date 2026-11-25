# Dividendii Investments

A trading platform built on the Bluum Finance API: shares and ETFs in Nigeria,
the United States and Kenya, public offers, bonds, curated portfolios and
gifting.

It runs today without a Bluum key. Everything is answered from built-in sample
data until the key is set, so the whole thing can be used, shown and tested
now.

## Run it

You need Node 20 or newer.

```bash
npm install --workspaces --include-workspace-root
cp server/.env.example server/.env
npm run dev
```

Then open http://localhost:5173.

Sign in with any email address. The six-digit code is printed in the server's
log and also shown on the screen, because email is not connected yet.

## What is in here

```
server/     the API. Holds the Bluum key, decides what is allowed.
  src/bluum/      the Bluum adapter: client, endpoints, mock, tokens, signature
  src/routes/     auth, account, money, market, trade, bonds, offerings,
                  portfolios, gifts, webhooks, dev
  src/db/         schema and the database layer
  test/smoke.mjs  46 checks, end to end

web/        the screens. React and Vite, in the Dividendii brand.
  src/pages/      sign in, onboarding, home, markets, asset, bonds, offers,
                  portfolios, orders, money, gifts, account
  test/walk-screens.py  opens every screen in a real browser

docs/       HOSTING.md, WHATS_MISSING.md, BLUUM_EMAIL.md
```

The browser never talks to Bluum. It talks to this server, which holds the key.

## Testing

```bash
node server/src/index.js          # one terminal
node server/test/smoke.mjs        # another: 46 end-to-end checks
python3 web/test/walk-screens.py  # opens every screen, screenshots each one
```

The smoke test checks the rules that matter, not only that pages load: that an
unsettled sell is refused, that a bond cannot be bought at market price, that
applying for an offer holds cash rather than spending it, that the same
idempotency key does not pay twice, and that a webhook with a bad signature is
refused but still recorded.

## Deploying

`vercel.json` sets this up as one Vercel project with two services, the API at
`/api/*` and the screens at `/*`, on one domain. Read `docs/VERCEL.md` first:
serverless changes two things that matter, and the sample data does not
survive it.

## Connecting Bluum

1. Get a **sandbox** key from Bluum and put it in `server/.env`:
   ```
   BLUUM_MODE=live
   BLUUM_API_KEY=...
   BLUUM_API_SECRET=...
   BLUUM_WEBHOOK_SECRET=...
   ```
2. Give Bluum a public webhook URL ending `/api/webhooks/bluum`, and ask them
   to send the events listed in `server/src/routes/webhooks.js`.
3. Restart. `GET /api/health` says which mode it is in.

Never put a production key in a developer's `.env`. Production also needs
`BLUUM_ALLOW_PRODUCTION=true`, deliberately, so it cannot happen by accident.

## A real database

Without `DATABASE_URL` the server keeps everything in memory and loses it on
restart, which is fine for trying things out. For anything else:

```bash
export DATABASE_URL=postgres://user:password@host:5432/dividendii
npm run migrate --workspace server
```

The database holds only what Bluum does not: logins, one-time codes, a record
of KYC documents handled, gifts, webhook events and an audit trail. Money,
holdings and orders are read from Bluum, so there is one source of truth.

## Decisions this build follows

| Decision | Where it shows |
| --- | --- |
| Nigeria, the United States and Kenya at launch | `MARKETS` in `server/src/config.js` |
| Market orders for shares, limit orders for bonds | the order tickets; Bluum refuses anything else for bonds |
| Email one-time codes, no SMS | `server/src/routes/auth.js` |
| Partner-managed KYC | `server/src/routes/account.js`; files are passed to Bluum and not kept |
| Fractional buying wherever Bluum allows it | the "by amount" option on the ticket |
| Gifting only, no round-ups | `server/src/routes/gifts.js` |
| A recipient must already have an account | the gift form refuses an unknown address |
| Dividendii branding | `web/src/brand-tokens.css`, from the brand pack |

## What is not finished

See `docs/WHATS_MISSING.md`. The short version: gifts cannot be paid for until
Bluum says how one customer funds another, and several demo features (dividend
recovery, insurance, trusts, lending) are not in this build at all because the
Bluum API cannot power them.
