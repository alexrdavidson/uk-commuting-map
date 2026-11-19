import { useEffect, useRef, useState } from 'react'
import { type Snapshot, fmt } from '../data'

interface SourceEntry {
  id: string; publisher: string; title: string; table_id?: string; year: string; geography: string
  url: string; download_url?: string; accessed: string; licence: string; sha256?: string; notes?: string
}

export default function Methodology({ snap, onClose }: { snap: Snapshot; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [sources, setSources] = useState<SourceEntry[]>([])
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/sources.json').then((r) => r.json()).then((j) => setSources(j.sources)).catch(() => setSources([]))
    ref.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  const m = snap.meta, q = m.qa
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="meth-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Close methodology">×</button>
        <h2 id="meth-title">Methodology, sources and limitations</h2>

        <h3>What the map shows</h3>
        <p>Each line joins the area where a group of people <b>lived</b> to the area where they <b>worked</b>, as recorded in the 2011 Census
          (census day: 27 March 2011) for the whole United Kingdom. Lines are <b>statistical connections between representative points</b>. They don't show roads, railways or the routes people took.
          The counts are people with a recorded home and workplace. They are <b>not counts of daily trips</b>: the census doesn't record how often people travelled, and some
          people work part-time, shifts or from several places.</p>
        <p>This is a <b>historical baseline</b>: commuting has changed since 2011, especially since the COVID-19 pandemic. It doesn't describe today's commuting.</p>

        <h3>Data</h3>
        <ul>
          <li>Table WU03UK, “Location of usual residence and place of work by method of travel to work”, 2011 Census, merged local authority level (ONS, National Records of Scotland and NISRA, published via Nomis).
            Population: usual residents aged 16 and over in employment in the week before the census: {fmt(q.total_resident_workers)} people.</li>
          <li>Geography: 404 areas. That's 324 English and 22 Welsh census merged local authorities (the City of London is merged with Westminster, and the Isles of Scilly with Cornwall),
            32 Scottish council areas and the 26 Northern Ireland districts in use in 2011.</li>
          <li>Of these people, {fmt(q.total_between_areas)} worked in a different area (drawn as lines), {fmt(q.total_within_areas)} lived and worked in the same area,
            {' '}{fmt(q.total_home)} worked mainly at or from home, {fmt(q.total_no_fixed)} had no fixed place of work, {fmt(q.total_offshore)} worked offshore and {fmt(q.total_outside_uk)} worked outside the UK.
            None of these groups are dropped. They appear in each area's figures but have no line, because they have no second area to connect to.</li>
          <li>Method of travel is the main method by distance. The source provides 10 travel categories plus “work mainly at or from home”. The mode filter uses exactly those categories.</li>
          <li>Statistical disclosure control: the census offices swapped some records between areas, so small counts are approximate. WU03UK publishes zeros explicitly and has no suppressed cells.
            {' '}{fmt(q.explicit_zero_pairs as number)} area pairs are published as zero. Nothing was set to zero by this site.</li>
        </ul>

        <h3>Processing and checks</h3>
        <ul>
          <li>The bulk file lists {fmt(q.rows_in_file as number)} rows, including region, country and UK totals as destinations. Those aggregate rows were removed
            so that nothing is double counted. Three country-level destination rows appear twice in the source with identical values and were de-duplicated.</li>
          <li>Checks: every area code in the flow table matches exactly one boundary (404/404, no unmatched codes). Every row's travel methods sum to its total.
            For every area, the sum of area-level destinations equals the source's own UK total. No negative or missing values.</li>
          <li>Representative points: the population-weighted centre of each area, from the 2011 Census population on the 1 km GEOSTAT grid (ONS), computed in an equal-area projection (EPSG:3035)
            and stored as WGS84 longitude/latitude. In 7 areas where the centre fell outside the area (for example in an estuary), the nearest populated 1 km cell inside the area was used.</li>
        </ul>

        <h3>Commuting communities</h3>
        <p>Colours show <b>exploratory commuting communities</b> found by the Leiden algorithm ({m.method}; leidenalg {m.leidenalg_version}) on the full analytical network,
          computed <b>before</b> any display filter:</p>
        <ul>
          <li>Network: all {fmt(q.flows_between_areas_nonzero)} non-zero flows between different areas, all travel methods. {m.threshold.replace(/^none: /, 'No threshold: ')}.</li>
          <li>Weighting and direction: {m.weighting}. Direction is ignored for clustering only. The map keeps it.</li>
          <li>Same-area commuting: {m.self_loops}.</li>
          <li>Resolution: γ = {m.resolution} (standard modularity) by default, giving {m.communities} communities (modularity {m.modularity}).
            “Broad” and “Detailed” use γ = 0.5 and γ = 2.0. Seeds: {m.seeds_tried} runs (seeds 0–{m.seeds_tried - 1}), keeping the highest-quality partition (seed {m.chosen_seed}).
            Stability across seeds: mean adjusted mutual information {m.stability_ami_mean} (minimum {m.stability_ami_min}).</li>
          <li>{(q.share_between_area_commuting_within_communities * 100).toFixed(1)}% of between-area commuting stays inside a community.</li>
          <li>Colours are matched across resolutions by each community's largest workplace area, so the same hub keeps its colour where possible. A colour change between resolutions means the clustering changed, not that commuting changed.</li>
          <li>Comparison with ONS 2011 Travel to Work Areas (228 areas built with a different method from finer data): adjusted mutual information {q.ttwa_comparison.ami}, normalised mutual information {q.ttwa_comparison.nmi}.
            The communities are coarser and are <b>not official regions</b>.</li>
        </ul>
        <table className="sens"><caption>Sensitivity to the resolution parameter (best of 20 seeds each)</caption>
          <thead><tr><th>γ</th><th>Communities</th><th>Modularity</th><th>AMI vs default</th></tr></thead>
          <tbody>{m.sensitivity.map((s) => <tr key={s.resolution}><td>{s.resolution}</td><td>{s.communities}</td><td>{s.modularity}</td><td>{s.ami_vs_default}</td></tr>)}</tbody>
        </table>

        <h3>Why 2011 and not 2021?</h3>
        <p>2011 is the most recent census with origin–destination workplace flows published on <b>one date and one definition for all four UK nations</b>.
          Census 2021 in England, Wales and Northern Ireland took place on 21 March 2021, during a COVID-19 lockdown and furlough. ONS advises caution with its travel-to-work data,
          and many people's recorded workplace or travel method reflected those conditions. Scotland's census moved to 20 March 2022. Mixing the two would combine different dates, pandemic conditions and definitions,
          so this first version doesn't do that.</p>

        <h3>Journey links</h3>
        <p>The Google Maps buttons use Google's documented Maps URLs, with the two representative points as start and end (or text you type, which isn't stored).
          Google shows its own estimates. This site doesn't fetch, store or display journey times, and makes no paid API calls.</p>

        <h3>Commute stories</h3>
        <p>“People making this journey” lists a small number of public first-person accounts that name both ends of the journey and the method. Each was opened and checked on the date shown.
          Times are self-reported anecdotes, not statistics. Where none is verified, the section says so.</p>

        <h3>Sources</h3>
        {sources.length === 0 ? <p>Source manifest unavailable.</p> : (
          <ul className="sources">
            {sources.map((s) => (
              <li key={s.id}><b>{s.title}</b>{s.table_id ? ` (${s.table_id})` : ''}. {s.publisher}. {s.year}. {s.geography}. Licence: {s.licence}. Accessed {s.accessed}.
                {' '}<a href={s.url} target="_blank" rel="noopener noreferrer">Source page</a>
                {s.download_url && <> · <a href={s.download_url} target="_blank" rel="noopener noreferrer">download</a></>}
                {s.notes && <><br /><small>{s.notes}</small></>}
              </li>
            ))}
          </ul>
        )}
        <p className="small">Reproducible processing scripts, checksums and full documentation are in the project repository (README, METHODOLOGY.md, sources.json).</p>
      </div>
    </div>
  )
}
