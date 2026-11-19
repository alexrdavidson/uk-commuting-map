# Methodology

## 1. Choice of dataset

**2011 Census table WU03UK** (location of usual residence and place of work by method of travel to work), merged local authority level, published by ONS, NRS and NISRA via Nomis (dataset NM_1207_1). It is the most recent origin–destination workplace table that covers **all four UK nations on one census day (27 March 2011) with one definition**. Population: usual residents aged 16 and over in employment in the week before the census (30,008,634 people).

Not used in this first version:
- **Census 2021** (England and Wales, Northern Ireland: 21 March 2021). It was taken during a COVID-19 lockdown with furlough in place. ONS advises caution with its travel-to-work outputs, and the “mainly work at or from home” definition changed.
- **Scotland's Census 2022** (20 March 2022). It was a year later, under different conditions.

Combining them would mix dates, pandemic effects and definitions, so they're left as documented next steps.

Finer public tables (for example WU03EW at MSOA level) cover England and Wales only. Using them alongside council-area data for Scotland and Northern Ireland would give a map with uneven resolution, so the UK-wide local authority table was chosen.

## 2. Processing (pipeline/)

1. **Download** (`download.py`). The Nomis bulk query `usual_residence=TYPE270` returns every residence area against every destination, including region, country and UK totals. SHA-256 checksums are recorded in `public/data/sources.json`.
2. **Clean** (`build_network.py`):
   - Drop aggregate destinations (E12 regions; E92, W92, S92, N92 countries; K02–K04) so nothing is double counted.
   - De-duplicate 1,212 repeated country rows. They are identical in the source.
   - Keep special destinations as per-area totals: OD0000001 mainly at/from home; OD0000002 offshore; OD0000003 no fixed place; OD0000004 outside UK.
   - Checks, all passing: travel methods sum to the total on every row; no negative or missing values; the sum of area destinations equals the source's own UK total for every area; home-working appears only on the home destination.
   - 54,670 area pairs are explicit zeros in the source. There is no suppression in this table, and no value was set to zero by the pipeline.
3. **Geography** (`build_geography.py`):
   - England and Wales: ONS Census Merged LADs (Dec 2011, 346).
   - Scotland: ONS LAD Dec 2011 (32 council areas, 2011 S12 codes).
   - Northern Ireland: OSNI 26 Local Government Districts (95xx codes). The service returns multipart districts as 68 features, which are dissolved by code.
   - All 404 flow-table codes join exactly to one boundary each; there are no unmatched codes.
4. **Representative points.** These are population-weighted centres from the ONS GEOSTAT 2011 1 km population grid:
   - Cell centres are derived from the grid IDs in EPSG:3035 (equal-area). Points-in-polygon are assigned in EPSG:3035; 1,671 coastal cells within 2 km were snapped to the nearest area, and no population was left unassigned.
   - The weighted means are converted to WGS84.
   - For 7 areas whose centre fell outside the area (estuaries and bays: Halton, Torbay, North East Derbyshire, Great Yarmouth, South Staffordshire, Adur, Sefton), the nearest populated cell inside the area was used.
   - Grid totals by nation match the 2011 Census closely: England 53.01m, Wales 3.06m, Scotland 5.29m, NI 1.79m.
5. **Display geometry.** Topology-aware simplification with mapshaper keeps shared borders aligned. Context land outside the UK comes from Natural Earth.

## 3. Commuting communities

- **Network:** 404 nodes. Edges are all 108,142 non-zero flows between different areas, all travel methods, with **no threshold**. Communities are computed before any display filter.
- **Weights and direction:** undirected weight = flow A→B + flow B→A. Direction is ignored only for clustering; the map keeps it.
- **Same-area commuting** (12.98m people) is excluded from the network. Self-loops would add to node strength without saying anything about links between areas. It is shown separately for each area.
- **Algorithm:** Leiden (leidenalg 0.12, `RBConfigurationVertexPartition`, i.e. modularity with resolution γ), `n_iterations=-1`.
  - Seeds 0–99 are run and the partition with the highest quality is kept (seed 42 at γ = 1).
  - Default γ = 1.0 (standard modularity): 13 communities, modularity 0.715. Mean adjusted mutual information (AMI) across seeds is 0.90 (minimum 0.83).
  - The app also offers γ = 0.5 (8 communities) and γ = 2.0 (20 communities), each the best of 50 seeds.
  - A sensitivity table for γ from 0.5 to 5 is in `public/data/network_meta_2011.json`.
- **Result:** 85.3% of between-area commuting stays inside a community at γ = 1.
- **Comparison with ONS 2011 Travel to Work Areas:** AMI 0.42, NMI 0.66. TTWAs are finer (228) and built with a different method from LSOA-level data. The communities are labelled **exploratory**, not official regions.
- **Colours:**
  - Communities are named after their largest workplace area.
  - Colours are assigned so that neighbouring or strongly linked communities differ, and are matched across resolutions by hub. A colour change between resolutions is a modelling change, not a change in commuting.

## 4. What the map does and doesn't show

- A line is a count of people with a recorded home area and workplace area. It is **not** a count of daily trips and not a route. Part-time, shift and hybrid patterns aren't recorded.
- The default display threshold (10 people) hides 76,820 smaller connections (2.2% of between-area commuters). The panel always states what is hidden. Hidden flows remain in every total and in each area's list.
- Census record swapping makes small counts approximate.
- The mode filter uses the source's own categories: the main method by distance.
- **Google Maps buttons** use documented Maps URLs (`https://www.google.com/maps/dir/?api=1&origin=…&destination=…&travelmode=driving|bicycling|transit`) between representative points, or text the user types. That text isn't stored or added to share links. The site shows no journey times and the census has none.
- **In-site journey times** aren't implemented. Before adding them, verify the provider's coverage, pricing, attribution, caching and map-display terms. Keep traffic-aware driving estimates, timetable-based public transport estimates and modelled cycling times clearly distinguished.

## 5. “People making this journey”

There are five public first-person accounts (British Cycling 2012; Londonist 2018 ×3; The Scotsman 2024). Each was opened and checked on 2026-11-19. An account is linked to a census area pair only when the author names both ends clearly. Durations are self-reported and labelled with their kind (door to door, station to station). No profiles, activity histories or restricted pages were used.

## 6. “200 years of the British commute”

Evidence layers:
- **A. Statistical:** the 2011 table, plus two headline figures from the 1921 Census General Report. The 1921 flow tables aren't digitised here.
- **B. Documented journeys:** 14 records from 1832 to 2024.
- **C. Infrastructure:** 9 lines with documented opening dates and, where relevant, closure dates.
- **D. Reconstructions:** none yet. The layer is off by default and would use dashed styling.

Rules:
- Each record keeps its own validity interval. A one-off account shows only in its own year.
- Gaps show “No verified evidence available for this selection” with the nearest documented period.
- At the present-day end of the slider, the 2011 table is labelled as the latest available UK-wide data, not current commuting.
- Infrastructure is schematic: straight segments between documented stations, with coordinates from the cited station articles. It shows what existed, not who commuted.
- Individual accounts are never scaled as counts.

Known gaps:
- No verified individual journeys for Wales or Northern Ireland, and none before 1832.
- Statistical coverage between 1921 and 2011 isn't loaded.
- Historical basemap overlays aren't included: the National Library of Scotland's terms and usage limits weren't confirmed in this release, so source links are given instead.
- Surviving records over-represent people who wrote, were interviewed or were written about.
