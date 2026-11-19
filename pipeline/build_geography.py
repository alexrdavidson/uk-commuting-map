"""Step 1: build the 2011 census commuting geography (404 areas) and representative points.

Inputs (raw/, see sources.json for provenance and SHA-256):
  ons_cmlad_dec2011_ew_bgc.geojson        England & Wales census merged LADs 2011 (346)
  ons_lad_dec2011_gb_bgc_scotland.geojson Scotland council areas, Dec 2011 codes (32)
  osni_lgd1993.geojson                    Northern Ireland 26 Local Government Districts (1993 set, in use 1973-2015)
  ons_geostat2011_uk_1km_population.csv   2011 Census population on the GEOSTAT 1 km grid (UK)
  wu03uk_bulk.csv                         to check that area codes match exactly

Outputs (build/):
  areas_geom.geojson   one (multi)polygon per area, WGS84, unsimplified (as downloaded)
  areas_points.csv     population-weighted representative point per area + QA fields
"""
import json, sys, re
from pathlib import Path
import numpy as np, pandas as pd
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union, transform
from shapely.validation import make_valid
from shapely.strtree import STRtree
from pyproj import Transformer

ROOT = Path(__file__).resolve().parent
RAW, BUILD = ROOT / "raw", ROOT / "build"
BUILD.mkdir(exist_ok=True)

def load(fn):
    return json.loads((RAW / fn).read_text())["features"]

areas = {}
for f in load("ons_cmlad_dec2011_ew_bgc.geojson"):
    p = f["properties"]
    areas[p["cmlad11cd"]] = dict(name=p["cmlad11nm"], geoms=[shape(f["geometry"])])
for f in load("ons_lad_dec2011_gb_bgc_scotland.geojson"):
    p = f["properties"]
    areas[p["lad11cd"]] = dict(name=p["lad11nm"], geoms=[shape(f["geometry"])])
for f in load("osni_lgd1993.geojson"):  # multipart LGDs arrive as several features: dissolve by code
    p = f["properties"]
    areas.setdefault(p["LGD_CODE"], dict(name=p["LGDNAME"], geoms=[]))["geoms"].append(shape(f["geometry"]))

# --- code join against the commuting table -------------------------------------------------
wu = pd.read_csv(RAW / "wu03uk_bulk.csv", usecols=[1, 2])
wu.columns = ["name", "code"]
wu = wu.drop_duplicates()
wcodes = set(wu.code)
gcodes = set(areas)
report = {
    "areas_in_flow_table": len(wcodes),
    "areas_in_boundaries": len(gcodes),
    "flow_codes_without_boundary": sorted(wcodes - gcodes),
    "boundary_codes_without_flows": sorted(gcodes - wcodes),
}
print(json.dumps(report, indent=1))
assert not report["flow_codes_without_boundary"] and not report["boundary_codes_without_flows"], "code join failed"
census_name = dict(zip(wu.code, wu.name))

def nation(code):
    return {"E": "England", "W": "Wales", "S": "Scotland", "9": "Northern Ireland"}[code[0]]

# --- projected geometries (EPSG:3035, metres, equal-area) -------------------------------------
to3035 = Transformer.from_crs(4326, 3035, always_xy=True).transform
to4326 = Transformer.from_crs(3035, 4326, always_xy=True).transform
codes = sorted(areas)
geom4326 = {c: unary_union([make_valid(x) for x in areas[c]["geoms"]]).buffer(0) for c in codes}
geom3035 = {c: transform(to3035, geom4326[c]) for c in codes}

# --- population-weighted representative points from the 1 km grid -----------------------------
g = pd.read_csv(RAW / "ons_geostat2011_uk_1km_population.csv")
m = g.grd_newid.str.extract(r"^1kmN(\d+)E(\d+)$").astype(int)
g["x"] = m[1] * 1000 + 500  # cell centre, EPSG:3035
g["y"] = m[0] * 1000 + 500
pts = [Point(x, y) for x, y in zip(g.x, g.y)]
tree = STRtree([geom3035[c] for c in codes])
assigned = np.full(len(g), -1)
hits = tree.query(pts, predicate="within")
assigned[hits[0]] = hits[1]
un = np.where(assigned < 0)[0]
# cells whose centre falls just outside the generalised coastline: nearest area within 2 km
near_idx, dist = tree.query_nearest([pts[i] for i in un], return_distance=True, all_matches=False)
ok = dist <= 2000
assigned[un[near_idx[0][ok]]] = near_idx[1][ok]
g["area"] = [codes[i] if i >= 0 else None for i in assigned]
unassigned_pop = int(g.loc[g.area.isna(), "tot_p"].sum())
print("grid cells", len(g), "population", int(g.tot_p.sum()), "unassigned population", unassigned_pop,
      "snapped cells", int(ok.sum()))

rows = []
for c in codes:
    sub = g[g.area == c]
    pop = int(sub.tot_p.sum())
    wx = float((sub.x * sub.tot_p).sum() / pop)
    wy = float((sub.y * sub.tot_p).sum() / pop)
    method = "population-weighted centroid (2011 1km grid)"
    if not geom3035[c].contains(Point(wx, wy)):
        # weighted mean falls outside the area (e.g. crescent shapes / water): use nearest populated cell
        d = (sub.x - wx) ** 2 + (sub.y - wy) ** 2
        j = d.idxmin()
        wx, wy = float(sub.x[j]), float(sub.y[j])
        method = "populated 1km cell nearest the population-weighted centroid (centroid fell outside area)"
    lon, lat = to4326(wx, wy)
    rows.append(dict(code=c, name=census_name[c], boundary_name=areas[c]["name"], nation=nation(c),
                     lon=round(lon, 5), lat=round(lat, 5), grid_population_2011=pop, grid_cells=len(sub),
                     point_method=method, area_km2=round(geom3035[c].area / 1e6, 1)))
df = pd.DataFrame(rows)
df.to_csv(BUILD / "areas_points.csv", index=False)
print(df.groupby("nation").grid_population_2011.sum())
print(df.point_method.value_counts())

fc = {"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {"code": c, "name": census_name[c], "nation": nation(c)}, "geometry": mapping(geom4326[c])}
    for c in codes]}
(BUILD / "areas_geom.geojson").write_text(json.dumps(fc))
(BUILD / "qa_geography.json").write_text(json.dumps(dict(report, unassigned_grid_population=unassigned_pop,
    snapped_coastal_cells=int(ok.sum()), points_moved_inside=int((df.point_method != "population-weighted centroid (2011 1km grid)").sum())), indent=1))
