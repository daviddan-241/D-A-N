#!/usr/bin/env python3
"""
D.A.N. Browser Automation — Playwright + Tor
─────────────────────────────────────────────
Runs headless Chromium routed through the local Tor SOCKS5 proxy.
All traffic exits through a Tor relay — no direct IP exposure.

Usage (called by shell wrappers in bashrc_extra):
  browser <url>                 → dump page text (aider-readable)
  browser-do <url> <action>     → perform a JS action then dump text
  browser-fill <url> <sel> <val> → fill a form field + submit
  browser-screenshot <url>      → save /tmp/screenshot.png + open path

Called by aider via suggest-shell-commands. aider can read the output
and decide what to do next — navigate, fill forms, click buttons, etc.
"""
import sys, os, json, re, argparse, textwrap

# ── Playwright import guard ────────────────────────────────────────────────────
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("Playwright not installed. Run: pip3 install playwright && playwright install chromium", file=sys.stderr)
    sys.exit(1)

TOR_PROXY    = "socks5://127.0.0.1:9050"
SCREENSHOT   = "/tmp/dan-browser-screenshot.png"
MAX_TEXT     = 12000   # chars returned to aider (avoid context overflow)
DEFAULT_TO   = 30_000  # ms

# ── Minimal human-ish headers ──────────────────────────────────────────────────
EXTRA_HEADERS = {
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "DNT": "1",
}

def make_browser(p, headless=True):
    """Launch Chromium with Tor proxy + anti-fingerprint flags."""
    return p.chromium.launch(
        headless=headless,
        proxy={"server": TOR_PROXY},
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--window-size=1280,900",
        ],
    )

def new_page(browser):
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        extra_http_headers=EXTRA_HEADERS,
        ignore_https_errors=True,
        java_script_enabled=True,
    )
    page = ctx.new_page()
    # Stealth: remove webdriver flag
    page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
    """)
    return page

def extract_text(page) -> str:
    """Pull readable text from page — strips scripts/styles, collapses whitespace."""
    try:
        raw = page.evaluate("""() => {
            const clone = document.body.cloneNode(true);
            clone.querySelectorAll('script,style,noscript,svg,img').forEach(el => el.remove());
            return clone.innerText || clone.textContent || '';
        }""")
        lines = [l.strip() for l in str(raw).splitlines() if l.strip()]
        return "\n".join(lines)[:MAX_TEXT]
    except Exception as e:
        return f"[text extraction failed: {e}]"

def get_links(page) -> list:
    try:
        return page.evaluate("""() =>
            [...document.querySelectorAll('a[href]')]
                .map(a => ({text: a.innerText.trim().slice(0,60), href: a.href}))
                .filter(l => l.text && l.href.startsWith('http'))
                .slice(0, 20)
        """)
    except Exception:
        return []

def get_inputs(page) -> list:
    try:
        return page.evaluate("""() =>
            [...document.querySelectorAll('input,select,textarea,button[type=submit]')]
                .map(el => ({
                    tag: el.tagName.toLowerCase(),
                    type: el.type || '',
                    name: el.name || el.id || el.placeholder || '',
                    value: el.value || ''
                }))
                .slice(0, 30)
        """)
    except Exception:
        return []

def print_page_summary(page, url: str):
    title = page.title()
    text  = extract_text(page)
    links = get_links(page)
    inputs = get_inputs(page)
    print(f"=== PAGE: {title} ===")
    print(f"URL: {page.url}")
    print(f"ORIGINAL: {url}")
    print()
    print("── TEXT ────────────────────────────────────────────────")
    print(text)
    print()
    if inputs:
        print("── FORM FIELDS ─────────────────────────────────────────")
        for i in inputs:
            print(f"  [{i['tag']}] type={i['type']!r:12} name={i['name']!r}")
        print()
    if links:
        print("── LINKS ───────────────────────────────────────────────")
        for l in links[:10]:
            print(f"  {l['text']!r:40} → {l['href']}")
        print()

# ── Commands ───────────────────────────────────────────────────────────────────

def cmd_get(url: str):
    """Fetch a URL and dump text."""
    with sync_playwright() as p:
        browser = make_browser(p)
        page    = new_page(browser)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TO)
            page.wait_for_timeout(1500)   # let JS settle
        except PWTimeout:
            print(f"[timeout loading {url}]")
        print_page_summary(page, url)
        browser.close()

def cmd_do(url: str, action: str):
    """Navigate to URL then evaluate a JS action string."""
    with sync_playwright() as p:
        browser = make_browser(p)
        page    = new_page(browser)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TO)
            page.wait_for_timeout(1500)
        except PWTimeout:
            print(f"[timeout loading {url}]")
        try:
            result = page.evaluate(f"() => {{ {action} }}")
            if result is not None:
                print(f"[action result]: {result}")
            page.wait_for_timeout(1500)
        except Exception as e:
            print(f"[action error]: {e}")
        print_page_summary(page, url)
        browser.close()

def cmd_click(url: str, selector: str):
    """Navigate and click an element by CSS selector or text."""
    with sync_playwright() as p:
        browser = make_browser(p)
        page    = new_page(browser)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TO)
            page.wait_for_timeout(1500)
        except PWTimeout:
            print(f"[timeout loading {url}]")
        try:
            # Try selector first, then text match
            if page.locator(selector).count() > 0:
                page.locator(selector).first.click(timeout=10_000)
            else:
                page.get_by_text(selector, exact=False).first.click(timeout=10_000)
            page.wait_for_timeout(2000)
            print(f"[clicked: {selector!r}]")
        except Exception as e:
            print(f"[click failed: {e}]")
        print_page_summary(page, page.url)
        browser.close()

def cmd_fill(url: str, selector: str, value: str, do_submit: bool = False):
    """Fill a form field (by CSS selector, name, or label text) then optionally submit."""
    with sync_playwright() as p:
        browser = make_browser(p)
        page    = new_page(browser)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TO)
            page.wait_for_timeout(1500)
        except PWTimeout:
            print(f"[timeout loading {url}]")
        try:
            loc = page.locator(selector)
            if loc.count() == 0:
                # Try by placeholder or name attribute
                loc = page.locator(f"[name='{selector}'],[placeholder*='{selector}']")
            loc.first.fill(value, timeout=10_000)
            page.wait_for_timeout(500)
            print(f"[filled {selector!r} with {value!r}]")
            if do_submit:
                page.keyboard.press("Enter")
                page.wait_for_timeout(2000)
                print("[submitted form]")
        except Exception as e:
            print(f"[fill error: {e}]")
        print_page_summary(page, page.url)
        browser.close()

def cmd_screenshot(url: str):
    """Take a screenshot and save to /tmp/dan-browser-screenshot.png."""
    with sync_playwright() as p:
        browser = make_browser(p)
        page    = new_page(browser)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TO)
            page.wait_for_timeout(2000)
        except PWTimeout:
            print(f"[timeout loading {url}]")
        page.screenshot(path=SCREENSHOT, full_page=False)
        print(f"Screenshot saved: {SCREENSHOT}")
        print_page_summary(page, url)
        browser.close()

def cmd_multi(url: str, steps: list):
    """Execute a sequence of steps: [{action, selector, value}, ...]"""
    with sync_playwright() as p:
        browser = make_browser(p)
        page    = new_page(browser)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TO)
            page.wait_for_timeout(1500)
        except PWTimeout:
            print(f"[timeout loading {url}]")

        for i, step in enumerate(steps):
            act = step.get("action", "").lower()
            sel = step.get("selector", "")
            val = step.get("value", "")
            print(f"[step {i+1}] {act} {sel!r} {val!r}")
            try:
                if act == "goto":
                    page.goto(val, wait_until="domcontentloaded", timeout=DEFAULT_TO)
                    page.wait_for_timeout(1500)
                elif act == "click":
                    loc = page.locator(sel)
                    if loc.count() == 0:
                        loc = page.get_by_text(sel, exact=False)
                    loc.first.click(timeout=10_000)
                    page.wait_for_timeout(1200)
                elif act == "fill":
                    loc = page.locator(sel)
                    if loc.count() == 0:
                        loc = page.locator(f"[name='{sel}'],[placeholder*='{sel}']")
                    loc.first.fill(val, timeout=10_000)
                    page.wait_for_timeout(400)
                elif act == "submit":
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(2000)
                elif act == "wait":
                    page.wait_for_timeout(int(val) if val.isdigit() else 2000)
                elif act == "eval":
                    result = page.evaluate(f"() => {{ {val} }}")
                    print(f"  → {result}")
                elif act == "type":
                    page.keyboard.type(val, delay=50)
                    page.wait_for_timeout(400)
                elif act == "screenshot":
                    out = val or f"/tmp/step-{i+1}.png"
                    page.screenshot(path=out)
                    print(f"  → screenshot: {out}")
                else:
                    print(f"  [unknown action: {act}]")
            except Exception as e:
                print(f"  [error: {e}]")

        print()
        print_page_summary(page, page.url)
        browser.close()

# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=textwrap.dedent("""\
            D.A.N. anonymous browser (Playwright + Tor)
            ─────────────────────────────────────────────
            All traffic exits through Tor. Outputs text for aider to read.

            Commands:
              get <url>                    Fetch URL and dump text + form fields
              do  <url> <js>               Navigate then eval JS snippet
              click <url> <selector>       Click element (CSS sel or text)
              fill <url> <sel> <value>     Fill form field
              fill-submit <url> <sel> <v>  Fill + press Enter
              screenshot <url>             Screenshot → /tmp/dan-browser-screenshot.png
              multi <url> <steps-json>     Execute JSON step array (advanced)
        """),
    )
    p.add_argument("command", choices=["get","do","click","fill","fill-submit","screenshot","multi"])
    p.add_argument("url")
    p.add_argument("args", nargs="*")
    args = p.parse_args()

    cmd  = args.command
    url  = args.url
    rest = args.args

    if cmd == "get":
        cmd_get(url)
    elif cmd == "do":
        cmd_do(url, " ".join(rest))
    elif cmd == "click":
        cmd_click(url, " ".join(rest))
    elif cmd == "fill":
        cmd_fill(url, rest[0] if rest else "", rest[1] if len(rest) > 1 else "")
    elif cmd == "fill-submit":
        cmd_fill(url, rest[0] if rest else "", rest[1] if len(rest) > 1 else "", do_submit=True)
    elif cmd == "screenshot":
        cmd_screenshot(url)
    elif cmd == "multi":
        steps = json.loads(rest[0]) if rest else []
        cmd_multi(url, steps)

if __name__ == "__main__":
    main()
