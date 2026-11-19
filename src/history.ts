// "200 years of the British commute": historical evidence model.
// Every record keeps its own documented dates. The year slider only filters by those validity intervals;
// nothing is interpolated between records and individual accounts are never scaled as commuter counts.

export type Precision = 'exact' | 'approximate' | 'area' | 'unknown'

export interface Endpoint {
  place: string            // modern place name used on the map
  original?: string        // place name / definition as written in the source
  lon?: number
  lat?: number
  precision: Precision     // how precisely the evidence locates this end of the journey
  note?: string            // e.g. how the map point was chosen
}

export interface SourceRef {
  title: string
  author?: string
  institution?: string
  published?: string       // publication date of the source (separate from the journey date)
  url: string
  ref?: string             // page, chapter, archive reference
  accessed: string         // date the source was checked (YYYY-MM-DD)
}

export interface HistRecord {
  id: string               // short, hyphen-free id (used in share links)
  layer: 'journey' | 'statistic' | 'reconstruction'
  title: string
  person: string           // person or group, where identified
  occupation?: string
  start: number            // first year the documented journey applies
  end: number              // last year it applies (same as start for a one-off account)
  dateLabel: string        // human-readable date or date range, as supported by the source
  mode?: string
  frequency?: string       // only where documented
  duration?: string        // only where documented
  durationKind?: string    // e.g. 'door to door (self-reported)', 'scheduled train time'
  region: string
  origin: Endpoint
  destination: Endpoint
  account: string          // short factual paraphrase
  quote?: string           // brief quotation (< 15 words) where permitted
  sources: SourceRef[]
  modern?: { origin: string; destination: string; note: string }
  caveats?: string
  count?: number           // statistic layer only: an official count published in the source
}

export interface Station { name: string; lon: number; lat: number }
export interface InfraFeature {
  id: string
  name: string
  kind: 'railway' | 'underground' | 'tramway' | 'other'
  opened: string           // ISO date (or year) of opening to passengers, as documented
  openedYear: number
  closed?: string
  closedYear?: number | null
  dateLabel: string
  stations: Station[]      // documented termini / key stations, in order
  path: [number, number][] // schematic: straight segments between the listed stations (not the track alignment)
  note?: string
  sources: SourceRef[]
}

export interface StatSnapshot {
  id: string
  year: number
  date: string             // census day
  label: string
  coverage: string
  inApp: boolean           // true when the full flow table is drawn on the map
  note: string
  sources: SourceRef[]
}

export interface HistoryData {
  generated: string
  records: HistRecord[]
  infrastructure: InfraFeature[]
  snapshots: StatSnapshot[]
  coverage: { period: string; statistical: string; journeys: string; infrastructure: string }[]
}

export const TIMELINE_START = 1800

export async function loadHistory(): Promise<HistoryData> {
  const r = await fetch(import.meta.env.BASE_URL + 'data/history.json')
  if (!r.ok) throw new Error(`Could not load historical records (HTTP ${r.status})`)
  return r.json()
}

export function activeRecords(h: HistoryData, year: number, showRecon: boolean) {
  return h.records.filter((r) => r.start <= year && year <= r.end && (showRecon || r.layer !== 'reconstruction'))
}
export function activeInfra(h: HistoryData, year: number) {
  return h.infrastructure.filter((x) => x.openedYear <= year && (x.closedYear == null || year < x.closedYear))
}
export function snapshotFor(h: HistoryData, year: number, present: number) {
  const exact = h.snapshots.find((s) => s.year === year)
  if (exact) return { snap: exact, latest: false }
  if (year >= present) {
    const latest = [...h.snapshots].filter((s) => s.inApp).sort((a, b) => b.year - a.year)[0]
    return latest ? { snap: latest, latest: true } : null
  }
  return null
}

// Years that carry evidence of any kind (for slider markers and previous/next buttons)
export function evidenceYears(h: HistoryData) {
  const ys = new Set<number>()
  for (const r of h.records) { ys.add(r.start); if (r.end !== r.start) ys.add(r.end) }
  for (const x of h.infrastructure) { ys.add(x.openedYear); if (x.closedYear) ys.add(x.closedYear) }
  for (const s of h.snapshots) ys.add(s.year)
  return [...ys].sort((a, b) => a - b)
}

export function nearestDocumented(h: HistoryData, year: number) {
  // nearest year at which at least one journey record or statistical snapshot is valid
  let best: number | undefined, bestD = Infinity
  const consider = (y: number) => { const d = Math.abs(y - year); if (d < bestD) { bestD = d; best = y } }
  for (const r of h.records) consider(Math.max(r.start, Math.min(r.end, year)))
  for (const s of h.snapshots) consider(s.year)
  return best
}
