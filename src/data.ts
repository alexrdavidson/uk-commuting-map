// Data loading and types for the 2011 census commuting snapshot and the historical timeline.

export const MODES = ['metro', 'train', 'bus', 'taxi', 'moto', 'car', 'passenger', 'bicycle', 'foot', 'other'] as const
export type ModeKey = (typeof MODES)[number]
export type ModeFilter = 'all' | ModeKey

export const MODE_LABEL: Record<ModeFilter, string> = {
  all: 'All methods of travel',
  metro: 'Underground, metro, light rail or tram',
  train: 'Train',
  bus: 'Bus, minibus or coach',
  taxi: 'Taxi',
  moto: 'Motorcycle, scooter or moped',
  car: 'Driving a car or van',
  passenger: 'Passenger in a car or van',
  bicycle: 'Bicycle',
  foot: 'On foot',
  other: 'Other method',
}
export const MODE_SHORT: Record<ModeKey, string> = {
  metro: 'Metro/tram', train: 'Train', bus: 'Bus/coach', taxi: 'Taxi', moto: 'Motorcycle',
  car: 'Car driver', passenger: 'Car passenger', bicycle: 'Bicycle', foot: 'On foot', other: 'Other',
}
export const MODE_COLOR: Record<ModeKey, string> = {
  metro: '#7b3fa0', train: '#2f6fdb', bus: '#e3262b', taxi: '#d4a106', moto: '#8d6e3f',
  car: '#5b6770', passenger: '#9aa5ad', bicycle: '#2fa84f', foot: '#00a3a3', other: '#c9c9c9',
}

export type ResKey = 'r0_5' | 'r1_0' | 'r2_0'
export const RES_LABEL: Record<ResKey, string> = { r0_5: 'Broad', r1_0: 'Standard', r2_0: 'Detailed' }

export interface Area {
  i: number
  code: string
  census_name: string
  name: string
  label: string
  tier: number
  nation: string
  lon: number
  lat: number
  aliases: string[]
  resident_workers: number
  within: number
  out_total: number
  in_total: number
  home: number
  no_fixed: number
  offshore: number
  outside_uk: number
  jobs_filled: number
  c: Record<ResKey, number>
  ttwa11: string
  point_method: 'pwc' | 'pwc_nearest_cell'
}

export interface Community {
  id: number
  hub_code: string
  hub_name: string
  members: number
  color: string
  nations: string[]
  resident_workers: number
  jobs_filled: number
}

export interface CommunitySet {
  resolution: number
  seed: number
  modularity: number
  stability_ami_mean: number
  stability_ami_min: number
  communities: Community[]
}

export interface Flows {
  n: number
  o: Uint16Array
  d: Uint16Array
  total: Uint32Array
  modes: Record<ModeKey, Uint32Array>
}

export interface Snapshot {
  areas: Area[]
  byCode: Map<string, Area>
  flows: Flows
  communities: Record<ResKey, CommunitySet>
  meta: NetworkMeta
  // per-area flow indices (sorted by total desc)
  outIdx: number[][]
  inIdx: number[][]
}

export interface NetworkMeta {
  method: string
  resolution: number
  communities: number
  modularity: number
  seeds_tried: number
  chosen_seed: number
  stability_ami_mean: number
  stability_ami_min: number
  weighting: string
  self_loops: string
  threshold: string
  leidenalg_version: string
  sensitivity: { resolution: number; communities: number; modularity: number; ami_vs_default: number }[]
  qa: Record<string, unknown> & {
    total_resident_workers: number
    total_between_areas: number
    total_within_areas: number
    total_home: number
    total_no_fixed: number
    total_offshore: number
    total_outside_uk: number
    flows_between_areas_nonzero: number
    share_between_area_commuting_within_communities: number
    ttwa_comparison: { nmi: number; ami: number; ari: number }
  }
}

const base = import.meta.env.BASE_URL

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(base + path)
  if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status})`)
  return r.json() as Promise<T>
}

function parseFlows(text: string): Flows {
  const lines = text.split('\n')
  const header = lines[0].split(',')
  const n = lines.length - 1 - (lines[lines.length - 1] === '' ? 1 : 0)
  const o = new Uint16Array(n), d = new Uint16Array(n), total = new Uint32Array(n)
  const modes = Object.fromEntries(MODES.map((m) => [m, new Uint32Array(n)])) as Record<ModeKey, Uint32Array>
  const modeCols = MODES.map((m) => header.indexOf(m))
  for (let k = 0; k < n; k++) {
    const p = lines[k + 1].split(',')
    o[k] = +p[0]; d[k] = +p[1]; total[k] = +p[2]
    for (let j = 0; j < MODES.length; j++) {
      const v = p[modeCols[j]]
      if (v) modes[MODES[j]][k] = +v
    }
  }
  return { n, o, d, total, modes }
}

export async function loadSnapshot2011(): Promise<Snapshot> {
  const [a, comms, meta, flowsText] = await Promise.all([
    getJSON<{ modes: string[]; areas: Area[] }>('data/areas_2011.json'),
    getJSON<Record<ResKey, CommunitySet>>('data/communities_2011.json'),
    getJSON<NetworkMeta>('data/network_meta_2011.json'),
    fetch(base + 'data/flows_2011.csv').then((r) => {
      if (!r.ok) throw new Error(`Could not load flows (HTTP ${r.status})`)
      return r.text()
    }),
  ])
  const flows = parseFlows(flowsText)
  const areas = a.areas
  const outIdx: number[][] = areas.map(() => [])
  const inIdx: number[][] = areas.map(() => [])
  for (let k = 0; k < flows.n; k++) {
    outIdx[flows.o[k]].push(k)
    inIdx[flows.d[k]].push(k)
  }
  return { areas, byCode: new Map(areas.map((x) => [x.code, x])), flows, communities: comms, meta, outIdx, inIdx }
}

export function flowValue(f: Flows, k: number, mode: ModeFilter): number {
  return mode === 'all' ? f.total[k] : f.modes[mode][k]
}

export function findFlow(s: Snapshot, o: number, d: number): number {
  for (const k of s.outIdx[o]) if (s.flows.d[k] === d) return k
  return -1
}

export const fmt = (n: number) => n.toLocaleString('en-GB')
export const pct = (n: number, d: number) => (d > 0 ? `${((100 * n) / d).toFixed(n / d < 0.01 ? 1 : 0)}%` : '–')

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// Google Maps directions URL (documented "Maps URLs" API: https://developers.google.com/maps/documentation/urls/get-started)
export type TravelMode = 'driving' | 'bicycling' | 'transit'
export function googleMapsUrl(origin: string, destination: string, mode: TravelMode) {
  const p = new URLSearchParams({ api: '1', origin, destination, travelmode: mode })
  return `https://www.google.com/maps/dir/?${p.toString()}`
}
export const latlon = (a: { lat: number; lon: number }) => `${a.lat.toFixed(5)},${a.lon.toFixed(5)}`
