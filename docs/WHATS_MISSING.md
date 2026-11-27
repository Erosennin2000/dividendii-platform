# What is missing, and why

Written after building the platform. Three kinds of gap: things waiting on
Bluum, things waiting on you, and things deliberately left out.

## 1. Waiting on Bluum

| # | What | What it blocks | What happens now |
| --- | --- | --- | --- |
| 1 | **A sandbox key.** | Everything real. | The platform runs on sample data. Switching is one setting. |
| 2 | **How one customer funds another.** Bluum documents no transfer between investors, and no way to pay into someone else's wallet. | Gifting. | A gift is saved and reaches "awaiting funding". Nobody is charged. The delivery code is written and tested; only the funding line is missing. |
| 3 | **Bond trading switched on.** It is enabled per tenant. | Bonds, if it is off. | Bond screens work on sample data. Against a live key they will fail until Bluum enables it. |
| 4 | **Whether a customer may apply twice to the same offer.** Bluum's glossary and its offerings page contradict each other. | Nothing: one application is allowed and a second is refused. | Change one line in `server/src/routes/offerings.js` if the answer is yes. |
| 5 | **Nairobi trading hours.** Not in the documentation. | The hours shown on Kenyan assets. | The screen says they are not confirmed rather than inventing them. |
| 6 | **Whether Ghana, South Africa and Egypt exist at Bluum,** and GHS and ZAR wallets. | Those markets. | Only NG, US and KE are switched on. |
| 7 | **How allotted units become a holding** after an offer closes. | Nothing yet. The subscription webhooks are subscribed to and stored. | Worth confirming before the first real offer. |
| 8 | **Accounts for minors.** Not described. | Nothing. | Not built. |
| 9 | **Whether the news endpoints work.** Listed but undocumented. | A news feed on asset pages. | The route returns an empty list rather than an error if they fail. |

**What PTF turned out to mean.** Those twenty undocumented endpoints are
portfolios: curated baskets of shares with their own unit price, bought by
amount. They are built and working in this platform as the Portfolios screen,
and they are the closest thing Bluum has to the "funds" in the old demo.

## 2. Waiting on you

| # | What | Why it matters |
| --- | --- | --- |
| 1 | **Legal entity details.** Exact registered name, registration number, regulator and licence number, registered address, support hours and contact. | They appear at the foot of every screen, currently as `[placeholders]`. A financial site cannot launch without them. |
| 2 | **Where the server will run.** See `HOSTING.md`. | Nothing can go live until this exists. |
| 3 | **A database.** A Postgres URL. | Without one, data is lost whenever the server restarts. |
| 4 | **Email sending.** SMTP details. | Sign-in codes are printed to the server log instead of being sent. |
| 5 | **Your own fee.** Whether Dividendii charges on top of Bluum's fees, and how much. | Bluum's fees are shown itemised. There is no Dividendii fee anywhere yet. |
| 6 | **A decision on KYC document storage.** The default passes files to Bluum and keeps nothing. Keeping them needs encrypted storage and a named person responsible. | You said a database would be created for them. I have not built that, on purpose: see the note below. |
| 7 | **Compliance review of the disclosure flow and the wording.** | The text comes from Bluum verbatim, which is right, but the surrounding screens are mine and nobody has reviewed them. |
| 8 | **A GitHub repository.** | The code is in this session's folder. It is not in version control. |

### A note on storing identity documents

You said you would create a database for KYC documents. I built the record
keeping but not the file storage, and set the default to pass each file
straight to Bluum without keeping a copy.

The reason: a store of passports and utility bills is the most attractive thing
a Nigerian fintech can own from an attacker's point of view, and keeping one
brings duties under the Nigeria Data Protection Act that need a named officer,
encryption at rest, a retention schedule and a breach procedure. Bluum is doing
the checking and already holds the documents. Keeping a second copy adds risk
without adding much.

If you still want them kept, set `KYC_STORAGE=store` and the files are written
to disk. Please do that only after encryption and a retention rule exist.

## 3. Deliberately left out

These were in the old demo. The Bluum API cannot power them, so they are not in
this build. Each would need a different provider, or would be a product of its
own.

| From the demo | Why it is not here | What it would take |
| --- | --- | --- |
| Dividend recovery and claims | Bluum has no claims or registrar endpoints | A registrar integration, and probably a manual operations desk |
| Mutual funds | No fund-manager endpoints | Partly replaced by Portfolios, which are not the same thing |
| Insurance quotes | Nothing in Bluum | An insurer integration |
| Family accounts and trusts | Nothing in Bluum | Likely a licensing question before a technical one |
| Share-backed lending | Nothing in Bluum, and it was already hidden in the demo | A lender, a lien mechanism and a credit policy |
| CSCS, BVN and NIN checks | Bluum's KYC covers identity its own way | Only needed if you want a Nigerian-specific check on top |
| Admin console | Not built yet | A few days' work once the customer side is settled |
| Dividend tracking | Bluum pays dividends into the wallet, which this platform shows as transactions, but there is no dividend calendar or forecast | A market-data source |

## 4. Known rough edges in this build

- **No admin console.** You cannot look at a customer's account from the
  inside. The Account page shows the platform's own setup instead.
- **The screens do not update by themselves.** A filled order appears when the
  page is reopened. Live updating is a later job.
- **No tests on the React side** beyond the browser walk-through, which checks
  that every screen loads and an order can be placed.
- **The naira symbol** falls back to a different font, because Space Grotesk
  has no glyph for it. It is legible but not perfectly matched.
- **English only.**
- **The sample data is invented.** Every company, price and offer is made up.
  It is labelled on every screen while Bluum is not connected.


## 4. The redesign: what runs on sample data

The screens follow the approved 47-screen Hybrid Console and Terminal design.
Everything that Bluum can do is wired to the Bluum layer (sample mode now,
live with a key). Everything below has **no Bluum endpoint behind it**, so it
runs on invented data from `server/src/routes/extras.js`. Each one carries a
"Sample" chip on screen and `meta.sample: true` in the reply, so nobody mistakes
it for real.

| Screen | What is invented | What it needs to become real |
| --- | --- | --- |
| Watchlist and price alerts | The list is saved per user in memory. Alerts are saved but nothing sends them. | A table for watchlists and alerts, and a job that checks prices and emails. |
| Home and Portfolio value charts | The history line is a generated walk that ends on today's real value. | Bluum portfolio history, or daily snapshots of your own. |
| Goals, Auto-invest, Rebalance | Saved in memory. Auto-invest never places an order. Model mixes are invented. | A plans table, a scheduler, and your decision on model portfolios. |
| Mutual funds (Fund page) | One invented fund. The Invest button is off. | Bluum confirming funds exist for you, or a fund partner. |
| News and calendar | Invented headlines and events. | A news source. Dividend and offer dates can come from Bluum later. |
| Maturity choices | The choice (keep as cash or roll over) is saved. Nothing rolls over. | Bluum or an operations process for rollover. |
| Convert between wallets (Money) | Uses an invented rate and moves nothing. | A currency conversion route at Bluum, or your treasury. |
| Statements, contract notes, tax summary | Invented documents and a sample contract note. | Real statements from Bluum or generated from your ledger. |
| Fees page | Schedule with `[TO CONFIRM]` for every fee except Nigerian shares. | Your decision (see section 2, item 5). |
| Profile checks, sign-in devices, preferences, privacy | Saved in memory. Closing an account only lists what is blocking it. | A users table, a device log, and a closure process agreed with Bluum. |
| Help, Tickets, Learn, Legal | Sample articles, lessons and legal wording. Tickets stay in memory. | Real content from you and your lawyer, and a help desk or support inbox. |
| Gifts and Rewards | The invite code and reward are invented. | The reward terms, and the funding route from section 1, item 2. |
| Status screens | Maintenance, update and offline screens exist. Nothing switches them on by itself yet. | A maintenance flag and an app version check. |

Two other things to know:

- The left menu item "Portfolios" opens **your own portfolio** (design screen
  28). The curated baskets (design screen 18) moved to **/collections**.
- Sample data resets whenever the server restarts, unless `DATABASE_URL` is set.
  Even then, the sample features above are not saved to it yet.
