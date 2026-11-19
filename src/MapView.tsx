import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type StyleSpecification, type IControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { LineLayer, ArcLayer, ScatterplotLayer, TextLayer, PathLayer } from '@deck.gl/layers'
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions'
import type { Layer, PickingInfo } from '@deck.gl/core'
import { type Snapshot, type ModeFilter, type ResKey, type Area, flowValue, hexToRgb, fmt } from './data'
import type { Dir } from './urlState'
import type { HistRecord, InfraFeature, Station } from './history'

export interface MapProps {
  snap: Snapshot | null
  showFlows: boolean
  res: ResKey
  mode: ModeFilter
  min: number
  dir: Dir
  area?: string
  flow?: [string, string]
  ttwa: boolean
  bottomPad: number
  leftPad: number
  hist: { journeys: HistRecord[]; infra: InfraFeature[]; selected?: string; showRecon: boolean } | null
  onSelectArea: (code: string | undefined) => void
  onSelectFlow: (o: string, d: string) => void
  onSelectRecord: (id: string) => void
  focusKey: string
}

const BASE = import.meta.env.BASE_URL
const UK_BOUNDS: [number, number, number, number] = [-8.65, 49.86, 1.77, 60.87]
const OUT_COLOR: [number, number, number] = [214, 72, 15]
const IN_COLOR: [number, number, number] = [28, 110, 214]

const style: StyleSpecification = {
  version: 8,
  sources: {
    context: { type: 'geojson', data: BASE + 'data/context_land.geo.json' },
    areas: { type: 'geojson', data: BASE + 'data/areas_2011.geo.json', promoteId: 'code' },
    nations: { type: 'geojson', data: BASE + 'data/nation_borders.geo.json' },
    ttwa: { type: 'geojson', data: BASE + 'data/ttwa_2011.geo.json' },
  },
  layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': '#e9eef2' } },
    { id: 'context', type: 'fill', source: 'context', paint: { 'fill-color': '#f2f2ef' } },
    {
      id: 'areas-fill', type: 'fill', source: 'areas',
      paint: {
        'fill-color': ['coalesce', ['feature-state', 'tint'], '#fbfbf8'],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 1],
      },
    },
    {
      id: 'areas-line', type: 'line', source: 'areas',
      paint: {
        'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#3b4650', '#dadfe3'],
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1.6, 0.5],
      },
    },
    { id: 'nations', type: 'line', source: 'nations', paint: { 'line-color': '#9aa4ad', 'line-width': 1 } },
    {
      id: 'ttwa', type: 'line', source: 'ttwa', layout: { visibility: 'none' },
      paint: { 'line-color': '#2b2b2b', 'line-width': 1, 'line-opacity': 0.55, 'line-dasharray': [3, 2] },
    },
  ],
}

export default function MapView(p: MapProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(5)
  const [viewV, setViewV] = useState(0)
  const handlers = useRef(p)
  handlers.current = p

  // ---- create map once ----
  useEffect(() => {
    if (!el.current) return
    const map = new maplibregl.Map({
      container: el.current, style, bounds: UK_BOUNDS, fitBoundsOptions: { padding: 20 },
      attributionControl: false, dragRotate: false, pitchWithRotate: false, maxZoom: 11, minZoom: 3.5,
      renderWorldCopies: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: 'Census data: ONS, NRS, NISRA (OGL v3). Boundaries: ONS, OSNI (OGL); contains OS data © Crown copyright. Context land: Natural Earth.',
    }), 'bottom-right')
    const overlay = new MapboxOverlay({
      interleaved: false, layers: [], pickingRadius: 6,
      onClick: (info: PickingInfo, ev) => {
        const h = handlers.current
        const id = info.layer?.id
        const obj = info.object as unknown
        if (id === 'hist-journeys' || id === 'hist-markers') { h.onSelectRecord((obj as HistRecord).id); return }
        if ((id === 'flows' || id === 'sel-flows') && h.snap && typeof obj === 'number') {
          const s = h.snap
          h.onSelectFlow(s.areas[s.flows.o[obj]].code, s.areas[s.flows.d[obj]].code); return
        }
        if (id === 'points' && obj) { h.onSelectArea((obj as { code: string }).code); return }
        const src = (ev as unknown as { srcEvent?: { point?: { x: number; y: number } } })
        const x = info.x ?? src.srcEvent?.point?.x, y = info.y ?? src.srcEvent?.point?.y
        const f = map.queryRenderedFeatures([x, y], { layers: ['areas-fill'] })[0]
        h.onSelectArea(f ? String(f.properties?.code ?? f.id) : undefined)
      },
      getTooltip: (info: PickingInfo) => tooltip(info, handlers.current.snap, handlers.current.mode),
    })
    map.addControl(overlay as unknown as IControl)
    map.on('load', () => setReady(true))
    map.on('moveend', () => { setZoom(map.getZoom()); setViewV((v) => v + 1) })
    map.on('mousemove', 'areas-fill', () => { map.getCanvas().style.cursor = 'pointer' })
    mapRef.current = map
    overlayRef.current = overlay
    return () => { map.remove() }
  }, [])

  // ---- padding for sidebar / bottom sheet ----
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.fitBounds(UK_BOUNDS, { padding: { top: 30, bottom: 30 + p.bottomPad, left: 30 + p.leftPad, right: 50 }, duration: 0 })
  }, [p.bottomPad, p.leftPad])

  // ---- community tint + selection feature-state ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !p.snap) return
    const comms = p.snap.communities[p.res].communities
    for (const a of p.snap.areas) {
      const col = p.showFlows ? comms[a.c[p.res]].color : undefined
      map.setFeatureState({ source: 'areas', id: a.code }, {
        tint: col ? mix(col, '#fbfbf8', 0.93) : null,
        selected: a.code === p.area || (p.flow ? a.code === p.flow[0] || a.code === p.flow[1] : false),
      })
    }
  }, [ready, p.snap, p.res, p.area, p.flow, p.showFlows])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setLayoutProperty('ttwa', 'visibility', p.ttwa ? 'visible' : 'none')
  }, [ready, p.ttwa])

  // ---- fly to selection ----
  useEffect(() => {
    const map = mapRef.current
    const s = p.snap
    if (!map || !ready || !s || !p.focusKey) return
    const pad = { top: 60, bottom: 60 + p.bottomPad, left: 60 + p.leftPad, right: 60 }
    if (p.flow) {
      const a = s.byCode.get(p.flow[0]), b = s.byCode.get(p.flow[1])
      if (a && b) map.fitBounds([[Math.min(a.lon, b.lon), Math.min(a.lat, b.lat)], [Math.max(a.lon, b.lon), Math.max(a.lat, b.lat)]],
        { padding: pad, maxZoom: 9, duration: 900 })
    } else if (p.area) {
      const a = s.byCode.get(p.area)
      if (!a) return
      // frame the area and its main connections
      const idx = (p.dir === 'in' ? s.inIdx : s.outIdx)[a.i].slice(0, 12)
      let x0 = a.lon, x1 = a.lon, y0 = a.lat, y1 = a.lat
      for (const k of idx) {
        const b = s.areas[p.dir === 'in' ? s.flows.o[k] : s.flows.d[k]]
        x0 = Math.min(x0, b.lon); x1 = Math.max(x1, b.lon); y0 = Math.min(y0, b.lat); y1 = Math.max(y1, b.lat)
      }
      map.fitBounds([[x0, y0], [x1, y1]], { padding: pad, maxZoom: 7.6, duration: 900 })
    } else if (p.focusKey === 'home') {
      map.fitBounds(UK_BOUNDS, { padding: { top: 30, bottom: 30 + p.bottomPad, left: 30 + p.leftPad, right: 50 }, duration: 900 })
    }
  }, [p.focusKey, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- deck.gl layers ----
  const labelData = useMemo(() => placeLabels(mapRef.current, p.snap, zoom, p.area, p.flow), [p.snap, zoom, viewV, p.area, p.flow, ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const layers = useMemo(() => buildLayers(p, zoom, labelData), [p.snap, p.showFlows, p.res, p.mode, p.min, p.dir, p.area, p.flow, p.hist, zoom, labelData]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { overlayRef.current?.setProps({ layers }) }, [layers])

  return <div ref={el} className="map" role="application" aria-label="Map of commuting connections. Use the panel to search and select areas." />
}

function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a), y = hexToRgb(b)
  return `rgb(${x.map((v, i) => Math.round(v * (1 - t) + y[i] * t)).join(',')})`
}

function buildLayers(p: MapProps, zoom: number, labelData: Placed[]): Layer[] {
  const s = p.snap
  const layers: Layer[] = []
  if (s && p.showFlows) {
    const comms = s.communities[p.res].communities
    const colors = comms.map((c) => hexToRgb(c.color))
    const f = s.flows
    const sel = p.area ? s.byCode.get(p.area) : undefined
    const vis: number[] = []
    for (let k = f.n - 1; k >= 0; k--) if (flowValue(f, k, p.mode) >= p.min) vis.push(k) // small first, big drawn last
    const dim = !!sel || !!p.flow
    const maxLog = Math.log10(50000)
    layers.push(new LineLayer<number>({
      id: 'flows', data: vis, pickable: !dim, autoHighlight: !dim, highlightColor: [20, 20, 20, 200],
      getSourcePosition: (k) => [s.areas[f.o[k]].lon, s.areas[f.o[k]].lat],
      getTargetPosition: (k) => [s.areas[f.d[k]].lon, s.areas[f.d[k]].lat],
      getColor: (k) => {
        const v = flowValue(f, k, p.mode)
        const oc = s.areas[f.o[k]].c[p.res], dc = s.areas[f.d[k]].c[p.res]
        const t = Math.min(1, Math.log10(v + 1) / maxLog)
        let alpha = 14 + 236 * Math.pow(t, 1.7)
        if (oc !== dc) alpha *= 0.45
        if (dim) alpha = Math.min(alpha * 0.12, 16)
        return [...colors[oc], alpha] as [number, number, number, number]
      },
      getWidth: (k) => 0.3 + 3.6 * Math.pow(Math.min(1, Math.log10(flowValue(f, k, p.mode) + 1) / maxLog), 2.6),
      widthUnits: 'pixels', widthMinPixels: 0.35,
      updateTriggers: { getColor: [p.res, p.mode, dim], getWidth: [p.mode] },
    }))

    // selected area's connections as gentle arcs (gradient shows direction: faint at home, strong at workplace)
    if (sel) {
      const ks: number[] = []
      if (p.dir !== 'in') for (const k of s.outIdx[sel.i]) if (flowValue(f, k, p.mode) >= p.min) ks.push(k)
      if (p.dir !== 'out') for (const k of s.inIdx[sel.i]) if (flowValue(f, k, p.mode) >= p.min) ks.push(k)
      const maxV = Math.max(1, ...ks.map((k) => flowValue(f, k, p.mode)))
      ks.sort((a, b) => flowValue(f, a, p.mode) - flowValue(f, b, p.mode))
      layers.push(new ArcLayer<number>({
        id: 'sel-flows', data: ks, pickable: true, autoHighlight: true, highlightColor: [0, 0, 0, 220],
        greatCircle: false, getHeight: 0.18, getTilt: 0,
        getSourcePosition: (k) => [s.areas[f.o[k]].lon, s.areas[f.o[k]].lat],
        getTargetPosition: (k) => [s.areas[f.d[k]].lon, s.areas[f.d[k]].lat],
        getSourceColor: (k) => [...(f.o[k] === sel.i ? OUT_COLOR : IN_COLOR), 70] as [number, number, number, number],
        getTargetColor: (k) => [...(f.o[k] === sel.i ? OUT_COLOR : IN_COLOR), 235] as [number, number, number, number],
        getWidth: (k) => 1 + 9 * Math.sqrt(flowValue(f, k, p.mode) / maxV),
        widthUnits: 'pixels',
        updateTriggers: { getWidth: [p.mode] },
      }))
    }
    if (p.flow) {
      const a = s.byCode.get(p.flow[0]), b = s.byCode.get(p.flow[1])
      if (a && b) layers.push(new ArcLayer({
        id: 'sel-one', data: [0], greatCircle: false, getHeight: 0.18,
        getSourcePosition: () => [a.lon, a.lat], getTargetPosition: () => [b.lon, b.lat],
        getSourceColor: [...OUT_COLOR, 120], getTargetColor: [...OUT_COLOR, 255], getWidth: 6, widthUnits: 'pixels',
      }))
    }
    // representative points
    const pts = s.areas.filter((a) => a.tier === 1 || zoom > 6.2 || a.code === p.area || (p.flow && (a.code === p.flow[0] || a.code === p.flow[1])))
    layers.push(new ScatterplotLayer({
      id: 'points', data: pts, pickable: true,
      getPosition: (a) => [a.lon, a.lat],
      getRadius: (a) => (a.code === p.area || (p.flow && (a.code === p.flow[0] || a.code === p.flow[1])) ? 6 : a.tier === 1 ? 2.6 : 1.8),
      radiusUnits: 'pixels', stroked: true, lineWidthUnits: 'pixels',
      getLineWidth: (a) => (a.code === p.area ? 2 : 1),
      getFillColor: (a) => (a.code === p.area ? [255, 255, 255, 255] : [34, 40, 46, 230]),
      getLineColor: [34, 40, 46, 255],
      updateTriggers: { getRadius: [p.area, p.flow], getFillColor: [p.area], getLineWidth: [p.area] },
    }))
  }

  // ---- historical layers ----
  if (p.hist) {
    const infra = p.hist.infra
    layers.push(new PathLayer<InfraFeature, PathStyleExtensionProps<InfraFeature>>({
      id: 'hist-infra', data: infra.filter((x) => x.path.length > 1), pickable: true,
      getPath: (x) => x.path, getColor: (x) => [...hexToRgb(x.kind === 'tramway' ? '#7b3fa0' : x.kind === 'underground' ? '#c2185b' : '#3a4651'), 210] as [number, number, number, number],
      getWidth: 3.5, widthUnits: 'pixels', capRounded: true, jointRounded: true,
      getDashArray: [6, 3], dashJustified: true, extensions: [new PathStyleExtension({ dash: true })],
    }))
    layers.push(new ScatterplotLayer<Station>({
      id: 'hist-infra-pts', data: infra.flatMap((x) => x.stations), pickable: false,
      getPosition: (st) => [st.lon, st.lat],
      getRadius: 3, radiusUnits: 'pixels', getFillColor: [255, 255, 255, 255], stroked: true, getLineColor: [58, 70, 81, 255], lineWidthUnits: 'pixels', getLineWidth: 1.5,
    }))
    const js = p.hist.journeys
    const lines = js.filter((r) => r.origin?.lon != null && r.destination?.lon != null && r.origin.place !== r.destination.place)
    layers.push(new LineLayer<HistRecord>({
      id: 'hist-journeys', data: lines, pickable: true, autoHighlight: true, highlightColor: [0, 0, 0, 255],
      getSourcePosition: (r) => [r.origin.lon!, r.origin.lat!], getTargetPosition: (r) => [r.destination.lon!, r.destination.lat!],
      getColor: (r) => (r.id === p.hist!.selected ? [176, 42, 12, 255] : [176, 42, 12, 200]),
      getWidth: (r) => (r.id === p.hist!.selected ? 4 : 2.5), widthUnits: 'pixels',
      updateTriggers: { getColor: [p.hist.selected], getWidth: [p.hist.selected] },
    }))
    const markers = js.flatMap((r) => [r.origin, r.destination].filter((e) => e?.lon != null).map((e) => ({ ...r, _e: e })))
    layers.push(new ScatterplotLayer<HistRecord & { _e: HistRecord['origin'] }>({
      id: 'hist-markers', data: markers, pickable: true,
      getPosition: (m) => [m._e.lon!, m._e.lat!],
      radiusUnits: 'pixels',
      filled: true, stroked: true, lineWidthUnits: 'pixels', getLineWidth: 2,
      getFillColor: (m) => (m._e.precision === 'area' ? (m.layer === 'statistic' ? [47, 111, 219, 45] : [176, 42, 12, 40]) : [255, 255, 255, 255]),
      getLineColor: (m) => (m.layer === 'statistic' ? [47, 111, 219, 255] : [176, 42, 12, 255]),
      getRadius: (m) => (m.layer === 'statistic' ? 10 + Math.sqrt((m.count ?? 0) / 4000) : m._e.precision === 'area' ? 9 : 5),
    }))
  }

  // ---- labels (greedy screen-space placement computed in placeLabels) ----
  if (s) {
    layers.push(new TextLayer<Placed>({
      id: 'labels', data: labelData,
      getPosition: (a) => [a.lon, a.lat], getText: (a) => a.label,
      getSize: (a) => (a.code === p.area ? 14 : a.tier === 1 ? 12.5 : 11), sizeUnits: 'pixels',
      getColor: (a) => (a.code === p.area ? [10, 10, 10, 255] : [38, 44, 50, 235]),
      fontFamily: '"Inter Variable", Inter, system-ui, sans-serif', fontWeight: 600,
      getTextAnchor: (a) => a.anchor, getAlignmentBaseline: 'center', getPixelOffset: (a) => [a.anchor === 'start' ? 6 : -6, 0],
      fontSettings: { sdf: true, fontSize: 48, buffer: 6 }, outlineWidth: 5, outlineColor: [251, 251, 248, 235],
      characterSet: 'auto',
      updateTriggers: { getSize: [p.area], getColor: [p.area] },
    }))
  }
  return layers
}

type Placed = Area & { anchor: 'start' | 'end' }
function placeLabels(map: maplibregl.Map | null, s: Snapshot | null, zoom: number, area?: string, flow?: [string, string]): Placed[] {
  if (!map || !s) return []
  const maxTier = zoom < 5.6 ? 1 : zoom < 7.2 ? 2 : 3
  const must = new Set([area, flow?.[0], flow?.[1]].filter(Boolean) as string[])
  const cands = s.areas.filter((a) => a.tier <= maxTier || must.has(a.code))
    .sort((a, b) => (must.has(b.code) ? 1 : 0) - (must.has(a.code) ? 1 : 0) || a.tier - b.tier || b.in_total - a.in_total)
  const boxes: [number, number, number, number][] = []
  const out: Placed[] = []
  const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight
  const hit = (bx: [number, number, number, number]) => boxes.some((b) => bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1])
  for (const a of cands) {
    const pt = map.project([a.lon, a.lat])
    if (pt.x < -50 || pt.y < -20 || pt.x > W + 50 || pt.y > H + 20) continue
    const size = must.has(a.code) ? 14 : a.tier === 1 ? 12.5 : 11
    const w = a.label.length * size * 0.58 + 8, h = size + 5
    const right: [number, number, number, number] = [pt.x - 3, pt.y - h / 2, pt.x + w, pt.y + h / 2]
    const left: [number, number, number, number] = [pt.x - w, pt.y - h / 2, pt.x + 3, pt.y + h / 2]
    if (!hit(right) || must.has(a.code)) { boxes.push(right); out.push({ ...a, anchor: 'start' }) }
    else if (!hit(left)) { boxes.push(left); out.push({ ...a, anchor: 'end' }) }
  }
  return out
}

function tooltip(info: PickingInfo, s: Snapshot | null, mode: ModeFilter) {
  const id = info.layer?.id
  if (!info.object && info.object !== 0) return null
  const style = { className: 'tip' } as const
  if ((id === 'flows' || id === 'sel-flows') && s && typeof info.object === 'number') {
    const k = info.object
    const a = s.areas[s.flows.o[k]], b = s.areas[s.flows.d[k]]
    return { ...style, html: `<b>${a.name} → ${b.name}</b><br>${fmt(flowValue(s.flows, k, mode))} people (2011)<br><span>Click for details</span>` }
  }
  if (id === 'points') {
    const a = info.object as { name: string }
    return { ...style, html: `<b>${a.name}</b><br><span>Click to see connections</span>` }
  }
  if (id === 'hist-journeys' || id === 'hist-markers') {
    const r = info.object as HistRecord
    return { ...style, html: `<b>${r.title}</b><br>${r.dateLabel}<br><span>Click for the evidence</span>` }
  }
  if (id === 'hist-infra') {
    const x = info.object as InfraFeature
    return { ...style, html: `<b>${x.name}</b><br>${x.dateLabel}<br><span>Schematic: straight lines between documented stations</span>` }
  }
  return null
}
