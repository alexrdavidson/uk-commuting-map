import { useMemo } from 'react'
import { type Snapshot, type ModeFilter, type ResKey, MODES, MODE_LABEL, RES_LABEL, flowValue, fmt } from '../data'

export const MIN_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]

interface Props {
  snap: Snapshot
  mode: ModeFilter
  min: number
  res: ResKey
  ttwa: boolean
  onMode: (m: ModeFilter) => void
  onMin: (n: number) => void
  onRes: (r: ResKey) => void
  onTtwa: (b: boolean) => void
}

export default function Controls({ snap, mode, min, res, ttwa, onMode, onMin, onRes, onTtwa }: Props) {
  const stats = useMemo(() => {
    const f = snap.flows
    let shown = 0, shownPeople = 0, all = 0, allPeople = 0
    for (let k = 0; k < f.n; k++) {
      const v = flowValue(f, k, mode)
      if (v <= 0) continue
      all++; allPeople += v
      if (v >= min) { shown++; shownPeople += v }
    }
    return { shown, shownPeople, all, allPeople }
  }, [snap, mode, min])
  const step = MIN_STEPS.indexOf(min) >= 0 ? MIN_STEPS.indexOf(min) : MIN_STEPS.findIndex((s) => s >= min)
  const comms = snap.communities[res]

  return (
    <div className="controls">
      <div className="ctl">
        <label htmlFor="mode-select">Method of travel</label>
        <select id="mode-select" value={mode} onChange={(e) => onMode(e.target.value as ModeFilter)}>
          <option value="all">{MODE_LABEL.all}</option>
          {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
        </select>
      </div>
      <div className="ctl">
        <label htmlFor="min-range">Draw connections with at least <b>{fmt(min)}</b> {min === 1 ? 'person' : 'people'}</label>
        <input id="min-range" type="range" min={0} max={MIN_STEPS.length - 1} step={1} value={Math.max(0, step)}
          aria-valuetext={`${min} people`} onChange={(e) => onMin(MIN_STEPS[+e.target.value])} />
        <p className="hint">
          Drawing {fmt(stats.shown)} of {fmt(stats.all)} connections between areas, covering {((100 * stats.shownPeople) / Math.max(1, stats.allPeople)).toFixed(1)}% of
          the {fmt(stats.allPeople)} people who commuted between areas{mode !== 'all' ? ' by this method' : ''}.
          Hidden: {fmt(stats.all - stats.shown)} smaller connections ({fmt(stats.allPeople - stats.shownPeople)} people). Hidden connections still count in every total and appear in area lists.
        </p>
      </div>
      <div className="ctl">
        <span className="lbl" id="res-label">Community detail</span>
        <div className="seg small" role="radiogroup" aria-labelledby="res-label">
          {(['r0_5', 'r1_0', 'r2_0'] as ResKey[]).map((r) => (
            <button key={r} role="radio" aria-checked={res === r} className={res === r ? 'on' : ''} onClick={() => onRes(r)}>
              {RES_LABEL[r]} <small>{snap.communities[r].communities.length}</small>
            </button>
          ))}
        </div>
        <p className="hint">Leiden resolution {comms.resolution}: {comms.communities.length} exploratory communities, modularity {comms.modularity}. These aren't official regions.</p>
      </div>
      <label className="check">
        <input type="checkbox" checked={ttwa} onChange={(e) => onTtwa(e.target.checked)} />
        Compare with official ONS Travel to Work Areas (2011)
      </label>
    </div>
  )
}
