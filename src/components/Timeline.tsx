import { useEffect, useMemo, useState } from 'react'
import { type HistoryData, type HistRecord, TIMELINE_START, activeInfra, activeRecords, snapshotFor, evidenceYears, nearestDocumented } from '../history'
import { googleMapsUrl, type TravelMode } from '../data'
import { PRESENT_YEAR } from '../urlState'

export interface Layers { stats: boolean; journeys: boolean; infra: boolean; recon: boolean }

export function TimelineBar({ hist, year, onYear }: { hist: HistoryData; year: number; onYear: (y: number) => void }) {
  const [playing, setPlaying] = useState(false)
  const ys = useMemo(() => evidenceYears(hist), [hist])
  const kinds = useMemo(() => {
    const m = new Map<number, Set<string>>()
    const add = (y: number, k: string) => { if (!m.has(y)) m.set(y, new Set()); m.get(y)!.add(k) }
    hist.records.forEach((r) => { add(r.start, r.layer); if (r.end !== r.start) add(r.end, r.layer) })
    hist.infrastructure.forEach((x) => { add(x.openedYear, 'infra'); if (x.closedYear) add(x.closedYear, 'infra') })
    hist.snapshots.forEach((s) => add(s.year, 'statistic'))
    return m
  }, [hist])
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      onYear(year >= PRESENT_YEAR ? PRESENT_YEAR : year + 1)
      if (year >= PRESENT_YEAR) setPlaying(false)
    }, 180)
    return () => clearInterval(t)
  }, [playing, year, onYear])
  const prev = [...ys].reverse().find((y) => y < year)
  const next = ys.find((y) => y > year)
  const span = PRESENT_YEAR - TIMELINE_START
  const pos = (y: number) => `${((y - TIMELINE_START) / span) * 100}%`
  return (
    <div className="timeline-bar" role="group" aria-label="Timeline">
      <div className="tl-year" aria-live="polite"><span className="sr-only">Selected year </span>{year === PRESENT_YEAR ? <>{year}<small>present</small></> : year}</div>
      <div className="tl-main">
        <div className="tl-track">
          {ys.map((y) => (
            <button key={y} className={`tick ${[...(kinds.get(y) ?? [])].join(' ')}`} style={{ left: pos(y) }}
              onClick={() => onYear(y)} aria-label={`Evidence in ${y}`} title={`${y}: ${[...(kinds.get(y) ?? [])].join(', ')}`} />
          ))}
          <input type="range" min={TIMELINE_START} max={PRESENT_YEAR} step={1} value={year}
            aria-label="Year" aria-valuetext={String(year)} onChange={(e) => onYear(+e.target.value)} />
        </div>
        <div className="tl-scale" aria-hidden>{[1800, 1850, 1900, 1950, 2000].map((y) => <span key={y} style={{ left: pos(y) }}>{y}</span>)}<span style={{ left: '100%' }}>now</span></div>
      </div>
      <div className="tl-buttons">
        <button onClick={() => prev !== undefined && onYear(prev)} disabled={prev === undefined} aria-label={`Previous evidence${prev ? ` (${prev})` : ''}`}>‹ {prev ?? ''}</button>
        <button onClick={() => { if (year >= PRESENT_YEAR) onYear(TIMELINE_START); setPlaying(!playing) }} aria-pressed={playing} aria-label={playing ? 'Pause' : 'Play through the years'}>{playing ? '❚❚' : '▶'}</button>
        <button onClick={() => next !== undefined && onYear(next)} disabled={next === undefined} aria-label={`Next evidence${next ? ` (${next})` : ''}`}>{next ?? ''} ›</button>
      </div>
    </div>
  )
}

interface PanelProps {
  hist: HistoryData
  year: number
  layers: Layers
  selected?: string
  onLayers: (l: Layers) => void
  onSelect: (id?: string) => void
  onYear: (y: number) => void
}

export function TimelinePanel({ hist, year, layers, selected, onLayers, onSelect, onYear }: PanelProps) {
  const all = activeRecords(hist, year, layers.recon)
  const recs = all.filter((r) => r.layer !== 'statistic')
  const statRecs = all.filter((r) => r.layer === 'statistic')
  const infra = activeInfra(hist, year)
  const snap = snapshotFor(hist, year, PRESENT_YEAR)
  const rec = selected ? hist.records.find((r) => r.id === selected) : undefined
  const near = nearestDocumented(hist, year)
  const empty = all.length === 0 && !snap
  const [showCoverage, setShowCoverage] = useState(false)

  if (rec) return <RecordCard r={rec} year={year} onBack={() => onSelect(undefined)} onYear={onYear} />

  return (
    <section className="panel" aria-labelledby="tl-title">
      <p className="eyebrow">Timeline · selected year {year}</p>
      <h2 id="tl-title">What the evidence shows for {year}</h2>
      <p className="lede small">Move the year slider to see what verified evidence exists for each period. Every item keeps its own documented dates. Nothing is interpolated between them.</p>

      <fieldset className="layers">
        <legend>Evidence layers</legend>
        <label><input type="checkbox" checked={layers.stats} onChange={(e) => onLayers({ ...layers, stats: e.target.checked })} /><i className="lg lg-stat" />A. Statistical commuting flows</label>
        <label><input type="checkbox" checked={layers.journeys} onChange={(e) => onLayers({ ...layers, journeys: e.target.checked })} /><i className="lg lg-journey" />B. Documented individual journeys</label>
        <label><input type="checkbox" checked={layers.infra} onChange={(e) => onLayers({ ...layers, infra: e.target.checked })} /><i className="lg lg-infra" />C. Transport infrastructure open this year</label>
        <label><input type="checkbox" checked={layers.recon} onChange={(e) => onLayers({ ...layers, recon: e.target.checked })} /><i className="lg lg-recon" />D. Reconstructions (off by default)</label>
      </fieldset>

      <div className="tl-section">
        <h3 className="list-title"><i className="lg lg-stat" />Statistical flows</h3>
        {snap ? (
          <p className={snap.latest ? 'note warn' : 'note'}>
            {snap.latest ? <>Latest UK-wide flows available: <b>{snap.snap.label}</b>. These are from {snap.snap.year}, not current commuting.</> : <><b>{snap.snap.label}</b> ({snap.snap.coverage}).</>}
            {layers.stats ? ' Drawn on the map.' : ' Turn on layer A to draw them.'}
          </p>
        ) : (
          <p className="hint">No statistical flow table is loaded for {year}. {hist.snapshots.filter((s) => !s.inApp).length > 0 && 'Some earlier census years published workplace statistics, listed below, but they aren\'t drawn as a network here.'}</p>
        )}
        {statRecs.length > 0 && (
          <ul className="rec-list">
            {statRecs.map((r) => (
              <li key={r.id}><button onClick={() => onSelect(r.id)}>
                <span className="rec-title">{r.title}</span>
                <span className="rec-meta">{r.dateLabel} · official count · {r.region}</span>
              </button></li>
            ))}
          </ul>
        )}
        {hist.snapshots.filter((s) => !s.inApp).map((s) => (
          <p key={s.id} className="hint"><b>{s.year}:</b> {s.note} <a href={s.sources[0]?.url} target="_blank" rel="noopener noreferrer">Source</a></p>
        ))}
      </div>

      <div className="tl-section">
        <h3 className="list-title"><i className="lg lg-journey" />Documented journeys valid in {year}</h3>
        {recs.length === 0 ? (
          <p className="note">No verified evidence available for this selection.
            {near !== undefined && near !== year && <> Nearest documented period: <button className="link" onClick={() => onYear(near)}>{near}</button>.</>}</p>
        ) : (
          <ul className="rec-list">
            {recs.map((r) => (
              <li key={r.id}><button onClick={() => onSelect(r.id)}>
                <span className="rec-title">{r.layer === 'reconstruction' && <span className="pill dashed">Reconstruction</span>}{r.title}</span>
                <span className="rec-meta">{r.dateLabel} · {r.mode ?? 'mode not recorded'} · {r.region}</span>
              </button></li>
            ))}
          </ul>
        )}
      </div>

      <div className="tl-section">
        <h3 className="list-title"><i className="lg lg-infra" />Infrastructure open in {year}</h3>
        {infra.length === 0 ? <p className="hint">None of the documented lines in this small set had opened by {year}.</p> : (
          <ul className="infra-list">
            {infra.map((x) => <li key={x.id}><b>{x.name}</b> · {x.dateLabel} <a href={x.sources[0]?.url} target="_blank" rel="noopener noreferrer">source</a></li>)}
          </ul>
        )}
        <p className="hint">Infrastructure shows what existed, not proof that a particular commute happened. Lines are schematic (straight between documented stations).</p>
      </div>

      {empty && <p className="note">No verified evidence available for this selection.</p>}

      <button className="link" onClick={() => setShowCoverage(!showCoverage)}>{showCoverage ? 'Hide' : 'Show'} evidence coverage by period</button>
      {showCoverage && (
        <table className="coverage"><thead><tr><th>Period</th><th>Statistics</th><th>Individual journeys</th><th>Infrastructure</th></tr></thead>
          <tbody>{hist.coverage.map((c) => <tr key={c.period}><td>{c.period}</td><td>{c.statistical}</td><td>{c.journeys}</td><td>{c.infrastructure}</td></tr>)}</tbody></table>
      )}
      <p className="hint">Surviving records are selective. They over-represent people who wrote, were interviewed or were written about, and say little about most workers.
        Place names and boundaries follow the source; the map uses present-day UK geography for orientation.</p>
    </section>
  )
}

function RecordCard({ r, year, onBack, onYear }: { r: HistRecord; year: number; onBack: () => void; onYear: (y: number) => void }) {
  const inRange = r.start <= year && year <= r.end
  const gm = (t: TravelMode) => googleMapsUrl(r.modern?.origin ?? r.origin.place, r.modern?.destination ?? r.destination.place, t)
  return (
    <section className="panel record" aria-labelledby="rec-title">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{r.layer === 'reconstruction' ? 'D. Reconstruction' : r.layer === 'statistic' ? 'A. Official count' : 'B. Documented journey'} · selected year {year}</p>
          <h2 id="rec-title">{r.title}</h2>
        </div>
        <button className="icon-btn" onClick={onBack} aria-label="Back to timeline list">×</button>
      </div>
      {!inRange && <p className="note warn">This record applies to {r.dateLabel}, not {year}. <button className="link" onClick={() => onYear(r.start)}>Go to {r.start}</button></p>}
      <dl className="card-fields">
        <div><dt>Who</dt><dd>{r.person}</dd></div>
        {r.occupation && <div><dt>Occupation</dt><dd>{r.occupation}</dd></div>}
        <div><dt>Date of journey</dt><dd>{r.dateLabel}</dd></div>
        <div><dt>From</dt><dd>{r.origin.original ?? r.origin.place} <span className="pill">{r.origin.precision}</span>{r.origin.note && <small> {r.origin.note}</small>}</dd></div>
        <div><dt>To</dt><dd>{r.destination.original ?? r.destination.place} <span className="pill">{r.destination.precision}</span>{r.destination.note && <small> {r.destination.note}</small>}</dd></div>
        <div><dt>How</dt><dd>{r.mode ?? 'Not recorded'}</dd></div>
        <div><dt>How often</dt><dd>{r.frequency ?? 'Not documented'}</dd></div>
        <div><dt>Duration</dt><dd>{r.duration ? <>{r.duration} <span className="pill">{r.durationKind}</span></> : 'Not documented'}</dd></div>
        {r.count !== undefined && <div><dt>Official count</dt><dd>{r.count.toLocaleString('en-GB')}</dd></div>}
      </dl>
      <h3 className="list-title">What the evidence establishes</h3>
      <p>{r.account}</p>
      {r.quote && <blockquote>“{r.quote}”</blockquote>}
      {r.caveats && <p className="note">{r.caveats}</p>}
      <h3 className="list-title">Sources</h3>
      <ul className="sources">
        {r.sources.map((s, i) => (
          <li key={i}><b>{s.title}</b>{s.author && `, ${s.author}`}{s.institution && ` (${s.institution})`}{s.published && `. Published ${s.published}`}.
            {s.ref && ` ${s.ref}.`} <a href={s.url} target="_blank" rel="noopener noreferrer">Open source</a> <small>checked {s.accessed}</small></li>
        ))}
      </ul>
      <p className="hint">The line on the map joins the two ends for orientation. It isn't the historical route.</p>
      {r.modern && (
        <div className="gmaps then-now">
          <h3 className="list-title">Then and now</h3>
          <p className="hint">{r.modern.note}</p>
          <p className="hint">Google's modern estimate is separate from the historical evidence above{r.duration ? ' and is not comparable like for like with the recorded duration' : ''}.</p>
          <div className="gm-buttons single">
            <span className="lbl">Explore this journey today in Google Maps:</span>
            <a className="btn" href={gm('transit')} target="_blank" rel="noopener noreferrer">Public transport</a>
            <a className="btn" href={gm('driving')} target="_blank" rel="noopener noreferrer">Driving</a>
            <a className="btn" href={gm('bicycling')} target="_blank" rel="noopener noreferrer">Cycling</a>
          </div>
        </div>
      )}
    </section>
  )
}
