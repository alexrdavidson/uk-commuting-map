"""End-to-end checks with Playwright + Chrome (software WebGL). Usage: python3 tests/e2e.py http://localhost:4173/"""
import asyncio, sys, re, csv, json
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
CHROME = sys.argv[2] if len(sys.argv) > 2 else "/usr/bin/google-chrome"
results = []
def check(name, cond, detail=""):
    results.append(cond); print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))

async def page(b, url, w=1440, h=900, mobile=False):
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    await pg.goto(url, wait_until="networkidle"); await pg.wait_for_timeout(3500)
    return pg, errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg, errs = await page(b, BASE)
        body = await pg.inner_text("body")
        check("loads with totals from source", "30,008,634" in body and "11,260,336" in body)
        check("no page errors on load", not errs, "; ".join(errs)[:300])
        # search -> area
        await pg.fill("#search-input", "Brighton"); await pg.wait_for_timeout(300)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1500)
        h = await pg.evaluate("location.hash")
        check("search selects area and updates share URL", h.startswith("#area-E41") and "Brighton and Hove" in await pg.inner_text("#area-title"), h)
        # direction toggle
        await pg.get_by_role("radio", name=re.compile("In: homes")).click(); await pg.wait_for_timeout(500)
        check("inbound toggle in URL", "dir-in" in await pg.evaluate("location.hash"))
        # choose first list row -> flow
        await pg.locator(".flow-list li button").first.click(); await pg.wait_for_timeout(1500)
        h = await pg.evaluate("location.hash")
        check("selecting a list row establishes a journey", h.startswith("#flow-"), h)
        links = await pg.eval_on_selector_all(".gm-buttons a", "els => els.map(e => [e.textContent, e.href])")
        modes = {}
        for text, href in links:
            q = parse_qs(urlparse(href).query); modes[text] = q
        ok = all(t in modes for t in ["Driving", "Cycling", "Public transport"]) and \
             modes["Driving"]["travelmode"] == ["driving"] and modes["Cycling"]["travelmode"] == ["bicycling"] and modes["Public transport"]["travelmode"] == ["transit"] and \
             all(m["api"] == ["1"] and re.match(r"^-?\d+\.\d+,-?\d+\.\d+$", m["origin"][0]) and re.match(r"^-?\d+\.\d+,-?\d+\.\d+$", m["destination"][0]) for m in modes.values())
        check("Google Maps links: documented URL format, three modes, lat,lon endpoints", ok, str(links)[:300])
        check("Google section labelled 'View journey options in Google Maps'", "View journey options in Google Maps" in await pg.inner_text(".gmaps"))
        # refine endpoint is not stored in URL
        await pg.click(".refine summary"); await pg.fill(".refine input >> nth=0", "Brighton station")
        await pg.wait_for_timeout(300)
        drive = await pg.get_attribute(".gm-buttons a >> nth=0", "href")
        check("refined start used in link but not in share URL", "Brighton+station" in drive and "Brighton" not in await pg.evaluate("location.hash"))
        # count matches source
        num = (await pg.inner_text(".big-number")).split()[0].replace(",", "")
        f = re.match(r"#flow-(\w+)-(\w+)", await pg.evaluate("location.hash")).groups()
        src = {}
        with open("pipeline/raw/wu03uk_bulk.csv") as fh:
            for row in csv.reader(fh):
                if row[2] == f[0] and row[4] == f[1]: src = row
        check("selected journey count equals the raw WU03UK row", src and src[5] == num, f"{num} vs {src[5] if src else None}")
        # filters
        await pg.goto(BASE + "#area-E41000293", wait_until="networkidle"); await pg.wait_for_timeout(2500)
        await pg.select_option("#mode-select", "train"); await pg.wait_for_timeout(400)
        await pg.locator("#min-range").fill("5"); await pg.wait_for_timeout(600)
        h = await pg.evaluate("location.hash")
        check("mode and threshold preserved in share URL", "mode-train" in h and "min-50" in h, h)
        hint = await pg.inner_text(".controls")
        check("threshold explains what is hidden", "Hidden:" in hint and "still count" in hint)
        # restore from URL in a fresh page
        pg2, errs2 = await page(b, BASE + h)
        check("share URL restores area, mode and threshold", "Barking" in await pg2.inner_text("#area-title") and await pg2.input_value("#mode-select") == "train")
        # timeline
        pg3, e3 = await page(b, BASE + "#y1832")
        t = await pg3.inner_text(".sidebar-body")
        check("timeline 1832 shows the 1832 testimony", "two-mile" in t)
        await pg3.goto(BASE + "#y1850", wait_until="networkidle"); await pg3.wait_for_timeout(1500)
        t = await pg3.inner_text(".sidebar-body")
        check("gap year shows empty state with nearest period", "No verified evidence available for this selection" in t and "Nearest documented period" in t)
        await pg3.goto(BASE + "#y1851", wait_until="networkidle"); await pg3.wait_for_timeout(1500)
        check("one-off 1832 record not shown in 1851", "two-mile" not in await pg3.inner_text(".sidebar-body"))
        await pg3.goto(BASE + "#y2026", wait_until="networkidle"); await pg3.wait_for_timeout(2500)
        t = await pg3.inner_text("body")
        check("present day labels 2011 census as not current", "not current" in t and "2011 Census (27 March 2011)" in t)
        await pg3.goto(BASE + "#y1893-rec-h02", wait_until="networkidle"); await pg3.wait_for_timeout(1500)
        t = await pg3.inner_text(".sidebar-body")
        href = await pg3.eval_on_selector_all(".record a", "els => els.map(e => e.href)")
        check("evidence card shows journey date separately from publication and links source",
              "Date of journey" in t and "Published 16 March 1893" in t and any("api.parliament.uk" in x for x in href))
        check("then-and-now button label", "Explore this journey today in Google Maps" in t)
        await pg3.goto(BASE + "#y1863", wait_until="networkidle"); await pg3.wait_for_timeout(1500)
        t = await pg3.inner_text(".sidebar-body")
        check("infrastructure filtered by opening/closing dates", "Metropolitan Railway" in t and "Glasgow District Subway" not in t)
        await pg3.goto(BASE + "#y1961", wait_until="networkidle"); await pg3.wait_for_timeout(1500)
        check("closed line removed after closure (Mumbles, 1960)", "Mumbles" not in await pg3.inner_text(".sidebar-body"))
        # mobile
        pg4, e4 = await page(b, BASE + "#area-S12000036", 390, 844, True)
        box = await pg4.locator(".sidebar").bounding_box()
        check("mobile uses a bottom sheet", box and box["y"] > 300 and box["width"] >= 380, str(box))
        await pg4.click(".sheet-handle"); await pg4.wait_for_timeout(500)
        box2 = await pg4.locator(".sidebar").bounding_box()
        check("bottom sheet expands", box2["height"] > box["height"])
        await b.close()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)
asyncio.run(main())
