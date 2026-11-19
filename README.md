# The UK, connected by commuting

**Live site: https://www.alexdavidson.me/uk-commuting-map/**

An interactive map of where people **lived** and **worked** on census day, 27 March 2011, across all four UK nations (404 local authority areas, 108,142 connections between areas). Lines are coloured by exploratory commuting communities found with the Leiden algorithm. A second view, **“200 years of the British commute”**, adds a year slider with verified historical evidence from 1807 to 2024.

Lines are statistical connections between area representative points. They are **not** routes. The 2011 data is a historical baseline, not a description of commuting today.

## What's in this repository

| Path | Contents |
|---|---|
| `src/` | React + TypeScript app (MapLibre GL JS basemap from bundled GeoJSON, deck.gl overlay) |
| `public/data/` | Compact static data produced by the pipeline (≈ 1 MB gzipped in total) |
| `public/data/sources.json` | Source manifest: publisher, table, year, geography, download URL, access date, licence, SHA-256 |
| `pipeline/` | Reproducible download and processing scripts (`run_all.sh`) |
| `tests/` | `validate_data.py` (data integrity) and `e2e.py` (browser checks) |
| `METHODOLOGY.md` | Methods, transformations, exclusions and limitations |

## Rebuild the data

```bash
cd pipeline
python3 -m pip install -r requirements.txt
python3 download.py        # needs network access to nomisweb.co.uk, services1.arcgis.com, raw.githubusercontent.com
./run_all.sh               # ~3 minutes; writes ../public/data/
python3 ../tests/validate_data.py
```

The pipeline is deterministic: re-running it from the raw files reproduces every file in `public/data/` byte for byte (Leiden runs use fixed seeds).

## Run and build the site

```bash
npm install
npm run dev                # local development
npm run build              # production build in dist/
npx vite preview --port 4173 &
python3 tests/e2e.py http://localhost:4173/    # needs Playwright for Python and Chrome
```

## Deployment

The live site is built and published by GitHub Pages on every push to `main` (`.github/workflows/pages.yml`, free for public repositories). `VITE_SITE_URL` in that workflow sets the absolute URL used for the social preview image.

### Alternative: Cloudflare Pages (free plan, £0/month)

1. Choose the final URL (for example `https://uk-commuting.pages.dev` or your own domain) and build with it, so the social preview image has an absolute URL:
   ```bash
   VITE_SITE_URL=https://uk-commuting.pages.dev npm run build
   ```
2. Deploy the static folder with Wrangler (you'll be asked to log in to Cloudflare once):
   ```bash
   npx wrangler pages project create uk-commuting --production-branch main
   npx wrangler pages deploy dist --project-name uk-commuting
   ```
   Alternatively, in the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Upload assets** and drag in the `dist` folder. Or connect a Git repository with build command `npm run build`, output directory `dist`, and environment variable `VITE_SITE_URL`.
3. Open the URL, check that the map loads, and paste the URL into a link-preview checker to confirm `og-image.png` appears.

`public/_headers` sets long caching for hashed assets and one day for data files.

**Costs.** Static hosting on the Cloudflare Pages free plan (documented limits at the time of writing: 20,000 files per site, 25 MiB per file, 500 builds a month; this site uses about 30 files, the largest about 2.4 MB). No server, database, accounts, API keys or paid APIs. The basemap is bundled GeoJSON (no tile service), fonts are self-hosted, and journey estimates open in Google Maps through public Maps URLs, which need no key. Optional extras with possible costs: a custom domain (registrar fees), and in-site journey times (not built; would need a routing provider, see METHODOLOGY.md).

## Commute story submissions

The “Share your commute” dialog composes a submission and never publishes anything automatically. To receive submissions, set one of these at build time:

```bash
VITE_SUBMIT_EMAIL=you@example.org        # adds a "Send by email" button (mailto)
VITE_SUBMIT_FORM_URL=https://…            # or a link to a form you control (for example Tally or Google Forms)
```

Review each submission against the public post before adding it to `pipeline/build_history.py` (STORIES), then re-run the pipeline.

## Licences and attribution

Census data © Crown copyright (ONS, NRS, NISRA), Open Government Licence v3.0. Boundaries: ONS Open Geography Portal and OSNI (OGL); contains OS data © Crown copyright and database right. Context land: Natural Earth (public domain). Historical sources are linked on each evidence card. Code: choose a licence before publishing (MIT suggested).
