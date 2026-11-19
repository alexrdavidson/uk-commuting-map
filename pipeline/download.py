"""Download every raw source listed in public/data/sources.json into pipeline/raw/ and verify SHA-256.

    python3 pipeline/download.py            # downloads, then checks checksums
Run from a machine whose network can reach nomisweb.co.uk, services1.arcgis.com and raw.githubusercontent.com.
The OSNI district service only answers requests referred from spatialni.gov.uk, so this script sends that Referer.
ArcGIS geometry queries can change if the publisher re-generalises a layer; a checksum mismatch on a boundary file is
reported as a warning (re-run the pipeline and review the QA output) rather than a failure. The census table must match.
"""
import hashlib, json, sys, time, urllib.request, csv, io
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
manifest = json.loads((ROOT.parent / "public/data/sources.json").read_text())["sources"]

def get(url, referer=None):
    req = urllib.request.Request(url, headers={"User-Agent": "uk-commuting-map/1.0 (reproducible research script)", **({"Referer": referer} if referer else {})})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:  # noqa
            if attempt == 3: raise
            time.sleep(3 * (attempt + 1))

def geostat(url_tpl):
    rows, off = [], 0
    while True:
        j = json.loads(get(url_tpl.replace("{offset}", str(off))))
        feats = j.get("features", [])
        rows += [f"{f['attributes']['OBJECTID']},{f['attributes']['grd_newid']},{f['attributes']['tot_p']}" for f in feats]
        if len(feats) < 2000: break
        off += 2000
    return ("objectid,grd_newid,tot_p\n" + "\n".join(rows) + "\n").encode()

ok = True
for s in manifest:
    out = ROOT / s["file"]
    out.parent.mkdir(parents=True, exist_ok=True)
    print("downloading", s["id"], "…", flush=True)
    if s["id"] == "geostat11":
        data = geostat(s["download_url"])
    else:
        data = get(s["download_url"], referer="https://www.spatialni.gov.uk/" if s["id"] == "lgd1993" else None)
    out.write_bytes(data)
    h = hashlib.sha256(data).hexdigest()
    if h == s["sha256"]:
        print("  sha256 OK")
    elif s["id"] == "wu03uk":
        print("  ERROR: census table checksum differs from the manifest", h); ok = False
    else:
        print("  WARNING: checksum differs (publisher may have regenerated the geometry):", h)
sys.exit(0 if ok else 1)
