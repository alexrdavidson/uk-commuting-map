// Shareable state in the URL hash, using only letters, digits and hyphens so links survive every host
// (including sandboxed previews that only pass a plain #name). Example:
//   #area-E41000324-dir-in-mode-train-min-50
//   #flow-E41000201-E41000324
//   #y1863-rec-h03
import { MODES, type ModeFilter, type ResKey } from './data'

export type Dir = 'out' | 'in' | 'both'
export interface ViewState {
  area?: string
  flow?: [string, string]
  dir: Dir
  mode: ModeFilter
  min: number
  res: ResKey
  ttwa: boolean
  timeline: boolean
  year: number
  rec?: string
}

export const DEFAULT_MIN = 10
export const PRESENT_YEAR = 2026
export const defaultState = (): ViewState => ({
  dir: 'out', mode: 'all', min: DEFAULT_MIN, res: 'r1_0', ttwa: false, timeline: false, year: 2011,
})

const RES_TOKENS: Record<string, ResKey> = { '05': 'r0_5', '10': 'r1_0', '20': 'r2_0' }
const RES_OUT: Record<ResKey, string> = { r0_5: '05', r1_0: '10', r2_0: '20' }

export function parseHash(hash: string): ViewState {
  const s = defaultState()
  const t = hash.replace(/^#/, '').split('-').filter(Boolean)
  for (let i = 0; i < t.length; i++) {
    const k = t[i]
    if (k === 'area' && t[i + 1]) s.area = t[++i]
    else if (k === 'flow' && t[i + 1] && t[i + 2]) { s.flow = [t[i + 1], t[i + 2]]; i += 2 }
    else if (k === 'dir' && ['in', 'out', 'both'].includes(t[i + 1])) s.dir = t[++i] as Dir
    else if (k === 'mode' && (MODES as readonly string[]).includes(t[i + 1])) s.mode = t[++i] as ModeFilter
    else if (k === 'min' && /^\d+$/.test(t[i + 1] ?? '')) s.min = Math.max(1, Math.min(5000, +t[++i]))
    else if (k === 'res' && RES_TOKENS[t[i + 1]]) s.res = RES_TOKENS[t[++i]]
    else if (k === 'ttwa') s.ttwa = true
    else if (/^y\d{4}$/.test(k)) { s.timeline = true; s.year = Math.max(1800, Math.min(PRESENT_YEAR, +k.slice(1))) }
    else if (k === 'rec' && t[i + 1]) { s.rec = t[++i]; s.timeline = true }
  }
  return s
}

export function toHash(s: ViewState): string {
  const t: string[] = []
  if (s.timeline) t.push(`y${s.year}`)
  if (s.rec) t.push('rec', s.rec)
  if (s.flow) t.push('flow', s.flow[0], s.flow[1])
  else if (s.area) t.push('area', s.area)
  if (s.dir !== 'out') t.push('dir', s.dir)
  if (s.mode !== 'all') t.push('mode', s.mode)
  if (s.min !== DEFAULT_MIN) t.push('min', String(s.min))
  if (s.res !== 'r1_0') t.push('res', RES_OUT[s.res])
  if (s.ttwa) t.push('ttwa')
  return t.length ? '#' + t.join('-') : ''
}
