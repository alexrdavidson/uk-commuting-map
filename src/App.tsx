import { useCallback, useEffect, useMemo, useState } from 'react'
import MapView from './MapView'
import { loadSnapshot2011, type Snapshot, fmt } from './data'
import { parseHash, toHash, type ViewState, PRESENT_YEAR } from './urlState'
import { loadHistory, type HistoryData, activeRecords, activeInfra, snapshotFor } from './history'
import { loadStories, type Story } from './stories'
import Search from './components/Search'
import Controls from './components/Controls'
import AreaPanel from './components/AreaPanel'
import FlowPanel from './components/FlowPanel'
import Methodology from './components/Methodology'
import SubmitStory from './components/SubmitStory'
import { TimelineBar, TimelinePanel, type Layers } from './components/Timeline'
import './App.css'

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [q])
  return m
}

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [hist, setHist] = useState<HistoryData | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<ViewState>(() => parseHash(window.location.hash))
  const [focusKey, setFocusKey] = useState(() => (window.location.hash ? 'init' : ''))
  const [showMeth, setShowMeth] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [sheet, setSheet] = useState<'peek' | 'half' | 'full'>('peek')
  const [layers, setLayers] = useState<Layers>({ stats: true, journeys: true, infra: true, recon: false })
  const [copied, setCopied] = useState(false)
  const mobile = useMedia('(max-width: 760px)')

  useEffect(() => {
    loadSnapshot2011().then(setSnap).catch((e) => setError(String(e.message ?? e)))
    loadHistory().then(setHist).catch(() => setHist(null))
    loadStories().then(setStories).catch(() => setStories([]))
    const open = () => setShowSubmit(true)
    document.addEventListener('open-submit', open)
    return () => document.removeEventListener('open-submit', open)
  }, [])

  // URL hash <-> state
  useEffect(() => {
    const h = toHash(state)
    if (h !== window.location.hash && !(h === '' && window.location.hash === '')) {
      history.replaceState(null, '', h || window.location.pathname + window.location.search)
    }
  }, [state])
  useEffect(() => {
    const f = () => { setState(parseHash(window.location.hash)); setFocusKey('hash' + Date.now()) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const update = useCallback((patch: Partial<ViewState>, focus = false) => {
    setState((s) => ({ ...s, ...patch }))
    if (focus) setFocusKey(String(Date.now()))
  }, [])
  const selectArea = useCallback((code?: string) => {
    update({ area: code, flow: undefined }, !!code)
    if (code && mobile) setSheet('half')
  }, [update, mobile])
  const selectFlow = useCallback((o: string, d: string) => { update({ flow: [o, d], area: undefined }, true); if (mobile) setSheet('half') }, [update, mobile])

  // validate codes from the URL
  useEffect(() => {
    if (!snap) return
    if (state.area && !snap.byCode.has(state.area)) update({ area: undefined })
    if (state.flow && (!snap.byCode.has(state.flow[0]) || !snap.byCode.has(state.flow[1]))) update({ flow: undefined })
  }, [snap]) // eslint-disable-line react-hooks/exhaustive-deps

  const timelineSnap = hist && state.timeline ? snapshotFor(hist, state.year, PRESENT_YEAR) : null
  const showFlows = !state.timeline || (layers.stats && !!timelineSnap && timelineSnap.snap.inApp)
  const histLayer = useMemo(() => {
    if (!hist || !state.timeline) return null
    return {
      journeys: activeRecords(hist, state.year, layers.recon).filter((r) => (r.layer === 'statistic' ? layers.stats : layers.journeys)),
      infra: layers.infra ? activeInfra(hist, state.year) : [],
      selected: state.rec, showRecon: layers.recon,
    }
  }, [hist, state.timeline, state.year, state.rec, layers])

  const share = async () => {
    const url = window.location.href
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { window.prompt?.('Copy this link', url) }
  }

  const leftPad = mobile ? 0 : 420
  const bottomPad = mobile ? (sheet === 'peek' ? 150 : sheet === 'half' ? window.innerHeight * 0.5 : window.innerHeight * 0.85) : state.timeline ? 120 : 0

  let content
  if (!snap) content = error ? <div className="panel"><p className="note warn">The commuting data couldn't load: {error}. Check your connection and reload the page.</p></div> : <div className="panel loading" aria-busy="true"><div className="spinner" />Loading 108,142 connections between 404 areas…</div>
  else if (state.timeline && hist) content = (
    <TimelinePanel hist={hist} year={state.year} layers={layers} selected={state.rec} onLayers={setLayers}
      onSelect={(id) => update({ rec: id }, false)} onYear={(y) => update({ year: y })} />
  )
  else if (state.timeline && !hist) content = <div className="panel"><p className="note">The historical records couldn't load.</p></div>
  else if (state.flow) content = <FlowPanel snap={snap} o={state.flow[0]} d={state.flow[1]} mode={state.mode} stories={stories}
    onArea={(c) => selectArea(c)} onFlow={selectFlow} onClose={() => update({ flow: undefined })} />
  else if (state.area) content = <AreaPanel snap={snap} code={state.area} dir={state.dir} mode={state.mode} min={state.min} res={state.res} stories={stories}
    onDir={(d) => update({ dir: d })} onFlow={selectFlow} onClose={() => selectArea(undefined)} />
  else content = <Overview snap={snap} res={state.res} />

  return (
    <div className={`app ${state.timeline ? 'with-timeline' : ''}`}>
      <MapView snap={snap} showFlows={showFlows} res={state.res} mode={state.mode} min={state.min} dir={state.dir}
        area={state.timeline ? undefined : state.area} flow={state.timeline ? undefined : state.flow} ttwa={state.ttwa && !state.timeline}
        leftPad={leftPad} bottomPad={bottomPad} hist={histLayer} focusKey={focusKey}
        onSelectArea={(c) => { if (!state.timeline) selectArea(c) }}
        onSelectFlow={(o, d) => { if (!state.timeline) selectFlow(o, d) }}
        onSelectRecord={(id) => { update({ rec: id }); if (mobile) setSheet('half') }} />

      <aside className={`sidebar sheet-${sheet}`} aria-label="Map controls and details">
        {mobile && <button className="sheet-handle" aria-label={sheet === 'full' ? 'Collapse panel' : 'Expand panel'}
          onClick={() => setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek')}><span /></button>}
        <header className="masthead">
          <h1>{state.timeline ? <><span>200 years of the</span> <span>British commute</span></> : <><span>The UK, connected</span> <span>by commuting</span></>}</h1>
          <p className="subtitle">{state.timeline
            ? <>Verified evidence of journeys to work, 1800 to now: census statistics, individual accounts and the lines that carried them</>
            : <>Where people lived and worked on census day, 27 March 2011: all four UK nations, 404 local authority areas</>}</p>
          <div className="tabs" role="tablist" aria-label="View">
            <button role="tab" aria-selected={!state.timeline} className={!state.timeline ? 'on' : ''} onClick={() => update({ timeline: false, rec: undefined }, true)}>2011 map</button>
            <button role="tab" aria-selected={state.timeline} className={state.timeline ? 'on' : ''} onClick={() => update({ timeline: true, area: undefined, flow: undefined })}>Timeline, 1800–now</button>
          </div>
          {!state.timeline && snap && <Search areas={snap.areas} onPick={selectArea} />}
        </header>
        <div className="sidebar-body">
          {content}
          {snap && !state.timeline && (
            <Controls snap={snap} mode={state.mode} min={state.min} res={state.res} ttwa={state.ttwa}
              onMode={(m) => update({ mode: m })} onMin={(n) => update({ min: n })} onRes={(r) => update({ res: r })} onTtwa={(b) => update({ ttwa: b })} />
          )}
        </div>
        <footer className="sidebar-foot">
          <button className="link" onClick={() => setShowMeth(true)}>Methodology & sources</button>
          <button className="link" onClick={() => setShowSubmit(true)}>Share your commute</button>
          <button className="link" onClick={share} aria-live="polite">{copied ? 'Link copied' : 'Copy link to this view'}</button>
        </footer>
      </aside>

      {state.timeline && hist && (
        <div className="timeline-wrap">
          <TimelineBar hist={hist} year={state.year} onYear={(y) => update({ year: y })} />
          {timelineSnap && timelineSnap.snap.inApp && layers.stats && <p className="tl-badge">{timelineSnap.latest ? `Showing ${timelineSnap.snap.label}, the latest UK-wide flows. Not current commuting.` : `Showing ${timelineSnap.snap.label}`}</p>}
        </div>
      )}

      {!state.timeline && <Legend res={state.res} snap={snap} area={!!state.area} />}
      {showMeth && snap && <Methodology snap={snap} onClose={() => setShowMeth(false)} />}
      {showSubmit && <SubmitStory onClose={() => setShowSubmit(false)} />}
    </div>
  )
}

function Overview({ snap, res }: { snap: Snapshot; res: 'r0_5' | 'r1_0' | 'r2_0' }) {
  const q = snap.meta.qa
  const comms = snap.communities[res].communities
  return (
    <section className="panel overview">
      <p className="lede">Each line links an area where people <b>lived</b> to an area where they <b>worked</b>. Colours show {comms.length} commuting communities found in the data.
        Lines are statistical connections between area centres, <b>not</b> the roads or railways people used.</p>
      <div className="kpis">
        <div><b>{fmt(q.total_resident_workers)}</b><span>employed residents</span></div>
        <div><b>{fmt(q.total_between_areas)}</b><span>worked in another area</span></div>
        <div><b>{fmt(q.total_within_areas)}</b><span>lived and worked in the same area</span></div>
        <div><b>{fmt(q.total_home)}</b><span>worked mainly at or from home</span></div>
      </div>
      <p className="hint">Click an area, or search, to see its main destinations and origins. This is a 2011 historical baseline, not a picture of commuting today.</p>
      <ul className="comm-list" aria-label="Commuting communities">
        {comms.map((c) => (
          <li key={c.id}><i style={{ background: c.color }} />{snap.byCode.get(c.hub_code)?.label}<small>{c.members} areas</small></li>
        ))}
      </ul>
    </section>
  )
}

function Legend({ res, snap, area }: { res: 'r0_5' | 'r1_0' | 'r2_0'; snap: Snapshot | null; area: boolean }) {
  if (!snap) return null
  return (
    <div className="legend" aria-label="Legend">
      {area ? (
        <>
          <p><i className="ln out" />Residents' workplaces</p>
          <p><i className="ln in" />Where workers live</p>
          <p className="small">Arcs fade at the home end and strengthen at the workplace.</p>
        </>
      ) : (
        <>
          <p className="lg-title">Line colour: community of the home area ({snap.communities[res].communities.length})</p>
          <p className="widths"><i style={{ height: 1 }} /><i style={{ height: 2 }} /><i style={{ height: 3.5 }} /> more commuters → thicker, darker</p>
        </>
      )}
      <p className="small">Straight lines join area centres. They aren't routes.</p>
    </div>
  )
}
