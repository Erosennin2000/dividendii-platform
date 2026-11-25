# Where this runs, in plain words

You asked what "a host that can run Node.js" means. Here is the whole answer.

## The two halves

**The screens.** The part customers look at. When it is built it becomes a
folder of ordinary files: HTML, styling and JavaScript. Any web host can serve
those, including the cPanel hosting the Dividendii website already uses. There
is nothing special about it.

**The server.** The part that holds the Bluum key, decides what a customer is
allowed to do, and receives messages from Bluum. This one is a program that has
to be *running all the time*, waiting. That is what "a Node.js host" means: a
machine where a program can stay running, rather than one that only hands out
files when a browser asks.

## Why the key cannot live in the browser

Anything sent to a browser can be read by whoever is using it: right-click,
view source, and it is there. A Bluum key is the ability to move money in every
Dividendii customer's account. So the key sits on the server, the browser asks
the server, and the server asks Bluum. There is no way around this. It is why
there has to be a server at all.

> **Since this was written, you tried Vercel.** Vercel is a third kind of
> host: "serverless", where your code is not left running but is started for
> each request and stopped again. It handles Bluum's messages perfectly well,
> so the paragraph below about something needing to be awake is too strong for
> that kind of host. What a serverless host cannot do is remember anything
> between requests, which is why a database stops being optional. See
> `VERCEL.md`.

## Why cPanel alone is not enough

Your current hosting runs PHP, which works differently: the page is built fresh
each time someone asks for it, and nothing stays running in between. Two things
this platform needs cannot be done that way:

- **Bluum's messages.** When an order fills or money lands, Bluum sends a
  message to a web address of ours, at any hour. Something has to be awake to
  receive it.
- **The 15-minute investor tokens and the retry logic.** These are kept in the
  running program's memory.

Some cPanel plans do have a "Setup Node.js App" button, which would work. Check
whether yours does; if it is there, that is the cheapest answer. If not, you
need a second, small machine.

## What to get

| Option | What it is | Rough cost | Good when |
| --- | --- | --- | --- |
| cPanel's Node.js app, if your plan has it | A Node program alongside the website you already have | nothing extra | Easiest, if the button exists |
| A managed platform (Render, Railway, Fly.io and similar) | You connect the code, it runs it, handles HTTPS and restarts | roughly $7 to $25 a month to start | You want the least to look after |
| A small virtual server (DigitalOcean, Hetzner, AWS Lightsail) | A plain Linux machine you set up yourself | roughly $5 to $12 a month | You want full control and do not mind the setup |

Any of them is enough for a long time. This is not a heavy program: it mostly
waits on Bluum.

## What it needs, whichever you choose

- Node 20 or newer
- A public address with HTTPS, for Bluum's messages, for example
  `https://api.dividendii.com`
- Somewhere to keep settings (the Bluum key, the database address) that is not
  in the code
- A PostgreSQL database. Every option above offers one, usually a few dollars a
  month, and managed ones throw in backups.

## How the pieces fit

```
Customer's browser
      |
      | dividendii.com        the screens (ordinary files, any host)
      |
      v
  Your server                 api.dividendii.com (Node, always running)
      |   ^
      |   |  Bluum's messages arrive here
      v   |
   Bluum Finance              the money, the market, the custody
```

## My suggestion

Start with a managed platform for the server, keep the website where it is, and
take the managed database that comes with it. It is one bill, HTTPS is handled
for you, and moving later is easy because nothing in this code depends on the
host.

What this does not decide: whether customer data may legally sit on a machine
outside Nigeria. That is a question for your lawyer, and it decides which
region you pick, not which company.
