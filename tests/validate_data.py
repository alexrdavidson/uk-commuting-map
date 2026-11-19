"""Static data integrity checks for public/data (run after the pipeline)."""
import json, csv, sys
from pathlib import Path
D = Path(__file__).resolve().parent.parent / "public/data"
ok = []
def check(n, c): ok.append(c); print(("PASS " if c else "FAIL ") + n)
areas = json.loads((D / "areas_2011.json").read_text())["areas"]
meta = json.loads((D / "network_meta_2011.json").read_text())
comms = json.loads((D / "communities_2011.json").read_text())
rows = list(csv.reader((D / "flows_2011.csv").read_text().splitlines()))[1:]
q = meta["qa"]
check("404 areas with unique codes", len(areas) == 404 and len({a["code"] for a in areas}) == 404)
check("representative points inside the UK frame", all(-8.7 < a["lon"] < 1.8 and 49.8 < a["lat"] < 60.9 for a in areas))
check("every flow references a valid area and never itself", all(0 <= int(r[0]) < 404 and 0 <= int(r[1]) < 404 and r[0] != r[1] for r in rows))
check("no duplicate origin-destination pairs", len({(r[0], r[1]) for r in rows}) == len(rows))
check("flow count matches QA", len(rows) == q["flows_between_areas_nonzero"])
check("flow totals sum to between-area commuters", sum(int(r[2]) for r in rows) == q["total_between_areas"])
check("modes sum to totals on every flow", all(sum(int(x or 0) for x in r[3:]) == int(r[2]) for r in rows))
check("per-area out totals match flows", all(a["out_total"] == sum(int(r[2]) for r in rows if int(r[0]) == a["i"]) for a in areas[:60]))
check("area components sum to resident workers", all(a["resident_workers"] == a["within"] + a["out_total"] + a["home"] + a["no_fixed"] + a["offshore"] + a["outside_uk"] for a in areas))
check("all areas assigned to a community at each resolution", all(all(0 <= a["c"][k] < len(comms[k]["communities"]) for k in comms) for a in areas))
h = json.loads((D / "history.json").read_text())
check("history records have valid intervals and https sources", all(r["start"] <= r["end"] and all(s["url"].startswith("https://") for s in r["sources"]) for r in h["records"]))
check("infrastructure dates ordered", all(x["closedYear"] is None or x["openedYear"] < x["closedYear"] for x in h["infrastructure"]))
print(f"{sum(ok)}/{len(ok)} data checks passed"); sys.exit(0 if all(ok) else 1)
