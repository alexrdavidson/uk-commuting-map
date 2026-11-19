#!/usr/bin/env bash
# Rebuild every static data file used by the site from the raw downloads.
# Requirements: Python 3.11+ with pandas numpy shapely pyproj igraph leidenalg scikit-learn; Node 20+ (for mapshaper).
set -euo pipefail
cd "$(dirname "$0")"
npm install --no-audit --no-fund >/dev/null          # mapshaper
[ -f raw/wu03uk_bulk.csv ] || python3 download.py
mkdir -p build
python3 build_geography.py          # 404 areas, joins, population-weighted representative points
python3 build_network.py            # flows, QA, Leiden communities (3 resolutions), TTWA comparison  (~3 min)
python3 build_app_data.py ../public/data
python3 build_history.py ../public/data
echo "Done. Static files are in public/data/"
