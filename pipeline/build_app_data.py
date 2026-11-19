"""Step 3: write compact static files for the web app (app/public/data/)."""
import json, subprocess, gzip, re
from pathlib import Path
import pandas as pd
from shapely.geometry import shape, mapping, box

ROOT = Path(__file__).resolve().parent
RAW, BUILD = ROOT / "raw", ROOT / "build"
OUT = Path(__import__("sys").argv[1]) if len(__import__("sys").argv) > 1 else ROOT / "out"
OUT.mkdir(parents=True, exist_ok=True)
MS = str(ROOT / "node_modules/.bin/mapshaper")

def sh(*args):
    subprocess.run([MS, *args], check=True, capture_output=True)

# ---------- display names (cosmetic; source names retained in `census_name`) ----------
DISPLAY = {
    "Westminster,City of London": "Westminster & City of London",
    "Cornwall,Isles of Scilly": "Cornwall & Isles of Scilly",
    "Bristol, City of": "Bristol", "Kingston upon Hull, City of": "Hull",
    "Herefordshire, County of": "Herefordshire", "City of Edinburgh": "Edinburgh",
    "Glasgow City": "Glasgow", "Aberdeen City": "Aberdeen", "Dundee City": "Dundee",
    "Limvady": "Limavady",  # spelling in the WU03UK table; OSNI/NISRA spell the district Limavady
    "Eilean Siar": "Na h-Eileanan Siar (Eilean Siar)",
}
LABEL = {"Westminster,City of London": "London"}
ALIASES = {
    "Westminster,City of London": ["London", "City of London", "Westminster", "Central London"],
    "Kingston upon Hull, City of": ["Kingston upon Hull"], "Derry": ["Londonderry", "Derry/Londonderry"],
    "Eilean Siar": ["Western Isles", "Outer Hebrides", "Stornoway"], "Highland": ["Inverness"],
    "Cornwall,Isles of Scilly": ["Cornwall", "Isles of Scilly", "Truro"], "Moray": ["Elgin"],
    "Perth and Kinross": ["Perth"], "Scottish Borders": ["Borders", "Galashiels"],
    "Dumfries and Galloway": ["Dumfries"], "Argyll and Bute": ["Oban"], "Orkney Islands": ["Kirkwall", "Orkney"],
    "Shetland Islands": ["Lerwick", "Shetland"], "The Vale of Glamorgan": ["Vale of Glamorgan", "Barry"],
    "Rhondda Cynon Taf": ["Rhondda", "Pontypridd"], "Ceredigion": ["Aberystwyth"], "Gwynedd": ["Bangor", "Caernarfon"],
    "Isle of Anglesey": ["Anglesey", "Ynys Môn"], "Fermanagh": ["Enniskillen"], "Craigavon": ["Portadown", "Lurgan"],
    "Newry and Mourne": ["Newry"], "North Down": ["Bangor (Co. Down)"], "Moyle": ["Ballycastle"],
    "Medway": ["Chatham", "Rochester", "Gillingham"], "Brighton and Hove": ["Brighton", "Hove"],
    "Bath and North East Somerset": ["Bath"], "Telford and Wrekin": ["Telford"], "Windsor and Maidenhead": ["Windsor", "Maidenhead"],
    "Basingstoke and Deane": ["Basingstoke"], "Tonbridge and Malling": ["Tonbridge"], "Stockton-on-Tees": ["Stockton"],
    "Redcar and Cleveland": ["Redcar"], "Blackburn with Darwen": ["Blackburn"], "Wiltshire": ["Salisbury", "Trowbridge"],
    "County Durham": ["Durham"], "East Riding of Yorkshire": ["Beverley"], "South Gloucestershire": ["Filton", "Yate"],
    "North Somerset": ["Weston-super-Mare"], "Cheshire West and Chester": ["Chester"], "Cheshire East": ["Crewe", "Macclesfield"],
}

areas = pd.read_csv(BUILD / "areas.csv")
comm = json.loads((BUILD / "communities.json").read_text())
meta = json.loads((BUILD / "network_meta.json").read_text())
flows = pd.read_csv(BUILD / "flows_between_areas.csv")
codes = list(areas.code)
idx = {c: i for i, c in enumerate(codes)}

# ---------- labels: tier by jobs filled (London boroughs other than Westminster held back) ----------
london = areas.code.isin(areas[areas.community == areas.loc[areas.name == "Westminster,City of London", "community"].iloc[0]].code)
inner_london = areas.code.str.startswith("E41000") & areas.name.isin([
    "Camden", "Tower Hamlets", "Southwark", "Islington", "Lambeth", "Hammersmith and Fulham", "Kensington and Chelsea",
    "Hackney", "Wandsworth", "Lewisham", "Greenwich", "Newham", "Haringey", "Brent", "Ealing", "Hounslow", "Hillingdon",
    "Barnet", "Enfield", "Waltham Forest", "Redbridge", "Barking and Dagenham", "Havering", "Bexley", "Bromley", "Croydon",
    "Sutton", "Merton", "Kingston upon Thames", "Richmond upon Thames", "Harrow"])
# tier 1 labels: the places that draw the most commuters in from other areas (a data-driven proxy for "city")
rank = areas.assign(lond=inner_london).sort_values("in_total", ascending=False)
tier = {}
t1 = [c for c, l in zip(rank.code, rank.lond) if not l][:42]
for c in codes:
    tier[c] = 1 if c in t1 else 2
for c, l in zip(rank.code, rank.lond):
    if l:
        tier[c] = 3

area_rows = []
for r in areas.itertuples():
    area_rows.append(dict(
        i=idx[r.code], code=r.code, census_name=r.name, name=DISPLAY.get(r.name, r.name),
        label=LABEL.get(r.name, DISPLAY.get(r.name, r.name)), tier=tier[r.code], nation=r.nation,
        lon=r.lon, lat=r.lat, aliases=ALIASES.get(r.name, []),
        resident_workers=r.resident_workers, within=r.within, out_total=r.out_total, in_total=r.in_total,
        home=r.home, no_fixed=r.no_fixed, offshore=r.offshore, outside_uk=r.outside_uk, jobs_filled=r.jobs_filled,
        c={k: int(getattr(r, k)) for k in ["r0_5", "r1_0", "r2_0"]}, ttwa11=r.ttwa11,
        point_method="pwc" if r.point_method.startswith("population-weighted") else "pwc_nearest_cell"))

MODES = ["metro", "train", "bus", "taxi", "moto", "car", "passenger", "bicycle", "foot", "other"]
# flows as compact CSV text: origin index, destination index, total, 10 modes (blank = 0)
flows = flows.sort_values("all", ascending=False)
lines = ["o,d,n," + ",".join(MODES)]
for r in flows.itertuples(index=False):
    vals = [idx[r.res], idx[r.wp], r.all] + [getattr(r, m) for m in MODES]
    lines.append(",".join(str(v) if (k < 3 or v) else "" for k, v in enumerate(vals)))
(OUT / "flows_2011.csv").write_text("\n".join(lines) + "\n")

# ---------- geometry for the basemap (topology-aware simplification) ----------
geo = BUILD / "areas_geom.geojson"
sh("-i", str(geo), "-simplify", "weighted", "4%", "keep-shapes", "-filter-slivers", "min-area=2km2",
   "-each", "name=undefined, nation=undefined", "-o", str(OUT / "areas_2011.geo.json"), "precision=0.0001", "format=geojson")
sh("-i", str(geo), "-simplify", "weighted", "4%", "keep-shapes", "-dissolve", "nation", "-innerlines",
   "-o", str(OUT / "nation_borders.geo.json"), "precision=0.0001", "format=geojson")
sh("-i", str(geo), "-simplify", "weighted", "4%", "keep-shapes", "-dissolve", "-o", str(BUILD / "uk_land.geojson"),
   "precision=0.0001", "format=geojson")
sh("-i", str(RAW / "ons_ttwa2011_uk_bsc.geojson"), "-simplify", "weighted", "10%", "keep-shapes",
   "-rename-fields", "code=TTWA11CD,name=TTWA11NM", "-o", str(OUT / "ttwa_2011.geo.json"), "precision=0.0001", "format=geojson")
# context land outside the UK (Natural Earth, public domain) clipped to the map frame
ne = json.loads((RAW / "context/ne_10m_admin_0_countries.geojson").read_text())
frame = box(-13.5, 47.5, 6.5, 62.5)
ctx = []
for f in ne["features"]:
    if f["properties"].get("ADM0_A3") == "GBR":
        continue
    g = shape(f["geometry"])
    if g.intersects(frame):
        ctx.append({"type": "Feature", "properties": {"name": f["properties"]["NAME"]}, "geometry": mapping(g.intersection(frame))})
(BUILD / "context_raw.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": ctx}))
sh("-i", str(BUILD / "context_raw.geojson"), "-simplify", "weighted", "8%", "keep-shapes",
   "-o", str(OUT / "context_land.geo.json"), "precision=0.001", "format=geojson")

# ---------- metadata ----------
(OUT / "areas_2011.json").write_text(json.dumps(dict(modes=MODES, areas=area_rows), separators=(",", ":")))
(OUT / "communities_2011.json").write_text(json.dumps(comm, separators=(",", ":")))
(OUT / "network_meta_2011.json").write_text(json.dumps(meta, indent=1))
for p in sorted(OUT.iterdir()):
    raw = p.read_bytes()
    print(f"{p.name:32s} {len(raw)/1024:8.1f} KB  gzip {len(gzip.compress(raw))/1024:7.1f} KB")
