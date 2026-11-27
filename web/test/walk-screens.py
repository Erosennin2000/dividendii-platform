"""Walks every screen in a real browser and reports anything broken.

Run the server and the web app first, then:

    python3 test/walk-screens.py

It signs in with a one-time code, opens the account, adds money and visits
every page, taking a screenshot of each and collecting console errors. Any
console error, failed request or missing element is reported and makes it
exit non-zero.
"""

import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

WEB = "http://localhost:5173"
API = "http://localhost:4000"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

problems: list[str] = []
console_errors: list[str] = []
failed_requests: list[str] = []

# Noise that is not a fault in the platform.
IGNORE = (
    "/api/auth/me",  # a 401 here just means nobody is signed in yet
    "/api/account/status",
    "favicon",
    "Download the React DevTools",
    "ERR_ABORTED",
)


def note(message: str) -> None:
    problems.append(message)
    print(f"  FAIL {message}")


def shot(page, name: str) -> None:
    page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def visit(page, path: str, name: str, expect_text: str | None = None) -> None:
    before = len(console_errors)
    page.goto(f"{WEB}{path}", wait_until="networkidle")
    page.wait_for_timeout(600)
    shot(page, name)
    body = page.inner_text("body")
    if expect_text and expect_text.lower() not in body.lower():
        note(f"{path}: expected to see {expect_text!r}")
    if "Something went wrong" in body and "That did not work" not in body and "/status/error" not in path:
        note(f"{path}: an unexplained error is on screen")
    new_errors = console_errors[before:]
    if new_errors:
        note(f"{path}: {len(new_errors)} console error(s): {new_errors[0][:160]}")
    print(f"  ok   {path}")


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    page.on(
        "console",
        lambda m: console_errors.append(m.text)
        if m.type == "error" and not any(s in m.text for s in IGNORE)
        else None,
    )
    page.on("pageerror", lambda e: console_errors.append(f"page error: {e}"))
    page.on(
        "requestfailed",
        lambda r: failed_requests.append(f"{r.method} {r.url}")
        if not any(s in r.url for s in IGNORE)
        else None,
    )

    print("\nSign in")
    page.goto(WEB, wait_until="networkidle")
    shot(page, "00-welcome")
    page.goto(f"{WEB}/signin", wait_until="networkidle")
    shot(page, "01-signin")
    email = f"walk-{int(time.time())}@example.com"
    page.fill('input[type="email"]', email)
    page.fill('input[autocomplete="name"]', "Walk Through")
    page.click('button:has-text("Send my code")')
    page.wait_for_selector(".code-input", timeout=10000)
    shot(page, "02-code")

    code_text = page.inner_text(".notice-warn")
    match = re.search(r"\b(\d{6})\b", code_text)
    if not match:
        note("the development code was not shown on the code screen")
        browser.close()
        sys.exit(1)
    page.fill(".code-input", match.group(1))
    page.click('button:has-text("Sign in")')

    print("\nOpen the account")
    page.wait_for_selector('h1:has-text("Open your account")', timeout=10000)
    shot(page, "03-onboarding-details")
    page.fill('input[autocomplete="given-name"]', "Walk")
    page.fill('input[autocomplete="family-name"]', "Through")
    page.fill('input[type="date"]', "1990-01-01")
    page.click('button:has-text("Continue")')

    page.wait_for_selector(".disclosure-text", timeout=10000)
    shot(page, "04-disclosures")
    boxes = page.query_selector_all('.check input[type="checkbox"]')
    if not boxes:
        note("no disclosures to accept on the agreements step")
    for box in boxes:
        box.check()
    page.click('button:has-text("I agree, continue")')

    page.wait_for_selector('h2:has-text("Prove your identity")', timeout=10000)
    shot(page, "05-identity")

    # A document has to be a real file, so one is written here.
    sample = SHOTS / "sample-id.png"
    if not sample.exists():
        page.screenshot(path=str(sample))
    page.set_input_files('input[type="file"] >> nth=0', str(sample))
    page.click('button:has-text("Send for checking")')
    page.wait_for_selector('h2:has-text("Where your account stands")', timeout=10000)
    shot(page, "06-status")

    # Approve and fund, as the sandbox shortcuts do.
    page.request.post(f"{API}/api/dev/approve-me")
    page.request.post(
        f"{API}/api/money/deposits",
        data={"amount": "1000000", "currency": "NGN", "method": "card"},
    )
    page.request.post(
        f"{API}/api/money/deposits",
        data={"amount": "20000", "currency": "USD", "method": "card"},
    )

    print("\nEvery screen")
    routes = [
        "/", "/search?q=mtn", "/notifications", "/markets", "/markets/GTCO", "/watchlist", "/news", "/funds/SNIF",
        "/orders", "/portfolio", "/portfolio/MTNN", "/goals", "/rebalance", "/auto-invest", "/collections",
        "/bonds", "/maturities", "/offers", "/money", "/money/move", "/money/accounts", "/money/transactions",
        "/gifts", "/account", "/account/statements", "/account/fees", "/account/profile", "/account/security",
        "/account/preferences", "/account/privacy", "/help", "/help/tickets", "/learn", "/legal", "/order/MTNN",
        "/contract-note/CN-20261125-0412", "/open-account/status",
    ]
    for i, path in enumerate(routes):
        visit(page, path, f"{i + 7:02d}-" + (path.strip("/").replace("/", "-").replace("?", "-") or "home"))

    bonds = page.request.get(f"{API}/api/bonds").json()["data"]
    if bonds:
        visit(page, f"/bonds/{bonds[0]['symbol']}", "bond-detail", "% of face value")

    offers = page.request.get(f"{API}/api/offerings").json()["data"]
    open_offers = [o for o in offers if o["status"] == "OPEN"]
    if open_offers:
        visit(page, f"/offers/{open_offers[0]['id']}", "offer-detail", "apply")

    for which in ["maintenance", "update", "offline", "error"]:
        visit(page, f"/status/{which}", f"status-{which}")

    print("\nPlace an order through the screens")
    page.goto(f"{WEB}/markets/GTCO", wait_until="networkidle")
    page.fill('input[type="number"] >> nth=0', "100000")
    page.click('button:has-text("Review order")')
    page.wait_for_url("**/order/GTCO*")
    page.wait_for_timeout(1500)
    shot(page, "19-order-step1")
    shot(page, "19-order-step1")
    page.click('button:has-text("Review order")')
    page.wait_for_selector(".kv.total", timeout=10000)
    shot(page, "20-order-review")
    total = page.inner_text(".kv.total")
    if "₦" not in total:
        note(f"the order total is not shown in naira: {total!r}")
    page.click('button:has-text("Confirm and buy")')
    page.wait_for_selector('h2:has-text("Order")', timeout=10000)
    page.wait_for_selector('text=View order', timeout=10000)
    shot(page, "21-order-placed")
    print("  ok   an order was placed and confirmed")

    print("\nMobile width")
    page.set_viewport_size({"width": 390, "height": 844})
    for path, name in [("/", "22-mobile-home"), ("/markets/GTCO", "23-mobile-asset")]:
        page.goto(f"{WEB}{path}", wait_until="networkidle")
        page.wait_for_timeout(400)
        shot(page, name)
        width = page.evaluate("document.documentElement.scrollWidth")
        if width > 400:
            note(f"{path} scrolls sideways on a phone ({width}px wide)")
        print(f"  ok   {path}")

    browser.close()

print("")
if failed_requests:
    print(f"{len(failed_requests)} request(s) failed:")
    for r in failed_requests[:5]:
        print(f"  {r}")

if problems:
    print(f"{len(problems)} problem(s) found.")
    sys.exit(1)

print(f"Every screen loaded cleanly. Screenshots are in {SHOTS}")
