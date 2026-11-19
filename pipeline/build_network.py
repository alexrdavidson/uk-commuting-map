"""Step 2: commuting network (2011 WU03UK) + exploratory commuting communities (Leiden).

Analytical network (documented in METHODOLOGY.md):
  * nodes: the 404 census merged local authority areas of the UK (2011)
  * edges: every origin->destination pair between DIFFERENT areas with >= 1 commuter (no display threshold)
  * weights: undirected, w(i,j) = flow(i->j) + flow(j->i)  (all modes, people aged 16+ in employment)
  * within-area commuting, home-working, no-fixed-place, offshore and outside-UK workers are NOT edges;
    they are kept as per-area totals and shown separately in the app.
  * Leiden (leidenalg 0.10/0.12, RBConfigurationVertexPartition = modularity with resolution gamma)
    run with seeds 0..N-1; the partition with highest quality is kept; stability across seeds reported.
"""
import json, itertools
from pathlib import Path
import numpy as np, pandas as pd, igraph as ig, leidenalg as la
from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score, normalized_mutual_info_score

ROOT = Path(__file__).resolve().parent
RAW, BUILD = ROOT / "raw", ROOT / "build"
RESOLUTION = 1.0
N_SEEDS = 100

MODES = ["metro", "train", "bus", "taxi", "moto", "car", "passenger", "bicycle", "foot", "other"]
COLS = ["date", "res_name", "res", "wp_name", "wp", "all", "home"] + MODES
df = pd.read_csv(RAW / "wu03uk_bulk.csv")
df.columns = COLS
qa = {"rows_in_file": len(df)}
dups = df[df.duplicated(["res", "wp"], keep=False)]
qa["duplicate_rows"] = int(df.duplicated(["res", "wp"]).sum())
qa["duplicate_destinations"] = sorted(dups.wp.unique().tolist())
qa["duplicates_identical"] = bool(dups.groupby(["res", "wp"]).nunique().max().max() == 1)
df = df.drop_duplicates(["res", "wp"])
LA = r"^(E41|W40|S12|95)"
agg = df[~df.wp.str.match(LA) & ~df.wp.str.startswith("OD")]
qa["aggregate_destination_codes_dropped"] = sorted(agg.wp.unique().tolist())
la_rows = df[df.wp.str.match(LA)].copy()
od = df[df.wp.str.startswith("OD")]
qa["mode_sum_mismatches"] = int((df[["home"] + MODES].sum(axis=1) != df["all"]).sum())
qa["negative_values"] = int((df[["all", "home"] + MODES] < 0).sum().sum())
qa["missing_values"] = int(df[["all", "home"] + MODES].isna().sum().sum())
qa["home_mode_on_area_destinations"] = int((la_rows.home > 0).sum())
qa["explicit_zero_pairs"] = int((la_rows["all"] == 0).sum())
uk = df[df.wp == "K02000001"].set_index("res")["all"].sort_index()
qa["area_destinations_sum_equals_UK_aggregate"] = bool((la_rows.groupby("res")["all"].sum().sort_index() == uk).all())

pts = pd.read_csv(BUILD / "areas_points.csv").set_index("code")
codes = list(pts.index)
idx = {c: i for i, c in enumerate(codes)}

inter = la_rows[(la_rows.res != la_rows.wp) & (la_rows["all"] > 0)]
intra = la_rows[la_rows.res == la_rows.wp].set_index("res")
specials = od.pivot(index="res", columns="wp", values="all").fillna(0).astype(int)

# ---------------- per-area totals ----------------
areas = []
for c in codes:
    out = inter[inter.res == c]
    inn = inter[inter.wp == c]
    within = int(intra.loc[c, "all"]) if c in intra.index else 0
    sp = specials.loc[c]
    resident_workers = int(df[(df.res == c) & (df.wp.str.match(LA) | df.wp.str.startswith("OD"))]["all"].sum())
    areas.append(dict(
        code=c, name=pts.loc[c, "name"], nation=pts.loc[c, "nation"],
        lon=float(pts.loc[c, "lon"]), lat=float(pts.loc[c, "lat"]),
        resident_workers=resident_workers,          # all usual residents 16+ in employment
        within=within,                              # live and work in this area (workplace address, not home)
        out_total=int(out["all"].sum()),            # work in another UK area
        in_total=int(inn["all"].sum()),             # live in another UK area, work here
        home=int(sp.get("OD0000001", 0)), no_fixed=int(sp.get("OD0000003", 0)),
        offshore=int(sp.get("OD0000002", 0)), outside_uk=int(sp.get("OD0000004", 0)),
        jobs_filled=int(within + inn["all"].sum()), # people with a workplace address in this area
        point_method=pts.loc[c, "point_method"],
    ))
a = pd.DataFrame(areas)
assert (a.resident_workers == a.within + a.out_total + a.home + a.no_fixed + a.offshore + a.outside_uk).all()
qa["total_resident_workers"] = int(a.resident_workers.sum())
qa["total_between_areas"] = int(a.out_total.sum())
qa["total_within_areas"] = int(a.within.sum())
qa["total_home"] = int(a.home.sum()); qa["total_no_fixed"] = int(a.no_fixed.sum())
qa["total_offshore"] = int(a.offshore.sum()); qa["total_outside_uk"] = int(a.outside_uk.sum())
qa["flows_between_areas_nonzero"] = len(inter)

# ---------------- network + Leiden ----------------
und = {}
for r in inter.itertuples():
    i, j = idx[r.res], idx[r.wp]
    k = (min(i, j), max(i, j))
    und[k] = und.get(k, 0) + r.all
edges = list(und.keys())
G = ig.Graph(n=len(codes), edges=edges)
G.es["weight"] = [und[e] for e in edges]
qa["undirected_edges"] = len(edges)

def run(seed, gamma=RESOLUTION):
    return la.find_partition(G, la.RBConfigurationVertexPartition, weights="weight",
                             resolution_parameter=gamma, seed=seed, n_iterations=-1)


RESOLUTIONS = [0.5, 1.0, 2.0]   # offered in the app; 1.0 (standard modularity) is the default

def best_partition(gamma, n):
    ps = [run(s, gamma) for s in range(n)]
    q = [p.quality() for p in ps]
    k = int(np.argmax(q))
    m = np.array(ps[k].membership)
    am = [adjusted_mutual_info_score(m, p.membership) for j, p in enumerate(ps) if j != k]
    return m, k, am

results = {}
for gamma in RESOLUTIONS:
    m, k, am = best_partition(gamma, N_SEEDS if gamma == RESOLUTION else 50)
    results[gamma] = dict(memb=m, seed=k, ami_mean=float(np.mean(am)), ami_min=float(np.min(am)),
                          modularity=G.modularity(m, weights="weight"))
    print(f"gamma={gamma}: seed {k}, {len(set(m))} communities, modularity {results[gamma]['modularity']:.4f}, "
          f"AMI vs other seeds mean {np.mean(am):.3f} min {np.min(am):.3f}")
memb = results[RESOLUTION]["memb"]

sens = []
for gamma in [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0]:
    ps = [run(s, gamma) for s in range(20)]
    b = max(ps, key=lambda p: p.quality())
    sens.append(dict(resolution=gamma, communities=len(set(b.membership)),
                     modularity=round(G.modularity(b.membership, weights="weight"), 4),
                     ami_vs_default=round(adjusted_mutual_info_score(memb, b.membership), 3)))
print(pd.DataFrame(sens).to_string(index=False))

same = sum(w for (i, j), w in und.items() if memb[i] == memb[j])
qa["share_between_area_commuting_within_communities"] = round(same / sum(und.values()), 4)

# ---------------- geometry adjacency (for colouring) ----------------
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
geom = json.loads((BUILD / "areas_geom.geojson").read_text())["features"]
gshape = {f["properties"]["code"]: shape(f["geometry"]) for f in geom}
gtree = STRtree([gshape[c] for c in codes])
touch = set()
for i, c in enumerate(codes):
    for j in gtree.query(gshape[c].buffer(0.01)):
        if int(j) != i:
            touch.add((min(i, int(j)), max(i, int(j))))

PALETTE = ["#e3262b", "#2f6fdb", "#2fa84f", "#f08a0c", "#8e3fbf", "#00a3a3", "#e04fa6", "#a6a600",
           "#b5651d", "#1f9e89", "#5b5bd6", "#d4a106", "#c2185b", "#3b8b2e", "#0d8fd1", "#8d6e3f",
           "#ef5b5b", "#6a3d9a", "#00897b", "#b8860b", "#4c72b0", "#dd8452"]
hub_color = {}
comm_out = {}
key = lambda g: ("r" + str(g)).replace(".", "_")
for gamma in [RESOLUTION] + [g for g in RESOLUTIONS if g != RESOLUTION]:
    mb = results[gamma]["memb"]
    a["_c"] = mb
    order = a.groupby("_c").jobs_filled.sum().sort_values(ascending=False).index.tolist()
    remap = {old: new for new, old in enumerate(order)}
    a[key(gamma)] = a["_c"].map(remap)
    cm = a[key(gamma)].values
    adj = {c: set() for c in range(len(order))}
    for i, j in touch:
        if cm[i] != cm[j]:
            adj[cm[i]].add(cm[j]); adj[cm[j]].add(cm[i])
    for (i, j), w in und.items():
        if cm[i] != cm[j] and w >= 2000:
            adj[cm[i]].add(cm[j]); adj[cm[j]].add(cm[i])
    comms, colors = [], {}
    for cid in range(len(order)):
        m = a[a[key(gamma)] == cid]
        hub = m.sort_values("jobs_filled", ascending=False).iloc[0]
        used_nb = {colors[n] for n in adj[cid] if n in colors}
        used_here = set(colors.values())
        if hub.code in hub_color and hub_color[hub.code] not in used_nb and hub_color[hub.code] not in used_here:
            col = hub_color[hub.code]
        else:
            # prefer a colour unused at this resolution and not used by any hub elsewhere, then any non-neighbour colour
            taken = set(hub_color.values())
            cands = [c for c in PALETTE if c not in used_here and c not in used_nb and c not in taken] or \
                    [c for c in PALETTE if c not in used_here and c not in used_nb] or \
                    [c for c in PALETTE if c not in used_nb]
            col = cands[0]
            hub_color.setdefault(hub.code, col)
        colors[cid] = col
        comms.append(dict(id=cid, hub_code=hub.code, hub_name=hub["name"], members=len(m), color=col,
                          nations=sorted(m.nation.unique().tolist()),
                          resident_workers=int(m.resident_workers.sum()), jobs_filled=int(m.jobs_filled.sum()),
                          neighbours=sorted(int(x) for x in adj[cid])))
    comm_out[key(gamma)] = dict(resolution=gamma, seed=results[gamma]["seed"], modularity=round(results[gamma]["modularity"], 4),
                                stability_ami_mean=round(results[gamma]["ami_mean"], 3), stability_ami_min=round(results[gamma]["ami_min"], 3),
                                communities=comms)
a = a.drop(columns=["_c"])
a["community"] = a[key(RESOLUTION)]
best_seed = results[RESOLUTION]["seed"]; mod = results[RESOLUTION]["modularity"]
amis = [results[RESOLUTION]["ami_mean"], results[RESOLUTION]["ami_min"]]

# ---------------- comparison with ONS 2011 Travel to Work Areas ----------------
tt = json.loads((RAW / "ons_ttwa2011_uk_bsc.geojson").read_text())["features"]
tgeo = [shape(f["geometry"]).buffer(0) for f in tt]
tree = STRtree(tgeo)
ttwa = []
for r in a.itertuples():
    p = Point(r.lon, r.lat)
    hit = tree.query(p, predicate="within")
    if len(hit) == 0:
        hit = [tree.nearest(p)]
    ttwa.append(tt[int(hit[0])]["properties"]["TTWA11CD"])
a["ttwa11"] = ttwa
qa["ttwa_comparison"] = dict(
    ttwas_containing_area_points=int(a.ttwa11.nunique()),
    nmi=round(normalized_mutual_info_score(a.ttwa11, a.community), 3),
    ami=round(adjusted_mutual_info_score(a.ttwa11, a.community), 3),
    ari=round(adjusted_rand_score(a.ttwa11, a.community), 3),
    note="TTWAs (228) are built by ONS from LSOA-level 2011 flows with self-containment rules; "
         "our communities come from LA-level flows with modularity, so they are coarser and not expected to match.")
comms = comm_out[key(RESOLUTION)]["communities"]
a.to_csv(BUILD / "areas.csv", index=False)
inter_out = inter[["res", "wp", "all"] + MODES].copy()
inter_out.to_csv(BUILD / "flows_between_areas.csv", index=False)
(BUILD / "communities.json").write_text(json.dumps(comm_out, indent=1))
(BUILD / "network_meta.json").write_text(json.dumps(dict(
    method="Leiden (leidenalg, RBConfigurationVertexPartition = modularity with resolution parameter)",
    leidenalg_version=la.version, igraph_version=ig.__version__,
    resolution=RESOLUTION, seeds_tried=N_SEEDS, chosen_seed=best_seed, n_iterations="until stable (-1)",
    communities=len(comms), modularity=round(mod, 4), resolutions_offered=RESOLUTIONS,
    stability_ami_mean=round(amis[0], 3), stability_ami_min=round(amis[1], 3),
    weighting="undirected; weight = commuters A->B + commuters B->A, all modes",
    direction="flows symmetrised for community detection only; the map keeps direction",
    self_loops="excluded (within-area commuting is shown separately, not as a network edge)",
    threshold="none: all 108,142 non-zero between-area flows are used before any display filter",
    sensitivity=sens, qa=qa), indent=1))
print(json.dumps(qa, indent=1))
for k, v in comm_out.items():
    print(k); print(pd.DataFrame(v["communities"])[["id", "hub_name", "members", "jobs_filled", "color"]].to_string(index=False))
