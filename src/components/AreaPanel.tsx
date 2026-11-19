import { useState } from 'react'
import { type Snapshot, type ModeFilter, type ResKey, flowValue, fmt, pct, MODE_LABEL } from '../data'
import type { Dir } from '../urlState'
import type { Story } from '../stories'
import StoryList from './StoryList'

interface Props {
  snap: Snapshot
  code: string
  dir: Dir
  mode: ModeFilter
  min: number
  res: ResKey
  stories: Story[]
  onDir: (d: Dir) => void
  onFlow: (o: string, d: string) => void
  onClose: () => void
}

export default function AreaPanel({ snap, code, dir, mode, min, res, stories, onDir, onFlow, onClose }: Props) {
  const a = snap.byCode.get(code)!
  const [showAll, setShowAll] = useState(false)
  const comm = snap.communities[res].communities[a.c[res]]
  const f = snap.flows
  const listDir: 'out' | 'in' = dir === 'in' ? 'in' : 'out'
  const idx = (listDir === 'out' ? snap.outIdx : snap.inIdx)[a.i]
    .map((k) => ({ k, v: flowValue(f, k, mode) })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v)
  const total = idx.reduce((s, x) => s + x.v, 0)
  const hidden = idx.filter((x) => x.v < min)
  const rows = showAll ? idx : idx.slice(0, 15)
  const maxV = idx[0]?.v ?? 1
  const areaStories = stories.filter((s) => s.origin_code === code || s.destination_code === code)

  return (
    <section className="panel" aria-labelledby="area-title">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{a.nation} · census area, 2011</p>
          <h2 id="area-title">{a.name}</h2>
          <p className="community-tag"><i style={{ background: comm.color }} />Commuting community centred on {snap.byCode.get(comm.hub_code)?.name}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close area">×</button>
      </div>

      <dl className="stats">
        <div><dt>Residents in employment</dt><dd>{fmt(a.resident_workers)}</dd></div>
        <div><dt>Live and work in {a.name}</dt><dd>{fmt(a.within)} <small>{pct(a.within, a.resident_workers)}</small></dd></div>
        <div><dt>Commute to another UK area</dt><dd>{fmt(a.out_total)} <small>{pct(a.out_total, a.resident_workers)}</small></dd></div>
        <div><dt>Work mainly at or from home</dt><dd>{fmt(a.home)} <small>{pct(a.home, a.resident_workers)}</small></dd></div>
        <div><dt>No fixed place of work</dt><dd>{fmt(a.no_fixed)} <small>{pct(a.no_fixed, a.resident_workers)}</small></dd></div>
        <div><dt>Offshore installation / outside UK</dt><dd>{fmt(a.offshore)} / {fmt(a.outside_uk)}</dd></div>
        <div className="wide"><dt>People working here who live in another area</dt><dd>{fmt(a.in_total)} <small>of {fmt(a.jobs_filled)} with a workplace here</small></dd></div>
      </dl>

      <div className="seg" role="radiogroup" aria-label="Direction of flows on the map">
        {(['out', 'in', 'both'] as Dir[]).map((d) => (
          <button key={d} role="radio" aria-checked={dir === d} className={dir === d ? 'on' : ''} onClick={() => onDir(d)}>
            {d === 'out' ? <><i className="dot out" />Out: workplaces</> : d === 'in' ? <><i className="dot in" />In: homes</> : 'Both ways'}
          </button>
        ))}
      </div>

      <h3 className="list-title">
        {listDir === 'out' ? `Main workplaces of ${a.name} residents` : `Where people working in ${a.name} live`}
        {mode !== 'all' && <small> · {MODE_LABEL[mode]}</small>}
      </h3>
      <p className="hint">Choose a row to select that journey. {idx.length} areas, {fmt(total)} people.</p>
      <ol className="flow-list">
        {rows.map(({ k, v }) => {
          const other = snap.areas[listDir === 'out' ? f.d[k] : f.o[k]]
          const below = v < min
          return (
            <li key={k} className={below ? 'below' : ''}>
              <button onClick={() => onFlow(snap.areas[f.o[k]].code, snap.areas[f.d[k]].code)}>
                <span className="nm">{other.name}</span>
                <span className="bar" aria-hidden><i style={{ width: `${(100 * v) / maxV}%`, background: listDir === 'out' ? 'var(--out)' : 'var(--in)' }} /></span>
                <span className="num">{fmt(v)}</span>
                {below && <span className="tag">not drawn</span>}
              </button>
            </li>
          )
        })}
      </ol>
      {idx.length > 15 && <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${idx.length}`}</button>}
      {hidden.length > 0 && (
        <p className="note">The map hides {hidden.length} of these connections ({fmt(hidden.reduce((s, x) => s + x.v, 0))} people) because each has fewer than {fmt(min)} people. They are still listed here and counted in the totals.</p>
      )}
      {dir === 'both' && <p className="note">The map shows both directions. The list shows where residents work; switch to “In: homes” to list inbound connections.</p>}
      <StoryList stories={areaStories} heading={`People describing journeys to or from ${a.name}`} snap={snap} />
    </section>
  )
}
