# Next step: coloured flow maps for 1981, 1991, 2001 and 2021/22

Decided with the user (19 Nov 2026):
- Add every census year that has origin–destination workplace tables: **1981, 1991, 2001, 2021/22**.
- Show 2021/22 as **one UK map** with a clear banner about mixed dates (E&W and NI on 21 March 2021, Scotland on 20 March 2022) and pandemic effects.
- Years before 1981 keep evidence markers only. Before 1921 there was no workplace question; 1921–1971 tables are printed only.

## Done so far
- `pipeline/raw/c2021/odwp01ew_ltla.csv`: Census 2021 ODWP01EW, LTLA level, from `https://www.nomisweb.co.uk/output/census/2021/odwp01ew.zip` (entry `ODWP01EW_LTLA.csv`).
  - SHA-256 `7bbbf58494cb1a1bc69e00ebacaa281647688bddc84cbce2d28a850c069c1033`. Accessed 2026-11-19.
  - 74,721 rows; 331 residence LTLAs. Destinations include S12 (Scotland) and N09 (NI) codes, plus `-8` (not in employment), `888888888` (offshore) and `999999999` (outside UK).
  - Place-of-work indicator: "Working in the UK but not working at or from home" (15,094,828); "Mainly working at or from home, No fixed place" (12,586,796, **combined**, unlike 2011); "Other" (91,904); "Does not apply" (20,792,704, exclude).
  - **No method of travel** in the public 2021 flow tables, so disable the mode filter for that year.

## To do
1. **Scotland 2022:** NRS origin–destination workplace table at council-area level (start at https://www.scotlandscensus.gov.uk/documents/scotlands-census-2022-origin-destination-tables-council-area/). Use residence-based rows only, so cross-border flows are counted once.
2. **Northern Ireland 2021:** NISRA origin–destination workplace table at LGD 2014 level (11 districts): https://www.nisra.gov.uk/statistics/census-2021-results/origin-destination
3. **Boundaries for 2021/22:** ONS "Local Authority Districts (December 2022) Boundaries UK BGC" (one layer covers E, W, S and NI codes). Recompute population-weighted points (use the 2011 GEOSTAT grid and label it as such, or a 2021 grid if available).
4. **1981, 1991, 2001:** the UK Data Service flow-data service (https://wicid.ukdataservice.ac.uk/) holds the Special Workplace Statistics.
   - 1981 is OGL. The service may still need a free UK Data Service login: **the user signs in themselves**, then downloads district-level SWS (2001 Level 3 districts; 1991 Set C or district level; 1981 Set C county/district) into `pipeline/raw/c1981`, `c1991` and `c2001`.
   - Nomis also has open GB-only 2001 LAD travel-to-work flows.
   - Prefer the "CIDS 1991/2001 common geography – districts" for a like-for-like 1991 vs 2001 comparison.
5. **Pipeline:** generalise `build_geography.py` and `build_network.py` to take a year and output `areas_<year>.json`, `flows_<year>.csv` and `communities_<year>.json` (same Leiden settings: γ 0.5/1/2, seeds 0–99). Match community colours to 2011 by hub area name or code where it persists.
6. **App:**
   - Add a census-year switch to the "2011 map" view (rename it "Census map").
   - In the timeline, draw layer A whenever the slider is on a census year that has a table, with a banner naming that year's date, geography and caveats.
   - Never interpolate between census years.
   - Hide the mode filter where a year has no mode data. Update methodology, sources.json, the coverage table and tests.
