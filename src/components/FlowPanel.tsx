import { useState } from 'react'
import { type Snapshot, type ModeFilter, MODES, MODE_SHORT, MODE_COLOR, MODE_LABEL, findFlow, fmt, pct, googleMapsUrl, latlon, type TravelMode } from '../data'
import type { Story } from '../stories'
import StoryList from './StoryList'

interface Props {
  snap: Snapshot
  o: string
  d: string
  mode: ModeFilter
  stories: Story[]
  onArea: (code: string) => void
  onFlow: (o: string, d: string) => void
  onClose: () => void
}

export default function FlowPanel({ snap, o, d, mode, stories, onArea, onFlow, onClose }: Props) {
  const A = snap.byCode.get(o)!, B = snap.byCode.get(d)!
  const k = findFlow(snap, A.i, B.i)
  const rk = findFlow(snap, B.i, A.i)
  const f = snap.flows
  const total = k >= 0 ? f.total[k] : 0
  const reverse = rk >= 0 ? f.total[rk] : 0
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const sorted = k >= 0 ? MODES.map((m) => ({ m, v: f.modes[m][k] })).sort((x, y) => y.v - x.v) : []
  const pair = stories.filter((s) => s.origin_code === o && s.destination_code === d)
  const originOnly = stories.filter((s) => s.origin_code === o && !s.destination_code)

  const og = start.trim() || latlon(A), dg = end.trim() || latlon(B)
  const gm = (t: TravelMode) => googleMapsUrl(og, dg, t)

  return (
    <section className="panel" aria-labelledby="flow-title">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Selected connection · 2011 Census</p>
          <h2 id="flow-title">
            <button className="link-strong" onClick={() => onArea(o)}>{A.name}</button>
            <span className="arrow" aria-label="to"> → </span>
            <button className="link-strong" onClick={() => onArea(d)}>{B.name}</button>
          </h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close connection">×</button>
      </div>

      {k < 0 ? (
        <p className="note">The 2011 table records no residents of {A.name} working in {B.name}. That is an explicit zero in the source table, not missing data.</p>
      ) : (
        <>
          <p className="big-number">{fmt(total)} <span>people</span></p>
          <p className="lede">lived in {A.name} and had their workplace in {B.name} on census day, 27 March 2011.
            That is {pct(total, A.resident_workers)} of {A.name}'s employed residents and {pct(total, B.jobs_filled)} of people with a workplace in {B.name}.</p>
          {mode !== 'all' && <p className="note">Map filter: {MODE_LABEL[mode]}: {fmt(f.modes[mode][k])} people.</p>}
          <p className="reverse">In the other direction: <button className="link" onClick={() => onFlow(d, o)}>{fmt(reverse)} people</button> lived in {B.name} and worked in {A.name}.</p>

          <h3 className="list-title">Main method of travel to work</h3>
          <div className="modebar" role="img" aria-label="Share of people by main method of travel">
            {sorted.filter((x) => x.v > 0).map((x) => <i key={x.m} title={`${MODE_SHORT[x.m]}: ${fmt(x.v)}`} style={{ width: `${(100 * x.v) / total}%`, background: MODE_COLOR[x.m] }} />)}
          </div>
          <table className="mode-table">
            <tbody>
              {sorted.map((x) => (
                <tr key={x.m} className={x.v === 0 ? 'zero' : ''}>
                  <td><i style={{ background: MODE_COLOR[x.m] }} />{MODE_LABEL[x.m]}</td>
                  <td>{fmt(x.v)}</td><td>{pct(x.v, total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">“Method of travel” is the one used for the longest part, by distance, of the usual journey to work. Census figures are adjusted by record swapping to protect confidentiality, so small counts are approximate.</p>
        </>
      )}

      <div className="gmaps">
        <h3 className="list-title">View journey options in Google Maps</h3>
        <div className="gm-buttons">
          <a className="btn" href={gm('driving')} target="_blank" rel="noopener noreferrer">Driving</a>
          <a className="btn" href={gm('bicycling')} target="_blank" rel="noopener noreferrer">Cycling</a>
          <a className="btn" href={gm('transit')} target="_blank" rel="noopener noreferrer">Public transport</a>
        </div>
        <p className="hint">Opens Google Maps in a new tab, which shows its own current route and time estimates where available. This site doesn't calculate or show journey times, and the census doesn't record them.
          By default the route runs between each area's <b>representative point</b> (a population-weighted centre), not individual homes or workplaces.</p>
        <details className="refine">
          <summary>Refine the start or end (optional)</summary>
          <label>Start <input value={start} onChange={(e) => setStart(e.target.value)} placeholder={`e.g. a station or street in ${A.name}`} autoComplete="off" /></label>
          <label>End <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder={`e.g. a station or street in ${B.name}`} autoComplete="off" /></label>
          <p className="hint">What you type here stays in your browser and is only added to the Google Maps link. It isn't saved, sent to this site or added to the share link.</p>
        </details>
      </div>

      <StoryList stories={[...pair, ...originOnly]} heading="People making this journey" snap={snap}
        emptyText="No verified public first-person account of this journey yet." />

      <p className="source">Source: 2011 Census table WU03UK (location of usual residence and place of work by method of travel to work), local authority level. ONS, NRS and NISRA via Nomis. Open Government Licence v3.0.</p>
    </section>
  )
}
