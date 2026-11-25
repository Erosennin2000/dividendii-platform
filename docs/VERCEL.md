# Deploying to Vercel

`vercel.json` in the repo root sets this up as one Vercel project with two
services: the Express API and the React screens, on one domain.

```
/api/*   ->  server   (Express, becomes one serverless function)
/*       ->  web      (the built React screens, served as files)
```

The service receives the path unchanged, so `/api/trade/orders` arrives at the
server as `/api/trade/orders`. The routes already mount under `/api`, so
nothing in the code had to move.

## No bindings are needed

Vercel's prompt suggests adding bindings. A binding is for one service calling
another from its own server-side code. That does not happen here: the screens
are a plain single-page app, so every `/api/...` call is made by the
customer's browser and goes through the public rewrite above. The server calls
Bluum, which is outside Vercel entirely.

If a server-rendered frontend is ever added, that is when a binding would be
needed.

## What changed in the code for this

| Change | Why |
| --- | --- |
| `server/src/index.js` exports the app and only calls `listen` when not on Vercel | Vercel runs the exported app as a function. Locally it is still an ordinary server. |
| The database connects on the first request, not when the file loads | A function loads the module first and gets a request afterwards. |
| The webhook handler finishes its work **before** answering | A function can be frozen the moment it responds. Work started after the response would never run. A failure now answers 500 so Bluum retries, and the stored event means a retry is not processed twice. |
| Uploads are capped at 4 MB | A Vercel request body cannot exceed about 4.5 MB. On your own server this can be raised. |
| Warnings when running serverless without a database, or on sample data | See the next section. |

## Two things to know before you trust what you see

**1. Sample data will behave strangely on Vercel.** With no Bluum key the
server answers from a sample service held in memory. A serverless function
does not keep memory between requests: each one may start a fresh copy. So a
holding can appear, then vanish on the next page. The platform is not broken;
there is simply nowhere for the sample data to live.

For a demo that holds together, use a real Bluum sandbox key, or run it
locally with `npm run dev`, where it behaves exactly as it should.

**2. Add a database before anyone signs in.** Without `DATABASE_URL`, logins,
gifts and webhook records are kept in memory and disappear the same way. Add a
Postgres database (Vercel's own, Neon or Supabase all work), then run the
migration once:

```bash
DATABASE_URL="postgres://..." npm run migrate --workspace server
```

## Settings to add in Vercel

Project settings, Environment Variables. The same names as `server/.env.example`:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | your Postgres URL |
| `SESSION_SECRET` | a long random string, different from the local one |
| `BLUUM_MODE` | `mock` until you have a key, then `live` |
| `BLUUM_API_KEY`, `BLUUM_API_SECRET` | sandbox only, to begin with |
| `BLUUM_WEBHOOK_SECRET` | from Bluum, once the webhook is registered |
| `MAIL_MODE`, `SMTP_*`, `MAIL_FROM` | `console` until SMTP exists, and sign-in codes then appear in the Vercel logs instead of an inbox |
| `KYC_STORAGE` | leave as `forward-only` |

Nothing beginning `VITE_` is needed: the screens call `/api` on their own
domain.

## The webhook address

Once deployed, the address to give Bluum is:

```
https://<your-domain>/api/webhooks/bluum
```

## Before this is public

- **The sandbox shortcuts are still open.** `/api/dev/approve-me` lets anyone
  who signs up approve their own account. They are refused only when
  `BLUUM_ENV=production`. That is right for a sandbox demo and wrong for a
  real site, so set `BLUUM_ENV=production` (and `BLUUM_ALLOW_PRODUCTION=true`)
  when the time comes.
- **Put Vercel's deployment protection on the preview URL** while the data is
  sample data, so a customer never finds invented prices on a Dividendii
  domain.

## Running it locally the Vercel way

```bash
npx vercel dev
```

That runs both services together as Vercel will. `npm run dev` is still the
quicker loop for day-to-day work.
